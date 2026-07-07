package chatseqtrie

import (
	"path/filepath"
	"testing"
)

// --- 测试辅助函数 ---

func userMsg(content string) Message {
	return Message{"type": "user", "role": "user", "content": content}
}

func assistantMsg(content string) Message {
	return Message{"type": "assistant", "role": "assistant", "content": content}
}

func assistantWithToolMsg(content, toolName, toolArgs, callID string) Message {
	return Message{
		"type":    "assistant",
		"role":    "assistant",
		"content": content,
		"tool_calls": []map[string]any{
			{"id": callID, "name": toolName, "arguments": toolArgs},
		},
	}
}

func toolResultMsg(callID, content string) Message {
	return Message{
		"type":         "tool_result",
		"role":         "tool_result",
		"tool_call_id": callID,
		"content":      content,
	}
}

func systemMsg(content string) Message {
	return Message{"type": "system", "role": "system", "content": content}
}

// --- 基础前缀匹配测试 ---

func TestInsertAndExactMatch(t *testing.T) {
	trie := New()
	msgs := []Message{userMsg("Hi"), assistantMsg("Hello")}

	result, err := trie.Insert("sessionA", msgs)
	if err != nil {
		t.Fatal(err)
	}
	if result.IsExactMatch {
		t.Error("首次插入不应为精确匹配")
	}

	// 用 Match 查找已存序列
	result = mustMatch(t, trie, msgs)
	if !result.IsExactMatch {
		t.Error("相同序列应为精确匹配")
	}
	if result.MatchedSession != "sessionA" {
		t.Errorf("期望 sessionA，得到 %s", result.MatchedSession)
	}
	if len(result.Suffix) != 0 {
		t.Error("精确匹配不应有后缀")
	}
}

func TestExtension(t *testing.T) {
	trie := New()
	base := []Message{userMsg("Hi"), assistantMsg("Hello")}
	extended := []Message{userMsg("Hi"), assistantMsg("Hello"), userMsg("How are you?")}

	mustInsert(t, trie, "sessionA", base)

	result := mustInsert(t, trie, "sessionB", extended)
	if result.MatchedSession != "sessionA" {
		t.Errorf("期望匹配 sessionA，得到 %s", result.MatchedSession)
	}
	if result.MatchedLen != 2 {
		t.Errorf("期望匹配长度 2，得到 %d", result.MatchedLen)
	}
	if len(result.Suffix) != 1 {
		t.Fatalf("期望后缀长度 1，得到 %d", len(result.Suffix))
	}
	if result.Suffix[0].Content() != "How are you?" {
		t.Errorf("后缀内容不匹配: %s", result.Suffix[0].Content())
	}
}

func TestVariantBranch(t *testing.T) {
	trie := New()
	seqA := []Message{userMsg("Hi"), assistantMsg("Hello"), userMsg("How are you?")}
	seqB := []Message{userMsg("Hi"), assistantMsg("Hello"), userMsg("What's your name?")}

	mustInsert(t, trie, "sessionA", seqA)
	result := mustInsert(t, trie, "sessionB", seqB)

	if !result.IsVariant {
		t.Error("应为变体分支")
	}
	if result.BranchPoint != 2 {
		t.Errorf("期望分叉点 2，得到 %d", result.BranchPoint)
	}
	if result.MatchedSession != "" {
		t.Errorf("无完整前缀匹配时 MatchedSession 应为空，得到 %s", result.MatchedSession)
	}
	if len(result.Suffix) != 1 {
		t.Fatalf("期望后缀长度 1，得到 %d", len(result.Suffix))
	}
}

func TestMultipleSessionsSamePath(t *testing.T) {
	trie := New()
	msgs := []Message{userMsg("Hi"), assistantMsg("Hello")}

	mustInsert(t, trie, "sessionA", msgs)
	result := mustInsert(t, trie, "sessionB", msgs)

	// 相同内容不同 session ID：应匹配到 sessionA
	if result.MatchedSession != "sessionA" {
		t.Errorf("期望匹配 sessionA，得到 %s", result.MatchedSession)
	}
	if !result.IsExactMatch {
		t.Error("相同内容应为精确匹配")
	}
	if trie.SessionCount() != 2 {
		t.Errorf("期望 2 个 session，得到 %d", trie.SessionCount())
	}
}

