// Package coordinator 提供MAGI决策协调功能
package coordinator

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
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
		resp, err := rc.collectSingleSageResponse(ctx, sessionId, roundId, melchior, modelInput)
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
		resp, err := rc.collectSingleSageResponse(ctx, sessionId, roundId, balthazar, modelInput)
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
		resp, err := rc.collectSingleSageResponse(ctx, sessionId, roundId, casper, modelInput)
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
	const (
		toolIndexStride               = 1000
		maxConsecutiveTransitionRetry = 10
	)

	processor := utilstream.NewProcessor()
	wannaSpeakTracker := &wannaSpeakStateTracker{}
	toolResultExecutor := rc.buildToolResultExecutor(sage)
	streamMessageID := fmt.Sprintf("%s-%s-stream", roundId, sage.GetName())
	indexOffset := 0
	consecutiveTransitionFailures := 0

	for turn := 0; ; turn++ {
		prevStartCount := wannaSpeakTracker.startCount
		prevContinueCount := wannaSpeakTracker.continueCount
		prevStopCount := wannaSpeakTracker.stopCount
		prevErrorCount := len(wannaSpeakTracker.transitionErrors)

		var (
			streamCh <-chan types.StreamChunk
			err      error
		)
		if turn == 0 {
			streamCh, err = sage.SendMessage(ctx, sessionId, roundId, modelInput)
		} else {
			streamCh, err = sage.SendContinuation(ctx, sessionId, roundId)
		}
		if err != nil {
			if pushErr := websocket.PushSeelReplyFailed(sessionId, roundId, sage.GetName(), sage.GetDisplayName(), err.Error()); pushErr != nil {
				logging.LogWarnf("推送%s响应失败事件失败: %v", sage.GetDisplayName(), pushErr)
			}
			return nil, fmt.Errorf("发送消息失败: %w", err)
		}

		turnCollector := newStreamedToolCallCollector()
		turnCollector.SetCallback(func(
			toolCallIndex int,
			toolCallId string,
			toolName string,
			rawArguments string,
			arguments map[string]interface{},
			isComplete bool,
			detectedTime int64,
		) {
			if err := websocket.PushToolCallDetected(
				sessionId, roundId, sage.GetName(), sage.GetDisplayName(),
				toolCallIndex, toolCallId, toolName, rawArguments, arguments, isComplete, detectedTime,
			); err != nil {
				logging.LogWarnf("推送工具调用检测事件失败: %v", err)
			}
		})
		turnContent := strings.Builder{}

		// 创建空闲超时定时器：30秒内没有收到chunk则超时
		idleTimer := time.NewTimer(rc.timeout)

		for {
			select {
			case <-idleTimer.C:
				errMsg := fmt.Sprintf("贤者 %s 空闲超时（%v 内未收到响应chunk）[会话:%s 轮次:%s]",
					sage.GetDisplayName(), rc.timeout, sessionId, roundId)
				if pushErr := websocket.PushSeelReplyFailed(sessionId, roundId, sage.GetName(), sage.GetDisplayName(), errMsg); pushErr != nil {
					logging.LogWarnf("推送%s响应失败事件失败: %v", sage.GetDisplayName(), pushErr)
				}
				return nil, errors.New(errMsg)
			case <-ctx.Done():
				errMsg := fmt.Sprintf("贤者 %s 上下文已取消: %v [会话:%s 轮次:%s]",
					sage.GetDisplayName(), ctx.Err(), sessionId, roundId)
				if pushErr := websocket.PushSeelReplyFailed(sessionId, roundId, sage.GetName(), sage.GetDisplayName(), errMsg); pushErr != nil {
					logging.LogWarnf("推送%s响应失败事件失败: %v", sage.GetDisplayName(), pushErr)
				}
				return nil, errors.New(errMsg)
			case chunk, ok := <-streamCh:
				if !ok {
					goto TurnComplete
				}
				// 收到chunk，重置空闲超时定时器
				if !idleTimer.Stop() {
					select {
					case <-idleTimer.C:
					default:
					}
				}
				idleTimer.Reset(rc.timeout)

				if chunk.Object == "error" {
					streamErr := fmt.Errorf("流式响应错误: %s", chunk.ID)
					if pushErr := websocket.PushSeelReplyFailed(sessionId, roundId, sage.GetName(), sage.GetDisplayName(), streamErr.Error()); pushErr != nil {
						logging.LogWarnf("推送%s响应失败事件失败: %v", sage.GetDisplayName(), pushErr)
					}
					return nil, streamErr
				}
				if len(chunk.Choices) == 0 {
					continue
				}

				choice := chunk.Choices[0]
				if len(choice.Delta.ToolCalls) > 0 {
					wannaSpeakTracker.TrackToolCalls(choice.Delta.ToolCalls)
					turnCollector.Merge(choice.Delta.ToolCalls)

					shifted := withToolCallIndexOffset(choice.Delta.ToolCalls, indexOffset)
					utilToolCalls := convertToolCallDeltasForCollector(shifted)
					processor.MergeToolCalls(utilToolCalls)
				}

				if choice.Delta.Content != "" {
					processor.AccumulateContent(choice.Delta.Content)
					turnContent.WriteString(choice.Delta.Content)

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

	TurnComplete:
		// turn完成，停止空闲超时定时器
		if !idleTimer.Stop() {
			select {
			case <-idleTimer.C:
			default:
			}
		}
		indexOffset += toolIndexStride
		turnToolCalls := turnCollector.BuildSorted()

		if wannaSpeakTracker.IsCompletedPair() {
			if len(turnToolCalls) > 0 {
				appendTurnToolCallsToContextWithExecutor(
					sessionId,
					sage,
					turnContent.String(),
					turnToolCalls,
					toolResultExecutor,
					buildWannaSpeakToolAck,
				)
			}

			if !wannaSpeakTracker.HasCapturedContent() {
				sage.AddToContextWithSession(sessionId, types.ContextMessage{
					Role:    types.RoleSystem,
					Content: wannaSpeakTracker.BuildContinuationPrompt(),
				})
				continue
			}

			result := processor.GetResult(true)

			response, buildErr := rc.buildSageResponse(sessionId, roundId, sage, result, wannaSpeakTracker)
			if buildErr != nil {
				if pushErr := websocket.PushSeelReplyFailed(sessionId, roundId, sage.GetName(), sage.GetDisplayName(), buildErr.Error()); pushErr != nil {
					logging.LogWarnf("推送%s响应失败事件失败: %v", sage.GetDisplayName(), pushErr)
				}
				return nil, buildErr
			}

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

		if len(turnToolCalls) > 0 {
			appendTurnToolCallsToContextWithExecutor(
				sessionId,
				sage,
				turnContent.String(),
				turnToolCalls,
				toolResultExecutor,
				buildWannaSpeakToolAck,
			)
		} else if strings.TrimSpace(turnContent.String()) != "" {
			sage.AddToContextWithSession(sessionId, types.ContextMessage{
				Role:    types.RoleAssistant,
				Content: turnContent.String(),
			})
		}

		sage.AddToContextWithSession(sessionId, types.ContextMessage{
			Role:    types.RoleSystem,
			Content: wannaSpeakTracker.BuildContinuationPrompt(),
		})

		madeProgress := wannaSpeakTracker.startCount > prevStartCount ||
			wannaSpeakTracker.continueCount > prevContinueCount ||
			wannaSpeakTracker.stopCount > prevStopCount
		hasNewTransitionError := len(wannaSpeakTracker.transitionErrors) > prevErrorCount
		transitionFailed := !madeProgress || hasNewTransitionError
		if transitionFailed {
			consecutiveTransitionFailures++
		} else {
			consecutiveTransitionFailures = 0
		}
		if consecutiveTransitionFailures >= maxConsecutiveTransitionRetry {
			err := fmt.Errorf("工具状态转移连续失败次数达到上限(%d)", maxConsecutiveTransitionRetry)
			if pushErr := websocket.PushSeelReplyFailed(sessionId, roundId, sage.GetName(), sage.GetDisplayName(), err.Error()); pushErr != nil {
				logging.LogWarnf("推送%s响应失败事件失败: %v", sage.GetDisplayName(), pushErr)
			}
			return nil, err
		}
	}
}

// buildSageResponse 构建SageResponse
func (rc *ResponseCollector) buildSageResponse(
	sessionId, roundId string,
	sage *sages.Sage,
	result *utilstream.StreamResult,
	wannaSpeakTracker *wannaSpeakStateTracker,
) (*types.SageResponse, error) {
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

	if result.HasToolCalls {
		wannaSpeakContent, hasWannaSpeak, err := parseWannaSpeakToolContent(
			result.ToolArgumentsByName,
			wannaSpeakTracker,
		)
		if err != nil {
			return nil, err
		}
		if hasWannaSpeak {
			response.Content = wannaSpeakContent
		}
	}

	// 检查是否有deliberation_signal工具调用（仅Melchior）
	if sage.GetName() == "melchior" && result.HasToolCalls {
		if args, ok := result.ToolArgumentsByName["deliberation_signal"]; ok && len(args) > 0 {
			var signal types.DeliberationSignal
			if err := json.Unmarshal([]byte(args[0]), &signal); err == nil {
				response.RequiresDeliberation = signal.RequiresDeliberation
				response.DeliberationReason = signal.Reason
				response.ProposedAction = signal.ProposedAction

				logging.LogInfof("审慎决策信号已提取: RequiresDeliberation=%v, Reason=%s, ProposedAction=%s",
					signal.RequiresDeliberation, signal.Reason, signal.ProposedAction)

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
		Content: response.Content,
	}
	sage.AddToContextWithSession(sessionId, assistantMsg)

	return response, nil
}

func (rc *ResponseCollector) buildToolResultExecutor(sage *sages.Sage) ToolCallResultExecutor {
	if !sageHasAllFunctionTools(sage, config.NoteKeywordSearchToolName) {
		return nil
	}

	noteExecutor := newNoteKeywordToolResultExecutor()
	return func(toolCall types.ToolCall) (string, bool, error) {
		return noteExecutor.ExecuteToolCall(toolCall)
	}
}

func parseWannaSpeakToolContent(
	toolArgumentsByName map[string][]string,
	tracker *wannaSpeakStateTracker,
) (content string, hasWannaSpeak bool, err error) {
	_, hasStart := toolArgumentsByName[config.WannaSpeakStartToolName]
	continueArgs, hasContinue := toolArgumentsByName[config.WannaSpeakContinueToolName]
	_, hasStop := toolArgumentsByName[config.WannaSpeakStopToolName]
	if !hasStart && !hasContinue && !hasStop {
		return "", false, nil
	}
	if tracker != nil && !tracker.HasEffectiveTransition() && !hasContinue {
		return "", false, nil
	}

	if tracker != nil {
		if parseErr := tracker.ValidatePairedState(); parseErr != nil {
			return "", true, parseErr
		}
	}
	segments, parseErr := extractToolContentSegments(continueArgs, config.WannaSpeakContinueToolName)
	if parseErr != nil {
		return "", true, parseErr
	}
	content = strings.TrimSpace(strings.Join(segments, ""))
	if content == "" {
		return "", true, fmt.Errorf("%s 与 %s 已调用但缺少 %s 内容", config.WannaSpeakStartToolName, config.WannaSpeakStopToolName, config.WannaSpeakContinueToolName)
	}
	return content, true, nil
}

func extractToolContentSegments(args []string, toolName string) ([]string, error) {
	if len(args) == 0 {
		return nil, nil
	}

	segments := make([]string, 0, len(args))
	for _, raw := range args {
		if strings.TrimSpace(raw) == "" {
			return nil, fmt.Errorf("%s 缺少参数", toolName)
		}
		var payload struct {
			Content string `json:"content"`
		}
		if err := json.Unmarshal([]byte(raw), &payload); err != nil {
			return nil, fmt.Errorf("%s 参数解析失败: %w", toolName, err)
		}
		if strings.TrimSpace(payload.Content) == "" {
			return nil, fmt.Errorf("%s 的 content 不能为空", toolName)
		}
		segments = append(segments, payload.Content)
	}
	return segments, nil
}

type wannaSpeakStateTracker struct {
	capturing        bool
	startCount       int
	continueCount    int
	stopCount        int
	transitionErrors []string
}

func (t *wannaSpeakStateTracker) TrackToolCalls(toolCalls []types.ToolCallDelta) {
	for _, tc := range toolCalls {
		if tc.Function == nil {
			continue
		}
		toolName := strings.TrimSpace(tc.Function.Name)
		if toolName == "" {
			continue
		}
		switch toolName {
		case config.WannaSpeakStartToolName:
			if t.capturing {
				// 已在表达状态时重复 start 视为幂等，不额外计数，避免伪不配对。
				continue
			}
			t.startCount++
			t.capturing = true
		case config.WannaSpeakContinueToolName:
			if !t.capturing {
				t.transitionErrors = append(
					t.transitionErrors,
					fmt.Sprintf("%s 必须在 %s 与 %s 之间调用", config.WannaSpeakContinueToolName, config.WannaSpeakStartToolName, config.WannaSpeakStopToolName),
				)
				continue
			}
			t.continueCount++
		case config.WannaSpeakStopToolName:
			if !t.capturing {
				// 可能是补齐历史遗留状态，忽略孤立 stop，避免跨轮噪声放大。
				continue
			}
			t.stopCount++
			t.capturing = false
		}
	}
}

func (t *wannaSpeakStateTracker) TrackContent(content string) {
	// 正文改由 wanna_speak_continue 的 content 参数承载，不再记录纯文本。
}

func (t *wannaSpeakStateTracker) ValidatePairedState() error {
	if len(t.transitionErrors) > 0 {
		return fmt.Errorf("%s", strings.Join(t.transitionErrors, "; "))
	}
	if t.startCount == 0 && t.stopCount == 0 && t.continueCount == 0 {
		return nil
	}
	if t.startCount == 0 && t.continueCount > 0 {
		return fmt.Errorf("%s 必须在 %s 之后调用", config.WannaSpeakContinueToolName, config.WannaSpeakStartToolName)
	}
	if t.startCount == 0 || t.stopCount == 0 {
		return fmt.Errorf("%s 与 %s 必须成对调用", config.WannaSpeakStartToolName, config.WannaSpeakStopToolName)
	}
	if t.startCount != t.stopCount {
		return fmt.Errorf("%s 与 %s 调用次数不一致", config.WannaSpeakStartToolName, config.WannaSpeakStopToolName)
	}
	if t.continueCount == 0 {
		return fmt.Errorf("%s 已调用但缺少 %s", config.WannaSpeakStartToolName, config.WannaSpeakContinueToolName)
	}
	if t.capturing {
		return fmt.Errorf("%s 已调用但未正确结束，缺少 %s", config.WannaSpeakStartToolName, config.WannaSpeakStopToolName)
	}
	return nil
}

func (t *wannaSpeakStateTracker) GetCapturedContent() string {
	return ""
}

func (t *wannaSpeakStateTracker) IsCompletedPair() bool {
	return t.startCount > 0 &&
		t.continueCount > 0 &&
		t.startCount == t.stopCount &&
		!t.capturing &&
		len(t.transitionErrors) == 0
}

func (t *wannaSpeakStateTracker) HasEffectiveTransition() bool {
	return t.startCount > 0 || t.continueCount > 0 || t.stopCount > 0 || t.capturing
}

func (t *wannaSpeakStateTracker) HasCapturedContent() bool {
	return t.continueCount > 0
}

func (t *wannaSpeakStateTracker) BuildContinuationPrompt() string {
	if len(t.transitionErrors) > 0 {
		return fmt.Sprintf(
			"上一次工具状态转移不合法：%s。请重新按顺序执行：先调用 %s，再调用 %s 追加正文，最后调用 %s。",
			strings.Join(t.transitionErrors, "; "),
			config.WannaSpeakStartToolName,
			config.WannaSpeakContinueToolName,
			config.WannaSpeakStopToolName,
		)
	}
	if t.startCount > 0 && t.startCount == t.stopCount && t.continueCount == 0 {
		return fmt.Sprintf(
			"你已经调用了 %s 与 %s，但没有调用 %s。请重新调用 %s，再调用 %s 追加至少一段正文，最后调用 %s。",
			config.WannaSpeakStartToolName,
			config.WannaSpeakStopToolName,
			config.WannaSpeakContinueToolName,
			config.WannaSpeakStartToolName,
			config.WannaSpeakContinueToolName,
			config.WannaSpeakStopToolName,
		)
	}
	if t.capturing || t.startCount > t.stopCount {
		return fmt.Sprintf(
			"你已调用 %s 并进入表达状态。请继续调用 %s 追加正文，结束时必须调用 %s。",
			config.WannaSpeakStartToolName,
			config.WannaSpeakContinueToolName,
			config.WannaSpeakStopToolName,
		)
	}
	return fmt.Sprintf(
		"你的纯文本输出不会被采纳。请使用状态工具：先调用 %s，再调用 %s 追加正文，最后调用 %s。",
		config.WannaSpeakStartToolName,
		config.WannaSpeakContinueToolName,
		config.WannaSpeakStopToolName,
	)
}

func buildWannaSpeakToolAck(toolName string) string {
	switch strings.TrimSpace(toolName) {
	case config.WannaSpeakStartToolName:
		return fmt.Sprintf(
			`{"ok":true,"state":"speaking","instruction":"继续调用 %s 追加正文，结束时调用 %s"}`,
			config.WannaSpeakContinueToolName,
			config.WannaSpeakStopToolName,
		)
	case config.WannaSpeakContinueToolName:
		return `{"ok":true,"state":"continuing"}`
	case config.WannaSpeakStopToolName:
		return `{"ok":true,"state":"stopped"}`
	default:
		return `{"ok":true}`
	}
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
