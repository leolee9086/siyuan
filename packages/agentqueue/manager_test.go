package agentqueue

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

// TestManagerSubmitCreatesSession 验证 Submit 自动创建会话队列。
func TestManagerSubmitCreatesSession(t *testing.T) {
	m := NewInboxManager(10)
	res, err := m.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	if err != nil {
		t.Fatalf("submit failed: %v", err)
	}
	if !res.Accepted {
		t.Fatal("submit should be accepted")
	}
	if !res.ShouldWake {
		t.Fatal("non-running session: ShouldWake should be true")
	}
	if m.PendingCount("sess-1") != 1 {
		t.Fatalf("pending count: got %d, want 1", m.PendingCount("sess-1"))
	}
}

// TestManagerSubmitDuplicate 验证幂等：重复 ID 返回 Duplicated 且不重复入队。
func TestManagerSubmitDuplicate(t *testing.T) {
	m := NewInboxManager(10)
	if _, err := m.Submit(newTestInput("a", "sess-1", SemanticsQueue)); err != nil {
		t.Fatal(err)
	}
	res, err := m.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	if err != nil {
		t.Fatalf("duplicate submit should not error: %v", err)
	}
	if !res.Duplicated {
		t.Fatal("duplicate submit should set Duplicated=true")
	}
	if m.PendingCount("sess-1") != 1 {
		t.Fatalf("pending count after duplicate: got %d, want 1", m.PendingCount("sess-1"))
	}
}

// TestManagerSubmitValidation 验证非法输入被拒绝。
func TestManagerSubmitValidation(t *testing.T) {
	m := NewInboxManager(10)
	if _, err := m.Submit(nil); err != ErrNilInput {
		t.Fatalf("nil input: got %v, want ErrNilInput", err)
	}
	empty := newTestInput("a", "", SemanticsQueue)
	if _, err := m.Submit(empty); err != ErrEmptySessionID {
		t.Fatalf("empty session: got %v, want ErrEmptySessionID", err)
	}
}

// TestManagerMarkRunning 验证 MarkRunning / IsRunning 状态维护。
func TestManagerMarkRunning(t *testing.T) {
	m := NewInboxManager(10)
	if m.IsRunning("sess-1") {
		t.Fatal("should not be running initially")
	}
	m.MarkRunning("sess-1", true)
	if !m.IsRunning("sess-1") {
		t.Fatal("should be running after MarkRunning(true)")
	}
	// 运行中 Submit 的 ShouldWake=false。
	res, err := m.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	if err != nil {
		t.Fatal(err)
	}
	if res.ShouldWake {
		t.Fatal("running session: ShouldWake should be false")
	}
	m.MarkRunning("sess-1", false)
	if m.IsRunning("sess-1") {
		t.Fatal("should not be running after MarkRunning(false)")
	}
}

// TestManagerTake 验证 Take 语义与 turn 匹配。
func TestManagerTake(t *testing.T) {
	m := NewInboxManager(10)
	m.Submit(newTestInput("a", "sess-1", SemanticsQueue))

	// 会话不存在时返回 nil。
	got, err := m.Take("sess-missing", "")
	if err != nil || got != nil {
		t.Fatalf("take missing session: got=%v err=%v", got, err)
	}

	got, err = m.Take("sess-1", "")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || got.ID != "a" {
		t.Fatalf("take mismatch: got %v", got)
	}
	// 取出后待投递数归零。
	if m.PendingCount("sess-1") != 0 {
		t.Fatal("pending count should be 0 after take")
	}
}

// TestManagerTakeSteer 验证 steer 语义的 turn 匹配经 Manager 透传。
func TestManagerTakeSteer(t *testing.T) {
	m := NewInboxManager(10)
	steer := newTestInput("s1", "sess-1", SemanticsSteer)
	steer.ExpectedTurnID = "turn-5"
	m.Submit(steer)
	m.Submit(newTestInput("q1", "sess-1", SemanticsQueue))

	// 当前 turn-1：steer 不匹配，取出 q1。
	got, _ := m.Take("sess-1", "turn-1")
	if got == nil || got.ID != "q1" {
		t.Fatalf("turn mismatch should take queue first: got %v", got)
	}
	// turn-5 到达：取出 steer。
	got, _ = m.Take("sess-1", "turn-5")
	if got == nil || got.ID != "s1" {
		t.Fatalf("steer should be taken on matching turn: got %v", got)
	}
}

