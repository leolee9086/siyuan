// Package llm 提供MAGI系统的LLM客户端封装。
package llm

// 单工具路由（MCP 风格）：
//   - 请求方向：MAGI 所有请求路径的真实工具列表统一变换为「唯一通用工具 magi_tool」，
//     实际工具名通过参数 tool_name 指定；真实工具列表（名称/描述/参数 schema）作为
//     <tool_list> user 消息追加到 messages 序列**尾部**（动态内容后缀化）。
//   - 效果：tools 字段字节级固定 → 前缀缓存最前部永不变化；工具集变化只影响尾部消息。
//   - 响应方向：模型输出的 magi_tool 调用解析回真实工具名与参数（ResolveMagiToolCall），
//     上层调用方（投票/选举/心跳/avatar）完全无感，仍按真实工具名分发执行。
//
// 工具路由抽离/聚合的纯逻辑位于 packages/chatseqtrie/toolrouting.go（格式无关、零业务硬编码，
// 包装工具名与字段名由调用方约定）；本文件只做 magi 的类型适配（openai.Tool ↔ 通用 map）
// 与字段名约定（tool_name / arguments）。

import (
	"fmt"
	"strings"

	"github.com/sashabaranov/go-openai"

	"s-forge.local/chatseqtrie"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	utilstream "github.com/siyuan-note/siyuan/kernel/util/stream"
)

// magiTool 返回唯一通用工具（openai.Tool 形式），工具名与 schema 定义在 magi/config
// （magi 限定，不进入通用包 chatseqtrie）。
func magiTool() openai.Tool {
	td := config.BuildMagiToolDef()
	return openai.Tool{
		Type: openai.ToolType(td.Type),
		Function: &openai.FunctionDefinition{
			Name:        td.Function.Name,
			Description: td.Function.Description,
			Parameters:  td.Function.Parameters,
		},
	}
}

// buildToolListContent 把真实工具列表序列化为 <tool_list> 文本。
// OpenAI/Anthropic 兼容渠道都作为 user 消息追加到 messages 尾部；
// 该文本是动态内容，只存在于请求快照，不写入历史。
func buildToolListContent(tools []openai.Tool) string {
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
	return "<tool_list>\n" + chatseqtrie.RenderToolList(briefs) + "\n</tool_list>"
}

// buildToolListTailMessage 把真实工具列表序列化为 <tool_list> user 消息。
func buildToolListTailMessage(tools []openai.Tool) openai.ChatCompletionMessage {
	return openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: buildToolListContent(tools),
	}
}

// applyMagiToolRouting 应用单工具路由变换（OpenAI 兼容渠道）：
//  1. 工具列表序列化为 user 消息追加到 messages 尾部（动态内容后缀化）；
//  2. tools 字段替换为唯一 magi_tool（字节级固定）。
//
// 无工具（len(tools)==0）时原样返回，不注入工具列表消息。
func applyMagiToolRouting(messages []openai.ChatCompletionMessage, tools []openai.Tool) ([]openai.ChatCompletionMessage, []openai.Tool) {
	if len(tools) == 0 {
		return messages, tools
	}
	msgs := make([]openai.ChatCompletionMessage, 0, len(messages)+1)
	msgs = append(msgs, messages...)
	msgs = append(msgs, buildToolListTailMessage(tools))
	return msgs, []openai.Tool{magiTool()}
}

// applyMagiToolRoutingForClaude 应用单工具路由变换（Anthropic 兼容渠道）。
// 与 OpenAI 渠道的区别：工具列表作为 **user 消息** 追加到 messages 尾部——
// Anthropic 的 system 字段位于输入序列最前部，动态内容绝不能进 system（否则破坏前缀缓存）；
// user 消息追加到末尾后由 convertOpenAIMessagesToClaude 归一化（同角色合并/末尾追加）。
func applyMagiToolRoutingForClaude(messages []openai.ChatCompletionMessage, tools []openai.Tool) ([]openai.ChatCompletionMessage, []openai.Tool) {
	if len(tools) == 0 {
		return messages, tools
	}
	msgs := make([]openai.ChatCompletionMessage, 0, len(messages)+1)
	msgs = append(msgs, messages...)
	msgs = append(msgs, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleUser,
		Content: buildToolListContent(tools),
	})
	return msgs, []openai.Tool{magiTool()}
}

// ResolveMagiToolCall 将 magi_tool 调用解析为实际工具调用。
//   - 若 Function.Name != magi_tool，原样返回（兼容未启用单工具路由的请求）；
//   - 若 Function.Name == magi_tool，解析 arguments JSON 的 tool_name 与 arguments 字段，
//     替换为真实工具名与参数。
//
// 解析纯逻辑在 chatseqtrie.ParseWrappedToolCall（字段名用 chatseqtrie 通用默认值，
// 与 agent 侧完全一致），本函数只做类型适配。
// 供 llm 同步路径与 coordinator 流式路径共用。
func ResolveMagiToolCall(call types.ToolCall) (types.ToolCall, error) {
	if strings.TrimSpace(call.Function.Name) != config.MagiToolName {
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

// resolveMagiToolCalls 批量解析 magi_tool 调用；任一解析失败即返回错误（调用方决定重试/兜底）。
func resolveMagiToolCalls(calls []types.ToolCall) ([]types.ToolCall, error) {
	if len(calls) == 0 {
		return calls, nil
	}
	resolved := make([]types.ToolCall, len(calls))
	for i, call := range calls {
		r, err := ResolveMagiToolCall(call)
		if err != nil {
			return calls, err
		}
		resolved[i] = r
	}
	return resolved, nil
}

// ResolveStreamResultMagiTools 将 utilstream.Processor 聚合结果中的 magi_tool 条目解析回真实工具名。
// 流式路径中 processor 累积的是原始 delta（Function.Name=magi_tool），GetResult 聚合后
// tool_name 仍嵌套在 arguments 内；上层（buildSageResponse / avatar）按真实工具名查找
// ToolCallNames / ToolArgumentsByName，必须在此解析后使用。
// 解析失败必须返回错误：没有可靠兜底，静默跳过会导致参数丢失、上层按真实名找不到工具。
func ResolveStreamResultMagiTools(result *utilstream.StreamResult) error {
	if result == nil {
		return nil
	}
	magiArgs, ok := result.ToolArgumentsByName[config.MagiToolName]
	if !ok {
		return nil
	}
	// 按真实工具名重新归档参数
	resolved := map[string][]string{}
	for _, raw := range magiArgs {
		toolName, realArgs, err := chatseqtrie.ParseWrappedToolCall(raw, chatseqtrie.DefaultToolNameField, chatseqtrie.DefaultToolArgsField)
		if err != nil {
			return fmt.Errorf("解析 %s 工具参数失败: %w", config.MagiToolName, err)
		}
		resolved[toolName] = append(resolved[toolName], realArgs)
	}
	// 合并非 magi_tool 的已有条目（若模型输出中混有其他工具名）
	for name, argsList := range result.ToolArgumentsByName {
		if name == config.MagiToolName {
			continue
		}
		resolved[name] = append(resolved[name], argsList...)
	}
	result.ToolArgumentsByName = resolved

	// 重建 ToolCallNames（去重）
	names := make([]string, 0, len(resolved))
	for name := range resolved {
		names = append(names, name)
	}
	result.ToolCallNames = names
	result.HasToolCalls = len(names) > 0
	return nil
}
