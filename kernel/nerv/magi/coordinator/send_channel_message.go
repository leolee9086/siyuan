package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel/trust"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

type sendChannelMessageArgs struct {
	ChannelID  string `json:"channelId"`
	AccountID  string `json:"accountId"`
	UserID     string `json:"userId"`
	Content    string `json:"content"`
	Motivation string `json:"motivation,omitempty"`
}

type sendChannelMessageResultExecutor struct{}

func newSendChannelMessageResultExecutor() *sendChannelMessageResultExecutor {
	return &sendChannelMessageResultExecutor{}
}

func (e *sendChannelMessageResultExecutor) ExecuteToolCall(toolCall types.ToolCall) (result string, handled bool, err error) {
	if strings.TrimSpace(toolCall.Function.Name) != config.SendChannelMessageToolName {
		return "", false, nil
	}

	args, err := parseSendChannelMessageArgs(toolCall.Function.Arguments)
	if err != nil {
		return marshalSendChannelMessageError(err), true, nil
	}

	if args.Motivation == "" {
		return marshalSendChannelMessageError(fmt.Errorf("%s 的 motivation 不能为空", config.SendChannelMessageToolName)), true, nil
	}
	if strings.TrimSpace(args.Content) == "" {
		return marshalSendChannelMessageError(fmt.Errorf("%s 的 content 不能为空", config.SendChannelMessageToolName)), true, nil
	}
	if strings.TrimSpace(args.ChannelID) == "" {
		return marshalSendChannelMessageError(fmt.Errorf("%s 的 channelId 不能为空", config.SendChannelMessageToolName)), true, nil
	}
	if strings.TrimSpace(args.AccountID) == "" {
		return marshalSendChannelMessageError(fmt.Errorf("%s 的 accountId 不能为空", config.SendChannelMessageToolName)), true, nil
	}
	if strings.TrimSpace(args.UserID) == "" {
		return marshalSendChannelMessageError(fmt.Errorf("%s 的 userId 不能为空", config.SendChannelMessageToolName)), true, nil
	}

	payload := map[string]interface{}{
		"ok":         true,
		"state":      "pending_send",
		"channelId":  args.ChannelID,
		"accountId":  args.AccountID,
		"userId":     args.UserID,
		"motivation": args.Motivation,
	}
	resultBytes, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return marshalSendChannelMessageError(marshalErr), true, nil
	}
	return string(resultBytes), true, nil
}

func parseSendChannelMessageArgs(rawArgs string) (*sendChannelMessageArgs, error) {
	rawArgs = strings.TrimSpace(rawArgs)
	if rawArgs == "" {
		return nil, fmt.Errorf("%s 参数不能为空", config.SendChannelMessageToolName)
	}

	var args sendChannelMessageArgs
	if err := json.Unmarshal([]byte(rawArgs), &args); err != nil {
		return nil, fmt.Errorf("%s 参数解析失败: %w", config.SendChannelMessageToolName, err)
	}

	args.ChannelID = strings.TrimSpace(args.ChannelID)
	args.AccountID = strings.TrimSpace(args.AccountID)
	args.UserID = strings.TrimSpace(args.UserID)
	args.Content = strings.TrimSpace(args.Content)
	args.Motivation = normalizeGovernedActionMotivation(args.Motivation)

	return &args, nil
}

func materializeSendChannelMessageResult(
	ctx context.Context,
	sessionID, roundID string,
	sage *sages.Sage,
	assistantContent string,
	toolCall types.ToolCall,
	detailedResult string,
) string {
	payload := map[string]interface{}{}
	if trimmed := strings.TrimSpace(detailedResult); trimmed != "" {
		_ = json.Unmarshal([]byte(trimmed), &payload)
	}
	if len(payload) == 0 {
		payload["ok"] = true
		payload["state"] = "pending_governance"
	}

	outcome, governed, voteErr := dominantActionToolGovernance.EvaluateActionVote(
		ctx, sessionID, roundID, sage, assistantContent, toolCall,
	)
	if voteErr != nil {
		return marshalSendChannelMessageError(voteErr)
	}
	if governed && outcome != nil && outcome.Rejected {
		return marshalGovernedActionToolRejectionForChannel(toolCall.Function.Name, payload, outcome)
	}

	args, err := parseSendChannelMessageArgs(toolCall.Function.Arguments)
	if err != nil {
		return marshalSendChannelMessageError(err)
	}

	if err := executeSendChannelMessage(ctx, args); err != nil {
		return marshalSendChannelMessageError(err)
	}

	nickname := resolveChannelUserNickname(extractChannelType(args.ChannelID), args.AccountID, args.UserID)
	resultPayload := map[string]interface{}{
		"ok":         true,
		"state":      "sent",
		"channelId":  args.ChannelID,
		"accountId":  args.AccountID,
		"userId":     args.UserID,
		"nickname":   nickname,
		"motivation": args.Motivation,
	}
	resultBytes, marshalErr := json.Marshal(resultPayload)
	if marshalErr != nil {
		return marshalSendChannelMessageError(marshalErr)
	}
	return string(resultBytes)
}

