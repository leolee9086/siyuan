package agentqueue

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func queueInput(id, sessionID, content string) *Input {
	return &Input{
		ID:        id,
		SessionID: sessionID,
		Semantics: SemanticsQueue,
		Content:   content,
	}
}

func steerInput(id, sessionID, turnID, content string) *Input {
	return &Input{
		ID:             id,
		SessionID:      sessionID,
		Semantics:      SemanticsSteer,
		ExpectedTurnID: turnID,
		Content:        content,
	}
}

func TestSubmitDigestIdempotencyAndConflict(t *testing.T) {
	manager := NewInboxManager(10)
	first := queueInput("input-1", "session-1", "hello")
	first.Payload = json.RawMessage(`{"model":"m","options":{"a":1,"b":2}}`)
	result, err := manager.Submit(first)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Accepted || result.QueueVersion != 1 || result.ContentDigest == "" {
		t.Fatalf("unexpected first admission: %+v", result)
	}

	retry := queueInput("input-1", "session-1", "hello")
	retry.Payload = json.RawMessage(`{ "options": {"b":2,"a":1}, "model":"m" }`)
	retried, err := manager.Submit(retry)
	if err != nil {
		t.Fatal(err)
	}
	if !retried.Duplicated || retried.Seq != result.Seq || retried.QueueVersion != result.QueueVersion {
		t.Fatalf("retry should return original admission: first=%+v retry=%+v", result, retried)
	}
	if retried.ContentDigest != result.ContentDigest {
		t.Fatalf("canonical payload digest changed: %s != %s", retried.ContentDigest, result.ContentDigest)
	}

	conflict := queueInput("input-1", "session-1", "different")
	if _, err = manager.Submit(conflict); !errors.Is(err, ErrInputIDConflict) {
		t.Fatalf("same id with different content: got %v, want ErrInputIDConflict", err)
	}
	if snapshot := manager.SnapshotVersioned("session-1"); snapshot.QueueVersion != 1 || len(snapshot.Items) != 1 {
		t.Fatalf("conflict changed queue: %+v", snapshot)
	}
}

func TestDeliveryValidation(t *testing.T) {
	inbox := NewSessionInbox("session-1", 10)
	if _, err := inbox.Submit(steerInput("steer", "session-1", "", "guide")); !errors.Is(err, ErrExpectedTurnIDRequired) {
		t.Fatalf("steer without turn: %v", err)
	}
	queued := queueInput("queue", "session-1", "later")
	queued.ExpectedTurnID = "turn-1"
	if _, err := inbox.Submit(queued); !errors.Is(err, ErrExpectedTurnIDForbidden) {
		t.Fatalf("queue with turn: %v", err)
	}
	if snapshot := inbox.SnapshotVersioned(); snapshot.QueueVersion != 0 || len(snapshot.Items) != 0 {
		t.Fatalf("rejected delivery mutated queue: %+v", snapshot)
	}
}

