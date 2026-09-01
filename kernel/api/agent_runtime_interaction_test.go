// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/agent"
	mcpTools "github.com/siyuan-note/siyuan/kernel/mcp/tools"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/packages/agentqueue"
)

type sessionEventInteraction struct {
	eventType      string
	resolvedType   string
	resolvedStatus string
	handler        func(*testing.T, string, agentSessionEvent) *httptest.ResponseRecorder
}

func writeAgentToolCallStream(t *testing.T, w http.ResponseWriter, toolName string, arguments map[string]any) {
	t.Helper()
	w.Header().Set("Content-Type", "text/event-stream")
	flusher, ok := w.(http.Flusher)
	if !ok {
		t.Fatal("provider response does not support flushing")
	}
	wrapped, err := json.Marshal(map[string]any{"tool_name": toolName, "arguments": arguments})
	if err != nil {
		t.Fatal(err)
	}
	chunk, err := json.Marshal(map[string]any{
		"choices": []any{map[string]any{"delta": map[string]any{"tool_calls": []any{map[string]any{
			"index": 0, "id": "call-interaction", "type": "function",
			"function": map[string]any{"name": "tool_call", "arguments": string(wrapped)},
		}}}}},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, _ = fmt.Fprintf(w, "data: %s\n\n", chunk)
	flusher.Flush()
	_, _ = fmt.Fprint(w, "data: [DONE]\n\n")
	flusher.Flush()
}

func writeAgentTextStream(t *testing.T, w http.ResponseWriter) {
	t.Helper()
	w.Header().Set("Content-Type", "text/event-stream")
	flusher, ok := w.(http.Flusher)
	if !ok {
		t.Fatal("provider response does not support flushing")
	}
	_, _ = fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"completed\"}}]}\n\n")
	flusher.Flush()
	_, _ = fmt.Fprint(w, "data: [DONE]\n\n")
	flusher.Flush()
}

func waitForAgentSessionEvent(t *testing.T, events <-chan agentSessionEvent, eventType string) agentSessionEvent {
	t.Helper()
	deadline := time.After(5 * time.Second)
	for {
		select {
		case event := <-events:
			if event.Type == eventType {
				return event
			}
		case <-deadline:
			t.Fatalf("timed out waiting for %s", eventType)
		}
	}
}

func waitForAgentSessionEventMatching(t *testing.T, events <-chan agentSessionEvent, eventType string,
	matches func(agentSessionEvent) bool) agentSessionEvent {
	t.Helper()
	deadline := time.After(5 * time.Second)
	for {
		select {
		case event := <-events:
			if event.Type == "done" && eventType != "done" {
				t.Fatalf("turn ended before %s", eventType)
			}
			if event.Type == eventType && matches(event) {
				return event
			}
		case <-deadline:
			t.Fatalf("timed out waiting for matching %s", eventType)
		}
	}
}

func waitForAgentExecutorStreamStopped(t *testing.T, executor *agentSessionExecutor) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if !executor.activity().StreamActive {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("agent executor stream did not stop: %+v", executor.activity())
}

func readLegacyAgentSSEEvent(t *testing.T, body, eventType string) map[string]any {
	t.Helper()
	for _, frame := range strings.Split(body, "\n\n") {
		lines := strings.Split(frame, "\n")
		if len(lines) < 2 || lines[0] != "event:"+eventType || !strings.HasPrefix(lines[1], "data:") {
			continue
		}
		payload := map[string]any{}
		if err := json.Unmarshal([]byte(strings.TrimPrefix(lines[1], "data:")), &payload); err != nil {
			t.Fatalf("decode legacy %s event: %v", eventType, err)
		}
		return payload
	}
	t.Fatalf("legacy SSE omitted %s: %s", eventType, body)
	return nil
}

func agentSessionQueueHasPendingInput(event agentSessionEvent, inputID string) bool {
	queue, ok := event.Data["queue"].(map[string]any)
	if !ok {
		return false
	}
	items, ok := queue["items"].([]any)
	if !ok {
		return false
	}
	for _, rawItem := range items {
		item, _ := rawItem.(map[string]any)
		input, _ := item["input"].(map[string]any)
		if input["id"] == inputID && item["state"] == string(agentqueue.StatusPending) {
			return true
		}
	}
	return false
}

func runAgentSessionEventInteraction(t *testing.T, toolName string, arguments map[string]any, interaction sessionEventInteraction) {
	t.Helper()
	sessionID := setupAgentControlAPITest(t)
	var requestMu sync.Mutex
	requestCount := 0
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requestMu.Lock()
		requestCount++
		current := requestCount
		requestMu.Unlock()
		if current == 1 {
			writeAgentToolCallStream(t, w, toolName, arguments)
			return
		}
		writeAgentTextStream(t, w)
	}))
	defer provider.Close()
	model.Conf.AI.Providers[0].BaseURL = provider.URL + "/v1"

	executor := getAgentExecutor(sessionID)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	events, unsubscribe, err := executor.subscribeEvents(ctx, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer unsubscribe()

	turnRecorder, _ := callAgentControlAPI(t, agentTurn, http.MethodPost, "/api/ai/agent/turn", map[string]any{
		"inputID": "input-interaction", "sessionID": sessionID, "userEntryID": "entry-interaction",
		"message": "run interaction", "language": "English",
	})
	if turnRecorder.Code != http.StatusAccepted {
		t.Fatalf("direct turn admission: status=%d body=%s", turnRecorder.Code, turnRecorder.Body.String())
	}

	interactionEvent := waitForAgentSessionEvent(t, events, interaction.eventType)
	response := interaction.handler(t, sessionID, interactionEvent)
	if response.Code != http.StatusOK {
		t.Fatalf("%s response: status=%d body=%s", interaction.eventType, response.Code, response.Body.String())
	}
	resolved := waitForAgentSessionEvent(t, events, interaction.resolvedType)
	if resolved.Data["status"] != interaction.resolvedStatus {
		t.Fatalf("%s resolution: got %+v, want status %s", interaction.eventType, resolved.Data,
			interaction.resolvedStatus)
	}
	identityKey := "callID"
	if interaction.eventType == "confirm" {
		identityKey = "confirmID"
	} else if interaction.eventType == "question" {
		identityKey = "questionID"
	}
	if interactionEvent.Data[identityKey] == "" || resolved.Data[identityKey] != interactionEvent.Data[identityKey] {
		t.Fatalf("%s resolution identity mismatch: request=%+v resolved=%+v", interaction.eventType,
			interactionEvent.Data, resolved.Data)
	}
	waitForAgentSessionEvent(t, events, "done")
	requestMu.Lock()
	defer requestMu.Unlock()
	if requestCount != 2 {
		t.Fatalf("provider requests after %s: got %d, want 2", interaction.eventType, requestCount)
	}
}

