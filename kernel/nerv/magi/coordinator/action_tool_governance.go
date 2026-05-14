package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

type governedActionVoteOutcome struct {
	VoteResult       *VoteResult
	ApprovalRound    int
	Rejected         bool
	LostDominance    bool
	RejectionCount   int
	RejectionReasons []governedActionRejectionReason
}

type governedActionRejectionReason struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
}

type governedActionFailureAttempt struct {
	ToolName         string
	Motivation       string
	RejectionReasons []governedActionRejectionReason
	ReviewSummary    string
}

type dominantActionRevokedError struct {
	DominantSeelName string
	ToolName         string
	Reason           string
}

func (e *dominantActionRevokedError) Error() string {
	if e == nil {
		return "当前轮次资格已撤销"
	}
	parts := []string{"当前轮次在行动工具审议中失去执行资格"}
	if name := strings.TrimSpace(e.DominantSeelName); name != "" {
		parts = append(parts, "贤者="+name)
	}
	if toolName := strings.TrimSpace(e.ToolName); toolName != "" {
		parts = append(parts, "工具="+toolName)
	}
	if reason := strings.TrimSpace(e.Reason); reason != "" {
		parts = append(parts, "原因="+reason)
	}
	return strings.Join(parts, "，")
}

type actionToolGovernanceRegistry struct {
	mu        sync.RWMutex
	rounds    map[string]*actionToolGovernanceState
	votingCfg VotingConfig
}

type actionToolGovernanceState struct {
	votingCfg           VotingConfig
	sessionID           string
	roundID             string
	userMessage         string
	currentDominantSeel string
	rejectionCount      int
	sagesBySeel         map[string]*sages.Sage
}

var dominantActionToolGovernance = &actionToolGovernanceRegistry{
	rounds: map[string]*actionToolGovernanceState{},
}

func (r *actionToolGovernanceRegistry) SetVotingConfig(cfg VotingConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.votingCfg = cfg
}

