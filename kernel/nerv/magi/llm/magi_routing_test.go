package llm

// 单工具路由（MCP 风格）单元测试：
//   - 请求方向：applyMagiToolRouting 把真实工具列表 → [magi_tool] + 尾部 <tool_list> 消息；
//   - 响应方向：ResolveMagiToolCall 把 magi_tool 调用解析回真实工具名与参数；
//   - StreamResult：ResolveStreamResultMagiTools 把聚合结果中的 magi_tool 条目重新归档到真实工具名。

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/sashabaranov/go-openai"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	utilstream "github.com/siyuan-note/siyuan/kernel/util/stream"
)

func testTool(name, description string) openai.Tool {
	return openai.Tool{
		Type: openai.ToolTypeFunction,
		Function: &openai.FunctionDefinition{
			Name:        name,
			Description: description,
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"q": map[string]interface{}{"type": "string"},
				},
			},
		},
	}
}

// TestApplyMagiToolRouting_ToolsFixedAndTailList 验证：
//  1. tools 字段被替换为唯一 magi_tool（字节级固定）；
//  2. 真实工具列表作为 <tool_list> user 消息追加到 messages 尾部。
func TestApplyMagiToolRouting_ToolsFixedAndTailList(t *testing.T) {
	messages := []openai.ChatCompletionMessage{
		{Role: openai.ChatMessageRoleSystem, Content: "system"},
		{Role: openai.ChatMessageRoleUser, Content: "user"},
	}
	tools := []openai.Tool{
		testTool("search_notes_by_keywords", "搜索笔记"),
		testTool("write_diary_entry", "写日记"),
	}

	msgs, effectiveTools := applyMagiToolRouting(messages, tools)

	// tools 固定为唯一 magi_tool
	if len(effectiveTools) != 1 {
		t.Fatalf("tools 应固定为 1 个 magi_tool，实际 %d 个", len(effectiveTools))
	}
	if effectiveTools[0].Function == nil || effectiveTools[0].Function.Name != config.MagiToolName {
		t.Fatalf("唯一工具名 = %v, want %s", effectiveTools[0].Function, config.MagiToolName)
	}

	// 尾部追加了 <tool_list> user 消息
	if len(msgs) != len(messages)+1 {
		t.Fatalf("messages 应追加 1 条 tool_list，实际 %d → %d", len(messages), len(msgs))
	}
	tail := msgs[len(msgs)-1]
	if tail.Role != openai.ChatMessageRoleUser {
		t.Fatalf("tool_list 消息角色 = %s, want user", tail.Role)
	}
	if !strings.Contains(tail.Content, "<tool_list>") {
		t.Fatalf("尾部消息缺少 <tool_list> 标记: %q", tail.Content)
	}
	for _, name := range []string{"search_notes_by_keywords", "write_diary_entry"} {
		if !strings.Contains(tail.Content, name) {
			t.Fatalf("tool_list 未包含真实工具 %s: %q", name, tail.Content)
		}
	}

	// 前缀（原 messages）必须逐字节不变
	for i, msg := range messages {
		if msgs[i].Role != msg.Role || msgs[i].Content != msg.Content {
			t.Fatalf("前缀第 %d 条被修改: %+v vs %+v", i, msgs[i], msg)
		}
	}
}

// TestApplyMagiToolRouting_NoToolsKeepsFixedWrapper 验证：逻辑上无工具时仍保持固定
// magi_tool，仅由尾部空 tool_list 表达本请求没有可调用工具。
func TestApplyMagiToolRouting_NoToolsKeepsFixedWrapper(t *testing.T) {
	messages := []openai.ChatCompletionMessage{{Role: openai.ChatMessageRoleUser, Content: "x"}}
	msgs, tools := applyMagiToolRouting(messages, nil)
	if len(msgs) != len(messages)+1 {
		t.Fatalf("无工具时也应追加空 tool_list: msgs=%d", len(msgs))
	}
	if len(tools) != 1 || tools[0].Function == nil || tools[0].Function.Name != config.MagiToolName {
		t.Fatalf("无工具时 tools 仍应固定为 magi_tool: %+v", tools)
	}
	tail := msgs[len(msgs)-1]
	if tail.Role != openai.ChatMessageRoleUser || !strings.Contains(tail.Content, "[]") {
		t.Fatalf("尾部应为 user 空工具列表: %+v", tail)
	}
	if !strings.Contains(tail.Content, "不得调用") {
		t.Fatalf("空工具列表缺少禁止调用约束: %q", tail.Content)
	}
}

