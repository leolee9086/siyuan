// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package agent

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/88250/gulu"
	"github.com/88250/lute/ast"
	"github.com/siyuan-note/filelock"
)

const (
	PromptSourceKindDefault  = "default"
	PromptSourceKindDocument = "document"

	PromptBindingStateEligible      = "eligible"
	PromptBindingStateBound         = "bound"
	PromptBindingStateLocked        = "locked"
	PromptBindingStateSourceChanged = "source-changed"

	maxAgentPromptSourceBytes = 64 * 1024
)

var (
	ErrPromptSourceLocked            = errors.New("agent prompt source is locked after the conversation starts")
	ErrPromptSourceUnsupportedTarget = errors.New("prompt sources are only supported by native-agent sessions")
)

// PromptSource is server-owned session state. PromptSnapshot never crosses the
// SessionStore API; it is only consumed while constructing the Kernel prompt.
type PromptSource struct {
	Kind           string `json:"kind"`
	DocumentID     string `json:"documentId,omitempty"`
	NotebookID     string `json:"notebookId,omitempty"`
	TitleSnapshot  string `json:"titleSnapshot,omitempty"`
	ContentHash    string `json:"contentHash,omitempty"`
	SourceVersion  string `json:"sourceVersion,omitempty"`
	CapturedAt     int64  `json:"capturedAt,omitempty"`
	PromptSnapshot string `json:"promptSnapshot,omitempty"`
	KeptVersion    string `json:"keptVersion,omitempty"`
	KeptAt         int64  `json:"keptAt,omitempty"`
}

// PromptSourceMetadata is the only source representation suitable for clients.
// It deliberately omits the effective prompt body.
type PromptSourceMetadata struct {
	Kind          string `json:"kind"`
	DocumentID    string `json:"documentId,omitempty"`
	NotebookID    string `json:"notebookId,omitempty"`
	TitleSnapshot string `json:"titleSnapshot,omitempty"`
	ContentHash   string `json:"contentHash,omitempty"`
	SourceVersion string `json:"sourceVersion,omitempty"`
	CapturedAt    int64  `json:"capturedAt,omitempty"`
	KeptVersion   string `json:"keptVersion,omitempty"`
	KeptAt        int64  `json:"keptAt,omitempty"`
}

// PromptSourceState combines the server's eligibility decision with redacted
// source metadata and the authoritative session revision.
type PromptSourceState struct {
	State          string               `json:"state"`
	Source         PromptSourceMetadata `json:"source"`
	Revision       int64                `json:"revision"`
	CurrentVersion string               `json:"currentVersion,omitempty"`
}

func defaultPromptSource() PromptSource {
	return PromptSource{Kind: PromptSourceKindDefault}
}

func promptSourceMetadata(source PromptSource) PromptSourceMetadata {
	return PromptSourceMetadata{
		Kind:          source.Kind,
		DocumentID:    source.DocumentID,
		NotebookID:    source.NotebookID,
		TitleSnapshot: source.TitleSnapshot,
		ContentHash:   source.ContentHash,
		SourceVersion: source.SourceVersion,
		CapturedAt:    source.CapturedAt,
		KeptVersion:   source.KeptVersion,
		KeptAt:        source.KeptAt,
	}
}

func normalizePromptSnapshot(snapshot string) string {
	snapshot = strings.ReplaceAll(snapshot, "\r\n", "\n")
	snapshot = strings.ReplaceAll(snapshot, "\r", "\n")
	return strings.TrimSpace(snapshot)
}

func promptSourceVersion(snapshot string) string {
	digest := sha256.Sum256([]byte(snapshot))
	return "sha256:" + hex.EncodeToString(digest[:])
}

func validPromptSourceVersion(version string) bool {
	const prefix = "sha256:"
	if !strings.HasPrefix(version, prefix) || len(version) != len(prefix)+sha256.Size*2 {
		return false
	}
	_, err := hex.DecodeString(strings.TrimPrefix(version, prefix))
	return err == nil
}

// NewDocumentPromptSource normalizes and fingerprints a document snapshot before
// it enters server-owned session state. Callers must pass document content read
// by the Kernel, never a body supplied by the browser.
func NewDocumentPromptSource(documentID, notebookID, title, snapshot string, capturedAt int64) (PromptSource, error) {
	documentID = strings.TrimSpace(documentID)
	notebookID = strings.TrimSpace(notebookID)
	title = strings.TrimSpace(title)
	snapshot = normalizePromptSnapshot(snapshot)
	if !ast.IsNodeIDPattern(documentID) {
		return PromptSource{}, fmt.Errorf("invalid prompt source document id")
	}
	if notebookID == "" {
		return PromptSource{}, fmt.Errorf("missing prompt source notebook id")
	}
	if title == "" {
		return PromptSource{}, fmt.Errorf("missing prompt source document title")
	}
	if snapshot == "" {
		return PromptSource{}, fmt.Errorf("prompt source document is empty")
	}
	if len([]byte(snapshot)) > maxAgentPromptSourceBytes {
		return PromptSource{}, fmt.Errorf("prompt source document exceeds %d bytes", maxAgentPromptSourceBytes)
	}
	if capturedAt <= 0 {
		capturedAt = time.Now().UnixMilli()
	}
	version := promptSourceVersion(snapshot)
	return PromptSource{
		Kind:           PromptSourceKindDocument,
		DocumentID:     documentID,
		NotebookID:     notebookID,
		TitleSnapshot:  title,
		ContentHash:    strings.TrimPrefix(version, "sha256:"),
		SourceVersion:  version,
		CapturedAt:     capturedAt,
		PromptSnapshot: snapshot,
	}, nil
}

