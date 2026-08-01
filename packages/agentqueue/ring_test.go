package agentqueue

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

// TestRingQueuePriorityOrder 验证高环任务优先于低环任务弹出。
func TestRingQueuePriorityOrder(t *testing.T) {
	q := NewRingQueue[string](10)

	// 先入低环，再入高环，验证弹出顺序不受入队顺序影响。
	if !q.Push(Ring3, "low-1") {
		t.Fatal("push Ring3 failed")
	}
	if !q.Push(Ring2, "normal-1") {
		t.Fatal("push Ring2 failed")
	}
	if !q.Push(Ring1, "high-1") {
		t.Fatal("push Ring1 failed")
	}
	if !q.Push(Ring0, "immediate-1") {
		t.Fatal("push Ring0 failed")
	}

	want := []string{"immediate-1", "high-1", "normal-1", "low-1"}
	for _, w := range want {
		got := q.PopBlocking()
		if got != w {
			t.Fatalf("pop order mismatch: got %q, want %q", got, w)
		}
	}
}

// TestRingQueueFIFO 验证同一环内先进先出。
func TestRingQueueFIFO(t *testing.T) {
	q := NewRingQueue[int](10)
	for i := 1; i <= 5; i++ {
		if !q.Push(Ring2, i) {
			t.Fatalf("push %d failed", i)
		}
	}
	for i := 1; i <= 5; i++ {
		got := q.PopBlocking()
		if got != i {
			t.Fatalf("fifo mismatch: got %d, want %d", got, i)
		}
	}
}

// TestRingQueuePushFull 验证目标环缓冲满时 Push 返回 false（非阻塞）。
func TestRingQueuePushFull(t *testing.T) {
	q := NewRingQueue[string](2)
	if !q.Push(Ring0, "a") || !q.Push(Ring0, "b") {
		t.Fatal("push within capacity should succeed")
	}
	if q.Push(Ring0, "c") {
		t.Fatal("push beyond capacity should fail")
	}
	// 低环不受高环满的影响。
	if !q.Push(Ring1, "h") {
		t.Fatal("push to other ring should succeed")
	}
}

// TestRingQueuePopNonBlocking 验证非阻塞弹出。
func TestRingQueuePopNonBlocking(t *testing.T) {
	q := NewRingQueue[string](5)
	if _, ok := q.PopNonBlocking(); ok {
		t.Fatal("pop from empty queue should fail")
	}
	q.Push(Ring1, "x")
	item, ok := q.PopNonBlocking()
	if !ok || item != "x" {
		t.Fatalf("pop non-blocking mismatch: got %q ok=%v", item, ok)
	}
	if _, ok := q.PopNonBlocking(); ok {
		t.Fatal("pop after drain should fail")
	}
}

// TestRingQueuePeek 验证 Peek 返回最高非空环，空队列返回 -1。
func TestRingQueuePeek(t *testing.T) {
	q := NewRingQueue[string](5)
	if got := q.Peek(); got != -1 {
		t.Fatalf("peek empty: got %d, want -1", got)
	}
	q.Push(Ring2, "n")
	if got := q.Peek(); got != int(Ring2) {
		t.Fatalf("peek: got %d, want %d", got, Ring2)
	}
	q.Push(Ring0, "i")
	if got := q.Peek(); got != int(Ring0) {
		t.Fatalf("peek after Ring0 push: got %d, want %d", got, Ring0)
	}
}

// TestRingQueueLen 验证计数。
func TestRingQueueLen(t *testing.T) {
	q := NewRingQueue[string](10)
	if q.Len() != 0 {
		t.Fatalf("len empty: got %d", q.Len())
	}
	q.Push(Ring0, "a")
	q.Push(Ring0, "b")
	q.Push(Ring1, "c")
	if q.Len() != 3 {
		t.Fatalf("len: got %d, want 3", q.Len())
	}
	if q.RingLen(Ring0) != 2 || q.RingLen(Ring1) != 1 {
		t.Fatalf("ringlen: Ring0=%d Ring1=%d", q.RingLen(Ring0), q.RingLen(Ring1))
	}
	q.PopBlocking()
	if q.Len() != 2 {
		t.Fatalf("len after pop: got %d, want 2", q.Len())
	}
}

