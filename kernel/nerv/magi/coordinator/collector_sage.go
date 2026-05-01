package coordinator

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
	utilstream "github.com/siyuan-note/siyuan/kernel/util/stream"
)

const (
	_toolIndexStride               = 1000
	_maxConsecutiveTransitionRetry = 50
)

func (rc *ResponseCollector) collectSingleSageResponse(
	ctx context.Context,
	sessionId, roundId string,
	sage *sages.Sage,
	modelInput string,
	options CollectResponsesOptions,
) (*types.SageResponse, error) {
	processor := utilstream.NewProcessor()
	wannaSpeakTracker := newWannaSpeakStateTracker()
	toolResultExecutor := rc.buildToolResultExecutor(sage, options.RuntimeTools)
	streamMessageID := fmt.Sprintf("%s-%s-stream", roundId, sage.GetName())
	indexOffset := 0
	consecutiveTransitionFailures := 0
	hbInvestigated := false

	for turn := 0; ; turn++ {
		streamCh, err := rc.sendSageTurnMessage(ctx, sessionId, roundId, sage, modelInput, options, turn)
		if err != nil {
			return nil, err
		}

		turnCollector, turnContent, reasoningContent, err := rc.processSageStreamChunks(ctx, sage, sessionId, roundId, streamCh, streamMessageID, processor, indexOffset)
		if err != nil {
			return nil, err
		}

		indexOffset += _toolIndexStride
		turnToolCalls := turnCollector.BuildSorted()

		if options.AllowWannaSleep {
			for _, tc := range turnToolCalls {
				if !hbInvestigated && isInvestigationTool(strings.TrimSpace(tc.Function.Name)) {
					hbInvestigated = true
				}
			}

			resp, found, err := checkWannaSleep(sage, turnContent, reasoningContent, turnToolCalls, streamMessageID, roundId)
			if err != nil {
				return nil, err
			}
			if found {
				if !options.IsSleepMode && !hbInvestigated {
					_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
						Role:    types.RoleSystem,
						Content: fmt.Sprintf("你不能现在休息，因为你还没有调用任何调查类工具（如 %s）。请先使用调查类工具了解当前状态后再调用睡前记录工具。", config.NoteKeywordSearchToolName),
					})
					continue
				}
				return resp, nil
			}
		}

		turnMadeProgress, turnStateErr := wannaSpeakTracker.ApplyTurnToolCalls(turnToolCalls)
		if turnStateErr != nil {
			rc.pushFailed(sage, roundId, turnStateErr.Error())
			return nil, turnStateErr
		}

		if wannaSpeakTracker.IsCompletedPair() {
			appendResult := ToolContextAppendResult{}
			if len(turnToolCalls) > 0 {
				var govErr error
				appendResult, govErr = rc.executeTurnToolCallsWithGov(ctx, sessionId, roundId, sage, turnContent, reasoningContent, turnToolCalls, toolResultExecutor)
				if govErr != nil {
					rc.pushFailed(sage, roundId, govErr.Error())
					return nil, govErr
				}
				if appendResult.RequiresGovernedRetry {
					if prompt := strings.TrimSpace(appendResult.GovernedInstruction); prompt != "" {
						_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
							Role:    types.RoleSystem,
							Content: prompt,
						})
					}
					processor = utilstream.NewProcessor()
					wannaSpeakTracker = newWannaSpeakStateTracker()
					consecutiveTransitionFailures = 0
					continue
				}
				if appendResult.RequiresLinkRetry {
					if prompt := strings.TrimSpace(appendResult.LinkRetryInstruction); prompt != "" {
						_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
							Role:    types.RoleSystem,
							Content: prompt,
						})
					}
					processor = utilstream.NewProcessor()
					wannaSpeakTracker = newWannaSpeakStateTracker()
					consecutiveTransitionFailures = 0
					continue
				}
			}

			if !wannaSpeakTracker.HasCapturedContent() {
				err := fmt.Errorf("%s 已完成状态转移但缺少有效内容", config.WannaSpeakContinueToolName)
				rc.pushFailed(sage, roundId, err.Error())
				return nil, err
			}

			response, buildErr := rc.buildSageResponse(
				sessionId, roundId, sage,
				processor.GetResult(true),
				wannaSpeakTracker,
				reasoningContent,
			)
			if buildErr != nil {
				rc.pushFailed(sage, roundId, buildErr.Error())
				return nil, buildErr
			}

			msg := &types.Message{
				ID:        streamMessageID,
				Type:      types.TypeAI,
				Content:   response.Content,
				Status:    types.StatusSuccess,
				Timestamp: time.Now().UnixMilli(),
			}
			if pushErr := websocket.PushSeelReplyCompleted(websocket.RuntimeMonitorSessionID, roundId, sage.GetName(), sage.GetDisplayName(), msg); pushErr != nil {
				logging.LogWarnf("推送%s响应完成失败: %v", sage.GetDisplayName(), pushErr)
			}
			return response, nil
		}

		if len(turnToolCalls) > 0 {
			appendResult, govErr := rc.executeTurnToolCallsWithGov(ctx, sessionId, roundId, sage, turnContent, reasoningContent, turnToolCalls, toolResultExecutor)
			if govErr != nil {
				rc.pushFailed(sage, roundId, govErr.Error())
				return nil, govErr
			}
			if appendResult.RequiresGovernedRetry {
				if prompt := strings.TrimSpace(appendResult.GovernedInstruction); prompt != "" {
					_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
						Role:    types.RoleSystem,
						Content: prompt,
					})
				}
				processor = utilstream.NewProcessor()
				wannaSpeakTracker = newWannaSpeakStateTracker()
				consecutiveTransitionFailures = 0
				continue
			}
			if appendResult.RequiresLinkRetry {
				if prompt := strings.TrimSpace(appendResult.LinkRetryInstruction); prompt != "" {
					_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
						Role:    types.RoleSystem,
						Content: prompt,
					})
				}
				processor = utilstream.NewProcessor()
				wannaSpeakTracker = newWannaSpeakStateTracker()
				consecutiveTransitionFailures = 0
				continue
			}
		} else if strings.TrimSpace(turnContent) != "" {
			if !wannaSpeakTracker.IsPostStop() {
				_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
					Role:             types.RoleAssistant,
					Content:          turnContent,
					ReasoningContent: reasoningContent,
				})
			}
		} else if len(reasoningContent) > 0 {
		}

		if wannaSpeakTracker.ShouldInjectContinuationPrompt() {
			_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
				Role:    types.RoleSystem,
				Content: wannaSpeakTracker.BuildContinuationPrompt(),
			})
		}
		if options.IsExternalMessageTriggered && wannaSpeakTracker.HasNoExpressionProgress() {
			_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
				Role: types.RoleSystem,
				Content: fmt.Sprintf(
					"你还没有开始回复消息。请先调用 %s 开始表达，然后通过 %s 追加内容，最后调用 %s 结束。",
					config.WannaSpeakStartToolName,
					config.WannaSpeakContinueToolName,
					config.WannaSpeakStopToolName,
				),
			})
		}
		if len(turnToolCalls) == 0 {
			_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
				Role:    types.RoleSystem,
				Content: "本次回复未检测到工具调用。你必须调用工具才能输出内容，否则响应将被系统拒绝。",
			})
		}
		if !turnMadeProgress {
			consecutiveTransitionFailures++
		} else {
			consecutiveTransitionFailures = 0
		}
		if consecutiveTransitionFailures >= _maxConsecutiveTransitionRetry {
			err := fmt.Errorf("工具状态转移连续失败次数达到上限(%d)", _maxConsecutiveTransitionRetry)
			rc.pushFailed(sage, roundId, err.Error())
			return nil, err
		}
	}
}

