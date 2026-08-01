package agentqueue

import (
	"errors"
	"sync"
)

// errQueueClosed 表示管理器已关闭，拒绝新的 Submit。
var errQueueClosed = errors.New("agentqueue: manager is closed")

// OnChangedFunc 是队列状态变化时的回调函数，供上层推送 SSE / WS 事件。
// 回调在 Submit / Take / Cancel / Mark* 等操作后触发，语义为「该会话输入队列
// 可能已变化，请刷新状态」。回调内不得再次调用本包方法（可能死锁）。
type OnChangedFunc func(sessionID string)

// SubmitResult 是 Submit 的返回结果，携带投递建议，供上层决定后续动作。
type SubmitResult struct {
	// Accepted 输入是否已被接受（入队）。false 表示被拒绝（错误非 nil）。
	Accepted bool
	// Duplicated 输入 ID 与队列中已有条目重复（幂等命中），未重复入队。
	Duplicated bool
	// ShouldWake 是否应唤醒/启动该会话的处理循环。
	// 当输入到达且该会话没有活动处理时由调度器决定；本包不做决策，
	// 仅通过回调通知上层。
	ShouldWake bool
	// Immediate 输入是否为即时交互语义（steer / interrupt / tool_result），
	// 上层可据此决定是否立刻注入当前 turn。
	Immediate bool
	// Seq 入队序号（Duplicated 时为已存在条目的序号）。
	Seq int64
}

// InboxManager 管理所有 agent 会话的输入队列，是统一消息入口的调度核心。
//
// 同时支持两种消费模式：
//   - per-session 消费（native agent）：每个会话一个处理循环，调用
//     Take(sessionID, activeTurnID) 取输入；
//   - 全局调度（MAGI）：通过 NextDue() 轮询所有有 pending 输入的会话，
//     由统一 dispatcher 按保护环优先级处理。
//
// 并发安全：所有方法均可安全并发调用。
type InboxManager struct {
	mu       sync.Mutex
	inboxes  map[string]*SessionInbox
	capacity int

	onChanged OnChangedFunc

	// running 记录当前有活动处理循环的会话（由上层调用 MarkRunning 维护）。
	running map[string]bool

	closed bool
}

// NewInboxManager 创建全局输入管理器。
// capacity 为每个会话队列的容量上限（<=0 使用默认值 DefaultCapacity）。
func NewInboxManager(capacity int) *InboxManager {
	if capacity <= 0 {
		capacity = DefaultCapacity
	}
	return &InboxManager{
		inboxes:  make(map[string]*SessionInbox),
		capacity: capacity,
		running:  make(map[string]bool),
	}
}

// SetOnChanged 注册队列状态变化回调。传 nil 可注销。
func (m *InboxManager) SetOnChanged(fn OnChangedFunc) {
	m.mu.Lock()
	m.onChanged = fn
	m.mu.Unlock()
}

// notify 触发回调（锁外调用，避免回调内再次进入本包导致死锁）。
func (m *InboxManager) notify(sessionID string) {
	m.mu.Lock()
	fn := m.onChanged
	m.mu.Unlock()
	if fn != nil && sessionID != "" {
		fn(sessionID)
	}
}

// MarkRunning 标记会话是否有活动处理循环。
// 该信息用于 Submit 时计算 ShouldWake 与即时语义的注入时机。
func (m *InboxManager) MarkRunning(sessionID string, running bool) {
	m.mu.Lock()
	if running {
		m.running[sessionID] = true
	} else {
		delete(m.running, sessionID)
	}
	m.mu.Unlock()
}

// IsRunning 返回会话当前是否有活动处理循环。
func (m *InboxManager) IsRunning(sessionID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.running[sessionID]
}

// Submit 提交一条输入到指定会话的队列。
//
// 规则：
//   - 幂等：Input.ID 非空且已存在时返回 Duplicated=true（不重复入队）；
//   - 容量：会话 pending 项达到上限时返回 ErrQueueFull；
//   - 即时语义（steer / interrupt / tool_result）也会入队（为保序与恢复），
//     但上层收到回调后可立即 Take 注入，不受 FIFO 排队约束。
func (m *InboxManager) Submit(input *Input) (SubmitResult, error) {
	if input == nil {
		return SubmitResult{}, ErrNilInput
	}
	if input.SessionID == "" {
		return SubmitResult{}, ErrEmptySessionID
	}

	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return SubmitResult{}, errQueueClosed
	}
	in := m.inboxes[input.SessionID]
	if in == nil {
		in = NewSessionInbox(input.SessionID, m.capacity)
		m.inboxes[input.SessionID] = in
	}
	running := m.running[input.SessionID]
	m.mu.Unlock()

	// 注意：不在此处修改 input 的 Priority / CreatedAt——
	// 默认值补齐由 SessionInbox.Submit 在内部克隆对象上完成，
	// 避免写入调用方传入的对象（并发安全边界）。
	seq, err := in.Submit(input)
	if err == ErrDuplicateInput {
		return SubmitResult{Duplicated: true, Seq: seq, Immediate: input.Semantics.IsImmediate()}, nil
	}
	if err != nil {
		return SubmitResult{}, err
	}

	m.notify(input.SessionID)

	return SubmitResult{
		Accepted:   true,
		Seq:        seq,
		ShouldWake: !running,
		Immediate:  input.Semantics.IsImmediate(),
	}, nil
}

