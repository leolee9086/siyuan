// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package websocket

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync/atomic"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/observability"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

// 事件类型常量
const (
	EventRoundStarted               = "ROUND_STARTED"
	EventLLMRequestSent             = "LLM_REQUEST_SENT"
	EventSeelReplyStarted           = "SEEL_REPLY_STARTED"
	EventSeelReplyChunk             = "SEEL_REPLY_CHUNK"
	EventSeelReplyCompleted         = "SEEL_REPLY_COMPLETED"
	EventSeelReplyFailed            = "SEEL_REPLY_FAILED"
	EventSeelVoteUpdated            = "SEEL_VOTE_UPDATED"
	EventDominantSynthesisCompleted = "DOMINANT_SYNTHESIS_COMPLETED"
	EventConsensusEmitted           = "CONSENSUS_EMITTED"
	EventRoundFailed                = "ROUND_FAILED"
	EventRoundCancelled             = "ROUND_CANCELLED"
	EventToolCallDetected           = "TOOL_CALL_DETECTED"
	EventSeelToolActivityUpdated    = "SEEL_TOOL_ACTIVITY_UPDATED"
	EventDeliberationSignalRaised   = "DELIBERATION_SIGNAL_RAISED"
	EventContextHistoryTrimmed      = "CONTEXT_HISTORY_TRIMMED"
	EventRuntimeStatusUpdated       = "RUNTIME_STATUS_UPDATED"
)

// RuntimeMonitorSessionID 是 MAGI 运行时事件监控的唯一 websocket session。
const RuntimeMonitorSessionID = "magi-main-runtime"

var (
	globalSeq    int64 = 0
	globalPusher       = NewPusher()
)

// generateEventID 生成事件ID，返回eventId和seq
func generateEventID() (string, int64) {
	newSeq := atomic.AddInt64(&globalSeq, 1)
	eventId := fmt.Sprintf("magi-event-%d-%d", time.Now().UnixMilli(), newSeq)
	return eventId, newSeq
}

// PushRoundStarted 推送轮次开始事件
func PushRoundStarted(sessionId, roundId, userInput string) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":   eventId,
		"seq":       seq,
		"roundId":   roundId,
		"timestamp": time.Now().UnixMilli(),
		"userInput": userInput,
	}
	return globalPusher.Push(sessionId, EventRoundStarted, data)
}

// PushLLMRequestSent 推送LLM请求发送事件
func PushLLMRequestSent(sessionId, roundId, seelName, displayName, model string, messages []types.ContextMessage, toolCount int) error {
	return globalPusher.Push(sessionId, EventLLMRequestSent, buildLLMRequestSentData(
		roundId,
		seelName,
		displayName,
		model,
		messages,
		toolCount,
	))
}

func buildLLMRequestSentData(
	roundId, seelName, displayName, model string,
	messages []types.ContextMessage,
	toolCount int,
) map[string]interface{} {
	eventId, seq := generateEventID()
	promptBytes := 0
	if encoded, err := json.Marshal(messages); err == nil {
		promptBytes = len(encoded)
	}
	data := map[string]interface{}{
		"eventId":      eventId,
		"seq":          seq,
		"roundId":      roundId,
		"timestamp":    time.Now().UnixMilli(),
		"seelName":     seelName,
		"displayName":  displayName,
		"model":        model,
		"messageCount": len(messages),
		"promptBytes":  promptBytes,
		"toolCount":    toolCount,
	}
	return data
}

// PushSeelReplyStarted 推送贤者开始响应事件
func PushSeelReplyStarted(sessionId, roundId, seelName, displayName, userInput string, streamMessage *types.Message) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":       eventId,
		"seq":           seq,
		"roundId":       roundId,
		"timestamp":     time.Now().UnixMilli(),
		"seelName":      seelName,
		"displayName":   displayName,
		"userInput":     userInput,
		"streamMessage": streamMessage,
	}
	return globalPusher.Push(sessionId, EventSeelReplyStarted, data)
}

// PushSeelReplyChunk 推送贤者流式chunk事件
func PushSeelReplyChunk(sessionId, roundId, seelName, displayName string, message *types.Message) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":     eventId,
		"seq":         seq,
		"roundId":     roundId,
		"timestamp":   time.Now().UnixMilli(),
		"seelName":    seelName,
		"displayName": displayName,
		"message":     message,
	}
	return globalPusher.Push(sessionId, EventSeelReplyChunk, data)
}

// PushSeelReplyCompleted 推送贤者响应完成事件
func PushSeelReplyCompleted(sessionId, roundId, seelName, displayName string, message *types.Message) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":     eventId,
		"seq":         seq,
		"roundId":     roundId,
		"timestamp":   time.Now().UnixMilli(),
		"seelName":    seelName,
		"displayName": displayName,
		"message":     message,
	}
	return globalPusher.Push(sessionId, EventSeelReplyCompleted, data)
}