func TestSessionEventExecutorConfirmAPIWakesRealWaiter(t *testing.T) {
	executed := make(chan struct{}, 1)
	testTool := &mcpTools.Tool{
		Name: "agent_api_interaction_write", Description: "API interaction test", Source: "test",
		EffectScope: mcpTools.EffectScopeExternal, InputSchema: mcpTools.ToolSchema{Type: "object"},
		Handler: func(map[string]any) (mcpTools.CallToolResult, error) {
			executed <- struct{}{}
			return mcpTools.CallToolResult{Content: []mcpTools.ContentItem{{Type: "text", Text: "approved"}}}, nil
		},
	}
	mcpTools.SetTool(testTool.Name, testTool)
	t.Cleanup(func() { mcpTools.RemoveToolIf(testTool.Name, testTool) })

	runAgentSessionEventInteraction(t, testTool.Name, map[string]any{}, sessionEventInteraction{
		eventType: "confirm", resolvedType: "confirm_resolved", resolvedStatus: "always",
		handler: func(t *testing.T, sessionID string, event agentSessionEvent) *httptest.ResponseRecorder {
			confirmID, _ := event.Data["confirmID"].(string)
			if confirmID == "" {
				t.Fatal("confirm event omitted confirmID")
			}
			recorder, _ := callAgentControlAPI(t, agentChatConfirm, http.MethodPost, "/api/ai/agent/confirm", map[string]any{
				"sessionID": sessionID, "confirmID": confirmID, "approved": true, "always": true,
			})
			return recorder
		},
	})
	select {
	case <-executed:
	case <-time.After(5 * time.Second):
		t.Fatal("approved tool was not executed")
	}
}

