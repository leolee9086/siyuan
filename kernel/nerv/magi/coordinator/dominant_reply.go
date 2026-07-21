package coordinator

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"reflect"
	"strings"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/observability"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func (c *Coordinator) coordinateDominantDirectReply(
	ctx context.Context,
	sessionID, roundID string,
	melchior, balthazar, casper *sages.Sage,
	userMessage string,
	sourceAwareUserInputBySage map[string]string,
	sourceCtx *types.RequestSourceContext,
) (*types.Message, *DominantElectionResult, error) {
	return c.coordinateDominantDirectReplyWithReplyStream(
		ctx,
		sessionID,
		roundID,
		melchior,
		balthazar,
		casper,
		userMessage,
		sourceAwareUserInputBySage,
		sourceCtx,
		nil,
	)
}

func (c *Coordinator) coordinateDominantDirectReplyWithReplyStream(
	ctx context.Context,
	sessionID, roundID string,
	melchior, balthazar, casper *sages.Sage,
	userMessage string,
	sourceAwareUserInputBySage map[string]string,
	sourceCtx *types.RequestSourceContext,
	replyStreamObserver ReplyStreamObserver,
) (*types.Message, *DominantElectionResult, error) {
	excludedDominants := map[string]struct{}{}

	defaultSituation := resolveSourceAwareInputForSage(sourceAwareUserInputBySage, "melchior", userMessage)

	actionPlans, planErr := collectActionPlans(ctx, sessionID, melchior, balthazar, casper, defaultSituation)
	if planErr != nil {
		logging.LogWarnf("直答路径行动计划收集失败（降级为无计划选举）: %v", planErr)
		actionPlans = nil
	}

	for retry := 0; retry < 3; retry++ {
		election, err := electDominantSageWithExclusionsAndSituations(
			ctx,
			sessionID,
			melchior,
			balthazar,
			casper,
			defaultSituation,
			sourceAwareUserInputBySage,
			excludedDominants,
			actionPlans,
		)
		if err != nil {
			logging.LogWarnf("election attempt %d failed: %v, retrying...", retry+1, err)
			continue
		}

		dominantSage, err := resolveDominantSage(election, melchior, balthazar, casper)
		if err != nil {
			return nil, nil, err
		}

		msg, _, collectErr := c.executeDominantReply(ctx, sessionID, roundID, dominantSage, election, userMessage, sourceAwareUserInputBySage, sourceCtx, melchior, balthazar, casper, replyStreamObserver)
		if collectErr != nil {
			var revokedErr *dominantActionRevokedError
			if errors.As(collectErr, &revokedErr) {
				excludedDominants[strings.TrimSpace(dominantSage.GetName())] = struct{}{}
				dominantActionToolGovernance.UnregisterRound(sessionID, roundID)
				appendDominanceRevokedHandoff(
					sessionID,
					buildDominanceRevokedHandoffPrompt(config.WriteDiaryToolName, dominantSage.GetContextForSession(sessionID)),
					melchior,
					balthazar,
					casper,
				)
				continue
			}
			dominantActionToolGovernance.UnregisterRound(sessionID, roundID)
			return nil, nil, fmt.Errorf("主导者直答失败: %w", collectErr)
		}
		dominantActionToolGovernance.UnregisterRound(sessionID, roundID)
		c.notifyDominantSelected(roundID, election)
		compressArchivedQueryResults(sessionID, melchior, balthazar, casper)
		return msg, election, nil
	}

	// 三次选举均失败：随机选一个主导者
	allSages := []*sages.Sage{melchior, balthazar, casper}
	var available []*sages.Sage
	for _, sg := range allSages {
		if sg == nil {
			continue
		}
		name := strings.TrimSpace(sg.GetName())
		if _, excluded := excludedDominants[name]; excluded {
			continue
		}
		available = append(available, sg)
	}
	if len(available) == 0 {
		available = allSages
	}
	pickIdx := rand.Intn(len(available))
	fallbackSage := available[pickIdx]

	logging.LogInfof("选举回退: 随机主导者=%s, 开始安全审查...", fallbackSage.GetName())

	var peerVotes []DominantElectionVote
	allFailed := true
	for _, peer := range available {
		if peer.GetName() == fallbackSage.GetName() {
			continue
		}
		peerCtx, peerCancel := context.WithTimeout(ctx, dominantElectionTimeout)
		vote, err := runPeerSecurityReview(peerCtx, sessionID, peer, userMessage)
		peerCancel()
		if err != nil {
			logging.LogWarnf("  安全审查失败 %s: %v", peer.GetName(), err)
			continue
		}
		logging.LogInfof("  安全审查成功 %s", peer.GetName())
		allFailed = false
		if vote != nil {
			peerVotes = append(peerVotes, *vote)
		}
	}
	if allFailed && len(peerVotes) == 0 {
		return nil, nil, newFakeServiceError()
	}

	logging.LogInfof("安全审查完成: 收集到 %d 份质疑", len(peerVotes))

	election := &DominantElectionResult{
		DominantSeelName:    fallbackSage.GetName(),
		DominantDisplayName: fallbackSage.GetDisplayName(),
		Votes:               peerVotes,
	}
	c.notifyDominantSelected(roundID, election)

	// 注入安全质疑
	injectPeerDoubts(fallbackSage, sessionID, election)

	msg, _, err := c.executeDominantReply(ctx, sessionID, roundID, fallbackSage, election, userMessage, sourceAwareUserInputBySage, sourceCtx, melchior, balthazar, casper, replyStreamObserver)
	if err != nil {
		dominantActionToolGovernance.UnregisterRound(sessionID, roundID)
		return nil, nil, fmt.Errorf("随机主导者直答失败: %w", err)
	}
	dominantActionToolGovernance.UnregisterRound(sessionID, roundID)
	compressArchivedQueryResults(sessionID, melchior, balthazar, casper)
	return msg, election, nil
}