// PushSeelReplyFailed 推送贤者响应失败事件
func PushSeelReplyFailed(sessionId, roundId, seelName, displayName, errorMsg string) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":     eventId,
		"seq":         seq,
		"roundId":     roundId,
		"timestamp":   time.Now().UnixMilli(),
		"seelName":    seelName,
		"displayName": displayName,
		"error":       errorMsg,
	}
	return globalPusher.Push(sessionId, EventSeelReplyFailed, data)
}

// PushVotingStart 推送投票开始事件
func PushVotingStart(
	sessionId, roundId, proposedAction string,
	round int,
	deliberationInitiator, displayName, deliberationReason string,
) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":        eventId,
		"seq":            seq,
		"roundId":        roundId,
		"timestamp":      time.Now().UnixMilli(),
		"progress":       0,
		"proposedAction": proposedAction,
		"round":          round,
	}
	if deliberationInitiator != "" {
		data["deliberationInitiator"] = deliberationInitiator
	}
	if displayName != "" {
		data["displayName"] = displayName
	}
	if deliberationReason != "" {
		data["deliberationReason"] = deliberationReason
	}
	return globalPusher.Push(sessionId, EventSeelVoteUpdated, data)
}

// PushVotingProgress 推送单个贤者投票完成事件
func PushVotingProgress(
	sessionId, roundId, seelName, displayName string,
	decision types.VoteDecision,
	decisionReason string,
	progress int,
	round int,
) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":     eventId,
		"seq":         seq,
		"roundId":     roundId,
		"timestamp":   time.Now().UnixMilli(),
		"seelName":    seelName,
		"displayName": displayName,
		"decision":    string(decision),
		"progress":    progress,
		"round":       round,
	}
	if decisionReason != "" {
		data["decisionReason"] = decisionReason
	}
	return globalPusher.Push(sessionId, EventSeelVoteUpdated, data)
}

// VoteDetail 投票详情
type VoteDetail struct {
	Name     string `json:"name"`
	Decision string `json:"decision"`
	Reason   string `json:"reason,omitempty"`
}

// PushVotingResult 推送投票结果汇总事件
func PushVotingResult(
	sessionId, roundId string,
	details []VoteDetail,
	passed bool,
	proposedAction string,
	round int,
	deliberationInitiator, deliberationReason string,
) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":   eventId,
		"seq":       seq,
		"roundId":   roundId,
		"timestamp": time.Now().UnixMilli(),
		"progress":  100,
		"details":   details,
		"passed":    passed,
		"round":     round,
	}
	if proposedAction != "" {
		data["proposedAction"] = proposedAction
	}
	if deliberationInitiator != "" {
		data["deliberationInitiator"] = deliberationInitiator
		logging.LogInfof("PushVotingResult: 包含审慎决策发起者=%s", deliberationInitiator)
	}
	if deliberationReason != "" {
		data["deliberationReason"] = deliberationReason
		observability.Detailf("PushVotingResult: deliberationReason=%s", deliberationReason)
	}
	return globalPusher.Push(sessionId, EventSeelVoteUpdated, data)
}

// PushVotingFailed 推送投票失败事件
func PushVotingFailed(sessionId, roundId, errorMsg string, progress int) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":   eventId,
		"seq":       seq,
		"roundId":   roundId,
		"timestamp": time.Now().UnixMilli(),
		"error":     errorMsg,
		"progress":  progress,
	}
	return globalPusher.Push(sessionId, EventSeelVoteUpdated, data)
}

// PushDominantSynthesisCompleted 推送主导者统合完成事件。
func PushDominantSynthesisCompleted(sessionId, roundId, content string) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":   eventId,
		"seq":       seq,
		"roundId":   roundId,
		"timestamp": time.Now().UnixMilli(),
		"content":   content,
	}
	return globalPusher.Push(sessionId, EventDominantSynthesisCompleted, data)
}

// PushConsensusEmitted 推送共识消息发出事件
func PushConsensusEmitted(sessionId, roundId string, message *types.Message) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":   eventId,
		"seq":       seq,
		"roundId":   roundId,
		"timestamp": time.Now().UnixMilli(),
		"message":   message,
	}
	return globalPusher.Push(sessionId, EventConsensusEmitted, data)
}

// PushRoundFailed 推送轮次失败事件
func PushRoundFailed(sessionId, roundId, errorMsg string) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":   eventId,
		"seq":       seq,
		"roundId":   roundId,
		"timestamp": time.Now().UnixMilli(),
		"error":     errorMsg,
	}
	return globalPusher.Push(sessionId, EventRoundFailed, data)
}

// PushRoundCancelled 推送轮次取消事件（外部消息进入导致心跳轮次被打断）。
func PushRoundCancelled(sessionId, roundId, reason string) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":   eventId,
		"seq":       seq,
		"roundId":   roundId,
		"timestamp": time.Now().UnixMilli(),
		"reason":    reason,
	}
	return globalPusher.Push(sessionId, EventRoundCancelled, data)
}

