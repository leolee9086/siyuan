package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/observability"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
)

const (
	dominantElectionTimeout    = 120 * time.Second
	maxDominantElectionRetries = 2
	// actionPlanScoreBonus 中选行动计划提出者的隐性加分值。
	actionPlanScoreBonus = 15
)

type dominantCandidate struct {
	Key         marduk.CognitiveStanceKey
	SeelName    string
	DisplayName string
	Stance      string
	PromptLabel string
}

type dominantVoteScore struct {
	Candidate string `json:"candidate"`
	Score     int    `json:"score"`
}

type dominantVotePayload struct {
	Scores       []dominantVoteScore `json:"scores"`
	Reason       string              `json:"reason"`
	Doubts       []string            `json:"doubts"`
	SelectedPlan string              `json:"selected_plan"`
}

type DominantElectionVote struct {
	VoterSeelName        string
	VoterDisplayName     string
	Profession           int
	SocialRelation       int
	SelfName             int
	Reason               string
	Doubts               []string
	SelectedPlanProposer string
}

type DominantElectionResult struct {
	DominantSeelName    string
	DominantDisplayName string
	DominantStance      string
	AggregatedScores    map[string]int
	Votes               []DominantElectionVote
	ActionPlans         []types.ActionPlanProposal
	SelectedPlan        *types.ActionPlanProposal
}

func electDominantSage(
	ctx context.Context,
	sessionID string,
	melchior, balthazar, casper *sages.Sage,
	situation string,
) (*DominantElectionResult, error) {
	return electDominantSageWithExclusionsAndSituations(ctx, sessionID, melchior, balthazar, casper, situation, nil, nil, nil)
}

func electDominantSageWithPlans(
	ctx context.Context,
	sessionID string,
	melchior, balthazar, casper *sages.Sage,
	situation string,
	actionPlans []types.ActionPlanProposal,
) (*DominantElectionResult, error) {
	return electDominantSageWithExclusionsAndSituations(ctx, sessionID, melchior, balthazar, casper, situation, nil, nil, actionPlans)
}

func buildDominantCandidates(
	melchior, balthazar, casper *sages.Sage,
) ([]dominantCandidate, error) {
	return buildDominantCandidatesWithExclusions(melchior, balthazar, casper, nil)
}

func electDominantSageWithExclusions(
	ctx context.Context,
	sessionID string,
	melchior, balthazar, casper *sages.Sage,
	situation string,
	excludedSeels map[string]struct{},
) (*DominantElectionResult, error) {
	return electDominantSageWithExclusionsAndSituations(
		ctx,
		sessionID,
		melchior,
		balthazar,
		casper,
		situation,
		nil,
		excludedSeels,
		nil,
	)
}

