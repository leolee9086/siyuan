// Package stream 实现MAGI流式响应处理
package stream

import (
	"encoding/json"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

const (
	// TrinitySpeakToolName Trinity speak工具名称（对齐前端 trinity.toolset.ts:10）
	TrinitySpeakToolName = "speak"
	// DeliberationSignalToolName 审慎决策信号工具名称
	DeliberationSignalToolName = "deliberation_signal"
)

// ToolCallState 工具调用聚合状态
type ToolCallState struct {
	NamesByIndex           map[int]string
	ArgsByIndex            map[int]string
	HasSpeakToolCall       bool
	HasPublicSpeakToolCall bool
	PublicSpokenContent    string
	InternalSpokenMessages []string
	HasDeliberationSignal  bool
	DeliberationReason     string
	RequiresDeliberation   bool
}

// ParsedChunkData 解析后的chunk数据
type ParsedChunkData struct {
	Content   string
	ToolCalls []types.ToolCallDelta
}

// Processor 流式处理器
type Processor struct {
	toolState         *ToolCallState
	accumulated       string
	observedToolNames map[string]bool
}

// NewProcessor 创建流式处理器
func NewProcessor() *Processor {
	return &Processor{
		toolState: &ToolCallState{
			NamesByIndex:           make(map[int]string),
			ArgsByIndex:            make(map[int]string),
			InternalSpokenMessages: []string{},
		},
		observedToolNames: make(map[string]bool),
	}
}

// ProcessChunk 处理单个SSE chunk
func (p *Processor) ProcessChunk(chunk string) (*ParsedChunkData, error) {
	return extractChunkData(chunk)
}

// AccumulateContent 累积文本内容
func (p *Processor) AccumulateContent(content string) {
	p.accumulated += content
}

// MergeToolCalls 合并工具调用增量
func (p *Processor) MergeToolCalls(toolCalls []types.ToolCallDelta) {
	for _, tc := range toolCalls {
		index := tc.Index

		// 记录工具名称
		if tc.Function != nil && tc.Function.Name != "" {
			p.toolState.NamesByIndex[index] = tc.Function.Name
			p.observedToolNames[tc.Function.Name] = true

			// 识别speak工具
			if tc.Function.Name == TrinitySpeakToolName {
				p.toolState.HasSpeakToolCall = true
			}

			// 识别deliberation_signal工具
			if tc.Function.Name == DeliberationSignalToolName {
				p.toolState.HasDeliberationSignal = true
			}
		}

		// 累积arguments分片
		if tc.Function != nil && tc.Function.Arguments != "" {
			p.toolState.ArgsByIndex[index] += tc.Function.Arguments
		}
	}
}

// ResolveSpeakChannels 解析speak工具的channel输出
func (p *Processor) ResolveSpeakChannels() string {
	var indexes []int
	for idx := range p.toolState.NamesByIndex {
		indexes = append(indexes, idx)
	}

	// 按index排序
	for i := 0; i < len(indexes); i++ {
		for j := i + 1; j < len(indexes); j++ {
			if indexes[i] > indexes[j] {
				indexes[i], indexes[j] = indexes[j], indexes[i]
			}
		}
	}

	var internalMessages []string
	publicContent := ""
	hasPublicSpeak := false

	for _, index := range indexes {
		if p.toolState.NamesByIndex[index] != TrinitySpeakToolName {
			continue
		}

		rawArgs := p.toolState.ArgsByIndex[index]
		parsed := extractSpeakPayload(rawArgs)
		if parsed != nil {
			if parsed.Channel == "internal" {
				internalMessages = append(internalMessages, parsed.Content)
			} else {
				publicContent = parsed.Content
				hasPublicSpeak = true
			}
		}
	}

	p.toolState.HasPublicSpeakToolCall = hasPublicSpeak
	p.toolState.PublicSpokenContent = publicContent
	p.toolState.InternalSpokenMessages = internalMessages

	return publicContent
}

// ResolveDeliberationSignal 解析deliberation_signal工具调用
func (p *Processor) ResolveDeliberationSignal() *types.DeliberationSignal {
	if !p.toolState.HasDeliberationSignal {
		return nil
	}

	for index, name := range p.toolState.NamesByIndex {
		if name != DeliberationSignalToolName {
			continue
		}

		rawArgs := p.toolState.ArgsByIndex[index]
		var signal types.DeliberationSignal
		if err := json.Unmarshal([]byte(rawArgs), &signal); err == nil {
			p.toolState.RequiresDeliberation = signal.RequiresDeliberation
			p.toolState.DeliberationReason = signal.Reason
			return &signal
		}
	}

	return nil
}

// GetResult 获取最终处理结果
func (p *Processor) GetResult(success bool) *types.StreamResult {
	toolNames := make([]string, 0, len(p.observedToolNames))
	for name := range p.observedToolNames {
		toolNames = append(toolNames, name)
	}

	toolArgsByName := p.resolveToolArgumentsByName()

	return &types.StreamResult{
		Content:              p.accumulated,
		Success:              success,
		HasToolCalls:         len(p.observedToolNames) > 0,
		ToolCallNames:        toolNames,
		InternalToolMessages: p.toolState.InternalSpokenMessages,
		ToolArgumentsByName:  toolArgsByName,
	}
}

// GetAccumulated 获取累积的内容
func (p *Processor) GetAccumulated() string {
	return p.accumulated
}

// GetToolState 获取工具调用状态
func (p *Processor) GetToolState() *ToolCallState {
	return p.toolState
}

// extractChunkData 从SSE chunk中提取数据
func extractChunkData(chunk string) (*ParsedChunkData, error) {
	// [DONE]标记表示流结束
	if strings.Contains(chunk, "[DONE]") {
		return &ParsedChunkData{Content: "", ToolCalls: []types.ToolCallDelta{}}, nil
	}

	// 检查是否为SSE格式
	dataPrefix := "data: "
	dataStart := strings.Index(chunk, dataPrefix)
	if dataStart >= 0 {
		jsonStr := strings.TrimSpace(chunk[dataStart+len(dataPrefix):])
		return parseChunkJSON(jsonStr)
	}

	// 纯文本chunk
	return &ParsedChunkData{Content: chunk, ToolCalls: []types.ToolCallDelta{}}, nil
}

// parseChunkJSON 解析chunk JSON
func parseChunkJSON(jsonStr string) (*ParsedChunkData, error) {
	var streamChunk types.StreamChunk
	if err := json.Unmarshal([]byte(jsonStr), &streamChunk); err != nil {
		// JSON解析失败，返回原始字符串
		return &ParsedChunkData{Content: jsonStr, ToolCalls: []types.ToolCallDelta{}}, nil
	}

	// 提取第一个choice的delta
	if len(streamChunk.Choices) == 0 {
		return &ParsedChunkData{Content: "", ToolCalls: []types.ToolCallDelta{}}, nil
	}

	choice := streamChunk.Choices[0]
	return &ParsedChunkData{
		Content:   choice.Delta.Content,
		ToolCalls: choice.Delta.ToolCalls,
	}, nil
}

// extractSpeakPayload 从arguments中提取speak工具载荷
func extractSpeakPayload(rawArgs string) *types.TrinitySpeakTool {
	var payload types.TrinitySpeakTool
	if err := json.Unmarshal([]byte(rawArgs), &payload); err != nil {
		return nil
	}
	return &payload
}

// resolveToolArgumentsByName 按工具名归档参数
func (p *Processor) resolveToolArgumentsByName() map[string][]string {
	result := make(map[string][]string)

	var indexes []int
	for idx := range p.toolState.NamesByIndex {
		indexes = append(indexes, idx)
	}

	// 按index排序
	for i := 0; i < len(indexes); i++ {
		for j := i + 1; j < len(indexes); j++ {
			if indexes[i] > indexes[j] {
				indexes[i], indexes[j] = indexes[j], indexes[i]
			}
		}
	}

	for _, index := range indexes {
		name := p.toolState.NamesByIndex[index]
		if name == "" || !p.observedToolNames[name] {
			continue
		}

		args := p.toolState.ArgsByIndex[index]
		result[name] = append(result[name], args)
	}

	return result
}