func validatePromptSource(source PromptSource) error {
	switch source.Kind {
	case PromptSourceKindDefault:
		if source.DocumentID != "" || source.NotebookID != "" || source.PromptSnapshot != "" {
			return fmt.Errorf("invalid default prompt source")
		}
		return nil
	case PromptSourceKindDocument:
		if !ast.IsNodeIDPattern(source.DocumentID) || strings.TrimSpace(source.NotebookID) == "" ||
			strings.TrimSpace(source.TitleSnapshot) == "" || source.CapturedAt <= 0 {
			return fmt.Errorf("invalid document prompt source metadata")
		}
		normalized := normalizePromptSnapshot(source.PromptSnapshot)
		if normalized == "" || len([]byte(normalized)) > maxAgentPromptSourceBytes {
			return fmt.Errorf("invalid document prompt source snapshot")
		}
		version := promptSourceVersion(normalized)
		if source.SourceVersion != version || source.ContentHash != strings.TrimPrefix(version, "sha256:") {
			return fmt.Errorf("document prompt source fingerprint mismatch")
		}
		if source.KeptVersion != "" && !validPromptSourceVersion(source.KeptVersion) {
			return fmt.Errorf("invalid kept prompt source version")
		}
		return nil
	default:
		return fmt.Errorf("unknown prompt source kind %q", source.Kind)
	}
}

func loadPromptSourceSessionLocked(sessionID string) (map[string]any, error) {
	data, err := os.ReadFile(filepath.Join(sessionsDir(), sessionID, "session.json"))
	if err != nil {
		return nil, err
	}
	var session map[string]any
	if err = gulu.JSON.UnmarshalJSON(data, &session); err != nil {
		return nil, fmt.Errorf("decode agent session prompt source: %w", err)
	}
	return session, nil
}

func promptSourceFromSessionLocked(session map[string]any) (PromptSource, error) {
	raw, ok := session["promptSource"]
	if !ok || raw == nil {
		return defaultPromptSource(), nil
	}
	data, err := gulu.JSON.MarshalJSON(raw)
	if err != nil {
		return PromptSource{}, fmt.Errorf("encode agent prompt source: %w", err)
	}
	var source PromptSource
	if err = gulu.JSON.UnmarshalJSON(data, &source); err != nil {
		return PromptSource{}, fmt.Errorf("decode agent prompt source: %w", err)
	}
	if err = validatePromptSource(source); err != nil {
		return PromptSource{}, err
	}
	return source, nil
}

func hasPersistentConversationLocked(sessionID string, session map[string]any) (bool, error) {
	for _, field := range []string{"entries", "messages"} {
		if entries, ok := session[field].([]any); ok && len(entries) > 0 {
			return true, nil
		}
	}
	runtime, err := loadRuntimeLocked(sessionID)
	if err != nil || runtime.ActiveTurn == nil {
		return false, err
	}
	committed, err := isTurnCommittedLocked(sessionID, runtime.ActiveTurn.TurnID)
	if err != nil {
		return false, err
	}
	return !committed, nil
}

func promptSourceEligibilityLocked(sessionID string, session map[string]any) (bool, error) {
	targetKind, _ := session["targetKind"].(string)
	if normalizeSessionTargetKind(targetKind) != "native-agent" {
		return false, ErrPromptSourceUnsupportedTarget
	}
	occupied, err := hasPersistentConversationLocked(sessionID, session)
	if err != nil {
		return false, err
	}
	return !occupied, nil
}

func promptSourceStateLocked(sessionID string, session map[string]any) (PromptSourceState, error) {
	source, err := promptSourceFromSessionLocked(session)
	if err != nil {
		return PromptSourceState{}, err
	}
	eligible, err := promptSourceEligibilityLocked(sessionID, session)
	if err != nil && !errors.Is(err, ErrPromptSourceUnsupportedTarget) {
		return PromptSourceState{}, err
	}
	state := PromptBindingStateLocked
	if errors.Is(err, ErrPromptSourceUnsupportedTarget) {
		state = PromptBindingStateLocked
	} else if eligible && source.Kind == PromptSourceKindDocument {
		state = PromptBindingStateBound
	} else if eligible {
		state = PromptBindingStateEligible
	}
	return PromptSourceState{
		State:    state,
		Source:   promptSourceMetadata(source),
		Revision: numberToInt64(session["revision"]),
	}, nil
}