func electDominantSageWithExclusionsAndSituations(
	ctx context.Context,
	sessionID string,
	melchior, balthazar, casper *sages.Sage,
	defaultSituation string,
	situationBySeel map[string]string,
	excludedSeels map[string]struct{},
	actionPlans []types.ActionPlanProposal,
) (*DominantElectionResult, error) {
	candidates, err := buildDominantCandidatesWithExclusions(melchior, balthazar, casper, excludedSeels)
	if err != nil {
		return nil, err
	}
	logging.LogInfof("MAGI 选举开始: candidates=%d voters=melchior/balthazar/casper", len(candidates))
	if len(candidates) == 0 {
		return nil, fmt.Errorf("dominant election has no available candidates")
	}
	if len(candidates) == 1 {
		winner := candidates[0]
		result := &DominantElectionResult{
			DominantSeelName:    winner.SeelName,
			DominantDisplayName: winner.DisplayName,
			DominantStance:      winner.Stance,
			AggregatedScores: map[string]int{
				string(winner.Key): 100,
			},
			ActionPlans: actionPlans,
		}
		if len(actionPlans) > 0 {
			result.SelectedPlan = &actionPlans[0]
		}
		return result, nil
	}

	voters := []*sages.Sage{melchior, balthazar, casper}
	votes := make([]DominantElectionVote, 0, len(voters))
	totals := map[string]int{}
	for _, candidate := range candidates {
		totals[string(candidate.Key)] = 0
	}

	// 收集所有贤者精力状况，注入选举上下文
	statusInfo := buildSageElectionStatusInfo(sessionID, melchior, balthazar, casper)

	for _, voter := range voters {
		if voter == nil {
			return nil, fmt.Errorf("dominant election voter is nil")
		}

		vote, voteErr := scoreDominantCandidate(
			ctx,
			sessionID,
			voter,
			resolveDominantSituationForSage(voter, defaultSituation, situationBySeel)+statusInfo,
			candidates,
			actionPlans,
		)
		if voteErr != nil {
			return nil, voteErr
		}
		votes = append(votes, *vote)
		for _, candidate := range candidates {
			totals[string(candidate.Key)] += dominantVoteScoreForCandidate(*vote, candidate.Key)
		}
	}

	// 统计行动计划评选结果
	var selectedPlan *types.ActionPlanProposal
	if len(actionPlans) > 0 {
		planVotes := map[string]int{}
		for _, plan := range actionPlans {
			planVotes[plan.ProposerSeelName] = 0
		}
		for _, vote := range votes {
			if vote.SelectedPlanProposer != "" {
				if _, ok := planVotes[vote.SelectedPlanProposer]; ok {
					planVotes[vote.SelectedPlanProposer]++
				}
			}
		}
		// 找出中选计划（票数最高者）
		winnerPlanProposer := actionPlans[0].ProposerSeelName
		winnerPlanVotes := 0
		for _, plan := range actionPlans {
			voteCount := planVotes[plan.ProposerSeelName]
			if voteCount > winnerPlanVotes {
				winnerPlanVotes = voteCount
				winnerPlanProposer = plan.ProposerSeelName
			}
		}
		for _, plan := range actionPlans {
			if plan.ProposerSeelName == winnerPlanProposer {
				selectedPlan = &plan
				break
			}
		}

		// 中选行动计划提出者获得隐性加分
		if selectedPlan != nil {
			for _, candidate := range candidates {
				if candidate.SeelName == selectedPlan.ProposerSeelName {
					totals[string(candidate.Key)] += actionPlanScoreBonus
					logging.LogInfof("行动计划中选: proposer=%s bonus=%d",
						selectedPlan.ProposerSeelName, actionPlanScoreBonus)
					observability.Detailf("中选行动计划: proposer=%s plan=%s bonus=%d",
						selectedPlan.ProposerSeelName, selectedPlan.Plan, actionPlanScoreBonus)
					break
				}
			}
		}
	}

	winner := candidates[0]
	winnerScore := totals[string(winner.Key)]
	for _, candidate := range candidates[1:] {
		score := totals[string(candidate.Key)]
		if score > winnerScore {
			winner = candidate
			winnerScore = score
		}
	}

	return &DominantElectionResult{
		DominantSeelName:    winner.SeelName,
		DominantDisplayName: winner.DisplayName,
		DominantStance:      winner.Stance,
		AggregatedScores:    totals,
		Votes:               votes,
		ActionPlans:         actionPlans,
		SelectedPlan:        selectedPlan,
	}, nil
}

func resolveDominantSituationForSage(
	voter *sages.Sage,
	defaultSituation string,
	situationBySeel map[string]string,
) string {
	if voter == nil || len(situationBySeel) == 0 {
		return defaultSituation
	}
	if situation := strings.TrimSpace(situationBySeel[strings.TrimSpace(voter.GetName())]); situation != "" {
		return situation
	}
	return defaultSituation
}

