// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package api

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/siyuan-note/siyuan/kernel/agent"
)

const (
	agentSessionEventReplayLimit = 512
	agentSessionEventBufferSize  = 256
)

type agentSessionEvent struct {
	SessionID string
	EventSeq  int64
	Timestamp int64
	Type      string
	Data      map[string]any
}

func (event agentSessionEvent) MarshalJSON() ([]byte, error) {
	payload := make(map[string]any, len(event.Data)+4)
	for key, value := range event.Data {
		payload[key] = value
	}
	payload["sessionID"] = event.SessionID
	payload["eventSeq"] = event.EventSeq
	payload["timestamp"] = event.Timestamp
	payload["type"] = event.Type
	return json.Marshal(payload)
}

type agentSessionEventSubscriber struct {
	id   int64
	ch   chan agentSessionEvent
	done chan struct{}
}

type agentSessionEventHub struct {
	mu                       sync.Mutex
	sessionID                string
	nextSeq                  int64
	nextSubID                int64
	replayLimit              int
	replay                   []agentSessionEvent
	subscribers              map[int64]*agentSessionEventSubscriber
	onSubscriberCountChanged func(int)
}

func newAgentSessionEventHub(sessionID string) *agentSessionEventHub {
	return &agentSessionEventHub{
		sessionID:   sessionID,
		replayLimit: agentSessionEventReplayLimit,
		subscribers: map[int64]*agentSessionEventSubscriber{},
	}
}

func (hub *agentSessionEventHub) publish(eventType string, data map[string]any) agentSessionEvent {
	hub.mu.Lock()
	event, countChanged := hub.publishLocked(eventType, data)
	count := len(hub.subscribers)
	callback := hub.onSubscriberCountChanged
	hub.mu.Unlock()
	if countChanged && callback != nil {
		callback(count)
	}
	return event
}

func (hub *agentSessionEventHub) publishLocked(eventType string, data map[string]any) (agentSessionEvent, bool) {
	hub.nextSeq++
	event := agentSessionEvent{
		SessionID: hub.sessionID,
		EventSeq:  hub.nextSeq,
		Timestamp: time.Now().UnixMilli(),
		Type:      eventType,
		Data:      cloneAgentEventData(data),
	}
	hub.replay = append(hub.replay, event)
	if limit := hub.replayLimit; limit > 0 && len(hub.replay) > limit {
		hub.replay = append([]agentSessionEvent(nil), hub.replay[len(hub.replay)-limit:]...)
	}
	countChanged := false
	for id, subscriber := range hub.subscribers {
		select {
		case subscriber.ch <- event:
		default:
			delete(hub.subscribers, id)
			countChanged = true
			close(subscriber.done)
			close(subscriber.ch)
		}
	}
	return event, countChanged
}

func cloneAgentEventData(data map[string]any) map[string]any {
	if len(data) == 0 {
		return map[string]any{}
	}
	encoded, err := json.Marshal(data)
	if err != nil {
		ret := make(map[string]any, len(data))
		for key, value := range data {
			ret[key] = value
		}
		return ret
	}
	var ret map[string]any
	if json.Unmarshal(encoded, &ret) != nil {
		return map[string]any{}
	}
	return ret
}

func (hub *agentSessionEventHub) publishAgentEvent(event agent.AgentEvent) {
	eventType, data := agentEventPayload(event)
	if eventType == "" {
		return
	}
	hub.publish(eventType, data)
}