func TestLegacyAgentChatStreamsResolvedEventFromRealConfirmWaiter(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	executed := make(chan struct{}, 1)
	testTool := &mcpTools.Tool{
		Name: "agent_legacy_confirm_write", Description: "Legacy confirm stream test", Source: "test",
		EffectScope: mcpTools.EffectScopeExternal, InputSchema: mcpTools.ToolSchema{Type: "object"},
		Handler: func(map[string]any) (mcpTools.CallToolResult, error) {
			executed <- struct{}{}
			return mcpTools.CallToolResult{Content: []mcpTools.ContentItem{{Type: "text", Text: "approved"}}}, nil
		},
	}
	mcpTools.SetTool(testTool.Name, testTool)
	t.Cleanup(func() { mcpTools.RemoveToolIf(testTool.Name, testTool) })
	var requestMu sync.Mutex
	requestCount := 0
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requestMu.Lock()
		requestCount++
		current := requestCount
		requestMu.Unlock()
		if current == 1 {
			writeAgentToolCallStream(t, w, testTool.Name, map[string]any{})
			return
		}
		writeAgentTextStream(t, w)
	}))
	defer provider.Close()
	model.Conf.AI.Providers[0].BaseURL = provider.URL + "/v1"

	executor := getAgentExecutor(sessionID)
	events, unsubscribe, err := executor.subscribeEvents(context.Background(), 0)
	if err != nil {
		t.Fatal(err)
	}
	defer unsubscribe()
	body, err := json.Marshal(map[string]any{
		"sessionID": sessionID, "userEntryID": "user-root", "contentRevision": int64(1),
		"message": "hello", "language": "English",
	})
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/ai/agent/chat", bytes.NewReader(body))
	request.RemoteAddr = "127.0.0.1:6806"
	request.Header.Set("Content-Type", "application/json")
	ginContext, _ := gin.CreateTestContext(recorder)
	ginContext.Request = request
	chatDone := make(chan struct{})
	go func() {
		agentChat(ginContext)
		close(chatDone)
	}()

	confirmation := waitForAgentSessionEvent(t, events, "confirm")
	confirmID, _ := confirmation.Data["confirmID"].(string)
	confirmRecorder, _ := callAgentControlAPI(t, agentChatConfirm, http.MethodPost,
		"/api/ai/agent/confirm", map[string]any{
			"sessionID": sessionID, "confirmID": confirmID, "approved": true,
		})
	if confirmRecorder.Code != http.StatusOK {
		t.Fatalf("legacy confirmation response: status=%d body=%s", confirmRecorder.Code, confirmRecorder.Body.String())
	}
	resolved := waitForAgentSessionEvent(t, events, "confirm_resolved")
	select {
	case <-chatDone:
	case <-time.After(5 * time.Second):
		t.Fatal("legacy chat did not finish after confirmation")
	}
	payload := readLegacyAgentSSEEvent(t, recorder.Body.String(), "confirm_resolved")
	if payload["confirmID"] != confirmID || payload["callID"] != resolved.Data["callID"] || payload["status"] != "approved" {
		t.Fatalf("legacy confirm resolution drifted: wire=%+v session=%+v", payload, resolved.Data)
	}
	if _, exists := payload["turnID"]; exists {
		t.Fatalf("legacy resolved event gained session-event metadata: %+v", payload)
	}
	select {
	case <-executed:
	case <-time.After(5 * time.Second):
		t.Fatal("legacy approved tool was not executed")
	}
}

