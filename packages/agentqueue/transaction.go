package agentqueue

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"time"
)

// QueueSnapshot 是一个会话队列的版本化、只读快照。
type QueueSnapshot struct {
	SchemaVersion int             `json:"schemaVersion"`
	QueueVersion  int64           `json:"queueVersion"`
	NextSeq       int64           `json:"nextSeq"`
	Items         []InboxSnapshot `json:"items"`
}

type inboxState struct {
	items        []*inboxItem
	seq          int64
	queueVersion int64
	summary      QueueSummary
}

func (in *SessionInbox) stateLocked() *inboxState {
	return &inboxState{
		items:        cloneInboxItems(in.items),
		seq:          in.seq,
		queueVersion: in.queueVersion,
		summary:      cloneQueueSummary(in.summary),
	}
}

// commitMutationLocked 先保存候选状态，成功后才发布内存状态。
// 调用方必须持有 in.mu；每个可见变更只递增一次 queueVersion。
func (in *SessionInbox) commitMutationLocked(candidate *inboxState) error {
	candidate.queueVersion = in.queueVersion + 1
	if in.storage != nil {
		if err := in.storage.SaveSession(in.sessionID, persistedSnapshotFromState(candidate)); err != nil {
			return err
		}
	}
	in.items = candidate.items
	in.seq = candidate.seq
	in.queueVersion = candidate.queueVersion
	in.summary = candidate.summary
	return nil
}

func cloneInboxItems(items []*inboxItem) []*inboxItem {
	cloned := make([]*inboxItem, 0, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		cloned = append(cloned, &inboxItem{
			input:      cloneInput(item.input),
			seq:        item.seq,
			state:      item.state,
			injectedAt: item.injectedAt,
		})
	}
	return cloned
}

func cloneQueueSummary(summary QueueSummary) QueueSummary {
	cloned := summary
	cloned.SummaryLines = append([]string(nil), summary.SummaryLines...)
	return cloned
}

func persistedSnapshotFromState(state *inboxState) PersistedQueueSnapshot {
	items := make([]PersistedItem, 0, len(state.items))
	for _, item := range state.items {
		input := cloneInput(item.input)
		if input != nil {
			input.Metadata = nil
		}
		items = append(items, PersistedItem{
			Input:      input,
			State:      item.state,
			Seq:        item.seq,
			InjectedAt: item.injectedAt,
		})
	}
	return PersistedQueueSnapshot{
		SchemaVersion: CurrentQueueSchemaVersion,
		QueueVersion:  state.queueVersion,
		NextSeq:       state.seq,
		Items:         items,
	}
}

func snapshotFromState(state *inboxState) QueueSnapshot {
	items := make([]InboxSnapshot, 0, len(state.items))
	position := 0
	for _, item := range state.items {
		snapshot := InboxSnapshot{
			Input: cloneInput(item.input),
			State: item.state,
			Seq:   item.seq,
		}
		if item.state == StatusPending {
			position++
			snapshot.QueuePos = position
		}
		items = append(items, snapshot)
	}
	return QueueSnapshot{
		SchemaVersion: CurrentQueueSchemaVersion,
		QueueVersion:  state.queueVersion,
		NextSeq:       state.seq,
		Items:         items,
	}
}

func normalizeInput(input *Input) (*Input, error) {
	cloned := cloneInput(input)
	if cloned == nil {
		return nil, ErrNilInput
	}
	if cloned.PayloadVersion == 0 {
		cloned.PayloadVersion = CurrentPayloadVersion
	}
	if cloned.PayloadVersion != CurrentPayloadVersion {
		return nil, fmt.Errorf("%w: %d", ErrUnsupportedPayloadVersion, cloned.PayloadVersion)
	}
	if len(cloned.Payload) > 0 {
		canonical, err := canonicalJSON(cloned.Payload)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrInvalidPayload, err)
		}
		cloned.Payload = canonical
	}
	digest, err := inputDigest(cloned)
	if err != nil {
		return nil, err
	}
	cloned.ContentDigest = digest
	return cloned, nil
}