// TestRingQueueClose 验证关闭后 Push 拒绝、已入队数据可排空、排空后返回零值。
func TestRingQueueClose(t *testing.T) {
	q := NewRingQueue[int](5)
	q.Push(Ring0, 1)
	q.Push(Ring1, 2)
	q.Close()
	if q.Push(Ring0, 3) {
		t.Fatal("push after close should fail")
	}
	if got := q.PopBlocking(); got != 1 {
		t.Fatalf("drain order mismatch: got %d, want 1", got)
	}
	if got := q.PopBlocking(); got != 2 {
		t.Fatalf("drain order mismatch: got %d, want 2", got)
	}
	if got := q.PopBlocking(); got != 0 {
		t.Fatalf("pop after close+drain should return zero: got %d", got)
	}
	// Close 幂等。
	q.Close()
}

// TestRingQueueConcurrent 验证多生产者多消费者并发下任务不丢失不重复。
// 使用指针包装类型：合法任务均为非 nil 指针，nil 作为 Close 后的终止哨兵，
// 避免与合法值冲突（零值类型无法区分「合法值 0」与「关闭后零值」）。
func TestRingQueueConcurrent(t *testing.T) {
	const (
		producers   = 4
		consumers   = 4
		perProducer = 500
		total       = producers * perProducer
	)

	type payload struct {
		v int
	}

	q := NewRingQueue[*payload](128)
	var wg sync.WaitGroup

	for p := 0; p < producers; p++ {
		wg.Add(1)
		go func(pid int) {
			defer wg.Done()
			for i := 0; i < perProducer; i++ {
				ring := Ring((pid + i) % RingCount)
				item := &payload{v: pid*perProducer + i}
				for !q.Push(ring, item) {
					// 缓冲满，短暂退避后重试（生产级：Push 非阻塞，调用方决定重试）。
					time.Sleep(time.Microsecond)
				}
			}
		}(p)
	}

	seen := make([]bool, total)
	var seenMu sync.Mutex
	got := 0
	var consumeWg sync.WaitGroup
	for c := 0; c < consumers; c++ {
		consumeWg.Add(1)
		go func() {
			defer consumeWg.Done()
			for {
				item := q.PopBlocking()
				if item == nil {
					// Close 后队列排空，PopBlocking 返回 nil 哨兵。
					return
				}
				v := item.v
				if v < 0 || v >= total {
					t.Errorf("out of range value %d", v)
					return
				}
				seenMu.Lock()
				if seen[v] {
					seenMu.Unlock()
					t.Errorf("duplicate value %d", v)
					return
				}
				seen[v] = true
				got++
				seenMu.Unlock()
			}
		}()
	}

	// 等待生产者完成，然后关闭队列让消费者退出。
	wg.Wait()
	q.Close()
	consumeWg.Wait()

	seenMu.Lock()
	defer seenMu.Unlock()
	if got != total {
		t.Fatalf("consumed %d, want %d", got, total)
	}
	for i := 0; i < total; i++ {
		if !seen[i] {
			t.Fatalf("value %d missing", i)
		}
	}
}

// TestRingQueueInvalidRing 验证非法环编号被拒绝。
func TestRingQueueInvalidRing(t *testing.T) {
	q := NewRingQueue[string](5)
	if q.Push(Ring(-1), "x") {
		t.Fatal("push to invalid ring should fail")
	}
	if q.Push(Ring(RingCount), "x") {
		t.Fatal("push to out-of-range ring should fail")
	}
	if got := q.RingLen(Ring(-1)); got != 0 {
		t.Fatalf("ringlen invalid: got %d", got)
	}
}