func TestPreciseClaimsDoNotLeakSemanticsOrTurn(t *testing.T) {
	manager := NewInboxManager(20)
	inputs := []*Input{
		queueInput("queue-1", "session-1", "first"),
		{ID: "user-1", SessionID: "session-1", Semantics: SemanticsUserMessage, Content: "legacy"},
		steerInput("steer-a-1", "session-1", "turn-a", "guide one"),
		queueInput("queue-2", "session-1", "second"),
		steerInput("steer-b", "session-1", "turn-b", "other turn"),
		steerInput("steer-a-2", "session-1", "turn-a", "guide two"),
	}
	for _, input := range inputs {
		if _, err := manager.Submit(input); err != nil {
			t.Fatal(err)
		}
	}

	claimed, err := manager.ClaimSteerBatch("session-1", "turn-a", 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(claimed) != 1 || claimed[0].ID != "steer-a-1" {
		t.Fatalf("cutoff claim leaked inputs: %+v", claimed)
	}
	next, err := manager.ClaimNextQueued("session-1")
	if err != nil {
		t.Fatal(err)
	}
	if next == nil || next.ID != "queue-1" {
		t.Fatalf("queue claim should ignore pending steers: %+v", next)
	}
	user, err := manager.ClaimNextUserMessage("session-1")
	if err != nil || user == nil || user.ID != "user-1" {
		t.Fatalf("user message claim should ignore queues and steers: input=%+v err=%v", user, err)
	}
	byID, err := manager.ClaimByID("session-1", "steer-b", SemanticsSteer)
	if err != nil || byID == nil || byID.ID != "steer-b" {
		t.Fatalf("claim by id failed: input=%+v err=%v", byID, err)
	}
	if _, err = manager.ClaimByID("session-1", "queue-2", SemanticsInterrupt); !errors.Is(err, ErrSemanticsMismatch) {
		t.Fatalf("semantics mismatch: %v", err)
	}

	claimed, err = manager.ClaimSteerBatch("session-1", "turn-a", 0)
	if err != nil || len(claimed) != 1 || claimed[0].ID != "steer-a-2" {
		t.Fatalf("final steer claim: %+v err=%v", claimed, err)
	}
	next, err = manager.ClaimNextQueued("session-1")
	if err != nil || next == nil || next.ID != "queue-2" {
		t.Fatalf("second queue claim: %+v err=%v", next, err)
	}
}

func TestPendingEditUsesQueueVersion(t *testing.T) {
	manager := NewInboxManager(10)
	if _, err := manager.Submit(queueInput("queue-1", "session-1", "old")); err != nil {
		t.Fatal(err)
	}
	version := manager.SnapshotVersioned("session-1").QueueVersion
	replacement := queueInput("ignored", "ignored", "new")
	newVersion, err := manager.UpdatePending("session-1", "queue-1", version, replacement)
	if err != nil {
		t.Fatal(err)
	}
	if newVersion != version+1 {
		t.Fatalf("version after edit: got %d, want %d", newVersion, version+1)
	}
	if _, err = manager.UpdatePending("session-1", "queue-1", version, replacement); !errors.Is(err, ErrQueueVersionConflict) {
		t.Fatalf("stale edit: got %v", err)
	}
	snapshot := manager.SnapshotVersioned("session-1")
	if snapshot.Items[0].Input.Content != "new" || snapshot.Items[0].Input.ID != "queue-1" {
		t.Fatalf("edit did not preserve identity or content: %+v", snapshot.Items[0].Input)
	}
}

func TestPendingSemanticMutationRejectsPromotedInput(t *testing.T) {
	manager := NewInboxManager(10)
	if _, err := manager.Submit(queueInput("queue-1", "session-1", "old")); err != nil {
		t.Fatal(err)
	}
	version := manager.SnapshotVersioned("session-1").QueueVersion
	if _, _, err := manager.PromotePendingQueue("session-1", "queue-1", version, "turn-1"); err != nil {
		t.Fatal(err)
	}
	promotedVersion := manager.SnapshotVersioned("session-1").QueueVersion
	replacement := queueInput("ignored", "ignored", "new")
	if _, err := manager.UpdatePendingBySemantics("session-1", "queue-1", promotedVersion, SemanticsQueue, replacement); !errors.Is(err, ErrSemanticsMismatch) {
		t.Fatalf("edit promoted queue: %v", err)
	}
	if _, err := manager.CancelPendingBySemantics("session-1", "queue-1", promotedVersion, SemanticsQueue); !errors.Is(err, ErrSemanticsMismatch) {
		t.Fatalf("cancel promoted queue: %v", err)
	}
	snapshot := manager.SnapshotVersioned("session-1")
	if snapshot.QueueVersion != promotedVersion || snapshot.Items[0].Input.Semantics != SemanticsSteer || snapshot.Items[0].Input.Content != "old" {
		t.Fatalf("rejected semantic mutation changed queue: %+v", snapshot)
	}
}

func TestPendingEditRacesWithPromotion(t *testing.T) {
	for iteration := 0; iteration < 100; iteration++ {
		manager := NewInboxManager(10)
		if _, err := manager.Submit(queueInput("queue-1", "session-1", "old")); err != nil {
			t.Fatal(err)
		}
		version := manager.SnapshotVersioned("session-1").QueueVersion
		start := make(chan struct{})
		var wg sync.WaitGroup
		var editErr, promoteErr error
		wg.Add(2)
		go func() {
			defer wg.Done()
			<-start
			_, editErr = manager.UpdatePendingBySemantics("session-1", "queue-1", version, SemanticsQueue, queueInput("replacement", "session-1", "new"))
		}()
		go func() {
			defer wg.Done()
			<-start
			_, _, promoteErr = manager.PromotePendingQueue("session-1", "queue-1", version, "turn-1")
		}()
		close(start)
		wg.Wait()

		if (editErr == nil) == (promoteErr == nil) {
			t.Fatalf("iteration %d: exactly one mutation must win: edit=%v promote=%v", iteration, editErr, promoteErr)
		}
		if editErr != nil && !errors.Is(editErr, ErrQueueVersionConflict) {
			t.Fatalf("iteration %d: edit loser: %v", iteration, editErr)
		}
		if promoteErr != nil && !errors.Is(promoteErr, ErrQueueVersionConflict) {
			t.Fatalf("iteration %d: promote loser: %v", iteration, promoteErr)
		}
	}
}

func TestPromotePendingQueueIsAtomicAndPreservesPayload(t *testing.T) {
	manager := NewInboxManager(10)
	queued := queueInput("queue-1", "session-1", "later")
	queued.Payload = json.RawMessage(`{"modelID":"m","userEntryID":"entry-1"}`)
	if _, err := manager.Submit(queued); err != nil {
		t.Fatal(err)
	}
	version := manager.SnapshotVersioned("session-1").QueueVersion
	promoted, nextVersion, err := manager.PromotePendingQueue("session-1", "queue-1", version, "turn-1")
	if err != nil || promoted == nil {
		t.Fatalf("promote: input=%+v version=%d err=%v", promoted, nextVersion, err)
	}
	if promoted.Semantics != SemanticsSteer || promoted.ExpectedTurnID != "turn-1" || string(promoted.Payload) != string(queued.Payload) {
		t.Fatalf("promoted input changed payload or target: %+v", promoted)
	}
	snapshot := manager.SnapshotVersioned("session-1")
	if nextVersion != version+1 || snapshot.Items[0].State != StatusPending {
		t.Fatalf("promotion state: version=%d snapshot=%+v", nextVersion, snapshot)
	}
	if _, _, err = manager.PromotePendingQueue("session-1", "queue-1", version, "turn-2"); !errors.Is(err, ErrQueueVersionConflict) {
		t.Fatalf("stale promotion should conflict: %v", err)
	}
}

func TestReleaseClaimReturnsInputToPending(t *testing.T) {
	manager := NewInboxManager(10)
	if _, err := manager.Submit(queueInput("queue-1", "session-1", "later")); err != nil {
		t.Fatal(err)
	}
	claimed, err := manager.ClaimNextQueued("session-1")
	if err != nil || claimed == nil {
		t.Fatalf("claim: %+v %v", claimed, err)
	}
	if _, err = manager.ReleaseClaim("session-1", claimed.ID); err != nil {
		t.Fatal(err)
	}
	snapshot := manager.SnapshotVersioned("session-1")
	if snapshot.Items[0].State != StatusPending {
		t.Fatalf("released input state: %+v", snapshot)
	}
}

func TestCancelPendingRacesWithClaim(t *testing.T) {
	for iteration := 0; iteration < 100; iteration++ {
		manager := NewInboxManager(10)
		if _, err := manager.Submit(queueInput("queue-1", "session-1", "later")); err != nil {
			t.Fatal(err)
		}
		version := manager.SnapshotVersioned("session-1").QueueVersion
		start := make(chan struct{})
		var wg sync.WaitGroup
		var cancelErr, claimErr error
		var claimed *Input
		wg.Add(2)
		go func() {
			defer wg.Done()
			<-start
			_, cancelErr = manager.CancelPending("session-1", "queue-1", version)
		}()
		go func() {
			defer wg.Done()
			<-start
			claimed, claimErr = manager.ClaimNextQueued("session-1")
		}()
		close(start)
		wg.Wait()

		cancelled := cancelErr == nil
		promoted := claimErr == nil && claimed != nil
		if cancelled == promoted {
			t.Fatalf("iteration %d: exactly one transition must win: cancel=%v claim=%+v claimErr=%v", iteration, cancelErr, claimed, claimErr)
		}
		if claimErr != nil {
			t.Fatalf("claim should return nil when cancellation wins: %v", claimErr)
		}
		if !cancelled && !errors.Is(cancelErr, ErrQueueVersionConflict) && !errors.Is(cancelErr, ErrNotPending) {
			t.Fatalf("unexpected cancel loser error: %v", cancelErr)
		}
	}
}

type controlledStorage struct {
	mu       sync.Mutex
	failSave bool
	snapshot PersistedQueueSnapshot
	has      bool
}

func (storage *controlledStorage) SaveSession(_ string, snapshot PersistedQueueSnapshot) error {
	storage.mu.Lock()
	defer storage.mu.Unlock()
	if storage.failSave {
		return errors.New("injected save failure")
	}
	storage.snapshot = clonePersistedSnapshot(snapshot)
	storage.has = true
	return nil
}

func (storage *controlledStorage) LoadSession(_ string) (PersistedQueueSnapshot, bool, error) {
	storage.mu.Lock()
	defer storage.mu.Unlock()
	return clonePersistedSnapshot(storage.snapshot), storage.has, nil
}

func (storage *controlledStorage) DeleteSession(_ string) error { return nil }

func (storage *controlledStorage) setFailSave(fail bool) {
	storage.mu.Lock()
	storage.failSave = fail
	storage.mu.Unlock()
}

func TestPersistenceFailureRollsBackMemoryAndSignal(t *testing.T) {
	inbox := NewSessionInbox("session-1", 10)
	storage := &controlledStorage{failSave: true}
	inbox.AttachStorage(storage)
	if _, err := inbox.Submit(queueInput("queue-1", "session-1", "later")); err == nil {
		t.Fatal("submit should surface persistence failure")
	}
	if snapshot := inbox.SnapshotVersioned(); snapshot.QueueVersion != 0 || len(snapshot.Items) != 0 {
		t.Fatalf("failed submit published memory: %+v", snapshot)
	}
	select {
	case <-inbox.signal:
		t.Fatal("failed submit emitted wake signal")
	default:
	}

	storage.setFailSave(false)
	if _, err := inbox.Submit(queueInput("queue-1", "session-1", "later")); err != nil {
		t.Fatal(err)
	}
	select {
	case <-inbox.signal:
	default:
		t.Fatal("successful submit did not emit wake signal")
	}
	storage.setFailSave(true)
	if claimed, err := inbox.ClaimNextQueued(); err == nil || claimed != nil {
		t.Fatalf("failed claim should return no input and an error: input=%+v err=%v", claimed, err)
	}
	snapshot := inbox.SnapshotVersioned()
	if snapshot.QueueVersion != 1 || snapshot.Items[0].State != StatusPending {
		t.Fatalf("failed claim published candidate state: %+v", snapshot)
	}
}

func TestAutomaticPersistenceAndMetadataIsolation(t *testing.T) {
	storage := NewMemoryStorage()
	inbox := NewSessionInbox("session-1", 10)
	inbox.AttachStorage(storage)
	input := queueInput("queue-1", "session-1", "later")
	input.Metadata = map[string]any{"runtime": &struct{ Secret string }{Secret: "not-persisted"}}
	if _, err := inbox.Submit(input); err != nil {
		t.Fatal(err)
	}
	persisted, ok, err := storage.LoadSession("session-1")
	if err != nil || !ok {
		t.Fatalf("automatic save missing: ok=%v err=%v", ok, err)
	}
	if persisted.SchemaVersion != CurrentQueueSchemaVersion || persisted.QueueVersion != 1 || persisted.NextSeq != 1 {
		t.Fatalf("unexpected persisted header: %+v", persisted)
	}
	if persisted.Items[0].Input.Metadata != nil || persisted.Items[0].Input.PayloadVersion != CurrentPayloadVersion || persisted.Items[0].Input.ContentDigest == "" {
		t.Fatalf("unstable persisted input: %+v", persisted.Items[0].Input)
	}
	if _, err := inbox.ClaimNextQueued(); err != nil {
		t.Fatal(err)
	}
	persisted, _, _ = storage.LoadSession("session-1")
	if persisted.QueueVersion != 2 || persisted.Items[0].State != StatusInjecting {
		t.Fatalf("claim was not persisted: %+v", persisted)
	}

	restored := NewSessionInbox("session-1", 10)
	restored.AttachStorage(storage)
	if ok, err = restored.RestoreFromStorage(); err != nil || !ok {
		t.Fatalf("restore failed: ok=%v err=%v", ok, err)
	}
	snapshot := restored.SnapshotVersioned()
	if snapshot.QueueVersion != 3 || snapshot.Items[0].State != StatusPending {
		t.Fatalf("queue recovery was not persisted as a new version: %+v", snapshot)
	}
}

func TestFileStorageMigratesLegacyArray(t *testing.T) {
	dir := t.TempDir()
	storage, err := NewFileStorage(dir)
	if err != nil {
		t.Fatal(err)
	}
	legacy := []PersistedItem{{
		Input: queueInput("queue-1", "session-1", "later"),
		State: StatusInjecting,
		Seq:   7,
	}}
	data, err := json.Marshal(legacy)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "session-1.json")
	if err = os.WriteFile(path, data, 0o644); err != nil {
		t.Fatal(err)
	}

	inbox := NewSessionInbox("session-1", 10)
	inbox.AttachStorage(storage)
	if ok, restoreErr := inbox.RestoreFromStorage(); restoreErr != nil || !ok {
		t.Fatalf("legacy restore: ok=%v err=%v", ok, restoreErr)
	}
	snapshot := inbox.SnapshotVersioned()
	if snapshot.NextSeq != 7 || snapshot.QueueVersion != 1 || snapshot.Items[0].State != StatusPending {
		t.Fatalf("legacy migration state: %+v", snapshot)
	}
	migrated, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var header struct {
		SchemaVersion int `json:"schemaVersion"`
	}
	if len(migrated) == 0 || migrated[0] != '{' || json.Unmarshal(migrated, &header) != nil || header.SchemaVersion != CurrentQueueSchemaVersion {
		t.Fatalf("legacy file was not upgraded: %s", migrated)
	}
}

