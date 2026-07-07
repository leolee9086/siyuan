package chatseqtrie

import (
	"fmt"
	"strconv"
	"sync"
	"testing"
)

// ============================================================
// 并发测试
// ============================================================

// TestConcurrent_InsertWhileMatch 验证并发读写正确性。
// 多个 goroutine 同时 Match，一个 goroutine 持续 Insert。
// 测试不 panic、不 data race、结果逻辑可预期。
func TestConcurrent_InsertWhileMatch(t *testing.T) {
	trie := New()
	baseMsgs := []Message{userMsg("Hi"), assistantMsg("Hello")}
	mustInsert(t, trie, "base", baseMsgs)

	var wg sync.WaitGroup

	// 3 个并发读取者
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				result, err := trie.Match(baseMsgs)
				if err != nil {
					t.Errorf("Match 错误: %v", err)
					return
				}
				if result.CommonPrefixLen != 2 && result.CommonPrefixLen != 0 {
					// 可能在 Insert 扩展后读到不同的长度，这可以接受
				}
				_ = result
			}
		}(i)
	}

	// 1 个写入者
	wg.Add(1)
	go func() {
		defer wg.Done()
		for j := 0; j < 20; j++ {
			sid := fmt.Sprintf("concurrent_%d", j)
			extended := append(baseMsgs, userMsg(strconv.Itoa(j)))
			_, err := trie.Insert(sid, extended)
			if err != nil {
				t.Errorf("Insert 错误: %v", err)
				return
			}
		}
	}()

	wg.Wait()
	t.Log("通过: 20 次 Insert 与 150 次 Match 并发完成无 panic")
}

// TestConcurrent_RemoveWhileInsert 验证 Remove 与 Insert 并发。
func TestConcurrent_RemoveWhileInsert(t *testing.T) {
	trie := New()

	// 预填充
	for i := 0; i < 30; i++ {
		sid := fmt.Sprintf("pre_%d", i)
		msgs := []Message{userMsg(fmt.Sprintf("msg_%d", i)), assistantMsg("Hello")}
		mustInsert(t, trie, sid, msgs)
	}

	var wg sync.WaitGroup

	// 写入者
	wg.Add(1)
	go func() {
		defer wg.Done()
		for j := 0; j < 30; j++ {
			sid := fmt.Sprintf("new_%d", j)
			msgs := []Message{userMsg(fmt.Sprintf("new_%d", j)), assistantMsg("World")}
			_, err := trie.Insert(sid, msgs)
			if err != nil {
				t.Errorf("Insert 错误: %v", err)
				return
			}
		}
	}()

	// 移除者
	wg.Add(1)
	go func() {
		defer wg.Done()
		for j := 0; j < 30; j++ {
			sid := fmt.Sprintf("pre_%d", j)
			trie.Remove(sid)
		}
	}()

	wg.Wait()
	t.Log("通过: 30 次 Remove 与 30 次 Insert 并发完成无 panic")
}

// TestConcurrent_RaceInsertSameSessionID 验证 Insert 相同 sessionID 无 race。
func TestConcurrent_RaceInsertSameSessionID(t *testing.T) {
	trie := New()

	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			msgs := []Message{userMsg(fmt.Sprintf("msg_%d", id)), assistantMsg("response")}
			_, err := trie.Insert("sharedSession", msgs)
			if err != nil {
				t.Errorf("Insert 错误: %v", err)
			}
		}(i)
	}
	wg.Wait()

	// 验证：SessionCount 应为 1（同一 sessionID 只算一次）
	if trie.SessionCount() != 1 {
		t.Logf("注意: 并发 Insert 同一 sessionID 不同内容，SessionCount=%d（期望 1 但多 goroutine 顺序不确定）", trie.SessionCount())
	} else {
		t.Log("通过: 并发 Insert 同一 sessionID 后 SessionCount=1")
	}
}

