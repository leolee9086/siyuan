// Package coordinator 提供MAGI决策协调功能
package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/stream"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
	utilstream "github.com/siyuan-note/siyuan/kernel/util/stream"
)

// TrinityResult Trinity统合结果
type TrinityResult struct {
	Content              string
	InternalToolMessages []string
	Success              bool
}

// TrinityCoordinator Trinity统合协调器
type TrinityCoordinator struct {
	maxRetries     int
	initialBackoff time.Duration
}

// NewTrinityCoordinator 创建Trinity统合协调器
func NewTrinityCoordinator() *TrinityCoordinator {
	return &TrinityCoordinator{
		maxRetries:     10,
		initialBackoff: 1 * time.Second,
	}
}

// HandleTrinitySummary 处理Trinity统合
// 对应前端handleTrinitySummary函数
func (tc *TrinityCoordinator) HandleTrinitySummary(
	ctx context.Context,
	sessionId, roundId string,
	trinity *sages.Sage,
	validResponses []types.SageResponse,
	userMessage string,
) (*TrinityResult, error) {
	if len(validResponses) == 0 {
		return &TrinityResult{Success: false}, nil
	}

	// 构建内省输入
	introspection := tc.buildIntrospectionInput(validResponses)

	// 确保system prompt在上下文中（修复问题4：防止system prompt被绕过）
	tc.ensureSystemPrompt(sessionId, trinity)

	// 保存初始上下文快照（用于重试恢复）
	initialContext := trinity.GetContextForSession(sessionId)

	// 指数退避重试调用Trinity
	var lastErr error
	backoff := tc.initialBackoff

	for attempt := 1; attempt <= tc.maxRetries; attempt++ {
		// 每次尝试前恢复初始上下文并重新注入内省输入
		if attempt > 1 {
			tc.restoreContext(sessionId, trinity, initialContext)
		}
		tc.injectIntrospection(sessionId, trinity, introspection, userMessage)

		result, err := tc.callTrinity(ctx, sessionId, roundId, trinity, userMessage, attempt)
		if err == nil && result.Success {
			// 推送Trinity统合完成
			if pushErr := websocket.PushTrinitySynthesisCompleted(sessionId, roundId, result.Content); pushErr != nil {
				logging.LogWarnf("推送Trinity统合完成失败: %v", pushErr)
			}
			return result, nil
		}

		lastErr = err
		if attempt < tc.maxRetries {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
				backoff *= 2
			}
		}
	}

	return nil, fmt.Errorf("Trinity统合失败，已重试%d次: %w", tc.maxRetries, lastErr)
}

// buildIntrospectionInput 构建内省输入
// 使用固定模板（D-007）
func (tc *TrinityCoordinator) buildIntrospectionInput(responses []types.SageResponse) string {
	melchior := tc.findSageContent(responses, "melchior")
	balthazar := tc.findSageContent(responses, "balthazar")
	casper := tc.findSageContent(responses, "casper")

	return prompts.BuildTrinityIntrospectionInput(melchior, balthazar, casper)
}

// findSageContent 按贤者名称查找响应内容，未找到时返回空字符串
func (tc *TrinityCoordinator) findSageContent(responses []types.SageResponse, name string) string {
	for _, resp := range responses {
		if resp.Seel == name {
			return resp.Content
		}
	}
	return ""
}

// ensureSystemPrompt 确保system prompt在上下文中
// 修复问题4：防止在注入上下文后system prompt被绕过
func (tc *TrinityCoordinator) ensureSystemPrompt(sessionId string, trinity *sages.Sage) {
	messages := trinity.GetContextForSession(sessionId)
	// 如果上下文为空或第一条消息不是system，则需要添加system prompt
	if len(messages) == 0 || messages[0].Role != types.RoleSystem {
		// 获取system prompt并添加到上下文开头
		systemPrompt := trinity.GetSystemPrompt()
		if systemPrompt != "" {
			systemMsg := types.ContextMessage{
				Role:    types.RoleSystem,
				Content: systemPrompt,
			}
			// 将system prompt插入到上下文开头
			trinity.PrependToContext(systemMsg)
		}
	}
}

