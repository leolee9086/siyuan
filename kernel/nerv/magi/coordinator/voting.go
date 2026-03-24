// Package coordinator 提供MAGI决策协调功能
package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
)

// VoteContext 投票上下文
type VoteContext struct {
	UserMessage        string // 用户原始输入
	MelchiorConclusion string // Melchior关键判断
}

// VoteResult 投票结果
type VoteResult struct {
	Melchior  string // "批准" | "否决"
	Balthazar string // "批准" | "否决"
	Casper    string // "批准" | "否决"
	Passed    bool   // 是否通过（≥2/3）
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
	// 推送投票开始
	if err := websocket.PushVotingStart(websocket.RuntimeMonitorSessionID, roundId, proposedAction, 1); err != nil {
		logging.LogWarnf("推送投票开始失败: %v", err)
	}

	// 并行调用Balthazar和Casper
	var wg sync.WaitGroup
	var balthazarVote, casperVote string
	var balthazarErr, casperErr error
	var mu sync.Mutex
	progress := 0

	wg.Add(2)

	// Balthazar投票
	go func() {
		defer wg.Done()
		balthazarVote, balthazarErr = getRealVote(ctx, balthazar, proposedAction, voteCtx)

		mu.Lock()
		progress += 50
		mu.Unlock()

		// 推送投票进度
		if balthazarErr == nil {
			decision := types.VoteDecision(balthazarVote)
			if err := websocket.PushVotingProgress(websocket.RuntimeMonitorSessionID, roundId, balthazar.GetName(), balthazar.GetDisplayName(), decision, progress); err != nil {
				logging.LogWarnf("推送Balthazar投票进度失败: %v", err)
			}
		}
	}()

	// Casper投票
	go func() {
		defer wg.Done()
		casperVote, casperErr = getRealVote(ctx, casper, proposedAction, voteCtx)

		mu.Lock()
		progress += 50
		mu.Unlock()

		// 推送投票进度
		if casperErr == nil {
			decision := types.VoteDecision(casperVote)
			if err := websocket.PushVotingProgress(websocket.RuntimeMonitorSessionID, roundId, casper.GetName(), casper.GetDisplayName(), decision, progress); err != nil {
				logging.LogWarnf("推送Casper投票进度失败: %v", err)
			}
		}
	}()

	wg.Wait()

	// 检查投票错误
	if balthazarErr != nil && casperErr != nil {
		return nil, fmt.Errorf("投票失败: Balthazar错误=%v, Casper错误=%v", balthazarErr, casperErr)
	}
	if balthazarErr != nil {
		return nil, fmt.Errorf("Balthazar投票失败: %w", balthazarErr)
	}
	if casperErr != nil {
		return nil, fmt.Errorf("Casper投票失败: %w", casperErr)
	}

	// 构建投票结果
	result := &VoteResult{
		Melchior:  voteApprove, // Melchior默认批准
		Balthazar: balthazarVote,
		Casper:    casperVote,
	}

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
	content, err := sage.GetLLMClient().SendChatRequestSync(timeoutCtx, messages, nil, nil)
	if err != nil {
		return "", fmt.Errorf("[%s] LLM请求失败: %w", sage.GetDisplayName(), err)
	}

	// 解析决策
	decision, parseErr := parseDecision(content)
	if parseErr != nil {
		return "", fmt.Errorf("[%s] 投票决策解析失败: %w | 原始内容: %s", sage.GetDisplayName(), parseErr, content)
	}

	return decision, nil
}

// buildVoteSystemPrompt 创建评审系统提示词
func buildVoteSystemPrompt(displayName string) string {
	return prompts.BuildVoteSystemPrompt(displayName)
}

// buildVoteUserInput 创建评审用户输入
func buildVoteUserInput(proposedAction string, voteCtx VoteContext) string {
	return prompts.BuildVoteUserInput(proposedAction, voteCtx.UserMessage, voteCtx.MelchiorConclusion)
}

// parseDecision 解析二元决策
func parseDecision(content string) (string, error) {
	// 尝试JSON解析
	var decision voteDecision
	if err := json.Unmarshal([]byte(content), &decision); err != nil {
		return "", fmt.Errorf("JSON解析失败: %w | 原始内容: %s", err, content)
	}

	// 验证decision字段值
	if decision.Decision != voteApprove && decision.Decision != voteReject {
		return "", fmt.Errorf("decision字段值无效: %s (期望'批准'或'否决') | 原始内容: %s", decision.Decision, content)
	}

	return decision.Decision, nil
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
