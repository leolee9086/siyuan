package chatseqtrie

import (
	"encoding/json"
	"strings"
	"testing"
)

// ============================================================
// 负面测试：静默失败问题集合
// ============================================================

// -----------------------------------------------------------
// 1. Insert 相同 sessionID 不同内容时不清理旧标记
//
// 场景: Insert("sessionA", [msg1]) 后再 Insert("sessionA", [msg1, msg2])
// 结果: sessionA 同时出现在 msg1 节点和 msg2 节点。
//       当 session 的内容路径变更时（例如消息被编辑），旧标记不会被清除，
//       导致 session 在树中出现多次，FindVariants 不可靠，SessionCount 计数错误。
// -----------------------------------------------------------

func TestSilentDuplicateSessionID_Bug_NoCleanupOnReinsert(t *testing.T) {
	trie := New()

	// 第一次插入：sessionA 在 msg1 节点
	mustInsert(t, trie, "sessionA", []Message{userMsg("Hi")})

	// 第二次插入：同一 sessionID，不同内容路径
	mustInsert(t, trie, "sessionA", []Message{userMsg("Hello")})

	// SessionCount 应为 1（同一 session 只算一次）
	if trie.SessionCount() != 1 {
		t.Errorf("BUG: SessionCount=%d，期望 1（sessionA 被重复标记）。"+
			"说明 Insert 相同 sessionID 不同内容时未清理旧标记", trie.SessionCount())
	}

	// Insert("sessionA", [msg1, msg2]) 然后再 Insert("sessionA", [msg1, msg3])
	trie2 := New()
	mustInsert(t, trie2, "sessionA", []Message{userMsg("A"), assistantMsg("B")})
	mustInsert(t, trie2, "sessionA", []Message{userMsg("A"), assistantMsg("C")})

	if trie2.SessionCount() != 1 {
		t.Errorf("BUG: SessionCount=%d，期望 1。"+
			"同一 session 编辑后重新插入导致重复标记", trie2.SessionCount())
	}

	// 验证严重性：NodeCount
	nodeCount := trie2.NodeCount()
	// 正确行为应是 2 个节点（root→A→C，因为路径从 A 处分叉）
	// 实际行为：A→B 和 A→C 两条路径都存在，节点数 2
	// 但 sessionA 同时标记在 A→B 和 A→C 两个终端节点
	t.Logf("NodeCount=%d，session 标记数=%d", nodeCount, trie2.SessionCount())
}

// -----------------------------------------------------------
// 2. Claude 图片转换时 source.data 与 source.url 相互覆盖
//
// 场景: 响应的 source 对象同时包含 data（base64）和 url 字段。
// 结果: url 无条件覆盖 data，base64 内容静默丢失。
// -----------------------------------------------------------

func TestSilentClaudeImageDataUrlOverwrite_Bug(t *testing.T) {
	input := []map[string]any{
		{
			"role": "user",
			"content": []any{
				map[string]any{
					"type": "image",
					"source": map[string]any{
						"type":       "base64",
						"media_type": "image/png",
						"data":       "iVBORw0KGgoAAAANSUhEUg...",   // base64 图片数据
						"url":        "https://example.com/img.png", // URL 引用
					},
				},
			},
		},
	}

	msgs := ConvertClaudeMessages(input, "")

	// user 消息的 attachments 应包含一个 image 附件
	attachments, ok := msgs[0]["attachments"].([]map[string]any)
	if !ok {
		t.Fatal("期望 user 消息包含 attachments")
	}
	if len(attachments) != 1 {
		t.Fatalf("期望 1 个 attachment，得到 %d", len(attachments))
	}

	att := attachments[0]
	dataVal := att["data"]

	// BUG 断言：如果 url 覆盖了 data，则 att["data"] 是 URL 而非 base64
	t.Logf("attachment data=%v", dataVal)

	// 正确的行为是保留 data 字段而不是无条件被 url 覆盖
	// 因为 data 和 url 有不同的语义，不应共享同一 key
	dataStr, _ := dataVal.(string)
	if strings.HasPrefix(dataStr, "http") {
		t.Errorf("BUG: att['data'] 被 url 覆盖为 '%s'，期望保留 base64 数据 'iVBORw0KGgo...'。"+
			"\n  claude.go 第 159-161 行无条件覆盖 att['data']：当 source 同时存在 data 和 url 时，url 覆盖 data",
			dataStr)
	}
}