func TestLegacyAgentChatSSEProjectsAllInteractionResolutionTypes(t *testing.T) {
	tests := []struct {
		name     string
		event    agent.AgentEvent
		identity string
		status   string
		message  string
	}{
		{name: "confirm_resolved", event: agent.AgentEvent{Type: "confirm_resolved", ConfirmID: "confirm-1",
			CallID: "call-1", Status: "rejected", Message: "rejected", TurnID: "turn-1"},
			identity: "confirm-1", status: "rejected", message: "rejected"},
		{name: "question_resolved", event: agent.AgentEvent{Type: "question_resolved", QuestionID: "question-1",
			CallID: "call-2", Status: "submitted", Message: "answered", Answers: []string{"yes"}, TurnID: "turn-1"},
			identity: "question-1", status: "submitted", message: "answered"},
		{name: "frontend_tool_resolved", event: agent.AgentEvent{Type: "frontend_tool_resolved", CallID: "call-3",
			Status: "error", Message: "failed", TurnID: "turn-1"},
			identity: "call-3", status: "error", message: "failed"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ginContext, _ := gin.CreateTestContext(recorder)
			if err := writeSSE(ginContext, test.event); err != nil {
				t.Fatal(err)
			}
			payload := readLegacyAgentSSEEvent(t, recorder.Body.String(), test.name)
			identity := payload["callID"]
			if test.name == "confirm_resolved" {
				identity = payload["confirmID"]
			}
			if test.name == "question_resolved" {
				identity = payload["questionID"]
			}
			if identity != test.identity || payload["status"] != test.status || payload["message"] != test.message {
				t.Fatalf("legacy %s payload: %+v", test.name, payload)
			}
			if _, exists := payload["turnID"]; exists {
				t.Fatalf("legacy %s gained turn metadata: %+v", test.name, payload)
			}
		})
	}
}

func runSessionEventConfirmDecision(t *testing.T, approved, always bool, expectedStatus string) {
	t.Helper()
	executed := make(chan struct{}, 1)
	toolName := "agent_api_confirm_" + expectedStatus
	testTool := &mcpTools.Tool{
		Name: toolName, Description: "Confirm resolution test", Source: "test",
		EffectScope: mcpTools.EffectScopeExternal, InputSchema: mcpTools.ToolSchema{Type: "object"},
		Handler: func(map[string]any) (mcpTools.CallToolResult, error) {
			executed <- struct{}{}
			return mcpTools.CallToolResult{Content: []mcpTools.ContentItem{{Type: "text", Text: "executed"}}}, nil
		},
	}
	mcpTools.SetTool(toolName, testTool)
	t.Cleanup(func() { mcpTools.RemoveToolIf(toolName, testTool) })

	runAgentSessionEventInteraction(t, toolName, map[string]any{}, sessionEventInteraction{
		eventType: "confirm", resolvedType: "confirm_resolved", resolvedStatus: expectedStatus,
		handler: func(t *testing.T, sessionID string, event agentSessionEvent) *httptest.ResponseRecorder {
			confirmID, _ := event.Data["confirmID"].(string)
			recorder, _ := callAgentControlAPI(t, agentChatConfirm, http.MethodPost, "/api/ai/agent/confirm", map[string]any{
				"sessionID": sessionID, "confirmID": confirmID, "approved": approved, "always": always,
			})
			return recorder
		},
	})
	select {
	case <-executed:
		if !approved {
			t.Fatal("rejected tool was executed")
		}
	default:
		if approved {
			t.Fatal("approved tool was not executed")
		}
	}
}

