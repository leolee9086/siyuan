// Package coordinator 提供MAGI决策协调功能
package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
	utilstream "github.com/siyuan-note/siyuan/kernel/util/stream"
)

// ResponseCollector 响应收集器
type ResponseCollector struct {
	timeout time.Duration
}

// NewResponseCollector 创建响应收集器
func NewResponseCollector(timeout time.Duration) *ResponseCollector {
	return &ResponseCollector{
		timeout: timeout,
	}
}

// CollectResponses 并发收集三贤人的响应
// 至少需要2个贤者成功响应，否则返回错误
func (rc *ResponseCollector) CollectResponses(
	ctx context.Context,
	sessionId, roundId string,
	melchior, balthazar, casper *sages.Sage,
	userMessage string,
	modelInput string,
) ([]types.SageResponse, error) {
	// 创建超时上下文
	timeoutCtx, cancel := context.WithTimeout(ctx, rc.timeout)
	defer cancel()

	// 结果channel
	type result struct {
		response *types.SageResponse
		err      error
		sageName string
	}
	resultCh := make(chan result, 3)

	// 并发收集三个贤者的响应
	var wg sync.WaitGroup
	wg.Add(3)

	// Melchior
	go func() {
		defer wg.Done()
		streamMessage := buildSeelStreamMessage(roundId, melchior)
		// 推送贤者开始响应
		if err := websocket.PushSeelReplyStarted(sessionId, roundId, melchior.GetName(), melchior.GetDisplayName(), userMessage, streamMessage); err != nil {
			logging.LogWarnf("推送Melchior开始响应失败: %v", err)
		}
		resp, err := rc.collectSingleSageResponse(timeoutCtx, sessionId, roundId, melchior, modelInput)
		resultCh <- result{response: resp, err: err, sageName: "melchior"}
	}()

	// Balthazar
	go func() {
		defer wg.Done()
		streamMessage := buildSeelStreamMessage(roundId, balthazar)
		// 推送贤者开始响应
		if err := websocket.PushSeelReplyStarted(sessionId, roundId, balthazar.GetName(), balthazar.GetDisplayName(), userMessage, streamMessage); err != nil {
			logging.LogWarnf("推送Balthazar开始响应失败: %v", err)
		}
		resp, err := rc.collectSingleSageResponse(timeoutCtx, sessionId, roundId, balthazar, modelInput)
		resultCh <- result{response: resp, err: err, sageName: "balthazar"}
	}()

	// Casper
	go func() {
		defer wg.Done()
		streamMessage := buildSeelStreamMessage(roundId, casper)
		// 推送贤者开始响应
		if err := websocket.PushSeelReplyStarted(sessionId, roundId, casper.GetName(), casper.GetDisplayName(), userMessage, streamMessage); err != nil {
			logging.LogWarnf("推送Casper开始响应失败: %v", err)
		}
		resp, err := rc.collectSingleSageResponse(timeoutCtx, sessionId, roundId, casper, modelInput)
		resultCh <- result{response: resp, err: err, sageName: "casper"}
	}()

	// 等待所有goroutine完成
	go func() {
		wg.Wait()
		close(resultCh)
	}()

	// 收集结果
	var responses []types.SageResponse
	var successCount int
	var errors []string

	for res := range resultCh {
		if res.err != nil {
			errors = append(errors, fmt.Sprintf("%s: %v", res.sageName, res.err))
		} else if res.response != nil {
			responses = append(responses, *res.response)
			successCount++
		}
	}

	// 检查是否至少有2个成功
	if successCount < 2 {
		return nil, fmt.Errorf("至少需要2个贤者成功响应，实际成功: %d, 错误: %v", successCount, errors)
	}

	return responses, nil
}

func buildSeelStreamMessage(roundId string, sage *sages.Sage) *types.Message {
	return &types.Message{
		ID:        fmt.Sprintf("%s-%s-stream", roundId, sage.GetName()),
		Type:      types.TypeAI,
		Content:   "",
		Status:    types.StatusStreaming,
		Timestamp: time.Now().UnixMilli(),
	}
}