// TestManagerNextDue 验证 NextDue 返回有 pending 输入的会话。
func TestManagerNextDue(t *testing.T) {
	m := NewInboxManager(10)
	if due := m.NextDue(); due != "" {
		t.Fatalf("no pending: NextDue should be empty, got %q", due)
	}
	m.Submit(newTestInput("a", "sess-2", SemanticsQueue))
	if due := m.NextDue(); due != "sess-2" {
		t.Fatalf("NextDue: got %q, want sess-2", due)
	}
	// 全部取出后不再 due。
	m.Take("sess-2", "")
	if due := m.NextDue(); due != "" {
		t.Fatalf("after drain: NextDue should be empty, got %q", due)
	}
}

// TestManagerSessionIDs 验证会话枚举。
func TestManagerSessionIDs(t *testing.T) {
	m := NewInboxManager(10)
	m.Submit(newTestInput("a", "s1", SemanticsQueue))
	m.Submit(newTestInput("b", "s2", SemanticsQueue))
	ids := m.SessionIDs()
	if len(ids) != 2 {
		t.Fatalf("session ids: got %d, want 2", len(ids))
	}
}

// TestManagerCancel 验证取消排队项。
func TestManagerCancel(t *testing.T) {
	m := NewInboxManager(10)
	m.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	if err := m.Cancel("sess-1", "a"); err != nil {
		t.Fatalf("cancel failed: %v", err)
	}
	if err := m.Cancel("sess-1", "missing"); err != ErrInputNotFound {
		t.Fatalf("cancel missing: got %v, want ErrInputNotFound", err)
	}
	// 已取消的项不可取出。
	got, _ := m.Take("sess-1", "")
	if got != nil {
		t.Fatalf("cancelled item should not be taken: %v", got)
	}
}

// TestManagerMarkInjected 验证确认注入。
func TestManagerMarkInjected(t *testing.T) {
	m := NewInboxManager(10)
	m.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	m.Take("sess-1", "")
	if err := m.MarkInjected("sess-1", "a"); err != nil {
		t.Fatalf("mark injected: %v", err)
	}
	snaps := m.Snapshot("sess-1")
	if len(snaps) != 1 || snaps[0].State != StatusInjected {
		t.Fatalf("snapshot mismatch: %+v", snaps)
	}
}

// TestManagerSnapshot 验证快照与深拷贝。
func TestManagerSnapshot(t *testing.T) {
	m := NewInboxManager(10)
	m.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	snaps := m.Snapshot("sess-1")
	if len(snaps) != 1 || snaps[0].Input.ID != "a" {
		t.Fatalf("snapshot mismatch: %+v", snaps)
	}
	// 修改快照不影响内部。
	snaps[0].Input.Content = "mutated"
	got, _ := m.Take("sess-1", "")
	if got.Content != "content-a" {
		t.Fatalf("snapshot mutation leaked: %v", got)
	}
	// 会话不存在时返回空切片。
	if s := m.Snapshot("nope"); len(s) != 0 {
		t.Fatalf("missing session snapshot: %+v", s)
	}
}

// TestManagerRemoveSession 验证移除会话。
func TestManagerRemoveSession(t *testing.T) {
	m := NewInboxManager(10)
	m.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	m.MarkRunning("sess-1", true)
	m.RemoveSession("sess-1")
	if m.PendingCount("sess-1") != 0 {
		t.Fatal("pending count should be 0 after remove")
	}
	if m.IsRunning("sess-1") {
		t.Fatal("running flag should be cleared after remove")
	}
	// 移除后再次 Submit 会重建会话。
	m.Submit(newTestInput("b", "sess-1", SemanticsQueue))
	if m.PendingCount("sess-1") != 1 {
		t.Fatal("session should be recreated on submit")
	}
}

// TestManagerPrune 验证历史清理透传。
func TestManagerPrune(t *testing.T) {
	m := NewInboxManager(100)
	for i := 0; i < 10; i++ {
		id := string(rune('a' + i))
		m.Submit(newTestInput(id, "sess-1", SemanticsQueue))
		m.Take("sess-1", "")
		m.MarkInjected("sess-1", id)
	}
	dropped := m.Prune("sess-1", 3)
	if dropped != 7 {
		t.Fatalf("prune: got %d, want 7", dropped)
	}
	if m.Prune("nope", 3) != 0 {
		t.Fatal("prune missing session should return 0")
	}
}

// TestManagerClose 验证关闭后 Submit 拒绝、已入队可消费。
func TestManagerClose(t *testing.T) {
	m := NewInboxManager(10)
	m.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	m.Close()
	if _, err := m.Submit(newTestInput("b", "sess-1", SemanticsQueue)); err != errQueueClosed {
		t.Fatalf("submit after close: got %v, want errQueueClosed", err)
	}
	// 已入队仍可消费。
	got, _ := m.Take("sess-1", "")
	if got == nil || got.ID != "a" {
		t.Fatalf("take after close: got %v", got)
	}
}