func canonicalJSON(raw json.RawMessage) (json.RawMessage, error) {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	var value any
	if err := decoder.Decode(&value); err != nil {
		return nil, err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		if err == nil {
			return nil, errors.New("multiple JSON values")
		}
		return nil, err
	}
	canonical, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	return canonical, nil
}

func inputDigest(input *Input) (string, error) {
	type digestInput struct {
		SessionID      string          `json:"sessionId"`
		Semantics      InputSemantics  `json:"semantics"`
		Priority       InputPriority   `json:"priority"`
		Content        string          `json:"content"`
		PayloadVersion int             `json:"payloadVersion"`
		Payload        json.RawMessage `json:"payload,omitempty"`
		Source         *SourceContext  `json:"source,omitempty"`
		ExpectedTurnID string          `json:"expectedTurnId,omitempty"`
		LaneKey        string          `json:"laneKey,omitempty"`
		ToolCallID     string          `json:"toolCallId,omitempty"`
		Result         string          `json:"result,omitempty"`
		IsError        bool            `json:"isError,omitempty"`
	}
	encoded, err := json.Marshal(digestInput{
		SessionID:      input.SessionID,
		Semantics:      input.Semantics,
		Priority:       input.Priority,
		Content:        input.Content,
		PayloadVersion: input.PayloadVersion,
		Payload:        input.Payload,
		Source:         input.Source,
		ExpectedTurnID: input.ExpectedTurnID,
		LaneKey:        input.LaneKey,
		ToolCallID:     input.ToolCallID,
		Result:         input.Result,
		IsError:        input.IsError,
	})
	if err != nil {
		return "", fmt.Errorf("agentqueue: digest input: %w", err)
	}
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:]), nil
}

func validateDelivery(input *Input) error {
	if input.Semantics == SemanticsSteer && input.ExpectedTurnID == "" {
		return ErrExpectedTurnIDRequired
	}
	if input.Semantics == SemanticsQueue && input.ExpectedTurnID != "" {
		return ErrExpectedTurnIDForbidden
	}
	return nil
}

func claimItem(item *inboxItem, now int64) *Input {
	item.state = StatusInjecting
	item.injectedAt = now
	return cloneInput(item.input)
}

// ClaimSteerBatch 精确领取属于 activeTurnID 且不晚于 cutoffSeq 的全部 steer。
func (in *SessionInbox) ClaimSteerBatch(activeTurnID string, cutoffSeq int64) ([]*Input, error) {
	if activeTurnID == "" {
		return nil, ErrExpectedTurnIDRequired
	}
	if cutoffSeq <= 0 {
		cutoffSeq = math.MaxInt64
	}
	in.mu.Lock()
	defer in.mu.Unlock()
	candidate := in.stateLocked()
	claimed := make([]*Input, 0)
	now := time.Now().UnixMilli()
	for _, item := range candidate.items {
		if item.state != StatusPending || item.seq > cutoffSeq {
			continue
		}
		if item.input.Semantics != SemanticsSteer || item.input.ExpectedTurnID != activeTurnID {
			continue
		}
		claimed = append(claimed, claimItem(item, now))
	}
	if len(claimed) == 0 {
		return []*Input{}, nil
	}
	if err := in.commitMutationLocked(candidate); err != nil {
		return nil, err
	}
	return claimed, nil
}

func (in *SessionInbox) claimNextSemantics(semantics InputSemantics) (*Input, error) {
	in.mu.Lock()
	defer in.mu.Unlock()
	candidate := in.stateLocked()
	var selected *inboxItem
	for _, item := range candidate.items {
		if item.state != StatusPending || item.input.Semantics != semantics {
			continue
		}
		if selected == nil || item.seq < selected.seq {
			selected = item
		}
	}
	if selected == nil {
		return nil, nil
	}
	claimed := claimItem(selected, time.Now().UnixMilli())
	if err := in.commitMutationLocked(candidate); err != nil {
		return nil, err
	}
	return claimed, nil
}

// ClaimNextQueued 只领取最早的一条 pending queue，不会消费 steer 或其它语义。
func (in *SessionInbox) ClaimNextQueued() (*Input, error) {
	return in.claimNextSemantics(SemanticsQueue)
}