func TestLongestPrefixMatch(t *testing.T) {
	trie := New()
	short := []Message{userMsg("Hi"), assistantMsg("Hello")}
	long := []Message{userMsg("Hi"), assistantMsg("Hello"), userMsg("How?"), assistantMsg("Fine")}
	input := []Message{userMsg("Hi"), assistantMsg("Hello"), userMsg("How?"), assistantMsg("Fine"), userMsg("Thanks")}

	mustInsert(t, trie, "short", short)
	mustInsert(t, trie, "long", long)

	result := mustMatch(t, trie, input)
	if result.MatchedSession != "long" {
		t.Errorf("期望匹配 long（最长前缀），得到 %s", result.MatchedSession)
	}
	if result.MatchedLen != 4 {
		t.Errorf("期望匹配长度 4，得到 %d", result.MatchedLen)
	}
}

func TestNoCommonPrefix(t *testing.T) {
	trie := New()
	mustInsert(t, trie, "sessionA", []Message{userMsg("Hello")})

	result := mustMatch(t, trie, []Message{userMsg("Goodbye")})
	if result.MatchedSession != "" {
		t.Error("无公共前缀时 MatchedSession 应为空")
	}
	if result.CommonPrefixLen != 0 {
		t.Errorf("期望公共前缀长度 0，得到 %d", result.CommonPrefixLen)
	}
	if len(result.Suffix) != 1 {
		t.Errorf("期望后缀为整个输入，长度 1，得到 %d", len(result.Suffix))
	}
}

func TestEmptySequence(t *testing.T) {
	trie := New()
	result, err := trie.Insert("sessionA", []Message{})
	if err != nil {
		t.Fatal(err)
	}
	if result.BranchPoint != -1 {
		t.Errorf("空序列 BranchPoint 应为 -1，得到 %d", result.BranchPoint)
	}
}

// --- 字段策略测试 ---

func TestFieldPolicyDecorativeReasoning(t *testing.T) {
	policy := DefaultFieldPolicy()
	trie := New(WithFieldPolicy(policy))

	msgWithReasoning := Message{
		"type":      "assistant",
		"role":      "assistant",
		"content":   "Hello",
		"reasoning": "Let me think about this...",
	}
	msgWithoutReasoning := Message{
		"type":      "assistant",
		"role":      "assistant",
		"content":   "Hello",
		"reasoning": "Different reasoning text",
	}

	mustInsert(t, trie, "sessionA", []Message{userMsg("Hi"), msgWithReasoning})

	// 相同 content 但不同 reasoning 的消息应匹配（reasoning 是修饰属性）
	result := mustMatch(t, trie, []Message{userMsg("Hi"), msgWithoutReasoning})
	if !result.IsExactMatch {
		t.Error("不同 reasoning 的相同内容应匹配（reasoning 是修饰属性）")
	}
}

func TestFieldPolicyNestedToolCallID(t *testing.T) {
	policy := DefaultFieldPolicy()
	trie := New(WithFieldPolicy(policy))

	// tool_calls 中的 id 是修饰属性，name 和 arguments 是内容
	msgWithID1 := assistantWithToolMsg("", "read", `{"path":"foo"}`, "call_abc")
	msgWithID2 := assistantWithToolMsg("", "read", `{"path":"foo"}`, "call_xyz")

	mustInsert(t, trie, "sessionA", []Message{userMsg("read foo"), msgWithID1})

	// 不同 ID 但相同 name+arguments 应匹配
	result := mustMatch(t, trie, []Message{userMsg("read foo"), msgWithID2})
	if !result.IsExactMatch {
		t.Error("不同 tool_call ID 的相同调用应匹配（id 是修饰属性）")
	}
}

func TestFieldPolicyToolCallArgumentsDifference(t *testing.T) {
	policy := DefaultFieldPolicy()
	trie := New(WithFieldPolicy(policy))

	msgArgs1 := assistantWithToolMsg("", "read", `{"path":"foo"}`, "call_1")
	msgArgs2 := assistantWithToolMsg("", "read", `{"path":"bar"}`, "call_1")

	mustInsert(t, trie, "sessionA", []Message{userMsg("read"), msgArgs1})

	// 不同 arguments 不应匹配
	result := mustMatch(t, trie, []Message{userMsg("read"), msgArgs2})
	if result.IsExactMatch {
		t.Error("不同 arguments 不应精确匹配")
	}
}

// --- OpenAI 转换器测试 ---

