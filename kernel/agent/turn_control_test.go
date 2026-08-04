// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	openai "github.com/sashabaranov/go-openai"
	kernelConf "github.com/siyuan-note/siyuan/kernel/conf"
	mcpTools "github.com/siyuan-note/siyuan/kernel/mcp/tools"
	kernelModel "github.com/siyuan-note/siyuan/kernel/model"
)

type testTurnControl struct {
	mu           sync.Mutex
	turnID       string
	phases       []AgentTurnPhase
	finalClaims  int
	acknowledged []string
	terminated   bool
}

func (control *testTurnControl) TurnStarted(turnID string) {
	control.mu.Lock()
	control.turnID = turnID
	control.mu.Unlock()
}

func (control *testTurnControl) SetPhase(_ string, phase AgentTurnPhase) {
	control.mu.Lock()
	control.phases = append(control.phases, phase)
	control.mu.Unlock()
}

func (control *testTurnControl) ClaimSteers(_ string, final bool) ([]AgentSteerInput, error) {
	control.mu.Lock()
	defer control.mu.Unlock()
	if !final {
		return nil, nil
	}
	control.finalClaims++
	if control.finalClaims != 1 {
		return nil, nil
	}
	return []AgentSteerInput{{
		InputID:     "steer-1",
		UserEntryID: "user-steer-1",
		Content:     "please focus",
		BlockHTML:   "<p>please focus</p>",
	}}, nil
}

func (control *testTurnControl) AcknowledgeSteers(_ string, inputIDs []string, injected bool) {
	control.mu.Lock()
	defer control.mu.Unlock()
	if injected {
		control.acknowledged = append(control.acknowledged, inputIDs...)
	}
}

func (control *testTurnControl) TurnTerminated(_ string) {
	control.mu.Lock()
	control.terminated = true
	control.mu.Unlock()
}

func TestAgentChatInjectsSteerAtFinalProviderBoundary(t *testing.T) {
	useTestDataDir(t)
	originalConf := kernelModel.Conf
	kernelModel.Conf = kernelModel.NewAppConf()
	kernelModel.Conf.AI = kernelConf.NewAI()
	kernelModel.Conf.AI.MCP = nil
	kernelModel.Conf.AI.Agent.MaxToolCallRounds = 5
	kernelModel.Conf.Variables = kernelConf.NewVariables()
	t.Cleanup(func() { kernelModel.Conf = originalConf })

	session := map[string]any{
		"id":        testSessionID,
		"title":     "steer test",
		"createdAt": int64(1),
		"updatedAt": int64(1),
		"entries":   []any{map[string]any{"id": "user-1", "type": "user", "content": "hello"}},
	}
	if revision, err := SaveSession(marshalSession(t, session)); err != nil || revision != 1 {
		t.Fatalf("save initial session: revision=%d err=%v", revision, err)
	}

	var requestMu sync.Mutex
	requests := make([]openai.ChatCompletionRequest, 0, 2)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request openai.ChatCompletionRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode request: %v", err)
			return
		}
		requestMu.Lock()
		requests = append(requests, request)
		index := len(requests)
		requestMu.Unlock()
		flusher := prepareTestStream(t, w)
		if index == 1 {
			writeTestStreamChunk(t, w, flusher, "first answer")
		} else {
			writeTestStreamChunk(t, w, flusher, "second answer")
		}
		writeTestStreamDone(t, w, flusher)
	}))
	defer server.Close()

	control := &testTurnControl{}
	events := AgentChatWithControl(context.Background(), newTestOpenAIClient(server.URL), "test-model",
		testSessionID, "user-1", 1, "hello", "English", nil, EditorContext{}, nil, false,
		time.Second, 0, "", nil, "", 0, time.Second, time.Second, control)
	var eventTypes []string
	for event := range events {
		eventTypes = append(eventTypes, event.Type)
	}

	requestMu.Lock()
	defer requestMu.Unlock()
	if len(requests) != 2 {
		t.Fatalf("provider requests: got %d, want 2", len(requests))
	}
	steerSeen := false
	firstAnswerSeen := false
	for _, message := range requests[1].Messages {
		if message.Role == openai.ChatMessageRoleAssistant && message.Content == "first answer" {
			firstAnswerSeen = true
		}
		if message.Role == openai.ChatMessageRoleUser && message.Content == "please focus" {
			steerSeen = true
		}
	}
	if !firstAnswerSeen || !steerSeen {
		t.Fatalf("second provider request omitted boundary context: %#v", requests[1].Messages)
	}
	if !containsString(eventTypes, "steer_injected") || !containsString(eventTypes, "done") {
		t.Fatalf("missing steer/done events: %v", eventTypes)
	}

	runtimeState, err := loadRuntimeState(testSessionID)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(marshalSession(t, runtimeState), []byte("sourceInputID")) {
		t.Fatalf("queue coordination leaked into runtime schema: %#v", runtimeState)
	}
	if runtimeState.ActiveTurn == nil || runtimeState.ActiveTurn.State != "finished" {
		t.Fatalf("turn was not finalized: %#v", runtimeState.ActiveTurn)
	}
	roles := make([]string, 0, len(runtimeState.ActiveTurn.Delta))
	for _, message := range runtimeState.ActiveTurn.Delta {
		roles = append(roles, message.Role)
	}
	if len(roles) != 3 || roles[0] != "assistant" || roles[1] != "user" || roles[2] != "assistant" {
		t.Fatalf("runtime delta order: %v", roles)
	}
	if runtimeState.ActiveTurn.Delta[1].EntryID != "user-steer-1" || runtimeState.ActiveTurn.Delta[1].BlockHTML != "<p>please focus</p>" {
		t.Fatalf("steer user delta lost stable fields: %#v", runtimeState.ActiveTurn.Delta[1])
	}
	control.mu.Lock()
	defer control.mu.Unlock()
	if len(control.acknowledged) != 1 || control.acknowledged[0] != "steer-1" || !control.terminated {
		t.Fatalf("control lifecycle: ack=%v terminated=%v", control.acknowledged, control.terminated)
	}
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func TestApplyRuntimeTurnPersistsSteerAsExistingUserEntryShape(t *testing.T) {
	session := map[string]any{
		"entries": []any{
			map[string]any{"id": "user-1", "type": "user", "content": "hello"},
			map[string]any{"id": "client-assistant", "type": "assistant", "content": "client"},
			map[string]any{"id": "client-steer", "type": "user", "content": "client steer"},
		},
	}
	turn := &agentRuntimeTurn{
		TurnID:      "20260803210000-abcdefg",
		UserEntryID: "user-1",
		UpdatedAt:   1,
		Delta: []AgentMessage{
			{Role: "assistant", Content: "first"},
			{Role: "user", EntryID: "steer-entry", Content: "guide", BlockHTML: "<p>guide</p>"},
			{Role: "assistant", Content: "second"},
		},
	}
	if err := applyRuntimeTurnToSessionLocked(session, turn); err != nil {
		t.Fatal(err)
	}
	entries := session["entries"].([]any)
	if len(entries) != 4 {
		t.Fatalf("unexpected entry count: %#v", entries)
	}
	steer := entries[2].(map[string]any)
	if steer["type"] != "user" || steer["id"] != "steer-entry" || steer["content"] != "guide" || steer["blockHTML"] != "<p>guide</p>" {
		t.Fatalf("steer did not use compatible user entry fields: %#v", steer)
	}
}