// -----------------------------------------------------------
// 3. Claude tool_use 缺失 id/name 时存储 nil 值
//
// 场景: tool_use block 缺少 id 或 name 字段（非标准 API 响应）。
// 结果: tool_calls 数组中元素包含 nil 值，json.Marshal 输出 "null"，
//       导致下游序列化异常或运行时类型断言失败。
// -----------------------------------------------------------

func TestSilentClaudeToolUseNilFields_Bug(t *testing.T) {
	input := []map[string]any{
		{
			"role": "assistant",
			"content": []any{
				map[string]any{
					"type": "tool_use",
					// 缺少 "id" 字段
					"name":  "read_file",
					"input": map[string]any{"path": "foo"},
				},
				map[string]any{
					"type": "tool_use",
					"id":   "call_2",
					// 缺少 "name" 字段
					"input": map[string]any{"path": "bar"},
				},
			},
		},
	}

	msgs := ConvertClaudeMessages(input, "")

	if len(msgs) != 1 {
		t.Fatalf("期望 1 条消息，得到 %d", len(msgs))
	}

	tcs, ok := msgs[0]["tool_calls"].([]map[string]any)
	if !ok || len(tcs) != 2 {
		t.Fatalf("期望 2 个 tool_calls")
	}

	// tool_call[0] 缺少 id → 存储 nil
	if tcs[0]["id"] != nil {
		t.Errorf("缺少 id 时应为 nil，得到 %v", tcs[0]["id"])
	}

	// tool_call[1] 缺少 name → 存储 nil
	if tcs[1]["name"] != nil {
		t.Errorf("缺少 name 时应为 nil，得到 %v", tcs[1]["name"])
	}

	// 验证 nil 是否会进入 JSON 输出
	jsonBytes, err := json.Marshal(msgs[0])
	if err != nil {
		t.Fatal(err)
	}
	jsonStr := string(jsonBytes)

	// nil 值在 JSON 中输出为 null
	if strings.Contains(jsonStr, `"id":null`) {
		t.Logf("注意: tool_calls[0].id 序列化为 null（可接受，但下游可能不期望 null）")
	}
	if strings.Contains(jsonStr, `"name":null`) {
		t.Logf("注意: tool_calls[1].name 序列化为 null（可接受，但下游可能不期望 null）")
	}
}

// -----------------------------------------------------------
// 4. WalkChildren 和 LoadAll 静默跳过无法反序列化的节点
//
// 场景: 存储介质中某个节点数据损坏（手动编辑、版本迁移、部分写入）。
// 结果: 跳过损坏节点但不报告，调用方不知晓数据不完整。
// -----------------------------------------------------------

