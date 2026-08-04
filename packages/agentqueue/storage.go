package agentqueue

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

const (
	// CurrentQueueSchemaVersion 是持久化队列快照的当前结构版本。
	CurrentQueueSchemaVersion = 1
)

var ErrUnsupportedQueueSchema = errors.New("agentqueue: unsupported queue snapshot schema")

// PersistedItem 是队列项的持久化形态（可序列化）。
// 通过 QueueStorage 保存/加载，用于进程重启后的队列恢复。
type PersistedItem struct {
	Input *Input      `json:"input"`
	State InboxStatus `json:"state"`
	Seq   int64       `json:"seq"`
	// InjectedAt 仅 State=injecting 时有效；恢复时若执行方已死亡，
	// 该项会被重置为 pending 重新投递。
	InjectedAt int64 `json:"injectedAt,omitempty"`
}

// PersistedQueueSnapshot 是 QueueStorage 的完整持久化单位。
type PersistedQueueSnapshot struct {
	SchemaVersion int             `json:"schemaVersion"`
	QueueVersion  int64           `json:"queueVersion"`
	NextSeq       int64           `json:"nextSeq"`
	Items         []PersistedItem `json:"items"`

	legacy bool
}

// QueueStorage 是会话队列的持久化抽象，可插拔。
//
// 包内提供 MemoryStorage（进程内，测试/默认）与 FileStorage（JSON 文件，
// 每会话一个文件，原子写）两个参考实现；生产环境（如 s-forge）可实现
// 该接口将队列状态落盘到 SQLite（对齐 MAGI MessageStore 的存储模型）。
type QueueStorage interface {
	// SaveSession 原子保存某会话队列的完整快照（幂等覆盖）。
	SaveSession(sessionID string, snapshot PersistedQueueSnapshot) error
	// LoadSession 加载某会话队列快照；ok=false 表示该会话无持久化记录。
	LoadSession(sessionID string) (snapshot PersistedQueueSnapshot, ok bool, err error)
	// DeleteSession 删除某会话的持久化记录（会话删除时调用）。
	DeleteSession(sessionID string) error
}

// MemoryStorage 是进程内存储实现（默认 / 测试用），不提供跨进程持久化。
type MemoryStorage struct {
	mu       sync.Mutex
	sessions map[string]PersistedQueueSnapshot
}

// NewMemoryStorage 创建内存存储。
func NewMemoryStorage() *MemoryStorage {
	return &MemoryStorage{sessions: make(map[string]PersistedQueueSnapshot)}
}

// SaveSession 保存会话快照（幂等覆盖）。
func (s *MemoryStorage) SaveSession(sessionID string, snapshot PersistedQueueSnapshot) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[sessionID] = clonePersistedSnapshot(snapshot)
	return nil
}

// LoadSession 加载会话快照。
func (s *MemoryStorage) LoadSession(sessionID string) (PersistedQueueSnapshot, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	snapshot, ok := s.sessions[sessionID]
	if !ok {
		return PersistedQueueSnapshot{}, false, nil
	}
	return clonePersistedSnapshot(snapshot), true, nil
}

// DeleteSession 删除会话快照。
func (s *MemoryStorage) DeleteSession(sessionID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, sessionID)
	return nil
}

// FileStorage 是 JSON 文件存储实现：每会话一个 `<sessionID>.json` 文件，
// 写入采用「临时文件 + rename」原子替换，避免崩溃产生半截文件。
type FileStorage struct {
	dir string
}

// NewFileStorage 创建基于指定目录的文件存储（目录不存在时自动创建）。
func NewFileStorage(dir string) (*FileStorage, error) {
	if dir == "" {
		return nil, errors.New("agentqueue: file storage dir is empty")
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("agentqueue: create file storage dir: %w", err)
	}
	return &FileStorage{dir: dir}, nil
}

func (s *FileStorage) pathFor(sessionID string) string {
	return filepath.Join(s.dir, sessionID+".json")
}

// SaveSession 原子写会话快照。
func (s *FileStorage) SaveSession(sessionID string, snapshot PersistedQueueSnapshot) error {
	path := s.pathFor(sessionID)
	tmp := path + ".tmp"
	snapshot.SchemaVersion = CurrentQueueSchemaVersion
	snapshot.legacy = false
	data, err := json.Marshal(snapshot)
	if err != nil {
		return fmt.Errorf("agentqueue: marshal session %s: %w", sessionID, err)
	}
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("agentqueue: write temp snapshot %s: %w", sessionID, err)
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("agentqueue: rename snapshot %s: %w", sessionID, err)
	}
	return nil
}

// LoadSession 加载会话快照；文件不存在时返回 ok=false。
func (s *FileStorage) LoadSession(sessionID string) (PersistedQueueSnapshot, bool, error) {
	path := s.pathFor(sessionID)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return PersistedQueueSnapshot{}, false, nil
		}
		return PersistedQueueSnapshot{}, false, fmt.Errorf("agentqueue: read snapshot %s: %w", sessionID, err)
	}
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return PersistedQueueSnapshot{}, false, fmt.Errorf("agentqueue: empty snapshot %s", sessionID)
	}
	if trimmed[0] == '[' {
		var items []PersistedItem
		if err := json.Unmarshal(trimmed, &items); err != nil {
			return PersistedQueueSnapshot{}, false, fmt.Errorf("agentqueue: unmarshal legacy snapshot %s: %w", sessionID, err)
		}
		var nextSeq int64
		for _, item := range items {
			if item.Seq > nextSeq {
				nextSeq = item.Seq
			}
		}
		return PersistedQueueSnapshot{Items: items, NextSeq: nextSeq, legacy: true}, true, nil
	}
	var snapshot PersistedQueueSnapshot
	if err := json.Unmarshal(trimmed, &snapshot); err != nil {
		return PersistedQueueSnapshot{}, false, fmt.Errorf("agentqueue: unmarshal snapshot %s: %w", sessionID, err)
	}
	if snapshot.SchemaVersion != CurrentQueueSchemaVersion {
		return PersistedQueueSnapshot{}, false, fmt.Errorf("%w: %d", ErrUnsupportedQueueSchema, snapshot.SchemaVersion)
	}
	return snapshot, true, nil
}

