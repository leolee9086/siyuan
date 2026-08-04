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
	// QueueVersion 是 admission 完成后的服务端权威版本。
	QueueVersion int64
	// ContentDigest 是服务端计算的稳定内容摘要。
	ContentDigest string
}

// InboxManager 管理所有 agent 会话的输入队列，是统一消息入口的调度核心。
//
// 同时支持两种消费模式：
//   - per-session 消费（native agent）：每个会话一个处理循环，调用
//     Take(sessionID, activeTurnID) 取输入；
//   - 全局调度（MAGI）：通过 NextDue() 轮询所有有 pending 输入的会话，
//     由统一 dispatcher 按保护环优先级处理。
//
// 事件分发支持多订阅者：Subscribe 注册、返回退订函数；SetOnChanged 保留
// 单回调兼容语义（等价于清空后注册一个订阅者）。
//
// 并发安全：所有方法均可安全并发调用。
type InboxManager struct {
	mu       sync.Mutex
	inboxes  map[string]*SessionInbox
	settings QueueSettings

	// subscribers 是队列状态变化的多订阅者集合（notify 时锁外遍历调用）。
	subscribers map[int]OnChangedFunc
	nextSubID   int

	// running 记录当前有活动处理循环的会话（由上层调用 MarkRunning 维护）。
	running map[string]bool

	closed bool
}

// NewInboxManager 创建全局输入管理器（使用默认策略，仅覆盖容量）。
// capacity 为每个会话队列的容量上限（<=0 使用默认值 DefaultCapacity）。
func NewInboxManager(capacity int) *InboxManager {
	settings := DefaultQueueSettings()
	if capacity > 0 {
		settings.Cap = capacity
	}
	return NewInboxManagerWithSettings(settings)
}

// NewInboxManagerWithSettings 使用指定策略创建全局输入管理器。
func NewInboxManagerWithSettings(settings QueueSettings) *InboxManager {
	return &InboxManager{
		inboxes:     make(map[string]*SessionInbox),
		settings:    settings.normalize(),
		subscribers: make(map[int]OnChangedFunc),
		running:     make(map[string]bool),
	}
}

// SetOnChanged 注册队列状态变化回调（单回调兼容语义：清空现有订阅者后注册一个）。
// 传 nil 可注销全部订阅者。多订阅者请使用 Subscribe。
func (m *InboxManager) SetOnChanged(fn OnChangedFunc) {
	m.mu.Lock()
	m.subscribers = make(map[int]OnChangedFunc)
	if fn != nil {
		m.subscribers[0] = fn
	}
	m.mu.Unlock()
}

// Subscribe 注册队列状态变化回调，返回退订函数。
// 回调语义与 OnChangedFunc 一致（锁外调用，回调内不得再次进入本包方法）。
func (m *InboxManager) Subscribe(fn OnChangedFunc) func() {
	m.mu.Lock()
	if m.subscribers == nil {
		m.subscribers = make(map[int]OnChangedFunc)
	}
	id := m.nextSubID
	m.nextSubID++
	m.subscribers[id] = fn
	m.mu.Unlock()
	return func() {
		m.mu.Lock()
		delete(m.subscribers, id)
		m.mu.Unlock()
	}
}

// notify 触发回调（锁外调用，避免回调内再次进入本包导致死锁）。
func (m *InboxManager) notify(sessionID string) {
	m.mu.Lock()
	subs := make([]OnChangedFunc, 0, len(m.subscribers))
	for _, fn := range m.subscribers {
		subs = append(subs, fn)
	}
	m.mu.Unlock()
	if sessionID == "" {
		return
	}
	for _, fn := range subs {
		if fn != nil {
			fn(sessionID)
		}
	}
}

// RegisterInbox 注册一个外部构造的定制会话队列（携带自定义策略 / 存储）。
// 已存在同名会话时覆盖。供上层按会话差异化配置（如 MAGI 渠道级 lane 策略）。
func (m *InboxManager) RegisterInbox(in *SessionInbox) {
	if in == nil {
		return
	}
	m.mu.Lock()
	m.inboxes[in.SessionID()] = in
	m.mu.Unlock()
}

