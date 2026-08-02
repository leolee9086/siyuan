// Package chatseqtrie 提供通用聊天序列前缀树构建与匹配能力。
// 本文件：工具路由变换（包装工具模式）——聊天序列变换的一部分。
//
// 包装工具模式（通用）：
//   - 请求侧：tools 字段只注册一个「包装工具」，其参数结构为
//     {<nameField>: 真实工具名, <argsField>: 真实参数}；真实工具列表作为
//     尾部动态区段消息注入（见 Segment）。这样 tools 字段字节级固定（前缀缓存最前部稳定），
//     工具集变化只影响尾部动态区段。
//   - 响应侧：把模型返回的包装工具调用解析回真实工具名与参数。
//
// 本文件提供默认约定（DefaultWrapperToolName / DefaultToolNameField / DefaultToolArgsField），
// 所有调用方（magi / agent）统一使用这些默认值——两侧传完全相同的名称，不要各自发明；
// 同时保留参数化能力（ParseWrappedToolCall 接受字段名参数），确需自定义时可覆盖。
// 本文件只提供格式无关的纯逻辑（map/string），不依赖任何具体 SDK、不包含任何业务限定。
package chatseqtrie

import (
	"encoding/json"
	"strings"
)

// 工具路由默认约定：所有调用方（magi / agent）统一使用，保证两侧名称完全一致。
const (
	// DefaultWrapperToolName 默认包装工具名。
	DefaultWrapperToolName = "tool_call"
	// DefaultToolNameField 默认真实工具名字段。
	DefaultToolNameField = "tool_name"
	// DefaultToolArgsField 默认真实参数字段。
	DefaultToolArgsField = "arguments"
)

// DefaultWrapperSchema 返回默认包装工具的参数 JSON Schema（tool_name + arguments）。
// 与 DefaultWrapperToolName / DefaultToolNameField / DefaultToolArgsField 配套使用。
func DefaultWrapperSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			DefaultToolNameField: map[string]any{
				"type":        "string",
				"description": "要调用的实际工具名（须从消息中的 <tool_list> 工具列表中选择）",
			},
			DefaultToolArgsField: map[string]any{
				"type":        "object",
				"description": "目标工具的参数对象，与工具列表中该工具的 parameters schema 一致",
			},
		},
		"required": []string{DefaultToolNameField, DefaultToolArgsField},
	}
}

// RenderToolList 把真实工具列表渲染为 JSON 数组文本（仅 name/description/parameters，
// 不含运行元数据）。tools 为格式无关的工具定义列表，每项至少含 name（string）字段，
// 可选 description / parameters。返回的文本不含任何包裹标签——由调用方决定放进
// 动态区段（Segment.Add）还是直接包裹。
func RenderToolList(tools []map[string]any) string {
	type toolBrief struct {
		Name        string         `json:"name"`
		Description string         `json:"description"`
		Parameters  map[string]any `json:"parameters,omitempty"`
	}
	briefs := make([]toolBrief, 0, len(tools))
	for _, t := range tools {
		if t == nil {
			continue
		}
		name, _ := t["name"].(string)
		if strings.TrimSpace(name) == "" {
			continue
		}
		brief := toolBrief{Name: strings.TrimSpace(name)}
		if desc, ok := t["description"].(string); ok {
			brief.Description = strings.TrimSpace(desc)
		}
		if params, ok := t["parameters"].(map[string]any); ok && len(params) > 0 {
			brief.Parameters = params
		}
		briefs = append(briefs, brief)
	}
	data, err := json.MarshalIndent(briefs, "", "  ")
	if err != nil {
		return "[]"
	}
	return string(data)
}

// ParseWrappedToolCall 解析包装工具调用的 arguments。
// 包装工具模式中，模型输出的 arguments 形如
// {<nameField>: "真实工具名", <argsField>: {真实参数} 或 "真实参数JSON字符串"}。
// 本函数把该 arguments 解析回真实工具名与真实参数的 JSON 字符串。
// 任一字段缺失/非法时返回错误（调用方决定重试或按未识别工具兜底）。
// 字段名与包装工具自身名称完全由调用方约定，本函数不做任何业务假设。
func ParseWrappedToolCall(arguments, nameField, argsField string) (toolName, realArguments string, err error) {
	if strings.TrimSpace(nameField) == "" || strings.TrimSpace(argsField) == "" {
		return "", "", &ToolRoutingError{Reason: "包装工具字段名不能为空"}
	}
	var payload map[string]json.RawMessage
	if err := json.Unmarshal([]byte(arguments), &payload); err != nil {
		return "", "", &ToolRoutingError{Reason: "解析包装工具 arguments 失败: " + err.Error()}
	}
	nameRaw, ok := payload[nameField]
	if !ok {
		return "", "", &ToolRoutingError{Reason: "缺少工具名字段 \"" + nameField + "\""}
	}
	var name string
	if err := json.Unmarshal(nameRaw, &name); err != nil {
		return "", "", &ToolRoutingError{Reason: "工具名字段 \"" + nameField + "\" 非法: " + err.Error()}
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return "", "", &ToolRoutingError{Reason: "工具名字段 \"" + nameField + "\" 为空"}
	}

	argsRaw, ok := payload[argsField]
	if !ok || len(argsRaw) == 0 {
		return name, "{}", nil
	}
	// argsField 可能是对象（模型输出）或字符串，统一还原为 JSON 字符串。
	var s string
	if err := json.Unmarshal(argsRaw, &s); err == nil {
		realArguments = s
	} else {
		realArguments = string(argsRaw)
	}
	return name, realArguments, nil
}

// ToolRoutingError 工具路由解析错误。包装为类型便于调用方统一兜底判断。
type ToolRoutingError struct {
	Reason string
}

func (e *ToolRoutingError) Error() string {
	return e.Reason
}
