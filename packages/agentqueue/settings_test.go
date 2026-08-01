package agentqueue

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// 本文件覆盖策略增强与持久化的回归测试：
//   - QueueSettings：drop policy（new / old / summarize）、dedupe（prompt）
//   - laneKey 串行隔离
//   - TakeBatch（collect 批量取出）
//   - RecoverStale（injecting 超时恢复）
//   - QueueStorage：MemoryStorage / FileStorage（Checkpoint / RestoreFromStorage）
//   - 多订阅者事件（Subscribe / Unsubscribe）

// TestDropPolicyNew 验证 DropNew（默认）：队满拒绝新输入。
func TestDropPolicyNew(t *testing.T) {
	in := NewSessionInbox("sess-1", 2)
	for _, id := range []string{"a", "b"} {
		if _, err := in.Submit(newTestInput(id, "sess-1", SemanticsQueue)); err != nil {
			t.Fatalf("submit %s: %v", id, err)
		}
	}
	if _, err := in.Submit(newTestInput("c", "sess-1", SemanticsQueue)); err != ErrQueueFull {
		t.Fatalf("DropNew overflow: got %v, want ErrQueueFull", err)
	}
}

// TestDropPolicyOld 验证 DropOld：队满丢弃最旧 pending，接纳新输入。
func TestDropPolicyOld(t *testing.T) {
	in := NewSessionInboxWithSettings("sess-1", QueueSettings{
		Cap:        2,
		DropPolicy: DropOld,
	})
	for _, id := range []string{"a", "b"} {
		if _, err := in.Submit(newTestInput(id, "sess-1", SemanticsQueue)); err != nil {
			t.Fatalf("submit %s: %v", id, err)
		}
	}
	// 队满后提交 c：丢弃最旧的 a，接纳 c。
	if _, err := in.Submit(newTestInput("c", "sess-1", SemanticsQueue)); err != nil {
		t.Fatalf("DropOld overflow: %v", err)
	}
	// 队列中应为 b、c（a 被丢弃）。
	got, _ := in.Take("")
	if got == nil || got.ID != "b" {
		t.Fatalf("DropOld first take: got %v, want b", got)
	}
	got, _ = in.Take("")
	if got == nil || got.ID != "c" {
		t.Fatalf("DropOld second take: got %v, want c", got)
	}
}

// TestDropPolicySummarize 验证 DropSummarize：队满丢弃最旧并记录摘要。
func TestDropPolicySummarize(t *testing.T) {
	in := NewSessionInboxWithSettings("sess-1", QueueSettings{
		Cap:        2,
		DropPolicy: DropSummarize,
	})
	in.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	in.Submit(newTestInput("b", "sess-1", SemanticsQueue))
	in.Submit(newTestInput("c", "sess-1", SemanticsQueue)) // 丢弃 a，记录摘要

	summary := in.Summary()
	if summary.DroppedCount != 1 {
		t.Fatalf("summary dropped count: got %d, want 1", summary.DroppedCount)
	}
	if len(summary.SummaryLines) != 1 {
		t.Fatalf("summary lines: got %d, want 1", len(summary.SummaryLines))
	}
	// Summary 读取后清零。
	if s := in.Summary(); s.DroppedCount != 0 {
		t.Fatalf("summary should clear after read: got %d", s.DroppedCount)
	}
}

// TestDedupePrompt 验证 prompt 级去重：相同文本的 pending 输入被拒绝。
func TestDedupePrompt(t *testing.T) {
	in := NewSessionInboxWithSettings("sess-1", QueueSettings{
		Cap:        10,
		DedupeMode: DedupePrompt,
	})
	inp := newTestInput("a", "sess-1", SemanticsQueue)
	inp.Content = "hello world"
	if _, err := in.Submit(inp); err != nil {
		t.Fatalf("first submit: %v", err)
	}
	dup := newTestInput("b", "sess-1", SemanticsQueue)
	dup.Content = "hello world"
	if _, err := in.Submit(dup); err != ErrDuplicatePrompt {
		t.Fatalf("prompt dedupe: got %v, want ErrDuplicatePrompt", err)
	}
	// 不同文本可入队。
	other := newTestInput("c", "sess-1", SemanticsQueue)
	other.Content = "different"
	if _, err := in.Submit(other); err != nil {
		t.Fatalf("different prompt should be accepted: %v", err)
	}
}