// collectSingleSageResponse 收集单个贤者的响应
func (rc *ResponseCollector) collectSingleSageResponse(
	ctx context.Context,
	sessionId, roundId string,
	sage *sages.Sage,
	modelInput string,
) (*types.SageResponse, error) {
	// 发送消息并获取流式响应
	streamCh, err := sage.SendMessage(ctx, sessionId, roundId, modelInput)
	if err != nil {
		// 推送失败事件
		if pushErr := websocket.PushSeelReplyFailed(sessionId, roundId, sage.GetName(), sage.GetDisplayName(), err.Error()); pushErr != nil {
			logging.LogWarnf("推送%s响应失败事件失败: %v", sage.GetDisplayName(), pushErr)
		}
		return nil, fmt.Errorf("发送消息失败: %w", err)
	}

	// 处理流式响应 - 使用通用处理器
	processor := utilstream.NewProcessor()
	streamMessageID := fmt.Sprintf("%s-%s-stream", roundId, sage.GetName())

	for {
		select {
		case <-ctx.Done():
			// 推送失败事件
			if pushErr := websocket.PushSeelReplyFailed(sessionId, roundId, sage.GetName(), sage.GetDisplayName(), "上下文超时或取消"); pushErr != nil {
				logging.LogWarnf("推送%s响应失败事件失败: %v", sage.GetDisplayName(), pushErr)
			}
			return nil, fmt.Errorf("上下文超时或取消")
		case chunk, ok := <-streamCh:
			if !ok {
				// 流结束
				result := processor.GetResult(true)
				response, err := rc.buildSageResponse(sessionId, roundId, sage, result)
				if err != nil {
					// 推送失败事件
					if pushErr := websocket.PushSeelReplyFailed(sessionId, roundId, sage.GetName(), sage.GetDisplayName(), err.Error()); pushErr != nil {
						logging.LogWarnf("推送%s响应失败事件失败: %v", sage.GetDisplayName(), pushErr)
					}
					return nil, err
				}

				// 推送完成事件
				msg := &types.Message{
					ID:        streamMessageID,
					Type:      types.TypeAI,
					Content:   response.Content,
					Status:    types.StatusSuccess,
					Timestamp: time.Now().UnixMilli(),
				}
				if pushErr := websocket.PushSeelReplyCompleted(sessionId, roundId, sage.GetName(), sage.GetDisplayName(), msg); pushErr != nil {
					logging.LogWarnf("推送%s响应完成失败: %v", sage.GetDisplayName(), pushErr)
				}

				return response, nil
			}
			if chunk.Object == "error" {
				err := fmt.Errorf("流式响应错误: %s", chunk.ID)
				if pushErr := websocket.PushSeelReplyFailed(sessionId, roundId, sage.GetName(), sage.GetDisplayName(), err.Error()); pushErr != nil {
					logging.LogWarnf("推送%s响应失败事件失败: %v", sage.GetDisplayName(), pushErr)
				}
				return nil, err
			}

			// 检查chunk是否有效
			if len(chunk.Choices) == 0 {
				continue
			}

			choice := chunk.Choices[0]

			// 累积内容
			if choice.Delta.Content != "" {
				processor.AccumulateContent(choice.Delta.Content)
			}

			// 转换并合并工具调用
			if len(choice.Delta.ToolCalls) > 0 {
				utilToolCalls := convertToolCallDeltasForCollector(choice.Delta.ToolCalls)
				processor.MergeToolCalls(utilToolCalls)
			}

			// 推送流式chunk事件（仅在有文本增量时推送，内容为当前累积文本）
			if choice.Delta.Content != "" {
				msg := &types.Message{
					ID:        streamMessageID,
					Type:      types.TypeAI,
					Content:   processor.GetAccumulated(),
					Status:    types.StatusStreaming,
					Timestamp: time.Now().UnixMilli(),
				}
				if pushErr := websocket.PushSeelReplyChunk(sessionId, roundId, sage.GetName(), sage.GetDisplayName(), msg); pushErr != nil {
					logging.LogWarnf("推送%s流式chunk失败: %v", sage.GetDisplayName(), pushErr)
				}
			}
		}
	}
}

// buildSageResponse 构建SageResponse
func (rc *ResponseCollector) buildSageResponse(sessionId, roundId string, sage *sages.Sage, result *utilstream.StreamResult) (*types.SageResponse, error) {
	// 检查是否有有效内容
	if result.Content == "" && !result.HasToolCalls {
		return nil, fmt.Errorf("贤者响应为空")
	}

	response := &types.SageResponse{
		Content:             result.Content,
		Seel:                sage.GetName(),
		DisplayName:         sage.GetDisplayName(),
		UsedToolCall:        result.HasToolCalls,
		ToolCallNames:       result.ToolCallNames,
		ToolArgumentsByName: result.ToolArgumentsByName,
	}

	// 推送通用工具调用检测事件
	if result.HasToolCalls {
		for toolName, argsArray := range result.ToolArgumentsByName {
			if len(argsArray) > 0 {
				var argsMap map[string]interface{}
				if err := json.Unmarshal([]byte(argsArray[0]), &argsMap); err == nil {
					if err := websocket.PushToolCallDetected(sessionId, roundId, sage.GetName(), sage.GetDisplayName(), toolName, argsMap); err != nil {
						logging.LogWarnf("推送工具调用检测事件失败: %v", err)
					}
				}
			}
		}
	}

	// 检查是否有deliberation_signal工具调用（仅Melchior）
	if sage.GetName() == "melchior" && result.HasToolCalls {
		if args, ok := result.ToolArgumentsByName["deliberation_signal"]; ok && len(args) > 0 {
			var signal types.DeliberationSignal
			if err := json.Unmarshal([]byte(args[0]), &signal); err == nil {
				response.RequiresDeliberation = signal.RequiresDeliberation
				response.DeliberationReason = signal.Reason

				logging.LogInfof("审慎决策信号已提取: RequiresDeliberation=%v, Reason=%s", signal.RequiresDeliberation, signal.Reason)

				// 推送审慎决策信号专用事件
				if err := websocket.PushDeliberationSignalRaised(
					sessionId, roundId, sage.GetName(), sage.GetDisplayName(),
					signal.Reason, signal.RequiresDeliberation,
				); err != nil {
					logging.LogWarnf("推送审慎决策信号事件失败: %v", err)
				}
			} else {
				logging.LogWarnf("解析deliberation_signal参数失败: %v, args=%s", err, args[0])
			}
		}
	}

	// 将assistant响应添加到贤者的上下文历史
	assistantMsg := types.ContextMessage{
		Role:    types.RoleAssistant,
		Content: result.Content,
	}
	sage.AddToContextWithSession(sessionId, assistantMsg)

	return response, nil
}

// convertToolCallDeltas 转换工具调用增量类型（collector专用）
func convertToolCallDeltasForCollector(magiCalls []types.ToolCallDelta) []utilstream.ToolCallDelta {
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