func (hub *agentSessionEventHub) subscribe(ctx context.Context, after int64) (<-chan agentSessionEvent, func()) {
	hub.mu.Lock()
	replayAfter := after
	// 初次连接从最近一次 canonical commit 之后开始，避免把已落盘 turn 的历史事件重复投影。
	if replayAfter == 0 {
		for _, event := range hub.replay {
			if event.Type == "turn_committed" {
				replayAfter = event.EventSeq
			}
		}
	}
	hub.nextSubID++
	subscriber := &agentSessionEventSubscriber{
		id:   hub.nextSubID,
		ch:   make(chan agentSessionEvent, hub.replayLimit+agentSessionEventBufferSize),
		done: make(chan struct{}),
	}
	if len(hub.replay) == 0 && replayAfter > hub.nextSeq {
		// 执行器回收或进程重启后内存 replay 为空；沿用客户端游标并明确要求权威重同步，
		// 避免新的 session_state 从较小序号开始而被前端当作迟到事件丢弃。
		hub.nextSeq = replayAfter + 1
		subscriber.ch <- agentSessionEvent{
			SessionID: hub.sessionID,
			EventSeq:  hub.nextSeq,
			Timestamp: time.Now().UnixMilli(),
			Type:      "resync_required",
			Data:      map[string]any{"reason": "event_history_unavailable"},
		}
	}
	if len(hub.replay) > 0 && replayAfter < hub.replay[0].EventSeq-1 {
		resync := agentSessionEvent{
			SessionID: hub.sessionID,
			// resync_required 仅属于当前订阅者；使用 after+1 保持该连接的 SSE ID 单调，
			// 后续保留窗口仍沿用会话级序号。
			EventSeq:  replayAfter + 1,
			Timestamp: time.Now().UnixMilli(),
			Type:      "resync_required",
			Data:      map[string]any{"oldestEventSeq": hub.replay[0].EventSeq},
		}
		subscriber.ch <- resync
	}
	for _, event := range hub.replay {
		if event.EventSeq > replayAfter {
			subscriber.ch <- event
		}
	}
	hub.subscribers[subscriber.id] = subscriber
	count := len(hub.subscribers)
	callback := hub.onSubscriberCountChanged
	hub.mu.Unlock()
	if callback != nil {
		callback(count)
	}

	var once sync.Once
	unsubscribe := func() {
		once.Do(func() {
			hub.mu.Lock()
			changed := false
			if current := hub.subscribers[subscriber.id]; current == subscriber {
				delete(hub.subscribers, subscriber.id)
				close(subscriber.done)
				close(subscriber.ch)
				changed = true
			}
			count := len(hub.subscribers)
			callback := hub.onSubscriberCountChanged
			hub.mu.Unlock()
			if changed && callback != nil {
				callback(count)
			}
		})
	}
	go func() {
		select {
		case <-ctx.Done():
			unsubscribe()
		case <-subscriber.done:
		}
	}()
	return subscriber.ch, unsubscribe
}

func (hub *agentSessionEventHub) setSubscriberCountChanged(callback func(int)) {
	hub.mu.Lock()
	hub.onSubscriberCountChanged = callback
	hub.mu.Unlock()
}

func (hub *agentSessionEventHub) subscriberCount() int {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	return len(hub.subscribers)
}

func writeAgentSessionSSE(c *gin.Context, event agentSessionEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(c.Writer, "id:%d\nevent:%s\ndata:%s\n\n", event.EventSeq, event.Type, data)
	return err
}

type agentEventProjector func(event agent.AgentEvent) map[string]any

var (
	agentEventProjectorsMu sync.RWMutex
	agentEventProjectors   = map[string]agentEventProjector{}
)

func registerAgentEventProjector(eventType string, projector agentEventProjector) {
	if eventType == "" || projector == nil {
		return
	}
	agentEventProjectorsMu.Lock()
	agentEventProjectors[eventType] = projector
	agentEventProjectorsMu.Unlock()
}

func agentEventPayload(event agent.AgentEvent) (string, map[string]any) {
	agentEventProjectorsMu.RLock()
	projector := agentEventProjectors[event.Type]
	agentEventProjectorsMu.RUnlock()
	if projector == nil {
		return "", nil
	}
	return event.Type, projector(event)
}

