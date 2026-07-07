package chatseqtrie

import "testing"

// --- 负面测试：projectDocument 关于通配符终端路径的 bug ---

func TestFieldPolicyWildcardTerminalPath_Bug_ComputeKeyCollision(t *testing.T) {
	// 负面测试：暴露 projectDocument 在递归入口处不检查 tree.isLeaf 的 bug。
	//
	// 策略 "tool_calls/*" 的语义是：tool_calls 数组中每个元素作为一个整体参与匹配。
	// buildPathTree 将 "tool_calls/*" 解析为：
	//   root.children["tool_calls"].wildcard.isLeaf = true
	//
	// 但 projectDocument 在处理通配符分支时，对每个数组元素递归调用
	// projectDocument(elemMap, subTree.wildcard)，而 projectDocument 的
	// 函数入口处从不检查 tree.isLeaf，只遍历 tree.children。
	// 当 wildcard 节点是终端（isLeaf=true）且无子节点时，tree.children 为空，
	// 导致 for 循环迭代零次，返回空 map（{}）。
	//
	// 最终结果：任何 tool_calls 数组元素都被投影为 {}，即使它们的内容完全不同。
	// 不同语义的消息产生相同的 keyJSON → 前缀树匹配逻辑完全失效。

	policy := NewFieldPolicy("tool_calls/*")

	// 两个 tool_calls 内容完全不同的消息
	msg1 := Message{
		"type":    "assistant",
		"role":    "assistant",
		"content": "Hello",
		"tool_calls": []any{
			map[string]any{
				"id":        "call_1",
				"name":      "read",
				"arguments": `{"path":"foo"}`,
			},
		},
	}
	msg2 := Message{
		"type":    "assistant",
		"role":    "assistant",
		"content": "Hello",
		"tool_calls": []any{
			map[string]any{
				"id":        "call_2",
				"name":      "write",
				"arguments": `{"path":"bar"}`,
			},
		},
	}

	// 第一步：验证 ComputeKey 本身是否正确
	key1, err := policy.ComputeKey(msg1)
	if err != nil {
		t.Fatal(err)
	}
	key2, err := policy.ComputeKey(msg2)
	if err != nil {
		t.Fatal(err)
	}

	// BUG 断言：两个语义不同的消息不应产生相同的 key
	if key1 == key2 {
		t.Errorf("BUG: 不同 tool_calls 内容的 ComputeKey 相同\n  key1=%s\n  key2=%s\n"+
			"原因: projectDocument 对 /* 终端路径产生空投影 {}，导致内容丢失",
			key1, key2)
	} else {
		t.Logf("PASS: ComputeKey 正确区分，key1=%q  != key2=%q", key1, key2)
	}

	// 第二步：验证对 Trie 前缀匹配的影响
	trie := New(WithFieldPolicy(policy))

	// 插入 msg1
	mustInsert(t, trie, "sessionA", []Message{userMsg("Hi"), msg1})

	// 用 msg2 匹配
	result := mustMatch(t, trie, []Message{userMsg("Hi"), msg2})

	// BUG 断言：不同 tool_calls 不应被认为与 sessionA 精确匹配
	if result.IsExactMatch {
		t.Errorf("BUG: 不同 tool_calls 内容在 Trie 中被错误匹配为精确匹配（matchedSession=%s）\n"+
			"说明 projectDocument 丢失了数组元素内容，导致 key 碰撞",
			result.MatchedSession)
	}
}

func TestFieldPolicyWildcardTerminalPath_Bug_FindVariantsBroken(t *testing.T) {
	// 补充验证：/* 终端路径 bug 对 FindVariants 的影响。
	// 当 key 碰撞时，两个本应不同的序列被认为相同路径，
	// FindVariants 会错误地报告它们为变体或完全漏报。

	policy := NewFieldPolicy("type", "content", "tool_calls/*")

	msgA := Message{
		"type":    "assistant",
		"role":    "assistant",
		"content": "calc",
		"tool_calls": []any{
			map[string]any{
				"id":        "call_1",
				"name":      "add",
				"arguments": `{"a":1,"b":2}`,
			},
		},
	}
	msgB := Message{
		"type":    "assistant",
		"role":    "assistant",
		"content": "calc",
		"tool_calls": []any{
			map[string]any{
				"id":        "call_2",
				"name":      "multiply",
				"arguments": `{"a":3,"b":4}`,
			},
		},
	}

	trie := New(WithFieldPolicy(policy))
	mustInsert(t, trie, "sessionA", []Message{msgA})
	mustInsert(t, trie, "sessionB", []Message{msgB})

	variants := trie.FindVariants("sessionA")

	// 如果 key 碰撞，sessionB 会插入到 sessionA 的路径上（相同的 key），
	// 导致两个 session 标记在同一节点。
	// 如果 key 正确：不同路径上的 session 会被 FindVariants 在兄弟分支中发现。
	if _, found := variants["sessionB"]; !found {
		t.Errorf("BUG: FindVariants 未找到 sessionB。" +
			" 可能原因：key 碰撞导致两个 session 路径完全重叠，或 key 丢失内容导致分叉点计算错误")
	} else {
		t.Logf("sessionB 被视为 sessionA 的变体，共享前缀长度=%d", variants["sessionB"])
	}
}