type toolBoundaryTurnControl struct {
	mu           sync.Mutex
	pending      []AgentSteerInput
	phases       []AgentTurnPhase
	acknowledged []string
}

func (control *toolBoundaryTurnControl) TurnStarted(string) {}

func (control *toolBoundaryTurnControl) SetPhase(_ string, phase AgentTurnPhase) {
	control.mu.Lock()
	control.phases = append(control.phases, phase)
	control.mu.Unlock()
}

func (control *toolBoundaryTurnControl) ClaimSteers(_ string, _ bool) ([]AgentSteerInput, error) {
	control.mu.Lock()
	defer control.mu.Unlock()
	claimed := append([]AgentSteerInput(nil), control.pending...)
	control.pending = nil
	return claimed, nil
}

func (control *toolBoundaryTurnControl) AcknowledgeSteers(_ string, inputIDs []string, injected bool) {
	if !injected {
		return
	}
	control.mu.Lock()
	control.acknowledged = append(control.acknowledged, inputIDs...)
	control.mu.Unlock()
}

func (control *toolBoundaryTurnControl) TurnTerminated(string) {}

func (control *toolBoundaryTurnControl) addSteer(input AgentSteerInput) {
	control.mu.Lock()
	control.pending = append(control.pending, input)
	control.mu.Unlock()
}

