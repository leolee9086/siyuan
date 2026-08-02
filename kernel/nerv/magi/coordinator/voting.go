// Package coordinator 提供MAGI决策协调功能
package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"
	"sync"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// VoteContext 投票上下文
type VoteContext struct {
	UserMessage            string // 用户原始输入
	MelchiorConclusion     string // Melchior关键判断
	ProposerDisplayName    string
	ProposerConclusion     string
	GovernedActionToolCall *types.ToolCall
}

// VoteResult 投票结果
type VoteResult struct {
	Melchior        string // "批准" | "否决"
	Balthazar       string // "批准" | "否决"
	Casper          string // "批准" | "否决"
	Passed          bool   // 是否通过（≥2/3）
	Round           int    // 当前第几轮审议
	MelchiorReason  string `json:"-"`
	BalthazarReason string `json:"-"`
	CasperReason    string `json:"-"`
}

// VotingConfig 投票配置
type VotingConfig struct {
	Timeout     time.Duration
	MaxRetries  int
	BackoffBase time.Duration
}

// voteDecision 投票决策响应
type voteDecision struct {
	Decision string `json:"decision"` // "批准" | "否决"
	Reason   string `json:"reason"`
}

const (
	voteApprove               = prompts.VoteApprove
	voteReject                = prompts.VoteReject
	maxVoteInvestigationTurns = 3 // 投票前允许的最大调查工具调用次数
)

// ProcessVoting 处理投票决策
// 对应前端processVoting函数
func ProcessVoting(
	ctx context.Context,
	sessionId, roundId string,
	balthazar *sages.Sage,
	casper *sages.Sage,
	proposedAction string,
	voteCtx VoteContext,
	deliberationInitiator, deliberationReason string,
	votingCfg VotingConfig,
) (*VoteResult, error) {
	return ProcessPeerVoting(
		ctx,
		sessionId,
		roundId,
		"melchior",
		"Melchior",
		balthazar,
		casper,
		proposedAction,
		voteCtx,
		deliberationInitiator,
		deliberationReason,
		1,
		votingCfg,
	)
}

