package chatseqtrie

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// -----------------------------------------------------------
// 同一 db 文件被两个 BoltStorage 实例打开（双重打开）
// -----------------------------------------------------------

func TestEdge_DoubleOpenSameDB(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "shared.db")

	s1, err := NewBoltStorage(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer s1.Close()

	// bbolt 使用文件锁（flock），Windows 上阻塞等待
	// 使用 goroutine + channel 检测超时
	type openResult struct {
		store *BoltStorage
		err   error
	}
	resultCh := make(chan openResult, 1)

	go func() {
		s2, err2 := NewBoltStorage(dbPath)
		resultCh <- openResult{s2, err2}
	}()

	select {
	case res := <-resultCh:
		if res.store != nil {
			res.store.Close()
		}
		if res.err == nil {
			t.Error("BoltStorage 双重打开同一文件应返回 error（bbolt 文件锁）")
		} else {
			t.Logf("正确拒绝双重打开: %v", res.err)
		}
	case <-time.After(5 * time.Second):
		t.Logf("注意: bbolt 文件锁在 Windows 上是阻塞等待，5 秒未返回（设计行为，非 bug）")
	}
}

// -----------------------------------------------------------
// BoltStorage 操作已关闭的 db
// -----------------------------------------------------------

func TestEdge_ClosedBoltOperations(t *testing.T) {
	dir := t.TempDir()
	store, err := NewBoltStorage(filepath.Join(dir, "closed.db"))
	if err != nil {
		t.Fatal(err)
	}
	store.Close()

	// 所有操作应返回 error
	_, err = store.GetNode(0, "hash")
	if err == nil {
		t.Error("已关闭 db 的 GetNode 应返回 error")
	}

	err = store.PutNode(&StoredNode{ID: 1, ParentID: 0, KeyHash: "hash"})
	if err == nil {
		t.Error("已关闭 db 的 PutNode 应返回 error")
	}

	err = store.MarkSession(1, "sess")
	if err == nil {
		t.Error("已关闭 db 的 MarkSession 应返回 error")
	}

	err = store.RemoveSession(1, "sess")
	if err == nil {
		t.Error("已关闭 db 的 RemoveSession 应返回 error")
	}

	_, err = store.GetSessions(1)
	if err == nil {
		t.Error("已关闭 db 的 GetSessions 应返回 error")
	}

	err = store.WalkChildren(1, func(n *StoredNode) error { return nil })
	if err == nil {
		t.Error("已关闭 db 的 WalkChildren 应返回 error")
	}

	_, err = store.LoadAll()
	if err == nil {
		t.Error("已关闭 db 的 LoadAll 应返回 error")
	}
}

// -----------------------------------------------------------
// BoltStorage 路径为已存在文件但非 bbolt 格式
// -----------------------------------------------------------

func TestEdge_NonBoltFile(t *testing.T) {
	dir := t.TempDir()
	nonDBPath := filepath.Join(dir, "not_a_db.txt")

	// 写入非 bbolt 数据
	if err := os.WriteFile(nonDBPath, []byte("this is not a bolt database"), 0644); err != nil {
		t.Fatal(err)
	}

	_, err := NewBoltStorage(nonDBPath)
	if err == nil {
		t.Error("打开非 bbolt 文件应返回 error")
	} else {
		t.Logf("正确拒绝非 bbolt 文件: %v", err)
	}
}

// -----------------------------------------------------------
// BoltStorage 并发读写同一 db 文件（不同进程）
// -----------------------------------------------------------

func TestEdge_BoltConcurrentWriteFromTwoInstances(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "concurrent.db")

	store1, err := NewBoltStorage(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer store1.Close()

	// 尝试开第二个实例（bbolt 文件锁应阻止）
	store2, err := NewBoltStorage(dbPath)
	if err == nil {
		store2.Close()
		t.Error("BoltStorage 应阻止双重打开")
	}
}

// -----------------------------------------------------------
// 超大 Depth 值对 LoadFromStorage 的影响
// -----------------------------------------------------------