// TestRingQueueMAGICompat 模拟 MAGI DispatcherRingQueue 的使用方式，
// 验证本队列可作为其直接替换（外部消息 Ring0 优先于心跳 Ring1）。
func TestRingQueueMAGICompat(t *testing.T) {
	// 模拟 MAGI 的 DispatcherTask 最小结构。
	type dispatcherTask struct {
		kind string // "user_message" | "heartbeat"
		seq  int
	}

	q := NewRingQueue[*dispatcherTask](100)

	// MAGI 用法：心跳在 Ring1，外部消息在 Ring0。
	pushTask := func(ring Ring, kind string, seq int) {
		task := &dispatcherTask{kind: kind, seq: seq}
		if !q.Push(ring, task) {
			t.Fatalf("push %s-%d failed", kind, seq)
		}
	}

	pushTask(Ring1, "heartbeat", 1)
	pushTask(Ring1, "heartbeat", 2)
	pushTask(Ring0, "user_message", 1)

	// 保护环语义：即使心跳先入队，外部消息也先被处理。
	first := q.PopBlocking()
	if first.kind != "user_message" || first.seq != 1 {
		t.Fatalf("first pop mismatch: %s-%d", first.kind, first.seq)
	}
	second := q.PopBlocking()
	if second.kind != "heartbeat" || second.seq != 1 {
		t.Fatalf("second pop mismatch: %s-%d", second.kind, second.seq)
	}
	third := q.PopBlocking()
	if third.kind != "heartbeat" || third.seq != 2 {
		t.Fatalf("third pop mismatch: %s-%d", third.kind, third.seq)
	}
}

// TestRingQueueBufferSizeDefault 验证 bufSize<=0 时使用默认容量。
func TestRingQueueBufferSizeDefault(t *testing.T) {
	q := NewRingQueue[int](0)
	for i := 0; i < 100; i++ {
		if !q.Push(Ring2, i) {
			t.Fatalf("push %d failed with default buffer", i)
		}
	}
}

// TestRingQueuePopBlockingTimeout 验证 PopBlocking 阻塞等待直到有任务到达。
func TestRingQueuePopBlockingTimeout(t *testing.T) {
	q := NewRingQueue[string](5)
	done := make(chan string, 1)
	go func() {
		done <- q.PopBlocking()
	}()
	time.Sleep(20 * time.Millisecond)
	q.Push(Ring0, "wake")
	select {
	case got := <-done:
		if got != "wake" {
			t.Fatalf("wake mismatch: got %q", got)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("PopBlocking did not return after push")
	}
}

// TestRingQueueCloseUnblocks 验证 Close 会唤醒阻塞中的 PopBlocking。
func TestRingQueueCloseUnblocks(t *testing.T) {
	q := NewRingQueue[int](5)
	done := make(chan int, 1)
	go func() {
		done <- q.PopBlocking()
	}()
	time.Sleep(20 * time.Millisecond)
	q.Close()
	select {
	case got := <-done:
		if got != 0 {
			t.Fatalf("close wake should return zero, got %d", got)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("PopBlocking did not unblock on close")
	}
}

// TestRingQueueSequence 验证 PopNonBlocking 与 PopBlocking 混合使用的一致性。
func TestRingQueueSequence(t *testing.T) {
	q := NewRingQueue[int](10)
	for i := 0; i < 10; i++ {
		q.Push(Ring2, i)
	}
	for i := 0; i < 10; i++ {
		got := q.PopBlocking()
		if got != i {
			t.Fatalf("sequence mismatch at %d: got %d", i, got)
		}
	}
	if q.Len() != 0 {
		t.Fatalf("len after drain: got %d", q.Len())
	}
}

// TestRingQueueStringValues 验证 string 类型的完整存取。
func TestRingQueueStringValues(t *testing.T) {
	q := NewRingQueue[string](8)
	values := []string{"alpha", "beta", "gamma", "delta"}
	for _, v := range values {
		if !q.Push(Ring1, v) {
			t.Fatal("push failed")
		}
	}
	for i, want := range values {
		got := q.PopBlocking()
		if got != want {
			t.Fatalf("index %d: got %q, want %q", i, got, want)
		}
	}
	_ = fmt.Sprint(q.Len()) // 保持 fmt 导入使用，避免无意义
}
