package chatseqtrie

import (
	"strings"
	"testing"
)

// ============================================================
// 鲁棒性测试：异常输入、边界条件、恶意构造
// ============================================================

// -----------------------------------------------------------
// 1. Insert/Match 传入 nil 消息序列
// -----------------------------------------------------------

func TestRobust_NilMessageSlice(t *testing.T) {
	trie := New()

	// Insert nil
	result, err := trie.Insert("sess", nil)
	if err != nil {
		t.Errorf("Insert nil 不应返回 error: %v", err)
	}
	if result.BranchPoint != -1 {
		t.Errorf("Insert nil 应返回 BranchPoint=-1")
	}

	// Match nil
	result, err = trie.Match(nil)
	if err != nil {
		t.Errorf("Match nil 不应返回 error: %v", err)
	}
	if result.BranchPoint != -1 {
		t.Errorf("Match nil 应返回 BranchPoint=-1")
	}
}

// -----------------------------------------------------------
// 2. Insert 相同 sessionID 为空字符串，应正常运作
// -----------------------------------------------------------

func TestRobust_EmptySessionID(t *testing.T) {
	trie := New()

	_, err := trie.Insert("", []Message{userMsg("Hi"), assistantMsg("Hello")})
	if err != nil {
		t.Errorf("Insert 空 sessionID 不应 panic: %v", err)
	}

	result := mustMatch(t, trie, []Message{userMsg("Hi"), assistantMsg("Hello")})
	if result.MatchedSession != "" {
		t.Logf("空 sessionID 可被匹配: MatchedSession=%q", result.MatchedSession)
	}
}

// -----------------------------------------------------------
// 3. Message 中包含 nil 值字段
// -----------------------------------------------------------

func TestRobust_MessageWithNilField(t *testing.T) {
	trie := New()

	// content 显式设为 nil
	msg := Message{
		"type":    "user",
		"role":    "user",
		"content": nil,
	}

	_, err := trie.Insert("sess", []Message{msg})
	if err != nil {
		t.Errorf("Insert 带有 nil content 的消息不应 panic: %v", err)
	}
}

// -----------------------------------------------------------
// 4. Message 中 content 为数字（非字符串、非数组）
// -----------------------------------------------------------

func TestRobust_ContentIsNumeric(t *testing.T) {
	trie := New()

	// content 是数字（非法格式，但 map[string]any 允许）
	msg := Message{
		"type":    "user",
		"role":    "user",
		"content": 42,
	}

	_, err := trie.Insert("sessA", []Message{msg})
	if err != nil {
		t.Errorf("Insert content=42 不应返回 error: %v", err)
	}

	// 相同 content 的另一条消息应能匹配
	msg2 := Message{
		"type":    "user",
		"role":    "user",
		"content": 42,
	}
	result := mustMatch(t, trie, []Message{msg2})
	if !result.IsExactMatch {
		t.Errorf("content=42 的消息应能匹配自身，IsExactMatch=%v", result.IsExactMatch)
	}
}

// -----------------------------------------------------------
// 5. Message 中 content 为嵌套 map（非法但允许）
// -----------------------------------------------------------

func TestRobust_ContentIsMap(t *testing.T) {
	trie := New()

	msg := Message{
		"type":    "user",
		"role":    "user",
		"content": map[string]any{"nested": "value"},
	}

	_, err := trie.Insert("sess", []Message{msg})
	if err != nil {
		t.Errorf("Insert content=map 不应 panic: %v", err)
	}

	// Content() 方法应返回空字符串（不是 map 也不是 []any）
	if msg.Content() != "" {
		t.Errorf("Content() 对于 map 类型应返回 ''，得到 %q", msg.Content())
	}
}

// -----------------------------------------------------------
// 6. 极长的 sessionID（边界测试，可能撑爆存储键）
// -----------------------------------------------------------

func TestRobust_VeryLongSessionID(t *testing.T) {
	trie := New()

	longID := strings.Repeat("a", 10000)
	_, err := trie.Insert(longID, []Message{userMsg("Hi")})
	if err != nil {
		t.Errorf("Insert 10000 字符 sessionID 不应 error: %v", err)
	}

	// 验证可匹配
	result := mustMatch(t, trie, []Message{userMsg("Hi")})
	if result.MatchedSession != longID {
		t.Errorf("长 sessionID 的 match 结果不一致")
	}

	// 验证可 Remove
	removed := trie.Remove(longID)
	if !removed {
		t.Errorf("长 sessionID 的 Remove 应成功")
	}
}

