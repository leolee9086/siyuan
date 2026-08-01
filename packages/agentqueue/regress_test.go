package agentqueue

import (
	"sync"
	"testing"
	"time"
)

// 本文件集中存放复核修复后的回归测试：
//  1. Submit / Take 不写调用方对象、返回深拷贝（并发安全边界）；
//  2. 语义注册表开闭原则（RegisterSemantics 新增语义无需修改既有代码）；
//  3. RingQueue Close 与 Push 的原子性（无 TOCTOU 窗口）。

// TestSubmitDoesNotMutateCallerInput 回归验证：Submit 不得修改调用方传入的
// Input 对象（Priority / CreatedAt 补齐应在内部克隆上完成）。
func TestSubmitDoesNotMutateCallerInput(t *testing.T) {
	m := NewInboxManager(10)
	input := &Input{
		ID:        "immutable",
		SessionID: "sess-1",
		Semantics: SemanticsQueue,
		// 故意留 Priority / CreatedAt 为零值，验证补齐不写回调用方对象。
	}

	if _, err := m.Submit(input); err != nil {
		t.Fatalf("submit failed: %v", err)
	}
	if input.Priority != PriorityUnset {
		t.Fatalf("caller input mutated: Priority=%d, want PriorityUnset", input.Priority)
	}
	if input.CreatedAt != 0 {
		t.Fatalf("caller input mutated: CreatedAt=%d, want 0", input.CreatedAt)
	}

	// 入队后的内部副本应已补齐默认值（经 Take 返回的副本验证）。
	taken, err := m.Take("sess-1", "")
	if err != nil {
		t.Fatal(err)
	}
	if taken == nil {
		t.Fatal("take returned nil")
	}
	if taken.CreatedAt == 0 {
		t.Fatal("internal copy should have CreatedAt filled")
	}
	if taken.EffectivePriority() == PriorityUnset {
		t.Fatal("internal copy should have effective priority")
	}
}

// TestSubmitDoesNotMutateCallerInputDirect 回归验证：直接调用 SessionInbox.Submit
// 同样不得修改调用方对象。
func TestSubmitDoesNotMutateCallerInputDirect(t *testing.T) {
	in := NewSessionInbox("sess-1", 10)
	input := &Input{
		ID:        "immutable-direct",
		SessionID: "sess-1",
		Semantics: SemanticsQueue,
	}
	if _, err := in.Submit(input); err != nil {
		t.Fatalf("submit failed: %v", err)
	}
	if input.CreatedAt != 0 {
		t.Fatalf("caller input mutated: CreatedAt=%d, want 0", input.CreatedAt)
	}
}

// TestTakeReturnsCopy 回归验证：Take 返回深拷贝，调用方修改返回对象
// 不影响队列内部状态。
func TestTakeReturnsCopy(t *testing.T) {
	in := NewSessionInbox("sess-1", 10)
	_, err := in.Submit(&Input{
		ID:        "copy",
		SessionID: "sess-1",
		Semantics: SemanticsQueue,
		Content:   "original",
		Metadata: map[string]any{
			"nested": map[string]any{"k": "v"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	taken, err := in.Take("")
	if err != nil {
		t.Fatal(err)
	}
	if taken == nil {
		t.Fatal("take returned nil")
	}
	// 修改返回对象。
	taken.Content = "mutated"
	taken.Metadata["nested"].(map[string]any)["k"] = "mutated"
	if err := in.MarkInjected("copy"); err != nil {
		t.Fatalf("mark injected failed: %v", err)
	}

	// 快照中的内部数据不应被调用方修改污染。
	snaps := in.Snapshot()
	if len(snaps) != 1 {
		t.Fatalf("snapshot len: got %d, want 1", len(snaps))
	}
	if snaps[0].Input.Content != "original" {
		t.Fatalf("internal content mutated: %q", snaps[0].Input.Content)
	}
	nested, ok := snaps[0].Input.Metadata["nested"].(map[string]any)
	if !ok || nested["k"] != "v" {
		t.Fatalf("internal metadata mutated: %+v", snaps[0].Input.Metadata)
	}
}

// TestRegisterSemanticsOpenClosed 回归验证开闭原则：注册新语义后，
// DefaultPriority / IsImmediate 无需修改既有代码即可生效。
func TestRegisterSemanticsOpenClosed(t *testing.T) {
	const customSemantics InputSemantics = "custom_rumination"
	defer func() {
		semanticsMetaMu.Lock()
		delete(semanticsMeta, customSemantics)
		semanticsMetaMu.Unlock()
	}()

	// 注册前：未注册语义按普通消息处理。
	if got := customSemantics.DefaultPriority(); got != PriorityNormal {
		t.Fatalf("unregistered default: got %d, want PriorityNormal", got)
	}
	if customSemantics.IsImmediate() {
		t.Fatal("unregistered should not be immediate")
	}

	// 注册后：特性立即生效，无需修改 DefaultPriority / IsImmediate 本体。
	RegisterSemantics(customSemantics, SemanticsMeta{
		DefaultPriority: PriorityImmediate,
		Immediate:       true,
	})
	if got := customSemantics.DefaultPriority(); got != PriorityImmediate {
		t.Fatalf("registered default: got %d, want PriorityImmediate", got)
	}
	if !customSemantics.IsImmediate() {
		t.Fatal("registered should be immediate")
	}

	// 新语义可正常入队并按即时语义调度。
	m := NewInboxManager(10)
	if _, err := m.Submit(&Input{
		ID:        "custom",
		SessionID: "sess-1",
		Semantics: customSemantics,
	}); err != nil {
		t.Fatalf("submit custom semantics failed: %v", err)
	}
	taken, err := m.Take("sess-1", "turn-1")
	if err != nil {
		t.Fatal(err)
	}
	if taken == nil || taken.Semantics != customSemantics {
		t.Fatalf("custom semantics not taken: %v", taken)
	}
}

// TestRingQueueClosePushAtomic 回归验证：Close 与 Push 并发时无 TOCTOU 窗口。
// 规则：Close 完成后 Push 必然失败；Push 成功后数据必然可被消费。
func TestRingQueueClosePushAtomic(t *testing.T) {
	q := NewRingQueue[int](64)
	var wg sync.WaitGroup

	// 并发 Close 与 Push。
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			time.Sleep(time.Microsecond) // 让 Close 与 Push 交错
			q.Close()
		}()
	}
	pushed := make([]bool, 1000)
	var pushedMu sync.Mutex
	for i := 0; i < 1000; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			time.Sleep(time.Microsecond)
			if q.Push(Ring2, i) {
				pushedMu.Lock()
				pushed[i] = true
				pushedMu.Unlock()
			}
		}(i)
	}
	wg.Wait()

	// 消费所有成功入队的任务。
	consumed := make([]bool, 1000)
	for {
		v, ok := q.PopNonBlocking()
		if !ok {
			break
		}
		if v >= 0 && v < 1000 {
			consumed[v] = true
		}
	}

	pushedMu.Lock()
	defer pushedMu.Unlock()
	for i := 0; i < 1000; i++ {
		if pushed[i] != consumed[i] {
			t.Fatalf("value %d: pushed=%v consumed=%v", i, pushed[i], consumed[i])
		}
	}
}
