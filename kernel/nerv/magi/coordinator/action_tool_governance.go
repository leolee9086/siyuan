package coordinator

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

type governedActionVoteOutcome struct {
	VoteResult     *VoteResult
	ApprovalRound  int
	Rejected       bool
	LostDominance  bool
	RejectionCount int
}

type dominantActionRevokedError struct {
	DominantSeelName string
	ToolName         string
	Reason           string
}

func (e *dominantActionRevokedError) Error() string {
	if e == nil {
		return "主导权已撤销"
	}
	parts := []string{"主导者在行动工具审议中失去当前轮次主导权"}
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
	mu     sync.RWMutex
	rounds map[string]*actionToolGovernanceState
}

type actionToolGovernanceState struct {
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

func (r *actionToolGovernanceRegistry) EvaluateDiaryEntryVote(
	ctx context.Context,
	sessionID, roundID string,
	sage *sages.Sage,
	assistantContent string,
	args *types.WriteDiaryTool,
) (*governedActionVoteOutcome, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	state, ok := r.rounds[actionToolGovernanceKey(sessionID, roundID)]
	if !ok || state == nil {
		return nil, false, nil
	}
	outcome, err := state.evaluateDiaryEntryVoteLocked(ctx, sage, assistantContent, args)
	if err != nil {
		return nil, true, err
	}
	return outcome, true, nil
}

func (s *actionToolGovernanceState) evaluateDiaryEntryVoteLocked(
	ctx context.Context,
	sage *sages.Sage,
	assistantContent string,
	args *types.WriteDiaryTool,
) (*governedActionVoteOutcome, error) {
	if sage == nil {
		return nil, fmt.Errorf("行动工具审议缺少主导者信息")
	}
	if args == nil {
		return nil, fmt.Errorf("行动工具审议缺少日记参数")
	}

	sageName := strings.TrimSpace(sage.GetName())
	if sageName == "" {
		return nil, fmt.Errorf("行动工具审议缺少主导者名称")
	}
	if !strings.EqualFold(s.currentDominantSeel, sageName) {
		return nil, fmt.Errorf("只有当前主导者可以调用 %s", config.WriteDiaryToolName)
	}

	peers := s.peerReviewersLocked(sageName)
	if len(peers) != 2 {
		return nil, fmt.Errorf("%s 的行动工具审议要求两位辅助贤者，当前=%d", config.WriteDiaryToolName, len(peers))
	}

	approvalRound := s.rejectionCount + 1
	voteCtx := VoteContext{
		UserMessage:         strings.TrimSpace(s.userMessage),
		ProposerDisplayName: strings.TrimSpace(sage.GetDisplayName()),
		ProposerConclusion:  strings.TrimSpace(assistantContent),
	}

	voteResult, err := ProcessPeerVoting(
		ctx,
		s.sessionID,
		s.roundID,
		sageName,
		strings.TrimSpace(sage.GetDisplayName()),
		peers[0],
		peers[1],
		buildDiaryGovernedActionProposal(args),
		voteCtx,
		sageName,
		fmt.Sprintf("主导者申请执行 %s", config.WriteDiaryToolName),
		approvalRound,
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

func buildDiaryGovernedActionProposal(args *types.WriteDiaryTool) string {
	if args == nil {
		return "申请向 AI 主笔记本当日日记写入一则 callout 条目。"
	}

	calloutType := normalizeDiaryCalloutType(args.CalloutType)
	title := normalizeDiaryTitle(args.Title)
	body := strings.TrimSpace(normalizeDiaryMarkdown(args.Markdown))
	if body == "" {
		body = "(空内容)"
	}

	lines := strings.Split(body, "\n")
	if len(lines) > 6 {
		lines = lines[:6]
	}
	body = strings.TrimSpace(strings.Join(lines, "\n"))
	body = strings.Join(strings.Fields(body), " ")
	body = truncateGovernedActionText(body, 160)

	proposal := "申请执行行动工具 write_diary_entry，向 AI 主笔记本当日日记追加一则原生 callout 日记条目。"
	proposal += " calloutType=" + calloutType + "。"
	if title != "" {
		proposal += " title=" + title + "。"
	}
	proposal += " markdown 摘要：" + body
	return proposal
}

func truncateGovernedActionText(text string, limit int) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return ""
	}
	if limit <= 0 {
		return text
	}
	runes := []rune(text)
	if len(runes) <= limit {
		return text
	}
	return string(runes[:limit]) + "..."
}

func buildGovernedActionRetryPrompt(toolName string) string {
	toolName = strings.TrimSpace(toolName)
	if toolName == "" {
		toolName = "当前行动工具"
	}
	return fmt.Sprintf(
		"%s 本轮未获通过。你可以调整方案后再次调用，或放弃该工具并直接完成当前回复；若再次被否决，将失去当前轮次主导权。",
		toolName,
	)
}

func buildDominanceRevokedHandoffPrompt(previousDominantSeel, toolName string) string {
	previousDominantSeel = strings.TrimSpace(previousDominantSeel)
	toolName = strings.TrimSpace(toolName)
	if toolName == "" {
		toolName = "行动工具"
	}
	if previousDominantSeel == "" {
		return fmt.Sprintf("上一位主导者在 %s 审议中连续两次未获通过，当前轮次已重新选举主导者。请基于现有上下文继续完成当前任务。", toolName)
	}
	return fmt.Sprintf("%s 在 %s 审议中连续两次未获通过，当前轮次已撤销其主导资格。请基于现有上下文继续完成当前任务。", previousDominantSeel, toolName)
}