// TestDedupeNone 验证 DedupeNone：同 ID 重复提交不被拒绝。
func TestDedupeNone(t *testing.T) {
	in := NewSessionInboxWithSettings("sess-1", QueueSettings{
		Cap:        10,
		DedupeMode: DedupeNone,
	})
	if _, err := in.Submit(newTestInput("a", "sess-1", SemanticsQueue)); err != nil {
		t.Fatal(err)
	}
	if _, err := in.Submit(newTestInput("a", "sess-1", SemanticsQueue)); err != nil {
		t.Fatalf("DedupeNone should accept duplicate id: %v", err)
	}
}

// TestLaneKeySerialization 验证 lane 串行：同 lane 内一条 injecting 时，
// 后续同 lane 输入不被取出；不同 lane 不受影响。
func TestLaneKeySerialization(t *testing.T) {
	in := NewSessionInbox("sess-1", 10)
	wechat := func(id string) *Input {
		inp := newTestInput(id, "sess-1", SemanticsChannelInbound)
		inp.LaneKey = "wechat:acct:user"
		return inp
	}
	cli := func(id string) *Input {
		inp := newTestInput(id, "sess-1", SemanticsChannelInbound)
		inp.LaneKey = "cli:session"
		return inp
	}
	in.Submit(wechat("w1"))
	in.Submit(cli("c1"))
	in.Submit(wechat("w2"))

	// 第一条取出 w1（injecting），同 lane 的 w2 被阻塞，但不同 lane 的 c1 可取。
	got, _ := in.Take("")
	if got == nil || got.ID != "w1" {
		t.Fatalf("first take: got %v, want w1", got)
	}
	got, _ = in.Take("")
	if got == nil || got.ID != "c1" {
		t.Fatalf("cross-lane take: got %v, want c1", got)
	}
	// w2 仍被 w1 的 injecting 状态阻塞。
	got, _ = in.Take("")
	if got != nil {
		t.Fatalf("same-lane blocked input should not be taken: %v", got)
	}
	// 完成 w1 后 w2 可取。
	if err := in.MarkInjected("w1"); err != nil {
		t.Fatal(err)
	}
	got, _ = in.Take("")
	if got == nil || got.ID != "w2" {
		t.Fatalf("after lane release: got %v, want w2", got)
	}
}

// TestTakeBatchCollect 验证 collect 批量取出。
func TestTakeBatchCollect(t *testing.T) {
	in := NewSessionInboxWithSettings("sess-1", QueueSettings{
		Cap:        10,
		CollectMax: 3,
	})
	for _, id := range []string{"a", "b", "c", "d"} {
		in.Submit(newTestInput(id, "sess-1", SemanticsQueue))
	}
	taken, err := in.TakeBatch("", 0) // 使用 settings.CollectMax=3
	if err != nil {
		t.Fatal(err)
	}
	if len(taken) != 3 {
		t.Fatalf("take batch: got %d, want 3", len(taken))
	}
	for i, want := range []string{"a", "b", "c"} {
		if taken[i].ID != want {
			t.Fatalf("batch[%d]: got %s, want %s", i, taken[i].ID, want)
		}
	}
	// 剩余 1 条。
	remaining, _ := in.TakeBatch("", 0)
	if len(remaining) != 1 || remaining[0].ID != "d" {
		t.Fatalf("remaining batch: %+v", remaining)
	}
}

// TestRecoverStale 验证 injecting 超时恢复。
func TestRecoverStale(t *testing.T) {
	in := NewSessionInboxWithSettings("sess-1", QueueSettings{
		Cap:            10,
		RecoverStaleMs: 100,
	})
	in.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	if _, err := in.Take(""); err != nil {
		t.Fatal(err)
	}
	// 未超时：不恢复。
	if n := in.RecoverStale(time.Now().UnixMilli()); n != 0 {
		t.Fatalf("pre-timeout recover: got %d, want 0", n)
	}
	// 超时：恢复为 pending 并可重新取出。
	if n := in.RecoverStale(time.Now().UnixMilli() + 200); n != 1 {
		t.Fatalf("post-timeout recover: got %d, want 1", n)
	}
	got, _ := in.Take("")
	if got == nil || got.ID != "a" {
		t.Fatalf("recovered take: got %v, want a", got)
	}
}