// -----------------------------------------------------------
// 7. 极深的序列（可能导致递归深度问题）
// -----------------------------------------------------------

func TestRobust_VeryDeepSequence(t *testing.T) {
	trie := New()

	// 构造 2000 层深的序列
	messages := make([]Message, 2000)
	for i := 0; i < 2000; i++ {
		messages[i] = Message{
			"type":    "user",
			"role":    "user",
			"content": strings.Repeat("x", 10),
		}
	}

	_, err := trie.Insert("deep", messages)
	if err != nil {
		t.Errorf("Insert 2000 层深序列不应 panic/error: %v", err)
	}

	if trie.NodeCount() != 2000 {
		t.Errorf("NodeCount=%d，期望 2000", trie.NodeCount())
	}

	// 相同序列应能 Match
	result := mustMatch(t, trie, messages)
	if !result.IsExactMatch {
		t.Errorf("深序列的 Match 应返回 IsExactMatch=true")
	}
}

// -----------------------------------------------------------
// 8. FieldPolicy 异常路径：空路径、纯通配符、重复斜杠
// -----------------------------------------------------------

func TestRobust_FieldPolicyMalformedPaths(t *testing.T) {
	// 这些路径不应 panic 或崩溃
	paths := []string{
		"",
		"*",
		"/a/b",
		"a//b",
		"a/b/",
		"*/name",
		"a/*/b/*/c/*/d/*/e",
		strings.Repeat("a/b/", 100),
	}

	for _, p := range paths {
		func() {
			defer func() {
				if r := recover(); r != nil {
					t.Errorf("路径 %q 导致 panic: %v", p, r)
				}
			}()
			policy := NewFieldPolicy(p)
			msg := Message{"type": "user", "content": "test"}
			_, err := policy.ComputeKey(msg)
			if err != nil {
				t.Logf("路径 %q 的 ComputeKey 返回 error: %v（可接受）", p, err)
			}
		}()
	}
}

// -----------------------------------------------------------
// 9. 通配符 * 出现在路径中间但字段非数组
// -----------------------------------------------------------

func TestRobust_WildcardOnNonArray(t *testing.T) {
	policy := NewFieldPolicy("meta/*/name")

	// meta 是 map 而非数组
	msg := Message{
		"type": "user",
		"meta": map[string]any{
			"source": "web",
			"name":   "test",
		},
	}

	// 应不 panic，通配符分支不触发（非 []any）
	key, err := policy.ComputeKey(msg)
	if err != nil {
		t.Errorf("ComputeKey 不应 error: %v", err)
	}
	t.Logf("meta 为非数组时 key=%s", key)

	// meta 是 nil
	msg2 := Message{
		"type": "user",
		"meta": nil,
	}
	key2, _ := policy.ComputeKey(msg2)
	t.Logf("meta 为 nil 时 key=%s", key2)
}

// -----------------------------------------------------------
// 10. BoltStorage 打开非法路径
// -----------------------------------------------------------

func TestRobust_BoltInvalidPath(t *testing.T) {
	// 目录不存在
	_, err := NewBoltStorage("Z:/nonexistent/deep/test.db")
	if err == nil {
		t.Error("BoltStorage 使用非法路径应返回 error")
	} else {
		t.Logf("正确拒绝非法路径: %v", err)
	}
}

// -----------------------------------------------------------
// 11. Message.Content() 对 content 为 bool/number 的处理
// -----------------------------------------------------------