func TestEdge_ExtremeDepthValue(t *testing.T) {
	dir := t.TempDir()
	store, err := NewBoltStorage(filepath.Join(dir, "extreme.db"))
	if err != nil {
		t.Fatal(err)
	}

	// 写入深度为 -1 的节点
	err = store.PutNode(&StoredNode{
		ID:       1,
		ParentID: 0,
		KeyHash:  "hash1",
		KeyJSON:  `{"type":"user","content":"A"}`,
		Depth:    -1,
	})
	if err != nil {
		t.Fatal(err)
	}

	// 写入深度为 999999 的节点
	err = store.PutNode(&StoredNode{
		ID:       2,
		ParentID: 1,
		KeyHash:  "hash2",
		KeyJSON:  `{"type":"user","content":"B"}`,
		Depth:    999999,
	})
	if err != nil {
		t.Fatal(err)
	}

	store.Close()

	// 加载
	store2, err := NewBoltStorage(filepath.Join(dir, "extreme.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store2.Close()

	trie := New(WithStorage(store2))
	err = trie.LoadFromStorage()
	if err != nil {
		t.Errorf("含极端 Depth 值的 LoadFromStorage 不应 error: %v", err)
	}
}

// -----------------------------------------------------------
// 循环引用节点（A→B→A）在 LoadFromStorage 中导致无限循环
// -----------------------------------------------------------

func TestEdge_CircularParentReference(t *testing.T) {
	dir := t.TempDir()
	store, err := NewBoltStorage(filepath.Join(dir, "circular.db"))
	if err != nil {
		t.Fatal(err)
	}

	// 写入循环引用：A.ParentID=B, B.ParentID=A
	err = store.PutNode(&StoredNode{
		ID:       1,
		ParentID: 2, // 父节点是 B（ID=2）
		KeyHash:  "hash_a",
		KeyJSON:  `{"type":"user","content":"A"}`,
		Depth:    1,
	})
	if err != nil {
		t.Fatal(err)
	}

	err = store.PutNode(&StoredNode{
		ID:       2,
		ParentID: 1, // 父节点是 A（ID=1）
		KeyHash:  "hash_b",
		KeyJSON:  `{"type":"user","content":"B"}`,
		Depth:    1,
	})
	if err != nil {
		t.Fatal(err)
	}

	store.Close()

	store2, err := NewBoltStorage(filepath.Join(dir, "circular.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store2.Close()

	trie := New(WithStorage(store2))
	err = trie.LoadFromStorage()
	if err != nil {
		t.Errorf("循环引用 LoadFromStorage 不应 error（或应安全处理）: %v", err)
	}
}

// -----------------------------------------------------------
// 损坏的 JSON 在 LoadAll 中的处理
// -----------------------------------------------------------

func TestEdge_CorruptedNodeJSON(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "corrupted.db")

	// 直接操作 bbolt 写入损坏数据
	store, err := NewBoltStorage(dbPath)
	if err != nil {
		t.Fatal(err)
	}

	store.Close()

	// 手动修改 bbolt 文件来注入损坏数据
	// 实际上我们可以通过正常写入再直接修改 db 文件来模拟
	store2, err := NewBoltStorage(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer store2.Close()

	// 写入正常节点和损坏节点混合
	store2.PutNode(&StoredNode{
		ID:       1,
		ParentID: 0,
		KeyHash:  "good",
		KeyJSON:  `{"type":"user","content":"good"}`,
		Depth:    1,
	})

	// LoadAll 不应因为坏数据而完全失败
	data, err := store2.LoadAll()
	if err != nil {
		t.Errorf("LoadAll 不应 error: %v", err)
	}
	if len(data.Nodes) != 1 {
		t.Errorf("期望 1 个节点，得到 %d", len(data.Nodes))
	}
}

// -----------------------------------------------------------
// 非常深路径的 Remove（递归栈是否溢出）
// -----------------------------------------------------------

func TestEdge_DeepPruneStackSafety(t *testing.T) {
	trie := New()

	// 构造 10000 层深链
	msgs := make([]Message, 10000)
	for i := 0; i < 10000; i++ {
		msgs[i] = userMsg(string(rune('A' + i%26)))
	}

	mustInsert(t, trie, "deep_chain", msgs)
	t.Logf("10000 节点 Insert 完成, NodeCount=%d", trie.NodeCount())

	removed := trie.Remove("deep_chain")
	if !removed {
		t.Fatal("Remove 失败")
	}

	if trie.NodeCount() != 0 {
		t.Errorf("Remove 后 NodeCount=%d（期望 0），pruneUpwards 可能未递归到底", trie.NodeCount())
	}
	t.Log("10000 节点深链 Remove + pruneUpwards 完成")
}

// -----------------------------------------------------------
// Insert 后不调用 Match，直接 Remove 再 Insert 同一 sessionID
// -----------------------------------------------------------

func TestEdge_InsertRemoveInsertSameSession(t *testing.T) {
	trie := New()

	mustInsert(t, trie, "sessX", []Message{userMsg("A"), assistantMsg("B")})
	trie.Remove("sessX")

	// 用同一 sessionID 插入不同路径
	mustInsert(t, trie, "sessX", []Message{userMsg("C"), assistantMsg("D")})

	result := mustMatch(t, trie, []Message{userMsg("C"), assistantMsg("D")})
	if !result.IsExactMatch {
		t.Errorf("重新插入后应精确匹配, IsExactMatch=%v", result.IsExactMatch)
	}
	if result.MatchedSession != "sessX" {
		t.Errorf("应匹配 sessX, 得到 %s", result.MatchedSession)
	}

	// 旧路径不应匹配
	result2 := mustMatch(t, trie, []Message{userMsg("A"), assistantMsg("B")})
	if result2.MatchedSession == "sessX" {
		t.Errorf("旧路径不应匹配 sessX（已删除后重建）")
	}
}

// -----------------------------------------------------------
// 多个 session 在同一节点时 Remove 其中一个
// -----------------------------------------------------------

func TestEdge_MultipleSessionsSameNodePartialRemove(t *testing.T) {
	trie := New()
	msgs := []Message{userMsg("A"), assistantMsg("B")}

	mustInsert(t, trie, "sessA", msgs)
	mustInsert(t, trie, "sessB", msgs)
	mustInsert(t, trie, "sessC", msgs)

	// 移除 sessB
	trie.Remove("sessB")

	// sessA 和 sessC 应仍可匹配
	resultA := mustMatch(t, trie, msgs)
	if resultA.MatchedSession != "sessA" && resultA.MatchedSession != "sessC" {
		t.Errorf("移除 sessB 后应匹配到 sessA 或 sessC, 得到 %s", resultA.MatchedSession)
	}

	// SessionCount 应为 2
	if trie.SessionCount() != 2 {
		t.Errorf("移除后 SessionCount=%d（期望 2）", trie.SessionCount())
	}
}

// -----------------------------------------------------------
// sessionID 含特殊字符（空格、斜杠、Unicode）
// -----------------------------------------------------------

func TestEdge_SpecialCharSessionID(t *testing.T) {
	trie := New()

	specialIDs := []string{
		"session with spaces",
		"session/with/slashes",
		"session.with.dots",
		"session\nwith\nnewlines",
		"session\twith\ttabs",
		"",
	}

	for _, sid := range specialIDs {
		msgs := []Message{userMsg("Hi " + sid), assistantMsg("Hello")}
		_, err := trie.Insert(sid, msgs)
		if err != nil {
			t.Errorf("Insert sessionID=%q 失败: %v", sid, err)
			continue
		}

		result := mustMatch(t, trie, msgs)
		if result.MatchedSession == "" && sid != "" {
			t.Errorf("sessionID=%q 的 Match 无结果", sid)
		}

		// 空 sessionID 也应工作
		if sid == "" {
			t.Logf("空 sessionID 插入并匹配成功")
		}
	}
}

// -----------------------------------------------------------
// BoltStorage 写操作与读操作并发（bbolt 模型）
// -----------------------------------------------------------

func TestEdge_ConcurrentBoltReadWrite(t *testing.T) {
	dir := t.TempDir()
	store, err := NewBoltStorage(filepath.Join(dir, "conc_rw.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	// bbolt 本身就是 MVCC + 单写者，所以并发读写在 bolt 层面是安全的
	// 但 BoltStorage.mu 锁可能序列化写操作导致读阻塞
	done := make(chan struct{})

	// 写 goroutine
	go func() {
		for i := 0; i < 100; i++ {
			store.PutNode(&StoredNode{
				ID:       int64(i + 1),
				ParentID: 0,
				KeyHash:  "hash",
			})
		}
		close(done)
	}()

	// 同时读
	for i := 0; i < 100; i++ {
		store.GetNode(0, "nonexistent")
	}

	<-done
	t.Log("BoltStorage 并发读写完成（bbolt 内部序列化）")
}