// TestManagerOnChanged 验证队列变化回调触发。
func TestManagerOnChanged(t *testing.T) {
	m := NewInboxManager(10)
	var mu sync.Mutex
	var events []string
	m.SetOnChanged(func(sessionID string) {
		mu.Lock()
		events = append(events, sessionID)
		mu.Unlock()
	})

	m.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	m.Take("sess-1", "")
	m.MarkInjected("sess-1", "a")
	m.Cancel("sess-1", "missing") // 无效果，不触发

	mu.Lock()
	defer mu.Unlock()
	if len(events) < 3 {
		t.Fatalf("onChanged events: got %d, want >= 3 (%v)", len(events), events)
	}
	for _, e := range events {
		if e != "sess-1" {
			t.Fatalf("unexpected event session: %q", e)
		}
	}
}

// TestManagerSemanticsDefaultPriority 验证语义默认优先级。
func TestManagerSemanticsDefaultPriority(t *testing.T) {
	cases := []struct {
		semantics InputSemantics
		wantRing  Ring
	}{
		{SemanticsSteer, Ring0},
		{SemanticsInterrupt, Ring0},
		{SemanticsToolResult, Ring0},
		{SemanticsChannelInbound, Ring1},
		{SemanticsCrossAgent, Ring1},
		{SemanticsUserMessage, Ring2},
		{SemanticsQueue, Ring2},
		{SemanticsSystem, Ring3},
	}
	for _, c := range cases {
		in := &Input{Semantics: c.semantics}
		if got := in.EffectiveRing(); got != c.wantRing {
			t.Errorf("semantics %s: ring got %d, want %d", c.semantics, got, c.wantRing)
		}
	}
}

// TestInputExplicitPriorityNotShadowed 回归验证：显式设置 PriorityImmediate
// 不会被零值歧义误判为「未设置」（PriorityImmediate 必须为非零值）。
func TestInputExplicitPriorityNotShadowed(t *testing.T) {
	// 显式设置即时优先级，即使语义默认是普通优先级。
	in := &Input{
		Semantics: SemanticsQueue,
		Priority:  PriorityImmediate,
	}
	if got := in.EffectivePriority(); got != PriorityImmediate {
		t.Fatalf("explicit PriorityImmediate shadowed: got %d", got)
	}
	if got := in.EffectiveRing(); got != Ring0 {
		t.Fatalf("explicit PriorityImmediate ring: got %d, want Ring0", got)
	}

	// 未设置优先级时用语义默认。
	in2 := &Input{Semantics: SemanticsQueue}
	if got := in2.EffectivePriority(); got != PriorityNormal {
		t.Fatalf("unset priority should fall back to semantic default: got %d", got)
	}

	// 显式 PriorityUnset 等价于未设置。
	in3 := &Input{Semantics: SemanticsQueue, Priority: PriorityUnset}
	if got := in3.EffectivePriority(); got != PriorityNormal {
		t.Fatalf("PriorityUnset should fall back to semantic default: got %d", got)
	}
}

// TestManagerConcurrentMultiSession 验证多会话并发隔离与数据完整性。
func TestManagerConcurrentMultiSession(t *testing.T) {
	m := NewInboxManager(100)
	const sessions = 6
	const perSession = 50

	var wg sync.WaitGroup
	// 并发提交多个会话。
	for s := 0; s < sessions; s++ {
		wg.Add(1)
		go func(s int) {
			defer wg.Done()
			sid := string(rune('s' + s))
			for i := 0; i < perSession; i++ {
				id := sid + "-" + string(rune('a'+i))
				if _, err := m.Submit(newTestInput(id, sid, SemanticsQueue)); err != nil {
					t.Errorf("submit %s: %v", id, err)
					return
				}
			}
		}(s)
	}
	wg.Wait()

	// 校验每个会话计数。
	for s := 0; s < sessions; s++ {
		sid := string(rune('s' + s))
		if m.PendingCount(sid) != perSession {
			t.Fatalf("session %s pending: got %d, want %d", sid, m.PendingCount(sid), perSession)
		}
	}

	// 并发消费所有会话。
	var consumeWg sync.WaitGroup
	total := 0
	var totalMu sync.Mutex
	for s := 0; s < sessions; s++ {
		consumeWg.Add(1)
		go func(s int) {
			defer consumeWg.Done()
			sid := string(rune('s' + s))
			for {
				got, err := m.Take(sid, "")
				if err != nil {
					t.Errorf("take %s: %v", sid, err)
					return
				}
				if got == nil {
					return
				}
				totalMu.Lock()
				total++
				totalMu.Unlock()
			}
		}(s)
	}
	consumeWg.Wait()

	totalMu.Lock()
	defer totalMu.Unlock()
	if total != sessions*perSession {
		t.Fatalf("total consumed: got %d, want %d", total, sessions*perSession)
	}
}

