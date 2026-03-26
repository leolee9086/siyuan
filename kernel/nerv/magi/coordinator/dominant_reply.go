package coordinator

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
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
	sourceAwareUserInput string,
	sourceCtx *types.RequestSourceContext,
) (*types.Message, *DominantElectionResult, error) {
	excludedDominants := map[string]struct{}{}

	for retry := 0; retry < 3; retry++ {
		election, err := electDominantSageWithExclusions(
			ctx,
			sessionID,
			melchior,
			balthazar,
			casper,
			sourceAwareUserInput,
			excludedDominants,
		)
		if err != nil {
			return nil, nil, fmt.Errorf("主导者选举失败: %w", err)
		}

		dominantSage, err := resolveDominantSage(election, melchior, balthazar, casper)
		if err != nil {
			return nil, nil, err
		}

		c.notifyDominantSelected(roundID, election)
		dominantActionToolGovernance.RegisterRound(sessionID, roundID, userMessage, dominantSage, melchior, balthazar, casper)
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

		response, collectErr := c.collector.collectSingleSageResponse(
			ctx,
			sessionID,
			roundID,
			dominantSage,
			sourceAwareUserInput,
			CollectResponsesOptions{
				RuntimeTools:      buildDominantDirectReplyRuntimeTools(dominantSage),
				RuntimeToolChoice: dominantSage.GetToolChoice(),
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
			var revokedErr *dominantActionRevokedError
			if errors.As(collectErr, &revokedErr) {
				excludedDominants[strings.TrimSpace(dominantSage.GetName())] = struct{}{}
				dominantActionToolGovernance.UnregisterRound(sessionID, roundID)
				appendDominanceRevokedHandoff(
					sessionID,
					buildDominanceRevokedHandoffPrompt(dominantSage.GetName(), config.WriteDiaryToolName),
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

		if response == nil {
			return nil, nil, fmt.Errorf("主导者直答结果为空")
		}

		return buildDominantDirectReplyMessage(roundID, response, election, sourceCtx), election, nil
	}

	return nil, nil, fmt.Errorf("主导者在行动工具审议中连续失格，当前轮次无法继续")
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
			sage.AddToContextWithSession(sessionID, msg)
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
	assistantContentByToolID := map[string]string{}
	for index := range cloned {
		msg := &cloned[index]
		if msg.Role == types.RoleAssistant && len(msg.ToolCalls) > 0 {
			for _, call := range msg.ToolCalls {
				if strings.TrimSpace(call.ID) == "" {
					continue
				}
				toolCallsByID[strings.TrimSpace(call.ID)] = call
				assistantContentByToolID[strings.TrimSpace(call.ID)] = strings.TrimSpace(msg.Content)
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
			assistantContentByToolID[toolID],
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
		sage.AddToContextWithSession(sessionID, types.ContextMessage{
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
