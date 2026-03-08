// Package coordinator 提供MAGI决策协调功能
package coordinator

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
	"github.com/siyuan-note/siyuan/kernel/util"
)

var ErrAvatarDispatchRequired = errors.New("source requires avatar dispatch and direct MAGI response is disabled")

// IsAvatarDispatchRequired 判断错误是否为“仅允许Avatar路径”的路由阻断。
func IsAvatarDispatchRequired(err error) bool {
	return errors.Is(err, ErrAvatarDispatchRequired)
}

// Coordinator MAGI决策协调器
type Coordinator struct {
	collector *ResponseCollector
	trinity   *TrinityCoordinator
	avatar    *AvatarRuntime
}

// NewCoordinator 创建决策协调器
func NewCoordinator(collectionTimeout time.Duration) *Coordinator {
	return &Coordinator{
		collector: NewResponseCollector(collectionTimeout),
		trinity:   NewTrinityCoordinator(),
		avatar:    NewAvatarRuntime(),
	}
}

// CoordinateDecision 协调完整决策流程
// 1. 收集三贤人响应
// 2. 判断是否需要审慎决策（D-001: 严格只看Melchior工具调用）
// 3. 如需投票：执行投票 → 根据结果决定是否继续
// 4. Trinity统合
// 5. 返回最终响应
func (c *Coordinator) CoordinateDecision(
	ctx context.Context,
	sessionId string,
	melchior, balthazar, casper, trinity *sages.Sage,
	userMessage string,
	sourceCtx *types.RequestSourceContext,
) (*types.Message, error) {
	// 生成roundId
	roundId := util.RandString(16)

	// 推送轮次开始
	if err := websocket.PushRoundStarted(sessionId, roundId, userMessage); err != nil {
		logging.LogWarnf("推送轮次开始失败: %v", err)
	}

	sourceAwareUserInput := c.buildSourceAwareUserInput(userMessage, sourceCtx)

	// 非绝对可信来源优先走 Avatar 路径：若无绑定则创建，有绑定则复用直答。
	if sourceCtx != nil && !sourceCtx.DirectResponseAllowed {
		msg, err := c.avatar.DispatchForSource(
			ctx,
			sessionId,
			roundId,
			userMessage,
			sourceAwareUserInput,
			sourceCtx,
			c.collector,
			melchior,
			balthazar,
			casper,
			trinity,
		)
		if err != nil {
			if pushErr := websocket.PushRoundFailed(sessionId, roundId, err.Error()); pushErr != nil {
				logging.LogWarnf("推送轮次失败事件失败: %v", pushErr)
			}
			if IsAvatarUnavailable(err) {
				return nil, err
			}
			return nil, fmt.Errorf(
				"%w: channel=%s interface_kind=%s source_session_key=%s, dispatch_error=%v",
				ErrAvatarDispatchRequired,
				sourceCtx.Channel,
				sourceCtx.InterfaceKind,
				sourceCtx.SourceSessionKey,
				err,
			)
		}
		if err := websocket.PushConsensusEmitted(sessionId, roundId, msg); err != nil {
			logging.LogWarnf("推送共识发出失败: %v", err)
		}
		return msg, nil
	}

	// 步骤1: 收集三贤人响应
	responses, err := c.collector.CollectResponses(
		ctx,
		sessionId,
		roundId,
		melchior,
		balthazar,
		casper,
		userMessage,
		sourceAwareUserInput,
	)
	if err != nil {
		// 推送轮次失败
		if pushErr := websocket.PushRoundFailed(sessionId, roundId, err.Error()); pushErr != nil {
			logging.LogWarnf("推送轮次失败事件失败: %v", pushErr)
		}
		return nil, fmt.Errorf("收集贤者响应失败: %w", err)
	}

	// 步骤2: 判断是否需要审慎决策（D-001: 只看Melchior的requiresDeliberation）
	requiresDeliberation := c.checkDeliberationRequired(responses)

	var voteResult *VoteResult

	// 步骤3: 如需投票，执行投票流程
	if requiresDeliberation {
		voteResult, err = c.executeVoting(ctx, sessionId, roundId, melchior, balthazar, casper, responses, userMessage)
		if err != nil {
			// 推送轮次失败
			if pushErr := websocket.PushRoundFailed(sessionId, roundId, err.Error()); pushErr != nil {
				logging.LogWarnf("推送轮次失败事件失败: %v", pushErr)
			}
			return nil, fmt.Errorf("投票流程失败: %w", err)
		}

		// 如果投票未通过，返回否决消息
		if !voteResult.Passed {
			msg := c.buildRejectionMessage()
			// 推送共识发出
			if err := websocket.PushConsensusEmitted(sessionId, roundId, msg); err != nil {
				logging.LogWarnf("推送共识发出失败: %v", err)
			}
			return msg, nil
		}
	}

	// 步骤4: Trinity统合
	trinityResult, err := c.trinity.HandleTrinitySummary(ctx, sessionId, roundId, trinity, responses, sourceAwareUserInput)
	if err != nil {
		// 推送轮次失败
		if pushErr := websocket.PushRoundFailed(sessionId, roundId, err.Error()); pushErr != nil {
			logging.LogWarnf("推送轮次失败事件失败: %v", pushErr)
		}
		return nil, fmt.Errorf("Trinity统合失败: %w", err)
	}

	// 步骤5: 构建最终响应
	msg := c.buildConsensusMessage(trinityResult, requiresDeliberation, voteResult, sourceCtx)

	// 推送共识发出
	if err := websocket.PushConsensusEmitted(sessionId, roundId, msg); err != nil {
		logging.LogWarnf("推送共识发出失败: %v", err)
	}

	return msg, nil
}

