// Package coordinator 提供MAGI决策协调功能
package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/prompts"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/stream"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
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
	tc.ensureSystemPrompt(trinity)

	// 保存初始上下文快照（用于重试恢复）
	initialContext := trinity.GetContext()

	// 指数退避重试调用Trinity
	var lastErr error
	backoff := tc.initialBackoff

	for attempt := 1; attempt <= tc.maxRetries; attempt++ {
		// 每次尝试前恢复初始上下文并重新注入内省输入
		if attempt > 1 {
			tc.restoreContext(trinity, initialContext)
		}
		tc.injectIntrospection(trinity, introspection, userMessage)

		result, err := tc.callTrinity(ctx, trinity)
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
	melchior := tc.findSageContent(responses, "melchior", prompts.TrinityFallbackMelchior)
	balthazar := tc.findSageContent(responses, "balthazar", prompts.TrinityFallbackBalthazar)
	casper := tc.findSageContent(responses, "casper", prompts.TrinityFallbackCasper)

	return prompts.BuildTrinityIntrospectionInput(melchior, balthazar, casper)
}

// findSageContent 按贤者名称查找响应内容
func (tc *TrinityCoordinator) findSageContent(responses []types.SageResponse, name, fallback string) string {
	for _, resp := range responses {
		if resp.Seel == name {
			return resp.Content
		}
	}
	return fallback
}

// ensureSystemPrompt 确保system prompt在上下文中
// 修复问题4：防止在注入上下文后system prompt被绕过
func (tc *TrinityCoordinator) ensureSystemPrompt(trinity *sages.Sage) {
	messages := trinity.GetContext()
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
func (tc *TrinityCoordinator) restoreContext(trinity *sages.Sage, snapshot []types.ContextMessage) {
	trinity.ClearContext()
	for _, msg := range snapshot {
		trinity.AddToContext(msg)
	}
}

// injectIntrospection 注入内省输入到Trinity上下文
// 对齐前端语义分配：think_about包含用户输入，think_result包含完整的三贤人观点
func (tc *TrinityCoordinator) injectIntrospection(trinity *sages.Sage, introspection string, userInput string) {
	// 构造工具调用消息（think_about包含用户原始输入）
	toolCallMsg := types.ContextMessage{
		Role:    types.RoleAssistant,
		Content: "",
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

	trinity.AddToContext(toolCallMsg)
	trinity.AddToContext(toolResultMsg)
}

// callTrinity 调用Trinity并解析响应
func (tc *TrinityCoordinator) callTrinity(ctx context.Context, trinity *sages.Sage) (*TrinityResult, error) {
	// 发送空消息（上下文已包含内省输入）
	streamCh, err := trinity.SendMessage(ctx, "")
	if err != nil {
		return nil, fmt.Errorf("发送Trinity消息失败: %w", err)
	}

	// 处理流式响应
	processor := stream.NewProcessor()

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case chunk, ok := <-streamCh:
			if !ok {
				// 流结束，解析speak工具
				return tc.parseTrinitySpeakResult(trinity, processor)
			}

			// 检查chunk是否有效
			if len(chunk.Choices) == 0 {
				continue
			}

			// 累积内容
			if chunk.Choices[0].Delta.Content != "" {
				processor.AccumulateContent(chunk.Choices[0].Delta.Content)
			}

			// 合并工具调用
			if len(chunk.Choices[0].Delta.ToolCalls) > 0 {
				processor.MergeToolCalls(chunk.Choices[0].Delta.ToolCalls)
			}
		}
	}
}

// parseTrinitySpeakResult 解析Trinity speak工具结果
func (tc *TrinityCoordinator) parseTrinitySpeakResult(
	trinity *sages.Sage,
	processor *stream.Processor,
) (*TrinityResult, error) {
	// 解析speak工具的channel输出
	publicContent := processor.ResolveSpeakChannels()
	toolState := processor.GetToolState()

	// 检查是否有public输出
	if !toolState.HasPublicSpeakToolCall {
		return &TrinityResult{
			Success: false,
		}, fmt.Errorf("Trinity未返回public输出")
	}

	// 构建assistant响应并添加到上下文
	result := processor.GetResult(true)
	assistantMsg := types.ContextMessage{
		Role:    types.RoleAssistant,
		Content: result.Content,
	}

	// 如果有工具调用，需要添加工具调用信息
	if result.HasToolCalls {
		var toolCalls []types.ToolCall
		for name, argsList := range result.ToolArgumentsByName {
			for i, args := range argsList {
				toolCalls = append(toolCalls, types.ToolCall{
					ID:   fmt.Sprintf("call_%s_%d", name, i),
					Type: "function",
					Function: types.ToolCallFunction{
						Name:      name,
						Arguments: args,
					},
				})
			}
		}
		assistantMsg.ToolCalls = toolCalls
	}

	trinity.AddToContext(assistantMsg)

	return &TrinityResult{
		Content:              publicContent,
		InternalToolMessages: toolState.InternalSpokenMessages,
		Success:              true,
	}, nil
}

// escapeJSON 转义JSON字符串
func escapeJSON(s string) string {
	escaped, _ := json.Marshal(s)
	// 去掉首尾的引号
	return string(escaped[1 : len(escaped)-1])
}