// GetOrCreateInbox 返回指定会话的 inbox；不存在时按管理器默认策略创建并注册。
//
// 与 RegisterInbox（无条件覆盖）的区别：GetOrCreateInbox 复用已有 inbox，
// 不覆盖——执行器空闲回收（selfStop）后 inbox 仍保留，若重建执行器时用
// RegisterInbox 覆盖，会丢弃竞态窗口内刚入队的消息。执行器创建应使用本方法。
func (m *InboxManager) GetOrCreateInbox(sessionID string) *SessionInbox {
	m.mu.Lock()
	defer m.mu.Unlock()
	if in, ok := m.inboxes[sessionID]; ok {
		return in
	}
	in := NewSessionInboxWithSettings(sessionID, m.settings)
	m.inboxes[sessionID] = in
	return in
}

// Settings 返回管理器默认策略（副本）。
func (m *InboxManager) Settings() QueueSettings {
	return m.settings
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

// WaitNext 返回指定会话「有新输入可拉取」的合并唤醒信号 channel，
// 供执行器 select 与 ctx.Done() 组合实现「闲时零 CPU 挂起」。
//
// 语义约定：
//   - 会话不存在时返回 nil channel（select 中永不触发，须配合 ctx.Done() 兜底）；
//   - 信号是「可能有新输入」的提示而非「一定有」：唤醒后应循环 Take 直到返回 nil，
//     再回到 WaitNext 阻塞，避免遗漏同批到达的消息；
//   - 信号由 Submit 入队成功后非阻塞发送（见 SessionInbox.Submit），
//     多个消息合并为一次唤醒（容量 1）。
func (m *InboxManager) WaitNext(sessionID string) <-chan struct{} {
	m.mu.Lock()
	defer m.mu.Unlock()
	in := m.inboxes[sessionID]
	if in == nil {
		return nil
	}
	return in.signal // 同包直接访问私有字段，无需 SessionInbox 层透传
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
		in = NewSessionInboxWithSettings(input.SessionID, m.settings)
		m.inboxes[input.SessionID] = in
	}
	running := m.running[input.SessionID]
	m.mu.Unlock()

	// 注意：不在此处修改 input 的 Priority / CreatedAt——
	// 默认值补齐由 SessionInbox.Submit 在内部克隆对象上完成，
	// 避免写入调用方传入的对象（并发安全边界）。
	seq, err := in.Submit(input)
	if err == ErrDuplicateInput || err == ErrDuplicatePrompt {
		snapshot := in.SnapshotVersioned()
		return SubmitResult{
			Duplicated:    true,
			Seq:           seq,
			QueueVersion:  snapshot.QueueVersion,
			ContentDigest: digestForSeq(snapshot.Items, seq),
			Immediate:     input.Semantics.IsImmediate(),
		}, nil
	}
	if err != nil {
		return SubmitResult{}, err
	}

	m.notify(input.SessionID)

	snapshot := in.SnapshotVersioned()
	return SubmitResult{
		Accepted:      true,
		Seq:           seq,
		QueueVersion:  snapshot.QueueVersion,
		ContentDigest: digestForSeq(snapshot.Items, seq),
		ShouldWake:    !running,
		Immediate:     input.Semantics.IsImmediate(),
	}, nil
}