func savePromptSourceSessionLocked(sessionID string, session map[string]any) (int64, error) {
	revision := numberToInt64(session["revision"]) + 1
	session["revision"] = revision
	session["updatedAt"] = time.Now().UnixMilli()
	data, err := gulu.JSON.MarshalIndentJSON(session, "", "\t")
	if err != nil {
		return 0, fmt.Errorf("encode agent prompt source session: %w", err)
	}
	path := filepath.Join(sessionsDir(), sessionID, "session.json")
	if err = filelock.WriteFile(path, data); err != nil {
		return 0, fmt.Errorf("save agent prompt source session: %w", err)
	}
	title, _ := session["title"].(string)
	createdAt := numberToInt64(session["createdAt"])
	updatedAt := numberToInt64(session["updatedAt"])
	targetKind, _ := session["targetKind"].(string)
	UpdateSessionIndex(sessionID, title, targetKind, createdAt, updatedAt)
	return revision, nil
}

// GetPromptSource returns the full server-owned snapshot for AgentChat. It is
// intentionally separate from GetPromptSourceState, which only exposes metadata.
func GetPromptSource(sessionID string) (PromptSource, error) {
	if sessionID == "" || !isValidSessionID(sessionID) {
		return PromptSource{}, fmt.Errorf("invalid session id")
	}
	lock := sessionLock(sessionID)
	lock.Lock()
	defer lock.Unlock()
	session, err := loadPromptSourceSessionLocked(sessionID)
	if err != nil {
		return PromptSource{}, err
	}
	return promptSourceFromSessionLocked(session)
}

// GetPromptSourceState determines eligibility under the same session lock used
// by persistence and runtime recovery, so stale UI state cannot grant a bind.
func GetPromptSourceState(sessionID string) (PromptSourceState, error) {
	if sessionID == "" || !isValidSessionID(sessionID) {
		return PromptSourceState{}, fmt.Errorf("invalid session id")
	}
	lock := sessionLock(sessionID)
	lock.Lock()
	defer lock.Unlock()
	session, err := loadPromptSourceSessionLocked(sessionID)
	if err != nil {
		return PromptSourceState{}, err
	}
	return promptSourceStateLocked(sessionID, session)
}

func mutatePromptSource(sessionID string, expectedRevision int64, mutate func(PromptSource) (PromptSource, error)) (PromptSourceState, error) {
	if sessionID == "" || !isValidSessionID(sessionID) {
		return PromptSourceState{}, fmt.Errorf("invalid session id")
	}
	lock := sessionLock(sessionID)
	lock.Lock()
	defer lock.Unlock()
	session, err := loadPromptSourceSessionLocked(sessionID)
	if err != nil {
		return PromptSourceState{}, err
	}
	if expectedRevision >= 0 && numberToInt64(session["revision"]) != expectedRevision {
		return PromptSourceState{}, ErrSessionConflict
	}
	eligible, err := promptSourceEligibilityLocked(sessionID, session)
	if err != nil {
		return PromptSourceState{}, err
	}
	if !eligible {
		return PromptSourceState{}, ErrPromptSourceLocked
	}
	current, err := promptSourceFromSessionLocked(session)
	if err != nil {
		return PromptSourceState{}, err
	}
	next, err := mutate(current)
	if err != nil {
		return PromptSourceState{}, err
	}
	if err = validatePromptSource(next); err != nil {
		return PromptSourceState{}, err
	}
	session["promptSource"] = next
	if _, err = savePromptSourceSessionLocked(sessionID, session); err != nil {
		return PromptSourceState{}, err
	}
	return promptSourceStateLocked(sessionID, session)
}

// BindDocumentPromptSource replaces the effective source before the first
// persisted conversation entry. Source data has already been read and normalized
// by a trusted Kernel document reader.
func BindDocumentPromptSource(sessionID string, expectedRevision int64, source PromptSource) (PromptSourceState, error) {
	if source.Kind != PromptSourceKindDocument {
		return PromptSourceState{}, fmt.Errorf("document prompt source required")
	}
	return mutatePromptSource(sessionID, expectedRevision, func(PromptSource) (PromptSource, error) {
		source.KeptVersion = ""
		source.KeptAt = 0
		return source, nil
	})
}

// RefreshDocumentPromptSource replaces a bound document snapshot after the
// user explicitly accepts the current document content.
func RefreshDocumentPromptSource(sessionID string, expectedRevision int64, source PromptSource) (PromptSourceState, error) {
	return BindDocumentPromptSource(sessionID, expectedRevision, source)
}

// KeepDocumentPromptSource records an explicit decision to keep the captured
// snapshot for the currently observed document version. A later version change
// will surface again because only this exact version is acknowledged.
func KeepDocumentPromptSource(sessionID string, expectedRevision int64, currentVersion string) (PromptSourceState, error) {
	if !validPromptSourceVersion(currentVersion) {
		return PromptSourceState{}, fmt.Errorf("invalid current prompt source version")
	}
	return mutatePromptSource(sessionID, expectedRevision, func(source PromptSource) (PromptSource, error) {
		if source.Kind != PromptSourceKindDocument {
			return PromptSource{}, fmt.Errorf("no document prompt source is bound")
		}
		source.KeptVersion = currentVersion
		source.KeptAt = time.Now().UnixMilli()
		return source, nil
	})
}
