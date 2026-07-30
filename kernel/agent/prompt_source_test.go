// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package agent

import (
	"errors"
	"strings"
	"testing"
)

func savePromptSourceTestSession(t *testing.T, entries []any) int64 {
	t.Helper()
	revision, err := SaveSession(marshalSession(t, map[string]any{
		"id":        testSessionID,
		"title":     "Prompt source test",
		"createdAt": int64(1),
		"updatedAt": int64(1),
		"entries":   entries,
	}))
	if err != nil {
		t.Fatal(err)
	}
	return revision
}

func TestDocumentPromptSourceIsServerOwnedAndLocksOnConversation(t *testing.T) {
	useTestDataDir(t)
	if revision := savePromptSourceTestSession(t, []any{}); revision != 1 {
		t.Fatalf("unexpected initial revision: %d", revision)
	}
	source, err := NewDocumentPromptSource(
		"20260715120001-abcdefg", "20260715120002-abcdefg", "Agent rules", "Always cite the source.", 10,
	)
	if err != nil {
		t.Fatal(err)
	}
	state, err := BindDocumentPromptSource(testSessionID, 1, source)
	if err != nil {
		t.Fatal(err)
	}
	if state.State != PromptBindingStateBound || state.Revision != 2 || state.Source.TitleSnapshot != "Agent rules" {
		t.Fatalf("unexpected bind state: %#v", state)
	}

	// A regular client save tries to replace the snapshot, but SaveSessionState
	// must retain the server-owned field and only accept its ordinary metadata.
	if revision, err := SaveSession(marshalSession(t, map[string]any{
		"id":               testSessionID,
		"title":            "Renamed",
		"createdAt":        int64(1),
		"updatedAt":        int64(2),
		"entries":          []any{},
		"expectedRevision": int64(2),
		"promptSource": map[string]any{
			"kind":           PromptSourceKindDocument,
			"documentId":     "20260715120003-abcdefg",
			"notebookId":     "forged-notebook",
			"titleSnapshot":  "Forged",
			"sourceVersion":  "sha256:" + strings.Repeat("0", 64),
			"contentHash":    strings.Repeat("0", 64),
			"promptSnapshot": "forged prompt",
			"capturedAt":     int64(11),
		},
	})); err != nil || revision != 3 {
		t.Fatalf("regular save failed: revision=%d, err=%v", revision, err)
	}
	stored, err := GetPromptSource(testSessionID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.DocumentID != source.DocumentID || stored.PromptSnapshot != source.PromptSnapshot {
		t.Fatalf("client replaced server prompt source: %#v", stored)
	}

	if revision, err := SaveSession(marshalSession(t, map[string]any{
		"id":               testSessionID,
		"title":            "Renamed",
		"createdAt":        int64(1),
		"updatedAt":        int64(3),
		"entries":          []any{map[string]any{"id": "user-1", "type": "user", "content": "hello"}},
		"expectedRevision": int64(3),
	})); err != nil || revision != 4 {
		t.Fatalf("persist conversation failed: revision=%d, err=%v", revision, err)
	}
	if _, err := BindDocumentPromptSource(testSessionID, 4, source); !errors.Is(err, ErrPromptSourceLocked) {
		t.Fatalf("conversation did not lock prompt source: %v", err)
	}
	locked, err := GetPromptSourceState(testSessionID)
	if err != nil {
		t.Fatal(err)
	}
	if locked.State != PromptBindingStateLocked || locked.Source.DocumentID != source.DocumentID {
		t.Fatalf("unexpected locked source state: %#v", locked)
	}
}

func TestDocumentPromptSourceVersionAcknowledgementIsExplicit(t *testing.T) {
	useTestDataDir(t)
	if revision := savePromptSourceTestSession(t, []any{}); revision != 1 {
		t.Fatalf("unexpected initial revision: %d", revision)
	}
	source, err := NewDocumentPromptSource(
		"20260715120004-abcdefg", "20260715120005-abcdefg", "Rules", "first version", 10,
	)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = BindDocumentPromptSource(testSessionID, 1, source); err != nil {
		t.Fatal(err)
	}
	current, err := NewDocumentPromptSource(
		"20260715120004-abcdefg", "20260715120005-abcdefg", "Rules", "second version", 11,
	)
	if err != nil {
		t.Fatal(err)
	}
	state, err := KeepDocumentPromptSource(testSessionID, 2, current.SourceVersion)
	if err != nil {
		t.Fatal(err)
	}
	if state.State != PromptBindingStateBound || state.Source.KeptVersion != current.SourceVersion || state.Source.KeptAt <= 0 {
		t.Fatalf("keep decision was not persisted: %#v", state)
	}
	stored, err := GetPromptSource(testSessionID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.PromptSnapshot != "first version" || stored.KeptVersion != current.SourceVersion {
		t.Fatalf("keep changed the effective snapshot: %#v", stored)
	}
}

func TestDocumentPromptSourceRejectsEmptyAndOversizedSnapshots(t *testing.T) {
	if _, err := NewDocumentPromptSource("20260715120006-abcdefg", "notebook", "Rules", "", 1); err == nil {
		t.Fatal("empty prompt source was accepted")
	}
	if _, err := NewDocumentPromptSource(
		"20260715120006-abcdefg", "notebook", "Rules", strings.Repeat("x", maxAgentPromptSourceBytes+1), 1,
	); err == nil {
		t.Fatal("oversized prompt source was accepted")
	}
}