func TestRestoreRejectsUnknownSchemaAndPayloadVersion(t *testing.T) {
	dir := t.TempDir()
	storage, err := NewFileStorage(dir)
	if err != nil {
		t.Fatal(err)
	}
	unknownSchema := []byte(`{"schemaVersion":99,"queueVersion":1,"nextSeq":0,"items":[]}`)
	if err = os.WriteFile(filepath.Join(dir, "schema.json"), unknownSchema, 0o644); err != nil {
		t.Fatal(err)
	}
	if _, _, err = storage.LoadSession("schema"); !errors.Is(err, ErrUnsupportedQueueSchema) {
		t.Fatalf("unknown schema: %v", err)
	}

	memory := NewMemoryStorage()
	badInput := queueInput("queue-1", "payload", "later")
	badInput.PayloadVersion = CurrentPayloadVersion + 1
	if err = memory.SaveSession("payload", PersistedQueueSnapshot{
		SchemaVersion: CurrentQueueSchemaVersion,
		QueueVersion:  1,
		NextSeq:       1,
		Items:         []PersistedItem{{Input: badInput, State: StatusPending, Seq: 1}},
	}); err != nil {
		t.Fatal(err)
	}
	inbox := NewSessionInbox("payload", 10)
	inbox.AttachStorage(memory)
	if _, err = inbox.RestoreFromStorage(); !errors.Is(err, ErrUnsupportedPayloadVersion) {
		t.Fatalf("unknown payload version: %v", err)
	}
	if snapshot := inbox.SnapshotVersioned(); snapshot.QueueVersion != 0 || len(snapshot.Items) != 0 {
		t.Fatalf("failed restore published partial state: %+v", snapshot)
	}
}