func (r *actionToolGovernanceRegistry) RegisterRound(
	sessionID, roundID string,
	userMessage string,
	currentDominant *sages.Sage,
	allSages ...*sages.Sage,
) {
	if currentDominant == nil {
		return
	}

	state := &actionToolGovernanceState{
		votingCfg:           r.votingCfg,
		sessionID:           strings.TrimSpace(sessionID),
		roundID:             strings.TrimSpace(roundID),
		userMessage:         strings.TrimSpace(userMessage),
		currentDominantSeel: strings.TrimSpace(currentDominant.GetName()),
		sagesBySeel:         map[string]*sages.Sage{},
	}
	for _, sage := range allSages {
		if sage == nil {
			continue
		}
		name := strings.TrimSpace(sage.GetName())
		if name == "" {
			continue
		}
		state.sagesBySeel[name] = sage
	}
	if _, ok := state.sagesBySeel[state.currentDominantSeel]; !ok {
		state.sagesBySeel[state.currentDominantSeel] = currentDominant
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	r.rounds[actionToolGovernanceKey(sessionID, roundID)] = state
}

func (r *actionToolGovernanceRegistry) UpdateDominant(sessionID, roundID string, currentDominant *sages.Sage) {
	if currentDominant == nil {
		return
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	state, ok := r.rounds[actionToolGovernanceKey(sessionID, roundID)]
	if !ok || state == nil {
		return
	}
	state.currentDominantSeel = strings.TrimSpace(currentDominant.GetName())
	state.rejectionCount = 0
	if state.sagesBySeel == nil {
		state.sagesBySeel = map[string]*sages.Sage{}
	}
	if name := strings.TrimSpace(currentDominant.GetName()); name != "" {
		state.sagesBySeel[name] = currentDominant
	}
}

func (r *actionToolGovernanceRegistry) UnregisterRound(sessionID, roundID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.rounds, actionToolGovernanceKey(sessionID, roundID))
}

func (r *actionToolGovernanceRegistry) EvaluateActionVote(
	ctx context.Context,
	sessionID, roundID string,
	sage *sages.Sage,
	assistantContent string,
	toolCall types.ToolCall,
) (*governedActionVoteOutcome, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	state, ok := r.rounds[actionToolGovernanceKey(sessionID, roundID)]
	if !ok || state == nil {
		return nil, false, nil
	}
	outcome, err := state.evaluateGovernedActionVoteLocked(ctx, sage, assistantContent, toolCall)
	if err != nil {
		return nil, true, err
	}
	return outcome, true, nil
}

func (s *actionToolGovernanceState) evaluateGovernedActionVoteLocked(
	ctx context.Context,
	sage *sages.Sage,
	assistantContent string,
	toolCall types.ToolCall,
) (*governedActionVoteOutcome, error) {
	if sage == nil {
		return nil, fmt.Errorf("行动工具审议缺少调用者信息")
	}

	sageName := strings.TrimSpace(sage.GetName())
	if sageName == "" {
		return nil, fmt.Errorf("行动工具审议缺少调用者名称")
	}
	toolName := strings.TrimSpace(toolCall.Function.Name)
	if !isGovernedActionToolName(toolName) {
		return nil, fmt.Errorf("工具 %s 不在行动工具治理范围内", toolName)
	}
	if !strings.EqualFold(s.currentDominantSeel, sageName) {
		return nil, fmt.Errorf("当前轮次不允许调用 %s", toolName)
	}

	peers := s.peerReviewersLocked(sageName)
	if len(peers) != 2 {
		return nil, fmt.Errorf("%s 的行动工具审议要求两位辅助贤者，当前=%d", toolName, len(peers))
	}

	pendingToolCall, motivation, err := buildGovernedActionToolCall(toolCall)
	if err != nil {
		return nil, err
	}

	approvalRound := s.rejectionCount + 1
	voteCtx := VoteContext{
		UserMessage:            strings.TrimSpace(s.userMessage),
		ProposerDisplayName:    strings.TrimSpace(sage.GetDisplayName()),
		ProposerConclusion:     strings.TrimSpace(assistantContent),
		GovernedActionToolCall: pendingToolCall,
	}

	voteResult, err := ProcessPeerVoting(
		ctx,
		s.sessionID,
		s.roundID,
		sageName,
		strings.TrimSpace(sage.GetDisplayName()),
		peers[0],
		peers[1],
		toolName,
		voteCtx,
		sageName,
		fmt.Sprintf("申请执行 %s：%s", toolName, motivation),
		approvalRound,
		s.votingCfg,
	)
	if err != nil {
		return nil, err
	}

	outcome := &governedActionVoteOutcome{
		VoteResult:    voteResult,
		ApprovalRound: approvalRound,
	}
	if voteResult != nil && voteResult.Passed {
		s.rejectionCount = 0
		return outcome, nil
	}

	s.rejectionCount++
	outcome.Rejected = true
	outcome.RejectionCount = s.rejectionCount
	outcome.RejectionReasons = collectGovernedActionRejectionReasons(voteResult, sageName)
	if s.rejectionCount >= 2 {
		outcome.LostDominance = true
	}
	return outcome, nil
}

func (s *actionToolGovernanceState) peerReviewersLocked(currentDominantSeel string) []*sages.Sage {
	ret := make([]*sages.Sage, 0, len(s.sagesBySeel))
	for seelName, sage := range s.sagesBySeel {
		if sage == nil || strings.EqualFold(strings.TrimSpace(seelName), strings.TrimSpace(currentDominantSeel)) {
			continue
		}
		ret = append(ret, sage)
	}
	return ret
}

func actionToolGovernanceKey(sessionID, roundID string) string {
	return strings.TrimSpace(sessionID) + "::" + strings.TrimSpace(roundID)
}

func buildGovernedActionRetryPrompt(toolName string) string {
	toolName = strings.TrimSpace(toolName)
	if toolName == "" {
		toolName = "当前行动工具"
	}
	return fmt.Sprintf(
		"%s 本轮未获通过。你可以调整方案后再次调用，或放弃该工具并直接完成当前回复；若再次被否决，当前轮次将改由其他处理路径继续。",
		toolName,
	)
}

func buildDominanceRevokedHandoffPrompt(toolName string, messages []types.ContextMessage) string {
	toolName = strings.TrimSpace(toolName)
	if toolName == "" {
		toolName = "行动工具"
	}

	attempts := collectGovernedActionFailureAttempts(messages, toolName)
	if len(attempts) == 0 {
		return fmt.Sprintf("%s 在上一轮行动审核中连续两次未获通过。请先从当前历史中核对这两次失败尝试的原因，再吸取教训继续完成当前任务，避免重复同类问题。", toolName)
	}

	lines := []string{
		fmt.Sprintf("%s 在上一轮行动审核中连续两次未获通过。以下是失败历史：", toolName),
	}
	for index, attempt := range attempts {
		line := fmt.Sprintf("%d. 工具=%s", index+1, attempt.ToolName)
		if motivation := strings.TrimSpace(attempt.Motivation); motivation != "" {
			line += "；动机=" + motivation
		}
		if summary := strings.TrimSpace(attempt.ReviewSummary); summary != "" {
			line += "；结论=" + summary
		}
		if len(attempt.RejectionReasons) > 0 {
			reasonParts := make([]string, 0, len(attempt.RejectionReasons))
			for _, rejection := range attempt.RejectionReasons {
				id := strings.TrimSpace(rejection.ID)
				reason := strings.TrimSpace(rejection.Reason)
				if id == "" && reason == "" {
					continue
				}
				if id == "" {
					reasonParts = append(reasonParts, reason)
					continue
				}
				if reason == "" {
					reasonParts = append(reasonParts, id)
					continue
				}
				reasonParts = append(reasonParts, id+" "+reason)
			}
			if len(reasonParts) > 0 {
				line += "；理由=" + strings.Join(reasonParts, "；")
			}
		}
		lines = append(lines, line)
	}
	lines = append(lines, "请吸取以上失败尝试的教训，基于现有上下文继续完成当前任务，避免重复同类问题。")
	return strings.Join(lines, "\n")
}

func isGovernedActionToolName(toolName string) bool {
	switch strings.TrimSpace(toolName) {
	case config.WriteDiaryToolName,
		config.ForgeDevRepoEditToolName,
		config.ForgeDevRepoBatchReplaceToolName,
		config.ForgeDevRepoBashToolName,
		config.CreateNoteDocumentToolName,
		config.AppendNoteBlocksToolName,
		config.ModifyNoteBlockToolName,
		config.RevertNoteBlockToolName,
		config.AvatarBuildToolName,
		config.AvatarModifyToolName,
		config.AvatarSynthesizeToolName,
		config.SendChannelMessageToolName:
		return true
	default:
		return false
	}
}

func buildGovernedActionToolCall(toolCall types.ToolCall) (*types.ToolCall, string, error) {
	toolName := strings.TrimSpace(toolCall.Function.Name)
	if toolName == "" {
		return nil, "", fmt.Errorf("行动工具审议缺少工具名")
	}

	args, err := decodeGovernedActionArguments(toolCall.Function.Arguments)
	if err != nil {
		return nil, "", fmt.Errorf("%s 参数解析失败: %w", toolName, err)
	}
	motivation := normalizeGovernedActionMotivation(fmt.Sprintf("%v", args["motivation"]))
	if motivation == "" {
		motivation = normalizeGovernedActionMotivation(fmt.Sprintf("%v", args["description"]))
	}
	if motivation == "" {
		return nil, "", fmt.Errorf("%s 的 motivation/description 不能为空", toolName)
	}

	normalizedArguments, err := json.Marshal(args)
	if err != nil {
		return nil, "", fmt.Errorf("%s 参数规范化失败: %w", toolName, err)
	}
	cloned := toolCall
	cloned.Function.Arguments = string(normalizedArguments)
	return &cloned, motivation, nil
}

func decodeGovernedActionArguments(raw string) (map[string]interface{}, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, fmt.Errorf("参数不能为空")
	}

	var args map[string]interface{}
	if err := json.Unmarshal([]byte(trimmed), &args); err != nil {
		return nil, err
	}
	if len(args) == 0 {
		return nil, fmt.Errorf("参数不能为空")
	}
	return args, nil
}

