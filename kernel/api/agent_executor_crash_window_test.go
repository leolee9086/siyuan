// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
	"github.com/siyuan-note/siyuan/packages/agentqueue"
)

func TestAgentExecutorReleasesClaimWhenAnchorPrecedesRuntime(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	manager := agentqueue.NewInboxManager(agentqueue.DefaultCapacity)
	inbox := manager.GetOrCreateInbox(sessionID)
	if err := prepareAgentInboxPersistence(inbox, util.DataDir); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.Submit(&agentqueue.Input{
		ID: "queue-before-runtime", SessionID: sessionID,
		Semantics: agentqueue.SemanticsQueue, Content: "retry after restart",
	}); err != nil {
		t.Fatal(err)
	}
	claimed, err := manager.ClaimNextQueued(sessionID)
	if err != nil || claimed == nil {
		t.Fatalf("claim queue: input=%+v err=%v", claimed, err)
	}
	store, err := newFileAgentExecutorAnchorStore(util.DataDir)
	if err != nil {
		t.Fatal(err)
	}
	if err = store.Save(agentExecutorAnchor{SessionID: sessionID, InputID: claimed.ID}); err != nil {
		t.Fatal(err)
	}

	restoredManager := agentqueue.NewInboxManager(agentqueue.DefaultCapacity)
	restoredInbox := restoredManager.GetOrCreateInbox(sessionID)
	if err = prepareAgentInboxPersistence(restoredInbox, util.DataDir); err != nil {
		t.Fatal(err)
	}
	restored := newAgentSessionExecutor(sessionID, restoredManager)
	restored.anchorStore = store
	if err = restored.reconcilePersistedRuntime(); err != nil {
		t.Fatal(err)
	}
	snapshot := restoredManager.SnapshotVersioned(sessionID)
	if len(snapshot.Items) != 1 || snapshot.Items[0].State != agentqueue.StatusPending {
		t.Fatalf("unstarted claim was not released: %+v", snapshot)
	}
	if anchor, loadErr := store.Load(sessionID); loadErr != nil || anchor != nil {
		t.Fatalf("unstarted anchor remained: anchor=%+v err=%v", anchor, loadErr)
	}
	if err = restored.reconcilePersistedRuntime(); err != nil {
		t.Fatalf("idempotent reconcile failed: %v", err)
	}
}

func TestAgentExecutorFinalizesCommittedInputAfterAnchorDeleteCrash(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	providerRequests := 0
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		providerRequests++
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"answer\"}}]}\n\n"))
		_, _ = w.Write([]byte("data: [DONE]\n\n"))
	}))
	t.Cleanup(provider.Close)
	model.Conf.AI.Providers[0].BaseURL = provider.URL + "/v1"

	payload := map[string]any{
		"inputID": "queue-committed-crash", "sessionID": sessionID,
		"userEntryID": "entry-committed-crash", "message": "commit once", "language": "English",
	}
	recorder, _ := callAgentControlAPI(t, agentQueue, http.MethodPost, "/api/ai/agent/queue", payload)
	if recorder.Code != http.StatusAccepted {
		t.Fatalf("queue admission: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	original := getAgentExecutor(sessionID)
	agentExecutorsMu.Lock()
	delete(agentExecutors, sessionID)
	agentExecutorsMu.Unlock()
	original.stop()
	select {
	case <-original.doneCh:
	case <-time.After(5 * time.Second):
		t.Fatal("original executor did not stop")
	}
	input, err := original.manager.ClaimNextQueued(sessionID)
	if err != nil || input == nil {
		t.Fatalf("claim queue: input=%+v err=%v", input, err)
	}
	if err = original.beginInputAnchor(input.ID); err != nil {
		t.Fatal(err)
	}
	turnID := ""
	for event := range original.runAgentChat(context.Background(), input) {
		if event.Type == "turn" {
			turnID = event.TurnID
			if err = original.bindInputTurn(input.ID, turnID); err != nil {
				t.Fatal(err)
			}
		}
	}
	if turnID == "" {
		t.Fatal("queued turn did not start")
	}
	session, err := agent.GetSession(sessionID)
	if err != nil {
		t.Fatal(err)
	}
	session["commitTurnID"] = turnID
	data, err := json.Marshal(session)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err = agent.SaveSessionState(data); err != nil {
		t.Fatal(err)
	}

	restoredManager := agentqueue.NewInboxManager(agentqueue.DefaultCapacity)
	restoredInbox := restoredManager.GetOrCreateInbox(sessionID)
	if err = prepareAgentInboxPersistence(restoredInbox, util.DataDir); err != nil {
		t.Fatal(err)
	}
	restored := newAgentSessionExecutor(sessionID, restoredManager)
	restored.anchorStore, err = newFileAgentExecutorAnchorStore(util.DataDir)
	if err != nil {
		t.Fatal(err)
	}
	if err = restored.reconcilePersistedRuntime(); err != nil {
		t.Fatal(err)
	}
	snapshot := restoredManager.SnapshotVersioned(sessionID)
	if len(snapshot.Items) != 1 || snapshot.Items[0].State != agentqueue.StatusInjected {
		t.Fatalf("committed source was not finalized: %+v", snapshot)
	}
	if anchor, loadErr := restored.anchorStore.Load(sessionID); loadErr != nil || anchor != nil {
		t.Fatalf("committed anchor remained: anchor=%+v err=%v", anchor, loadErr)
	}
	if providerRequests != 1 {
		t.Fatalf("committed source executed %d times", providerRequests)
	}
}

func TestAcceptedSteerDoesNotCrossTurnAfterRestart(t *testing.T) {
	sessionID := setupAgentControlAPITest(t)
	manager := agentqueue.NewInboxManager(agentqueue.DefaultCapacity)
	inbox := manager.GetOrCreateInbox(sessionID)
	if err := prepareAgentInboxPersistence(inbox, util.DataDir); err != nil {
		t.Fatal(err)
	}
	control := newAgentTurnController(sessionID, manager)
	control.TurnStarted("turn-old")
	control.SetPhase("turn-old", agent.AgentTurnProvider)
	if _, err := control.AdmitSteer(&agentqueue.Input{
		ID: "steer-old", SessionID: sessionID, Semantics: agentqueue.SemanticsSteer,
		ExpectedTurnID: "turn-old", Content: "old guidance",
	}); err != nil {
		t.Fatal(err)
	}
	control.TurnTerminated("turn-old")

	restoredManager := agentqueue.NewInboxManager(agentqueue.DefaultCapacity)
	restoredInbox := restoredManager.GetOrCreateInbox(sessionID)
	if err := prepareAgentInboxPersistence(restoredInbox, util.DataDir); err != nil {
		t.Fatal(err)
	}
	restored := newAgentTurnController(sessionID, restoredManager)
	restored.TurnStarted("turn-new")
	restored.SetPhase("turn-new", agent.AgentTurnProvider)
	claimed, err := restored.ClaimSteers("turn-new", true)
	if err != nil {
		t.Fatal(err)
	}
	if len(claimed) != 0 {
		t.Fatalf("old steer crossed into new turn: %+v", claimed)
	}
	snapshot := restoredManager.SnapshotVersioned(sessionID)
	if len(snapshot.Items) != 1 || snapshot.Items[0].State != agentqueue.StatusFailed {
		t.Fatalf("old steer recovery state: %+v", snapshot)
	}
}