// ClaimNextUserMessage 只领取最早的一条旧 /chat user_message，不会误消费 queue 或 steer。
func (in *SessionInbox) ClaimNextUserMessage() (*Input, error) {
	return in.claimNextSemantics(SemanticsUserMessage)
}

// ClaimByID 按 ID 和语义精确领取一条 pending 输入。
func (in *SessionInbox) ClaimByID(id string, semantics InputSemantics) (*Input, error) {
	in.mu.Lock()
	defer in.mu.Unlock()
	candidate := in.stateLocked()
	for _, item := range candidate.items {
		if item.input.ID != id {
			continue
		}
		if item.input.Semantics != semantics {
			return nil, ErrSemanticsMismatch
		}
		if item.state != StatusPending {
			return nil, ErrNotPending
		}
		claimed := claimItem(item, time.Now().UnixMilli())
		if err := in.commitMutationLocked(candidate); err != nil {
			return nil, err
		}
		return claimed, nil
	}
	return nil, ErrInputNotFound
}

// UpdatePending 以乐观并发版本替换一条 pending 输入的可编辑内容。
func (in *SessionInbox) UpdatePending(id string, expectedQueueVersion int64, replacement *Input) (int64, error) {
	return in.updatePending(id, expectedQueueVersion, "", replacement)
}

// UpdatePendingBySemantics 在同一个版本化事务中校验输入语义并替换 pending 输入。
// 消费者可用它实现 queue、steer 等独立端点，而无需在包外先读快照再修改。
func (in *SessionInbox) UpdatePendingBySemantics(id string, expectedQueueVersion int64, semantics InputSemantics, replacement *Input) (int64, error) {
	return in.updatePending(id, expectedQueueVersion, semantics, replacement)
}

func (in *SessionInbox) updatePending(id string, expectedQueueVersion int64, semantics InputSemantics, replacement *Input) (int64, error) {
	if replacement == nil {
		return in.QueueVersion(), ErrNilInput
	}
	in.mu.Lock()
	defer in.mu.Unlock()
	if expectedQueueVersion != in.queueVersion {
		return in.queueVersion, ErrQueueVersionConflict
	}
	candidate := in.stateLocked()
	for _, item := range candidate.items {
		if item.input.ID != id {
			continue
		}
		if semantics != "" && item.input.Semantics != semantics {
			return in.queueVersion, ErrSemanticsMismatch
		}
		if item.state != StatusPending {
			return in.queueVersion, ErrNotPending
		}
		updated := cloneInput(replacement)
		updated.ID = item.input.ID
		updated.SessionID = item.input.SessionID
		updated.Semantics = item.input.Semantics
		updated.CreatedAt = item.input.CreatedAt
		if err := validateDelivery(updated); err != nil {
			return in.queueVersion, err
		}
		normalized, err := normalizeInput(updated)
		if err != nil {
			return in.queueVersion, err
		}
		item.input = normalized
		if err := in.commitMutationLocked(candidate); err != nil {
			return in.queueVersion, err
		}
		return in.queueVersion, nil
	}
	return in.queueVersion, ErrInputNotFound
}

// CancelPending 以乐观并发版本取消一条 pending 输入。
func (in *SessionInbox) CancelPending(id string, expectedQueueVersion int64) (int64, error) {
	return in.cancelPending(id, expectedQueueVersion, "")
}

// CancelPendingBySemantics 在同一个版本化事务中校验输入语义并取消 pending 输入。
func (in *SessionInbox) CancelPendingBySemantics(id string, expectedQueueVersion int64, semantics InputSemantics) (int64, error) {
	return in.cancelPending(id, expectedQueueVersion, semantics)
}