func TestAgentChatInjectsSteerAfterRunningTool(t *testing.T) {
	useTestDataDir(t)
	originalConf := kernelModel.Conf
	kernelModel.Conf = kernelModel.NewAppConf()
	kernelModel.Conf.AI = kernelConf.NewAI()
	kernelModel.Conf.AI.MCP = nil
	kernelModel.Conf.AI.Agent.MaxToolCallRounds = 5
	kernelModel.Conf.Variables = kernelConf.NewVariables()
	t.Cleanup(func() { kernelModel.Conf = originalConf })

	session := map[string]any{
		"id":        testSessionID,
		"title":     "tool steer test",
		"createdAt": int64(1),
		"updatedAt": int64(1),
		"entries":   []any{map[string]any{"id": "user-1", "type": "user", "content": "hello"}},
	}
	if revision, err := SaveSession(marshalSession(t, session)); err != nil || revision != 1 {
		t.Fatalf("save initial session: revision=%d err=%v", revision, err)
	}

	toolStarted := make(chan struct{})
	releaseTool := make(chan struct{})
	testTool := &mcpTools.Tool{
		Name:         "agent_test_blocking_read",
		Description:  "controlled read-only test tool",
		Source:       "test",
		ReadOnlyHint: true,
		InputSchema:  mcpTools.ToolSchema{Type: "object"},
		Handler: func(map[string]any) (mcpTools.CallToolResult, error) {
			close(toolStarted)
			<-releaseTool
			return mcpTools.CallToolResult{Content: []mcpTools.ContentItem{{Type: "text", Text: "tool finished"}}}, nil
		},
	}
	mcpTools.SetTool(testTool.Name, testTool)
	t.Cleanup(func() { mcpTools.RemoveToolIf(testTool.Name, testTool) })

	var requestMu sync.Mutex
	requests := make([]openai.ChatCompletionRequest, 0, 2)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request openai.ChatCompletionRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode request: %v", err)
			return
		}
		requestMu.Lock()
		requests = append(requests, request)
		index := len(requests)
		requestMu.Unlock()
		flusher := prepareTestStream(t, w)
		if index == 1 {
			arguments := fmt.Sprintf(`{"tool_name":%q,"arguments":{}}`, testTool.Name)
			toolCall := map[string]any{
				"index": 0,
				"id":    "call-1",
				"type":  "function",
				"function": map[string]any{
					"name":      "tool_call",
					"arguments": arguments,
				},
			}
			chunkPayload := map[string]any{
				"choices": []any{map[string]any{"delta": map[string]any{"tool_calls": []any{toolCall}}}},
			}
			chunk, _ := json.Marshal(chunkPayload)
			_, _ = fmt.Fprintf(w, "data: %s\n\n", chunk)
			flusher.Flush()
		} else {
			writeTestStreamChunk(t, w, flusher, "answer after tool and steer")
		}
		writeTestStreamDone(t, w, flusher)
	}))
	defer server.Close()

	control := &toolBoundaryTurnControl{}
	events := AgentChatWithControl(context.Background(), newTestOpenAIClient(server.URL), "test-model",
		testSessionID, "user-1", 1, "hello", "English", nil, EditorContext{}, nil, false,
		time.Second, 0, "", nil, "", 0, time.Second, time.Second, control)
	done := make(chan []AgentEvent, 1)
	go func() {
		var collected []AgentEvent
		for event := range events {
			collected = append(collected, event)
		}
		done <- collected
	}()

	select {
	case <-toolStarted:
	case <-time.After(5 * time.Second):
		t.Fatal("test tool did not start")
	}
	control.addSteer(AgentSteerInput{
		InputID: "steer-during-tool", UserEntryID: "user-steer-tool", Content: "guide after tool",
	})
	close(releaseTool)

	var collected []AgentEvent
	select {
	case collected = <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("agent did not finish after tool release")
	}
	requestMu.Lock()
	defer requestMu.Unlock()
	if len(requests) != 2 {
		t.Fatalf("provider requests: got %d, want 2", len(requests))
	}
	roles := make([]string, 0, len(requests[1].Messages))
	steerSeen := false
	toolResultSeen := false
	for _, message := range requests[1].Messages {
		roles = append(roles, message.Role)
		if message.Role == openai.ChatMessageRoleTool && message.ToolCallID == "call-1" {
			toolResultSeen = true
		}
		if message.Role == openai.ChatMessageRoleUser && message.Content == "guide after tool" {
			steerSeen = true
		}
	}
	if !toolResultSeen || !steerSeen {
		t.Fatalf("second provider request omitted tool result or steer: roles=%v messages=%#v", roles, requests[1].Messages)
	}
	eventTypes := make([]string, 0, len(collected))
	for _, event := range collected {
		eventTypes = append(eventTypes, event.Type)
	}
	if !containsString(eventTypes, "tool_result") || !containsString(eventTypes, "steer_injected") || !containsString(eventTypes, "done") {
		t.Fatalf("tool steer event sequence incomplete: %v", eventTypes)
	}
	control.mu.Lock()
	defer control.mu.Unlock()
	if !containsTurnPhase(control.phases, AgentTurnToolRunning) || len(control.acknowledged) != 1 || control.acknowledged[0] != "steer-during-tool" {
		t.Fatalf("tool boundary control state: phases=%v ack=%v", control.phases, control.acknowledged)
	}
}

func containsTurnPhase(phases []AgentTurnPhase, target AgentTurnPhase) bool {
	for _, phase := range phases {
		if phase == target {
			return true
		}
	}
	return false
}