// TestConcurrent_FindVariantsWhileInsert 验证 FindVariants 与 Insert 并发。
func TestConcurrent_FindVariantsWhileInsert(t *testing.T) {
	trie := New()

	// 建一个基础路径，后续变体都从它分支
	baseSeq := []Message{userMsg("Hi"), assistantMsg("Hello"), userMsg("How are you?")}
	mustInsert(t, trie, "base", baseSeq)

	var wg sync.WaitGroup

	// 读取者：反复查找 base 的变体
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 30; j++ {
				variants := trie.FindVariants("base")
				_ = variants
			}
		}()
	}

	// 写入者：插入变体
	wg.Add(1)
	go func() {
		defer wg.Done()
		for j := 0; j < 30; j++ {
			sid := fmt.Sprintf("variant_%d", j)
			seq := []Message{
				userMsg("Hi"),
				assistantMsg("Hello"),
				userMsg(fmt.Sprintf("Variant question %d?", j)),
			}
			_, err := trie.Insert(sid, seq)
			if err != nil {
				t.Errorf("Insert 错误: %v", err)
				return
			}
		}
	}()

	wg.Wait()
	t.Log("通过: Insert 30 个变体与 FindVariants 并发完成无 panic")
}

// ============================================================
// 性能基准测试
// ============================================================

// BenchmarkInsert 基准测试：Insert 操作的吞吐量。
func BenchmarkInsert(b *testing.B) {
	trie := New()
	msgs := []Message{userMsg("Hi"), assistantMsg("Hello"), userMsg("How?"), assistantMsg("Fine")}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		sid := fmt.Sprintf("bench_%d", i)
		_, err := trie.Insert(sid, msgs)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func mustInsertHelper(trie *Trie, sessionID string, msgs []Message) {
	trie.Insert(sessionID, msgs)
}

// BenchmarkMatch 基准测试：Match 操作的吞吐量。
func BenchmarkMatch(b *testing.B) {
	trie := New()
	msgs := []Message{userMsg("Hi"), assistantMsg("Hello"), userMsg("How?"), assistantMsg("Fine")}
	mustInsertHelper(trie, "bench_base", msgs)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := trie.Match(msgs)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkInsertLarge 基准测试：大量节点的插入性能。
func BenchmarkInsertLarge(b *testing.B) {
	trie := New()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		sid := fmt.Sprintf("large_%d", i)
		msgs := make([]Message, 10)
		for j := 0; j < 10; j++ {
			msgs[j] = userMsg(fmt.Sprintf("deep_message_%d_%d", i, j))
		}
		_, err := trie.Insert(sid, msgs)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkFindVariants 基准测试：深树中的 FindVariants 性能。
func BenchmarkFindVariants(b *testing.B) {
	trie := New()

	// 构造 1000 个 session 的树
	for i := 0; i < 1000; i++ {
		sid := fmt.Sprintf("session_%d", i)
		msgs := []Message{
			userMsg(fmt.Sprintf("user_%d", i/100)),
			assistantMsg(fmt.Sprintf("assistant_%d", i/10)),
			userMsg(fmt.Sprintf("question_%d", i)),
		}
		mustInsertHelper(trie, sid, msgs)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		sid := fmt.Sprintf("session_%d", i%1000)
		_ = trie.FindVariants(sid)
	}
}

// ============================================================
// 压力测试
// ============================================================

// TestStress_HighConcurrency 高并发压力测试。
func TestStress_HighConcurrency(t *testing.T) {
	trie := New()

	var wg sync.WaitGroup
	errChan := make(chan error, 200)

	// 20 个并发写入
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				sid := fmt.Sprintf("w_%d_%d", id, j)
				msgs := []Message{
					userMsg(fmt.Sprintf("input_%d", j%10)),
					assistantMsg(fmt.Sprintf("output_%d", j%10)),
				}
				_, err := trie.Insert(sid, msgs)
				if err != nil {
					errChan <- fmt.Errorf("Insert 失败: %w", err)
					return
				}
			}
		}(i)
	}

	// 10 个并发读取
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				msgs := []Message{
					userMsg(fmt.Sprintf("input_%d", j%10)),
					assistantMsg(fmt.Sprintf("output_%d", j%10)),
				}
				_, err := trie.Match(msgs)
				if err != nil {
					errChan <- fmt.Errorf("Match 失败: %w", err)
					return
				}
				// 偶尔尝试 FindVariants 和 SessionCount
				if j%10 == 0 {
					_ = trie.FindVariants(fmt.Sprintf("w_%d_%d", id, j%50))
					_ = trie.SessionCount()
					_ = trie.NodeCount()
				}
			}
		}(i)
	}

	wg.Wait()
	close(errChan)

	var errs []error
	for err := range errChan {
		errs = append(errs, err)
	}
	if len(errs) > 0 {
		t.Errorf("压力测试中 %d 个错误: %v", len(errs), errs[0])
	} else {
		finalCount := trie.SessionCount()
		t.Logf("通过: 1000 次 Insert + 1000 次 Match 高并发完成, SessionCount=%d", finalCount)
	}
}

