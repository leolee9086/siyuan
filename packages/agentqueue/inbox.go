package agentqueue

import (
	"errors"
	"sync"
	"time"
)

// 包级错误定义，供调用方做精确错误分支。
var (
	// ErrQueueFull 会话输入队列已满。
	ErrQueueFull = errors.New("agentqueue: session input queue is full")
	// ErrNilInput 输入为 nil。
	ErrNilInput = errors.New("agentqueue: input is nil")
	// ErrEmptySessionID 会话 ID 为空。
	ErrEmptySessionID = errors.New("agentqueue: session id is empty")
	// ErrSessionIDMismatch 输入所属会话与队列不一致。
	ErrSessionIDMismatch = errors.New("agentqueue: input session id mismatch")
	// ErrDuplicateInput 输入 ID 重复（幂等冲突，已存在相同 ID 的输入）。
	ErrDuplicateInput = errors.New("agentqueue: duplicate input id")
	// ErrInputNotFound 输入不存在。
	ErrInputNotFound = errors.New("agentqueue: input not found")
	// ErrNotPending 输入不在 pending 状态，无法执行该操作。
	ErrNotPending = errors.New("agentqueue: input is not pending")
)

// 默认容量与保留策略常量（避免散落魔法数字，便于统一调整）。
const (
	// DefaultCapacity 是会话输入队列的默认容量上限（pending 项数）。
	DefaultCapacity = 20
	// DefaultMaxRetained 是 Snapshot 中默认保留的非 pending 历史项数量。
	DefaultMaxRetained = 100
)

// anyState 是 markState 中「不限制来源状态」的哨兵值（对应零值状态）。
const anyState InboxStatus = ""

// inboxItem 是队列中的一条输入及其实时状态。
type inboxItem struct {
	input *Input
	seq   int64 // 入队序号，保证 FIFO 稳定
	state InboxStatus
}

// InboxSnapshot 是队列中一条输入的状态快照，供 UI / 事件推送使用。
type InboxSnapshot struct {
	Input    *Input      `json:"input"`
	State    InboxStatus `json:"state"`
	Seq      int64       `json:"seq"`
	QueuePos int         `json:"queuePos"` // 在 pending 队列中的位置（1 起），非 pending 项为 0
}

// SessionInbox 是单个会话的输入队列，并发安全。
//
// 队列策略：
//   - FIFO 稳定：queue / user_message 等按入队顺序投递；
//   - steer 插队：steer / interrupt / tool_result 语义在取用时优先于普通排队消息，
//     但仍受 ExpectedTurnID 前置校验约束（不匹配则跳过，不消费）；
//   - 容量上限：超过容量时 Submit 返回 ErrQueueFull；
//   - 幂等：同一 Input.ID 重复提交返回 ErrDuplicateInput。
type SessionInbox struct {
	mu        sync.Mutex
	sessionID string
	items     []*inboxItem
	capacity  int
	seq       int64
}

// NewSessionInbox 创建指定容量的会话输入队列。capacity <= 0 时使用默认容量 DefaultCapacity。
func NewSessionInbox(sessionID string, capacity int) *SessionInbox {
	if capacity <= 0 {
		capacity = DefaultCapacity
	}
	return &SessionInbox{
		sessionID: sessionID,
		capacity:  capacity,
	}
}

// SessionID 返回所属会话。
func (in *SessionInbox) SessionID() string {
	return in.sessionID
}

// Capacity 返回队列容量上限。
func (in *SessionInbox) Capacity() int {
	return in.capacity
}

// Len 返回当前队列中的总条目数（含非 pending 状态的历史项）。
func (in *SessionInbox) Len() int {
	in.mu.Lock()
	defer in.mu.Unlock()
	return len(in.items)
}

// PendingCount 返回待投递（pending）条目数。
func (in *SessionInbox) PendingCount() int {
	in.mu.Lock()
	defer in.mu.Unlock()
	n := 0
	for _, it := range in.items {
		if it.state == StatusPending {
			n++
		}
	}
	return n
}

// Submit 将输入加入队列。成功时返回入队序号。
// 幂等：Input.ID 已存在（任意状态）时返回 ErrDuplicateInput。
// 容量满时返回 ErrQueueFull。
func (in *SessionInbox) Submit(input *Input) (int64, error) {
	if input == nil {
		return 0, ErrNilInput
	}
	if input.SessionID != "" && input.SessionID != in.sessionID {
		return 0, ErrSessionIDMismatch
	}

	in.mu.Lock()
	defer in.mu.Unlock()

	for _, it := range in.items {
		if it.input.ID != "" && it.input.ID == input.ID {
			return it.seq, ErrDuplicateInput
		}
	}

	// 容量只统计 pending 项，避免历史项（injected/cancelled）占满队列。
	pending := 0
	for _, it := range in.items {
		if it.state == StatusPending {
			pending++
		}
	}
	if pending >= in.capacity {
		return 0, ErrQueueFull
	}

	in.seq++
	// 克隆输入后补默认值，绝不修改调用方传入的对象（并发安全边界）。
	cloned := cloneInput(input)
	if cloned.CreatedAt == 0 {
		cloned.CreatedAt = time.Now().UnixMilli()
	}
	in.items = append(in.items, &inboxItem{
		input: cloned,
		seq:   in.seq,
		state: StatusPending,
	})
	return in.seq, nil
}

