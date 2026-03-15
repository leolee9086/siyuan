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
	"fmt"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

// 事件类型常量
const (
	EventRoundStarted              = "ROUND_STARTED"
	EventLLMRequestSent            = "LLM_REQUEST_SENT"
	EventSeelReplyStarted          = "SEEL_REPLY_STARTED"
	EventSeelReplyChunk            = "SEEL_REPLY_CHUNK"
	EventSeelReplyCompleted        = "SEEL_REPLY_COMPLETED"
	EventSeelReplyFailed           = "SEEL_REPLY_FAILED"
	EventSeelVoteUpdated           = "SEEL_VOTE_UPDATED"
	EventTrinitySynthesisCompleted = "TRINITY_SYNTHESIS_COMPLETED"
	EventConsensusEmitted          = "CONSENSUS_EMITTED"
	EventRoundFailed               = "ROUND_FAILED"
	EventToolCallDetected          = "TOOL_CALL_DETECTED"
	EventDeliberationSignalRaised  = "DELIBERATION_SIGNAL_RAISED"
)

var (
	globalSeq    int64 = 0
	globalPusher       = NewPusher()
)

// generateEventID 生成事件ID
func generateEventID() string {
	globalSeq++
	return fmt.Sprintf("magi-event-%d-%d", time.Now().UnixMilli(), globalSeq)
}

// PushRoundStarted 推送轮次开始事件
func PushRoundStarted(sessionId, roundId, userInput string) error {
	data := map[string]interface{}{
		"eventId":   generateEventID(),
		"seq":       globalSeq,
		"roundId":   roundId,
		"timestamp": time.Now().UnixMilli(),
		"userInput": userInput,
	}
	return globalPusher.Push(sessionId, EventRoundStarted, data)
}

// PushLLMRequestSent 推送LLM请求发送事件
func PushLLMRequestSent(sessionId, roundId, seelName, displayName, model string, messages []types.ContextMessage, toolCount int) error {
	data := map[string]interface{}{
		"eventId":     generateEventID(),
		"seq":         globalSeq,
		"roundId":     roundId,
		"timestamp":   time.Now().UnixMilli(),
		"seelName":    seelName,
		"displayName": displayName,
		"model":       model,
		"messages":    messages,
		"toolCount":   toolCount,
	}
	return globalPusher.Push(sessionId, EventLLMRequestSent, data)
}