// restoreContext 恢复Trinity上下文到指定快照
func (tc *TrinityCoordinator) restoreContext(sessionId string, trinity *sages.Sage, snapshot []types.ContextMessage) {
	trinity.ClearContext()
	for _, msg := range snapshot {
		trinity.AddToContextWithSession(sessionId, msg)
	}
}

// injectIntrospection 注入内省输入到Trinity上下文
// 对齐前端语义分配：think_about包含用户输入，think_result包含完整的三贤人观点
func (tc *TrinityCoordinator) injectIntrospection(sessionId string, trinity *sages.Sage, introspection string, userInput string) {
	// 构造工具调用消息（think_about包含用户原始输入）
	toolCallMsg := types.ContextMessage{
		Role:    types.RoleAssistant,
		Content: " ",
		ToolCalls: []types.ToolCall{
			{
				ID:   "introspection_call",
				Type: "function",
				Function: types.ToolCallFunction{
					Name:      "think_about",
					Arguments: fmt.Sprintf(`{"input":"%s"}`, escapeJSON(userInput)),
				},
			},
		},
	}

	// 构造工具结果消息（think_result包含完整的三贤人观点）
	toolResultMsg := types.ContextMessage{
		Role:    types.RoleTool,
		Content: introspection,
		ToolID:  "introspection_call",
	}

	trinity.AddToContextWithSession(sessionId, toolCallMsg)
	trinity.AddToContextWithSession(sessionId, toolResultMsg)
}

