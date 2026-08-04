// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/packages/agentqueue"
)

func TestAgentQueueAPIVersionedUpdateCancelAndPromote(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	queue := func(inputID, entryID, message string) map[string]any {
		return map[string]any{
			"inputID": inputID, "sessionID": sessionID, "userEntryID": entryID,
			"message": message, "language": "English",
		}
	}
	_, first := callAgentControlAPI(t, agentQueue, http.MethodPost, "/api/ai/agent/queue", queue("queue-1", "entry-1", "one"))
	firstVersion := int64(decodeAgentControlData(t, first)["queueVersion"].(float64))
	_, second := callAgentControlAPI(t, agentQueue, http.MethodPost, "/api/ai/agent/queue", queue("queue-2", "entry-2", "two"))
	version := int64(decodeAgentControlData(t, second)["queueVersion"].(float64))

	update := queue("queue-1", "forged-entry", "one edited")
	update["queueVersion"] = version
	updateRecorder, updateResponse := callAgentControlAPI(t, updateAgentQueue, http.MethodPost, "/api/ai/agent/queue/update", update)
	if updateRecorder.Code != http.StatusOK {
		t.Fatalf("queue update: status=%d body=%s", updateRecorder.Code, updateRecorder.Body.String())
	}
	updatedVersion := int64(decodeAgentControlData(t, updateResponse)["queueVersion"].(float64))
	if updatedVersion != version+1 {
		t.Fatalf("updated queue version: got %d want %d", updatedVersion, version+1)
	}
	snapshot := getAgentExecutor(sessionID).manager.SnapshotVersioned(sessionID)
	params, err := decodeAgentTurnParams(snapshot.Items[0].Input)
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Items[0].Input.Content != "one edited" || params.UserEntryID != "entry-1" {
		t.Fatalf("queue edit changed stable identity: input=%+v params=%+v", snapshot.Items[0].Input, params)
	}

	stale := queue("queue-1", "entry-1", "stale")
	stale["queueVersion"] = firstVersion
	staleRecorder, staleResponse := callAgentControlAPI(t, updateAgentQueue, http.MethodPost, "/api/ai/agent/queue/update", stale)
	if staleRecorder.Code != http.StatusConflict || decodeAgentControlData(t, staleResponse)["reason"] != "queue_version_conflict" {
		t.Fatalf("stale queue update: status=%d body=%s", staleRecorder.Code, staleRecorder.Body.String())
	}

	executor := getAgentExecutor(sessionID)
	executor.turn.TurnStarted("turn-1")
	executor.turn.SetPhase("turn-1", agent.AgentTurnProvider)
	promote := map[string]any{
		"sessionID": sessionID, "inputID": "queue-1", "queueVersion": updatedVersion, "expectedTurnID": "turn-1",
	}
	promoteRecorder, promoteResponse := callAgentControlAPI(t, promoteAgentQueue, http.MethodPost, "/api/ai/agent/queue/promote", promote)
	if promoteRecorder.Code != http.StatusAccepted {
		t.Fatalf("queue promote: status=%d body=%s", promoteRecorder.Code, promoteRecorder.Body.String())
	}
	promotedVersion := int64(decodeAgentControlData(t, promoteResponse)["queueVersion"].(float64))

	cancelPromoted := map[string]any{"sessionID": sessionID, "inputID": "queue-1", "queueVersion": promotedVersion}
	cancelPromotedRecorder, cancelPromotedResponse := callAgentControlAPI(t, cancelAgentQueue, http.MethodPost, "/api/ai/agent/queue/cancel", cancelPromoted)
	if cancelPromotedRecorder.Code != http.StatusConflict || decodeAgentControlData(t, cancelPromotedResponse)["reason"] != "input_already_promoted" {
		t.Fatalf("cancel promoted queue: status=%d body=%s", cancelPromotedRecorder.Code, cancelPromotedRecorder.Body.String())
	}

	cancelPending := map[string]any{"sessionID": sessionID, "inputID": "queue-2", "queueVersion": promotedVersion}
	cancelRecorder, cancelResponse := callAgentControlAPI(t, cancelAgentQueue, http.MethodPost, "/api/ai/agent/queue/cancel", cancelPending)
	if cancelRecorder.Code != http.StatusOK || int64(decodeAgentControlData(t, cancelResponse)["queueVersion"].(float64)) != promotedVersion+1 {
		t.Fatalf("cancel pending queue: status=%d body=%s", cancelRecorder.Code, cancelRecorder.Body.String())
	}
}