func TestRobust_ContentMethodTypeEdgeCases(t *testing.T) {
	// content 为布尔值
	msg1 := Message{"content": true}
	if msg1.Content() != "" {
		t.Errorf("content=true 的 Content() 应返回 ''，得到 %q", msg1.Content())
	}

	// content 为 int
	msg2 := Message{"content": 0}
	if msg2.Content() != "" {
		t.Errorf("content=0 的 Content() 应返回 ''，得到 %q", msg2.Content())
	}

	// content 为空数组（无 text block）
	msg3 := Message{"content": []any{}}
	if msg3.Content() != "" {
		t.Errorf("空数组的 Content() 应返回 ''，得到 %q", msg3.Content())
	}

	// content 为数组但元素不是 map
	msg4 := Message{"content": []any{"string", 42, true}}
	if msg4.Content() != "" {
		t.Errorf("非 map 元素数组的 Content() 应返回 ''，得到 %q", msg4.Content())
	}

	// content 数组元素缺少 text 字段
	msg5 := Message{"content": []any{map[string]any{"type": "text", "no_text": "yes"}}}
	if msg5.Content() != "" {
		t.Errorf("缺少 text 字段时 Content() 应返回 ''，得到 %q", msg5.Content())
	}
}

// -----------------------------------------------------------
// 12. nodeID 溢出（nextID 超过 int64 上限）
// 验证新增节点时的 ID 循环/符号问题
// -----------------------------------------------------------

func TestRobust_NodeIDOverflow(t *testing.T) {
	trie := New()

	// 设置 nextID 到接近 int64 最大值
	trie.nextID.Store(1<<63 - 10)

	// 插入 20 个节点（10 条消息序列）
	msgs := make([]Message, 10)
	for i := 0; i < 10; i++ {
		msgs[i] = userMsg(string(rune('A' + i)))
	}

	_, err := trie.Insert("overflow", msgs)
	if err != nil {
		t.Errorf("nextID 接近上限时 Insert 不应 error: %v", err)
	}

	// 检查 nodeID 是否溢出
	var minID int64 = 1<<63 - 10
	var maxID int64
	var walk func(n *trieNode)
	walk = func(n *trieNode) {
		if n.nodeID > 0 {
			if n.nodeID > maxID {
				maxID = n.nodeID
			}
			if n.nodeID < minID {
				minID = n.nodeID
			}
		}
		for _, child := range n.children {
			walk(child)
		}
	}
	walk(trie.root)

	t.Logf("nodeID 范围: [%d, %d]", minID, maxID)
	if minID < 0 {
		t.Errorf("nodeID 溢出到负数: minID=%d", minID)
	}
}

// -----------------------------------------------------------
// 13. 深度递归节点（考验 pruneUpwards 的递归深度）
// -----------------------------------------------------------

func TestRobust_PruneAfterDeepChain(t *testing.T) {
	trie := New()

	// 构造 5000 层链，然后 Remove
	msgs := make([]Message, 5000)
	for i := 0; i < 5000; i++ {
		msgs[i] = userMsg(string(rune('A' + i%26)))
	}

	mustInsert(t, trie, "chain", msgs)
	t.Logf("插入 5000 节点后 NodeCount=%d", trie.NodeCount())

	removed := trie.Remove("chain")
	if !removed {
		t.Fatal("Remove 应成功")
	}

	// 验证所有节点被修剪
	if trie.NodeCount() != 0 {
		t.Errorf("5000 节点链 Remove 后 NodeCount=%d，期望 0", trie.NodeCount())
	}
}

// -----------------------------------------------------------
// 14. ConvertClaudeMessages 输入 nil/空 msgs
// -----------------------------------------------------------

func TestRobust_ConvertClaudeNilInput(t *testing.T) {
	// nil messages
	msgs := ConvertClaudeMessages(nil, "")
	if len(msgs) != 0 {
		t.Errorf("nil msgs 应返回空切片，得到 %d", len(msgs))
	}

	// nil messages with system
	msgs = ConvertClaudeMessages(nil, "you are helpful")
	if len(msgs) != 1 {
		t.Errorf("nil msgs + system 应返回 1 条 system 消息，得到 %d", len(msgs))
	}
	if msgs[0].Type() != "system" {
		t.Errorf("消息应为 system 类型")
	}

	// empty messages
	msgs = ConvertClaudeMessages([]map[string]any{}, "system")
	if len(msgs) != 1 {
		t.Errorf("空 msgs + system 应返回 1 条 system 消息，得到 %d", len(msgs))
	}
}

// -----------------------------------------------------------
// 15. ConvertOpenAIMessages 输入 nil/空 msgs
// -----------------------------------------------------------