func TestApplyMagiToolRoutingForClaude_NoToolsKeepsFixedWrapper(t *testing.T) {
	messages := []openai.ChatCompletionMessage{{Role: openai.ChatMessageRoleUser, Content: "x"}}
	msgs, tools := applyMagiToolRoutingForClaude(messages, nil)
	if len(msgs) != len(messages)+1 || len(tools) != 1 {
		t.Fatalf("Claude 空工具请求也应保持固定包装工具: msgs=%d tools=%d", len(msgs), len(tools))
	}
	if tools[0].Function == nil || tools[0].Function.Name != config.MagiToolName {
		t.Fatalf("Claude 包装工具不稳定: %+v", tools)
	}
	if tail := msgs[len(msgs)-1]; tail.Role != openai.ChatMessageRoleUser || !strings.Contains(tail.Content, "[]") {
		t.Fatalf("Claude 尾部应为 user 空工具列表: %+v", tail)
	}
}

func TestRoutedMagiToolChoice_NoToolsUsesNone(t *testing.T) {
	if got := routedMagiToolChoice(nil, nil); got != "none" {
		t.Fatalf("逻辑无工具请求 tool_choice=%v, want none", got)
	}
	if got := routedMagiToolChoice([]openai.Tool{testTool("search", "")}, "required"); got != "required" {
		t.Fatalf("有工具请求应保留原 tool_choice: %v", got)
	}
}

func TestRejectUnexpectedToolCalls_NoLogicalTools(t *testing.T) {
	calls := []types.ToolCall{{Function: types.ToolCallFunction{Name: config.MagiToolName}}}
	if err := rejectUnexpectedToolCalls(nil, calls); err == nil {
		t.Fatal("逻辑无工具请求中的工具调用应被拒绝")
	}
	if err := rejectUnexpectedToolCalls([]openai.Tool{testTool("search", "")}, calls); err != nil {
		t.Fatalf("有工具请求不应被拒绝: %v", err)
	}
}

// TestResolveMagiToolCall 验证 magi_tool 调用解析回真实工具名与参数。
func TestResolveMagiToolCall(t *testing.T) {
	call := types.ToolCall{
		ID:   "call_1",
		Type: "function",
		Function: types.ToolCallFunction{
			Name:      config.MagiToolName,
			Arguments: `{"tool_name":"write_diary_entry","arguments":{"content":"测试"}}`,
		},
	}
	resolved, err := ResolveMagiToolCall(call)
	if err != nil {
		t.Fatalf("ResolveMagiToolCall: %v", err)
	}
	if resolved.Function.Name != "write_diary_entry" {
		t.Fatalf("解析后工具名 = %s, want write_diary_entry", resolved.Function.Name)
	}
	if resolved.Function.Arguments != `{"content":"测试"}` {
		t.Fatalf("解析后参数 = %s, want {\"content\":\"测试\"}", resolved.Function.Arguments)
	}
	if resolved.ID != call.ID {
		t.Fatalf("ID 不应变化: %s", resolved.ID)
	}
}

// TestResolveMagiToolCall_NonMagiPassThrough 验证：非 magi_tool 调用原样返回。
func TestResolveMagiToolCall_NonMagiPassThrough(t *testing.T) {
	call := types.ToolCall{
		Function: types.ToolCallFunction{Name: "vote", Arguments: `{"decision":"批准"}`},
	}
	resolved, err := ResolveMagiToolCall(call)
	if err != nil {
		t.Fatalf("ResolveMagiToolCall: %v", err)
	}
	if resolved.Function.Name != "vote" || resolved.Function.Arguments != `{"decision":"批准"}` {
		t.Fatalf("非 magi_tool 调用应原样返回: %+v", resolved)
	}
}

