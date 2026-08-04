// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package agent

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/88250/gulu"
)

func TestAppendQueuedUserEntryPreservesUpstreamSessionData(t *testing.T) {
	useTestDataDir(t)
	base := map[string]any{
		"id":        testSessionID,
		"title":     "compat",
		"createdAt": int64(1),
		"updatedAt": int64(2),
		"entries":   []any{map[string]any{"id": "user-1", "type": "user", "content": "hello"}},
		"future":    map[string]any{"upstream": true},
		"messages":  []any{map[string]any{"role": "legacy", "content": "preserve fixture"}},
	}
	if revision, err := SaveSession(marshalSession(t, base)); err != nil || revision != 1 {
		t.Fatalf("save base session: revision=%d err=%v", revision, err)
	}

	entry := SessionEntry{
		ID:         "queued-user-1",
		Type:       "user",
		Content:    "queued message",
		BlockHTML:  "<p>queued message</p>",
		References: []Reference{{ID: "block-1", Title: "Block"}},
	}
	revision, err := AppendQueuedUserEntry(testSessionID, entry)
	if err != nil || revision != 2 {
		t.Fatalf("promote queued entry: revision=%d err=%v", revision, err)
	}
	data, err := os.ReadFile(filepath.Join(sessionsDir(), testSessionID, "session.json"))
	if err != nil {
		t.Fatal(err)
	}
	var stored map[string]any
	if err = gulu.JSON.UnmarshalJSON(data, &stored); err != nil {
		t.Fatal(err)
	}
	if future, ok := stored["future"].(map[string]any); !ok || future["upstream"] != true {
		t.Fatalf("unknown upstream field drifted: %#v", stored)
	}
	if _, ok := stored["messages"]; !ok {
		t.Fatalf("existing upstream/legacy field was erased: %#v", stored)
	}
	entries := stored["entries"].([]any)
	if len(entries) != 2 {
		t.Fatalf("queued user entry count: %#v", entries)
	}
	queued := entries[1].(map[string]any)
	if queued["type"] != "user" || queued["id"] != entry.ID || queued["blockHTML"] != entry.BlockHTML {
		t.Fatalf("queued entry is not an existing user shape: %#v", queued)
	}

	if repeatedRevision, repeatErr := AppendQueuedUserEntry(testSessionID, entry); repeatErr != nil || repeatedRevision != revision {
		t.Fatalf("idempotent promotion: revision=%d err=%v", repeatedRevision, repeatErr)
	}
	conflict := entry
	conflict.Content = "different"
	if _, conflictErr := AppendQueuedUserEntry(testSessionID, conflict); !errors.Is(conflictErr, ErrSessionConflict) {
		t.Fatalf("same entry id conflict: %v", conflictErr)
	}
}

func TestAppendQueuedUserEntryWaitsForCommittedRuntime(t *testing.T) {
	useTestDataDir(t)
	base := map[string]any{
		"id":        testSessionID,
		"title":     "barrier",
		"createdAt": int64(1),
		"updatedAt": int64(1),
		"entries":   []any{map[string]any{"id": "user-1", "type": "user", "content": "hello"}},
	}
	if _, err := SaveSession(marshalSession(t, base)); err != nil {
		t.Fatal(err)
	}
	turn := &agentRuntimeTurn{
		TurnID:       "20260803220000-abcdefg",
		Mode:         "append",
		UserEntryID:  "user-1",
		BaseRevision: 1,
		State:        "running",
	}
	if err := beginRuntimeTurn(testSessionID, turn, false); err != nil {
		t.Fatal(err)
	}
	entry := SessionEntry{ID: "queued-user-1", Type: "user", Content: "later"}
	if _, err := AppendQueuedUserEntry(testSessionID, entry); !errors.Is(err, ErrRuntimeNotFinalized) {
		t.Fatalf("uncommitted runtime barrier: %v", err)
	}
	stored, err := GetSessionState(testSessionID, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(stored["entries"].([]any)) != 1 {
		t.Fatalf("queued entry bypassed commit barrier: %#v", stored)
	}
}

func TestQueuedPromotionPreservesLegacyRuntimeAndIndexSchemas(t *testing.T) {
	useTestDataDir(t)
	base := map[string]any{
		"id":        testSessionID,
		"title":     "legacy fixtures",
		"createdAt": int64(1),
		"updatedAt": int64(2),
		"entries":   []any{map[string]any{"id": "user-1", "type": "user", "content": "hello"}},
	}
	if revision, err := SaveSession(marshalSession(t, base)); err != nil || revision != 1 {
		t.Fatalf("save fixture session: revision=%d err=%v", revision, err)
	}

	legacyIndex := []byte(`{"20260715120000-abcdefg":{"id":"20260715120000-abcdefg","title":"legacy fixtures","createdAt":1,"updatedAt":2}}`)
	if err := os.WriteFile(sessionsIndexPath(), legacyIndex, 0o600); err != nil {
		t.Fatal(err)
	}
	runtimeFixture := []byte(`{"schemaVersion":1,"revision":7,"sessionID":"20260715120000-abcdefg","alwaysAllow":true}`)
	if err := os.WriteFile(runtimePath(testSessionID), runtimeFixture, 0o600); err != nil {
		t.Fatal(err)
	}

	listed, err := ListSessions(1, 10, "", "", "native-agent")
	if err != nil || listed.Total != 1 || listed.Sessions[0].ID != testSessionID || listed.Sessions[0].TargetKind != "native-agent" {
		t.Fatalf("legacy index fixture was not readable: result=%+v err=%v", listed, err)
	}
	runtimeState, err := loadRuntimeState(testSessionID)
	if err != nil || runtimeState.SchemaVersion != 1 || runtimeState.Revision != 7 || !runtimeState.AlwaysAllow {
		t.Fatalf("legacy runtime fixture was not readable: runtime=%+v err=%v", runtimeState, err)
	}

	entry := SessionEntry{ID: "queued-user-1", Type: "user", Content: "queued message"}
	if revision, appendErr := AppendQueuedUserEntry(testSessionID, entry); appendErr != nil || revision != 2 {
		t.Fatalf("promote against legacy fixtures: revision=%d err=%v", revision, appendErr)
	}
	runtimeAfter, err := os.ReadFile(runtimePath(testSessionID))
	if err != nil {
		t.Fatal(err)
	}
	if string(runtimeAfter) != string(runtimeFixture) {
		t.Fatalf("queued promotion rewrote the upstream runtime fixture: %s", runtimeAfter)
	}

	indexAfter, err := os.ReadFile(sessionsIndexPath())
	if err != nil {
		t.Fatal(err)
	}
	var storedIndex map[string]map[string]any
	if err = gulu.JSON.UnmarshalJSON(indexAfter, &storedIndex); err != nil {
		t.Fatal(err)
	}
	record := storedIndex[testSessionID]
	if record["id"] != testSessionID || record["title"] != "legacy fixtures" || record["targetKind"] != "native-agent" {
		t.Fatalf("legacy index fields drifted after queued promotion: %#v", record)
	}
	for _, key := range []string{"queueVersion", "inputID", "sourceInputID", "turnID"} {
		if _, exists := record[key]; exists {
			t.Fatalf("queue coordination leaked into session index field %q: %#v", key, record)
		}
	}
}
