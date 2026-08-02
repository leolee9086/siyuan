// Package agent 提供常规 AI agent 运行时。
// 本文件：agent 侧单工具路由（包装工具模式）——聊天序列变换的一部分。
//
// 与 magi 一致：请求 tools 字段固定为一个包装工具（名称使用 chatseqtrie 提供的
// 通用默认值 DefaultWrapperToolName，两侧完全一致，不各自发明名字），实际工具名
// 通过参数字段指定；真实工具列表作为 <tool_list> 动态区段消息追加到消息序列尾部
// （动态内容后缀化，前缀缓存友好）。纯逻辑复用 packages/chatseqtrie
// （RenderToolList / ParseWrappedToolCall / Segment），本文件只做 agent 的类型适配。
package agent

import (
	"strings"

	"github.com/sashabaranov/go-openai"

	"s-forge.local/chatseqtrie"
)

// agentTool 返回 agent 的包装工具（openai.Tool 形式）。
// 名称与参数 schema 使用 chatseqtrie 通用默认值，与 magi 侧完全一致。
func agentTool() openai.Tool {
	return openai.Tool{
		Type: openai.ToolTypeFunction,
		Function: &openai.FunctionDefinition{
			Name:        chatseqtrie.DefaultWrapperToolName,
			Description: "调用 SiYuan agent 实际工具。工具名由 tool_name 指定，参数由 arguments 传递；可用工具及其参数 schema 见消息中的工具列表。",
			Parameters:  chatseqtrie.DefaultWrapperSchema(),
		},
	}
}

// applyAgentToolRouting 应用单工具路由变换：
//  1. 真实工具列表渲染为 <tool_list> 动态区段消息追加到 messages 尾部（不修改原切片）；
//  2. tools 字段替换为包装工具（字节级固定）。
//
// 动态区段目前仅 tool_list 块；未来 agent 的其他动态内容（status、runtime_clock 等）
// 在此挂载：seg.Add("<kind>", "<content>")——结构上已预留。
func applyAgentToolRouting(messages []openai.ChatCompletionMessage, tools []openai.Tool) ([]openai.ChatCompletionMessage, []openai.Tool) {
	if len(tools) == 0 {
		return messages, tools
	}
	briefs := make([]map[string]any, 0, len(tools))
	for _, t := range tools {
		if t.Function == nil || strings.TrimSpace(t.Function.Name) == "" {
			continue
		}
		brief := map[string]any{
			"name":        t.Function.Name,
			"description": t.Function.Description,
		}
		if params, ok := t.Function.Parameters.(map[string]any); ok && len(params) > 0 {
			brief["parameters"] = params
		}
		briefs = append(briefs, brief)
	}
	seg := chatseqtrie.NewSegment()
	seg.Add("tool_list", chatseqtrie.RenderToolList(briefs))
	dynMsg := openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleSystem,
		Content: seg.Render(),
	}
	msgs := make([]openai.ChatCompletionMessage, 0, len(messages)+1)
	msgs = append(msgs, messages...)
	msgs = append(msgs, dynMsg)
	return msgs, []openai.Tool{agentTool()}
}

// ResolveAgentToolCall 把包装工具调用解析回真实工具名与参数。
//   - 若 Function.Name != 包装工具名，原样返回（兼容未启用单工具路由的请求）；
//   - 若 Function.Name == 包装工具名，解析 arguments 的工具名/参数两字段，替换为真实值。
//
// 包装工具名与字段名使用 chatseqtrie 通用默认值，与 magi 侧完全一致。
func ResolveAgentToolCall(call openai.ToolCall) (openai.ToolCall, error) {
	if strings.TrimSpace(call.Function.Name) != chatseqtrie.DefaultWrapperToolName {
		return call, nil
	}
	toolName, realArgs, err := chatseqtrie.ParseWrappedToolCall(call.Function.Arguments, chatseqtrie.DefaultToolNameField, chatseqtrie.DefaultToolArgsField)
	if err != nil {
		return call, err
	}
	call.Function.Name = toolName
	call.Function.Arguments = realArgs
	return call, nil
}