// executeDominantReply 执行主导者回复的全流程（共享给选举路径和回退路径）
func (c *Coordinator) executeDominantReply(
	ctx context.Context,
	sessionID, roundID string,
	dominantSage *sages.Sage,
	election *DominantElectionResult,
	userMessage string,
	sourceAwareUserInputBySage map[string]string,
	sourceCtx *types.RequestSourceContext,
	melchior, balthazar, casper *sages.Sage,
	replyStreamObserver ReplyStreamObserver,
) (*types.Message, *DominantElectionResult, error) {
	beforeContext := dominantSage.GetContextForSession(sessionID)
	streamMessage := buildSeelStreamMessageWithMeta(roundID, dominantSage, buildDominantRuntimeMeta(roundID, election))
	if err := websocket.PushSeelReplyStarted(
		websocket.RuntimeMonitorSessionID,
		roundID,
		dominantSage.GetName(),
		dominantSage.GetDisplayName(),
		userMessage,
		streamMessage,
	); err != nil {
		logging.LogWarnf("推送主导者开始响应失败: %v", err)
	}

	dominantSage.MarkCurrentRoundDominant(sessionID, roundID)

	injectPeerDoubts(dominantSage, sessionID, election)

	dominantActionToolGovernance.RegisterRound(
		sessionID, roundID, userMessage, dominantSage,
		melchior, balthazar, casper,
	)
	response, collectErr := c.collector.collectSingleSageResponse(
		ctx,
		sessionID,
		roundID,
		dominantSage,
		resolveSourceAwareInputForSage(sourceAwareUserInputBySage, dominantSage.GetName(), userMessage),
		CollectResponsesOptions{
			RuntimeTools:               buildDominantDirectReplyRuntimeTools(dominantSage),
			RuntimeToolChoice:          dominantSage.GetToolChoice(),
			IsExternalMessageTriggered: true,
			ReplyStreamObserver:        replyStreamObserver,
		},
	)

	afterContext := dominantSage.GetContextForSession(sessionID)
	deltaMessages := diffAppendedContextMessages(beforeContext, afterContext)
	if len(deltaMessages) > 0 {
		shareDominantContextDelta(
			sessionID,
			dominantSage.GetName(),
			deltaMessages,
			melchior,
			balthazar,
			casper,
		)
	}

	if collectErr != nil {
		return nil, nil, collectErr
	}

	if response == nil {
		return nil, nil, fmt.Errorf("主导者直答结果为空")
	}

	return buildDominantDirectReplyMessage(roundID, response, election, sourceCtx), election, nil
}

func buildDominantRuntimeMeta(roundID string, election *DominantElectionResult) map[string]interface{} {
	if election == nil {
		return nil
	}

	meta := map[string]interface{}{
		"dominantSeel":        strings.TrimSpace(election.DominantSeelName),
		"dominantDisplayName": strings.TrimSpace(election.DominantDisplayName),
		"dominantStance":      strings.TrimSpace(election.DominantStance),
	}
	if trimmedRoundID := strings.TrimSpace(roundID); trimmedRoundID != "" {
		meta["roundId"] = trimmedRoundID
	}
	return meta
}

