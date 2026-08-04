// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package api

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/siyuan-note/filelock"
)

const currentAgentExecutorAnchorSchemaVersion = 1

// agentExecutorAnchor 独立记录队列输入与 runtime turn 的关联，不进入上游 session/runtime JSON。
type agentExecutorAnchor struct {
	SchemaVersion int    `json:"schemaVersion"`
	SessionID     string `json:"sessionID"`
	InputID       string `json:"inputID"`
	TurnID        string `json:"turnID,omitempty"`
}

type agentExecutorAnchorStore interface {
	Load(sessionID string) (*agentExecutorAnchor, error)
	Save(anchor agentExecutorAnchor) error
	Delete(sessionID string) error
}

type fileAgentExecutorAnchorStore struct {
	dir string
}

func newFileAgentExecutorAnchorStore(dataDir string) (*fileAgentExecutorAnchorStore, error) {
	if dataDir == "" {
		return nil, errors.New("agent executor anchor data directory is empty")
	}
	dir := filepath.Join(dataDir, "storage", "ai", "agent", "queues", "executor")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("create agent executor anchor directory: %w", err)
	}
	return &fileAgentExecutorAnchorStore{dir: dir}, nil
}

func (store *fileAgentExecutorAnchorStore) pathFor(sessionID string) string {
	digest := sha256.Sum256([]byte(sessionID))
	return filepath.Join(store.dir, fmt.Sprintf("%x.json", digest[:]))
}

func (store *fileAgentExecutorAnchorStore) Load(sessionID string) (*agentExecutorAnchor, error) {
	if sessionID == "" {
		return nil, nil
	}
	data, err := os.ReadFile(store.pathFor(sessionID))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read agent executor anchor: %w", err)
	}
	anchor := &agentExecutorAnchor{}
	if err = json.Unmarshal(data, anchor); err != nil {
		return nil, fmt.Errorf("decode agent executor anchor: %w", err)
	}
	if anchor.SchemaVersion != currentAgentExecutorAnchorSchemaVersion {
		return nil, fmt.Errorf("unsupported agent executor anchor schema: %d", anchor.SchemaVersion)
	}
	if anchor.SessionID != sessionID || anchor.InputID == "" {
		return nil, errors.New("invalid agent executor anchor")
	}
	return anchor, nil
}

func (store *fileAgentExecutorAnchorStore) Save(anchor agentExecutorAnchor) error {
	if anchor.SessionID == "" || anchor.InputID == "" {
		return errors.New("invalid agent executor anchor")
	}
	anchor.SchemaVersion = currentAgentExecutorAnchorSchemaVersion
	data, err := json.Marshal(anchor)
	if err != nil {
		return fmt.Errorf("encode agent executor anchor: %w", err)
	}
	if err = filelock.WriteFile(store.pathFor(anchor.SessionID), data); err != nil {
		return fmt.Errorf("write agent executor anchor: %w", err)
	}
	return nil
}

func (store *fileAgentExecutorAnchorStore) Delete(sessionID string) error {
	if sessionID == "" {
		return nil
	}
	if err := os.Remove(store.pathFor(sessionID)); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete agent executor anchor: %w", err)
	}
	return nil
}

type memoryAgentExecutorAnchorStore struct {
	mu      sync.Mutex
	anchors map[string]agentExecutorAnchor
}

func newMemoryAgentExecutorAnchorStore() *memoryAgentExecutorAnchorStore {
	return &memoryAgentExecutorAnchorStore{anchors: map[string]agentExecutorAnchor{}}
}

func (store *memoryAgentExecutorAnchorStore) Load(sessionID string) (*agentExecutorAnchor, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	anchor, ok := store.anchors[sessionID]
	if !ok {
		return nil, nil
	}
	cloned := anchor
	return &cloned, nil
}

func (store *memoryAgentExecutorAnchorStore) Save(anchor agentExecutorAnchor) error {
	if anchor.SessionID == "" || anchor.InputID == "" {
		return errors.New("invalid agent executor anchor")
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	anchor.SchemaVersion = currentAgentExecutorAnchorSchemaVersion
	store.anchors[anchor.SessionID] = anchor
	return nil
}

func (store *memoryAgentExecutorAnchorStore) Delete(sessionID string) error {
	store.mu.Lock()
	delete(store.anchors, sessionID)
	store.mu.Unlock()
	return nil
}
