// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package api

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFileAgentExecutorAnchorStoreIsIndependentAndRecoverable(t *testing.T) {
	dataDir := t.TempDir()
	store, err := newFileAgentExecutorAnchorStore(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	anchor := agentExecutorAnchor{SessionID: "session/with/path", InputID: "input-1", TurnID: "turn-1"}
	if err = store.Save(anchor); err != nil {
		t.Fatal(err)
	}
	restored, err := store.Load(anchor.SessionID)
	if err != nil {
		t.Fatal(err)
	}
	if restored == nil || restored.InputID != anchor.InputID || restored.TurnID != anchor.TurnID {
		t.Fatalf("restored anchor: %+v", restored)
	}
	dir := filepath.Join(dataDir, "storage", "ai", "agent", "queues", "executor")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || strings.Contains(entries[0].Name(), "session") {
		t.Fatalf("anchor file name was not isolated from session path: %+v", entries)
	}
	if err = store.Delete(anchor.SessionID); err != nil {
		t.Fatal(err)
	}
	if restored, err = store.Load(anchor.SessionID); err != nil || restored != nil {
		t.Fatalf("deleted anchor remained: anchor=%+v err=%v", restored, err)
	}
}