func TestConvertOpenAIMessages(t *testing.T) {
	input := []map[string]any{
		{"role": "system", "content": "You are helpful."},
		{"role": "user", "content": "Hi"},
		{
			"role":    "assistant",
			"content": "Let me check",
			"tool_calls": []any{
				map[string]any{
					"id":   "call_1",
					"type": "function",
					"function": map[string]any{
						"name":      "read",
						"arguments": `{"path":"foo"}`,
					},
				},
			},
		},
		{"role": "tool", "content": "file content", "tool_call_id": "call_1"},
	}

	msgs := ConvertOpenAIMessages(input)

	if len(msgs) != 4 {
		t.Fatalf("期望 4 条消息，得到 %d", len(msgs))
	}

	// system 消息
	if msgs[0].Type() != "system" {
		t.Errorf("消息 0 类型应为 system，得到 %s", msgs[0].Type())
	}

	// assistant 消息应有扁平化 tool_calls
	assistantDoc := msgs[2]
	tcs, ok := assistantDoc["tool_calls"].([]map[string]any)
	if !ok {
		t.Fatal("assistant 消息应有 tool_calls")
	}
	if len(tcs) != 1 {
		t.Fatalf("期望 1 个 tool_call，得到 %d", len(tcs))
	}
	if tcs[0]["name"] != "read" {
		t.Errorf("期望 tool name=read，得到 %v", tcs[0]["name"])
	}
	if tcs[0]["arguments"] != `{"path":"foo"}` {
		t.Errorf("期望 arguments={\"path\":\"foo\"}，得到 %v", tcs[0]["arguments"])
	}

	// tool 消息 → type 应为 tool_result
	if msgs[3].Type() != "tool_result" {
		t.Errorf("tool 消息类型应为 tool_result，得到 %s", msgs[3].Type())
	}
}

// --- Claude 转换器测试 ---

func TestConvertClaudeMessages(t *testing.T) {
	input := []map[string]any{
		{
			"role":    "user",
			"content": "Hi",
		},
		{
			"role": "assistant",
			"content": []any{
				map[string]any{"type": "text", "text": "Let me check"},
				map[string]any{
					"type":  "tool_use",
					"id":    "toolu_01",
					"name":  "read",
					"input": map[string]any{"path": "foo"},
				},
			},
		},
		{
			"role": "user",
			"content": []any{
				map[string]any{
					"type":        "tool_result",
					"tool_use_id": "toolu_01",
					"content":     "file content",
				},
				map[string]any{"type": "text", "text": "What about bar?"},
			},
		},
	}

	msgs := ConvertClaudeMessages(input, "You are helpful.")

	// system + user + assistant + tool_result + user = 5
	if len(msgs) != 5 {
		t.Fatalf("期望 5 条消息（含 system），得到 %d", len(msgs))
	}

	// system 消息
	if msgs[0].Type() != "system" {
		t.Errorf("消息 0 应为 system，得到 %s", msgs[0].Type())
	}
	if msgs[0].Content() != "You are helpful." {
		t.Errorf("system content 不匹配: %s", msgs[0].Content())
	}

	// assistant 消息应有 tool_calls
	assistantDoc := msgs[2]
	if assistantDoc.Type() != "assistant" {
		t.Errorf("消息 2 应为 assistant，得到 %s", assistantDoc.Type())
	}
	tcs, ok := assistantDoc["tool_calls"].([]map[string]any)
	if !ok || len(tcs) != 1 {
		t.Fatalf("assistant 应有 1 个 tool_call")
	}
	if tcs[0]["name"] != "read" {
		t.Errorf("期望 name=read，得到 %v", tcs[0]["name"])
	}

	// tool_result 消息（从 user 消息拆分出来）
	if msgs[3].Type() != "tool_result" {
		t.Errorf("消息 3 应为 tool_result，得到 %s", msgs[3].Type())
	}
	if msgs[3].ToolCallID() != "toolu_01" {
		t.Errorf("期望 tool_call_id=toolu_01，得到 %s", msgs[3].ToolCallID())
	}

	// 拆分后的 user 消息
	if msgs[4].Type() != "user" {
		t.Errorf("消息 4 应为 user，得到 %s", msgs[4].Type())
	}
	if msgs[4].Content() != "What about bar?" {
		t.Errorf("期望 content=What about bar?，得到 %s", msgs[4].Content())
	}
}

// --- 跨格式匹配测试 ---

