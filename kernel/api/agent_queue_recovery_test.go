// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
	"github.com/siyuan-note/siyuan/packages/agentqueue"
)

func TestAgentQueueRestoresPayloadAndExecutesWithoutMetadata(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	providerRequests := make(chan struct{}, 2)
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		providerRequests <- struct{}{}
		w.Header().Set("Content-Type", "text/event-stream")
		flusher := w.(http.Flusher)
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"restored answer\"}}]}\n\n"))
		flusher.Flush()
		_, _ = w.Write([]byte("data: [DONE]\n\n"))
		flusher.Flush()
	}))
	t.Cleanup(provider.Close)
	model.Conf.AI.Providers[0].BaseURL = provider.URL + "/v1"

	queuePayload := map[string]any{
		"inputID": "queue-restored", "sessionID": sessionID, "userEntryID": "entry-restored",
		"message": "execute after restart", "language": "English",
	}
	recorder, _ := callAgentControlAPI(t, agentQueue, http.MethodPost, "/api/ai/agent/queue", queuePayload)
	if recorder.Code != http.StatusAccepted {
		t.Fatalf("queue admission: status=%d body=%s", recorder.Code, recorder.Body.String())
	}

	restoredManager := agentqueue.NewInboxManager(agentqueue.DefaultCapacity)
	restoredInbox := restoredManager.GetOrCreateInbox(sessionID)
	if err := prepareAgentInboxPersistence(restoredInbox, util.DataDir); err != nil {
		t.Fatal(err)
	}
	restored := restoredManager.SnapshotVersioned(sessionID)
	if len(restored.Items) != 1 || restored.Items[0].State != agentqueue.StatusPending {
		t.Fatalf("restored queue snapshot: %+v", restored)
	}
	if restored.Items[0].Input.Metadata != nil || len(restored.Items[0].Input.Payload) == 0 {
		t.Fatalf("restored input did not use stable payload: %+v", restored.Items[0].Input)
	}
	params, err := decodeAgentTurnParams(restored.Items[0].Input)
	if err != nil || params.UserEntryID != "entry-restored" {
		t.Fatalf("decode restored turn payload: params=%+v err=%v", params, err)
	}

	executor := newAgentSessionExecutor(sessionID, restoredManager)
	executor.anchorStore, err = newFileAgentExecutorAnchorStore(util.DataDir)
	if err != nil {
		t.Fatal(err)
	}
	go executor.run()
	t.Cleanup(func() {
		select {
		case <-executor.doneCh:
			return
		default:
			close(executor.stopCh)
		}
		select {
		case <-executor.doneCh:
		case <-time.After(5 * time.Second):
			t.Error("restored executor did not stop")
		}
	})
	eventCtx, eventCancel := context.WithCancel(context.Background())
	t.Cleanup(eventCancel)
	events, unsubscribe := executor.hub.subscribe(eventCtx, 0)
	t.Cleanup(unsubscribe)
	executor.signalDrain()

	seenPromoted := false
	seenDone := false
	deadline := time.After(5 * time.Second)
	for !seenPromoted || !seenDone {
		select {
		case event := <-events:
			switch event.Type {
			case "input_promoted":
				seenPromoted = event.Data["inputID"] == "queue-restored"
			case "done":
				seenDone = event.Data["turnID"] != ""
			}
		case <-deadline:
			t.Fatalf("restored queue events missing: promoted=%v done=%v", seenPromoted, seenDone)
		}
	}
	select {
	case <-providerRequests:
	case <-time.After(5 * time.Second):
		t.Fatal("restored queue did not reach provider")
	}

	deadlineAt := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadlineAt) {
		if snapshot := restoredManager.SnapshotVersioned(sessionID); len(snapshot.Items) == 1 && snapshot.Items[0].State == agentqueue.StatusInjected {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	finalSnapshot := restoredManager.SnapshotVersioned(sessionID)
	if len(finalSnapshot.Items) != 1 || finalSnapshot.Items[0].State != agentqueue.StatusInjected {
		t.Fatalf("restored queue was not completed: %+v", finalSnapshot)
	}

	verificationInbox := agentqueue.NewSessionInbox(sessionID, agentqueue.DefaultCapacity)
	if err = prepareAgentInboxPersistence(verificationInbox, util.DataDir); err != nil {
		t.Fatal(err)
	}
	persisted := verificationInbox.SnapshotVersioned()
	if len(persisted.Items) != 1 || persisted.Items[0].State != agentqueue.StatusInjected {
		t.Fatalf("completed restored queue was not persisted: %+v", persisted)
	}
	stored, err := agent.GetSession(sessionID)
	if err != nil || stored["future"] == nil {
		t.Fatalf("upstream session data drifted after restored run: session=%#v err=%v", stored, err)
	}
}

func TestAgentExecutorReconcilesRuntimeSourceBeforeAdvancingQueue(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	providerRequests := make(chan struct{}, 4)
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		providerRequests <- struct{}{}
		w.Header().Set("Content-Type", "text/event-stream")
		flusher := w.(http.Flusher)
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"answer\"}}]}\n\n"))
		flusher.Flush()
		_, _ = w.Write([]byte("data: [DONE]\n\n"))
		flusher.Flush()
	}))
	t.Cleanup(provider.Close)
	model.Conf.AI.Providers[0].BaseURL = provider.URL + "/v1"

	for _, queued := range []map[string]any{
		{"inputID": "queue-crash-1", "userEntryID": "entry-crash-1", "message": "first"},
		{"inputID": "queue-crash-2", "userEntryID": "entry-crash-2", "message": "second"},
	} {
		queued["sessionID"] = sessionID
		queued["language"] = "English"
		recorder, _ := callAgentControlAPI(t, agentQueue, http.MethodPost, "/api/ai/agent/queue", queued)
		if recorder.Code != http.StatusAccepted {
			t.Fatalf("queue admission: status=%d body=%s", recorder.Code, recorder.Body.String())
		}
	}
	original := getAgentExecutor(sessionID)
	agentExecutorsMu.Lock()
	delete(agentExecutors, sessionID)
	agentExecutorsMu.Unlock()
	close(original.stopCh)
	select {
	case <-original.doneCh:
	case <-time.After(5 * time.Second):
		t.Fatal("original executor did not stop")
	}

	first, err := original.manager.ClaimNextQueued(sessionID)
	if err != nil || first == nil || first.ID != "queue-crash-1" {
		t.Fatalf("claim first queue: input=%+v err=%v", first, err)
	}
	if err = original.beginInputAnchor(first.ID); err != nil {
		t.Fatal(err)
	}
	firstEvents := original.runQueuedAgentChat(context.Background(), first)
	firstTurnID := ""
	for event := range firstEvents {
		if event.Type == "turn" {
			firstTurnID = event.TurnID
			if err = original.bindInputTurn(first.ID, firstTurnID); err != nil {
				t.Fatal(err)
			}
		}
	}
	if firstTurnID == "" || !original.turn.State().AwaitingCommit {
		t.Fatalf("crash fixture runtime was not terminal: turn=%s state=%+v", firstTurnID, original.turn.State())
	}
	select {
	case <-providerRequests:
	case <-time.After(5 * time.Second):
		t.Fatal("first queue did not reach provider")
	}

	restoredManager := agentqueue.NewInboxManager(agentqueue.DefaultCapacity)
	restoredInbox := restoredManager.GetOrCreateInbox(sessionID)
	if err = prepareAgentInboxPersistence(restoredInbox, util.DataDir); err != nil {
		t.Fatal(err)
	}
	restoredExecutor := newAgentSessionExecutor(sessionID, restoredManager)
	restoredExecutor.anchorStore, err = newFileAgentExecutorAnchorStore(util.DataDir)
	if err != nil {
		t.Fatal(err)
	}
	if err = restoredExecutor.reconcilePersistedRuntime(); err != nil {
		t.Fatal(err)
	}
	recoveredState := restoredExecutor.turn.State()
	if recoveredState.TurnID != firstTurnID || !recoveredState.AwaitingCommit {
		t.Fatalf("runtime source did not restore commit barrier: %+v", recoveredState)
	}
	restoredSnapshot := restoredManager.SnapshotVersioned(sessionID)
	if len(restoredSnapshot.Items) != 2 || restoredSnapshot.Items[0].State != agentqueue.StatusInjecting || restoredSnapshot.Items[1].State != agentqueue.StatusPending {
		t.Fatalf("runtime source claim was not reconciled: %+v", restoredSnapshot)
	}

	agentExecutorsMu.Lock()
	agentExecutors[sessionID] = restoredExecutor
	agentExecutorsMu.Unlock()
	t.Cleanup(func() { agentInboxManager.RemoveSession(sessionID) })
	go restoredExecutor.run()
	eventCtx, eventCancel := context.WithCancel(context.Background())
	t.Cleanup(eventCancel)
	events, unsubscribe := restoredExecutor.hub.subscribe(eventCtx, 0)
	t.Cleanup(unsubscribe)
	restoredExecutor.signalDrain()
	select {
	case <-providerRequests:
		t.Fatal("runtime source was started a second time before commit")
	case <-time.After(100 * time.Millisecond):
	}

	storedBeforeCommit, err := agent.GetSession(sessionID)
	if err != nil {
		t.Fatal(err)
	}
	storedBeforeCommit["commitTurnID"] = firstTurnID
	commitRecorder, _ := callAgentControlAPI(t, saveSession, http.MethodPost, "/api/ai/agent/saveSession", storedBeforeCommit)
	if commitRecorder.Code != http.StatusOK {
		t.Fatalf("recover runtime commit: status=%d body=%s", commitRecorder.Code, commitRecorder.Body.String())
	}

	seenSecondPromotion := false
	seenSecondDone := false
	deadline := time.After(5 * time.Second)
	for !seenSecondPromotion || !seenSecondDone {
		select {
		case event := <-events:
			switch event.Type {
			case "input_promoted":
				seenSecondPromotion = event.Data["inputID"] == "queue-crash-2"
			case "done":
				seenSecondDone = event.Data["turnID"] != "" && event.Data["turnID"] != firstTurnID
			}
		case <-deadline:
			t.Fatalf("second queue did not advance after recovery commit: promoted=%v done=%v", seenSecondPromotion, seenSecondDone)
		}
	}
	select {
	case <-providerRequests:
	case <-time.After(5 * time.Second):
		t.Fatal("second queue did not reach provider")
	}
	select {
	case <-providerRequests:
		t.Fatal("runtime source was executed more than once")
	case <-time.After(100 * time.Millisecond):
	}

	deadlineAt := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadlineAt) {
		snapshot := restoredManager.SnapshotVersioned(sessionID)
		if len(snapshot.Items) == 2 && snapshot.Items[0].State == agentqueue.StatusInjected && snapshot.Items[1].State == agentqueue.StatusInjected {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	finalSnapshot := restoredManager.SnapshotVersioned(sessionID)
	if len(finalSnapshot.Items) != 2 || finalSnapshot.Items[0].State != agentqueue.StatusInjected || finalSnapshot.Items[1].State != agentqueue.StatusInjected {
		t.Fatalf("recovered queue completion state: %+v", finalSnapshot)
	}
	storedAfterRun, err := agent.GetSession(sessionID)
	if err != nil {
		t.Fatal(err)
	}
	counts := map[string]int{}
	for _, raw := range storedAfterRun["entries"].([]any) {
		entry := raw.(map[string]any)
		if id, _ := entry["id"].(string); id != "" {
			counts[id]++
		}
	}
	if counts["entry-crash-1"] != 1 || counts["entry-crash-2"] != 1 {
		t.Fatalf("runtime source user entry duplicated: counts=%v session=%#v", counts, storedAfterRun)
	}
}
