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
	// ErrInputIDConflict 表示相同输入 ID 对应的内容摘要不同。
	ErrInputIDConflict = errors.New("agentqueue: input id conflicts with different content")
	// ErrDuplicatePrompt 输入文本与队列中 pending 输入重复（prompt 去重命中）。
	ErrDuplicatePrompt = errors.New("agentqueue: duplicate prompt")
	// ErrInputNotFound 输入不存在。
	ErrInputNotFound = errors.New("agentqueue: input not found")
	// ErrNotPending 输入不在 pending 状态，无法执行该操作。
	ErrNotPending = errors.New("agentqueue: input is not pending")
	// ErrQueueVersionConflict 乐观并发版本与服务端当前版本不一致。
	ErrQueueVersionConflict = errors.New("agentqueue: queue version conflict")
	// ErrSemanticsMismatch 输入语义与精确领取请求不一致。
	ErrSemanticsMismatch = errors.New("agentqueue: input semantics mismatch")
	// ErrExpectedTurnIDRequired steer 输入缺少目标 turn。
	ErrExpectedTurnIDRequired = errors.New("agentqueue: expected turn id is required")
	// ErrExpectedTurnIDForbidden queue 输入携带了目标 turn。
	ErrExpectedTurnIDForbidden = errors.New("agentqueue: expected turn id is forbidden")
	// ErrUnsupportedPayloadVersion 持久化载荷版本不受支持。
	ErrUnsupportedPayloadVersion = errors.New("agentqueue: unsupported payload version")
	// ErrInvalidPayload 持久化 JSON 载荷格式不合法。
	ErrInvalidPayload = errors.New("agentqueue: invalid payload")
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
	// injectedAt 是进入 injecting 状态的时间（Unix 毫秒），
	// 用于 RecoverStale 判定「执行方卡死/崩溃后恢复滞留输入」。
	injectedAt int64
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
//   - lane 串行：同一 LaneKey 内同一时刻只允许一条输入处于 injecting 状态，
//     后续同 lane 输入等待其完成（跨渠道消息顺序保证）；
//   - 容量与溢出：超过容量时按 QueueSettings.DropPolicy 处理（拒绝新 / 丢旧 / 摘要丢旧）；
//   - 去重：按 QueueSettings.DedupeMode 做 message-id 或 prompt 级去重；
//   - 状态机：pending → injecting → injected / cancelled / failed；
//     injecting 超时可由 RecoverStale 重置回 pending（执行方崩溃恢复）。
type SessionInbox struct {
	mu        sync.Mutex
	sessionID string
	items     []*inboxItem
	settings  QueueSettings
	summary   QueueSummary // DropSummarize 策略下被丢弃输入的摘要
	storage   QueueStorage // 可选持久化存储（AttachStorage 挂载）
	// signal 是「有新输入可拉取」的合并唤醒信号（容量 1）。
	// Submit 成功入队后非阻塞发送；多个消息到达时只保留一个待消费信号，
	// 避免信号堆积。执行器阻塞在 WaitNext() 上实现「闲时零 CPU 挂起」，
	// 等价于 OS 中进程阻塞等待中断。
	signal       chan struct{}
	seq          int64
	queueVersion int64
}

// NewSessionInbox 创建指定容量的会话输入队列（使用默认策略，仅覆盖容量）。
// capacity <= 0 时使用默认容量 DefaultCapacity。
func NewSessionInbox(sessionID string, capacity int) *SessionInbox {
	settings := DefaultQueueSettings()
	if capacity > 0 {
		settings.Cap = capacity
	}
	return NewSessionInboxWithSettings(sessionID, settings)
}

// NewSessionInboxWithSettings 使用指定策略创建会话输入队列。
func NewSessionInboxWithSettings(sessionID string, settings QueueSettings) *SessionInbox {
	return &SessionInbox{
		sessionID: sessionID,
		settings:  settings.normalize(),
		signal:    make(chan struct{}, 1),
	}
}

// SessionID 返回所属会话。
func (in *SessionInbox) SessionID() string {
	return in.sessionID
}

// Capacity 返回队列容量上限。
func (in *SessionInbox) Capacity() int {
	return in.settings.Cap
}

