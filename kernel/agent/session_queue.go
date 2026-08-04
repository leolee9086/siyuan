// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package agent

import (
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"time"

	"github.com/88250/gulu"
	"github.com/siyuan-note/filelock"
)

// AppendQueuedUserEntry 将队列输入原子晋升为上游兼容的 SessionEntry user 形状并返回新修订号。
func AppendQueuedUserEntry(sessionID string, entry SessionEntry) (int64, error) {
	if sessionID == "" || !isValidSessionID(sessionID) || entry.ID == "" || entry.Type != "user" {
		return 0, fmt.Errorf("invalid queued agent user entry")
	}
	lock := sessionLock(sessionID)
	lock.Lock()
	defer lock.Unlock()

	path := filepath.Join(sessionsDir(), sessionID, "session.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}
	var session map[string]any
	if err = gulu.JSON.UnmarshalJSON(data, &session); err != nil {
		return 0, fmt.Errorf("decode agent session: %w", err)
	}
	currentRevision := numberToInt64(session["revision"])
	runtimeState, err := loadRuntimeLocked(sessionID)
	if err != nil {
		return currentRevision, err
	}
	if runtimeState.ActiveTurn != nil {
		committed, committedErr := isTurnCommittedLocked(sessionID, runtimeState.ActiveTurn.TurnID)
		if committedErr != nil {
			return currentRevision, committedErr
		}
		if !committed {
			return currentRevision, ErrRuntimeNotFinalized
		}
		runtimeState.ActiveTurn = nil
		if err = writeRuntimeLocked(sessionID, runtimeState); err != nil {
			return currentRevision, err
		}
	}

	entryData, err := sessionEntryMap(entry)
	if err != nil {
		return currentRevision, err
	}
	entries, _ := session["entries"].([]any)
	for _, raw := range entries {
		existing, _ := raw.(map[string]any)
		if existingID, _ := existing["id"].(string); existingID != entry.ID {
			continue
		}
		if queuedUserEntriesEqual(existing, entryData) {
			return currentRevision, nil
		}
		return currentRevision, ErrSessionConflict
	}
	entries = append(entries, entryData)
	session["entries"] = entries
	newRevision := currentRevision + 1
	session["revision"] = newRevision
	now := time.Now().UnixMilli()
	session["updatedAt"] = now
	encoded, err := gulu.JSON.MarshalIndentJSON(session, "", "\t")
	if err != nil {
		return currentRevision, err
	}
	if err = filelock.WriteFile(path, encoded); err != nil {
		return currentRevision, err
	}

	title, _ := session["title"].(string)
	if title == "" {
		title = "AI Agent"
	}
	createdAt := numberToInt64(session["createdAt"])
	targetKind, _ := session["targetKind"].(string)
	UpdateSessionIndex(sessionID, title, targetKind, createdAt, now)
	return newRevision, nil
}

func sessionEntryMap(entry SessionEntry) (map[string]any, error) {
	if entry.Timestamp == 0 {
		entry.Timestamp = time.Now().UnixMilli()
	}
	data, err := gulu.JSON.MarshalJSON(entry)
	if err != nil {
		return nil, err
	}
	var mapped map[string]any
	if err = gulu.JSON.UnmarshalJSON(data, &mapped); err != nil {
		return nil, err
	}
	return mapped, nil
}

func queuedUserEntriesEqual(existing, candidate map[string]any) bool {
	keys := []string{"id", "type", "content", "blockHTML", "references", "editorContext"}
	for _, key := range keys {
		if !reflect.DeepEqual(existing[key], candidate[key]) {
			return false
		}
	}
	return true
}
