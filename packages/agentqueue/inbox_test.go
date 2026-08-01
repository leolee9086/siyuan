package agentqueue

import (
	"fmt"
	"sync"
	"testing"
)

// newTestInput 构造一条测试输入。
func newTestInput(id, sessionID string, semantics InputSemantics) *Input {
	return &Input{
		ID:        id,
		SessionID: sessionID,
		Semantics: semantics,
		Content:   "content-" + id,
	}
}

// TestSessionInboxSubmitTakeFIFO 验证普通语义消息按 FIFO 顺序取出。
func TestSessionInboxSubmitTakeFIFO(t *testing.T) {
	in := NewSessionInbox("sess-1", 10)
	for _, id := range []string{"a", "b", "c"} {
		if _, err := in.Submit(newTestInput(id, "sess-1", SemanticsQueue)); err != nil {
			t.Fatalf("submit %s failed: %v", id, err)
		}
	}
	for _, want := range []string{"a", "b", "c"} {
		got, err := in.Take("")
		if err != nil {
			t.Fatalf("take failed: %v", err)
		}
		if got == nil || got.ID != want {
			t.Fatalf("take order mismatch: got %v, want %s", got, want)
		}
	}
	got, err := in.Take("")
	if err != nil {
		t.Fatalf("take on empty failed: %v", err)
	}
	if got != nil {
		t.Fatalf("take on empty should return nil, got %v", got)
	}
}

// TestSessionInboxSubmitDuplicate 验证重复 ID 返回 ErrDuplicateInput。
func TestSessionInboxSubmitDuplicate(t *testing.T) {
	in := NewSessionInbox("sess-1", 10)
	if _, err := in.Submit(newTestInput("dup", "sess-1", SemanticsQueue)); err != nil {
		t.Fatalf("first submit failed: %v", err)
	}
	// 已取出的项再次提交同样视为重复（幂等键全局唯一）。
	if _, err := in.Take(""); err != nil {
		t.Fatalf("take failed: %v", err)
	}
	if _, err := in.Submit(newTestInput("dup", "sess-1", SemanticsQueue)); err != ErrDuplicateInput {
		t.Fatalf("duplicate submit: got %v, want ErrDuplicateInput", err)
	}
}

// TestSessionInboxCapacity 验证容量限制（只统计 pending 项）。
func TestSessionInboxCapacity(t *testing.T) {
	in := NewSessionInbox("sess-1", 2)
	if _, err := in.Submit(newTestInput("a", "sess-1", SemanticsQueue)); err != nil {
		t.Fatal(err)
	}
	if _, err := in.Submit(newTestInput("b", "sess-1", SemanticsQueue)); err != nil {
		t.Fatal(err)
	}
	if _, err := in.Submit(newTestInput("c", "sess-1", SemanticsQueue)); err != ErrQueueFull {
		t.Fatalf("capacity exceeded: got %v, want ErrQueueFull", err)
	}
	// 取出一条后腾出空间。
	if _, err := in.Take(""); err != nil {
		t.Fatal(err)
	}
	if _, err := in.Submit(newTestInput("c", "sess-1", SemanticsQueue)); err != nil {
		t.Fatalf("submit after take should succeed: %v", err)
	}
}

// TestSessionInboxTakeImmediatePriority 验证即时语义（steer）优先于普通排队消息。
func TestSessionInboxTakeImmediatePriority(t *testing.T) {
	in := NewSessionInbox("sess-1", 10)
	// 先入两条普通消息。
	in.Submit(newTestInput("q1", "sess-1", SemanticsQueue))
	in.Submit(newTestInput("q2", "sess-1", SemanticsQueue))
	// 后入一条 steer（匹配 turn-1）。
	steer := newTestInput("s1", "sess-1", SemanticsSteer)
	steer.ExpectedTurnID = "turn-1"
	in.Submit(steer)

	// 即使 steer 后入，也优先取出（带 turn 匹配）。
	got, err := in.Take("turn-1")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || got.ID != "s1" {
		t.Fatalf("immediate priority mismatch: got %v, want s1", got)
	}
	// 剩余普通消息按 FIFO。
	got, _ = in.Take("turn-1")
	if got == nil || got.ID != "q1" {
		t.Fatalf("fifo after steer mismatch: got %v, want q1", got)
	}
}

