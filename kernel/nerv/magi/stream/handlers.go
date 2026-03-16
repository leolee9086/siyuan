package stream

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/util/stream"
)

const (
	// TrinitySpeakToolName Trinity speak工具名称（兼容旧版，逐步废弃）。
	TrinitySpeakToolName = config.SpeakToolName
	// TrinitySpeakStartToolName Trinity 对外表达开始工具名称。
	TrinitySpeakStartToolName = config.SpeakStartToolName
	// TrinitySpeakContinueToolName Trinity 对外表达续写工具名称。
	TrinitySpeakContinueToolName = config.SpeakContinueToolName
	// TrinitySpeakStopToolName Trinity 对外表达结束工具名称。
	TrinitySpeakStopToolName = config.SpeakStopToolName
	// TrinitySpeakInternalStartToolName Trinity 内部表达开始工具名称。
	TrinitySpeakInternalStartToolName = config.SpeakInternalStartToolName
	// TrinitySpeakInternalContinueToolName Trinity 内部表达续写工具名称。
	TrinitySpeakInternalContinueToolName = config.SpeakInternalContinueToolName
	// TrinitySpeakInternalStopToolName Trinity 内部表达结束工具名称。
	TrinitySpeakInternalStopToolName = config.SpeakInternalStopToolName
	// DeliberationSignalToolName 审慎决策信号工具名称
	DeliberationSignalToolName = "deliberation_signal"
)

// SpeakToolHandler speak 工具处理器
type SpeakToolHandler struct {
	activeScope        string
	publicContent      string
	internalMessages   []string
	hasPublicSpeakCall bool
	publicStarts       int
	publicContinues    int
	publicStops        int
	internalStarts     int
	internalContinues  int
	internalStops      int
	stateErrors        []string
	toolCallsByIndex   map[int]*toolCallState
}

// SpeakTransitionStats 表示一次请求后 speak 状态机的关键计数快照。
type SpeakTransitionStats struct {
	PublicStarts      int
	PublicContinues   int
	PublicStops       int
	InternalStarts    int
	InternalContinues int
	InternalStops     int
	StateErrorCount   int
}

type toolCallState struct {
	name              string
	arguments         string
	transitionApplied bool
}

// NewSpeakToolHandler 创建 speak 工具处理器
func NewSpeakToolHandler() *SpeakToolHandler {
	return &SpeakToolHandler{
		internalMessages: []string{},
		toolCallsByIndex: make(map[int]*toolCallState),
	}
}

// OnContent 处理文本内容增量
func (h *SpeakToolHandler) OnContent(content string) {
	// 正文必须通过 continue 工具参数承载，不再接收纯文本增量。
}

// OnToolCall 处理工具调用增量
func (h *SpeakToolHandler) OnToolCall(tc *stream.ToolCallDelta) {
	if tc == nil || tc.Function == nil {
		return
	}
	state, ok := h.toolCallsByIndex[tc.Index]
	if !ok {
		state = &toolCallState{}
		h.toolCallsByIndex[tc.Index] = state
	}
	if tc.Function.Name != "" {
		state.name = tc.Function.Name
	}
	if tc.Function.Arguments != "" {
		state.arguments += tc.Function.Arguments
	}

	toolName := strings.TrimSpace(state.name)
	if toolName == "" || state.transitionApplied {
		return
	}
	if !isSpeakTransitionTool(toolName) {
		return
	}
	h.handleStateTransition(toolName)
	state.transitionApplied = true
}

