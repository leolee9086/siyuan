package stream

import (
	"encoding/json"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/util/stream"
)

const (
	// TrinitySpeakToolName Trinity speak工具名称（对齐前端 trinity.toolset.ts:10）
	TrinitySpeakToolName = "speak"
	// DeliberationSignalToolName 审慎决策信号工具名称
	DeliberationSignalToolName = "deliberation_signal"
)

// SpeakToolHandler speak 工具处理器
type SpeakToolHandler struct {
	toolCallsByIndex   map[int]*toolCallState
	publicContent      string
	internalMessages   []string
	hasPublicSpeakCall bool
}

type toolCallState struct {
	name      string
	arguments string
}

// NewSpeakToolHandler 创建 speak 工具处理器
func NewSpeakToolHandler() *SpeakToolHandler {
	return &SpeakToolHandler{
		toolCallsByIndex: make(map[int]*toolCallState),
		internalMessages: []string{},
	}
}

// OnContent 处理文本内容增量
func (h *SpeakToolHandler) OnContent(content string) {
	// speak handler 不处理文本内容
}

// OnToolCall 处理工具调用增量
func (h *SpeakToolHandler) OnToolCall(tc *stream.ToolCallDelta) {
	index := tc.Index

	// 获取或创建状态
	state, exists := h.toolCallsByIndex[index]
	if !exists {
		state = &toolCallState{}
		h.toolCallsByIndex[index] = state
	}

	// 累积工具名称和参数
	if tc.Function != nil {
		if tc.Function.Name != "" {
			state.name = tc.Function.Name
		}
		if tc.Function.Arguments != "" {
			state.arguments += tc.Function.Arguments
		}
	}
}

// OnComplete 处理完成时调用
func (h *SpeakToolHandler) OnComplete(result *stream.StreamResult) {
	// 按 index 排序处理
	var indexes []int
	for idx := range h.toolCallsByIndex {
		indexes = append(indexes, idx)
	}
	for i := 0; i < len(indexes); i++ {
		for j := i + 1; j < len(indexes); j++ {
			if indexes[i] > indexes[j] {
				indexes[i], indexes[j] = indexes[j], indexes[i]
			}
		}
	}

	// 解析 speak 工具调用
	for _, index := range indexes {
		state := h.toolCallsByIndex[index]
		if state.name != TrinitySpeakToolName {
			continue
		}

		var payload types.TrinitySpeakTool
		if err := json.Unmarshal([]byte(state.arguments), &payload); err != nil {
			continue
		}

		if payload.Channel == "internal" {
			h.internalMessages = append(h.internalMessages, payload.Content)
		} else {
			h.publicContent = payload.Content
			h.hasPublicSpeakCall = true
		}
	}

	// 更新结果中的内部消息
	result.InternalToolMessages = h.internalMessages
}

// GetPublicContent 获取公开内容
func (h *SpeakToolHandler) GetPublicContent() string {
	return h.publicContent
}

// GetInternalMessages 获取内部消息
func (h *SpeakToolHandler) GetInternalMessages() []string {
	return h.internalMessages
}

// HasPublicSpeakCall 是否有公开 speak 调用
func (h *SpeakToolHandler) HasPublicSpeakCall() bool {
	return h.hasPublicSpeakCall
}

// DeliberationHandler deliberation_signal 处理器
type DeliberationHandler struct {
	toolCallsByIndex     map[int]*toolCallState
	requiresDeliberation bool
	reason               string
	hasSignal            bool
}

// NewDeliberationHandler 创建 deliberation_signal 处理器
func NewDeliberationHandler() *DeliberationHandler {
	return &DeliberationHandler{
		toolCallsByIndex: make(map[int]*toolCallState),
	}
}

// OnContent 处理文本内容增量
func (h *DeliberationHandler) OnContent(content string) {
	// deliberation handler 不处理文本内容
}

// OnToolCall 处理工具调用增量
func (h *DeliberationHandler) OnToolCall(tc *stream.ToolCallDelta) {
	index := tc.Index

	// 获取或创建状态
	state, exists := h.toolCallsByIndex[index]
	if !exists {
		state = &toolCallState{}
		h.toolCallsByIndex[index] = state
	}

	// 累积工具名称和参数
	if tc.Function != nil {
		if tc.Function.Name != "" {
			state.name = tc.Function.Name
		}
		if tc.Function.Arguments != "" {
			state.arguments += tc.Function.Arguments
		}
	}
}

// OnComplete 处理完成时调用
func (h *DeliberationHandler) OnComplete(result *stream.StreamResult) {
	// 查找 deliberation_signal 工具调用
	for _, state := range h.toolCallsByIndex {
		if state.name != DeliberationSignalToolName {
			continue
		}

		var signal types.DeliberationSignal
		if err := json.Unmarshal([]byte(state.arguments), &signal); err != nil {
			continue
		}

		h.hasSignal = true
		h.requiresDeliberation = signal.RequiresDeliberation
		h.reason = signal.Reason
		break
	}
}

// GetSignal 获取 deliberation 信号
func (h *DeliberationHandler) GetSignal() *types.DeliberationSignal {
	if !h.hasSignal {
		return nil
	}
	return &types.DeliberationSignal{
		RequiresDeliberation: h.requiresDeliberation,
		Reason:               h.reason,
	}
}

// HasSignal 是否有 deliberation 信号
func (h *DeliberationHandler) HasSignal() bool {
	return h.hasSignal
}

// RequiresDeliberation 是否需要审慎决策
func (h *DeliberationHandler) RequiresDeliberation() bool {
	return h.requiresDeliberation
}

// GetReason 获取原因
func (h *DeliberationHandler) GetReason() string {
	return h.reason
}
