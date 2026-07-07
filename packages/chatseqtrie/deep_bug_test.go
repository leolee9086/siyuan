package chatseqtrie

import (
	"testing"
)

// ============================================================
// 深度审查：新发现的 Bug（基于当前代码状态）
// ============================================================

// -----------------------------------------------------------
// Bug 1: LoadFromStorage 不重建 sessionToNode 映射表
//
// 当前代码在 LoadFromStorage 中完成了节点重建和 session 标记恢复，
// 但从不填充 Trie.sessionToNode 映射表（trie.go:307-362）。
// 这导致：
//   a) 重启后重新 Insert 同一 sessionID 到不同路径时，旧标记不被清理
//      （trie.go:213 的清理守卫因 hasOld=false 失效）
//   b) Remove 的 sessionToNode 快速路径失效，回退全树遍历（正确但低效）
//
// 影响：持久化 → 重建 → 编辑同一会话 → 重复标记
// -----------------------------------------------------------

func TestBug_LoadFromStorageSessionToNodeNotPopulated(t *testing.T) {
	dir := t.TempDir()
	store, err := NewBoltStorage(dir + "/test.db")
	if err != nil {
		t.Fatal(err)
	}

	policy := DefaultFieldPolicy()
	trie := New(WithFieldPolicy(policy), WithStorage(store))

	// 插入 sessionA 到路径 [user("Hi"), assistant("Hello")]
	mustInsert(t, trie, "sessionA", []Message{userMsg("Hi"), assistantMsg("Hello")})

	// 验证 sessionToNode 在 rebuild 前正确
	if _, has := trie.sessionToNode["sessionA"]; !has {
		t.Fatal("sessionToNode 应有 sessionA")
	}

	// 保存并关闭，模拟重启
	store.Close()

	// 重新打开存储
	store2, err := NewBoltStorage(dir + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer store2.Close()

	// 重建
	trie2 := New(WithFieldPolicy(policy), WithStorage(store2))
	if err := trie2.LoadFromStorage(); err != nil {
		t.Fatal(err)
	}

	// === BUG 检查 1：sessionToNode 为空 ===
	if len(trie2.sessionToNode) != 0 {
		t.Logf("注意: sessionToNode 长度为 %d（期望此测试暴露空映射的问题）", len(trie2.sessionToNode))
	}

	// === BUG 检查 2：重新 Insert 同一 sessionID 到不同路径后产生重复标记 ===
	// 正确行为：清理旧路径标记，在新路径上标记
	// 错误行为：旧路径标记不清除，sessionA 同时出现在两个终端节点
	mustInsert(t, trie2, "sessionA", []Message{userMsg("Bonjour"), assistantMsg("Salut")})

	// SessionCount 应仍为 1
	if trie2.SessionCount() != 1 {
		t.Errorf("BUG: SessionCount=%d，期望 1。"+
			"说明 LoadFromStorage 后 sessionToNode 为空，"+
			"同 sessionID 重新 Insert 不同内容时未清理旧标记",
			trie2.SessionCount())
	}

	// NodeCount 应为 2（Bonjour→Salut），而不是 4（Hi→Hello + Bonjour→Salut）
	// 因为旧路径应被释放
	nodeCount := trie2.NodeCount()
	if nodeCount > 2 {
		t.Errorf("BUG: NodeCount=%d，期望 ≤2。"+
			"旧路径节点未因 session 移除而成为孤儿",
			nodeCount)
	}

	// 验证能否正确匹配新路径
	result := mustMatch(t, trie2, []Message{userMsg("Bonjour"), assistantMsg("Salut")})
	if !result.IsExactMatch {
		t.Errorf("BUG: 新路径应为精确匹配，得到 IsExactMatch=%v", result.IsExactMatch)
	}
	if result.MatchedSession != "sessionA" {
		t.Errorf("BUG: 应匹配 sessionA，得到 %s", result.MatchedSession)
	}
}

// -----------------------------------------------------------
// Bug 2: Claude 纯 tool_result 消息丢失父 user 消息
//
// convertClaudeContentBlocks 在处理 content blocks 时：
// 1. 先提取 toolResult 到独立消息（正确）
// 2. 再检查是否有 text/tool_calls/attachments/reasoning 来决定
//    是否保留主消息（line 206）
// 3. 如果 user 消息只包含 tool_result blocks 没有文本内容，
//    主消息不被添加，但 tool_results 在 result 中已有条目，
//    导致 line 211 的兜底检查也失效
//
// 结果：tool_result 消息存在于输出中，但父 user 消息丢失。
// -----------------------------------------------------------

func TestBug_ClaudePureToolResultDropsUserMessage(t *testing.T) {
	input := []map[string]any{
		{
			"role": "user",
			"content": []any{
				map[string]any{
					"type":        "tool_result",
					"tool_use_id": "tu_001",
					"content":     "计算结果: 42",
				},
			},
		},
		{
			"role": "assistant",
			"content": []any{
				map[string]any{
					"type": "text",
					"text": "好的，结果是42",
				},
			},
		},
	}

	msgs := ConvertClaudeMessages(input, "")

	// 期望结果：tool_result + user(无内容但应保留) + assistant
	// 实际结果：tool_result + assistant（user 消息丢失）
	// 因为纯 tool_result 的 user 消息在 line 206 的条件中不被保留

	// 验证 user 消息存在
	foundUser := false
	foundToolResult := false
	foundAssistant := false
	for _, m := range msgs {
		switch m.Type() {
		case "user":
			foundUser = true
		case "tool_result":
			foundToolResult = true
		case "assistant":
			foundAssistant = true
		}
	}

	if !foundUser {
		t.Errorf("BUG: 纯 tool_result 的 user 消息在转换中被丢弃。" +
			"\n  期望输出包含 user（至少 role=user, content=\"\"），实际只包含 tool_result+assistant")
	}
	if !foundToolResult {
		t.Error("tool_result 消息应存在")
	}
	if !foundAssistant {
		t.Error("assistant 消息应存在")
	}

	t.Logf("转换结果消息数=%d", len(msgs))
	for i, m := range msgs {
		t.Logf("  [%d] type=%s role=%s content=%q", i, m.Type(), m.Role(), m.Content())
	}
}

// -----------------------------------------------------------
// Bug 3: projectDocument 对非数组 tool_calls 静默丢弃
//
// 当 subTree.wildcard != nil 但 v 的类型不是 []any（例如 map[string]any）
// 时，projectDocument 的数组通配符分支（line 175-188）执行空操作，
// 没有任何 else 子句来兜底。
// 实际上 fieldpolicy.go:177-178:
//
//	if arr, ok := v.([]any); ok {
//	    // ... 处理数组
//	}
//	// ← 没有 else：非数组时整个字段被静默丢弃
//
// 影响：tool_calls 在非标准格式下不被纳入内容键，不同工具调用可能碰撞。
// -----------------------------------------------------------

func TestBug_ProjectDocumentNonArrayToolCallsDropped(t *testing.T) {
	policy := DefaultFieldPolicy()

	// 构造两条 tool_calls 为非数组格式的消息
	// （某些兼容 API 可能返回单对象而非数组）
	msg1 := Message{
		"type":    "assistant",
		"role":    "assistant",
		"content": "让我查一下",
		"tool_calls": map[string]any{ // 注意：这是 map 而非 []any
			"id":        "call_1",
			"name":      "search",
			"arguments": `{"q":"hello"}`,
		},
	}
	msg2 := Message{
		"type":    "assistant",
		"role":    "assistant",
		"content": "让我查一下",
		"tool_calls": map[string]any{ // 同上，但内容不同
			"id":        "call_2",
			"name":      "calculate",
			"arguments": `{"expr":"1+1"}`,
		},
	}

	key1, err := policy.ComputeKey(msg1)
	if err != nil {
		t.Fatal(err)
	}
	key2, err := policy.ComputeKey(msg2)
	if err != nil {
		t.Fatal(err)
	}

	// BUG 断言：tool_calls 被静默丢弃，key 只包含 type/role/content
	// 所以两个不同的工具调用产生相同的 key
	if key1 == key2 {
		t.Errorf("BUG: 不同 tool_calls（非数组格式）的 ComputeKey 相同\n"+
			"  key=%s\n"+
			"  原因: projectDocument 对非数组 tool_calls 静默丢弃，tool_calls/* 路径不匹配 map[string]any",
			key1)
	} else {
		t.Logf("PASS: key1=%q != key2=%q", key1, key2)
	}
}

// -----------------------------------------------------------
// Bug 4: Message.Content() 拼接文本不带分隔符
//
// 当 content 是 []any 时（Claude content blocks），Content() 方法
// 将多个 text block 的内容直接拼接，不带分隔符。
// 但 convertClaudeContentBlocks (claude.go:180) 使用
// strings.Join(textParts, "\n") 保存 content 字段。
//
// 这导致：
//   msg.Content() ≠ msg["content"] 当存在多个 text block 时
// -----------------------------------------------------------

func TestBug_MessageContentJoinNoSeparator(t *testing.T) {
	// 构造一个 content 为数组的消息，包含多个 text block
	input := []map[string]any{
		{
			"role": "assistant",
			"content": []any{
				map[string]any{"type": "text", "text": "第一步"},
				map[string]any{"type": "text", "text": "第二步"},
			},
		},
	}

	msgs := ConvertClaudeMessages(input, "")
	if len(msgs) != 1 {
		t.Fatalf("期望 1 条消息，得到 %d", len(msgs))
	}

	// 直接读取 content 字段（这是 converter 保存的，使用 \n 分隔）
	rawContent, _ := msgs[0]["content"].(string)
	// 使用 Content() 方法读取（拼接时不带分隔符）
	methodContent := msgs[0].Content()

	t.Logf("raw content      = %q", rawContent)
	t.Logf("Content() result = %q", methodContent)

	// 如果 content 含多段文本，两种方式的结果不同
	if rawContent != methodContent {
		t.Errorf("BUG: Content() 返回值 (%q) 与字段真实值 (%q) 不一致。"+
			"\n  原因: claude.go:180 用 strings.Join(textParts, \"\\n\") 保存 content，"+
			"\n  但 message.go:99 用 sb.WriteString(text) 拼接，无分隔符",
			methodContent, rawContent)
	}
}

// -----------------------------------------------------------
// Bug 5: Match 中 PathSessions 可能包含重复
//
// Insert 和 Match 在遍历路径时，如果某个节点上有多个 session 标记，
// 会将所有 sid 追加到 pathSessions（line 204-207 / 301-304）。
// 如果路径上多个节点都有 session 标记，同一个 session ID 可能多次出现。
// -----------------------------------------------------------

func TestBug_PathSessionsMayContainDuplicates(t *testing.T) {
	trie := New()

	// 构造场景：sessionA→AB, sessionB→AB, sessionC→ABC
	base2 := []Message{userMsg("A"), assistantMsg("B")}
	ext3 := []Message{userMsg("A"), assistantMsg("B"), userMsg("C")}

	mustInsert(t, trie, "sessionA", base2)
	mustInsert(t, trie, "sessionB", base2)
	mustInsert(t, trie, "sessionC", ext3)

	// 用路径 ABC 去 match
	result := mustMatch(t, trie, ext3)

	// PathSessions 应包含 ["sessionA", "sessionB", "sessionC"]（各一次）
	seen := make(map[string]int)
	for _, sid := range result.PathSessions {
		seen[sid]++
	}

	for sid, count := range seen {
		if count > 1 {
			t.Errorf("BUG: PathSessions 中 session %s 出现 %d 次（期望 1 次）",
				sid, count)
		}
	}
	t.Logf("PathSessions=%v", result.PathSessions)
}

// -----------------------------------------------------------
// Bug 6: BoltStorage 写锁与 bbolt 事务冗余 —— 非 bug 但设计缺陷
// 此处仅验证 BoltStorage.PutNode + BoltStorage.MarkSession 的原子性
//
// 实际上 BoltStorage 的 mu sync.Mutex（storage.go:75）保护的是：
// 在同一个 BoltStorage 实例上，PutNode 和 MarkSession 不会交错执行。
// 但 bbolt 本身已经是单写者模型，所以 mu 冗余但不影响正确性。
//
// 这里测试的是另一个问题：MarkSession 不验证节点是否存在。
// -----------------------------------------------------------

func TestBug_BoltMarkSessionOrphan(t *testing.T) {
	dir := t.TempDir()
	store, err := NewBoltStorage(dir + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	// 标记一个不存在的节点上的 session（节点 999 从未被 PutNode）
	err = store.MarkSession(999, "ghost_session")
	if err != nil {
		t.Fatal(err)
	}

	// 加载时，这个孤立 session 应被静默丢弃
	data, err := store.LoadAll()
	if err != nil {
		t.Fatal(err)
	}

	// 检查孤立 session 是否被加载
	found := false
	for _, se := range data.Sessions {
		if se.SessionID == "ghost_session" {
			found = true
			break
		}
	}
	if !found {
		t.Log("孤立 session 未出现在 LoadAll 中（取决于存储是否成功）")
	} else {
		t.Log("注意: LoadAll 加载了 ghost_session，它在 LoadFromStorage 时会被静默丢弃")
	}
}