func buildDominantCandidatesWithExclusions(
	melchior, balthazar, casper *sages.Sage,
	excludedSeels map[string]struct{},
) ([]dominantCandidate, error) {
	if melchior == nil || balthazar == nil || casper == nil {
		return nil, fmt.Errorf("dominant candidates require melchior, balthazar and casper")
	}

	stances, err := marduk.ResolveCognitiveStances(melchior.GetProfile())
	if err != nil {
		return nil, fmt.Errorf("resolve cognitive stances failed: %w", err)
	}

	allCandidates := []dominantCandidate{
		{
			Key:         marduk.CognitiveStanceProfession,
			SeelName:    melchior.GetName(),
			DisplayName: melchior.GetDisplayName(),
			Stance:      stances.LabelForKey(marduk.CognitiveStanceProfession),
			PromptLabel: buildDominantPromptLabel(marduk.CognitiveStanceProfession, stances.LabelForKey(marduk.CognitiveStanceProfession)),
		},
		{
			Key:         marduk.CognitiveStancePrimarySocialRelation,
			SeelName:    balthazar.GetName(),
			DisplayName: balthazar.GetDisplayName(),
			Stance:      stances.LabelForKey(marduk.CognitiveStancePrimarySocialRelation),
			PromptLabel: buildDominantPromptLabel(marduk.CognitiveStancePrimarySocialRelation, stances.LabelForKey(marduk.CognitiveStancePrimarySocialRelation)),
		},
		{
			Key:         marduk.CognitiveStanceSelfName,
			SeelName:    casper.GetName(),
			DisplayName: casper.GetDisplayName(),
			Stance:      stances.LabelForKey(marduk.CognitiveStanceSelfName),
			PromptLabel: buildDominantPromptLabel(marduk.CognitiveStanceSelfName, stances.LabelForKey(marduk.CognitiveStanceSelfName)),
		},
	}

	if len(excludedSeels) == 0 {
		return allCandidates, nil
	}

	filtered := make([]dominantCandidate, 0, len(allCandidates))
	for _, candidate := range allCandidates {
		if _, excluded := excludedSeels[strings.TrimSpace(candidate.SeelName)]; excluded {
			continue
		}
		filtered = append(filtered, candidate)
	}
	return filtered, nil
}

func scoreDominantCandidate(
	ctx context.Context,
	sessionID string,
	voter *sages.Sage,
	situation string,
	candidates []dominantCandidate,
	actionPlans []types.ActionPlanProposal,
) (*DominantElectionVote, error) {
	if voter == nil {
		return nil, fmt.Errorf("dominant election voter is nil")
	}
	if len(candidates) < 2 || len(candidates) > 3 {
		return nil, fmt.Errorf("dominant election expects 2 or 3 candidates, got %d", len(candidates))
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, dominantElectionTimeout)
	defer cancel()
	// 注入请求来源（主导选举路径），供前缀缓存监控日志定位调用方。
	timeoutCtx = llm.WithRequestSource(timeoutCtx, llm.RequestSource{
		SageName:    voter.GetName(),
		DisplayName: voter.GetDisplayName(),
		RequestType: "dominant-election",
		SessionID:   sessionID,
	})

	userInput := buildDominantElectionUserInput(situation, candidates, actionPlans)

	messages := voter.BuildRequestMessagesForSession(
		sessionID,
		types.ContextMessage{
			Role:    types.RoleSystem,
			Content: prompts.BuildDominantElectionSystemPrompt(),
		},
		types.ContextMessage{
			Role:    types.RoleUser,
			Content: userInput,
		},
	)

	toolDef := config.BuildDominantElectionToolDef()
	tools := []openai.Tool{buildRuntimeTool(toolDef)}

	// 首次调用
	displayName := voter.GetDisplayName()
	result, err := voter.GetLLMClient().SendChatRequestSyncDetailed(timeoutCtx, messages, tools, nil)
	if err != nil {
		return nil, fmt.Errorf("[%s] dominant election request failed: %w", displayName, err)
	}

	payload, parseErr := parseDominantElectionToolCall(result, displayName, candidates)
	if parseErr == nil {
		return finalizeDominantVote(payload, candidates, displayName, voter.GetName())
	}

	// 解析失败（如 tool call 次数不对）时，将错误反馈给 LLM 要求重试
	logging.LogWarnf("[%s] dominant election initial call failed: %v, retrying...", displayName, parseErr)
	currentMessages := buildDominantElectionRetryMessages(messages, result, parseErr)

	var lastErr error
	for retry := 0; retry < maxDominantElectionRetries; retry++ {
		result, err = voter.GetLLMClient().SendChatRequestSyncDetailed(timeoutCtx, currentMessages, tools, nil)
		if err != nil {
			lastErr = fmt.Errorf("[%s] dominant election retry %d failed: %w", displayName, retry+1, err)
			logging.LogWarnf("%v", lastErr)
			continue
		}

		payload, parseErr = parseDominantElectionToolCall(result, displayName, candidates)
		if parseErr == nil {
			logging.LogInfof("[%s] dominant election retry %d succeeded after initial failure: %v", displayName, retry+1, parseErr)
			return finalizeDominantVote(payload, candidates, displayName, voter.GetName())
		}

		lastErr = parseErr
		logging.LogWarnf("[%s] dominant election retry %d failed: %v, retrying...", displayName, retry+1, parseErr)
		currentMessages = buildDominantElectionRetryMessages(currentMessages, result, parseErr)
	}

	return nil, fmt.Errorf("[%s] dominant election failed after %d retries: %w",
		displayName, maxDominantElectionRetries, lastErr)
}