func executeSendChannelMessage(ctx context.Context, args *sendChannelMessageArgs) error {
	if args == nil {
		return fmt.Errorf("send_channel_message args is nil")
	}

	adapter, ok := channel.Get(args.ChannelID)
	if !ok {
		return fmt.Errorf("channel adapter not found: %s", args.ChannelID)
	}

	if !adapter.Capabilities().Has(channel.CapProactiveSend) {
		return fmt.Errorf("channel %s does not support proactive send", args.ChannelID)
	}

	msg := &channel.OutboundMessage{
		ChannelID:   args.ChannelID,
		ChannelType: extractChannelType(args.ChannelID),
		AccountID:   args.AccountID,
		UserID:      args.UserID,
		Text:        args.Content,
	}

	err := adapter.SendMessage(ctx, msg)
	if err != nil {
		return err
	}
	ms := channel.GlobalMessageStore()
	if ms == nil {
		logging.LogErrorf("消息存储未初始化，出站消息记录丢失: channel=%s user=%s", msg.ChannelID, msg.UserID)
	} else if err := ms.SaveOutbound(ctx, msg); err != nil {
		logging.LogErrorf("出站消息落盘失败: %v", err)
	}
	return nil
}

func resolveChannelUserNickname(channelID, accountID, userID string) string {
	resolver := trust.DefaultIdentityResolver
	if resolver == nil {
		return ""
	}
	result := resolver(channelID, accountID, userID)
	return strings.TrimSpace(result.Nickname)
}

func marshalSendChannelMessageError(err error) string {
	payload := map[string]interface{}{
		"ok":    false,
		"state": "send_failed",
	}
	if err != nil {
		payload["error"] = err.Error()
	}
	resultBytes, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return `{"ok":false,"state":"send_failed"}`
	}
	return string(resultBytes)
}

func marshalGovernedActionToolRejectionForChannel(
	toolName string,
	payload map[string]interface{},
	outcome *governedActionVoteOutcome,
) string {
	if payload == nil {
		payload = map[string]interface{}{}
	}
	payload["ok"] = false
	payload["toolName"] = strings.TrimSpace(toolName)
	payload["reviewSummary"] = "该发送请求已被专家团队否决。"
	if outcome != nil && len(outcome.RejectionReasons) > 0 {
		payload["rejectionReasons"] = outcome.RejectionReasons
	}
	if outcome != nil && outcome.LostDominance {
		payload["state"] = "dominance_revoked"
		payload["remainingAttempts"] = 0
		payload["instruction"] = "连续两次未获批准，当前轮次将改由其他处理路径继续。"
	} else {
		payload["state"] = "rejected"
		payload["remainingAttempts"] = 1
		payload["instruction"] = buildGovernedActionRetryPrompt(config.SendChannelMessageToolName)
	}

	resultBytes, err := json.Marshal(payload)
	if err != nil {
		if outcome != nil && outcome.LostDominance {
			return `{"ok":false,"state":"dominance_revoked"}`
		}
		return `{"ok":false,"state":"rejected"}`
	}
	return string(resultBytes)
}

func firstNonEmptyStr(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

// extractChannelType 从适配器全量实例 ID 中提取渠道类型（第一个 "-" 之前的部分）。
func extractChannelType(instanceID string) string {
	if idx := strings.Index(instanceID, "-"); idx > 0 {
		return instanceID[:idx]
	}
	return instanceID
}