func (in *SessionInbox) cancelPending(id string, expectedQueueVersion int64, semantics InputSemantics) (int64, error) {
	in.mu.Lock()
	defer in.mu.Unlock()
	if expectedQueueVersion != in.queueVersion {
		return in.queueVersion, ErrQueueVersionConflict
	}
	candidate := in.stateLocked()
	for _, item := range candidate.items {
		if item.input.ID != id {
			continue
		}
		if semantics != "" && item.input.Semantics != semantics {
			return in.queueVersion, ErrSemanticsMismatch
		}
		if item.state != StatusPending {
			return in.queueVersion, ErrNotPending
		}
		item.state = StatusCancelled
		item.injectedAt = 0
		if err := in.commitMutationLocked(candidate); err != nil {
			return in.queueVersion, err
		}
		return in.queueVersion, nil
	}
	return in.queueVersion, ErrInputNotFound
}

// ReleaseClaim 把尚未开始执行的 injecting 输入原子退回 pending。
func (in *SessionInbox) ReleaseClaim(id string) (int64, error) {
	in.mu.Lock()
	defer in.mu.Unlock()
	candidate := in.stateLocked()
	for _, item := range candidate.items {
		if item.input.ID != id {
			continue
		}
		if item.state != StatusInjecting {
			return in.queueVersion, ErrNotPending
		}
		item.state = StatusPending
		item.injectedAt = 0
		if err := in.commitMutationLocked(candidate); err != nil {
			return in.queueVersion, err
		}
		select {
		case in.signal <- struct{}{}:
		default:
		}
		return in.queueVersion, nil
	}
	return in.queueVersion, ErrInputNotFound
}

// PromotePendingQueue 在版本保护下把 pending queue 原子转换为目标 turn 的 steer。
func (in *SessionInbox) PromotePendingQueue(id string, expectedQueueVersion int64, expectedTurnID string) (*Input, int64, error) {
	if expectedTurnID == "" {
		return nil, in.QueueVersion(), ErrExpectedTurnIDRequired
	}
	in.mu.Lock()
	defer in.mu.Unlock()
	if expectedQueueVersion != in.queueVersion {
		return nil, in.queueVersion, ErrQueueVersionConflict
	}
	candidate := in.stateLocked()
	for _, item := range candidate.items {
		if item.input.ID != id {
			continue
		}
		if item.input.Semantics != SemanticsQueue {
			return nil, in.queueVersion, ErrSemanticsMismatch
		}
		if item.state != StatusPending {
			return nil, in.queueVersion, ErrNotPending
		}
		promoted := cloneInput(item.input)
		promoted.Semantics = SemanticsSteer
		promoted.ExpectedTurnID = expectedTurnID
		normalized, err := normalizeInput(promoted)
		if err != nil {
			return nil, in.queueVersion, err
		}
		item.input = normalized
		if err = in.commitMutationLocked(candidate); err != nil {
			return nil, in.queueVersion, err
		}
		select {
		case in.signal <- struct{}{}:
		default:
		}
		return cloneInput(normalized), in.queueVersion, nil
	}
	return nil, in.queueVersion, ErrInputNotFound
}

// CancelPendingSemantics 在一个持久化事务内取消指定语义的全部 pending 输入。
func (in *SessionInbox) CancelPendingSemantics(semantics InputSemantics) (int, int64, error) {
	in.mu.Lock()
	defer in.mu.Unlock()
	candidate := in.stateLocked()
	cancelled := 0
	for _, item := range candidate.items {
		if item.state != StatusPending || item.input.Semantics != semantics {
			continue
		}
		item.state = StatusCancelled
		item.injectedAt = 0
		cancelled++
	}
	if cancelled == 0 {
		return 0, in.queueVersion, nil
	}
	if err := in.commitMutationLocked(candidate); err != nil {
		return 0, in.queueVersion, err
	}
	return cancelled, in.queueVersion, nil
}

// QueueVersion 返回当前服务端权威队列版本。
func (in *SessionInbox) QueueVersion() int64 {
	in.mu.Lock()
	defer in.mu.Unlock()
	return in.queueVersion
}

// SnapshotVersioned 返回队列版本和完整状态的同锁快照。
func (in *SessionInbox) SnapshotVersioned() QueueSnapshot {
	in.mu.Lock()
	defer in.mu.Unlock()
	return snapshotFromState(&inboxState{
		items:        in.items,
		seq:          in.seq,
		queueVersion: in.queueVersion,
		summary:      in.summary,
	})
}