func buildDominantElectionUserInput(
	situation string,
	candidates []dominantCandidate,
	actionPlans []types.ActionPlanProposal,
) string {
	labels := collectDominantPromptLabels(candidates)
	if len(actionPlans) == 0 {
		return prompts.BuildDominantElectionUserInputForCandidates(situation, labels...)
	}

	planStrings := make([]string, 0, len(actionPlans))
	for _, plan := range actionPlans {
		planStr := fmt.Sprintf("[%s] %s", plan.ProposerDisplayName, plan.Plan)
		planStrings = append(planStrings, planStr)
	}
	return prompts.BuildDominantElectionUserInputForCandidatesWithPlans(situation, labels, planStrings)
}

// buildDominantElectionRetryMessages 构建主导者选举重试消息序列。
// 追加 assistant 原始响应（含 tool_calls）→ 各 tool 调用错误反馈 → 要求修正+反思。
func buildDominantElectionRetryMessages(
	prevMessages []types.ContextMessage,
	prevResult *types.SyncChatResult,
	parseErr error,
) []types.ContextMessage {
	retryMsgs := make([]types.ContextMessage, len(prevMessages), len(prevMessages)+2+len(prevResult.ToolCalls))
	copy(retryMsgs, prevMessages)

	// 追加 assistant 消息（携带原始 tool_calls 和 reasoning_content）
	retryMsgs = append(retryMsgs, types.ContextMessage{
		Role:             types.RoleAssistant,
		Content:          prevResult.Content,
		ReasoningContent: prevResult.ReasoningContent,
		ToolCalls:        prevResult.ToolCalls,
	})

	// 对每个 tool_call 返回错误结果
	for _, tc := range prevResult.ToolCalls {
		retryMsgs = append(retryMsgs, types.ContextMessage{
			Role:    types.RoleTool,
			Content: fmt.Sprintf("错误：%s", parseErr.Error()),
			ToolID:  tc.ID,
		})
	}

	// 要求修正调用并反思
	retryMsgs = append(retryMsgs, types.ContextMessage{
		Role:    types.RoleUser,
		Content: "请重新投票，必须且只能调用一次 dominant_election。同时反思为什么之前会调用多次。",
	})

	return retryMsgs
}

// finalizeDominantVote 根据有效的投票载荷构建最终投票结果。
func finalizeDominantVote(
	payload *dominantVotePayload,
	candidates []dominantCandidate,
	displayName, voterName string,
) (*DominantElectionVote, error) {
	scoreByKey, err := validateDominantVotePayload(*payload, candidates)
	if err != nil {
		return nil, fmt.Errorf("[%s] dominant election payload invalid: %w", displayName, err)
	}

	doubts := make([]string, 0, len(payload.Doubts))
	for _, d := range payload.Doubts {
		if trimmed := strings.TrimSpace(d); trimmed != "" {
			doubts = append(doubts, trimmed)
		}
	}

	selectedPlan := strings.TrimSpace(payload.SelectedPlan)
	return &DominantElectionVote{
		VoterSeelName:        voterName,
		VoterDisplayName:     displayName,
		Profession:           scoreByKey[string(marduk.CognitiveStanceProfession)],
		SocialRelation:       scoreByKey[string(marduk.CognitiveStancePrimarySocialRelation)],
		SelfName:             scoreByKey[string(marduk.CognitiveStanceSelfName)],
		Reason:               strings.TrimSpace(payload.Reason),
		Doubts:               doubts,
		SelectedPlanProposer: selectedPlan,
	}, nil
}