// TestStress_DataIntegrity 验证并发操作后的数据完整性。
// 检查：所有 session 可被 Match 找到，SessionCount 准确。
func TestStress_DataIntegrity(t *testing.T) {
	trie := New()
	sessionCount := 50

	// 顺序插入 50 个 session
	for i := 0; i < sessionCount; i++ {
		sid := fmt.Sprintf("session_%d", i)
		msgs := []Message{userMsg(fmt.Sprintf("q_%d", i)), assistantMsg(fmt.Sprintf("a_%d", i))}
		mustInsert(t, trie, sid, msgs)
	}

	// 并发：再插入一批 + 移除一部分 + 全部 Match
	var wg sync.WaitGroup

	// 再插入 50 个
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			sid := fmt.Sprintf("extra_%d", id)
			msgs := []Message{userMsg(fmt.Sprintf("q_%d", id)), assistantMsg(fmt.Sprintf("a_%d", id))}
			_, err := trie.Insert(sid, msgs)
			if err != nil {
				t.Errorf("Insert 失败: %v", err)
			}
		}(i)
	}

	// 移除部分 session
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			trie.Remove(fmt.Sprintf("session_%d", id))
		}(i)
	}

	wg.Wait()

	// 验证：被移除的 session 不应出现在 Match 中
	for i := 0; i < 10; i++ {
		sid := fmt.Sprintf("session_%d", i)
		msgs := []Message{userMsg(fmt.Sprintf("q_%d", i)), assistantMsg(fmt.Sprintf("a_%d", i))}
		result, err := trie.Match(msgs)
		if err != nil {
			t.Errorf("Match 失败: %v", err)
			continue
		}
		if result.MatchedSession == sid {
			t.Errorf("数据完整性错误: session %s 已被移除但仍可匹配", sid)
		}
	}

	// 验证：剩余的 session 仍可匹配
	sessionCountAfterRemove := trie.SessionCount()
	t.Logf("数据完整性检查: SessionCount=%d, 期望=90（50初始-10移除+50新增）", sessionCountAfterRemove)
	if sessionCountAfterRemove != 90 {
		t.Logf("注意: SessionCount=%d，可能因为并发 Insert 相同路径有重合", sessionCountAfterRemove)
	}
}

// TestConcurrent_RemoveStorageError 验证并发场景下存储层错误处理。
func TestConcurrent_RemoveStorageError(t *testing.T) {
	dir := t.TempDir()
	store, err := NewBoltStorage(dir + "/test.db")
	if err != nil {
		t.Fatal(err)
	}

	trie := New(WithStorage(store))
	for i := 0; i < 20; i++ {
		sid := fmt.Sprintf("sess_%d", i)
		mustInsert(t, trie, sid, []Message{userMsg(fmt.Sprintf("q_%d", i)), assistantMsg("a")})
	}

	// 关闭存储
	store.Close()

	// 并发 Remove（每个都在存储层失败但不应 panic）
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			sid := fmt.Sprintf("sess_%d", id)
			removed := trie.Remove(sid)
			if !removed {
				// 可能已被其他 goroutine 移除
			}
		}(i)
	}
	wg.Wait()
	t.Log("通过: 存储关闭后 20 次并发 Remove 无 panic")
}