func ProcessPeerVoting(
	ctx context.Context,
	sessionId, roundId string,
	initiatorSeelName string,
	initiatorDisplayName string,
	firstPeer *sages.Sage,
	secondPeer *sages.Sage,
	proposedAction string,
	voteCtx VoteContext,
	deliberationInitiator, deliberationReason string,
	round int,
	votingCfg VotingConfig,
) (*VoteResult, error) {
	if strings.TrimSpace(initiatorSeelName) == "" {
		return nil, fmt.Errorf("投票缺少主导者名称")
	}
	if round <= 0 {
		round = 1
	}
	if strings.TrimSpace(deliberationInitiator) == "" {
		deliberationInitiator = initiatorSeelName
	}

	// 推送投票开始
	if err := websocket.PushVotingStart(
		websocket.RuntimeMonitorSessionID,
		roundId,
		proposedAction,
		round,
		initiatorSeelName,
		initiatorDisplayName,
		deliberationReason,
	); err != nil {
		logging.LogWarnf("推送投票开始失败: %v", err)
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	progress := 0
	result := &VoteResult{
		Melchior:  voteReject,
		Balthazar: voteReject,
		Casper:    voteReject,
		Round:     round,
	}
	setVoteOutcome(result, initiatorSeelName, voteApprove, "发起当前行动")

	peers := []*sages.Sage{firstPeer, secondPeer}
	activePeers := 0
	for _, peer := range peers {
		if peer != nil {
			activePeers++
		}
	}
	if activePeers == 0 {
		result.Passed = computePassed(result)
		return result, nil
	}

	progressStep := 100 / activePeers
	remainder := 100 % activePeers
	for idx, peer := range peers {
		if peer == nil {
			continue
		}
		wg.Add(1)
		increment := progressStep
		if remainder > 0 && idx < remainder {
			increment++
		}

		go func(peer *sages.Sage, increment int) {
			defer wg.Done()

			decision := voteDecision{
				Decision: voteReject,
				Reason:   "评审失败，自动否决",
			}
			if voted, err := getRealVote(ctx, sessionId, peer, proposedAction, voteCtx, votingCfg); err != nil {
				logging.LogWarnf("%s 投票失败，按否决处理: %v", peer.GetDisplayName(), err)
				decision = buildFallbackVoteDecision(err)
			} else {
				decision = voted
			}

			mu.Lock()
			setVoteOutcome(result, peer.GetName(), decision.Decision, decision.Reason)
			progress += increment
			currentProgress := progress
			mu.Unlock()

			if err := websocket.PushVotingProgress(
				websocket.RuntimeMonitorSessionID,
				roundId,
				peer.GetName(),
				peer.GetDisplayName(),
				types.VoteDecision(decision.Decision),
				decision.Reason,
				currentProgress,
				round,
			); err != nil {
				logging.LogWarnf("推送%s投票进度失败: %v", peer.GetDisplayName(), err)
			}
		}(peer, increment)
	}

	wg.Wait()

	// 计算是否通过（≥2/3）
	result.Passed = computePassed(result)

	// 推送投票结果
	details := []websocket.VoteDetail{
		{Name: "Melchior", Decision: result.Melchior, Reason: strings.TrimSpace(result.MelchiorReason)},
		{Name: "Balthazar", Decision: result.Balthazar, Reason: strings.TrimSpace(result.BalthazarReason)},
		{Name: "Casper", Decision: result.Casper, Reason: strings.TrimSpace(result.CasperReason)},
	}
	if err := websocket.PushVotingResult(
		websocket.RuntimeMonitorSessionID,
		roundId,
		details,
		result.Passed,
		proposedAction,
		round,
		deliberationInitiator,
		deliberationReason,
	); err != nil {
		logging.LogWarnf("推送投票结果失败: %v", err)
	}

	return result, nil
}

// getRealVote 获取真实投票决策
// 对应前端获取真实投票决策函数
func getRealVote(
	ctx context.Context,
	sessionId string,
	sage *sages.Sage,
	proposedAction string,
	voteCtx VoteContext,
	votingCfg VotingConfig,
) (voteDecision, error) {
	timeoutCtx, cancel := context.WithTimeout(ctx, votingCfg.Timeout)
	defer cancel()
	// 注入请求来源（投票路径），供前缀缓存监控日志定位调用方。
	timeoutCtx = llm.WithRequestSource(timeoutCtx, llm.RequestSource{
		SageName:    sage.GetName(),
		DisplayName: sage.GetDisplayName(),
		RequestType: "vote",
		SessionID:   sessionId,
	})

	messages, err := buildVoteRequestMessages(sessionId, sage, proposedAction, voteCtx)
	if err != nil {
		return voteDecision{}, err
	}

	voteTool := []openai.Tool{buildRuntimeTool(config.BuildVoteToolDef())}
	investigationTools := buildVoteInvestigationTools()
	toolExecutor := buildVoteInvestigationToolExecutor(sage.GetName())

	for turn := 0; turn <= maxVoteInvestigationTurns; turn++ {
		var tools []openai.Tool
		if turn < maxVoteInvestigationTurns {
			tools = append([]openai.Tool(nil), voteTool...)
			tools = append(tools, investigationTools...)
		} else {
			tools = voteTool
		}

		var result *types.SyncChatResult
		var llmErr error
		for attempt := 0; attempt <= votingCfg.MaxRetries; attempt++ {
			result, llmErr = sage.GetLLMClient().SendChatRequestSyncDetailed(timeoutCtx, messages, tools, nil)
			if llmErr == nil {
				break
			}
			if attempt < votingCfg.MaxRetries {
				backoff := votingCfg.BackoffBase * (1 << attempt)
				jitter := time.Duration(rand.Int63n(int64(votingCfg.BackoffBase / 2)))
				logging.LogWarnf("[%s] LLM请求失败 (尝试 %d/%d): %v, %v后重试",
					sage.GetDisplayName(), attempt+1, votingCfg.MaxRetries+1, llmErr, backoff+jitter)
				select {
				case <-time.After(backoff + jitter):
				case <-timeoutCtx.Done():
					return voteDecision{}, fmt.Errorf("[%s] LLM请求重试超时: %w", sage.GetDisplayName(), timeoutCtx.Err())
				}
			}
		}
		if llmErr != nil {
			return voteDecision{}, fmt.Errorf("[%s] LLM请求失败已达最大重试次数: %w", sage.GetDisplayName(), llmErr)
		}

		if len(result.ToolCalls) > 0 && strings.TrimSpace(result.ToolCalls[0].Function.Name) == config.VoteToolName {
			decision, parseErr := parseVoteDecision(result)
			if parseErr != nil {
				return voteDecision{}, fmt.Errorf("[%s] 投票决策解析失败: %w", sage.GetDisplayName(), parseErr)
			}
			return decision, nil
		}

		if turn >= maxVoteInvestigationTurns {
			return voteDecision{}, fmt.Errorf("[%s] 超出最大调查次数仍未投票", sage.GetDisplayName())
		}

		for _, tc := range result.ToolCalls {
			toolRes, handled, execErr := toolExecutor(tc)
			if !handled {
				continue
			}
			messages = append(messages, types.ContextMessage{
				Role:      types.RoleAssistant,
				ToolCalls: []types.ToolCall{tc},
			})
			resContent := toolRes
			if execErr != nil {
				logging.LogWarnf("[%s] 投票调查工具 [%s] 执行出错: %v", sage.GetDisplayName(), tc.Function.Name, execErr)
				resContent = fmt.Sprintf(`{"ok":false,"error":"%s"}`, execErr.Error())
			}
			messages = append(messages, types.ContextMessage{
				Role:    types.RoleTool,
				Content: resContent,
				ToolID:  tc.ID,
				Meta:    webSearchMetaFromResult(toolRes),
			})
		}
	}

	return voteDecision{}, fmt.Errorf("[%s] 投票未完成", sage.GetDisplayName())
}

func buildVoteInvestigationTools() []openai.Tool {
	tools := []openai.Tool{
		buildRuntimeTool(config.BuildNoteKeywordSearchToolDef()),
		buildRuntimeTool(config.BuildNoteByIDReadToolDef()),
		buildRuntimeTool(config.BuildRecallCrossSessionMemoriesToolDef()),
		buildRuntimeTool(config.BuildSearchWebToolDef()),
		buildRuntimeTool(config.BuildFetchWebPageToolDef()),
		buildRuntimeTool(config.BuildInspectWebSearchEnginesToolDef()),
		buildRuntimeTool(config.BuildListMagiChannelsToolDef()),
		buildRuntimeTool(config.BuildListMagiContactsToolDef()),
	}
	if util.IsForgeMode() {
		tools = append(tools,
			buildRuntimeTool(config.BuildForgeDevRepoListToolDef()),
			buildRuntimeTool(config.BuildForgeDevRepoReadToolDef()),
			buildRuntimeTool(config.BuildForgeDevRepoSearchToolDef()),
		)
	}
	return tools
}

func buildVoteInvestigationToolExecutor(sageName string) ToolCallResultExecutor {
	var executors []ToolCallResultExecutor
	executors = append(executors, newNoteKeywordToolResultExecutor().ExecuteToolCall)
	executors = append(executors, newNoteByIDReadToolResultExecutor().ExecuteToolCall)
	executors = append(executors, newCrossSessionMemoryToolExecutor(sageName).ExecuteToolCall)
	webFetchExecutor := newWebFetchToolResultExecutor()
	executors = append(executors, webFetchExecutor.ExecuteToolCall)
	webSearchExecutor := newWebSearchToolResultExecutor()
	executors = append(executors, webSearchExecutor.ExecuteToolCall)
	executors = append(executors, newListMagiChannelsResultExecutor().ExecuteToolCall)
	executors = append(executors, newListMagiContactsResultExecutor().ExecuteToolCall)
	if util.IsForgeMode() {
		forgeExecutor := newForgeDevRepoToolResultExecutor()
		executors = append(executors, forgeExecutor.ExecuteToolCall)
	}
	return func(toolCall types.ToolCall) (string, bool, error) {
		for _, e := range executors {
			result, handled, err := e(toolCall)
			if handled {
				return result, true, err
			}
		}
		return "", false, nil
	}
}

// buildVoteSystemPrompt 创建评审系统提示词
func buildVoteSystemPrompt(displayName string) string {
	return prompts.BuildVoteSystemPrompt(displayName, config.VoteToolName, maxVoteInvestigationTurns)
}

func buildVoteRequestMessages(
	sessionId string,
	sage *sages.Sage,
	proposedAction string,
	voteCtx VoteContext,
) ([]types.ContextMessage, error) {
	if sage == nil {
		return nil, fmt.Errorf("投票缺少贤者实例")
	}
	displayName := strings.TrimSpace(sage.GetDisplayName())
	if displayName == "" {
		return nil, fmt.Errorf("投票缺少贤者显示名")
	}
	systemPrompt := buildVoteSystemPrompt(displayName)
	if strings.TrimSpace(systemPrompt) == "" {
		return nil, fmt.Errorf("投票系统提示词为空")
	}

	if voteCtx.GovernedActionToolCall != nil {
		return buildGovernedActionVoteRequestMessages(sessionId, sage, systemPrompt, voteCtx)
	}

	userInput, err := buildVoteUserInput(proposedAction, voteCtx)
	if err != nil {
		return nil, err
	}

	return []types.ContextMessage{
		{Role: types.RoleSystem, Content: systemPrompt},
		{Role: types.RoleUser, Content: userInput},
	}, nil
}

func buildGovernedActionVoteRequestMessages(
	sessionId string,
	sage *sages.Sage,
	systemPrompt string,
	voteCtx VoteContext,
) ([]types.ContextMessage, error) {
	if strings.TrimSpace(sessionId) == "" {
		return nil, fmt.Errorf("行动审核投票缺少 sessionId")
	}
	if sage == nil {
		return nil, fmt.Errorf("行动审核投票缺少贤者实例")
	}
	if voteCtx.GovernedActionToolCall == nil {
		return nil, fmt.Errorf("行动审核投票缺少待审核 tool call")
	}

	pendingCall := *voteCtx.GovernedActionToolCall
	if strings.TrimSpace(pendingCall.Function.Name) == "" {
		return nil, fmt.Errorf("行动审核投票缺少工具名")
	}
	if strings.TrimSpace(pendingCall.Function.Arguments) == "" {
		return nil, fmt.Errorf("行动审核投票缺少工具参数")
	}
	reviewInput, err := buildGovernedActionReviewInput(pendingCall, voteCtx)
	if err != nil {
		return nil, err
	}

	return sage.BuildRequestMessagesForSession(
		sessionId,
		types.ContextMessage{Role: types.RoleUser, Content: systemPrompt},
		types.ContextMessage{
			Role:    types.RoleUser,
			Content: reviewInput,
		},
	), nil
}

func buildGovernedActionReviewInput(toolCall types.ToolCall, voteCtx VoteContext) (string, error) {
	if strings.TrimSpace(toolCall.Function.Name) == "" {
		return "", fmt.Errorf("行动审核请求缺少工具名")
	}
	if strings.TrimSpace(toolCall.Function.Arguments) == "" {
		return "", fmt.Errorf("行动审核请求缺少工具参数")
	}

	arguments, err := decodeGovernedActionArguments(toolCall.Function.Arguments)
	if err != nil {
		return "", fmt.Errorf("行动审核请求参数解析失败: %w", err)
	}
	if normalizeGovernedActionMotivation(fmt.Sprintf("%v", arguments["motivation"])) == "" {
		return "", fmt.Errorf("行动审核请求缺少 motivation")
	}

	payload := map[string]interface{}{
		"type":               "pending_action_review",
		"originalMessage":    strings.TrimSpace(voteCtx.UserMessage),
		"proposerConclusion": strings.TrimSpace(voteCtx.ProposerConclusion),
		"toolCall": map[string]interface{}{
			"id":   strings.TrimSpace(toolCall.ID),
			"type": strings.TrimSpace(toolCall.Type),
			"function": map[string]interface{}{
				"name":      strings.TrimSpace(toolCall.Function.Name),
				"arguments": arguments,
			},
		},
		"instruction": "请结合原始消息(originalMessage)和你之前的分析(proposerConclusion)，对行动计划(toolCall)进行审慎判断。",
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("行动审核请求序列化失败: %w", err)
	}
	return string(data), nil
}

// buildVoteUserInput 创建评审用户输入
func buildVoteUserInput(proposedAction string, voteCtx VoteContext) (string, error) {
	proposedAction = strings.TrimSpace(proposedAction)
	if proposedAction == "" {
		return "", fmt.Errorf("投票缺少提案内容")
	}
	userMessage := strings.TrimSpace(voteCtx.UserMessage)
	if userMessage == "" {
		return "", fmt.Errorf("投票缺少用户原始输入")
	}
	proposerDisplayName := strings.TrimSpace(voteCtx.ProposerDisplayName)
	if proposerDisplayName == "" {
		return "", fmt.Errorf("投票缺少提案者显示名")
	}
	proposerConclusion := strings.TrimSpace(voteCtx.ProposerConclusion)
	if proposerConclusion == "" {
		proposerConclusion = strings.TrimSpace(voteCtx.MelchiorConclusion)
	}
	if proposerConclusion == "" {
		return "", fmt.Errorf("投票缺少提案者判断")
	}
	return prompts.BuildVoteUserInput(proposedAction, userMessage, proposerDisplayName, proposerConclusion), nil
}

// parseDecision 解析二元决策。
func parseDecision(result *types.SyncChatResult) (string, error) {
	decision, err := parseVoteDecision(result)
	if err != nil {
		return "", err
	}
	return decision.Decision, nil
}

func parseVoteDecision(result *types.SyncChatResult) (voteDecision, error) {
	if result == nil {
		return voteDecision{}, fmt.Errorf("投票响应为空")
	}

	if len(result.ToolCalls) != 1 {
		return voteDecision{}, fmt.Errorf("投票必须且只能调用一次 %s，实际=%d", config.VoteToolName, len(result.ToolCalls))
	}

	toolCall := result.ToolCalls[0]
	if strings.TrimSpace(toolCall.Function.Name) != config.VoteToolName {
		return voteDecision{}, fmt.Errorf("投票工具名无效: %s", toolCall.Function.Name)
	}

	rawArgs := strings.TrimSpace(toolCall.Function.Arguments)
	if rawArgs == "" {
		return voteDecision{}, fmt.Errorf("%s 缺少参数", config.VoteToolName)
	}

	var decision voteDecision
	if err := json.Unmarshal([]byte(rawArgs), &decision); err != nil {
		return voteDecision{}, fmt.Errorf("%s 参数解析失败: %w", config.VoteToolName, err)
	}

	decision.Decision = strings.TrimSpace(decision.Decision)
	decision.Reason = strings.TrimSpace(decision.Reason)
	if decision.Decision != voteApprove && decision.Decision != voteReject {
		return voteDecision{}, fmt.Errorf("decision字段值无效: %s (期望'批准'或'否决')", decision.Decision)
	}
	if decision.Reason == "" {
		return voteDecision{}, fmt.Errorf("%s 的 reason 不能为空", config.VoteToolName)
	}
	return decision, nil
}

func describeSyncChatResult(result *types.SyncChatResult) string {
	if result == nil {
		return "<nil>"
	}
	data, err := json.Marshal(result)
	if err != nil {
		return fmt.Sprintf("{content=%q toolCalls=%d}", result.Content, len(result.ToolCalls))
	}
	return string(data)
}

// computePassed 计算是否通过（≥2/3）
func computePassed(result *VoteResult) bool {
	approveCount := 0
	if result.Melchior == voteApprove {
		approveCount++
	}
	if result.Balthazar == voteApprove {
		approveCount++
	}
	if result.Casper == voteApprove {
		approveCount++
	}
	return approveCount >= 2
}

func setVoteOutcome(result *VoteResult, seelName, decision, reason string) {
	if result == nil {
		return
	}

	switch {
	case strings.EqualFold(strings.TrimSpace(seelName), "melchior"):
		result.Melchior = decision
		result.MelchiorReason = strings.TrimSpace(reason)
	case strings.EqualFold(strings.TrimSpace(seelName), "balthazar"):
		result.Balthazar = decision
		result.BalthazarReason = strings.TrimSpace(reason)
	case strings.EqualFold(strings.TrimSpace(seelName), "casper"):
		result.Casper = decision
		result.CasperReason = strings.TrimSpace(reason)
	}
}

func buildFallbackVoteDecision(err error) voteDecision {
	reason := ""
	if err != nil {
		reason = strings.TrimSpace(err.Error())
		if strings.Contains(strings.ToLower(reason), "deadline") || strings.Contains(reason, context.DeadlineExceeded.Error()) {
			reason = "评审超时"
		}
	}
	if reason == "" {
		reason = "评审失败"
	}
	return voteDecision{
		Decision: voteReject,
		Reason:   reason,
	}
}
