package chatseqtrie

import (
	"fmt"
	"sync"
	"testing"
)

// -----------------------------------------------------------
// BUG: LoadFromStorage 后 Match 已存储的 session 失败
//
// TestRobust_LoadThenInsertMatch 暴露：
//   持久化 sessionA → 关闭 → 重开 LoadFromStorage → Insert sessionB
//   → Match sessionA 的序列时 MatchedSession=""（找不到）
//
// 说明 LoadFromStorage 重建后的树在后续操作中可能丢失
// 已存储的路径匹配能力。
// -----------------------------------------------------------

func TestBug_LoadThenMatchOldSession(t *testing.T) {
	dir := t.TempDir()
	store, err := NewBoltStorage(dir + "/test.db")
	if err != nil {
		t.Fatal(err)
	}

	trie := New(WithStorage(store))
	mustInsert(t, trie, "sessA", []Message{userMsg("Hi"), assistantMsg("Hello")})

	// 保存前验证
	result := mustMatch(t, trie, []Message{userMsg("Hi"), assistantMsg("Hello")})
	if result.MatchedSession != "sessA" {
		t.Fatalf("保存前 Match 失败: MatchedSession=%s", result.MatchedSession)
	}

	store.Close()

	// 重建
	store2, err := NewBoltStorage(dir + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer store2.Close()

	trie2 := New(WithStorage(store2))
	if err := trie2.LoadFromStorage(); err != nil {
		t.Fatal(err)
	}

	// 仅 Match，不 Insert
	result2 := mustMatch(t, trie2, []Message{userMsg("Hi"), assistantMsg("Hello")})
	if result2.MatchedSession != "sessA" {
		t.Errorf("BUG: LoadFromStorage 后 Match sessionA 失败。"+
			"  MatchedSession=%q, CommonPrefixLen=%d, MatchedLen=%d",
			result2.MatchedSession, result2.CommonPrefixLen, result2.MatchedLen)
	}

	// Insert 新 session 后再 Match 旧的
	mustInsert(t, trie2, "sessB", []Message{userMsg("Hello"), assistantMsg("World")})
	result3 := mustMatch(t, trie2, []Message{userMsg("Hi"), assistantMsg("Hello")})
	if result3.MatchedSession != "sessA" {
		t.Errorf("BUG: Insert 新 session 后 Match 旧 sessionA 失败。"+
			"  MatchedSession=%q, CommonPrefixLen=%d",
			result3.MatchedSession, result3.CommonPrefixLen)
	}
}

// -----------------------------------------------------------
// BUG: FindVariants 在深树中 O(N²) 时间（性能鲁棒性）
//
// 1000 个链式 session 的 FindVariants 耗时 4+ 秒。
// 原因：findPath 使用 DFS 且每次递归都复制路径
//   targetPath = append([]*trieNode{child}, targetPath...)
//   每次 append 创建新切片 = O(N)，总复杂度 O(N²)
// -----------------------------------------------------------

func TestBug_FindVariantsDeepChainPerformance(t *testing.T) {
	trie := New()

	// 构造 1000 条链式 session，每条比上一条多一个节点
	// 形成 1000 层深的右倾树
	for i := 0; i < 1000; i++ {
		msgs := make([]Message, i+1)
		for j := 0; j <= i; j++ {
			content := string(rune('A' + j%26))
			if j%2 == 0 {
				msgs[j] = userMsg(content)
			} else {
				msgs[j] = assistantMsg(content)
			}
		}
		sid := "sess_" + string(rune('A'+i%26)) + string(rune('0'+(i%10)))
		mustInsert(t, trie, sid, msgs)
	}

	// 查找 root 级的 session 变体（最差情况：遍历全树）
	// 期望：远小于 4 秒
	variants := trie.FindVariants("sess_A0")
	t.Logf("1000 个链式 session 的 FindVariants: %d 个变体", len(variants))

	// 查找最深层 session 的变体
	variants2 := trie.FindVariants("sess_J9")
	t.Logf("深层 session 的 FindVariants: %d 个变体", len(variants2))
}

// -----------------------------------------------------------
// BUG: 并发 Insert 同一节点导致 children map 并发写
//
// 尽管 Insert 有写锁保护，但非持锁的操作路径可能存在问题。
// 这个测试专门验证高并发下同一路径的插入安全性：
//   20 个 goroutine 同时 Insert 同一 sessionID 到同一路径
// -----------------------------------------------------------

func TestBug_ConcurrentInsertSameKeyRace(t *testing.T) {
	trie := New()
	msgs := []Message{userMsg("A"), assistantMsg("B")}

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			sid := "sess_" + string(rune('A'+id%26)) + string(rune('0'+(id%10)))
			_, err := trie.Insert(sid, msgs)
			if err != nil {
				t.Errorf("Insert 失败: %v", err)
			}
		}(i)
	}
	wg.Wait()

	// 验证：所有 session 都应能匹配
	result := mustMatch(t, trie, msgs)
	if result.MatchedSession == "" {
		t.Errorf("BUG: 并发 Insert 后 Match 无结果")
	}
	if result.CommonPrefixLen != 2 {
		t.Errorf("CommonPrefixLen 应为 2，得到 %d", result.CommonPrefixLen)
	}
	t.Logf("20 个并发 Insert 后 SessionCount=%d, NodeCount=%d", trie.SessionCount(), trie.NodeCount())
}

