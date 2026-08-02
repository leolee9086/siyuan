package coordinator

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/observability"
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
	replyStream := newReplyToolStreamProjector(options.ReplyStreamObserver)
	wannaSpeakTracker := newWannaSpeakStateTracker()
	toolResultExecutor := rc.buildToolResultExecutor(sage, options.RuntimeTools)
	streamMessageID := fmt.Sprintf("%s-%s-stream", roundId, sage.GetName())
	indexOffset := 0
	consecutiveTransitionFailures := 0
	repetitiveCallTracker := newRepetitiveCallTracker()
	hbInvestigated := false
	hbActionToolUsed := false
	requireActionTool := false
	workLogToolAdded := false
	todoUnchangedPromptAdded := false
	for _, t := range options.RuntimeTools {
		if isHeartbeatActionTool(strings.TrimSpace(t.Function.Name)) {
			requireActionTool = true
			break
		}
	}

	// 主导AI开始输出前排 #todo# 快照 A
	var preTodoBlocks []*model.Block
	if options.AllowWannaSleep && !options.IsSleepMode && requireActionTool {
		preTodoBlocks, _, _, _, _ = runNoteKeywordFullTextSearch(`"#todo#"`, 50)
	}

	for turn := 0; turn < maxTotalTurns; turn++ {
		streamCh, err := rc.sendSageTurnMessage(ctx, sessionId, roundId, sage, modelInput, options, turn)
		if err != nil {
			return nil, err
		}

		turnCollector, turnContent, reasoningContent, err := rc.processSageStreamChunks(ctx, sage, sessionId, roundId, streamCh, streamMessageID, processor, replyStream, indexOffset)
		if err != nil {
			return nil, err
		}

		indexOffset += _toolIndexStride
		turnToolCalls := turnCollector.BuildSorted()

		switch result := repetitiveCallTracker.Record(turnToolCalls); result {
		case RecordNudge:
			fp := repetitiveCallTracker.BuildFingerprint(turnToolCalls)
			logging.LogWarnf("贤者 %s 连续 %d 轮调用相同工具 (%s)，注入提示 [会话:%s 轮次:%s]",
				sage.GetDisplayName(), maxConsecutiveToolCallNudge, fp, sessionId, roundId)
			_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
				Role: types.RoleUser,
				Content: fmt.Sprintf(
					"[系统提示] 你已经连续 %d 轮调用相同工具 (%s) 但未取得实质进展。请停止重复调用，根据已有信息直接输出回复。",
					maxConsecutiveToolCallNudge, fp,
				),
			})
			processor = utilstream.NewProcessor()
			wannaSpeakTracker = newWannaSpeakStateTracker()
			consecutiveTransitionFailures = 0
			continue
		case RecordStop:
			fp := repetitiveCallTracker.BuildFingerprint(turnToolCalls)
			logging.LogWarnf("贤者 %s 达到循环上限(%s)，终止本轮 [会话:%s 轮次:%s]",
				sage.GetDisplayName(), fp, sessionId, roundId)
			rc.pushFailed(sage, roundId, fmt.Sprintf("循环检测上限(%s)，终止", fp))
			return nil, fmt.Errorf("贤者 %s 循环检测上限(%s)，终止",
				sage.GetDisplayName(), fp)
		}

		if options.AllowWannaSleep {
			for _, tc := range turnToolCalls {
				if !hbInvestigated && isInvestigationTool(strings.TrimSpace(tc.Function.Name)) {
					hbInvestigated = true
				}
				if !hbActionToolUsed && isHeartbeatActionTool(strings.TrimSpace(tc.Function.Name)) {
					hbActionToolUsed = true
				}
			}

			if !options.IsSleepMode && !workLogToolAdded && hbInvestigated && (!requireActionTool || hbActionToolUsed) {
				if requireActionTool && len(preTodoBlocks) > 0 {
					curBlocks, _, _, _, _ := runNoteKeywordFullTextSearch(`"#todo#"`, 50)
					preFP := computeTodoFP(preTodoBlocks)
					curFP := computeTodoFP(curBlocks)

					if curFP == preFP {
						// 提示一旦进入历史，后续重试仍然可见；重复追加只会线性膨胀上下文。
						if !todoUnchangedPromptAdded {
							_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
								Role:    types.RoleUser,
								Content: "[系统提示] 本轮 #todo# 无任何变化，必须在笔记中标记完成或新增待办,使得#todo#标签搜索结果发生变化后才能进入工作日志。",
							})
							todoUnchangedPromptAdded = true
						}
						continue
					}

					if diff := countBlockDiff(preTodoBlocks, curBlocks); diff > maxTodoChurnPerRound {
						_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
							Role:    types.RoleUser,
							Content: fmt.Sprintf("[系统提示] 本轮 #todo# 变化较多（%d 个块），请注意收敛操作范围。", diff),
						})
					}
				}
				options.RuntimeTools = append(options.RuntimeTools, buildWorkLogRestToolForSage(sage.GetName()))
				workLogToolAdded = true
			}

			resp, found, err := checkWannaDowntime(sage, turnContent, reasoningContent, turnToolCalls, streamMessageID, roundId)
			if err != nil {
				return nil, err
			}
			if found {
				if !options.IsSleepMode && resp.WantsDowntime && isAnyWannaRestTool(turnToolCalls) {
					novel, msg := rc.workLogHistory.isNovel(sessionId, sage.GetName(), resp.DowntimeSummary)
					if !novel {
						_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
							Role:    types.RoleUser,
							Content: "[系统提示] " + msg,
						})
						continue
					}
				}
				return resp, nil
			}
		}

		turnMadeProgress, turnStateErr := wannaSpeakTracker.ApplyTurnToolCalls(turnToolCalls)
		if turnStateErr != nil {
			if wannaSpeakTracker.IsPhaseCompleted() {
				rc.pushFailed(sage, roundId, turnStateErr.Error())
				return nil, turnStateErr
			}
			consecutiveTransitionFailures++
			if consecutiveTransitionFailures >= _maxConsecutiveTransitionRetry {
				err := fmt.Errorf("工具状态转移连续失败次数达到上限(%d): %v", _maxConsecutiveTransitionRetry, turnStateErr)
				rc.pushFailed(sage, roundId, err.Error())
				return nil, err
			}
			correctionPrompt := fmt.Sprintf(
				"状态转移错误：%s\n请重新按顺序执行：先调用 %s，再调用 %s 追加内容，最后调用 %s。",
				turnStateErr.Error(),
				config.WannaSpeakStartToolName,
				config.WannaSpeakContinueToolName,
				config.WannaSpeakStopToolName,
			)
			_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
				Role:    types.RoleUser,
				Content: correctionPrompt,
			})
			processor = utilstream.NewProcessor()
			wannaSpeakTracker = newWannaSpeakStateTracker()
			continue
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
							Role:    types.RoleUser,
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
							Role:    types.RoleUser,
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

			streamResult := processor.GetResult(true)
			// 单工具路由：processor 累积的是 magi_tool 形式，解析回真实工具名后上层才能按真实名查找。
			// 解析失败必须报错终止（静默跳过会导致参数丢失、上层按真实名找不到工具）。
			if resolveErr := llm.ResolveStreamResultMagiTools(streamResult); resolveErr != nil {
				rc.pushFailed(sage, roundId, resolveErr.Error())
				return nil, resolveErr
			}
			response, buildErr := rc.buildSageResponse(
				sessionId, roundId, sage,
				streamResult,
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
				Meta:      webSearchMetaFromSage(sage, sessionId),
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
						Role:    types.RoleUser,
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
						Role:    types.RoleUser,
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
				Role:    types.RoleUser,
				Content: wannaSpeakTracker.BuildContinuationPrompt(),
			})
		}
		if options.IsExternalMessageTriggered && wannaSpeakTracker.HasNoExpressionProgress() {
			_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
				Role: types.RoleUser,
				Content: fmt.Sprintf(
					"你还没有开始回复消息。当前状态下,你所说的任何内容都不会发送给外界,如果你要回复消息,请先调用 %s 开始表达，然后通过 %s 追加内容，最后调用 %s 结束。",
					config.WannaSpeakStartToolName,
					config.WannaSpeakContinueToolName,
					config.WannaSpeakStopToolName,
				),
			})
		}
		if len(turnToolCalls) == 0 {
			_ = sage.AddToContextWithSession(sessionId, types.ContextMessage{
				Role:    types.RoleUser,
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
	logging.LogWarnf("贤者 %s 达到最大轮次上限(%d)，终止 [会话:%s 轮次:%s]",
		sage.GetDisplayName(), maxTotalTurns, sessionId, roundId)
	rc.pushFailed(sage, roundId, fmt.Sprintf("达到最大轮次上限(%d)，终止", maxTotalTurns))
	return nil, fmt.Errorf("贤者 %s 达到最大轮次上限(%d)，终止",
		sage.GetDisplayName(), maxTotalTurns)
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
	replyStream *replyToolStreamProjector,
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
				for _, delta := range choice.Delta.ToolCalls {
					call, exists := turnCollector.Get(delta.Index)
					if !exists {
						continue
					}
					if err := replyStream.update(indexOffset+delta.Index, call.Function.Name, call.Function.Arguments); err != nil {
						rc.pushFailed(sage, roundId, err.Error())
						return nil, "", "", err
					}
				}
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

func checkWannaDowntime(
	sage *sages.Sage,
	turnContent, reasoningContent string,
	turnToolCalls []types.ToolCall,
	streamMessageID string,
	roundId string,
) (*types.SageResponse, bool, error) {
	downtimeNote, hasDowntime, downtimeErr := parseWannaDowntimeToolContent(turnToolCalls)
	if downtimeErr != nil {
		if pushErr := websocket.PushSeelReplyFailed(websocket.RuntimeMonitorSessionID, roundId, sage.GetName(), sage.GetDisplayName(), downtimeErr.Error()); pushErr != nil {
			logging.LogWarnf("推送%s响应失败事件失败: %v", sage.GetDisplayName(), pushErr)
		}
		return nil, false, downtimeErr
	}
	if !hasDowntime {
		return nil, false, nil
	}

	response := &types.SageResponse{
		Seel:                   sage.GetName(),
		DisplayName:            sage.GetDisplayName(),
		UsedToolCall:           true,
		ToolCallNames:          collectToolCallNames(turnToolCalls),
		ToolArgumentsByName:    collectToolArgumentsByName(turnToolCalls),
		WantsDowntime:          true,
		DowntimeSummary:        strings.TrimSpace(downtimeNote.Summary),
		DowntimeNote:           downtimeNote,
		SkipAssistantMemory:    true,
		DowntimeAssistantDraft: turnContent,
		DowntimeReasoningDraft: reasoningContent,
		DowntimeToolCall:       cloneWannaDowntimeToolCall(turnToolCalls),
	}
	isRest := false
	for _, tc := range turnToolCalls {
		if config.IsWannaRestToolName(strings.TrimSpace(tc.Function.Name)) {
			isRest = true
			break
		}
	}
	metaType := "wanna-sleep"
	if isRest {
		metaType = "wanna-rest"
	}
	msg := &types.Message{
		ID:        streamMessageID,
		Type:      types.TypeSystem,
		Content:   buildHeartbeatDowntimePreview(sage.GetName(), downtimeNote, isRest),
		Status:    types.StatusSuccess,
		Timestamp: time.Now().UnixMilli(),
		Meta: map[string]interface{}{
			"type": metaType,
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

				logging.LogInfof("审慎决策信号已提取: requiresDeliberation=%v", signal.RequiresDeliberation)
				observability.Detailf("审慎决策信号: requiresDeliberation=%v reason=%s proposedAction=%s",
					signal.RequiresDeliberation, signal.Reason, signal.ProposedAction)

				if err := websocket.PushDeliberationSignalRaised(
					websocket.RuntimeMonitorSessionID, roundId, sage.GetName(), sage.GetDisplayName(),
					signal.Reason, signal.RequiresDeliberation,
				); err != nil {
					logging.LogWarnf("推送审慎决策信号事件失败: %v", err)
				}
			} else {
				logging.LogWarnf("解析deliberation_signal参数失败: %v, argsLength=%d", err, len(args[0]))
				observability.Detailf("解析deliberation_signal参数失败: error=%v args=%s", err, args[0])
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
	if toolSetHasAllFunctionTools(effectiveTools, config.SearchWebToolName, config.InspectWebSearchEnginesToolName) {
		webSearchExecutor := newWebSearchToolResultExecutor()
		executors = append(executors, webSearchExecutor.ExecuteToolCall)
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
	if toolSetHasAllFunctionTools(effectiveTools, config.ListMagiChannelsToolName) {
		chListExecutor := newListMagiChannelsResultExecutor()
		executors = append(executors, chListExecutor.ExecuteToolCall)
	}
	if toolSetHasAllFunctionTools(effectiveTools, config.ListMagiContactsToolName) {
		contactListExecutor := newListMagiContactsResultExecutor()
		executors = append(executors, contactListExecutor.ExecuteToolCall)
	}
	if toolSetHasAllFunctionTools(effectiveTools, config.FetchChannelMessagesToolName) {
		fetchMsgExecutor := newFetchChannelMessagesResultExecutor()
		executors = append(executors, fetchMsgExecutor.ExecuteToolCall)
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

const maxTodoChurnPerRound = 5

func computeTodoFP(blocks []*model.Block) string {
	type entry struct {
		id      string
		updated string
	}
	entries := make([]entry, 0, len(blocks))
	for _, b := range blocks {
		if b != nil && b.ID != "" {
			entries = append(entries, entry{id: b.ID, updated: b.Updated})
		}
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].id < entries[j].id })
	var sb strings.Builder
	for i, e := range entries {
		if i > 0 {
			sb.WriteByte(',')
		}
		sb.WriteString(e.id)
		sb.WriteByte(':')
		sb.WriteString(e.updated)
	}
	return sb.String()
}

func countBlockDiff(before, after []*model.Block) int {
	bm := make(map[string]string, len(before))
	for _, b := range before {
		if b != nil {
			bm[b.ID] = b.Updated
		}
	}
	am := make(map[string]string, len(after))
	for _, b := range after {
		if b != nil {
			am[b.ID] = b.Updated
		}
	}
	diff := 0
	for id, up := range bm {
		aup, ok := am[id]
		if !ok || aup != up {
			diff++
		}
	}
	for id := range am {
		if _, ok := bm[id]; !ok {
			diff++
		}
	}
	return diff
}