func (rc *ResponseCollector) sendSageTurnMessage(
	ctx context.Context,
	sessionId, roundId string,
	sage *sages.Sage,
	modelInput string,
	options CollectResponsesOptions,
	turn int,
) (<-chan types.StreamChunk, error) {
	var streamCh <-chan types.StreamChunk
	var err error
	if turn == 0 {
		if len(options.RuntimeTools) > 0 {
			streamCh, err = sage.SendMessageWithRuntimeTools(ctx, sessionId, roundId, modelInput, options.RuntimeTools, options.RuntimeToolChoice)
		} else {
			streamCh, err = sage.SendMessage(ctx, sessionId, roundId, modelInput)
		}
	} else {
		if len(options.RuntimeTools) > 0 {
			streamCh, err = sage.SendContinuationWithRuntimeTools(ctx, sessionId, roundId, options.RuntimeTools, options.RuntimeToolChoice)
		} else {
			streamCh, err = sage.SendContinuation(ctx, sessionId, roundId)
		}
	}
	if err != nil {
		rc.pushFailed(sage, roundId, err.Error())
		return nil, fmt.Errorf("发送消息失败: %w", err)
	}
	return streamCh, nil
}

func (rc *ResponseCollector) processSageStreamChunks(
	ctx context.Context,
	sage *sages.Sage,
	sessionId, roundId string,
	streamCh <-chan types.StreamChunk,
	streamMessageID string,
	processor *utilstream.Processor,
	indexOffset int,
) (*streamedToolCallCollector, string, string, error) {
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
			websocket.RuntimeMonitorSessionID, roundId, sage.GetName(), sage.GetDisplayName(),
			toolCallIndex, toolCallId, toolName, rawArguments, arguments, isComplete, detectedTime,
		); err != nil {
			logging.LogWarnf("推送工具调用检测事件失败: %v", err)
		}
	})

	var turnContent strings.Builder
	var reasoningContent strings.Builder

	idleTimer := time.NewTimer(rc.timeout)
	defer func() {
		if !idleTimer.Stop() {
			select {
			case <-idleTimer.C:
			default:
			}
		}
	}()

	for {
		select {
		case <-idleTimer.C:
			errMsg := fmt.Sprintf("贤者 %s 空闲超时（%v 内未收到响应chunk）[会话:%s 轮次:%s]",
				sage.GetDisplayName(), rc.timeout, sessionId, roundId)
			rc.pushFailed(sage, roundId, errMsg)
			return nil, "", "", errors.New(errMsg)
		case <-ctx.Done():
			errMsg := fmt.Sprintf("贤者 %s 上下文已取消: %v [会话:%s 轮次:%s]",
				sage.GetDisplayName(), ctx.Err(), sessionId, roundId)
			rc.pushFailed(sage, roundId, errMsg)
			return nil, "", "", fmt.Errorf("%s: %w", errMsg, ctx.Err())
		case chunk, ok := <-streamCh:
			if !ok {
				return turnCollector, turnContent.String(), reasoningContent.String(), nil
			}
			if !idleTimer.Stop() {
				select {
				case <-idleTimer.C:
				default:
				}
			}
			idleTimer.Reset(rc.timeout)

			if chunk.Object == "error" {
				streamErr := fmt.Errorf("流式响应错误: %s", chunk.ID)
				rc.pushFailed(sage, roundId, streamErr.Error())
				return nil, "", "", streamErr
			}
			if len(chunk.Choices) == 0 {
				continue
			}

			choice := chunk.Choices[0]
			if len(choice.Delta.ToolCalls) > 0 {
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
				if pushErr := websocket.PushSeelReplyChunk(websocket.RuntimeMonitorSessionID, roundId, sage.GetName(), sage.GetDisplayName(), msg); pushErr != nil {
					logging.LogWarnf("推送%s流式chunk失败: %v", sage.GetDisplayName(), pushErr)
				}
			}
			if choice.Delta.ReasoningContent != "" {
				reasoningContent.WriteString(choice.Delta.ReasoningContent)
			}
		}
	}
}