func parseDominantElectionToolCall(result *types.SyncChatResult, displayName string, candidates []dominantCandidate) (*dominantVotePayload, error) {
	if result == nil {
		return nil, fmt.Errorf("[%s] dominant election result is nil", displayName)
	}
	if len(result.ToolCalls) != 1 {
		return nil, fmt.Errorf("[%s] dominant election must call %s exactly once, got %d", displayName, config.DominantElectionToolName, len(result.ToolCalls))
	}

	toolCall := result.ToolCalls[0]
	if strings.TrimSpace(toolCall.Function.Name) != config.DominantElectionToolName {
		return nil, fmt.Errorf("[%s] dominant election unexpected tool call: %s", displayName, toolCall.Function.Name)
	}

	rawArgs := strings.TrimSpace(toolCall.Function.Arguments)
	if rawArgs == "" {
		return nil, fmt.Errorf("[%s] dominant election tool call arguments are empty", displayName)
	}

	var payload dominantVotePayload
	if err := json.Unmarshal([]byte(rawArgs), &payload); err != nil {
		return nil, fmt.Errorf("[%s] dominant election parse failed: %w | raw=%s", displayName, err, rawArgs)
	}

	return &payload, nil
}

func resolveDominantSage(
	election *DominantElectionResult,
	melchior, balthazar, casper *sages.Sage,
) (*sages.Sage, error) {
	if election == nil {
		return nil, fmt.Errorf("dominant election result is nil")
	}

	switch strings.TrimSpace(election.DominantSeelName) {
	case strings.TrimSpace(melchior.GetName()):
		return melchior, nil
	case strings.TrimSpace(balthazar.GetName()):
		return balthazar, nil
	case strings.TrimSpace(casper.GetName()):
		return casper, nil
	default:
		return nil, fmt.Errorf("unknown dominant seel: %s", election.DominantSeelName)
	}
}

func buildDominantPromptLabel(key marduk.CognitiveStanceKey, stance string) string {
	switch key {
	case marduk.CognitiveStanceSelfName:
		return fmt.Sprintf("仅作为%s本人的你", strings.TrimSpace(stance))
	default:
		return fmt.Sprintf("作为%s的你", strings.TrimSpace(stance))
	}
}

func validateDominantVotePayload(
	payload dominantVotePayload,
	candidates []dominantCandidate,
) (map[string]int, error) {
	if len(payload.Scores) != len(candidates) {
		return nil, fmt.Errorf("scores length mismatch: got %d want %d", len(payload.Scores), len(candidates))
	}

	expected := make(map[string]dominantCandidate, len(candidates))
	for _, candidate := range candidates {
		expected[candidate.PromptLabel] = candidate
	}
	resolved := make(map[string]int, len(candidates))

	for _, scoreItem := range payload.Scores {
		label := strings.TrimSpace(scoreItem.Candidate)
		candidate, ok := expected[label]
		if !ok {
			return nil, fmt.Errorf("unexpected candidate label: %s", label)
		}
		if scoreItem.Score < 0 || scoreItem.Score > 100 {
			return nil, fmt.Errorf("score out of range for %s: %d", label, scoreItem.Score)
		}
		key := string(candidate.Key)
		if _, exists := resolved[key]; exists {
			return nil, fmt.Errorf("duplicate candidate label: %s", label)
		}
		resolved[key] = scoreItem.Score
	}

	for _, candidate := range candidates {
		key := string(candidate.Key)
		if _, ok := resolved[key]; !ok {
			return nil, fmt.Errorf("missing candidate label: %s", candidate.PromptLabel)
		}
	}

	return resolved, nil
}

func dominantVoteScoreForCandidate(vote DominantElectionVote, key marduk.CognitiveStanceKey) int {
	switch key {
	case marduk.CognitiveStanceProfession:
		return vote.Profession
	case marduk.CognitiveStancePrimarySocialRelation:
		return vote.SocialRelation
	case marduk.CognitiveStanceSelfName:
		return vote.SelfName
	default:
		return 0
	}
}

func collectDominantPromptLabels(candidates []dominantCandidate) []string {
	ret := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		if label := strings.TrimSpace(candidate.PromptLabel); label != "" {
			ret = append(ret, label)
		}
	}
	return ret
}

