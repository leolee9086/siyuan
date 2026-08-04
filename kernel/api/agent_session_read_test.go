// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/88250/lute/ast"
	"github.com/gin-gonic/gin"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/util"
	"github.com/siyuan-note/siyuan/packages/agentqueue"
)

func TestGetSessionDuringExecutorTurnReturnsCanonicalBeforeReplay(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDataDir := util.DataDir
	util.DataDir = t.TempDir()
	t.Cleanup(func() { util.DataDir = originalDataDir })

	sessionID := ast.NewNodeID()
	sessionDir := filepath.Join(util.DataDir, "storage", "ai", "agent", "sessions", sessionID)
	if err := os.MkdirAll(sessionDir, 0700); err != nil {
		t.Fatal(err)
	}
	canonical := map[string]any{
		"id": sessionID, "title": "active", "revision": int64(1),
		"entries": []any{map[string]any{"id": "user-1", "type": "user", "content": "question"}},
	}
	runtime := map[string]any{
		"schemaVersion": 1, "revision": int64(2), "sessionID": sessionID,
		"activeTurn": map[string]any{
			"turnID": "turn-active", "mode": "append", "userEntryID": "user-1",
			"baseRevision": int64(1), "state": "running", "updatedAt": int64(2),
			"delta": []any{map[string]any{"role": "assistant", "content": "runtime draft"}},
		},
	}
	writeJSON := func(name string, value any) {
		encoded, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		if err = os.WriteFile(filepath.Join(sessionDir, name), encoded, 0600); err != nil {
			t.Fatal(err)
		}
	}
	writeJSON("session.json", canonical)
	writeJSON("runtime.json", runtime)
	merged, err := agent.GetSessionState(sessionID, true)
	if err != nil || len(merged["entries"].([]any)) != 2 {
		t.Fatalf("test fixture did not expose the duplicate-risk runtime overlay: session=%#v err=%v", merged, err)
	}

	executor := newAgentSessionExecutor(sessionID, agentqueue.NewInboxManager(10))
	turnContext, cancelTurn := context.WithCancel(context.Background())
	executor.mu.Lock()
	executor.turnCtx = turnContext
	executor.turnCancel = cancelTurn
	executor.mu.Unlock()
	agentExecutorsMu.Lock()
	agentExecutors[sessionID] = executor
	agentExecutorsMu.Unlock()
	t.Cleanup(func() {
		cancelTurn()
		agentExecutorsMu.Lock()
		delete(agentExecutors, sessionID)
		agentExecutorsMu.Unlock()
	})
	executor.hub.publish("turn", map[string]any{"turnID": "turn-active"})
	executor.hub.publish("content", map[string]any{"turnID": "turn-active", "token": "runtime draft"})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/ai/agent/getSession", strings.NewReader(`{"id":"`+sessionID+`"}`))
	request.Header.Set("Content-Type", "application/json")
	request.RemoteAddr = "127.0.0.1:6806"
	ginContext, _ := gin.CreateTestContext(recorder)
	ginContext.Request = request
	getSession(ginContext)
	if recorder.Code != http.StatusOK {
		t.Fatalf("getSession status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	response := struct {
		Data map[string]any `json:"data"`
	}{}
	if err = json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	entries, ok := response.Data["entries"].([]any)
	if !ok || len(entries) != 1 || response.Data["agentRunning"] != true {
		t.Fatalf("active executor session must return canonical history before replay: %#v", response.Data)
	}

	replayContext, cancelReplay := context.WithCancel(context.Background())
	defer cancelReplay()
	replay, unsubscribe := executor.hub.subscribe(replayContext, 0)
	defer unsubscribe()
	if event := receiveAgentSessionEvent(t, replay); event.Type != "turn" || event.Data["turnID"] != "turn-active" {
		t.Fatalf("active turn was not available from replay: %+v", event)
	}
	if event := receiveAgentSessionEvent(t, replay); event.Type != "content" || event.Data["token"] != "runtime draft" {
		t.Fatalf("active content was not available from replay: %+v", event)
	}
}