func TestCrossFormatMatch(t *testing.T) {
	policy := DefaultFieldPolicy()
	trie := New(WithFieldPolicy(policy))

	// 用 OpenAI 格式插入
	openAIMsgs := ConvertOpenAIMessages([]map[string]any{
		{"role": "system", "content": "You are helpful."},
		{"role": "user", "content": "你好"},
		{"role": "assistant", "content": "你好！"},
	})
	mustInsert(t, trie, "openai_session", openAIMsgs)

	// 用 Claude 格式匹配（相同对话内容）
	claudeMsgs := ConvertClaudeMessages([]map[string]any{
		{"role": "user", "content": "你好"},
		{"role": "assistant", "content": []any{
			map[string]any{"type": "text", "text": "你好！"},
		}},
	}, "You are helpful.")

	// 追加一条新消息
	claudeMsgs = append(claudeMsgs, userMsg("天气怎么样？"))

	result := mustMatch(t, trie, claudeMsgs)
	if result.MatchedSession != "openai_session" {
		t.Errorf("跨格式匹配应找到 openai_session，得到 %s（matchedLen=%d, commonPrefix=%d）",
			result.MatchedSession, result.MatchedLen, result.CommonPrefixLen)
	}
	if len(result.Suffix) != 1 {
		t.Errorf("期望后缀长度 1，得到 %d", len(result.Suffix))
	}
}

// --- Remove 和 FindVariants 测试 ---

func TestRemoveSession(t *testing.T) {
	trie := New()
	msgs := []Message{userMsg("Hi"), assistantMsg("Hello")}

	mustInsert(t, trie, "sessionA", msgs)
	mustInsert(t, trie, "sessionB", msgs)

	if trie.SessionCount() != 2 {
		t.Fatalf("期望 2 个 session，得到 %d", trie.SessionCount())
	}

	removed := trie.Remove("sessionA")
	if !removed {
		t.Error("应成功移除 sessionA")
	}
	if trie.SessionCount() != 1 {
		t.Errorf("移除后应剩 1 个 session，得到 %d", trie.SessionCount())
	}

	// sessionB 仍可匹配
	result := mustMatch(t, trie, msgs)
	if result.MatchedSession != "sessionB" {
		t.Errorf("移除 sessionA 后应匹配 sessionB，得到 %s", result.MatchedSession)
	}
}

func TestFindVariants(t *testing.T) {
	trie := New()
	seqA := []Message{userMsg("Hi"), assistantMsg("Hello"), userMsg("How are you?")}
	seqB := []Message{userMsg("Hi"), assistantMsg("Hello"), userMsg("What's your name?")}
	seqC := []Message{userMsg("Hi"), assistantMsg("Hello"), userMsg("How are you?"), assistantMsg("I'm fine")}

	mustInsert(t, trie, "A", seqA)
	mustInsert(t, trie, "B", seqB)
	mustInsert(t, trie, "C", seqC)

	variants := trie.FindVariants("A")
	// B 共享前 2 条消息（深度 2），C 共享前 3 条消息（深度 3）
	if variants["B"] != 2 {
		t.Errorf("期望 B 共享前缀长度 2，得到 %d", variants["B"])
	}
	if variants["C"] != 3 {
		t.Errorf("期望 C 共享前缀长度 3，得到 %d", variants["C"])
	}
}

// --- bbolt 存储测试 ---

func TestBoltStorage(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	storage, err := NewBoltStorage(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer storage.Close()

	policy := DefaultFieldPolicy()
	trie := New(WithFieldPolicy(policy), WithStorage(storage))

	msgs := []Message{userMsg("Hi"), assistantMsg("Hello")}
	mustInsert(t, trie, "sessionA", msgs)

	// 从存储重建
	trie2 := New(WithFieldPolicy(policy), WithStorage(storage))
	if err := trie2.LoadFromStorage(); err != nil {
		t.Fatal(err)
	}

	result := mustMatch(t, trie2, msgs)
	if result.MatchedSession != "sessionA" {
		t.Errorf("从存储重建后应匹配 sessionA，得到 %s", result.MatchedSession)
	}
}

// --- 辅助函数 ---

func mustInsert(t *testing.T, trie *Trie, sessionID string, msgs []Message) *MatchResult {
	t.Helper()
	result, err := trie.Insert(sessionID, msgs)
	if err != nil {
		t.Fatalf("Insert 失败 (session=%s): %v", sessionID, err)
	}
	return result
}

func mustMatch(t *testing.T, trie *Trie, msgs []Message) *MatchResult {
	t.Helper()
	result, err := trie.Match(msgs)
	if err != nil {
		t.Fatalf("Match 失败: %v", err)
	}
	return result
}
