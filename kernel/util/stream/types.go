// Package stream 提供通用的流式响应处理能力
package stream

// StreamChunk 流式响应的单个 chunk
type StreamChunk struct {
	ID      string         `json:"id"`
	Object  string         `json:"object"`
	Created int64          `json:"created"`
	Model   string         `json:"model"`
	Choices []StreamChoice `json:"choices"`
}

// StreamChoice 流式响应的选择项
type StreamChoice struct {
	Index        int         `json:"index"`
	Delta        StreamDelta `json:"delta"`
	FinishReason *string     `json:"finish_reason"`
	Logprobs     interface{} `json:"logprobs"`
}

// StreamDelta 流式响应的增量数据
type StreamDelta struct {
	Role      string          `json:"role,omitempty"`
	Content   string          `json:"content,omitempty"`
	ToolCalls []ToolCallDelta `json:"tool_calls,omitempty"`
	Refusal   string          `json:"refusal,omitempty"`
}

// ToolCallDelta 工具调用的增量数据
type ToolCallDelta struct {
	Index    int                    `json:"index"`
	ID       string                 `json:"id,omitempty"`
	Type     string                 `json:"type,omitempty"`
	Function *ToolCallFunctionDelta `json:"function,omitempty"`
}

// ToolCallFunctionDelta 工具调用函数的增量数据
type ToolCallFunctionDelta struct {
	Name      string `json:"name,omitempty"`
	Arguments string `json:"arguments,omitempty"`
}

// ToolCall 完整的工具调用
type ToolCall struct {
	Index    int              `json:"index"`
	ID       string           `json:"id"`
	Type     string           `json:"type"`
	Function ToolCallFunction `json:"function"`
}

// ToolCallFunction 工具调用函数
type ToolCallFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

// StreamResult 流式处理的最终结果
type StreamResult struct {
	Content              string              `json:"content"`
	Success              bool                `json:"success"`
	HasToolCalls         bool                `json:"has_tool_calls"`
	ToolCallNames        []string            `json:"tool_call_names,omitempty"`
	ToolArgumentsByName  map[string][]string `json:"tool_arguments_by_name,omitempty"`
	InternalToolMessages []string            `json:"internal_tool_messages,omitempty"`
}