// collectActionPlans 并行收集三贤人的行动计划提案。
// 每个贤者调用 propose_action_plan 工具提交本轮行动计划。
// 需要至少2个成功响应，否则返回错误。
func collectActionPlans(
	ctx context.Context,
	sessionID string,
	melchior, balthazar, casper *sages.Sage,
	situation string,
) ([]types.ActionPlanProposal, error) {
	type planResult struct {
		plan *types.ActionPlanProposal
		err  error
	}
	resultCh := make(chan planResult, 3)

	collectSinglePlan := func(sage *sages.Sage, ch chan<- planResult) {
		if sage == nil {
			ch <- planResult{nil, fmt.Errorf("sage is nil")}
			return
		}
		timeoutCtx, cancel := context.WithTimeout(ctx, dominantElectionTimeout)
		defer cancel()
		// 注入请求来源（行动计划路径），供前缀缓存监控日志定位调用方。
		timeoutCtx = llm.WithRequestSource(timeoutCtx, llm.RequestSource{
			SageName:    sage.GetName(),
			DisplayName: sage.GetDisplayName(),
			RequestType: "action-plan",
			SessionID:   sessionID,
		})

		messages := sage.BuildRequestMessagesForSession(
			sessionID,
			types.ContextMessage{
				Role:    types.RoleSystem,
				Content: prompts.BuildActionPlanProposalSystemPrompt(),
			},
			types.ContextMessage{
				Role:    types.RoleUser,
				Content: fmt.Sprintf("当前情境：\n%s\n\n请描述你本轮的行动计划。", situation),
			},
		)

		toolDef := config.BuildProposeActionPlanToolDef()
		tools := []openai.Tool{buildRuntimeTool(toolDef)}

		result, err := sage.GetLLMClient().SendChatRequestSyncDetailed(timeoutCtx, messages, tools, nil)
		if err != nil {
			ch <- planResult{nil, fmt.Errorf("[%s] plan proposal failed: %w", sage.GetName(), err)}
			return
		}

		if len(result.ToolCalls) == 0 {
			ch <- planResult{nil, fmt.Errorf("[%s] plan proposal returned no tool calls", sage.GetName())}
			return
		}

		toolCall := result.ToolCalls[0]
		if strings.TrimSpace(toolCall.Function.Name) != config.ProposeActionPlanToolName {
			ch <- planResult{nil, fmt.Errorf("[%s] unexpected tool call: %s", sage.GetName(), toolCall.Function.Name)}
			return
		}

		var params struct {
			Plan string `json:"plan"`
		}
		if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &params); err != nil {
			ch <- planResult{nil, fmt.Errorf("[%s] plan proposal parse failed: %w", sage.GetName(), err)}
			return
		}

		plan := strings.TrimSpace(params.Plan)
		if plan == "" {
			ch <- planResult{nil, fmt.Errorf("[%s] plan proposal is empty", sage.GetName())}
			return
		}

		ch <- planResult{
			plan: &types.ActionPlanProposal{
				ProposerSeelName:    sage.GetName(),
				ProposerDisplayName: sage.GetDisplayName(),
				Plan:                plan,
			},
		}
	}

	go collectSinglePlan(melchior, resultCh)
	go collectSinglePlan(balthazar, resultCh)
	go collectSinglePlan(casper, resultCh)

	plans := make([]types.ActionPlanProposal, 0, 3)
	var errs []string
	for i := 0; i < 3; i++ {
		res := <-resultCh
		if res.err != nil {
			errs = append(errs, res.err.Error())
			continue
		}
		if res.plan != nil {
			plans = append(plans, *res.plan)
		}
	}

	if len(plans) < 2 {
		return nil, fmt.Errorf("collectActionPlans: need at least 2 plans, got %d, errors: %v", len(plans), errs)
	}

	for _, err := range errs {
		logging.LogWarnf("collectActionPlans partial error: %v", err)
	}

	logging.LogInfof("collectActionPlans: collected %d plans", len(plans))
	for _, p := range plans {
		observability.Detailf("候选行动计划: proposer=%s plan=%s", p.ProposerSeelName, p.Plan)
	}

	return plans, nil
}

// buildSageElectionStatusInfo 构建三贤人精力状况字符串，注入选举上下文。
func buildSageElectionStatusInfo(sessionID string, melchior, balthazar, casper *sages.Sage) string {
	var b strings.Builder
	b.WriteString("\n\n当前精力状况：\n")
	for _, sg := range []*sages.Sage{melchior, balthazar, casper} {
		if sg == nil {
			continue
		}
		b.WriteString(fmt.Sprintf("- %s：疲劳度=%s 唤醒值=%s\n",
			sg.GetDisplayName(),
			sages.FatigueLevel(sg.GetFatigue(sessionID)),
			sages.WakefulnessLevel(sg.GetWakefulness(sessionID)),
		))
	}
	return b.String()
}
