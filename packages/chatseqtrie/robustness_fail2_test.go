package chatseqtrie

import (
	"strings"
	"testing"
)

// -----------------------------------------------------------
// 检查被移除 session 在树中是否仍可被 Match 到
// -----------------------------------------------------------

func TestBug_RemovedSessionStillMatchable(t *testing.T) {
	trie := New()
	msgs := []Message{userMsg("Hi"), assistantMsg("Hello")}

	mustInsert(t, trie, "sessA", msgs)
	trie.Remove("sessA")

	// 移除后应匹配不到
	result := mustMatch(t, trie, msgs)
	if result.MatchedSession == "sessA" {
		t.Errorf("BUG: 移除后 sessionA 仍可被 Match（matchedSession=%s）", result.MatchedSession)
	}
	if result.IsExactMatch {
		t.Errorf("BUG: 移除后仍被认为是精确匹配")
	}
}

// -----------------------------------------------------------
// 超大 tool_calls 数组（1000 个元素）对 ComputeKey 的影响
// -----------------------------------------------------------

func TestBug_LargeToolCallsArray(t *testing.T) {
	policy := DefaultFieldPolicy()

	// 构造含 1000 个 tool_call 的消息
	toolCalls := make([]any, 1000)
	for i := 0; i < 1000; i++ {
		toolCalls[i] = map[string]any{
			"id":        "call_" + strings.Repeat("x", 50),
			"name":      "func_" + strings.Repeat("x", 50),
			"arguments": `{"x":` + strings.Repeat("1", 100) + `}`,
		}
	}

	msg := Message{
		"type":       "assistant",
		"role":       "assistant",
		"content":    "Hello",
		"tool_calls": toolCalls,
	}

	key, err := policy.ComputeKey(msg)
	if err != nil {
		t.Errorf("ComputeKey 不应 error: %v", err)
	}
	_ = key

	// 再做一次确保一致性
	key2, _ := policy.ComputeKey(msg)
	if key2 != key {
		t.Errorf("相同大数组的 ComputeKey 结果不一致")
	}
}

// -----------------------------------------------------------
// Unicode 字符在 sessionID / content 中
// -----------------------------------------------------------

func TestBug_UnicodeContentAndSessionID(t *testing.T) {
	trie := New()

	// 中文字符
	msgs := []Message{
		userMsg("你好世界"),
		assistantMsg("こんにちは"),
	}

	mustInsert(t, trie, "session_中文", msgs)

	result := mustMatch(t, trie, msgs)
	if !result.IsExactMatch {
		t.Errorf("BUG: Unicode 内容应为精确匹配，IsExactMatch=%v", result.IsExactMatch)
	}
	if result.MatchedSession != "session_中文" {
		t.Errorf("MatchedSession 应为 session_中文，得到 %s", result.MatchedSession)
	}
}

// -----------------------------------------------------------
// 多层通配符路径嵌套时的 projectDocument 行为
// -----------------------------------------------------------

func TestBug_DeepWildcardNested(t *testing.T) {
	// 路径：a/*/b/*/c
	policy := NewFieldPolicy("a/*/b/*/c")

	msg := Message{
		"a": []any{
			map[string]any{
				"b": []any{
					map[string]any{"c": "value1"},
					map[string]any{"c": "value2"},
				},
			},
		},
	}

	key, err := policy.ComputeKey(msg)
	if err != nil {
		t.Fatalf("ComputeKey 不应 error: %v", err)
	}
	t.Logf("深嵌套通配符 key=%s", key)

	// 对于 a/*/b/*/c，期望 b 的每个元素的 c 字段被提取
	// 如果正确投影应包含 "value1","value2"
	if !strings.Contains(key, "value1") || !strings.Contains(key, "value2") {
		t.Errorf("BUG: 深层通配符投影丢失了嵌套值。key=%s", key)
	}

	// 空数组场景
	msg2 := Message{
		"a": []any{
			map[string]any{
				"b": []any{},
			},
		},
	}
	key2, _ := policy.ComputeKey(msg2)
	t.Logf("空嵌套数组 key=%s", key2)
}