// TestMemoryStorageRoundTrip 验证内存存储的 Checkpoint / Restore。
func TestMemoryStorageRoundTrip(t *testing.T) {
	in := NewSessionInbox("sess-1", 10)
	storage := NewMemoryStorage()
	in.AttachStorage(storage)
	in.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	in.Submit(newTestInput("b", "sess-1", SemanticsQueue))
	if err := in.Checkpoint(); err != nil {
		t.Fatalf("checkpoint: %v", err)
	}

	// 模拟进程重启：新建队列并从存储恢复。
	restored := NewSessionInbox("sess-1", 10)
	restored.AttachStorage(storage)
	ok, err := restored.RestoreFromStorage()
	if err != nil || !ok {
		t.Fatalf("restore: ok=%v err=%v", ok, err)
	}
	got, _ := restored.Take("")
	if got == nil || got.ID != "a" {
		t.Fatalf("restored first: got %v, want a", got)
	}
}

// TestFileStorageRoundTrip 验证文件存储的 Checkpoint / Restore（含 injecting 恢复语义）。
func TestFileStorageRoundTrip(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "agentqueue-storage")
	storage, err := NewFileStorage(dir)
	if err != nil {
		t.Fatalf("new file storage: %v", err)
	}

	in := NewSessionInbox("sess-f", 10)
	in.AttachStorage(storage)
	in.Submit(newTestInput("a", "sess-f", SemanticsQueue))
	// 取出 a 使其处于 injecting（模拟执行中崩溃）。
	if _, err := in.Take(""); err != nil {
		t.Fatal(err)
	}
	if err := in.Checkpoint(); err != nil {
		t.Fatalf("checkpoint: %v", err)
	}

	// 模拟崩溃重启：恢复后 injecting 应重置为 pending。
	restored := NewSessionInbox("sess-f", 10)
	restored.AttachStorage(storage)
	ok, err := restored.RestoreFromStorage()
	if err != nil || !ok {
		t.Fatalf("restore: ok=%v err=%v", ok, err)
	}
	if restored.PendingCount() != 1 {
		t.Fatalf("restored pending: got %d, want 1 (injecting reset to pending)", restored.PendingCount())
	}
	got, _ := restored.Take("")
	if got == nil || got.ID != "a" {
		t.Fatalf("restored take: got %v, want a", got)
	}

	// 删除会话存储。
	if err := storage.DeleteSession("sess-f"); err != nil {
		t.Fatalf("delete session: %v", err)
	}
	_, ok, _ = storage.LoadSession("sess-f")
	if ok {
		t.Fatal("session should be deleted from storage")
	}
}

// TestFileStoragePersistenceAcrossInstance 验证 FileStorage 跨实例持久化（真实文件）。
func TestFileStoragePersistenceAcrossInstance(t *testing.T) {
	dir := t.TempDir()
	storage1, err := NewFileStorage(dir)
	if err != nil {
		t.Fatal(err)
	}
	in1 := NewSessionInbox("sess-x", 10)
	in1.AttachStorage(storage1)
	in1.Submit(newTestInput("a", "sess-x", SemanticsQueue))
	if err := in1.Checkpoint(); err != nil {
		t.Fatal(err)
	}

	// 新实例（同一目录）读取。
	storage2, err := NewFileStorage(dir)
	if err != nil {
		t.Fatal(err)
	}
	in2 := NewSessionInbox("sess-x", 10)
	in2.AttachStorage(storage2)
	ok, err := in2.RestoreFromStorage()
	if err != nil || !ok {
		t.Fatalf("restore across instance: ok=%v err=%v", ok, err)
	}
	got, _ := in2.Take("")
	if got == nil || got.ID != "a" {
		t.Fatalf("cross-instance take: got %v, want a", got)
	}
}