// TestSessionInboxTakeTurnMismatch 验证不匹配 turn 的即时消息不被消费，
// 但普通消息仍可取出。
func TestSessionInboxTakeTurnMismatch(t *testing.T) {
	in := NewSessionInbox("sess-1", 10)
	steer := newTestInput("s1", "sess-1", SemanticsSteer)
	steer.ExpectedTurnID = "turn-9" // 只对 turn-9 有效
	in.Submit(steer)
	in.Submit(newTestInput("q1", "sess-1", SemanticsQueue))

	// 当前 turn 是 turn-1：steer 不匹配，跳过；普通消息可取。
	got, err := in.Take("turn-1")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || got.ID != "q1" {
		t.Fatalf("turn mismatch should skip steer: got %v, want q1", got)
	}
	// 队列已空（steer 仍保留等待 turn-9）。
	got, _ = in.Take("turn-1")
	if got != nil {
		t.Fatalf("queue should be empty for turn-1, got %v", got)
	}
	// turn-9 到达时可取到 steer。
	got, _ = in.Take("turn-9")
	if got == nil || got.ID != "s1" {
		t.Fatalf("steer for turn-9 should be taken: got %v", got)
	}
}

// TestSessionInboxTakeEmptyExpectedTurnID 验证 ExpectedTurnID 为空时任意 turn 可取。
func TestSessionInboxTakeEmptyExpectedTurnID(t *testing.T) {
	in := NewSessionInbox("sess-1", 10)
	in.Submit(newTestInput("s1", "sess-1", SemanticsSteer)) // ExpectedTurnID 为空
	got, err := in.Take("turn-any")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || got.ID != "s1" {
		t.Fatalf("empty expected turn should match any: got %v", got)
	}
}

// TestSessionInboxMarkInjected 验证 MarkInjected 状态机。
func TestSessionInboxMarkInjected(t *testing.T) {
	in := NewSessionInbox("sess-1", 10)
	in.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	if _, err := in.Take(""); err != nil {
		t.Fatal(err)
	}
	if err := in.MarkInjected("a"); err != nil {
		t.Fatalf("mark injected failed: %v", err)
	}
	// 重复标记报错（非 injecting 状态）。
	if err := in.MarkInjected("a"); err != ErrNotPending {
		t.Fatalf("double mark injected: got %v, want ErrNotPending", err)
	}
	// 不存在的 ID 报错。
	if err := in.MarkInjected("nope"); err != ErrInputNotFound {
		t.Fatalf("mark unknown id: got %v, want ErrInputNotFound", err)
	}
}

// TestSessionInboxMarkCancelled 验证取消。
func TestSessionInboxMarkCancelled(t *testing.T) {
	in := NewSessionInbox("sess-1", 10)
	in.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	if err := in.MarkCancelled("a"); err != nil {
		t.Fatalf("mark cancelled failed: %v", err)
	}
	// 已取消的项不可被取出。
	got, _ := in.Take("")
	if got != nil {
		t.Fatalf("cancelled item should not be taken: %v", got)
	}
	// 快照显示 cancelled 状态。
	snaps := in.Snapshot()
	if len(snaps) != 1 || snaps[0].State != StatusCancelled {
		t.Fatalf("snapshot mismatch: %+v", snaps)
	}
}

// TestSessionInboxMarkFailed 验证失败标记。
func TestSessionInboxMarkFailed(t *testing.T) {
	in := NewSessionInbox("sess-1", 10)
	in.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	if _, err := in.Take(""); err != nil {
		t.Fatal(err)
	}
	if err := in.MarkFailed("a"); err != nil {
		t.Fatalf("mark failed: %v", err)
	}
	snaps := in.Snapshot()
	if snaps[0].State != StatusFailed {
		t.Fatalf("failed state mismatch: %+v", snaps[0])
	}
}

// TestSessionInboxSnapshotDeepCopy 验证 Snapshot 是深拷贝，修改不影响内部状态。
func TestSessionInboxSnapshotDeepCopy(t *testing.T) {
	in := NewSessionInbox("sess-1", 10)
	inp := newTestInput("a", "sess-1", SemanticsQueue)
	inp.Metadata = map[string]any{"k": "v"}
	in.Submit(inp)

	snaps := in.Snapshot()
	// 修改快照中的字段与 map。
	snaps[0].Input.Content = "mutated"
	snaps[0].Input.Metadata["k"] = "mutated"
	snaps[0].State = StatusInjected

	// 内部状态不受影响。
	got, _ := in.Take("")
	if got == nil || got.Content != "content-a" {
		t.Fatalf("internal content mutated: %v", got)
	}
	if got.Metadata["k"] != "v" {
		t.Fatalf("internal metadata mutated: %v", got.Metadata)
	}
}