// DeleteSession 删除会话快照文件（不存在时静默成功）。
func (s *FileStorage) DeleteSession(sessionID string) error {
	path := s.pathFor(sessionID)
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("agentqueue: delete snapshot %s: %w", sessionID, err)
	}
	return nil
}

// AttachStorage 为会话队列挂载持久化存储。挂载后可通过 Checkpoint 保存、
// RestoreFromStorage 恢复队列状态。传入 nil 可解除挂载。
func (in *SessionInbox) AttachStorage(storage QueueStorage) {
	in.mu.Lock()
	defer in.mu.Unlock()
	in.storage = storage
}

// HasStorage 返回该会话是否已经挂载持久化存储。
func (in *SessionInbox) HasStorage() bool {
	in.mu.Lock()
	defer in.mu.Unlock()
	return in.storage != nil
}

// DeleteStorage 删除该会话已挂载的持久化快照。
func (in *SessionInbox) DeleteStorage() error {
	in.mu.Lock()
	defer in.mu.Unlock()
	if in.storage == nil {
		return nil
	}
	return in.storage.DeleteSession(in.sessionID)
}

// Checkpoint 将当前队列状态（含历史项）持久化到已挂载的存储。
// 未挂载存储时返回 nil（no-op）。调用方应在关键状态变更（如 turn 边界）后调用。
func (in *SessionInbox) Checkpoint() error {
	in.mu.Lock()
	defer in.mu.Unlock()
	if in.storage == nil {
		return nil
	}
	return in.storage.SaveSession(in.sessionID, persistedSnapshotFromState(&inboxState{
		items:        in.items,
		seq:          in.seq,
		queueVersion: in.queueVersion,
		summary:      in.summary,
	}))
}

// RestoreFromStorage 从已挂载存储恢复队列状态。
//
// 恢复语义：
//   - 存储无记录时返回 (false, nil)（首次启动）；
//   - injecting 项重置为 pending 并清空 injectedAt——崩溃后原执行方已消失，
//     滞留输入应重新投递；
//   - 恢复后原队列内容被替换（调用前应确保队列为空，或显式接受覆盖）。
func (in *SessionInbox) RestoreFromStorage() (bool, error) {
	in.mu.Lock()
	defer in.mu.Unlock()
	if in.storage == nil {
		return false, nil
	}
	snapshot, ok, err := in.storage.LoadSession(in.sessionID)
	if err != nil {
		return false, err
	}
	if !ok {
		return false, nil
	}
	restored := make([]*inboxItem, 0, len(snapshot.Items))
	maxSeq := snapshot.NextSeq
	changed := snapshot.legacy
	for _, p := range snapshot.Items {
		if p.Input == nil {
			changed = true
			continue
		}
		normalized, normalizeErr := normalizeInput(p.Input)
		if normalizeErr != nil {
			return false, normalizeErr
		}
		if p.Input.ContentDigest != "" && p.Input.ContentDigest != normalized.ContentDigest {
			return false, fmt.Errorf("%w: content digest mismatch for %s", ErrInvalidPayload, p.Input.ID)
		}
		if p.Input.PayloadVersion == 0 || p.Input.ContentDigest == "" {
			changed = true
		}
		state := p.State
		if state == StatusInjecting {
			// queue 可重试；steer 属于已结束的旧 turn，不跨 turn 重放。
			if normalized.Semantics == SemanticsSteer {
				state = StatusFailed
			} else {
				state = StatusPending
			}
			p.InjectedAt = 0
			changed = true
		}
		restored = append(restored, &inboxItem{
			input:      normalized,
			seq:        p.Seq,
			state:      state,
			injectedAt: p.InjectedAt,
		})
		if p.Seq > maxSeq {
			maxSeq = p.Seq
		}
	}
	candidate := &inboxState{
		items:        restored,
		seq:          maxSeq,
		queueVersion: snapshot.QueueVersion,
	}
	if changed {
		candidate.queueVersion++
		if err := in.storage.SaveSession(in.sessionID, persistedSnapshotFromState(candidate)); err != nil {
			return false, err
		}
	}
	in.items = candidate.items
	in.seq = candidate.seq
	in.queueVersion = candidate.queueVersion
	return true, nil
}

func clonePersistedSnapshot(snapshot PersistedQueueSnapshot) PersistedQueueSnapshot {
	cloned := snapshot
	cloned.Items = make([]PersistedItem, 0, len(snapshot.Items))
	for _, item := range snapshot.Items {
		input := cloneInput(item.Input)
		if input != nil {
			input.Metadata = nil
		}
		cloned.Items = append(cloned.Items, PersistedItem{
			Input:      input,
			State:      item.State,
			Seq:        item.Seq,
			InjectedAt: item.InjectedAt,
		})
	}
	return cloned
}