func checkWannaSleep(
	sage *sages.Sage,
	turnContent, reasoningContent string,
	turnToolCalls []types.ToolCall,
	streamMessageID string,
	roundId string,
) (*types.SageResponse, bool, error) {
	sleepNote, hasSleep, sleepErr := parseWannaSleepToolContent(turnToolCalls)
	if sleepErr != nil {
		if pushErr := websocket.PushSeelReplyFailed(websocket.RuntimeMonitorSessionID, roundId, sage.GetName(), sage.GetDisplayName(), sleepErr.Error()); pushErr != nil {
			logging.LogWarnf("推送%s响应失败事件失败: %v", sage.GetDisplayName(), pushErr)
		}
		return nil, false, sleepErr
	}
	if !hasSleep {
		return nil, false, nil
	}

	response := &types.SageResponse{
		Seel:                sage.GetName(),
		DisplayName:         sage.GetDisplayName(),
		UsedToolCall:        true,
		ToolCallNames:       collectToolCallNames(turnToolCalls),
		ToolArgumentsByName: collectToolArgumentsByName(turnToolCalls),
		WantsSleep:          true,
		SleepSummary:        strings.TrimSpace(sleepNote.Summary),
		SleepNote:           sleepNote,
		SkipAssistantMemory: true,
		SleepAssistantDraft: turnContent,
		SleepReasoningDraft: reasoningContent,
		SleepToolCall:       cloneWannaSleepToolCall(turnToolCalls),
	}
	msg := &types.Message{
		ID:        streamMessageID,
		Type:      types.TypeSystem,
		Content:   buildHeartbeatSleepPreview(sage.GetName(), sleepNote),
		Status:    types.StatusSuccess,
		Timestamp: time.Now().UnixMilli(),
		Meta: map[string]interface{}{
			"type": "wanna-sleep",
		},
	}
	if pushErr := websocket.PushSeelReplyCompleted(websocket.RuntimeMonitorSessionID, roundId, sage.GetName(), sage.GetDisplayName(), msg); pushErr != nil {
		logging.LogWarnf("推送%s响应完成失败: %v", sage.GetDisplayName(), pushErr)
	}
	return response, true, nil
}