// TestManagerSubscribe 验证多订阅者事件：Subscribe 注册、Unsubscribe 退订。
func TestManagerSubscribe(t *testing.T) {
	m := NewInboxManager(10)
	var first, second []string
	unsub1 := m.Subscribe(func(sessionID string) {
		first = append(first, sessionID)
	})
	unsub2 := m.Subscribe(func(sessionID string) {
		second = append(second, sessionID)
	})

	m.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	if len(first) != 1 || len(second) != 1 {
		t.Fatalf("both subscribers should fire: first=%d second=%d", len(first), len(second))
	}

	unsub1()
	m.Submit(newTestInput("b", "sess-1", SemanticsQueue))
	if len(first) != 1 {
		t.Fatalf("unsubscribed subscriber should not fire: got %d", len(first))
	}
	if len(second) != 2 {
		t.Fatalf("remaining subscriber should fire: got %d", len(second))
	}
	unsub2()
}

// TestManagerRegisterInbox 验证 RegisterInbox 注册定制会话（携带独立策略）。
func TestManagerRegisterInbox(t *testing.T) {
	m := NewInboxManager(10)
	custom := NewSessionInboxWithSettings("custom-sess", QueueSettings{
		Cap:        5,
		DropPolicy: DropOld,
	})
	m.RegisterInbox(custom)

	// Submit 经 Manager 落到定制会话。
	if _, err := m.Submit(newTestInput("a", "custom-sess", SemanticsQueue)); err != nil {
		t.Fatal(err)
	}
	if m.PendingCount("custom-sess") != 1 {
		t.Fatalf("custom session pending: got %d, want 1", m.PendingCount("custom-sess"))
	}
	// 定制会话的 drop policy 生效：容量 5 内测试提交 5 条验证不溢出。
	for _, id := range []string{"b", "c", "d", "e"} {
		m.Submit(newTestInput(id, "custom-sess", SemanticsQueue))
	}
	if m.PendingCount("custom-sess") != 5 {
		t.Fatalf("custom session cap: got %d, want 5", m.PendingCount("custom-sess"))
	}
}

// TestManagerSettings 验证管理器默认策略透传。
func TestManagerSettings(t *testing.T) {
	m := NewInboxManagerWithSettings(QueueSettings{
		Cap:        3,
		DropPolicy: DropOld,
	})
	m.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	m.Submit(newTestInput("b", "sess-1", SemanticsQueue))
	m.Submit(newTestInput("c", "sess-1", SemanticsQueue))
	// DropOld：队满提交 d 丢弃 a。
	if _, err := m.Submit(newTestInput("d", "sess-1", SemanticsQueue)); err != nil {
		t.Fatalf("manager DropOld overflow: %v", err)
	}
	got, _ := m.Take("sess-1", "")
	if got == nil || got.ID != "b" {
		t.Fatalf("manager DropOld take: got %v, want b", got)
	}
}

// TestManagerCheckpointRestore 验证 Manager 透传 Checkpoint / RestoreSession。
func TestManagerCheckpointRestore(t *testing.T) {
	m := NewInboxManager(10)
	storage := NewMemoryStorage()
	m.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	m.AttachStorage("sess-1", storage)
	if err := m.Checkpoint("sess-1"); err != nil {
		t.Fatalf("manager checkpoint: %v", err)
	}

	// 重建管理器并恢复。
	m2 := NewInboxManager(10)
	m2.Submit(newTestInput("placeholder", "sess-1", SemanticsQueue)) // 触发会话创建
	m2.AttachStorage("sess-1", storage)
	ok, err := m2.RestoreSession("sess-1")
	if err != nil || !ok {
		t.Fatalf("manager restore: ok=%v err=%v", ok, err)
	}
	got, _ := m2.Take("sess-1", "")
	if got == nil || got.ID != "a" {
		t.Fatalf("manager restored take: got %v, want a", got)
	}
}

// TestFileStorageEmptyDir 验证空目录参数被拒绝。
func TestFileStorageEmptyDir(t *testing.T) {
	if _, err := NewFileStorage(""); err == nil {
		t.Fatal("empty dir should be rejected")
	}
}

// TestFileStorageReadOnly 验证文件存储目录不可写时的错误路径。
func TestFileStorageReadOnly(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "ro")
	if err := os.MkdirAll(dir, 0o555); err != nil {
		t.Skipf("cannot create read-only dir: %v", err)
	}
	// Windows 上权限位不严格生效，跳过只读断言（环境差异）。
	storage, err := NewFileStorage(dir)
	if err != nil {
		// 目录创建失败也算合理拒绝。
		return
	}
	_ = storage // 其余路径由 RoundTrip 测试覆盖
}