func TestAgentSteerAPITurnMatchingAndSealing(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	executor := getAgentExecutor(sessionID)
	executor.turn.TurnStarted("turn-1")
	executor.turn.SetPhase("turn-1", agent.AgentTurnProvider)
	steer := func(inputID, turnID string) map[string]any {
		return map[string]any{
			"inputID": inputID, "sessionID": sessionID, "expectedTurnID": turnID,
			"userEntryID": "entry-" + inputID, "message": "guide",
		}
	}
	mismatchRecorder, mismatchResponse := callAgentControlAPI(t, agentSteer, http.MethodPost, "/api/ai/agent/steer", steer("steer-wrong", "turn-2"))
	if mismatchRecorder.Code != http.StatusConflict || decodeAgentControlData(t, mismatchResponse)["reason"] != "turn_mismatch" {
		t.Fatalf("steer mismatch: status=%d body=%s", mismatchRecorder.Code, mismatchRecorder.Body.String())
	}

	acceptedRecorder, _ := callAgentControlAPI(t, agentSteer, http.MethodPost, "/api/ai/agent/steer", steer("steer-1", "turn-1"))
	if acceptedRecorder.Code != http.StatusAccepted {
		t.Fatalf("steer admission: status=%d body=%s", acceptedRecorder.Code, acceptedRecorder.Body.String())
	}
	if claimed, err := executor.turn.ClaimSteers("turn-1", true); err != nil || len(claimed) != 1 {
		t.Fatalf("claim accepted steer: claimed=%+v err=%v", claimed, err)
	}
	if claimed, err := executor.turn.ClaimSteers("turn-1", true); err != nil || len(claimed) != 0 {
		t.Fatalf("final seal: claimed=%+v err=%v", claimed, err)
	}
	sealedRecorder, sealedResponse := callAgentControlAPI(t, agentSteer, http.MethodPost, "/api/ai/agent/steer", steer("steer-late", "turn-1"))
	if sealedRecorder.Code != http.StatusConflict || decodeAgentControlData(t, sealedResponse)["reason"] != "turn_not_steerable" {
		t.Fatalf("steer after seal: status=%d body=%s", sealedRecorder.Code, sealedRecorder.Body.String())
	}
}