func (rc *ResponseCollector) executeTurnToolCallsWithGov(
	ctx context.Context,
	sessionId, roundId string,
	sage *sages.Sage,
	turnContent, reasoningContent string,
	turnToolCalls []types.ToolCall,
	toolResultExecutor ToolCallResultExecutor,
) (ToolContextAppendResult, error) {
	appendResult := appendTurnToolCallsToContextWithExecutorContext(
		ctx,
		sessionId,
		roundId,
		sage,
		turnContent,
		reasoningContent,
		turnToolCalls,
		toolResultExecutor,
		buildWannaSpeakToolAck,
	)
	if appendResult.LostDominance {
		return appendResult, &dominantActionRevokedError{
			DominantSeelName: sage.GetName(),
			ToolName:         appendResult.GovernedToolName,
			Reason:           "行动型工具连续两次未获批准",
		}
	}
	return appendResult, nil
}

func (rc *ResponseCollector) buildSageResponse(
	sessionId, roundId string,
	sage *sages.Sage,
	result *utilstream.StreamResult,
	wannaSpeakTracker *wannaSpeakStateTracker,
	reasoningContent string,
) (*types.SageResponse, error) {
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

	if sage.GetName() == "melchior" && result.HasToolCalls {
		if args, ok := result.ToolArgumentsByName["deliberation_signal"]; ok && len(args) > 0 {
			var signal types.DeliberationSignal
			if err := json.Unmarshal([]byte(args[0]), &signal); err == nil {
				response.RequiresDeliberation = signal.RequiresDeliberation
				response.DeliberationReason = signal.Reason
				response.ProposedAction = signal.ProposedAction

				logging.LogInfof("审慎决策信号已提取: RequiresDeliberation=%v, Reason=%s, ProposedAction=%s",
					signal.RequiresDeliberation, signal.Reason, signal.ProposedAction)

				if err := websocket.PushDeliberationSignalRaised(
					websocket.RuntimeMonitorSessionID, roundId, sage.GetName(), sage.GetDisplayName(),
					signal.Reason, signal.RequiresDeliberation,
				); err != nil {
					logging.LogWarnf("推送审慎决策信号事件失败: %v", err)
				}
			} else {
				logging.LogWarnf("解析deliberation_signal参数失败: %v, args=%s", err, args[0])
			}
		}
	}

	assistantMsg := types.ContextMessage{
		Role:             types.RoleAssistant,
		Content:          response.Content,
		ReasoningContent: reasoningContent,
	}
	_ = sage.AddToContextWithSession(sessionId, assistantMsg)

	return response, nil
}