func init() {
	registerAgentEventProjector("turn", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"turnID": event.TurnID}
	})
	registerAgentEventProjector("content", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"token": event.Token, "turnID": event.TurnID}
	})
	registerAgentEventProjector("thinking", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"reasoning": event.Reasoning, "turnID": event.TurnID}
	})
	registerAgentEventProjector("reasoning", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"token": event.Token, "turnID": event.TurnID}
	})
	registerAgentEventProjector("confirm", func(event agent.AgentEvent) map[string]any {
		return map[string]any{
			"name": event.Name, "arguments": event.Arguments, "confirmID": event.ConfirmID,
			"callID": event.CallID, "effects": event.Effects, "forcedConfirm": event.ForcedConfirm,
			"capabilityID": event.CapabilityID, "turnID": event.TurnID,
		}
	})
	registerAgentEventProjector("confirm_resolved", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"name": event.Name, "confirmID": event.ConfirmID, "callID": event.CallID,
			"status": event.Status, "message": event.Message, "turnID": event.TurnID}
	})
	registerAgentEventProjector("tool_call", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"name": event.Name, "arguments": event.Arguments, "callID": event.CallID, "turnID": event.TurnID}
	})
	registerAgentEventProjector("tool_progress", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"name": event.Name, "callID": event.CallID, "progress": event.ToolProgress, "turnID": event.TurnID}
	})
	registerAgentEventProjector("tool_result", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"name": event.Name, "result": event.Result, "callID": event.CallID, "turnID": event.TurnID}
	})
	registerAgentEventProjector("error", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"message": event.Error, "turnID": event.TurnID}
	})
	registerAgentEventProjector("usage", func(event agent.AgentEvent) map[string]any {
		return map[string]any{
			"promptTokens": event.PromptTokens, "completionTokens": event.CompletionTokens,
			"lastPromptTokens": event.LastPromptTokens, "tokenBreakdown": event.TokenBreakdown,
			"cachedTokens": event.CachedTokens, "contextLimit": event.ContextLimit, "turnID": event.TurnID,
		}
	})
	registerAgentEventProjector("done", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"turnID": event.TurnID}
	})
	registerAgentEventProjector("retry", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"attempt": event.RetryAttempt, "maxRetries": event.RetryMax, "turnID": event.TurnID}
	})
	registerAgentEventProjector("question", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"questionID": event.QuestionID, "callID": event.CallID,
			"arguments": event.Arguments, "turnID": event.TurnID}
	})
	registerAgentEventProjector("question_resolved", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"questionID": event.QuestionID, "callID": event.CallID, "status": event.Status,
			"message": event.Message, "answers": event.Answers, "turnID": event.TurnID}
	})
	registerAgentEventProjector("frontend_tool_call", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"callID": event.CallID, "name": event.Name, "arguments": event.Arguments, "turnID": event.TurnID}
	})
	registerAgentEventProjector("frontend_tool_resolved", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"callID": event.CallID, "status": event.Status,
			"message": event.Message, "turnID": event.TurnID}
	})
	registerAgentEventProjector("browser_capability_call", func(event agent.AgentEvent) map[string]any {
		return map[string]any{
			"callID": event.CallID, "name": event.Name, "capabilityID": event.CapabilityID,
			"generation": event.Generation, "arguments": event.Arguments, "turnID": event.TurnID,
		}
	})
	registerAgentEventProjector(agent.AgentEventPermission, func(event agent.AgentEvent) map[string]any {
		return map[string]any{"permissionMode": event.PermissionMode, "turnID": event.TurnID}
	})
	registerAgentEventProjector("snapshot", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"snapshotID": event.SnapshotID, "turnID": event.TurnID}
	})
	registerAgentEventProjector("turn_phase", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"turnID": event.TurnID, "phase": event.Phase}
	})
	registerAgentEventProjector("steer_injected", func(event agent.AgentEvent) map[string]any {
		return map[string]any{
			"turnID": event.TurnID, "inputID": event.InputID, "userEntryID": event.UserEntryID,
			"content": event.Content, "blockHTML": event.BlockHTML,
			"references": event.References, "editorContext": event.EditorContext,
		}
	})
	registerAgentEventProjector("interrupted", func(event agent.AgentEvent) map[string]any {
		return map[string]any{"turnID": event.TurnID, "message": event.Error}
	})
}
