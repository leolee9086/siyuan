// Package coordinator 提供MAGI决策协调功能
package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
)

// VoteContext 投票上下文
type VoteContext struct {
	UserMessage         string // 用户原始输入
	MelchiorConclusion  string // Melchior关键判断
	ProposerDisplayName string
	ProposerConclusion  string
}

// VoteResult 投票结果
type VoteResult struct {
	Melchior  string // "批准" | "否决"
	Balthazar string // "批准" | "否决"
	Casper    string // "批准" | "否决"
	Passed    bool   // 是否通过（≥2/3）
	Round     int    // 当前第几轮审议
}

// voteDecision 投票决策响应
type voteDecision struct {
	Decision string `json:"decision"` // "批准" | "否决"
	Reason   string `json:"reason"`
}

const (
	voteTimeout = 30 * time.Second // D-005: 投票超时30秒
	voteApprove = prompts.VoteApprove
	voteReject  = prompts.VoteReject
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
	if err := websocket.PushVotingStart(websocket.RuntimeMonitorSessionID, roundId, proposedAction, round); err != nil {
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
	setVoteDecision(result, initiatorSeelName, voteApprove)

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

			vote := voteReject
			if decision, err := getRealVote(ctx, peer, proposedAction, voteCtx); err != nil {
				logging.LogWarnf("%s 投票失败，按否决处理: %v", peer.GetDisplayName(), err)
			} else {
				vote = decision
			}

			mu.Lock()
			setVoteDecision(result, peer.GetName(), vote)
			progress += increment
			currentProgress := progress
			mu.Unlock()

			if err := websocket.PushVotingProgress(
				websocket.RuntimeMonitorSessionID,
				roundId,
				peer.GetName(),
				peer.GetDisplayName(),
				types.VoteDecision(vote),
				currentProgress,
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
		{Name: "melchior", Decision: result.Melchior},
		{Name: "balthazar", Decision: result.Balthazar},
		{Name: "casper", Decision: result.Casper},
	}
	if err := websocket.PushVotingResult(websocket.RuntimeMonitorSessionID, roundId, details, deliberationInitiator, deliberationReason); err != nil {
		logging.LogWarnf("推送投票结果失败: %v", err)
	}

	return result, nil
}

// getRealVote 获取真实投票决策
// 对应前端获取真实投票决策函数
func getRealVote(
	ctx context.Context,
	sage *sages.Sage,
	proposedAction string,
	voteCtx VoteContext,
) (string, error) {
	// 创建超时上下文（D-005: 30秒）
	timeoutCtx, cancel := context.WithTimeout(ctx, voteTimeout)
	defer cancel()

	// 构建投票消息
	systemPrompt := buildVoteSystemPrompt(sage.GetDisplayName())
	userInput := buildVoteUserInput(proposedAction, voteCtx)

	// 构建消息列表
	messages := []types.ContextMessage{
		{Role: types.RoleSystem, Content: systemPrompt},
		{Role: types.RoleUser, Content: userInput},
	}

	// 发送同步请求
	result, err := sage.GetLLMClient().SendChatRequestSyncDetailed(
		timeoutCtx,
		messages,
		[]openai.Tool{buildRuntimeTool(config.BuildVoteToolDef())},
		buildRequiredFunctionToolChoice(config.VoteToolName),
	)
	if err != nil {
		return "", fmt.Errorf("[%s] LLM请求失败: %w", sage.GetDisplayName(), err)
	}

	// 解析决策
	decision, parseErr := parseDecision(result)
	if parseErr != nil {
		return "", fmt.Errorf("[%s] 投票决策解析失败: %w | 原始响应: %s", sage.GetDisplayName(), parseErr, describeSyncChatResult(result))
	}

	return decision, nil
}

// buildVoteSystemPrompt 创建评审系统提示词
func buildVoteSystemPrompt(displayName string) string {
	return prompts.BuildVoteSystemPrompt(displayName, config.VoteToolName)
}

// buildVoteUserInput 创建评审用户输入
func buildVoteUserInput(proposedAction string, voteCtx VoteContext) string {
	proposerDisplayName := strings.TrimSpace(voteCtx.ProposerDisplayName)
	if proposerDisplayName == "" {
		proposerDisplayName = "Melchior"
	}
	proposerConclusion := strings.TrimSpace(voteCtx.ProposerConclusion)
	if proposerConclusion == "" {
		proposerConclusion = strings.TrimSpace(voteCtx.MelchiorConclusion)
	}
	return prompts.BuildVoteUserInput(proposedAction, voteCtx.UserMessage, proposerDisplayName, proposerConclusion)
}

// parseDecision 解析二元决策
func parseDecision(result *types.SyncChatResult) (string, error) {
	if result == nil {
		return "", fmt.Errorf("投票响应为空")
	}

	if len(result.ToolCalls) != 1 {
		return "", fmt.Errorf("投票必须且只能调用一次 %s，实际=%d", config.VoteToolName, len(result.ToolCalls))
	}

	toolCall := result.ToolCalls[0]
	if strings.TrimSpace(toolCall.Function.Name) != config.VoteToolName {
		return "", fmt.Errorf("投票工具名无效: %s", toolCall.Function.Name)
	}

	rawArgs := strings.TrimSpace(toolCall.Function.Arguments)
	if rawArgs == "" {
		return "", fmt.Errorf("%s 缺少参数", config.VoteToolName)
	}

	var decision voteDecision
	if err := json.Unmarshal([]byte(rawArgs), &decision); err != nil {
		return "", fmt.Errorf("%s 参数解析失败: %w", config.VoteToolName, err)
	}

	decision.Decision = strings.TrimSpace(decision.Decision)
	decision.Reason = strings.TrimSpace(decision.Reason)
	if decision.Decision != voteApprove && decision.Decision != voteReject {
		return "", fmt.Errorf("decision字段值无效: %s (期望'批准'或'否决')", decision.Decision)
	}
	if decision.Reason == "" {
		return "", fmt.Errorf("%s 的 reason 不能为空", config.VoteToolName)
	}
	return decision.Decision, nil
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

func setVoteDecision(result *VoteResult, seelName, decision string) {
	if result == nil {
		return
	}

	switch {
	case strings.EqualFold(strings.TrimSpace(seelName), "melchior"):
		result.Melchior = decision
	case strings.EqualFold(strings.TrimSpace(seelName), "balthazar"):
		result.Balthazar = decision
	case strings.EqualFold(strings.TrimSpace(seelName), "casper"):
		result.Casper = decision
	}
}