func (rc *ResponseCollector) buildToolResultExecutor(sage *sages.Sage, runtimeTools []openai.Tool) ToolCallResultExecutor {
	if sage == nil {
		return nil
	}

	effectiveTools := sage.GetTools()
	if len(runtimeTools) > 0 {
		effectiveTools = runtimeTools
	}

	var executors []ToolCallResultExecutor
	if toolSetHasAllFunctionTools(effectiveTools, config.NoteKeywordSearchToolName) {
		noteExecutor := newNoteKeywordToolResultExecutor()
		executors = append(executors, noteExecutor.ExecuteToolCall)
	}
	if toolSetHasAllFunctionTools(
		effectiveTools,
		config.ForgeDevRepoListToolName,
		config.ForgeDevRepoReadToolName,
		config.ForgeDevRepoSearchToolName,
	) {
		forgeExecutor := newForgeDevRepoToolResultExecutor()
		executors = append(executors, forgeExecutor.ExecuteToolCall)
	}
	if toolSetHasAllFunctionTools(effectiveTools, config.WriteDiaryToolName) {
		diaryExecutor := newDiaryToolResultExecutor()
		executors = append(executors, diaryExecutor.ExecuteToolCall)
	}
	if toolSetHasAllFunctionTools(effectiveTools, config.SendChannelMessageToolName) {
		channelMsgExecutor := newSendChannelMessageResultExecutor()
		executors = append(executors, channelMsgExecutor.ExecuteToolCall)
	}
	if toolSetHasAllFunctionTools(effectiveTools, config.NoteByIDReadToolName) {
		noteReadExecutor := newNoteByIDReadToolResultExecutor()
		executors = append(executors, noteReadExecutor.ExecuteToolCall)
	}
	if toolSetHasAllFunctionTools(effectiveTools, config.FetchWebPageToolName) {
		webFetchExecutor := newWebFetchToolResultExecutor()
		executors = append(executors, webFetchExecutor.ExecuteToolCall)
	}
	if toolSetHasAllFunctionTools(effectiveTools, config.CreateNoteDocumentToolName) {
		noteEditExecutor := newNoteEditToolResultExecutor()
		executors = append(executors, noteEditExecutor.ExecuteToolCall)
	}
	if toolSetHasAllFunctionTools(effectiveTools, config.AvatarBuildToolName) {
		avatarExecutor := newAvatarToolResultExecutor()
		executors = append(executors, avatarExecutor.ExecuteToolCall)
	}
	if toolSetHasAllFunctionTools(effectiveTools, config.PersistSessionMemoryToolName, config.RecallCrossSessionMemoriesToolName) {
		crossSessionExecutor := newCrossSessionMemoryToolExecutor(sage.GetName())
		executors = append(executors, crossSessionExecutor.ExecuteToolCall)
	}
	if len(executors) == 0 {
		return nil
	}

	return func(toolCall types.ToolCall) (string, bool, error) {
		for _, executor := range executors {
			result, handled, err := executor(toolCall)
			if handled {
				return result, true, err
			}
		}
		return "", false, nil
	}
}

func (rc *ResponseCollector) pushFailed(sage *sages.Sage, roundId, errMsg string) {
	if pushErr := websocket.PushSeelReplyFailed(websocket.RuntimeMonitorSessionID, roundId, sage.GetName(), sage.GetDisplayName(), errMsg); pushErr != nil {
		logging.LogWarnf("推送%s响应失败事件失败: %v", sage.GetDisplayName(), pushErr)
	}
}