// callTrinity 调用Trinity并解析响应
func (tc *TrinityCoordinator) callTrinity(
	ctx context.Context,
	sessionId, roundId string,
	trinity *sages.Sage,
	userMessage string,
	attempt int,
) (*TrinityResult, error) {
	const (
		toolIndexStride               = 1000
		maxConsecutiveTransitionRetry = 10
	)

	streamMessageID := fmt.Sprintf("%s-%s-stream-%d", roundId, trinity.GetName(), attempt)
	streamMessage := &types.Message{
		ID:        streamMessageID,
		Type:      types.TypeAI,
		Content:   "",
		Status:    types.StatusStreaming,
		Timestamp: time.Now().UnixMilli(),
	}
	if err := websocket.PushSeelReplyStarted(sessionId, roundId, trinity.GetName(), trinity.GetDisplayName(), userMessage, streamMessage); err != nil {
		logging.LogWarnf("推送Trinity开始响应失败: %v", err)
	}

	speakHandler := stream.NewSpeakToolHandler()
	processor := utilstream.NewProcessor(speakHandler)
	indexOffset := 0
	consecutiveTransitionFailures := 0

	for turn := 0; ; turn++ {
		prevStats := speakHandler.TransitionStats()

		var (
			streamCh <-chan types.StreamChunk
			err      error
		)
		// 注意：第一轮也使用 SendContinuation，因为 injectIntrospection 已经添加了完整的上下文
		// 不需要额外的 user 消息（用户输入已包含在 think_about 工具调用参数中）
		streamCh, err = trinity.SendContinuation(ctx, sessionId, roundId)
		if err != nil {
			if pushErr := websocket.PushSeelReplyFailed(sessionId, roundId, trinity.GetName(), trinity.GetDisplayName(), err.Error()); pushErr != nil {
				logging.LogWarnf("推送Trinity失败事件失败: %v", pushErr)
			}
			return nil, fmt.Errorf("发送Trinity消息失败: %w", err)
		}

		turnCollector := newStreamedToolCallCollector()
		turnContent := strings.Builder{}

		for {
			select {
			case <-ctx.Done():
				if pushErr := websocket.PushSeelReplyFailed(sessionId, roundId, trinity.GetName(), trinity.GetDisplayName(), ctx.Err().Error()); pushErr != nil {
					logging.LogWarnf("推送Trinity失败事件失败: %v", pushErr)
				}
				return nil, ctx.Err()
			case chunk, ok := <-streamCh:
				if !ok {
					goto TurnComplete
				}
				if chunk.Object == "error" {
					streamErr := fmt.Errorf("Trinity流式响应错误: %s", chunk.ID)
					if pushErr := websocket.PushSeelReplyFailed(sessionId, roundId, trinity.GetName(), trinity.GetDisplayName(), streamErr.Error()); pushErr != nil {
						logging.LogWarnf("推送Trinity失败事件失败: %v", pushErr)
					}
					return nil, streamErr
				}
				if len(chunk.Choices) == 0 {
					continue
				}

				choice := chunk.Choices[0]
				if choice.Delta.Content != "" {
					processor.AccumulateContent(choice.Delta.Content)
					turnContent.WriteString(choice.Delta.Content)
					chunkMessage := &types.Message{
						ID:        streamMessageID,
						Type:      types.TypeAI,
						Content:   processor.GetAccumulated(),
						Status:    types.StatusStreaming,
						Timestamp: time.Now().UnixMilli(),
					}
					if pushErr := websocket.PushSeelReplyChunk(sessionId, roundId, trinity.GetName(), trinity.GetDisplayName(), chunkMessage); pushErr != nil {
						logging.LogWarnf("推送Trinity流式chunk失败: %v", pushErr)
					}
				}
				if len(choice.Delta.ToolCalls) > 0 {
					turnCollector.Merge(choice.Delta.ToolCalls)
					shifted := withToolCallIndexOffset(choice.Delta.ToolCalls, indexOffset)
					utilToolCalls := convertToolCallDeltas(shifted)
					processor.MergeToolCalls(utilToolCalls)
				}
			}
		}

	TurnComplete:
		indexOffset += toolIndexStride
		turnToolCalls := turnCollector.BuildSorted()

		if speakHandler.IsPublicPairCompleted() {
			if len(turnToolCalls) > 0 {
				appendTurnToolCallsToContext(sessionId, trinity, turnContent.String(), turnToolCalls, buildTrinitySpeakToolAck)
			}
			result, parseErr := tc.parseTrinitySpeakResult(sessionId, trinity, processor, speakHandler)
			if parseErr != nil {
				if pushErr := websocket.PushSeelReplyFailed(sessionId, roundId, trinity.GetName(), trinity.GetDisplayName(), parseErr.Error()); pushErr != nil {
					logging.LogWarnf("推送Trinity失败事件失败: %v", pushErr)
				}
				return nil, parseErr
			}
			completedMessage := &types.Message{
				ID:        streamMessageID,
				Type:      types.TypeAI,
				Content:   result.Content,
				Status:    types.StatusSuccess,
				Timestamp: time.Now().UnixMilli(),
			}
			if pushErr := websocket.PushSeelReplyCompleted(sessionId, roundId, trinity.GetName(), trinity.GetDisplayName(), completedMessage); pushErr != nil {
				logging.LogWarnf("推送Trinity完成事件失败: %v", pushErr)
			}
			return result, nil
		}

		if len(turnToolCalls) > 0 {
			appendTurnToolCallsToContext(sessionId, trinity, turnContent.String(), turnToolCalls, buildTrinitySpeakToolAck)
		} else if strings.TrimSpace(turnContent.String()) != "" {
			trinity.AddToContextWithSession(sessionId, types.ContextMessage{
				Role:    types.RoleAssistant,
				Content: turnContent.String(),
			})
		}
		trinity.AddToContextWithSession(sessionId, types.ContextMessage{
			Role:    types.RoleSystem,
			Content: speakHandler.BuildContinuationPrompt(),
		})

		currStats := speakHandler.TransitionStats()
		madeProgress := currStats.PublicStarts > prevStats.PublicStarts ||
			currStats.PublicContinues > prevStats.PublicContinues ||
			currStats.PublicStops > prevStats.PublicStops ||
			currStats.InternalStarts > prevStats.InternalStarts ||
			currStats.InternalContinues > prevStats.InternalContinues ||
			currStats.InternalStops > prevStats.InternalStops
		hasNewTransitionError := currStats.StateErrorCount > prevStats.StateErrorCount
		transitionFailed := !madeProgress || hasNewTransitionError
		if transitionFailed {
			consecutiveTransitionFailures++
		} else {
			consecutiveTransitionFailures = 0
		}
		if consecutiveTransitionFailures >= maxConsecutiveTransitionRetry {
			err := fmt.Errorf("Trinity工具状态转移连续失败次数达到上限(%d)", maxConsecutiveTransitionRetry)
			if pushErr := websocket.PushSeelReplyFailed(sessionId, roundId, trinity.GetName(), trinity.GetDisplayName(), err.Error()); pushErr != nil {
				logging.LogWarnf("推送Trinity失败事件失败: %v", pushErr)
			}
			return nil, err
		}
	}
}