func normalizeGovernedActionMotivation(raw string) string {
	return strings.TrimSpace(strings.Join(strings.Fields(raw), " "))
}

func collectGovernedActionRejectionReasons(voteResult *VoteResult, initiatorSeelName string) []governedActionRejectionReason {
	if voteResult == nil {
		return nil
	}

	reasons := make([]string, 0, 2)
	appendRejectReason := func(seelName, decision, reason string) {
		if strings.EqualFold(strings.TrimSpace(seelName), strings.TrimSpace(initiatorSeelName)) {
			return
		}
		if strings.TrimSpace(decision) != voteReject {
			return
		}
		reason = strings.TrimSpace(reason)
		if reason == "" {
			reason = "内部错误：否决票缺少 reason"
		}
		reasons = append(reasons, reason)
	}

	appendRejectReason("melchior", voteResult.Melchior, voteResult.MelchiorReason)
	appendRejectReason("balthazar", voteResult.Balthazar, voteResult.BalthazarReason)
	appendRejectReason("casper", voteResult.Casper, voteResult.CasperReason)

	numbered := make([]governedActionRejectionReason, 0, len(reasons))
	for index, reason := range reasons {
		numbered = append(numbered, governedActionRejectionReason{
			ID:     fmt.Sprintf("R%d", index+1),
			Reason: reason,
		})
	}
	return numbered
}