func TestLegacyAgentChatKeepsBusyConflictContract(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	sessionsMu.Lock()
	runningSessions[sessionID] = &runningSession{app: "other-app"}
	sessionsMu.Unlock()
	payload := map[string]any{"sessionID": sessionID, "message": "hello", "language": "English"}
	recorder, _ := callAgentControlAPI(t, agentChat, http.MethodPost, "/api/ai/agent/chat", payload)
	if recorder.Code != http.StatusConflict {
		t.Fatalf("legacy busy contract: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	if recorder.Header().Get("Content-Type") == "text/event-stream" {
		t.Fatalf("busy legacy chat must not start an SSE response: %s", recorder.Body.String())
	}
}

func TestAgentControlErrorMapsMissingInputPrecisely(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	recorder, response := callAgentControlAPI(t, cancelAgentQueue, http.MethodPost, "/api/ai/agent/queue/cancel", map[string]any{
		"sessionID": sessionID, "inputID": "missing", "queueVersion": int64(0),
	})
	if recorder.Code != http.StatusNotFound || decodeAgentControlData(t, response)["reason"] != "input_not_found" {
		t.Fatalf("missing queue input: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	if !agent.SessionExists(sessionID) || getAgentExecutor(sessionID).manager.SnapshotVersioned(sessionID).QueueVersion != 0 {
		t.Fatal("missing-input request changed session or queue")
	}
}

func TestAgentControlAdmissionRejectsExecutorRecoveryFailure(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	executor := getAgentExecutor(sessionID)
	executor.initErr = errors.New("queue recovery failed")
	recorder, response := callAgentControlAPI(t, agentQueue, http.MethodPost, "/api/ai/agent/queue", map[string]any{
		"inputID": "queue-after-recovery-error", "sessionID": sessionID,
		"userEntryID": "entry-after-recovery-error", "message": "must stay rejected", "language": "English",
	})
	if recorder.Code != http.StatusInternalServerError || decodeAgentControlData(t, response)["reason"] != "internal_error" {
		t.Fatalf("recovery failure admission: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	if snapshot := executor.manager.SnapshotVersioned(sessionID); len(snapshot.Items) != 0 || snapshot.QueueVersion != 0 {
		t.Fatalf("failed recovery admission changed queue: %+v", snapshot)
	}
}

func TestAgentQueueRunnerWaitsForSuccessfulSessionCommit(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	providerRequests := make(chan struct{}, 4)
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		providerRequests <- struct{}{}
		w.Header().Set("Content-Type", "text/event-stream")
		flusher, ok := w.(http.Flusher)
		if !ok {
			t.Error("provider response does not support flushing")
			return
		}
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"answer\"}}]}\n\n"))
		flusher.Flush()
		_, _ = w.Write([]byte("data: [DONE]\n\n"))
		flusher.Flush()
	}))
	defer provider.Close()
	model.Conf.AI.Providers[0].BaseURL = provider.URL + "/v1"

	chatPayload := map[string]any{
		"sessionID": sessionID, "userEntryID": "user-root", "contentRevision": int64(1),
		"message": "hello", "language": "English",
	}
	chatBody, err := json.Marshal(chatPayload)
	if err != nil {
		t.Fatal(err)
	}
	chatRecorder := httptest.NewRecorder()
	chatRequest := httptest.NewRequest(http.MethodPost, "/api/ai/agent/chat", bytes.NewReader(chatBody))
	chatRequest.RemoteAddr = "127.0.0.1:6806"
	chatRequest.Header.Set("Content-Type", "application/json")
	chatContext, _ := gin.CreateTestContext(chatRecorder)
	chatContext.Request = chatRequest
	agentChat(chatContext)
	if chatRecorder.Code != http.StatusOK || chatRecorder.Header().Get("Content-Type") != "text/event-stream" {
		t.Fatalf("legacy chat did not complete as SSE: status=%d body=%s", chatRecorder.Code, chatRecorder.Body.String())
	}
	select {
	case <-providerRequests:
	case <-time.After(5 * time.Second):
		t.Fatal("initial provider request did not execute")
	}
	executor := getAgentExecutor(sessionID)
	turnState := executor.turn.State()
	if turnState.TurnID == "" || !turnState.AwaitingCommit {
		t.Fatalf("initial turn did not reach commit barrier: %+v", turnState)
	}

	queuePayload := map[string]any{
		"inputID": "queue-after-commit", "sessionID": sessionID, "userEntryID": "queued-entry",
		"message": "queued after first answer", "language": "English",
	}
	queueRecorder, _ := callAgentControlAPI(t, agentQueue, http.MethodPost, "/api/ai/agent/queue", queuePayload)
	if queueRecorder.Code != http.StatusAccepted {
		t.Fatalf("queue admission: status=%d body=%s", queueRecorder.Code, queueRecorder.Body.String())
	}
	eventCtx, eventCancel := context.WithCancel(context.Background())
	defer eventCancel()
	events, unsubscribe := executor.hub.subscribe(eventCtx, 0)
	defer unsubscribe()

	savePayload := map[string]any{
		"id": sessionID, "title": "queue api", "createdAt": int64(1), "updatedAt": int64(2),
		"entries":      []any{map[string]any{"id": "user-root", "type": "user", "content": "hello"}},
		"commitTurnID": turnState.TurnID, "expectedRevision": int64(0),
	}
	failedRecorder, _ := callAgentControlAPI(t, saveSession, http.MethodPost, "/api/ai/agent/saveSession", savePayload)
	if failedRecorder.Code != http.StatusConflict {
		t.Fatalf("stale save should conflict: status=%d body=%s", failedRecorder.Code, failedRecorder.Body.String())
	}
	if state := executor.turn.State(); state.TurnID != turnState.TurnID || !state.AwaitingCommit {
		t.Fatalf("failed save crossed commit barrier: %+v", state)
	}
	snapshot := executor.manager.SnapshotVersioned(sessionID)
	if len(snapshot.Items) < 2 || snapshot.Items[len(snapshot.Items)-1].State != agentqueue.StatusPending {
		t.Fatalf("failed save promoted queue: %+v", snapshot)
	}
	select {
	case <-providerRequests:
		t.Fatal("queued provider request started before commit")
	case <-time.After(100 * time.Millisecond):
	}

	savePayload["expectedRevision"] = int64(1)
	successRecorder, _ := callAgentControlAPI(t, saveSession, http.MethodPost, "/api/ai/agent/saveSession", savePayload)
	if successRecorder.Code != http.StatusOK {
		t.Fatalf("turn commit failed: status=%d body=%s", successRecorder.Code, successRecorder.Body.String())
	}

	seenCommitted := false
	seenPromoted := false
	deadline := time.After(5 * time.Second)
	for !seenCommitted || !seenPromoted {
		select {
		case event := <-events:
			switch event.Type {
			case "turn_committed":
				seenCommitted = event.Data["turnID"] == turnState.TurnID
			case "input_promoted":
				seenPromoted = event.Data["inputID"] == "queue-after-commit" && event.Data["userEntryID"] == "queued-entry"
			}
		case <-deadline:
			t.Fatalf("commit/promotion events missing: committed=%v promoted=%v", seenCommitted, seenPromoted)
		}
	}
	select {
	case <-providerRequests:
	case <-time.After(5 * time.Second):
		t.Fatal("queued provider request did not execute after commit")
	}
	queuedDone := false
	deadline = time.After(5 * time.Second)
	for !queuedDone {
		select {
		case event := <-events:
			queuedDone = event.Type == "done" && event.Data["turnID"] != "" && event.Data["turnID"] != turnState.TurnID
		case <-deadline:
			t.Fatal("queued turn did not reach done")
		}
	}

	stored, err := agent.GetSession(sessionID)
	if err != nil {
		t.Fatal(err)
	}
	entries, _ := stored["entries"].([]any)
	queuedEntryFound := false
	for _, raw := range entries {
		entry, _ := raw.(map[string]any)
		if entry["id"] == "queued-entry" && entry["type"] == "user" && entry["content"] == "queued after first answer" {
			queuedEntryFound = true
		}
	}
	if !queuedEntryFound || stored["future"] == nil {
		t.Fatalf("queued promotion changed upstream session shape: %#v", stored)
	}
}