// PushRuntimeStatusUpdated 推送 MAGI 全局运行态更新事件。
func PushRuntimeStatusUpdated(sessionId string, status types.RuntimeStatus) error {
	eventId, seq := generateEventID()
	roundID := strings.TrimSpace(status.CurrentRoundID)
	if roundID == "" {
		roundID = "runtime-status"
	}
	data := map[string]interface{}{
		"eventId":           eventId,
		"seq":               seq,
		"roundId":           roundID,
		"timestamp":         time.Now().UnixMilli(),
		"state":             status.State,
		"awake":             status.Awake,
		"wakeSource":        status.WakeSource,
		"reason":            status.Reason,
		"dominantSeel":      status.DominantSeel,
		"dominantStance":    status.DominantStance,
		"dominantUpdatedAt": status.DominantUpdatedAt,
		"currentRoundId":    status.CurrentRoundID,
		"currentTask":       status.CurrentTask,
		"lastHeartbeatAt":   status.LastHeartbeatAt,
		"lastWakeAt":        status.LastWakeAt,
		"lastSleepAt":       status.LastDowntimeAt,
		"lastSleepSummary":  status.LastDowntimeSummary,
		"updatedAt":         status.UpdatedAt,
	}
	return globalPusher.Push(sessionId, EventRuntimeStatusUpdated, data)
}

// PushToolCallDetected 推送通用工具调用检测事件（支持增量参数）
func PushToolCallDetected(
	sessionId, roundId, seelName, displayName string,
	toolCallIndex int,
	toolCallId string,
	toolName string,
	rawArguments string,
	arguments map[string]interface{},
	argumentsComplete bool,
	detectedTimestamp int64,
) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":           eventId,
		"seq":               seq,
		"roundId":           roundId,
		"timestamp":         detectedTimestamp,
		"seelName":          seelName,
		"displayName":       displayName,
		"toolName":          toolName,
		"toolCallIndex":     toolCallIndex,
		"toolCallId":        toolCallId,
		"rawArguments":      rawArguments,
		"argumentsComplete": argumentsComplete,
	}
	if argumentsComplete && arguments != nil {
		data["arguments"] = arguments
	}
	return globalPusher.Push(sessionId, EventToolCallDetected, data)
}

// PushSeelToolActivityUpdated 推送可原地更新的语义工具活动，而不是流式参数的原子增量。
func PushSeelToolActivityUpdated(
	sessionId, roundId, seelName, displayName string,
	call types.ToolCall,
	phase, result, errorMessage string,
) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":       eventId,
		"seq":           seq,
		"roundId":       roundId,
		"timestamp":     time.Now().UnixMilli(),
		"seelName":      seelName,
		"displayName":   displayName,
		"toolCallIndex": call.Index,
		"toolCallId":    call.ID,
		"toolName":      call.Function.Name,
		"rawArguments":  call.Function.Arguments,
		"phase":         phase,
	}
	var arguments map[string]interface{}
	if err := json.Unmarshal([]byte(call.Function.Arguments), &arguments); err == nil {
		data["arguments"] = arguments
	}
	if result != "" {
		data["result"] = result
	}
	if errorMessage != "" {
		data["error"] = errorMessage
	}
	return globalPusher.Push(sessionId, EventSeelToolActivityUpdated, data)
}

// PushDeliberationSignalRaised 推送审慎决策信号事件
func PushDeliberationSignalRaised(sessionId, roundId, initiator, displayName, reason string, requiresDeliberation bool) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":              eventId,
		"seq":                  seq,
		"roundId":              roundId,
		"timestamp":            time.Now().UnixMilli(),
		"initiator":            initiator,
		"displayName":          displayName,
		"reason":               reason,
		"requiresDeliberation": requiresDeliberation,
	}
	return globalPusher.Push(sessionId, EventDeliberationSignalRaised, data)
}

// PushContextHistoryTrimmed 推送上下文历史裁剪事件
func PushContextHistoryTrimmed(
	sessionId, roundId, seelName, displayName string,
	beforeCount, afterCount, droppedCount int,
	strategyType string,
	strategyCount int,
	strategyPercent float64,
) error {
	eventId, seq := generateEventID()
	data := map[string]interface{}{
		"eventId":      eventId,
		"seq":          seq,
		"roundId":      roundId,
		"timestamp":    time.Now().UnixMilli(),
		"seelName":     seelName,
		"displayName":  displayName,
		"beforeCount":  beforeCount,
		"afterCount":   afterCount,
		"droppedCount": droppedCount,
	}
	if strategyType != "" {
		data["strategyType"] = strategyType
	}
	if strategyCount > 0 {
		data["strategyCount"] = strategyCount
	}
	if strategyPercent > 0 {
		data["strategyPercent"] = strategyPercent
	}
	return globalPusher.Push(sessionId, EventContextHistoryTrimmed, data)
}
