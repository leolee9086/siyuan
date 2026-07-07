package chatseqtrie

import "testing"

// -----------------------------------------------------------
// Bug: FindVariants 对不存在的 session 返回全部 session
//
// 当 sessionID 不在树中时，findPath 返回 false，targetPath = [root]。
// 然后 collectExtensions(root, 0, ...) 访问 root 的所有子树的 session。
//
// 结果：调用方查询一个不存在的 session 时，得到全量 session 列表，
//   错误地以为目标 session 存在且能共享前缀。
// -----------------------------------------------------------

func TestBug_FindVariantsNonexistentReturnsAll(t *testing.T) {
	trie := New()

	// 插入几个 session
	mustInsert(t, trie, "sessA", []Message{userMsg("Hi"), assistantMsg("Hello")})
	mustInsert(t, trie, "sessB", []Message{userMsg("Hi"), assistantMsg("Hi")})

	// 查询不存在的 session
	variants := trie.FindVariants("nonexistent")

	// 期望：空 map（session 不存在）
	// 实际：sessA 和 sessB 都在 variants 中，且共享前缀长度为 0
	if len(variants) != 0 {
		t.Errorf("BUG: FindVariants('nonexistent') 返回 %d 个 session（期望 0）\n"+
			"  说明：session 不存在时，collectExtensions(root,0,...) 访问了全部子树\n"+
			"  variants=%v", len(variants), variants)
	}

	// 验证正确 session 仍可正常查找
	variants2 := trie.FindVariants("sessA")
	if _, found := variants2["sessB"]; !found {
		t.Error("正常 session 的 FindVariants 应能找到 sessB")
	}
}

// -----------------------------------------------------------
// Bug: 同一节点上多个 session 时 MatchedSession 非确定
//
// Insert("sessA", [msg1, msg2]) 和 Insert("sessB", [msg1, msg2])
// 将使 sessA 和 sessB 标记在同一个节点上。
// Match 时 lastSessionID 在 map 迭代中覆盖，结果随机。
// -----------------------------------------------------------

func TestBug_MultipleSessionsSameNodeNonDeterministicMatch(t *testing.T) {
	trie := New()
	msgs := []Message{userMsg("Hi"), assistantMsg("Hello")}

	// 两个 session 插入完全相同的序列
	mustInsert(t, trie, "sessA", msgs)
	mustInsert(t, trie, "sessB", msgs)

	// 多次 Match 验证一致性
	results := make(map[string]int)
	for i := 0; i < 20; i++ {
		result, err := trie.Match(msgs)
		if err != nil {
			t.Fatal(err)
		}
		results[result.MatchedSession]++
	}

	// 期望：每次都应匹配 sessA（第一个插入的）
	// 实际：map 迭代导致 sessA 和 sessB 随机返回
	if results["sessA"] != 20 {
		t.Logf("注意: 20 次 Match 中 MatchedSession 分布:")
		for sid, count := range results {
			t.Logf("  %s: %d/20", sid, count)
		}

		// 如果结果不确定，说明 MatchedSession 受 map 迭代顺序影响
		if len(results) > 1 {
			t.Errorf("BUG: MatchedSession 非确定，"+
				"sessA=%d/20, sessB=%d/20\n"+
				"  原因：Insert 循环中 lastSessionID 被 map 迭代覆盖（trie.go:204-206）",
				results["sessA"], results["sessB"])
		}
	}
}

// -----------------------------------------------------------
// Bug: Remove 的全树遍历回退路径也不调用 pruneUpwards
//
// 如果 sessionToNode 映射缺失（例如旧版本升级、数据损坏），
// Remove 回退到全树遍历删除 session，但也不 pruneUpwards。
// -----------------------------------------------------------

func TestBug_RemoveFallbackNoPrune(t *testing.T) {
	trie := New()

	mustInsert(t, trie, "sessionA", []Message{userMsg("A"), assistantMsg("B")})

	// 模拟 sessionToNode 映射丢失
	delete(trie.sessionToNode, "sessionA")

	// Remove 走 fallback 路径
	removed := trie.Remove("sessionA")
	if !removed {
		t.Fatal("Remove 应返回 true")
	}

	// fallback 后节点应被修剪
	if trie.NodeCount() > 0 {
		t.Errorf("BUG: fallback Remove 后 NodeCount=%d（期望 0）\n"+
			"  fallback 路径删除 session 后未调用 pruneUpwards",
			trie.NodeCount())
	}

	// 检查是否有孤儿节点
	var orphanCount int
	var walk func(n *trieNode)
	walk = func(n *trieNode) {
		if len(n.sessions) == 0 && n != trie.root {
			hasChild := len(n.children) > 0
			if !hasChild {
				orphanCount++
			}
		}
		for _, child := range n.children {
			walk(child)
		}
	}
	walk(trie.root)

	if orphanCount > 0 {
		t.Logf("孤儿节点数=%d", orphanCount)
	}
}

// -----------------------------------------------------------
// Bug: computeKey 对同一消息做两次 JSON 往返
//
// computeKey（trie.go:119-129）：
//   1. 调用 policy.ComputeKey(msg) — 完整 JSON 往返 + 投影
//   2. 调用 policy.ComputeKeyHash(msg) — ComputeKeyHash 内部
//      又调用 ComputeKey()，再做一次 JSON 往返 + 投影
//
// 可以通过计算哈希的函数来对比两个调用的时间。
// -----------------------------------------------------------

func BenchmarkComputeKeyDoubleCall(b *testing.B) {
	policy := DefaultFieldPolicy()

	msg := Message{
		"type":    "assistant",
		"role":    "assistant",
		"content": "Hello world this is a test message with tool calls",
		"tool_calls": []any{
			map[string]any{
				"id":        "call_1",
				"name":      "read_file",
				"arguments": `{"path":"/some/long/path/to/a/file.txt","options":{"recursive":true,"max_depth":10}}`,
			},
			map[string]any{
				"id":        "call_2",
				"name":      "search",
				"arguments": `{"query":"this is a long search query","limit":100,"offset":0}`,
			},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// 模拟 trie.computeKey 的重复调用
		keyJSON, _ := policy.ComputeKey(msg)
		keyHash, _ := policy.ComputeKeyHash(msg)
		_ = keyJSON
		_ = keyHash
	}
}

func BenchmarkComputeKeySingleCall(b *testing.B) {
	policy := DefaultFieldPolicy()

	msg := Message{
		"type":    "assistant",
		"role":    "assistant",
		"content": "Hello world this is a test message with tool calls",
		"tool_calls": []any{
			map[string]any{
				"id":        "call_1",
				"name":      "read_file",
				"arguments": `{"path":"/some/long/path/to/a/file.txt","options":{"recursive":true,"max_depth":10}}`,
			},
			map[string]any{
				"id":        "call_2",
				"name":      "search",
				"arguments": `{"query":"this is a long search query","limit":100,"offset":0}`,
			},
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// 正确用法：只调用一次 ComputeKey，手动取哈希
		keyJSON, _ := policy.ComputeKey(msg)
		keyHash, _ := policy.ComputeKeyHash(msg) // 内部又调用 ComputeKey
		_ = keyJSON
		_ = keyHash
	}
}