// TestManagerConcurrentSameSession 验证同一会话高并发 Submit 不丢数据。
func TestManagerConcurrentSameSession(t *testing.T) {
	m := NewInboxManager(500)
	const goroutines = 8
	const perGoroutine = 50

	var wg sync.WaitGroup
	for g := 0; g < goroutines; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			for i := 0; i < perGoroutine; i++ {
				id := string(rune('a'+g)) + "-" + string(rune('a'+i))
				if _, err := m.Submit(newTestInput(id, "sess-1", SemanticsQueue)); err != nil {
					t.Errorf("submit: %v", err)
					return
				}
			}
		}(g)
	}
	wg.Wait()

	if got := m.PendingCount("sess-1"); got != goroutines*perGoroutine {
		t.Fatalf("pending: got %d, want %d", got, goroutines*perGoroutine)
	}
}

// TestManagerOnChangedNotBlocking 验证回调不阻塞主流程（回调内不得重入本包）。
func TestManagerOnChangedNotBlocking(t *testing.T) {
	m := NewInboxManager(10)
	m.SetOnChanged(func(sessionID string) {
		// 回调中仅记录，不调用本包方法（文档约定）。
		_ = sessionID
	})
	done := make(chan struct{})
	go func() {
		for i := 0; i < 100; i++ {
			m.Submit(newTestInput(string(rune('a'+i%26)), "sess-1", SemanticsQueue))
		}
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("submit loop blocked by onChanged callback")
	}
}

// TestManagerWaitNextUnknownSession 验证会话不存在时 WaitNext 返回 nil channel
// （select 中永不触发，须由调用方配合 ctx.Done() 兜底退出）。
func TestManagerWaitNextUnknownSession(t *testing.T) {
	m := NewInboxManager(10)
	if sig := m.WaitNext("sess-missing"); sig != nil {
		t.Fatalf("unknown session should return nil channel, got %v", sig)
	}
}

// TestManagerWaitNextBlocksWhenIdle 验证无消息时 WaitNext 阻塞（闲时挂起）。
// 这是「零 CPU 挂起」的语义基础：阻塞在 channel 上的 goroutine 由 runtime 挂起。
func TestManagerWaitNextBlocksWhenIdle(t *testing.T) {
	m := NewInboxManager(10)
	// 先注册会话（Submit 自动创建 inbox），使 WaitNext 返回真实信号 channel。
	m.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	sig := m.WaitNext("sess-1")
	// 消费掉入队时遗留的信号，恢复空闲状态。
	select {
	case <-sig:
	default:
	}
	// 空闲时不应在超时内返回。
	select {
	case <-sig:
		t.Fatal("wait next returned while idle")
	case <-time.After(50 * time.Millisecond):
	}
}

// TestManagerWaitNextWakesOnSubmit 验证 Submit 入队后 WaitNext 被唤醒。
func TestManagerWaitNextWakesOnSubmit(t *testing.T) {
	m := NewInboxManager(10)
	m.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	// 消费入队信号，回到空闲。
	sig := m.WaitNext("sess-1")
	select {
	case <-sig:
	default:
	}
	woken := make(chan struct{})
	go func() {
		<-sig
		close(woken)
	}()
	m.Submit(newTestInput("b", "sess-1", SemanticsQueue))
	select {
	case <-woken:
	case <-time.After(1 * time.Second):
		t.Fatal("wait next not woken by submit")
	}
}

// TestManagerWaitNextMergedSignal 验证合并唤醒：多次 Submit 只产生一个待消费信号
// （信号 channel 容量 1，未消费时后续入队不堆积信号）。
func TestManagerWaitNextMergedSignal(t *testing.T) {
	m := NewInboxManager(10)
	m.Submit(newTestInput("a", "sess-1", SemanticsQueue))
	sig := m.WaitNext("sess-1")
	// 连续多次 Submit：第一条产生信号，后续合并（不堆积）。
	m.Submit(newTestInput("b", "sess-1", SemanticsQueue))
	m.Submit(newTestInput("c", "sess-1", SemanticsQueue))
	// 只能消费到一个信号。
	select {
	case <-sig:
	default:
		t.Fatal("expected one merged signal")
	}
	// 没有第二个信号可消费。
	select {
	case <-sig:
		t.Fatal("merged signal should be consumed exactly once")
	default:
	}
	// 队列中 3 条消息都 pending，唤醒后应循环 Take 取空。
	if m.PendingCount("sess-1") != 3 {
		t.Fatalf("pending count: got %d, want 3", m.PendingCount("sess-1"))
	}
}