func buildDominantDirectReplyRuntimeTools(dominantSage *sages.Sage) []openai.Tool {
	if dominantSage == nil {
		return nil
	}

	baseTools := append([]openai.Tool(nil), dominantSage.GetTools()...)
	if !toolSetHasAllFunctionTools(baseTools, config.PersistSessionMemoryToolName) {
		baseTools = append(baseTools, buildRuntimeTool(config.BuildPersistSessionMemoryToolDef()))
	}
	if !toolSetHasAllFunctionTools(baseTools, config.RecallCrossSessionMemoriesToolName) {
		baseTools = append(baseTools, buildRuntimeTool(config.BuildRecallCrossSessionMemoriesToolDef()))
	}
	if !toolSetHasAllFunctionTools(baseTools, config.ListMagiChannelsToolName) {
		baseTools = append(baseTools, buildRuntimeTool(config.BuildListMagiChannelsToolDef()))
	}
	if !toolSetHasAllFunctionTools(baseTools, config.ListMagiContactsToolName) {
		baseTools = append(baseTools, buildRuntimeTool(config.BuildListMagiContactsToolDef()))
	}
	if !toolSetHasAllFunctionTools(baseTools, config.SendChannelMessageToolName) {
		baseTools = append(baseTools, buildRuntimeTool(config.BuildSendChannelMessageToolDef()))
	}
	if toolSetHasAllFunctionTools(baseTools, config.WriteDiaryToolName) {
		return baseTools
	}
	return append(baseTools, buildRuntimeTool(config.BuildWriteDiaryToolDef()))
}

func buildDominantDirectReplyMessage(
	roundID string,
	response *types.SageResponse,
	election *DominantElectionResult,
	sourceCtx *types.RequestSourceContext,
) *types.Message {
	content := ""
	if response != nil {
		content = strings.TrimSpace(response.Content)
	}

	meta := map[string]interface{}{
		"mode":   types.ConsensusModeStandard,
		"source": "dominant-direct",
	}
	if trimmedRoundID := strings.TrimSpace(roundID); trimmedRoundID != "" {
		meta["roundId"] = trimmedRoundID
	}
	if election != nil {
		meta["dominantSeel"] = strings.TrimSpace(election.DominantSeelName)
		meta["dominantDisplayName"] = strings.TrimSpace(election.DominantDisplayName)
		meta["dominantStance"] = strings.TrimSpace(election.DominantStance)
	}
	if response != nil {
		meta["replySeel"] = strings.TrimSpace(response.Seel)
		meta["replyDisplayName"] = strings.TrimSpace(response.DisplayName)
		if response.RequiresDeliberation {
			meta["requiresDeliberation"] = true
		}
	}
	if sourceCtx != nil {
		identityID := strings.TrimSpace(sourceCtx.IdentityID)
		if identityID == "" {
			identityID = strings.TrimSpace(sourceCtx.PrincipalID)
		}
		nickname := strings.TrimSpace(sourceCtx.Nickname)
		if nickname == "" {
			nickname = identityID
		}
		meta["requestSource"] = map[string]interface{}{
			"requestId":             sourceCtx.RequestID,
			"channel":               sourceCtx.Channel,
			"principalId":           sourceCtx.PrincipalID,
			"identityId":            identityID,
			"nickname":              nickname,
			"interfaceId":           sourceCtx.InterfaceID,
			"interfaceKind":         sourceCtx.InterfaceKind,
			"sourceSessionKey":      sourceCtx.SourceSessionKey,
			"directResponseAllowed": sourceCtx.DirectResponseAllowed,
			"trustBase":             sourceCtx.TrustBase,
			"riskLevel":             sourceCtx.RiskLevel,
			"authStrength":          sourceCtx.AuthStrength,
			"modelIntent":           sourceCtx.ModelIntent,
		}
	}

	return &types.Message{
		ID:        "consensus-" + util.RandString(12),
		Type:      types.TypeConsensus,
		Content:   content,
		Status:    types.StatusSuccess,
		Timestamp: util.CurrentTimeMillis(),
		Meta:      meta,
	}
}

func diffAppendedContextMessages(
	before []types.ContextMessage,
	after []types.ContextMessage,
) []types.ContextMessage {
	if len(after) == 0 {
		return nil
	}

	maxOverlap := minInt(len(before), len(after))
	for overlap := maxOverlap; overlap >= 0; overlap-- {
		if contextMessageSlicesEqual(before[len(before)-overlap:], after[:overlap]) {
			return cloneCoordinatorContextMessages(after[overlap:])
		}
	}
	return cloneCoordinatorContextMessages(after)
}

func shareDominantContextDelta(
	sessionID string,
	dominantSeelName string,
	deltaMessages []types.ContextMessage,
	sagesToSync ...*sages.Sage,
) {
	if len(deltaMessages) == 0 {
		return
	}

	sanitizedDelta := sanitizeSharedContextMessages(dominantSeelName, deltaMessages)
	for _, sage := range sagesToSync {
		if sage == nil || strings.EqualFold(strings.TrimSpace(sage.GetName()), strings.TrimSpace(dominantSeelName)) {
			continue
		}
		for _, msg := range cloneCoordinatorContextMessages(sanitizedDelta) {
			_ = sage.AddToContextWithSession(sessionID, msg)
		}
	}
}