func TestSessionEventExecutorConfirmResolvedApproved(t *testing.T) {
	runSessionEventConfirmDecision(t, true, false, "approved")
}

func TestSessionEventExecutorConfirmResolvedRejected(t *testing.T) {
	runSessionEventConfirmDecision(t, false, false, "rejected")
}

func TestSessionEventExecutorQuestionAPIWakesRealWaiter(t *testing.T) {
	runAgentSessionEventInteraction(t, "question", map[string]any{
		"questions": []any{map[string]any{
			"header": "Continue", "question": "Continue?",
			"options": []any{
				map[string]any{"label": "yes", "description": "Continue the operation"},
				map[string]any{"label": "no", "description": "Stop the operation"},
			},
		}},
	}, sessionEventInteraction{
		eventType: "question", resolvedType: "question_resolved", resolvedStatus: "submitted",
		handler: func(t *testing.T, sessionID string, event agentSessionEvent) *httptest.ResponseRecorder {
			questionID, _ := event.Data["questionID"].(string)
			recorder, _ := callAgentControlAPI(t, agentChatQuestion, http.MethodPost, "/api/ai/agent/question", map[string]any{
				"sessionID": sessionID, "questionID": questionID, "answers": []string{"yes"},
			})
			return recorder
		},
	})
}

func TestSessionEventExecutorFrontendAPIWakesRealWaiter(t *testing.T) {
	runAgentSessionEventInteraction(t, "frontend", map[string]any{"action": "reload_app"}, sessionEventInteraction{
		eventType: "frontend_tool_call", resolvedType: "frontend_tool_resolved", resolvedStatus: "completed",
		handler: func(t *testing.T, sessionID string, event agentSessionEvent) *httptest.ResponseRecorder {
			callID, _ := event.Data["callID"].(string)
			recorder, _ := callAgentControlAPI(t, agentChatFrontendResult, http.MethodPost, "/api/ai/agent/frontendToolResult", map[string]any{
				"sessionID": sessionID, "callID": callID, "result": "frontend completed", "isError": false,
			})
			return recorder
		},
	})
}

func TestSessionEventExecutorFrontendFailureHasErrorResolution(t *testing.T) {
	runAgentSessionEventInteraction(t, "frontend", map[string]any{"action": "reload_app"}, sessionEventInteraction{
		eventType: "frontend_tool_call", resolvedType: "frontend_tool_resolved", resolvedStatus: "error",
		handler: func(t *testing.T, sessionID string, event agentSessionEvent) *httptest.ResponseRecorder {
			callID, _ := event.Data["callID"].(string)
			recorder, _ := callAgentControlAPI(t, agentChatFrontendResult, http.MethodPost,
				"/api/ai/agent/frontendToolResult", map[string]any{
					"sessionID": sessionID, "callID": callID, "result": "frontend failed", "isError": true,
				})
			return recorder
		},
	})
}

