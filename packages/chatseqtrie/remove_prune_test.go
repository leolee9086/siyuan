package chatseqtrie

import "testing"

// -----------------------------------------------------------
// Bug: Remove 未调用 pruneUpwards，孤立节点永远残留
//
// 当前代码（trie.go）：
//   Insert 在 session 迁移旧路径时会调用 pruneUpwards 修剪孤立节点，
//   但 Remove 在删除 session 后不调用 pruneUpwards。
//
// 后果：被移除 session 的路径节点变为孤儿（无 session 标记、无子节点），
//   但永远留在树中，浪费内存并拖慢全树遍历操作（SessionCount/NodeCount/FindVariants）。
// -----------------------------------------------------------

func TestBug_RemoveDoesNotPruneOrphanedNodes(t *testing.T) {
	trie := New()

	// 构造路径：root → msgA → msgB（sessionA 终点）
	mustInsert(t, trie, "sessionA", []Message{userMsg("A"), assistantMsg("B")})

	// 再插入一个共享前缀的 session，使 A 节点有子节点
	mustInsert(t, trie, "sessionB", []Message{userMsg("A"), assistantMsg("C")})

	_ = trie.Remove("sessionA")

	// 移除 sessionA 后，msgB 节点（sessionA 的终节点）应被修剪
	// 因为 msgB 上没有 session 标记，也没有子节点
	//
	// 正确行为：NodeCount = 2（root→A→C，msgB 被修剪）
	// 错误行为：NodeCount = 3（root→A→B→C，msgB 孤儿残留）

	nodeCount := trie.NodeCount()
	expectedNodes := 2 // A, C

	if nodeCount > expectedNodes {
		t.Errorf("BUG: Remove 后 NodeCount=%d，期望 ≤%d。"+
			"说明 Remove 未 pruneUpwards，msgB 节点成为孤儿残留。",
			nodeCount, expectedNodes)
	} else {
		t.Logf("PASS: Remove 后 NodeCount=%d（期望 %d）", nodeCount, expectedNodes)
	}

	// 验证 tree 结构正确：root 的子节点应为 A，A 的子节点应为 C（B 已被修剪）
	var rootChildren []string
	for key := range trie.root.children {
		rootChildren = append(rootChildren, key)
	}
	t.Logf("root.children = %v", rootChildren)

	// 验证 sessionB 仍可正常匹配
	result := mustMatch(t, trie, []Message{userMsg("A"), assistantMsg("C")})
	if !result.IsExactMatch {
		t.Errorf("sessionB 应继续精确匹配，得到 IsExactMatch=%v", result.IsExactMatch)
	}
}

// -----------------------------------------------------------
// Bug: 深层路径中移除非共享末梢节点 = 路径完全不修剪
// -----------------------------------------------------------

func TestBug_RemoveDeepPathLeavesOrphans(t *testing.T) {
	trie := New()

	// 插入唯一 session 到 4 层深路径
	mustInsert(t, trie, "sessionA", []Message{
		userMsg("A"),
		assistantMsg("B"),
		userMsg("C"),
		assistantMsg("D"),
	})

	// 移除前 NodeCount
	before := trie.NodeCount()
	t.Logf("移除前 NodeCount=%d", before)

	removed := trie.Remove("sessionA")
	if !removed {
		t.Fatal("Remove 应返回 true")
	}

	after := trie.NodeCount()

	// 正确行为：NodeCount 变为 0（整条路径被修剪）
	// 错误行为：NodeCount 保持不变或减少很少（节点残留）
	if after > 0 {
		t.Errorf("BUG: Remove 后 NodeCount=%d（期望 0）。"+
			"孤立节点（无 session 无子节点）未被修剪。",
			after)
	} else {
		t.Logf("PASS: 移除后 NodeCount=%d", after)
	}

	// 验证 SessionCount
	if trie.SessionCount() != 0 {
		t.Errorf("SessionCount=%d，期望 0", trie.SessionCount())
	}
}