func sanitizeSharedContextMessages(
	dominantSeelName string,
	messages []types.ContextMessage,
) []types.ContextMessage {
	cloned := cloneCoordinatorContextMessages(messages)
	if !strings.EqualFold(strings.TrimSpace(dominantSeelName), "melchior") {
		return cloned
	}

	toolCallsByID := map[string]types.ToolCall{}
	for index := range cloned {
		msg := &cloned[index]
		if msg.Role == types.RoleAssistant && len(msg.ToolCalls) > 0 {
			for _, call := range msg.ToolCalls {
				if strings.TrimSpace(call.ID) == "" {
					continue
				}
				toolCallsByID[strings.TrimSpace(call.ID)] = call
			}
			continue
		}
		if msg.Role != types.RoleTool || strings.TrimSpace(msg.ToolID) == "" {
			continue
		}

		toolID := strings.TrimSpace(msg.ToolID)
		call, ok := toolCallsByID[toolID]
		if !ok || !isArchivedQueryTool(strings.TrimSpace(call.Function.Name)) {
			continue
		}

		summary, err := buildCompactToolHistorySummary(
			call,
			msg.Content,
			nil,
		)
		if err != nil {
			continue
		}
		msg.Content = summary
	}
	return cloned
}

func cloneCoordinatorContextMessages(messages []types.ContextMessage) []types.ContextMessage {
	if len(messages) == 0 {
		return nil
	}

	cloned := make([]types.ContextMessage, 0, len(messages))
	for _, msg := range messages {
		next := msg
		if len(msg.ToolCalls) > 0 {
			next.ToolCalls = append([]types.ToolCall(nil), msg.ToolCalls...)
		}
		if msg.Meta != nil {
			metaCopy := make(map[string]interface{}, len(msg.Meta))
			for key, value := range msg.Meta {
				metaCopy[key] = value
			}
			next.Meta = metaCopy
		}
		cloned = append(cloned, next)
	}
	return cloned
}

func appendDominanceRevokedHandoff(sessionID string, prompt string, sagesToSync ...*sages.Sage) {
	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		return
	}
	for _, sage := range sagesToSync {
		if sage == nil {
			continue
		}
		_ = sage.AddToContextWithSession(sessionID, types.ContextMessage{
			Role:    types.RoleSystem,
			Content: prompt,
		})
	}
}

func contextMessageSlicesEqual(left []types.ContextMessage, right []types.ContextMessage) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if !reflect.DeepEqual(left[index], right[index]) {
			return false
		}
	}
	return true
}

func injectPeerDoubts(dominantSage *sages.Sage, sessionID string, election *DominantElectionResult) {
	if election == nil || len(election.Votes) == 0 {
		return
	}
	var allDoubts []string
	for _, vote := range election.Votes {
		for _, d := range vote.Doubts {
			if trimmed := strings.TrimSpace(d); trimmed != "" {
				allDoubts = append(allDoubts, "【"+vote.VoterDisplayName+"】"+trimmed)
			}
		}
	}
	logging.LogInfof("安全审查结果: votes=%d doubts=%d", len(election.Votes), len(allDoubts))
	for _, d := range allDoubts {
		observability.Detailf("安全审查质疑: %s", d)
	}
	if len(allDoubts) > 0 {
		_ = dominantSage.AddToContextWithSession(sessionID, types.ContextMessage{
			Role:    types.RoleSystem,
			Content: "以下是安全团队对当前输入提出的质疑，请在回应时一并考量：\n" + strings.Join(allDoubts, "\n"),
		})
	}
}

func runPeerSecurityReview(
	ctx context.Context,
	sessionID string,
	peer *sages.Sage,
	userMessage string,
) (*DominantElectionVote, error) {
	msgs := peer.BuildRequestMessagesForSession(
		sessionID,
		types.ContextMessage{
			Role:    types.RoleSystem,
			Content: prompts.BuildSecurityReviewPrompt(userMessage),
		},
	)
	result, err := peer.GetLLMClient().SendChatRequestSyncDetailed(ctx, msgs, nil, nil)
	if err != nil {
		return nil, err
	}
	content := strings.TrimSpace(result.Content)
	observability.Detailf("安全审查回复: sage=%s content=%s", peer.GetName(), content)
	if content == "" {
		return nil, fmt.Errorf("peer security review returned empty content")
	}
	return &DominantElectionVote{
		VoterSeelName:    peer.GetName(),
		VoterDisplayName: peer.GetDisplayName(),
		Doubts:           []string{content},
	}, nil
}

type fakeServiceError struct {
	msg string
}

func (e *fakeServiceError) Error() string {
	return e.msg
}

func newFakeServiceError() error {
	if rand.Intn(2) == 0 {
		return &fakeServiceError{msg: "404 page not found"}
	}
	return &fakeServiceError{msg: "500 Internal Server Error"}
}