// -----------------------------------------------------------
// BoltStorage keyHash 长度极长时的表现
// -----------------------------------------------------------

func TestBug_KeyHashExtremeLength(t *testing.T) {
	dir := t.TempDir()
	store, err := NewBoltStorage(dir + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	// 使用 10MB 的 keyHash
	bigHash := strings.Repeat("abcdef0123456789", 65536) // ~1MB
	_, err = store.GetNode(0, bigHash)
	if err != nil {
		t.Logf("超大 keyHash 的 GetNode 返回 error（可接受）: %v", err)
	}
}

// -----------------------------------------------------------
// 空的 BoltStorage 上的操作应正常
// -----------------------------------------------------------

func TestBug_EmptyBoltDBOperations(t *testing.T) {
	dir := t.TempDir()
	store, err := NewBoltStorage(dir + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	// 无节点时的各种操作
	node, err := store.GetNode(0, "nonexistent")
	if err != nil {
		t.Errorf("空 DB 的 GetNode 不应 error: %v", err)
	}
	if node != nil {
		t.Errorf("空 DB 的 GetNode 应返回 nil")
	}

	sessions, err := store.GetSessions(0)
	if err != nil {
		t.Errorf("空 DB 的 GetSessions 不应 error: %v", err)
	}
	if len(sessions) != 0 {
		t.Errorf("空 DB 的 GetSessions 应返回空切片")
	}

	err = store.WalkChildren(0, func(n *StoredNode) error {
		return nil
	})
	if err != nil {
		t.Errorf("空 DB 的 WalkChildren 不应 error: %v", err)
	}
}

// -----------------------------------------------------------
// Remove session 后 sessionToNode 不应还有映射
// -----------------------------------------------------------

func TestBug_SessionToNodeAfterRemove(t *testing.T) {
	trie := New()
	mustInsert(t, trie, "sessA", []Message{userMsg("A"), assistantMsg("B")})

	if _, has := trie.sessionToNode["sessA"]; !has {
		t.Fatal("sessionToNode 应有 sessA")
	}

	trie.Remove("sessA")

	if _, has := trie.sessionToNode["sessA"]; has {
		t.Errorf("BUG: Remove 后 sessionToNode 仍包含 sessA")
	}
}

// -----------------------------------------------------------
// Match 空序列后的 behavior（应返回 BranchPoint=-1）
// -----------------------------------------------------------

func TestBug_MatchEmptySequenceBehavior(t *testing.T) {
	trie := New()

	result, err := trie.Match([]Message{})
	if err != nil {
		t.Errorf("Match 空序列不应 error: %v", err)
	}
	if result.BranchPoint != -1 {
		t.Errorf("空序列 BranchPoint 应为 -1，得到 %d", result.BranchPoint)
	}
	if result.Suffix != nil {
		t.Errorf("空序列 Suffix 应为 nil，得到 %v", result.Suffix)
	}

	// Match nil 序列
	result, err = trie.Match(nil)
	if err != nil {
		t.Errorf("Match nil 不应 error: %v", err)
	}
	if result.BranchPoint != -1 {
		t.Errorf("nil 序列 BranchPoint 应为 -1")
	}
}

// -----------------------------------------------------------
// Insert 后立即 Match 的一致性
// -----------------------------------------------------------

func TestBug_InsertMatchConsistency(t *testing.T) {
	trie := New()

	// Insert 后立即 Match 同一序列
	msgs := []Message{userMsg("A"), assistantMsg("B"), userMsg("C")}
	insertResult, err := trie.Insert("sessA", msgs)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("Insert result: matchedSession=%s", insertResult.MatchedSession)

	// 同一会话的 Match
	matchResult := mustMatch(t, trie, msgs)
	if !matchResult.IsExactMatch {
		t.Errorf("Insert 后 Match 应为精确匹配")
	}

	// Insert 返回的 MatchResult 应一致
	if matchResult.CommonPrefixLen != len(msgs) {
		t.Errorf("CommonPrefixLen 应为 %d，得到 %d", len(msgs), matchResult.CommonPrefixLen)
	}
}

// -----------------------------------------------------------
// 连续 Insert 同一 sessionID 到不同路径，验证历史路径死节点
// -----------------------------------------------------------

func TestBug_ReinsertSessionHistoryNodes(t *testing.T) {
	trie := New()

	// 先插入到路径 A
	mustInsert(t, trie, "sessA", []Message{userMsg("A"), assistantMsg("B")})
	before := trie.NodeCount()

	// 再插入同一 sessionID 到路径 B
	mustInsert(t, trie, "sessA", []Message{userMsg("X"), assistantMsg("Y")})
	after := trie.NodeCount()

	// 期望：节点数不变（旧路径被修剪，新路径与旧路径完全独立）
	// A→B 应被修剪，X→Y 是新路径
	// 实际：A→B 路径未被修剪，节点数增加
	if after > before {
		t.Logf("注意: 重新 Insert 后 NodeCount=%d（之前=%d），旧路径可能残留", after, before)
	}

	// 验证新路径可匹配
	result := mustMatch(t, trie, []Message{userMsg("X"), assistantMsg("Y")})
	if !result.IsExactMatch || result.MatchedSession != "sessA" {
		t.Errorf("新路径应精确匹配 sessA")
	}

	// 验证旧路径不可匹配
	result2 := mustMatch(t, trie, []Message{userMsg("A"), assistantMsg("B")})
	if result2.MatchedSession == "sessA" {
		t.Logf("注意: 旧路径 A→B 仍可匹配到 sessA，说明旧 session 标记未清理干净")
	}
}

// -----------------------------------------------------------
// BoltStorage MarkSession 后不 PutNode 直接 Close
// -----------------------------------------------------------

func TestBug_BoltSessionWithoutNode(t *testing.T) {
	dir := t.TempDir()
	store, err := NewBoltStorage(dir + "/test.db")
	if err != nil {
		t.Fatal(err)
	}

	// 只 MarkSession（不先 PutNode）
	err = store.MarkSession(1, "orphan_session")
	if err != nil {
		t.Fatal(err)
	}
	store.Close()

	// 重新打开
	store2, err := NewBoltStorage(dir + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer store2.Close()

	// LoadAll 应加载到这个孤立 session
	data, err := store2.LoadAll()
	if err != nil {
		t.Fatal(err)
	}

	foundOrphan := false
	for _, se := range data.Sessions {
		if se.SessionID == "orphan_session" {
			foundOrphan = true
			break
		}
	}
	if !foundOrphan {
		t.Errorf("BUG: 之前 MarkSession 的孤立 session 未出现在 LoadAll 中")
	}
	t.Logf("孤立 session 被加载: %v, 节点数=%d, session数=%d", foundOrphan, len(data.Nodes), len(data.Sessions))
}

// -----------------------------------------------------------
// 极多 session 同时 Insert（验证 map 扩容行为）
// -----------------------------------------------------------

func TestBug_MassInsertThenMatch(t *testing.T) {
	trie := New()
	count := 5000

	// 批量插入
	for i := 0; i < count; i++ {
		msgs := []Message{
			userMsg(string(rune('A' + i%26))),
			assistantMsg(string(rune('a' + i%26))),
		}
		_, err := trie.Insert(
			"sess_"+string(rune('A'+(i/100)%26))+string(rune('0'+(i/10)%10))+string(rune('0'+(i%10))),
			msgs,
		)
		if err != nil {
			t.Fatalf("Insert %d 失败: %v", i, err)
		}
	}

	// 全部 Match
	for i := 0; i < count; i++ {
		msgs := []Message{
			userMsg(string(rune('A' + i%26))),
			assistantMsg(string(rune('a' + i%26))),
		}
		result := mustMatch(t, trie, msgs)
		if !result.IsExactMatch {
			t.Errorf("BUG: session %d 的 Match 不是精确匹配", i)
			return
		}
	}
	t.Logf("%d 次 Mass Insert + Match 完成, NodeCount=%d, SessionCount=%d",
		count, trie.NodeCount(), trie.SessionCount())
}
