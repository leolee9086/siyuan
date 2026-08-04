// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package api

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/packages/agentqueue"
)

func TestAgentInterruptAPICancelsCurrentTurnAndOptionalQueue(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	executor := getAgentExecutor(sessionID)
	for _, id := range []string{"queue-1", "queue-2"} {
		if _, err := executor.manager.Submit(&agentqueue.Input{
			ID: id, SessionID: sessionID, Semantics: agentqueue.SemanticsQueue, Content: id,
		}); err != nil {
			t.Fatal(err)
		}
	}
	executor.turn.TurnStarted("turn-1")
	executor.turn.SetPhase("turn-1", agent.AgentTurnProvider)
	if _, err := executor.turn.AdmitSteer(&agentqueue.Input{
		ID: "steer-1", SessionID: sessionID, Semantics: agentqueue.SemanticsSteer,
		ExpectedTurnID: "turn-1", Content: "guide",
	}); err != nil {
		t.Fatal(err)
	}
	turnCtx, turnCancel := context.WithCancel(context.Background())
	executor.mu.Lock()
	executor.turnCtx = turnCtx
	executor.turnCancel = turnCancel
	executor.mu.Unlock()

	preserveQueue := false
	recorder, _ := callAgentControlAPI(t, interruptAgentTurn, http.MethodPost, "/api/ai/agent/interrupt", map[string]any{
		"sessionID": sessionID, "expectedTurnID": "turn-1", "preserveQueue": preserveQueue,
	})
	if recorder.Code != http.StatusAccepted {
		t.Fatalf("interrupt turn: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	select {
	case <-turnCtx.Done():
	case <-time.After(time.Second):
		t.Fatal("interrupt did not cancel the turn context")
	}
	snapshot := executor.manager.SnapshotVersioned(sessionID)
	states := map[string]agentqueue.InboxStatus{}
	for _, item := range snapshot.Items {
		states[item.Input.ID] = item.State
	}
	if states["queue-1"] != agentqueue.StatusCancelled || states["queue-2"] != agentqueue.StatusCancelled || states["steer-1"] != agentqueue.StatusFailed {
		t.Fatalf("interrupt queue/steer states: %+v", states)
	}
}

func TestAgentInterruptAPIRequiresExpectedTurnID(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	recorder, response := callAgentControlAPI(t, interruptAgentTurn, http.MethodPost, "/api/ai/agent/interrupt", map[string]any{
		"sessionID": sessionID,
	})
	if recorder.Code != http.StatusBadRequest || decodeAgentControlData(t, response)["reason"] != "invalid_input" {
		t.Fatalf("missing interrupt turn id: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}