func digestForSeq(items []InboxSnapshot, seq int64) string {
	for _, item := range items {
		if item.Seq == seq && item.Input != nil {
			return item.Input.ContentDigest
		}
	}
	return ""
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

// TakeBatch 批量取出可投递输入（collect 模式，见 SessionInbox.TakeBatch）。
// max <= 0 时使用会话队列策略的 CollectMax；仍 <= 0 时退化为单条。
// 返回的切片为深拷贝；调用方须对每条分别 MarkInjected / MarkFailed。
func (m *InboxManager) TakeBatch(sessionID, activeTurnID string, max int) ([]*Input, error) {
	m.mu.Lock()
	in := m.inboxes[sessionID]
	m.mu.Unlock()
	if in == nil {
		return nil, nil
	}
	taken, err := in.TakeBatch(activeTurnID, max)
	if err != nil {
		return nil, err
	}
	if len(taken) > 0 {
		m.notify(sessionID)
	}
	return taken, nil
}

// ClaimSteerBatch 精确领取当前 turn 的 steer 批次。
func (m *InboxManager) ClaimSteerBatch(sessionID, activeTurnID string, cutoffSeq int64) ([]*Input, error) {
	in := m.inbox(sessionID)
	if in == nil {
		return []*Input{}, nil
	}
	claimed, err := in.ClaimSteerBatch(activeTurnID, cutoffSeq)
	if err != nil {
		return nil, err
	}
	if len(claimed) > 0 {
		m.notify(sessionID)
	}
	return claimed, nil
}

// ClaimNextQueued 只领取一条最早的 pending queue。
func (m *InboxManager) ClaimNextQueued(sessionID string) (*Input, error) {
	in := m.inbox(sessionID)
	if in == nil {
		return nil, nil
	}
	claimed, err := in.ClaimNextQueued()
	if err != nil {
		return nil, err
	}
	if claimed != nil {
		m.notify(sessionID)
	}
	return claimed, nil
}

// ClaimNextUserMessage 只领取一条最早的 pending user_message。
func (m *InboxManager) ClaimNextUserMessage(sessionID string) (*Input, error) {
	in := m.inbox(sessionID)
	if in == nil {
		return nil, nil
	}
	claimed, err := in.ClaimNextUserMessage()
	if err != nil {
		return nil, err
	}
	if claimed != nil {
		m.notify(sessionID)
	}
	return claimed, nil
}

// ClaimByID 按 ID 和语义精确领取一条 pending 输入。
func (m *InboxManager) ClaimByID(sessionID, inputID string, semantics InputSemantics) (*Input, error) {
	in := m.inbox(sessionID)
	if in == nil {
		return nil, ErrInputNotFound
	}
	claimed, err := in.ClaimByID(inputID, semantics)
	if err != nil {
		return nil, err
	}
	m.notify(sessionID)
	return claimed, nil
}

// UpdatePending 以服务端版本保护编辑与 claim 的竞争。
func (m *InboxManager) UpdatePending(sessionID, inputID string, expectedQueueVersion int64, replacement *Input) (int64, error) {
	in := m.inbox(sessionID)
	if in == nil {
		return 0, ErrInputNotFound
	}
	version, err := in.UpdatePending(inputID, expectedQueueVersion, replacement)
	if err != nil {
		return version, err
	}
	m.notify(sessionID)
	return version, nil
}

// UpdatePendingBySemantics 原子校验输入语义、pending 状态和队列版本后再编辑。
func (m *InboxManager) UpdatePendingBySemantics(sessionID, inputID string, expectedQueueVersion int64, semantics InputSemantics, replacement *Input) (int64, error) {
	in := m.inbox(sessionID)
	if in == nil {
		return 0, ErrInputNotFound
	}
	version, err := in.UpdatePendingBySemantics(inputID, expectedQueueVersion, semantics, replacement)
	if err != nil {
		return version, err
	}
	m.notify(sessionID)
	return version, nil
}

// CancelPending 只取消 pending 输入，并以服务端版本保护并发修改。
func (m *InboxManager) CancelPending(sessionID, inputID string, expectedQueueVersion int64) (int64, error) {
	in := m.inbox(sessionID)
	if in == nil {
		return 0, ErrInputNotFound
	}
	version, err := in.CancelPending(inputID, expectedQueueVersion)
	if err != nil {
		return version, err
	}
	m.notify(sessionID)
	return version, nil
}

// CancelPendingBySemantics 原子校验输入语义、pending 状态和队列版本后再取消。
func (m *InboxManager) CancelPendingBySemantics(sessionID, inputID string, expectedQueueVersion int64, semantics InputSemantics) (int64, error) {
	in := m.inbox(sessionID)
	if in == nil {
		return 0, ErrInputNotFound
	}
	version, err := in.CancelPendingBySemantics(inputID, expectedQueueVersion, semantics)
	if err != nil {
		return version, err
	}
	m.notify(sessionID)
	return version, nil
}

func (m *InboxManager) ReleaseClaim(sessionID, inputID string) (int64, error) {
	in := m.inbox(sessionID)
	if in == nil {
		return 0, ErrInputNotFound
	}
	version, err := in.ReleaseClaim(inputID)
	if err == nil {
		m.notify(sessionID)
	}
	return version, err
}

func (m *InboxManager) PromotePendingQueue(sessionID, inputID string, expectedQueueVersion int64, expectedTurnID string) (*Input, int64, error) {
	in := m.inbox(sessionID)
	if in == nil {
		return nil, 0, ErrInputNotFound
	}
	promoted, version, err := in.PromotePendingQueue(inputID, expectedQueueVersion, expectedTurnID)
	if err == nil {
		m.notify(sessionID)
	}
	return promoted, version, err
}

func (m *InboxManager) CancelPendingSemantics(sessionID string, semantics InputSemantics) (int, int64, error) {
	in := m.inbox(sessionID)
	if in == nil {
		return 0, 0, nil
	}
	cancelled, version, err := in.CancelPendingSemantics(semantics)
	if err == nil && cancelled > 0 {
		m.notify(sessionID)
	}
	return cancelled, version, err
}

func (m *InboxManager) inbox(sessionID string) *SessionInbox {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.inboxes[sessionID]
}

// RecoverStale 将指定会话中超过策略阈值的 injecting 输入重置回 pending
// （执行方卡死/崩溃恢复）。返回恢复条数。
func (m *InboxManager) RecoverStale(sessionID string, now int64) int {
	m.mu.Lock()
	in := m.inboxes[sessionID]
	m.mu.Unlock()
	if in == nil {
		return 0
	}
	recovered := in.RecoverStale(now)
	if recovered > 0 {
		m.notify(sessionID)
	}
	return recovered
}

// RecoverAllStale 对所有已注册会话执行 injecting 超时恢复。返回总恢复条数。
func (m *InboxManager) RecoverAllStale(now int64) int {
	m.mu.Lock()
	candidates := make([]*SessionInbox, 0, len(m.inboxes))
	for _, in := range m.inboxes {
		candidates = append(candidates, in)
	}
	m.mu.Unlock()

	total := 0
	for _, in := range candidates {
		if n := in.RecoverStale(now); n > 0 {
			total += n
			m.notify(in.SessionID())
		}
	}
	return total
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
	if err := in.MarkFailed(id); err != nil {
		return err
	}
	m.notify(sessionID)
	return nil
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

// SnapshotVersioned 返回服务端权威队列版本和完整快照。
func (m *InboxManager) SnapshotVersioned(sessionID string) QueueSnapshot {
	in := m.inbox(sessionID)
	if in == nil {
		return QueueSnapshot{
			SchemaVersion: CurrentQueueSchemaVersion,
			Items:         []InboxSnapshot{},
		}
	}
	return in.SnapshotVersioned()
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
	in := m.inboxes[sessionID]
	delete(m.inboxes, sessionID)
	delete(m.running, sessionID)
	m.mu.Unlock()
	if in != nil {
		_ = in.DeleteStorage()
	}
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

// AttachStorage 为指定会话挂载持久化存储（透传 SessionInbox.AttachStorage）。
func (m *InboxManager) AttachStorage(sessionID string, storage QueueStorage) {
	m.mu.Lock()
	in := m.inboxes[sessionID]
	m.mu.Unlock()
	if in == nil {
		return
	}
	in.AttachStorage(storage)
}

// Checkpoint 将指定会话队列状态持久化到已挂载存储（透传 SessionInbox.Checkpoint）。
func (m *InboxManager) Checkpoint(sessionID string) error {
	m.mu.Lock()
	in := m.inboxes[sessionID]
	m.mu.Unlock()
	if in == nil {
		return ErrInputNotFound
	}
	return in.Checkpoint()
}

// RestoreSession 从已挂载存储恢复指定会话队列（透传 SessionInbox.RestoreFromStorage）。
// 返回 ok=false 表示该会话无持久化记录（首次启动）。
func (m *InboxManager) RestoreSession(sessionID string) (bool, error) {
	m.mu.Lock()
	in := m.inboxes[sessionID]
	m.mu.Unlock()
	if in == nil {
		return false, nil
	}
	return in.RestoreFromStorage()
}

// Summary 读取并清除指定会话的 DropSummarize 溢出摘要（透传 SessionInbox.Summary）。
func (m *InboxManager) Summary(sessionID string) QueueSummary {
	m.mu.Lock()
	in := m.inboxes[sessionID]
	m.mu.Unlock()
	if in == nil {
		return QueueSummary{}
	}
	return in.Summary()
}

// Close 关闭管理器，拒绝后续 Submit。
// 已入队输入仍可被 Take 消费（由上层在关闭流程中排空）。
func (m *InboxManager) Close() {
	m.mu.Lock()
	m.closed = true
	m.mu.Unlock()
}