// TestManagerWaitNextConcurrent 验证并发 Submit / WaitNext 无竞态（-race 兜底）
// 且不丢唤醒：每批 Submit 后等待者都能及时醒来并取空。
func TestManagerWaitNextConcurrent(t *testing.T) {
	// 此测试验证唤醒而非背压；容量应覆盖所有并发生产项，避免调度速度影响断言。
	m := NewInboxManager(1000)
	m.Submit(newTestInput("init", "sess-1", SemanticsQueue))
	sig := m.WaitNext("sess-1")
	select {
	case <-sig:
	default:
	}
	// 取走 init 消息，使队列回到空状态（后续只统计批量入队的消息）。
	if got, err := m.Take("sess-1", ""); err != nil || got == nil {
		t.Fatalf("init item should be taken: got=%v err=%v", got, err)
	}

	const batches = 10
	const perBatch = 20
	var wg sync.WaitGroup
	// 消费者：循环等待唤醒并取空。
	consumed := make(chan int, batches)
	wg.Add(1)
	go func() {
		defer wg.Done()
		total := 0
		for total < batches*perBatch {
			select {
			case <-sig:
			case <-time.After(5 * time.Second):
				t.Error("consumer starved: no wake within timeout")
				return
			}
			for {
				got, err := m.Take("sess-1", "")
				if err != nil || got == nil {
					break
				}
				total++
			}
		}
		consumed <- total
	}()

	// 生产者：分批发入队。
	for b := 0; b < batches; b++ {
		wg.Add(1)
		go func(b int) {
			defer wg.Done()
			for i := 0; i < perBatch; i++ {
				id := string(rune('a'+b%26)) + fmt.Sprintf("-%d", i)
				if _, err := m.Submit(newTestInput(id, "sess-1", SemanticsQueue)); err != nil {
					t.Errorf("submit: %v", err)
					return
				}
			}
		}(b)
	}
	wg.Wait()

	select {
	case total := <-consumed:
		if total != batches*perBatch {
			t.Fatalf("consumed: got %d, want %d", total, batches*perBatch)
		}
	case <-time.After(6 * time.Second):
		t.Fatal("consumer did not finish within timeout")
	}
}

// TestManagerGetOrCreateInboxCreatesAndReuses 验证 GetOrCreateInbox：
// 不存在时创建并注册；已存在时复用同一实例（不覆盖，区别于 RegisterInbox）。
func TestManagerGetOrCreateInboxCreatesAndReuses(t *testing.T) {
	m := NewInboxManager(10)
	in1 := m.GetOrCreateInbox("sess-1")
	if in1 == nil {
		t.Fatal("GetOrCreateInbox should create an inbox")
	}
	in2 := m.GetOrCreateInbox("sess-1")
	if in1 != in2 {
		t.Fatal("GetOrCreateInbox should reuse the existing inbox")
	}
}

// TestManagerGetOrCreateInboxPreservesItems 验证复用时不丢弃已有条目
// （执行器空闲回收后重建的核心保证：竞态窗口内入队的消息不被覆盖丢失）。
func TestManagerGetOrCreateInboxPreservesItems(t *testing.T) {
	m := NewInboxManager(10)
	in1 := m.GetOrCreateInbox("sess-1")
	if _, err := in1.Submit(newTestInput("keep", "sess-1", SemanticsUserMessage)); err != nil {
		t.Fatalf("submit failed: %v", err)
	}
	// 复用已有 inbox：条目保留。
	in2 := m.GetOrCreateInbox("sess-1")
	if in1 != in2 {
		t.Fatal("GetOrCreateInbox should reuse the existing inbox")
	}
	if in2.PendingCount() != 1 {
		t.Fatalf("pending count after reuse: got %d, want 1", in2.PendingCount())
	}
	// RegisterInbox 会覆盖（对比语义：无条件替换），而 GetOrCreateInbox 不会。
	m.RegisterInbox(NewSessionInboxWithSettings("sess-1", m.Settings()))
	if m.PendingCount("sess-1") != 0 {
		t.Fatal("RegisterInbox should replace the inbox (contrast semantics)")
	}
}