// Take 取出下一条可投递输入。
//
// 规则（按优先级从高到低扫描）：
//  1. 即时交互语义（steer / interrupt / tool_result）：若 ExpectedTurnID 为空或
//     与 activeTurnID 匹配，则取出（跳过不匹配项，留待目标 turn）；
//  2. 普通语义（queue / user_message / channel_inbound / system / cross_agent）：
//     按入队序号 FIFO 取出。
//
// 取出的输入状态置为 Injecting，调用方确认注入完成需调用 MarkInjected，
// 取消需调用 MarkCancelled（或调用方失败时 MarkFailed）。
// 返回的是输入深拷贝，调用方修改返回对象不影响队列内部状态（并发安全边界）。
func (in *SessionInbox) Take(activeTurnID string) (*Input, error) {
	in.mu.Lock()
	defer in.mu.Unlock()

	// 第一轮：即时交互语义，带 ExpectedTurnID 匹配。
	for _, it := range in.items {
		if it.state != StatusPending {
			continue
		}
		if !it.input.Semantics.IsImmediate() {
			continue
		}
		if it.input.ExpectedTurnID != "" && it.input.ExpectedTurnID != activeTurnID {
			// 目标 turn 未到，跳过。
			continue
		}
		it.state = StatusInjecting
		return cloneInput(it.input), nil
	}

	// 第二轮：普通语义 FIFO。
	for _, it := range in.items {
		if it.state != StatusPending {
			continue
		}
		if it.input.Semantics.IsImmediate() {
			continue
		}
		it.state = StatusInjecting
		return cloneInput(it.input), nil
	}

	return nil, nil
}

// MarkInjected 确认输入已注入 agent 上下文（调用方在注入成功后调用）。
func (in *SessionInbox) MarkInjected(id string) error {
	return in.markState(id, StatusInjecting, StatusInjected)
}

// MarkCancelled 取消输入（用户主动取消 / 过期）。
func (in *SessionInbox) MarkCancelled(id string) error {
	return in.markState(id, anyState, StatusCancelled)
}

// MarkFailed 标记输入投递失败。
func (in *SessionInbox) MarkFailed(id string) error {
	return in.markState(id, StatusInjecting, StatusFailed)
}

// markState 将指定 ID 的条目从 fromState（anyState 表示不限制来源状态）迁移到 toState。
func (in *SessionInbox) markState(id string, fromState InboxStatus, toState InboxStatus) error {
	in.mu.Lock()
	defer in.mu.Unlock()
	for _, it := range in.items {
		if it.input.ID != id {
			continue
		}
		if fromState != anyState && it.state != fromState {
			return ErrNotPending
		}
		it.state = toState
		return nil
	}
	return ErrInputNotFound
}

// Snapshot 返回队列全部条目的状态快照（副本，调用方修改不影响内部状态）。
func (in *SessionInbox) Snapshot() []InboxSnapshot {
	in.mu.Lock()
	defer in.mu.Unlock()

	snap := make([]InboxSnapshot, 0, len(in.items))
	pos := 0
	for _, it := range in.items {
		s := InboxSnapshot{
			Input: cloneInput(it.input),
			State: it.state,
			Seq:   it.seq,
		}
		if it.state == StatusPending {
			pos++
			s.QueuePos = pos
		}
		snap = append(snap, s)
	}
	return snap
}

// Prune 清理超过 maxRetained 条的非 pending 历史项（保留最近的），
// 防止历史项无限累积。返回清理条数。maxRetained <= 0 时使用默认值 DefaultMaxRetained。
func (in *SessionInbox) Prune(maxRetained int) int {
	if maxRetained <= 0 {
		maxRetained = DefaultMaxRetained
	}
	in.mu.Lock()
	defer in.mu.Unlock()

	nonPending := 0
	for _, it := range in.items {
		if it.state != StatusPending {
			nonPending++
		}
	}
	if nonPending <= maxRetained {
		return 0
	}
	drop := nonPending - maxRetained
	kept := make([]*inboxItem, 0, len(in.items)-drop)
	dropped := 0
	for _, it := range in.items {
		if it.state != StatusPending && dropped < drop {
			dropped++
			continue
		}
		kept = append(kept, it)
	}
	in.items = kept
	return dropped
}

// cloneInput 深拷贝 Input（Source / Metadata 等嵌套结构）。
// Metadata 值为 map / slice 时递归拷贝，标量值直接共享（不可变）。
func cloneInput(src *Input) *Input {
	if src == nil {
		return nil
	}
	dst := *src
	if src.Source != nil {
		s := *src.Source
		if src.Source.RawAttributes != nil {
			s.RawAttributes = make(map[string]string, len(src.Source.RawAttributes))
			for k, v := range src.Source.RawAttributes {
				s.RawAttributes[k] = v
			}
		}
		dst.Source = &s
	}
	if src.Metadata != nil {
		dst.Metadata = deepCopyMap(src.Metadata)
	}
	return &dst
}

// deepCopyAny 递归深拷贝任意值，处理嵌套 map / slice。
// 标量与不可变类型（string / bool / 数值 / 指针）直接共享。
func deepCopyAny(v any) any {
	switch t := v.(type) {
	case map[string]any:
		return deepCopyMap(t)
	case []any:
		out := make([]any, len(t))
		for i, item := range t {
			out[i] = deepCopyAny(item)
		}
		return out
	default:
		return v
	}
}

// deepCopyMap 递归深拷贝 map[string]any。
func deepCopyMap(src map[string]any) map[string]any {
	out := make(map[string]any, len(src))
	for k, v := range src {
		out[k] = deepCopyAny(v)
	}
	return out
}