// -----------------------------------------------------------
// 测试零长度消息（空的 Message map）的耐受性
// -----------------------------------------------------------

func TestBug_EmptyMessageMap(t *testing.T) {
	trie := New()

	// 空的 Message（不带任何字段）
	emptyMsg := Message{}

	_, err := trie.Insert("sessA", []Message{emptyMsg})
	if err != nil {
		t.Fatalf("Insert 空消息不应 error: %v", err)
	}

	//	另一个空消息应能匹配
	result := mustMatch(t, trie, []Message{Message{}})
	if !result.IsExactMatch {
		t.Errorf("BUG: 空消息不应精确匹配自身，IsExactMatch=%v", result.IsExactMatch)
	}
}

// -----------------------------------------------------------
// 验证 SessionCount 在大规模操作后的正确性
// -----------------------------------------------------------

func TestBug_SessionCountAccuracyAfterManyOps(t *testing.T) {
	trie := New()

	// 插入 100 个 session，全部不同
	for i := 0; i < 100; i++ {
		sid := fmt.Sprintf("sess_%03d", i)
		msgs := []Message{
			userMsg(fmt.Sprintf("q_%d", i)),
			assistantMsg(fmt.Sprintf("a_%d", i)),
		}
		mustInsert(t, trie, sid, msgs)
	}

	if trie.SessionCount() != 100 {
		t.Fatalf("插入 100 个 session 后 SessionCount=%d（期望 100）", trie.SessionCount())
	}

	// 移除 50 个（每两个移除一个）
	for i := 0; i < 100; i += 2 {
		sid := fmt.Sprintf("sess_%03d", i)
		trie.Remove(sid)
	}

	count := trie.SessionCount()
	if count != 50 {
		t.Errorf("BUG: 移除 50 个后 SessionCount=%d（期望 50）", count)
	}
	t.Logf("100 插入 → 50 移除后 SessionCount=%d", count)

	// 验证剩余的每个都可被 Match
	for i := 1; i < 100; i += 2 {
		sid := fmt.Sprintf("sess_%03d", i)
		msgs := []Message{
			userMsg(fmt.Sprintf("q_%d", i)),
			assistantMsg(fmt.Sprintf("a_%d", i)),
		}
		result := mustMatch(t, trie, msgs)
		if result.MatchedSession != sid {
			t.Errorf("session %s 不可被 Match（matchedSession=%s）", sid, result.MatchedSession)
		}
	}
}

// -----------------------------------------------------------
// 超大 key 导致的内存问题
// -----------------------------------------------------------

func TestBug_ExtremelyLongContentKey(t *testing.T) {
	trie := New()

	// content 为 100KB 字符串
	buf := make([]byte, 100*1024)
	for i := range buf {
		buf[i] = 'x'
	}
	longContent := string(buf)

	msgs := []Message{
		userMsg("A"),
		assistantMsg(longContent),
	}

	_, err := trie.Insert("sessA", msgs)
	if err != nil {
		t.Errorf("Insert 100KB content 不应 error: %v", err)
	}

	result := mustMatch(t, trie, msgs)
	if !result.IsExactMatch {
		t.Errorf("100KB content 的 Match 应精确匹配, IsExactMatch=%v", result.IsExactMatch)
	}

	t.Logf("100KB content session 的 NodeCount=%d", trie.NodeCount())
}

// -----------------------------------------------------------
// Remove 不存在的 session（幂等性测试）
// -----------------------------------------------------------

func TestBug_RemoveNonExistentSession(t *testing.T) {
	trie := New()

	mustInsert(t, trie, "sessA", []Message{userMsg("A"), assistantMsg("B")})

	// 第一次移除
	removed1 := trie.Remove("sessA")
	if !removed1 {
		t.Errorf("第一次 Remove 应返回 true")
	}

	// 第二次移除（已不存在）
	removed2 := trie.Remove("sessA")
	if removed2 {
		t.Errorf("BUG: 第二次 Remove 已移除的 session 应返回 false，但返回了 true。" +
			"说明 Remove 在 sessionToNode 未命中时全树遍历找到残余标记")
	}

	// 验证 SessionCount
	if trie.SessionCount() != 0 {
		t.Errorf("Remove 后 SessionCount=%d（期望 0）", trie.SessionCount())
	}
}