// Take 从指定会话取出下一条可投递输入（见 SessionInbox.Take 规则）。
// 无可用输入时返回 (nil, nil)。
func (m *InboxManager) Take(sessionID, activeTurnID string) (*Input, error) {
	m.mu.Lock()
	in := m.inboxes[sessionID]
	m.mu.Unlock()
	if in == nil {
		return nil, nil
	}

	input, err := in.Take(activeTurnID)
	if err != nil {
		return nil, err
	}
	if input != nil {
		m.notify(sessionID)
	}
	return input, nil
}

// Peek 非阻塞查看指定会话是否有待投递输入，返回最高优先级语义类别。
// 返回 nil 表示没有可用输入。不消费输入。
func (m *InboxManager) Peek(sessionID string) *Input {
	m.mu.Lock()
	in := m.inboxes[sessionID]
	m.mu.Unlock()
	if in == nil {
		return nil
	}
	snaps := in.Snapshot()
	for _, s := range snaps {
		if s.State == StatusPending {
			return s.Input
		}
	}
	return nil
}

// NextDue 返回一个有 pending 输入的会话 ID（供全局调度器轮询）。
// 返回 "" 表示当前没有待处理会话。不消费输入。
// 锁顺序与其它方法一致：先取 m.mu 收集候选，释放后再逐个查询 in（不嵌套锁）。
func (m *InboxManager) NextDue() string {
	m.mu.Lock()
	candidates := make([]*SessionInbox, 0, len(m.inboxes))
	for _, in := range m.inboxes {
		candidates = append(candidates, in)
	}
	m.mu.Unlock()

	for _, in := range candidates {
		if in.PendingCount() > 0 {
			return in.SessionID()
		}
	}
	return ""
}

// SessionIDs 返回当前已注册的全部会话 ID。
func (m *InboxManager) SessionIDs() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	ids := make([]string, 0, len(m.inboxes))
	for sid := range m.inboxes {
		ids = append(ids, sid)
	}
	return ids
}

// Cancel 取消指定会话中指定 ID 的输入（仅 pending 可取消）。
func (m *InboxManager) Cancel(sessionID, id string) error {
	m.mu.Lock()
	in := m.inboxes[sessionID]
	m.mu.Unlock()
	if in == nil {
		return ErrInputNotFound
	}
	if err := in.MarkCancelled(id); err != nil {
		return err
	}
	m.notify(sessionID)
	return nil
}

// MarkInjected 确认输入已注入 agent 上下文。
func (m *InboxManager) MarkInjected(sessionID, id string) error {
	m.mu.Lock()
	in := m.inboxes[sessionID]
	m.mu.Unlock()
	if in == nil {
		return ErrInputNotFound
	}
	if err := in.MarkInjected(id); err != nil {
		return err
	}
	m.notify(sessionID)
	return nil
}

// MarkFailed 标记输入投递失败。
func (m *InboxManager) MarkFailed(sessionID, id string) error {
	m.mu.Lock()
	in := m.inboxes[sessionID]
	m.mu.Unlock()
	if in == nil {
		return ErrInputNotFound
	}
	return in.MarkFailed(id)
}

// Snapshot 返回指定会话的队列快照（副本）。
// 会话不存在时返回空切片。
func (m *InboxManager) Snapshot(sessionID string) []InboxSnapshot {
	m.mu.Lock()
	in := m.inboxes[sessionID]
	m.mu.Unlock()
	if in == nil {
		return []InboxSnapshot{}
	}
	return in.Snapshot()
}

// PendingCount 返回指定会话的待投递输入数。
func (m *InboxManager) PendingCount(sessionID string) int {
	m.mu.Lock()
	in := m.inboxes[sessionID]
	m.mu.Unlock()
	if in == nil {
		return 0
	}
	return in.PendingCount()
}

// RemoveSession 移除会话及其队列（会话删除 / 过期清理时调用）。
func (m *InboxManager) RemoveSession(sessionID string) {
	m.mu.Lock()
	delete(m.inboxes, sessionID)
	delete(m.running, sessionID)
	m.mu.Unlock()
	m.notify(sessionID)
}

// Prune 清理指定会话队列的历史项。
func (m *InboxManager) Prune(sessionID string, maxRetained int) int {
	m.mu.Lock()
	in := m.inboxes[sessionID]
	m.mu.Unlock()
	if in == nil {
		return 0
	}
	return in.Prune(maxRetained)
}

// Close 关闭管理器，拒绝后续 Submit。
// 已入队输入仍可被 Take 消费（由上层在关闭流程中排空）。
func (m *InboxManager) Close() {
	m.mu.Lock()
	m.closed = true
	m.mu.Unlock()
}