func TestAgentInteractionAPINotRunningIsStructuredExpiredState(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	recorder, response := callAgentControlAPI(t, agentChatConfirm, http.MethodPost,
		"/api/ai/agent/confirm", map[string]any{
			"sessionID": sessionID, "confirmID": "missing-confirm", "approved": true,
		})
	data := decodeAgentControlData(t, response)
	if recorder.Code != http.StatusConflict || data["reason"] != "session_not_running" || data["status"] != "expired" {
		t.Fatalf("not-running interaction response: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestSessionEventExecutorConfirmTimeoutEmitsExpiredAndRejectsOnlyExpiredWaiter(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	model.Conf.AI.Agent.ConfirmTimeout = 1
	var requestMu sync.Mutex
	requestCount := 0
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requestMu.Lock()
		requestCount++
		current := requestCount
		requestMu.Unlock()
		if current == 1 {
			writeAgentToolCallStream(t, w, "agent_api_timeout_write", map[string]any{})
			return
		}
		writeAgentTextStream(t, w)
	}))
	defer provider.Close()
	model.Conf.AI.Providers[0].BaseURL = provider.URL + "/v1"
	executed := make(chan struct{}, 1)
	testTool := &mcpTools.Tool{
		Name: "agent_api_timeout_write", Description: "Timeout resolution test", Source: "test",
		EffectScope: mcpTools.EffectScopeExternal, InputSchema: mcpTools.ToolSchema{Type: "object"},
		Handler: func(map[string]any) (mcpTools.CallToolResult, error) {
			executed <- struct{}{}
			return mcpTools.CallToolResult{}, nil
		},
	}
	mcpTools.SetTool(testTool.Name, testTool)
	t.Cleanup(func() { mcpTools.RemoveToolIf(testTool.Name, testTool) })

	executor := getAgentExecutor(sessionID)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	events, unsubscribe, err := executor.subscribeEvents(ctx, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer unsubscribe()
	turnRecorder, _ := callAgentControlAPI(t, agentTurn, http.MethodPost, "/api/ai/agent/turn", map[string]any{
		"inputID": "timeout-input", "sessionID": sessionID, "userEntryID": "timeout-entry",
		"message": "wait for timeout", "language": "English",
	})
	if turnRecorder.Code != http.StatusAccepted {
		t.Fatalf("timeout turn admission: status=%d body=%s", turnRecorder.Code, turnRecorder.Body.String())
	}
	confirmation := waitForAgentSessionEvent(t, events, "confirm")
	resolved := waitForAgentSessionEvent(t, events, "confirm_resolved")
	if resolved.Data["status"] != "expired" || resolved.Data["confirmID"] != confirmation.Data["confirmID"] ||
		resolved.Data["callID"] == "" {
		t.Fatalf("expired confirmation resolution: confirm=%+v resolved=%+v", confirmation.Data, resolved.Data)
	}
	recorder, response := callAgentControlAPI(t, agentChatConfirm, http.MethodPost,
		"/api/ai/agent/confirm", map[string]any{
			"sessionID": sessionID, "confirmID": confirmation.Data["confirmID"], "approved": true,
		})
	data := decodeAgentControlData(t, response)
	if recorder.Code != http.StatusConflict || data["reason"] != "interaction_expired" || data["status"] != "expired" {
		t.Fatalf("expired waiter response: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	waitForAgentSessionEvent(t, events, "done")
	select {
	case <-executed:
		t.Fatal("expired confirmation executed the tool")
	default:
	}
}

func TestSessionEventExecutorInterruptEmitsCancelledConfirmation(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeAgentToolCallStream(t, w, "agent_api_cancel_write", map[string]any{})
	}))
	defer provider.Close()
	model.Conf.AI.Providers[0].BaseURL = provider.URL + "/v1"
	executed := make(chan struct{}, 1)
	testTool := &mcpTools.Tool{
		Name: "agent_api_cancel_write", Description: "Cancellation resolution test", Source: "test",
		EffectScope: mcpTools.EffectScopeExternal, InputSchema: mcpTools.ToolSchema{Type: "object"},
		Handler: func(map[string]any) (mcpTools.CallToolResult, error) {
			executed <- struct{}{}
			return mcpTools.CallToolResult{}, nil
		},
	}
	mcpTools.SetTool(testTool.Name, testTool)
	t.Cleanup(func() { mcpTools.RemoveToolIf(testTool.Name, testTool) })

	executor := getAgentExecutor(sessionID)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	events, unsubscribe, err := executor.subscribeEvents(ctx, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer unsubscribe()
	turnRecorder, _ := callAgentControlAPI(t, agentTurn, http.MethodPost, "/api/ai/agent/turn", map[string]any{
		"inputID": "cancel-input", "sessionID": sessionID, "userEntryID": "cancel-entry",
		"message": "interrupt confirmation", "language": "English",
	})
	if turnRecorder.Code != http.StatusAccepted {
		t.Fatalf("cancel turn admission: status=%d body=%s", turnRecorder.Code, turnRecorder.Body.String())
	}
	turnEvent := waitForAgentSessionEvent(t, events, "turn")
	confirmation := waitForAgentSessionEvent(t, events, "confirm")
	turnID, _ := turnEvent.Data["turnID"].(string)
	interruptRecorder, _ := callAgentControlAPI(t, interruptAgentTurn, http.MethodPost,
		"/api/ai/agent/interrupt", map[string]any{
			"sessionID": sessionID, "expectedTurnID": turnID, "preserveQueue": true,
		})
	if interruptRecorder.Code != http.StatusAccepted {
		t.Fatalf("interrupt confirmation: status=%d body=%s", interruptRecorder.Code, interruptRecorder.Body.String())
	}
	resolved := waitForAgentSessionEvent(t, events, "confirm_resolved")
	if resolved.Data["status"] != "cancelled" || resolved.Data["confirmID"] != confirmation.Data["confirmID"] {
		t.Fatalf("cancelled confirmation resolution: confirm=%+v resolved=%+v", confirmation.Data, resolved.Data)
	}
	waitForAgentExecutorStreamStopped(t, executor)
	select {
	case <-executed:
		t.Fatal("cancelled confirmation executed the tool")
	default:
	}
}