// TestSessionInboxQueuePos 验证快照中 pending 项的 QueuePos 序号。
func TestSessionInboxQueuePos(t *testing.T) {
	in := NewSessionInbox("sess-1", 10)
	in.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	in.Submit(newTestInput("b", "sess-1", SemanticsQueue))
	// 取出 a，a 变为 injecting。
	in.Take("")
	in.Submit(newTestInput("c", "sess-1", SemanticsQueue))

	snaps := in.Snapshot()
	posByID := map[string]int{}
	for _, s := range snaps {
		posByID[s.Input.ID] = s.QueuePos
	}
	// b 是第一个 pending → pos 1；c 是第二个 pending → pos 2；a 非 pending → pos 0。
	if posByID["b"] != 1 || posByID["c"] != 2 || posByID["a"] != 0 {
		t.Fatalf("queue pos mismatch: %+v", posByID)
	}
}

// TestSessionInboxPrune 验证历史项清理。
func TestSessionInboxPrune(t *testing.T) {
	in := NewSessionInbox("sess-1", 100)
	// 提交 10 条并全部取出（变为 injecting），再标记 injected。
	for i := 0; i < 10; i++ {
		id := string(rune('a' + i))
		in.Submit(newTestInput(id, "sess-1", SemanticsQueue))
		in.Take("")
		in.MarkInjected(id)
	}
	if in.Len() != 10 {
		t.Fatalf("before prune: got %d, want 10", in.Len())
	}
	dropped := in.Prune(3)
	if dropped != 7 {
		t.Fatalf("prune dropped: got %d, want 7", dropped)
	}
	if in.Len() != 3 {
		t.Fatalf("after prune: got %d, want 3", in.Len())
	}
	// pending 项不受 prune 影响。
	in.Submit(newTestInput("p1", "sess-1", SemanticsQueue))
	in.Prune(0) // maxRetained<=0 用默认 100，不删
	if in.PendingCount() != 1 {
		t.Fatalf("pending count after prune: got %d, want 1", in.PendingCount())
	}
}

// TestSessionInboxSessionIDMismatch 验证 SessionID 不匹配被拒绝。
func TestSessionInboxSessionIDMismatch(t *testing.T) {
	in := NewSessionInbox("sess-1", 10)
	inp := newTestInput("a", "sess-other", SemanticsQueue)
	if _, err := in.Submit(inp); err == nil {
		t.Fatal("submit with mismatched session id should fail")
	}
}

// TestSessionInboxNilInput 验证 nil 输入被拒绝。
func TestSessionInboxNilInput(t *testing.T) {
	in := NewSessionInbox("sess-1", 10)
	if _, err := in.Submit(nil); err != ErrNilInput {
		t.Fatalf("nil input: got %v, want ErrNilInput", err)
	}
}

// TestSessionInboxConcurrent 验证并发 Submit / Take 无竞态且不丢数据。
func TestSessionInboxConcurrent(t *testing.T) {
	in := NewSessionInbox("sess-1", 1000)
	const goroutines = 8
	const perGoroutine = 100

	var wg sync.WaitGroup
	// 并发提交。
	for g := 0; g < goroutines; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			for i := 0; i < perGoroutine; i++ {
				id := fmt.Sprintf("g%d-%d", g, i)
				in.Submit(newTestInput(id, "sess-1", SemanticsQueue))
			}
		}(g)
	}
	wg.Wait()

	if in.PendingCount() != goroutines*perGoroutine {
		t.Fatalf("pending count: got %d, want %d", in.PendingCount(), goroutines*perGoroutine)
	}

	// 并发取出。
	seen := make(map[string]bool)
	var seenMu sync.Mutex
	var takeWg sync.WaitGroup
	for c := 0; c < goroutines; c++ {
		takeWg.Add(1)
		go func() {
			defer takeWg.Done()
			for {
				got, err := in.Take("")
				if err != nil {
					t.Errorf("take error: %v", err)
					return
				}
				if got == nil {
					return
				}
				seenMu.Lock()
				if seen[got.ID] {
					seenMu.Unlock()
					t.Errorf("duplicate take: %s", got.ID)
					return
				}
				seen[got.ID] = true
				seenMu.Unlock()
			}
		}()
	}
	takeWg.Wait()

	seenMu.Lock()
	defer seenMu.Unlock()
	if len(seen) != goroutines*perGoroutine {
		t.Fatalf("taken count: got %d, want %d", len(seen), goroutines*perGoroutine)
	}
}