// OnComplete 处理完成时调用
func (h *SpeakToolHandler) OnComplete(result *stream.StreamResult) {
	h.rebuildOutputsFromToolCalls()
	result.InternalToolMessages = append([]string(nil), h.internalMessages...)
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

// IsPublicPairCompleted 对外表达状态是否已完成成对收束。
func (h *SpeakToolHandler) IsPublicPairCompleted() bool {
	return h.hasPublicSpeakCall &&
		h.publicStarts > 0 &&
		h.publicContinues > 0 &&
		h.publicStarts == h.publicStops &&
		h.activeScope != "public"
}

// ValidatePairedState 校验所有 start/stop 状态是否成对。
func (h *SpeakToolHandler) ValidatePairedState() error {
	if len(h.stateErrors) > 0 {
		return fmt.Errorf("%s", strings.Join(h.stateErrors, "; "))
	}
	if h.publicStarts == 0 {
		return fmt.Errorf("%s 尚未被调用", TrinitySpeakStartToolName)
	}
	if h.publicContinues == 0 {
		return fmt.Errorf("%s 已调用但缺少 %s", TrinitySpeakStartToolName, TrinitySpeakContinueToolName)
	}
	if h.publicStarts != h.publicStops {
		return fmt.Errorf("%s 与 %s 必须成对调用", TrinitySpeakStartToolName, TrinitySpeakStopToolName)
	}
	if h.internalStarts > 0 && h.internalContinues == 0 {
		return fmt.Errorf("%s 已调用但缺少 %s", TrinitySpeakInternalStartToolName, TrinitySpeakInternalContinueToolName)
	}
	if h.internalStarts != h.internalStops {
		return fmt.Errorf("%s 与 %s 必须成对调用", TrinitySpeakInternalStartToolName, TrinitySpeakInternalStopToolName)
	}
	if h.activeScope != "" {
		switch h.activeScope {
		case "public":
			return fmt.Errorf("%s 已调用但缺少 %s", TrinitySpeakStartToolName, TrinitySpeakStopToolName)
		case "internal":
			return fmt.Errorf("%s 已调用但缺少 %s", TrinitySpeakInternalStartToolName, TrinitySpeakInternalStopToolName)
		default:
			return fmt.Errorf("存在未结束的表达状态")
		}
	}
	return nil
}

// BuildContinuationPrompt 返回下一轮修正提示语。
func (h *SpeakToolHandler) BuildContinuationPrompt() string {
	if len(h.stateErrors) > 0 {
		return fmt.Sprintf(
			"上一次工具状态转移不合法：%s。请重新按顺序使用 speak 工具：先 start，再调用 continue，最后 stop。",
			strings.Join(h.stateErrors, "; "),
		)
	}
	if h.publicStarts > 0 && h.publicContinues == 0 && h.publicStarts == h.publicStops {
		return fmt.Sprintf(
			"你已调用 %s 和 %s，但没有调用 %s。请重新执行：先 %s，再调用 %s 追加正文，最后调用 %s。",
			TrinitySpeakStartToolName,
			TrinitySpeakStopToolName,
			TrinitySpeakContinueToolName,
			TrinitySpeakStartToolName,
			TrinitySpeakContinueToolName,
			TrinitySpeakStopToolName,
		)
	}
	if h.activeScope == "public" {
		return fmt.Sprintf("你已调用 %s，请继续调用 %s 追加对外正文，结束时必须调用 %s。", TrinitySpeakStartToolName, TrinitySpeakContinueToolName, TrinitySpeakStopToolName)
	}
	if h.activeScope == "internal" {
		return fmt.Sprintf("你已调用 %s，请继续调用 %s 追加内部报告，结束时必须调用 %s。", TrinitySpeakInternalStartToolName, TrinitySpeakInternalContinueToolName, TrinitySpeakInternalStopToolName)
	}
	return fmt.Sprintf(
		"请通过工具状态转移输出：先 %s，再调用 %s 追加对外正文，最后以 %s 结束。",
		TrinitySpeakStartToolName,
		TrinitySpeakContinueToolName,
		TrinitySpeakStopToolName,
	)
}

func (h *SpeakToolHandler) handleStateTransition(toolName string) {
	switch toolName {
	case TrinitySpeakStartToolName:
		if h.activeScope == "public" {
			return
		}
		h.publicStarts++
		h.beginScope("public", TrinitySpeakStartToolName)
	case TrinitySpeakContinueToolName:
		if h.activeScope != "public" {
			h.stateErrors = append(h.stateErrors, fmt.Sprintf("%s 必须在 %s 与 %s 之间调用", TrinitySpeakContinueToolName, TrinitySpeakStartToolName, TrinitySpeakStopToolName))
			return
		}
		h.publicContinues++
		h.hasPublicSpeakCall = true
	case TrinitySpeakStopToolName:
		if h.activeScope != "public" {
			return
		}
		h.publicStops++
		h.endScope("public")
	case TrinitySpeakInternalStartToolName:
		if h.activeScope == "internal" {
			return
		}
		h.internalStarts++
		h.beginScope("internal", TrinitySpeakInternalStartToolName)
	case TrinitySpeakInternalContinueToolName:
		if h.activeScope != "internal" {
			h.stateErrors = append(h.stateErrors, fmt.Sprintf("%s 必须在 %s 与 %s 之间调用", TrinitySpeakInternalContinueToolName, TrinitySpeakInternalStartToolName, TrinitySpeakInternalStopToolName))
			return
		}
		h.internalContinues++
	case TrinitySpeakInternalStopToolName:
		if h.activeScope != "internal" {
			return
		}
		h.internalStops++
		h.endScope("internal")
	}
}

func (h *SpeakToolHandler) beginScope(scope, toolName string) {
	if scope == "" {
		return
	}
	if h.activeScope == scope {
		return
	}
	if h.activeScope != "" {
		h.stateErrors = append(h.stateErrors, fmt.Sprintf("在 %s 未结束时调用 %s", h.activeScope, toolName))
	}
	h.activeScope = scope
}

func (h *SpeakToolHandler) endScope(scope string) {
	if scope == "" {
		return
	}
	if h.activeScope == "" {
		// 允许孤立 stop 幂等出现，避免跨轮历史噪声导致硬失败。
		return
	}
	if h.activeScope != scope {
		h.stateErrors = append(h.stateErrors, fmt.Sprintf("当前处于 %s 状态，无法结束 %s", h.activeScope, scope))
		return
	}
	h.activeScope = ""
}

func isSpeakTransitionTool(name string) bool {
	switch strings.TrimSpace(name) {
	case TrinitySpeakStartToolName,
		TrinitySpeakContinueToolName,
		TrinitySpeakStopToolName,
		TrinitySpeakInternalStartToolName,
		TrinitySpeakInternalContinueToolName,
		TrinitySpeakInternalStopToolName:
		return true
	default:
		return false
	}
}

func (h *SpeakToolHandler) rebuildOutputsFromToolCalls() {
	h.publicContent = ""
	h.internalMessages = h.internalMessages[:0]

	if len(h.toolCallsByIndex) == 0 {
		return
	}

	indexes := make([]int, 0, len(h.toolCallsByIndex))
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

	activeScope := ""
	var scopeSegments []string

	for _, idx := range indexes {
		call := h.toolCallsByIndex[idx]
		toolName := strings.TrimSpace(call.name)
		switch toolName {
		case TrinitySpeakStartToolName:
			activeScope = "public"
			scopeSegments = scopeSegments[:0]
		case TrinitySpeakInternalStartToolName:
			activeScope = "internal"
			scopeSegments = scopeSegments[:0]
		case TrinitySpeakContinueToolName, TrinitySpeakInternalContinueToolName:
			content, err := extractContinueContent(call.arguments, toolName)
			if err != nil {
				h.stateErrors = append(h.stateErrors, err.Error())
				continue
			}
			if activeScope == "" {
				h.stateErrors = append(h.stateErrors, fmt.Sprintf("%s 在未进入表达状态时被调用", toolName))
				continue
			}
			if toolName == TrinitySpeakContinueToolName && activeScope != "public" {
				h.stateErrors = append(h.stateErrors, fmt.Sprintf("%s 在 %s 状态下被调用", toolName, activeScope))
				continue
			}
			if toolName == TrinitySpeakInternalContinueToolName && activeScope != "internal" {
				h.stateErrors = append(h.stateErrors, fmt.Sprintf("%s 在 %s 状态下被调用", toolName, activeScope))
				continue
			}
			scopeSegments = append(scopeSegments, content)
		case TrinitySpeakStopToolName:
			if activeScope == "public" {
				merged := strings.TrimSpace(strings.Join(scopeSegments, ""))
				if merged != "" {
					if h.publicContent == "" {
						h.publicContent = merged
					} else {
						h.publicContent = strings.TrimSpace(h.publicContent + "\n" + merged)
					}
					h.hasPublicSpeakCall = true
				}
			}
			activeScope = ""
			scopeSegments = scopeSegments[:0]
		case TrinitySpeakInternalStopToolName:
			if activeScope == "internal" {
				merged := strings.TrimSpace(strings.Join(scopeSegments, ""))
				if merged != "" {
					h.internalMessages = append(h.internalMessages, merged)
				}
			}
			activeScope = ""
			scopeSegments = scopeSegments[:0]
		}
	}
}

func extractContinueContent(arguments, toolName string) (string, error) {
	if strings.TrimSpace(arguments) == "" {
		return "", fmt.Errorf("%s 缺少参数", toolName)
	}
	var payload struct {
		Content string `json:"content"`
	}
	if err := json.Unmarshal([]byte(arguments), &payload); err != nil {
		return "", fmt.Errorf("%s 参数解析失败: %w", toolName, err)
	}
	if strings.TrimSpace(payload.Content) == "" {
		return "", fmt.Errorf("%s 的 content 不能为空", toolName)
	}
	return payload.Content, nil
}

func (h *SpeakToolHandler) GetPublicContinueCount() int {
	return h.publicContinues
}

func (h *SpeakToolHandler) GetInternalContinueCount() int {
	return h.internalContinues
}

func (h *SpeakToolHandler) HasStateErrors() bool {
	return len(h.stateErrors) > 0
}

func (h *SpeakToolHandler) AppendStateError(msg string) {
	if strings.TrimSpace(msg) == "" {
		return
	}
	h.stateErrors = append(h.stateErrors, msg)
}

// TransitionStats 返回当前 speak 状态机计数快照。
func (h *SpeakToolHandler) TransitionStats() SpeakTransitionStats {
	return SpeakTransitionStats{
		PublicStarts:      h.publicStarts,
		PublicContinues:   h.publicContinues,
		PublicStops:       h.publicStops,
		InternalStarts:    h.internalStarts,
		InternalContinues: h.internalContinues,
		InternalStops:     h.internalStops,
		StateErrorCount:   len(h.stateErrors),
	}
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