// TestResolveMagiToolCall_ArgumentsObject 验证：arguments 为对象时还原为 JSON 字符串。
func TestResolveMagiToolCall_ArgumentsObject(t *testing.T) {
	call := types.ToolCall{
		Function: types.ToolCallFunction{
			Name:      config.MagiToolName,
			Arguments: `{"tool_name":"vote","arguments":{"decision":"批准","reason":"合理"}}`,
		},
	}
	resolved, err := ResolveMagiToolCall(call)
	if err != nil {
		t.Fatalf("ResolveMagiToolCall: %v", err)
	}
	if resolved.Function.Name != "vote" {
		t.Fatalf("工具名 = %s, want vote", resolved.Function.Name)
	}
	var args map[string]string
	if err := json.Unmarshal([]byte(resolved.Function.Arguments), &args); err != nil {
		t.Fatalf("解析后参数不是合法 JSON: %v (%s)", err, resolved.Function.Arguments)
	}
	if args["decision"] != "批准" {
		t.Fatalf("decision = %s, want 批准", args["decision"])
	}
}

// TestResolveStreamResultMagiTools 验证：聚合结果中的 magi_tool 条目重新归档到真实工具名。
func TestResolveStreamResultMagiTools(t *testing.T) {
	result := &utilstream.StreamResult{
		HasToolCalls:  true,
		ToolCallNames: []string{config.MagiToolName},
		ToolArgumentsByName: map[string][]string{
			config.MagiToolName: {
				`{"tool_name":"wanna_speak_start","arguments":{}}`,
				`{"tool_name":"wanna_speak_continue","arguments":{"content":"你好"}}`,
			},
		},
	}
	ResolveStreamResultMagiTools(result)
	if err := ResolveStreamResultMagiTools(result); err != nil {
		t.Fatalf("ResolveStreamResultMagiTools: %v", err)
	}

	if result.ToolArgumentsByName[config.MagiToolName] != nil {
		t.Fatalf("magi_tool 条目应被移除: %v", result.ToolArgumentsByName[config.MagiToolName])
	}
	if args := result.ToolArgumentsByName["wanna_speak_start"]; len(args) != 1 {
		t.Fatalf("wanna_speak_start 参数 = %v, want 1 条", args)
	}
	if args := result.ToolArgumentsByName["wanna_speak_continue"]; len(args) != 1 || args[0] != `{"content":"你好"}` {
		t.Fatalf("wanna_speak_continue 参数 = %v", args)
	}
	names := result.ToolCallNames
	if len(names) != 2 {
		t.Fatalf("ToolCallNames = %v, want [wanna_speak_start wanna_speak_continue]", names)
	}
	found := map[string]bool{}
	for _, n := range names {
		found[n] = true
	}
	if !found["wanna_speak_start"] || !found["wanna_speak_continue"] {
		t.Fatalf("ToolCallNames 缺少真实工具名: %v", names)
	}
}

// TestResolveStreamResultMagiTools_NoMagi 验证：无 magi_tool 条目时原样保留。
func TestResolveStreamResultMagiTools_NoMagi(t *testing.T) {
	result := &utilstream.StreamResult{
		ToolCallNames:       []string{"vote"},
		ToolArgumentsByName: map[string][]string{"vote": {`{"decision":"批准"}`}},
	}
	if err := ResolveStreamResultMagiTools(result); err != nil {
		t.Fatalf("ResolveStreamResultMagiTools: %v", err)
	}
	if result.ToolCallNames[0] != "vote" || result.ToolArgumentsByName["vote"][0] != `{"decision":"批准"}` {
		t.Fatalf("无 magi_tool 时应原样保留: %+v", result)
	}
}