// PushSeelReplyStarted 推送贤者开始响应事件
func PushSeelReplyStarted(sessionId, roundId, seelName, displayName, userInput string, streamMessage *types.Message) error {
	data := map[string]interface{}{
		"eventId":       generateEventID(),
		"seq":           globalSeq,
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
	data := map[string]interface{}{
		"eventId":     generateEventID(),
		"seq":         globalSeq,
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
	data := map[string]interface{}{
		"eventId":     generateEventID(),
		"seq":         globalSeq,
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
	data := map[string]interface{}{
		"eventId":     generateEventID(),
		"seq":         globalSeq,
		"roundId":     roundId,
		"timestamp":   time.Now().UnixMilli(),
		"seelName":    seelName,
		"displayName": displayName,
		"error":       errorMsg,
	}
	return globalPusher.Push(sessionId, EventSeelReplyFailed, data)
}

// PushVotingStart 推送投票开始事件
func PushVotingStart(sessionId, roundId, proposedAction string, round int) error {
	data := map[string]interface{}{
		"eventId":        generateEventID(),
		"seq":            globalSeq,
		"roundId":        roundId,
		"timestamp":      time.Now().UnixMilli(),
		"progress":       0,
		"proposedAction": proposedAction,
		"round":          round,
	}
	return globalPusher.Push(sessionId, EventSeelVoteUpdated, data)
}

// PushVotingProgress 推送单个贤者投票完成事件
func PushVotingProgress(sessionId, roundId, seelName, displayName string, decision types.VoteDecision, progress int) error {
	data := map[string]interface{}{
		"eventId":     generateEventID(),
		"seq":         globalSeq,
		"roundId":     roundId,
		"timestamp":   time.Now().UnixMilli(),
		"seelName":    seelName,
		"displayName": displayName,
		"decision":    string(decision),
		"progress":    progress,
	}
	return globalPusher.Push(sessionId, EventSeelVoteUpdated, data)
}

// VoteDetail 投票详情
type VoteDetail struct {
	Name     string `json:"name"`
	Decision string `json:"decision"`
}

// PushVotingResult 推送投票结果汇总事件
func PushVotingResult(sessionId, roundId string, details []VoteDetail, deliberationInitiator, deliberationReason string) error {
	data := map[string]interface{}{
		"eventId":   generateEventID(),
		"seq":       globalSeq,
		"roundId":   roundId,
		"timestamp": time.Now().UnixMilli(),
		"progress":  100,
		"details":   details,
	}
	if deliberationInitiator != "" {
		data["deliberationInitiator"] = deliberationInitiator
		logging.LogInfof("PushVotingResult: 包含审慎决策发起者=%s", deliberationInitiator)
	}
	if deliberationReason != "" {
		data["deliberationReason"] = deliberationReason
		logging.LogInfof("PushVotingResult: 包含审慎决策原因=%s", deliberationReason)
	}
	return globalPusher.Push(sessionId, EventSeelVoteUpdated, data)
}

// PushVotingFailed 推送投票失败事件
func PushVotingFailed(sessionId, roundId, errorMsg string, progress int) error {
	data := map[string]interface{}{
		"eventId":   generateEventID(),
		"seq":       globalSeq,
		"roundId":   roundId,
		"timestamp": time.Now().UnixMilli(),
		"error":     errorMsg,
		"progress":  progress,
	}
	return globalPusher.Push(sessionId, EventSeelVoteUpdated, data)
}

// PushTrinitySynthesisCompleted 推送Trinity统合完成事件
func PushTrinitySynthesisCompleted(sessionId, roundId, content string) error {
	data := map[string]interface{}{
		"eventId":   generateEventID(),
		"seq":       globalSeq,
		"roundId":   roundId,
		"timestamp": time.Now().UnixMilli(),
		"content":   content,
	}
	return globalPusher.Push(sessionId, EventTrinitySynthesisCompleted, data)
}

// PushConsensusEmitted 推送共识消息发出事件
func PushConsensusEmitted(sessionId, roundId string, message *types.Message) error {
	data := map[string]interface{}{
		"eventId":   generateEventID(),
		"seq":       globalSeq,
		"roundId":   roundId,
		"timestamp": time.Now().UnixMilli(),
		"message":   message,
	}
	return globalPusher.Push(sessionId, EventConsensusEmitted, data)
}

// PushRoundFailed 推送轮次失败事件
func PushRoundFailed(sessionId, roundId, errorMsg string) error {
	data := map[string]interface{}{
		"eventId":   generateEventID(),
		"seq":       globalSeq,
		"roundId":   roundId,
		"timestamp": time.Now().UnixMilli(),
		"error":     errorMsg,
	}
	return globalPusher.Push(sessionId, EventRoundFailed, data)
}

// PushToolCallDetected 推送通用工具调用检测事件
func PushToolCallDetected(sessionId, roundId, seelName, displayName, toolName string, arguments map[string]interface{}) error {
	data := map[string]interface{}{
		"eventId":     generateEventID(),
		"seq":         globalSeq,
		"roundId":     roundId,
		"timestamp":   time.Now().UnixMilli(),
		"seelName":    seelName,
		"displayName": displayName,
		"toolName":    toolName,
		"arguments":   arguments,
	}
	return globalPusher.Push(sessionId, EventToolCallDetected, data)
}

// PushDeliberationSignalRaised 推送审慎决策信号事件
func PushDeliberationSignalRaised(sessionId, roundId, initiator, displayName, reason string, requiresDeliberation bool) error {
	data := map[string]interface{}{
		"eventId":              generateEventID(),
		"seq":                  globalSeq,
		"roundId":              roundId,
		"timestamp":            time.Now().UnixMilli(),
		"initiator":            initiator,
		"displayName":          displayName,
		"reason":               reason,
		"requiresDeliberation": requiresDeliberation,
	}
	return globalPusher.Push(sessionId, EventDeliberationSignalRaised, data)
}