// parseTrinitySpeakResult 解析Trinity speak工具结果
func (tc *TrinityCoordinator) parseTrinitySpeakResult(
	sessionId string,
	trinity *sages.Sage,
	processor *utilstream.Processor,
	speakHandler *stream.SpeakToolHandler,
) (*TrinityResult, error) {
	// 先获取完整结果
	result := processor.GetResult(true)

	// 从 handler 获取解析结果
	publicContent := strings.TrimSpace(speakHandler.GetPublicContent())
	internalMessages := speakHandler.GetInternalMessages()

	if err := speakHandler.ValidatePairedState(); err != nil {
		return &TrinityResult{
			Success: false,
		}, fmt.Errorf("Trinity speak状态转移不完整: %w", err)
	}

	// Trinity必须通过speak工具输出，不允许降级到纯文本
	if !speakHandler.HasPublicSpeakCall() {
		return &TrinityResult{
			Success: false,
		}, fmt.Errorf("Trinity未调用speak工具，原始输出: %s", result.Content)
	}

	if publicContent == "" {
		return &TrinityResult{
			Success: false,
		}, fmt.Errorf("Trinity的speak工具返回空内容")
	}

	// 注意：不需要在这里添加消息到上下文
	// appendTurnToolCallsToContext 已经在调用此函数之前添加了完整的消息序列（assistant + tool responses）

	return &TrinityResult{
		Content:              publicContent,
		InternalToolMessages: internalMessages,
		Success:              true,
	}, nil
}

// convertToolCallDeltas 转换工具调用增量类型
func convertToolCallDeltas(magiCalls []types.ToolCallDelta) []utilstream.ToolCallDelta {
	result := make([]utilstream.ToolCallDelta, len(magiCalls))
	for i, tc := range magiCalls {
		result[i] = utilstream.ToolCallDelta{
			Index: tc.Index,
			ID:    tc.ID,
			Type:  tc.Type,
		}
		if tc.Function != nil {
			result[i].Function = &utilstream.ToolCallFunctionDelta{
				Name:      tc.Function.Name,
				Arguments: tc.Function.Arguments,
			}
		}
	}
	return result
}

// escapeJSON 转义JSON字符串
func escapeJSON(s string) string {
	escaped, _ := json.Marshal(s)
	// 去掉首尾的引号
	return string(escaped[1 : len(escaped)-1])
}

func buildTrinitySpeakToolAck(toolName string) string {
	switch strings.TrimSpace(toolName) {
	case stream.TrinitySpeakStartToolName:
		return fmt.Sprintf(
			`{"ok":true,"scope":"public","instruction":"继续调用 %s 追加正文，结束时调用 %s"}`,
			stream.TrinitySpeakContinueToolName,
			stream.TrinitySpeakStopToolName,
		)
	case stream.TrinitySpeakContinueToolName:
		return `{"ok":true,"scope":"public","state":"continuing"}`
	case stream.TrinitySpeakStopToolName:
		return `{"ok":true,"scope":"public","state":"stopped"}`
	case stream.TrinitySpeakInternalStartToolName:
		return fmt.Sprintf(
			`{"ok":true,"scope":"internal","instruction":"继续调用 %s 追加内部报告，结束时调用 %s"}`,
			stream.TrinitySpeakInternalContinueToolName,
			stream.TrinitySpeakInternalStopToolName,
		)
	case stream.TrinitySpeakInternalContinueToolName:
		return `{"ok":true,"scope":"internal","state":"continuing"}`
	case stream.TrinitySpeakInternalStopToolName:
		return `{"ok":true,"scope":"internal","state":"stopped"}`
	default:
		return `{"ok":true}`
	}
}