func TestRobust_ConvertOpenAINilInput(t *testing.T) {
	// nil messages
	msgs := ConvertOpenAIMessages(nil)
	if len(msgs) != 0 {
		t.Errorf("nil 应返回空切片，得到 %d", len(msgs))
	}

	// empty messages
	msgs = ConvertOpenAIMessages([]map[string]any{})
	if len(msgs) != 0 {
		t.Errorf("空切片应返回空切片")
	}
}

// -----------------------------------------------------------
// 16. ConvertOpenAIMessage 含 nil tool_calls 元素
// -----------------------------------------------------------

func TestRobust_OpenAIToolCallsWithNilElement(t *testing.T) {
	input := []map[string]any{
		{
			"role":    "assistant",
			"content": "calling tools",
			"tool_calls": []any{
				nil, // 空元素
				map[string]any{
					"id":   "call_1",
					"type": "function",
					"function": map[string]any{
						"name":      "read",
						"arguments": `{}`,
					},
				},
			},
		},
	}

	msgs := ConvertOpenAIMessages(input)
	if len(msgs) != 1 {
		t.Fatalf("期望 1 条消息，得到 %d", len(msgs))
	}

	tcs, ok := msgs[0]["tool_calls"].([]map[string]any)
	if !ok {
		t.Fatalf("应包含 tool_calls")
	}
	// nil 元素被跳过，所以只有 1 个
	if len(tcs) != 1 {
		t.Logf("注意: tool_calls 中包含 nil 元素，最终数量=%d（nil 被 ConvertOpenAIMessage 跳过）", len(tcs))
	}
}

// -----------------------------------------------------------
// 17. Message JSON 中包含递归引用（无限序列化）
// -----------------------------------------------------------

func TestRobust_SelfReferentialMessage(t *testing.T) {
	msg := make(Message)
	msg["self"] = msg // 自引用

	// NewMessage 通过 JSON 往返来归一化，自引用应导致 error
	_, err := NewMessage(msg)
	if err == nil {
		t.Error("自引用 Message 的 NewMessage 应返回 error（json.Marshal 会失败）")
	} else {
		t.Logf("正确拒绝自引用: %v", err)
	}
}

// -----------------------------------------------------------
// 18. BoltStorage 并发写入中 DB 被关闭
// -----------------------------------------------------------

func TestRobust_BoltDoubleClose(t *testing.T) {
	dir := t.TempDir()
	store, err := NewBoltStorage(dir + "/test.db")
	if err != nil {
		t.Fatal(err)
	}

	// 关闭两次
	err = store.Close()
	if err != nil {
		t.Errorf("第一次 Close 不应 error: %v", err)
	}
	err = store.Close()
	if err != nil {
		t.Logf("第二次 Close 返回 error（可接受）: %v", err)
	} else {
		t.Log("第二次 Close 未返回 error")
	}
}

// -----------------------------------------------------------
// 19. Insert 后紧接 Match 但序列正好在分叉点匹配到空 session
// -----------------------------------------------------------

func TestRobust_MatchBranchPointEmptySession(t *testing.T) {
	trie := New()

	// 插入两个 session，序列有完全不同的前缀
	mustInsert(t, trie, "sessA", []Message{userMsg("A"), assistantMsg("B")})
	mustInsert(t, trie, "sessB", []Message{userMsg("C"), assistantMsg("D")})

	// 用第三条不同前缀的序列去 Match（完全不匹配）
	result := mustMatch(t, trie, []Message{userMsg("X"), userMsg("Y")})

	if result.MatchedSession != "" {
		t.Errorf("完全不匹配时应无 MatchedSession，得到 %s", result.MatchedSession)
	}
	if result.CommonPrefixLen != 0 {
		t.Errorf("CommonPrefixLen 应为 0，得到 %d", result.CommonPrefixLen)
	}
	if len(result.Suffix) != 2 {
		t.Errorf("Suffix 应为完整输入（2 条），得到 %d", len(result.Suffix))
	}
}

// -----------------------------------------------------------
// 20. 策略路径为空字符串列表，ComputeKey 不应崩溃
// -----------------------------------------------------------