func collectGovernedActionFailureAttempts(
	messages []types.ContextMessage,
	toolName string,
) []governedActionFailureAttempt {
	toolName = strings.TrimSpace(toolName)
	if toolName == "" || len(messages) == 0 {
		return nil
	}

	toolCallsByID := map[string]types.ToolCall{}
	attempts := make([]governedActionFailureAttempt, 0, 2)

	for _, msg := range messages {
		if msg.Role == types.RoleAssistant {
			for _, call := range msg.ToolCalls {
				if strings.TrimSpace(call.ID) == "" {
					continue
				}
				if !strings.EqualFold(strings.TrimSpace(call.Function.Name), toolName) {
					continue
				}
				toolCallsByID[strings.TrimSpace(call.ID)] = call
			}
			continue
		}

		if msg.Role != types.RoleTool || strings.TrimSpace(msg.ToolID) == "" {
			continue
		}
		call, ok := toolCallsByID[strings.TrimSpace(msg.ToolID)]
		if !ok {
			continue
		}

		attempt, ok := parseGovernedActionFailureAttempt(call, msg.Content)
		if !ok {
			continue
		}
		attempts = append(attempts, attempt)
	}

	if len(attempts) <= 2 {
		return attempts
	}
	return attempts[len(attempts)-2:]
}

func parseGovernedActionFailureAttempt(
	toolCall types.ToolCall,
	toolResult string,
) (governedActionFailureAttempt, bool) {
	var payload struct {
		State            string                          `json:"state"`
		ToolName         string                          `json:"toolName"`
		Motivation       string                          `json:"motivation"`
		ReviewSummary    string                          `json:"reviewSummary"`
		RejectionReasons []governedActionRejectionReason `json:"rejectionReasons"`
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(toolResult)), &payload); err != nil {
		return governedActionFailureAttempt{}, false
	}
	state := strings.TrimSpace(payload.State)
	if state != "rejected" && state != "dominance_revoked" {
		return governedActionFailureAttempt{}, false
	}

	toolName := strings.TrimSpace(payload.ToolName)
	if toolName == "" {
		toolName = strings.TrimSpace(toolCall.Function.Name)
	}
	motivation := strings.TrimSpace(payload.Motivation)
	if motivation == "" {
		if decodedArgs, err := decodeGovernedActionArguments(toolCall.Function.Arguments); err == nil {
			motivation = normalizeGovernedActionMotivation(fmt.Sprintf("%v", decodedArgs["motivation"]))
		}
	}

	return governedActionFailureAttempt{
		ToolName:         toolName,
		Motivation:       motivation,
		ReviewSummary:    strings.TrimSpace(payload.ReviewSummary),
		RejectionReasons: append([]governedActionRejectionReason(nil), payload.RejectionReasons...),
	}, true
}