// checkDeliberationRequired 检查是否需要审慎决策
// D-001: 严格只看Melchior的requiresDeliberation字段
func (c *Coordinator) checkDeliberationRequired(responses []types.SageResponse) bool {
	for _, resp := range responses {
		if resp.Seel == "melchior" {
			return resp.RequiresDeliberation
		}
	}
	return false
}

// executeVoting 执行投票流程
func (c *Coordinator) executeVoting(
	ctx context.Context,
	sessionId, roundId string,
	melchior, balthazar, casper *sages.Sage,
	responses []types.SageResponse,
	userMessage string,
) (*VoteResult, error) {
	// 提取Melchior的结论作为提案
	var melchiorConclusion string
	for _, resp := range responses {
		if resp.Seel == "melchior" {
			melchiorConclusion = resp.Content
			break
		}
	}

	// 构建投票上下文
	voteCtx := VoteContext{
		UserMessage:        userMessage,
		MelchiorConclusion: melchiorConclusion,
	}

	// 执行投票
	return ProcessVoting(ctx, sessionId, roundId, balthazar, casper, melchiorConclusion, voteCtx)
}

// buildRejectionMessage 构建否决消息
func (c *Coordinator) buildRejectionMessage() *types.Message {
	return &types.Message{
		Type:      types.TypeConsensus,
		Content:   "经过审慎决策，该提案未获得通过。",
		Status:    types.StatusSuccess,
		Timestamp: time.Now().UnixMilli(),
		Meta: map[string]interface{}{
			"mode":   types.ConsensusModeCritical,
			"source": types.ConsensusSourceTrinitySynthesis,
			"vote": map[string]interface{}{
				"passed": false,
			},
		},
	}
}

// buildConsensusMessage 构建共识消息
func (c *Coordinator) buildConsensusMessage(
	trinityResult *TrinityResult,
	requiresDeliberation bool,
	voteResult *VoteResult,
	sourceCtx *types.RequestSourceContext,
) *types.Message {
	mode := types.ConsensusModeStandard
	if requiresDeliberation {
		mode = types.ConsensusModeCritical
	}

	meta := map[string]interface{}{
		"mode":   mode,
		"source": types.ConsensusSourceTrinitySynthesis,
	}

	if voteResult != nil {
		meta["vote"] = map[string]interface{}{
			"melchior":  voteResult.Melchior,
			"balthazar": voteResult.Balthazar,
			"casper":    voteResult.Casper,
			"passed":    voteResult.Passed,
		}
	}

	if sourceCtx != nil {
		meta["requestSource"] = map[string]interface{}{
			"requestId":             sourceCtx.RequestID,
			"channel":               sourceCtx.Channel,
			"principalId":           sourceCtx.PrincipalID,
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
		Type:      types.TypeConsensus,
		Content:   trinityResult.Content,
		Status:    types.StatusSuccess,
		Timestamp: time.Now().UnixMilli(),
		Meta:      meta,
	}
}

func (c *Coordinator) buildSourceAwareUserInput(userMessage string, sourceCtx *types.RequestSourceContext) string {
	if sourceCtx == nil {
		return userMessage
	}

	payload := map[string]interface{}{
		"channel":       sourceCtx.Channel,
		"source":        sourceCtx.Channel,
		"trustBase":     sourceCtx.TrustBase,
		"riskLevel":     sourceCtx.RiskLevel,
		"principal":     sourceCtx.PrincipalID,
		"interface":     sourceCtx.InterfaceID,
		"interfaceKind": sourceCtx.InterfaceKind,
	}
	return prompts.BuildSourceAwareUserInput(userMessage, payload)
}