func TestActiveSessionEventTurnAcceptsSteerQueueSaveAndCurrentVersionCancel(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	firstProviderStarted := make(chan struct{})
	releaseFirstProvider := make(chan struct{})
	var releaseFirstProviderOnce sync.Once
	releaseFirst := func() {
		releaseFirstProviderOnce.Do(func() { close(releaseFirstProvider) })
	}
	t.Cleanup(releaseFirst)
	secondProviderStarted := make(chan struct{})
	var requestMu sync.Mutex
	requestCount := 0
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requestMu.Lock()
		requestCount++
		current := requestCount
		requestMu.Unlock()
		if current == 1 {
			close(firstProviderStarted)
			<-releaseFirstProvider
		} else if current == 2 {
			close(secondProviderStarted)
		}
		writeAgentTextStream(t, w)
	}))
	defer provider.Close()
	model.Conf.AI.Providers[0].BaseURL = provider.URL + "/v1"

	executor := getAgentExecutor(sessionID)
	eventContext, cancelEvents := context.WithCancel(context.Background())
	defer cancelEvents()
	events, unsubscribe, err := executor.subscribeEvents(eventContext, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer unsubscribe()

	turnRecorder, _ := callAgentControlAPI(t, agentTurn, http.MethodPost, "/api/ai/agent/turn", map[string]any{
		"inputID": "active-turn-input", "sessionID": sessionID, "userEntryID": "active-turn-entry",
		"message": "start a long turn", "language": "English",
	})
	if turnRecorder.Code != http.StatusAccepted {
		t.Fatalf("direct turn admission: status=%d body=%s", turnRecorder.Code, turnRecorder.Body.String())
	}
	turnEvent := waitForAgentSessionEvent(t, events, "turn")
	turnID, _ := turnEvent.Data["turnID"].(string)
	if turnID == "" {
		t.Fatal("turn event omitted turnID")
	}
	select {
	case <-firstProviderStarted:
	case <-time.After(5 * time.Second):
		t.Fatal("provider did not enter the active turn")
	}

	steerRecorder, _ := callAgentControlAPI(t, agentSteer, http.MethodPost, "/api/ai/agent/steer", map[string]any{
		"inputID": "active-steer", "sessionID": sessionID, "expectedTurnID": turnID,
		"userEntryID": "active-steer-entry", "message": "incorporate this guidance",
	})
	if steerRecorder.Code != http.StatusAccepted {
		t.Fatalf("active steer admission: status=%d body=%s", steerRecorder.Code, steerRecorder.Body.String())
	}
	queueRecorder, queueResponse := callAgentControlAPI(t, agentQueue, http.MethodPost, "/api/ai/agent/queue", map[string]any{
		"inputID": "active-queue", "sessionID": sessionID, "userEntryID": "active-queue-entry",
		"message": "run this later", "language": "English",
	})
	if queueRecorder.Code != http.StatusAccepted {
		t.Fatalf("active queue admission: status=%d body=%s", queueRecorder.Code, queueRecorder.Body.String())
	}
	queueVersion := int64(decodeAgentControlData(t, queueResponse)["queueVersion"].(float64))
	waitForAgentSessionEventMatching(t, events, "queue_state", func(event agentSessionEvent) bool {
		return agentSessionQueueHasPendingInput(event, "active-queue")
	})

	cancelRecorder, cancelResponse := callAgentControlAPI(t, cancelAgentQueue, http.MethodPost,
		"/api/ai/agent/queue/cancel", map[string]any{
			"sessionID": sessionID, "inputID": "active-queue", "queueVersion": queueVersion,
		})
	if cancelRecorder.Code != http.StatusOK {
		t.Fatalf("cancel with admission version: status=%d body=%s", cancelRecorder.Code, cancelRecorder.Body.String())
	}
	if got := int64(decodeAgentControlData(t, cancelResponse)["queueVersion"].(float64)); got != queueVersion+1 {
		t.Fatalf("cancel version: got %d, want %d", got, queueVersion+1)
	}

	activeSession, err := agent.GetSessionState(sessionID, false)
	if err != nil {
		t.Fatal(err)
	}
	activeSession["expectedRevision"] = activeSession["revision"]
	saveRecorder, _ := callAgentControlAPI(t, saveSession, http.MethodPost, "/api/ai/agent/saveSession", activeSession)
	if saveRecorder.Code != http.StatusOK {
		t.Fatalf("ordinary save during active turn: status=%d body=%s", saveRecorder.Code, saveRecorder.Body.String())
	}
	activity := executor.activity()
	if !activity.Active || activity.TurnID != turnID || activity.Phase != agent.AgentTurnProvider {
		t.Fatalf("ordinary save changed active turn: %+v", activity)
	}

	releaseFirst()
	waitForAgentSessionEventMatching(t, events, "steer_injected", func(event agentSessionEvent) bool {
		return event.Data["inputID"] == "active-steer" && event.Data["turnID"] == turnID
	})
	select {
	case <-secondProviderStarted:
	case <-time.After(5 * time.Second):
		t.Fatal("steer did not continue through a second provider request")
	}
	waitForAgentSessionEvent(t, events, "done")

	commitSession, err := agent.GetSessionState(sessionID, false)
	if err != nil {
		t.Fatal(err)
	}
	commitSession["expectedRevision"] = commitSession["revision"]
	commitSession["commitTurnID"] = turnID
	commitRecorder, _ := callAgentControlAPI(t, saveSession, http.MethodPost, "/api/ai/agent/saveSession", commitSession)
	if commitRecorder.Code != http.StatusOK {
		t.Fatalf("active turn commit: status=%d body=%s", commitRecorder.Code, commitRecorder.Body.String())
	}
	canonical, err := agent.GetSessionState(sessionID, false)
	if err != nil {
		t.Fatal(err)
	}
	future, _ := canonical["future"].(map[string]any)
	if future["upstream"] != true {
		t.Fatalf("unknown upstream field was not preserved: %+v", canonical["future"])
	}
	if _, exists := canonical["queue"]; exists {
		t.Fatal("queue state leaked into the upstream-compatible session payload")
	}
	requestMu.Lock()
	defer requestMu.Unlock()
	if requestCount != 2 {
		t.Fatalf("provider requests after steer: got %d, want 2", requestCount)
	}
}