func TestRobust_EmptyFieldPolicy(t *testing.T) {
	policy := NewFieldPolicy() // 无路径

	msg := Message{"type": "user", "content": "hello"}

	key, err := policy.ComputeKey(msg)
	if err != nil {
		t.Errorf("空策略 ComputeKey 不应 error: %v", err)
	}
	if key != "{}" {
		t.Errorf("空策略应投影为空对象 {}，得到 %s", key)
	}
}

// -----------------------------------------------------------
// 21. JSON 往返后的数字精度丢失（大整数）
// -----------------------------------------------------------

func TestRobust_LargeIntegerLoss(t *testing.T) {
	policy := DefaultFieldPolicy()

	// JSON 解析会丢失大整数精度
	msg := Message{
		"type":    "user",
		"role":    "user",
		"content": "big",
		"value":   9007199254740993, // > Number.MAX_SAFE_INTEGER
	}

	key1, _ := policy.ComputeKey(msg)

	// 再构造一个不同的值，但 JSON 往返后可能相同
	msg2 := Message{
		"type":    "user",
		"role":    "user",
		"content": "big",
		"value":   9007199254740994,
	}
	key2, _ := policy.ComputeKey(msg2)

	t.Logf("key1=%s", key1)
	t.Logf("key2=%s", key2)

	if key1 == key2 {
		t.Logf("注意: 不同大整数在 JSON 往返后产生相同 key（Go json 精度丢失）")
	}
}

// -----------------------------------------------------------
// 22. FindVariants 循环调用导致堆栈爆炸
// -----------------------------------------------------------

func TestRobust_FindVariantsDeepChain(t *testing.T) {
	trie := New()

	// 构造 1000 条链式 session
	for i := 0; i < 1000; i++ {
		msgs := make([]Message, i+1)
		for j := 0; j <= i; j++ {
			msgs[j] = userMsg(string(rune('A' + j%26)))
		}
		mustInsert(t, trie, "sess_"+string(rune('A'+i%26))+string(rune('0'+i%10)), msgs)
	}

	// 查找最后一个 session 的变体（需要遍历整个树）
	variants := trie.FindVariants("sess_A0")
	t.Logf("在 1000 个链式 session 中 FindVariants 返回 %d 个变体", len(variants))
}

// -----------------------------------------------------------
// 23. Clone 攻击：大量相同前缀的 session 导致 O(N²) 行为
// -----------------------------------------------------------

func TestRobust_InsertManyPrefixSessions(t *testing.T) {
	trie := New()

	// 构造 500 个共享前缀的 session
	prefix := []Message{userMsg("A"), assistantMsg("B"), userMsg("C")}
	for i := 0; i < 500; i++ {
		msgs := append(prefix, userMsg(string(rune('D'+i%26))))
		msgs = append(msgs, assistantMsg(string(rune('a'+i%26))))
		_, err := trie.Insert("sess_"+string(rune('A'+(i/10)%26))+string(rune('0'+(i%10))), msgs)
		if err != nil {
			t.Errorf("Insert %d 失败: %v", i, err)
		}
	}

	t.Logf("500 个共享前缀 session 后 NodeCount=%d, SessionCount=%d", trie.NodeCount(), trie.SessionCount())
}

// -----------------------------------------------------------
// 24. LoadFromStorage 后 Insert/Match 正常工作
// -----------------------------------------------------------

func TestRobust_LoadThenInsertMatch(t *testing.T) {
	dir := t.TempDir()
	store, err := NewBoltStorage(dir + "/test.db")
	if err != nil {
		t.Fatal(err)
	}

	trie := New(WithStorage(store))
	mustInsert(t, trie, "sessA", []Message{userMsg("Hi"), assistantMsg("Hello")})
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

	// 在新树上插入更多 session 后 Match
	mustInsert(t, trie2, "sessB", []Message{userMsg("Hello"), assistantMsg("World")})

	result := mustMatch(t, trie2, []Message{userMsg("Hi"), assistantMsg("Hello")})
	if result.MatchedSession != "sessA" {
		t.Errorf("重建后 Match sessionA 失败: MatchedSession=%s", result.MatchedSession)
	}

	result2 := mustMatch(t, trie2, []Message{userMsg("Hello"), assistantMsg("World")})
	if result2.MatchedSession != "sessB" {
		t.Errorf("重建后 Match sessionB 失败: MatchedSession=%s", result2.MatchedSession)
	}
}