// Settings 返回队列当前策略（副本，调用方修改不影响内部）。
func (in *SessionInbox) Settings() QueueSettings {
	return in.settings
}

// Summary 返回并清除 DropSummarize 策略累计的溢出摘要。
// 上层在投递前读取摘要注入模型上下文；读取后计数清零。
func (in *SessionInbox) Summary() QueueSummary {
	in.mu.Lock()
	defer in.mu.Unlock()
	s := in.summary
	in.summary = QueueSummary{}
	return s
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
//
// 按 QueueSettings 应用：
//   - DedupeMode=message-id：Input.ID 已存在（任意状态）返回 ErrDuplicateInput；
//   - DedupeMode=prompt：存在相同 Content 的 pending 项返回 ErrDuplicatePrompt；
//   - 容量满时按 DropPolicy 处理：
//     DropNew → ErrQueueFull；DropOld → 丢弃最旧 pending 项并接纳新输入；
//     DropSummarize → 丢弃最旧 pending 项、记录摘要并接纳新输入。
func (in *SessionInbox) Submit(input *Input) (int64, error) {
	if input == nil {
		return 0, ErrNilInput
	}
	if input.SessionID != "" && input.SessionID != in.sessionID {
		return 0, ErrSessionIDMismatch
	}
	normalized := cloneInput(input)
	normalized.SessionID = in.sessionID
	if normalized.CreatedAt == 0 {
		normalized.CreatedAt = time.Now().UnixMilli()
	}
	if err := validateDelivery(normalized); err != nil {
		return 0, err
	}
	var err error
	normalized, err = normalizeInput(normalized)
	if err != nil {
		return 0, err
	}

	in.mu.Lock()
	defer in.mu.Unlock()
	candidate := in.stateLocked()
	for _, it := range candidate.items {
		if normalized.ID == "" || it.input.ID != normalized.ID {
			continue
		}
		if it.input.ContentDigest == normalized.ContentDigest {
			return it.seq, ErrDuplicateInput
		}
		return it.seq, ErrInputIDConflict
	}

	switch in.settings.DedupeMode {
	case DedupeNone:
		// 不做重复检测。
	case DedupePrompt:
		for _, it := range candidate.items {
			if it.state != StatusPending {
				continue
			}
			if it.input.Content != "" && it.input.Content == normalized.Content {
				return it.seq, ErrDuplicatePrompt
			}
		}
	default: // DedupeMessageID 已由上方全局幂等检查覆盖。
	}

	// 容量只统计 pending 项，避免历史项（injected/cancelled）占满队列。
	pending := 0
	for _, it := range candidate.items {
		if it.state == StatusPending {
			pending++
		}
	}
	if pending >= in.settings.Cap {
		switch in.settings.DropPolicy {
		case DropOld, DropSummarize:
			dropped := dropOldestPending(candidate)
			if in.settings.DropPolicy == DropSummarize {
				candidate.summary.DroppedCount++
				if text := summarizeInputText(dropped); text != "" {
					candidate.summary.SummaryLines = append(candidate.summary.SummaryLines, text)
				}
			}
		default: // DropNew
			return 0, ErrQueueFull
		}
	}

	candidate.seq++
	candidate.items = append(candidate.items, &inboxItem{
		input: normalized,
		seq:   candidate.seq,
		state: StatusPending,
	})
	if err := in.commitMutationLocked(candidate); err != nil {
		return 0, err
	}
	// 入队成功后发唤醒信号（持锁内非阻塞发送）：确保「入队成功 → 必有信号」
	// 的原子性，执行器阻塞在 WaitNext() 上可被及时唤醒。
	select {
	case in.signal <- struct{}{}:
	default:
		// 已有未消费信号（合并唤醒），无需重复发送。
	}
	return in.seq, nil
}

func dropOldestPending(state *inboxState) *Input {
	for i, item := range state.items {
		if item.state != StatusPending {
			continue
		}
		dropped := item.input
		state.items = append(state.items[:i], state.items[i+1:]...)
		return dropped
	}
	return nil
}

// dropOldestPendingLocked 丢弃最旧的 pending 项（须持锁调用），返回被丢弃的输入。
// 找不到 pending 项时返回 nil（理论不可达：容量满意味着至少一条 pending）。
func (in *SessionInbox) dropOldestPendingLocked() *Input {
	for i, it := range in.items {
		if it.state != StatusPending {
			continue
		}
		dropped := it.input
		in.items = append(in.items[:i], in.items[i+1:]...)
		return dropped
	}
	return nil
}

// summarizeInputText 生成被丢弃输入的摘要文本（截断至单行便于注入提示词）。
func summarizeInputText(input *Input) string {
	if input == nil {
		return ""
	}
	text := input.Content
	if text == "" {
		text = "(" + string(input.Semantics) + ")"
	}
	const limit = 160
	runes := []rune(text)
	if len(runes) > limit {
		text = string(runes[:limit-1]) + "…"
	}
	return text
}

// Take 取出下一条可投递输入。
//
// 规则（按优先级从高到低扫描）：
//  1. 即时交互语义（steer / interrupt / tool_result）：若 ExpectedTurnID 为空或
//     与 activeTurnID 匹配，则取出（跳过不匹配项，留待目标 turn）；
//  2. 普通语义（queue / user_message / channel_inbound / system / cross_agent）：
//     按入队序号 FIFO 取出。
//
// lane 串行约束：同一 LaneKey 已有输入处于 injecting 状态时，该 lane 的
// 其他 pending 输入不被取出（等待前一条完成），不同 lane 互不影响。
//
// 取出的输入状态置为 Injecting（记录 injectedAt），调用方确认注入完成需调用
// MarkInjected，取消需调用 MarkCancelled（或调用方失败时 MarkFailed）。
// 返回的是输入深拷贝，调用方修改返回对象不影响队列内部状态（并发安全边界）。
func (in *SessionInbox) Take(activeTurnID string) (*Input, error) {
	in.mu.Lock()
	defer in.mu.Unlock()
	candidate := in.stateLocked()
	input := takeFromItems(candidate.items, activeTurnID, time.Now().UnixMilli())
	if input == nil {
		return nil, nil
	}
	if err := in.commitMutationLocked(candidate); err != nil {
		return nil, err
	}
	return input, nil
}

func takeFromItems(items []*inboxItem, activeTurnID string, now int64) *Input {
	// 收集当前处于 injecting 状态的 lane，作为串行阻塞集合。
	blockedLanes := make(map[string]struct{})
	for _, it := range items {
		if it.state == StatusInjecting && it.input.LaneKey != "" {
			blockedLanes[it.input.LaneKey] = struct{}{}
		}
	}
	blocked := func(laneKey string) bool {
		if laneKey == "" {
			return false // 无 lane 键的输入不参与串行约束
		}
		_, ok := blockedLanes[laneKey]
		return ok
	}

	// 第一轮：即时交互语义，带 ExpectedTurnID 匹配。
	for _, it := range items {
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
		if blocked(it.input.LaneKey) {
			continue
		}
		it.state = StatusInjecting
		it.injectedAt = now
		return cloneInput(it.input)
	}

	// 第二轮：普通语义 FIFO。
	for _, it := range items {
		if it.state != StatusPending {
			continue
		}
		if it.input.Semantics.IsImmediate() {
			continue
		}
		if blocked(it.input.LaneKey) {
			continue
		}
		it.state = StatusInjecting
		it.injectedAt = now
		return cloneInput(it.input)
	}

	return nil
}

// TakeBatch 批量取出可投递输入（collect 模式）。
//
// 单次最多取出 max 条：优先即时语义（受 ExpectedTurnID 与 lane 约束），
// 随后普通语义按 FIFO 补齐。max <= 0 时使用 settings.CollectMax；
// 仍 <= 0 时退化为单条（与 Take 等价）。
// 返回的切片为已取出输入的深拷贝；调用方须对每条分别 MarkInjected / MarkFailed。
func (in *SessionInbox) TakeBatch(activeTurnID string, max int) ([]*Input, error) {
	limit := max
	if limit <= 0 {
		limit = in.settings.CollectMax
	}
	if limit <= 0 {
		limit = 1
	}

	in.mu.Lock()
	defer in.mu.Unlock()
	candidate := in.stateLocked()
	changed := false

	// 先做一次 stale 恢复（仅当启用 RecoverStaleMs），保证批量取用不遗漏滞留输入。
	if in.settings.RecoverStaleMs > 0 {
		if recoverStaleItems(candidate.items, in.settings.RecoverStaleMs, time.Now().UnixMilli()) > 0 {
			changed = true
		}
	}

	taken := make([]*Input, 0, limit)
	now := time.Now().UnixMilli()
	for len(taken) < limit {
		input := takeFromItems(candidate.items, activeTurnID, now)
		if input == nil {
			break
		}
		changed = true
		taken = append(taken, input)
	}
	if changed {
		if err := in.commitMutationLocked(candidate); err != nil {
			return nil, err
		}
	}
	return taken, nil
}

// RecoverStale 将超过 settings.RecoverStaleMs 仍处于 injecting 状态的输入
// 重置回 pending（执行方卡死/崩溃后恢复滞留输入，允许重新投递）。
// 未启用超时恢复（RecoverStaleMs <= 0）时返回 0。返回恢复条数。
func (in *SessionInbox) RecoverStale(now int64) int {
	if in.settings.RecoverStaleMs <= 0 {
		return 0
	}
	in.mu.Lock()
	defer in.mu.Unlock()
	candidate := in.stateLocked()
	recovered := recoverStaleItems(candidate.items, in.settings.RecoverStaleMs, now)
	if recovered == 0 {
		return 0
	}
	if err := in.commitMutationLocked(candidate); err != nil {
		return 0
	}
	return recovered
}

func recoverStaleItems(items []*inboxItem, recoverStaleMs, now int64) int {
	if recoverStaleMs <= 0 {
		return 0
	}
	cutoff := now - recoverStaleMs
	recovered := 0
	for _, it := range items {
		if it.state == StatusInjecting && it.injectedAt > 0 && it.injectedAt <= cutoff {
			it.state = StatusPending
			it.injectedAt = 0
			recovered++
		}
	}
	return recovered
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
// 状态迁出 injecting 时清空 injectedAt，避免残留时间戳影响后续 RecoverStale 判定。
func (in *SessionInbox) markState(id string, fromState InboxStatus, toState InboxStatus) error {
	in.mu.Lock()
	defer in.mu.Unlock()
	candidate := in.stateLocked()
	for _, it := range candidate.items {
		if it.input.ID != id {
			continue
		}
		if fromState != anyState && it.state != fromState {
			return ErrNotPending
		}
		it.state = toState
		if toState != StatusInjecting {
			it.injectedAt = 0
		}
		return in.commitMutationLocked(candidate)
	}
	return ErrInputNotFound
}

// Snapshot 返回队列全部条目的状态快照（副本，调用方修改不影响内部状态）。
func (in *SessionInbox) Snapshot() []InboxSnapshot {
	return in.SnapshotVersioned().Items
}

// Prune 清理超过 maxRetained 条的非 pending 历史项（保留最近的），
// 防止历史项无限累积。返回清理条数。maxRetained <= 0 时使用默认值 DefaultMaxRetained。
func (in *SessionInbox) Prune(maxRetained int) int {
	if maxRetained <= 0 {
		maxRetained = DefaultMaxRetained
	}
	in.mu.Lock()
	defer in.mu.Unlock()
	candidate := in.stateLocked()

	nonPending := 0
	for _, it := range candidate.items {
		if it.state != StatusPending {
			nonPending++
		}
	}
	if nonPending <= maxRetained {
		return 0
	}
	drop := nonPending - maxRetained
	kept := make([]*inboxItem, 0, len(candidate.items)-drop)
	dropped := 0
	for _, it := range candidate.items {
		if it.state != StatusPending && dropped < drop {
			dropped++
			continue
		}
		kept = append(kept, it)
	}
	candidate.items = kept
	if err := in.commitMutationLocked(candidate); err != nil {
		return 0
	}
	return dropped
}

// cloneInput 深拷贝 Input（Source / Metadata 等嵌套结构）。
// Metadata 值为 map / slice 时递归拷贝，标量值直接共享（不可变）。
func cloneInput(src *Input) *Input {
	if src == nil {
		return nil
	}
	dst := *src
	if src.Payload != nil {
		dst.Payload = append([]byte(nil), src.Payload...)
	}
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