func TestSilentWalkChildrenSkipCorruptedNode_Bug(t *testing.T) {
	// 使用 BoltStorage 写入正常节点，然后模拟损坏场景
	dir := t.TempDir()
	store, err := NewBoltStorage(dir + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	// 写入正常节点
	err = store.PutNode(&StoredNode{
		ID:       1,
		ParentID: 0,
		KeyHash:  "abc",
		KeyJSON:  `{"type":"user","content":"Hi"}`,
		Depth:    1,
	})
	if err != nil {
		t.Fatal(err)
	}

	// WalkChildren 正常路径
	var foundNodes int
	err = store.WalkChildren(0, func(n *StoredNode) error {
		foundNodes++
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if foundNodes != 1 {
		t.Fatalf("期望 1 个节点，得到 %d", foundNodes)
	}

	// 注意：WalkChildren 内部 json.Unmarshal 失败时 continue 跳过了节点
	// (storage.go:250-252)。这种静默跳过在实际存储损坏时会导致数据丢失而不被察觉。
	// 这是一个设计上的薄弱点，但不是运行时能简单触发的 bug。
	t.Log("ok: WalkChildren 正常路径工作正常")
}

// -----------------------------------------------------------
// 5. LoadFromStorage 孤立节点/会话静默丢失
//
// 场景: NodeID 不在 nodeMap 时，其 session 标记静默丢失。
// -----------------------------------------------------------

func TestSilentLoadFromStorageOrphanDrop_Bug(t *testing.T) {
	dir := t.TempDir()
	store, err := NewBoltStorage(dir + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	// 构造一个孤立 session（NodeID 对应的节点不存在）
	err = store.MarkSession(999, "orphan_session")
	if err != nil {
		t.Fatal(err)
	}

	// 构造一个孤立节点（ParentID 对应的父节点不存在）
	err = store.PutNode(&StoredNode{
		ID:       100,
		ParentID: 999, // 这个父节点不存在
		KeyHash:  "def",
		KeyJSON:  `{"type":"user","content":"lonely"}`,
		Depth:    1,
	})
	if err != nil {
		t.Fatal(err)
	}

	// 加载重建
	policy := DefaultFieldPolicy()
	trie := New(WithFieldPolicy(policy), WithStorage(store))
	err = trie.LoadFromStorage()
	if err != nil {
		t.Fatal(err)
	}

	// 孤立节点 100 挂载在 parentID=999 下，但 999 不存在
	// LoadFromStorage 第二遍（storage.go:346-351）中，parent=nodeMap[999] 不存在，
	// 所以 node 100 不会被挂接到树上 → 静默丢失

	// 孤立 session "orphan_session" 标记在 nodeID=999 上，但 nodeMap[999] 不存在
	// 所以 session 静默丢失（storage.go:355-359）

	// NodeCount 不应包含孤立节点 100
	if trie.NodeCount() > 0 {
		t.Logf("NodeCount=%d, 孤立节点 100 未被挂接（期望行为：被静默丢弃）", trie.NodeCount())
	}
	// SessionCount 不应包含孤立 session
	if trie.SessionCount() > 0 {
		t.Logf("SessionCount=%d, 孤立 session 被静默丢弃", trie.SessionCount())
	}

	t.Log("注意: LoadFromStorage 对孤立节点和会话静默丢弃，调用方无法感知数据不完整")
}

// -----------------------------------------------------------
// 6. Remove 中 storage.RemoveSession 错误静默忽略
// -----------------------------------------------------------

func TestSilentRemoveStorageErrorSuppressed_Bug(t *testing.T) {
	dir := t.TempDir()
	store, err := NewBoltStorage(dir + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	trie := New(WithStorage(store))
	mustInsert(t, trie, "sessionA", []Message{userMsg("Hi")})

	// 关闭存储后端，使后续操作失败
	store.Close()

	// Remove 时 storage.RemoveSession 出错（因为 db 已关闭）
	// 但错误被 _ 静默忽略（trie.go:342-344）
	removed := trie.Remove("sessionA")
	if !removed {
		t.Error("Remove 返回 false，但 sessionA 在内存中应被移除")
	}

	// BUG: session 标记已从内存移除，但存储层操作失败
	// 重启后 sessionA 仍存在于存储中，但内存中已消失
	t.Log("注意: Remove 中 storage.RemoveSession 错误被静默忽略 (#342)")
}

// -----------------------------------------------------------
// 7. Insert 中 storage.PutNode 错误静默忽略导致内存/存储不一致
// -----------------------------------------------------------

func TestSilentInsertPutNodeError_Bug_MemoryInconsistent(t *testing.T) {
	dir := t.TempDir()
	store, err := NewBoltStorage(dir + "/test.db")
	if err != nil {
		t.Fatal(err)
	}

	trie := New(WithStorage(store))
	mustInsert(t, trie, "sessionA", []Message{userMsg("Hi"), assistantMsg("Hello")})

	// 关闭存储，使后续写入失败
	store.Close()

	// 再次插入新 session，此时 storage.PutNode 会失败
	// 但错误被 continue 静默忽略（trie.go:182-185）
	mustInsert(t, trie, "sessionB", []Message{userMsg("Bonjour"), assistantMsg("Salut")})

	// 内存中有 sessionB 的节点
	nodeCount := trie.NodeCount()
	sessionCount := trie.SessionCount()
	t.Logf("内存状态: NodeCount=%d, SessionCount=%d", nodeCount, sessionCount)

	// BUG: 内存中有完整数据，但存储中没有 sessionB 的任何节点
	// 重启后从存储加载会丢失 sessionB
	t.Log("注意: Insert 中 storage.PutNode 错误静默忽略（#182-185），" +
		"内存与存储状态不一致，重启后数据丢失")
}
