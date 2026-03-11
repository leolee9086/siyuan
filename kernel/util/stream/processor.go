package stream

import (
	"context"
)

// ChunkHandler 自定义 chunk 处理接口
type ChunkHandler interface {
	// OnContent 处理文本内容增量
	OnContent(content string)
	// OnToolCall 处理工具调用增量
	OnToolCall(toolCall *ToolCallDelta)
	// OnComplete 处理完成时调用
	OnComplete(result *StreamResult)
}

// Processor 通用流式响应处理器
type Processor struct {
	accumulated  string
	toolCallsMap map[int]*ToolCall
	handlers     []ChunkHandler
	toolNames    map[string]bool
}

// NewProcessor 创建流式处理器
func NewProcessor(handlers ...ChunkHandler) *Processor {
	return &Processor{
		accumulated:  "",
		toolCallsMap: make(map[int]*ToolCall),
		handlers:     handlers,
		toolNames:    make(map[string]bool),
	}
}

// AccumulateContent 累积文本内容
func (p *Processor) AccumulateContent(content string) {
	if content == "" {
		return
	}
	p.accumulated += content
	for _, h := range p.handlers {
		h.OnContent(content)
	}
}

// MergeToolCalls 合并工具调用增量
func (p *Processor) MergeToolCalls(toolCalls []ToolCallDelta) {
	for _, tc := range toolCalls {
		index := tc.Index

		// 获取或创建工具调用
		call, exists := p.toolCallsMap[index]
		if !exists {
			call = &ToolCall{
				Index: index,
				Function: ToolCallFunction{
					Name:      "",
					Arguments: "",
				},
			}
			p.toolCallsMap[index] = call
		}

		// 合并 ID 和 Type
		if tc.ID != "" {
			call.ID = tc.ID
		}
		if tc.Type != "" {
			call.Type = tc.Type
		}

		// 合并函数信息
		if tc.Function != nil {
			if tc.Function.Name != "" {
				call.Function.Name = tc.Function.Name
				p.toolNames[tc.Function.Name] = true
			}
			if tc.Function.Arguments != "" {
				call.Function.Arguments += tc.Function.Arguments
			}
		}

		// 通知 handlers
		for _, h := range p.handlers {
			h.OnToolCall(&tc)
		}
	}
}

// GetAccumulated 获取累积的内容
func (p *Processor) GetAccumulated() string {
	return p.accumulated
}

// GetResult 获取最终处理结果
func (p *Processor) GetResult(success bool) *StreamResult {
	// 构建工具调用名称列表
	toolNames := make([]string, 0, len(p.toolNames))
	for name := range p.toolNames {
		toolNames = append(toolNames, name)
	}

	// 构建按名称归档的工具参数
	toolArgsByName := p.buildToolArgumentsByName()

	result := &StreamResult{
		Content:             p.accumulated,
		Success:             success,
		HasToolCalls:        len(p.toolNames) > 0,
		ToolCallNames:       toolNames,
		ToolArgumentsByName: toolArgsByName,
	}

	// 通知 handlers
	for _, h := range p.handlers {
		h.OnComplete(result)
	}

	return result
}

// buildToolArgumentsByName 按工具名归档参数
func (p *Processor) buildToolArgumentsByName() map[string][]string {
	result := make(map[string][]string)

	// 按 index 排序
	var indexes []int
	for idx := range p.toolCallsMap {
		indexes = append(indexes, idx)
	}
	for i := 0; i < len(indexes); i++ {
		for j := i + 1; j < len(indexes); j++ {
			if indexes[i] > indexes[j] {
				indexes[i], indexes[j] = indexes[j], indexes[i]
			}
		}
	}

	// 按顺序归档
	for _, index := range indexes {
		call := p.toolCallsMap[index]
		if call.Function.Name == "" {
			continue
		}
		result[call.Function.Name] = append(result[call.Function.Name], call.Function.Arguments)
	}

	return result
}

// ProcessChannel 处理 channel 中的流式响应
func (p *Processor) ProcessChannel(ctx context.Context, chunkChan <-chan StreamChunk) (*StreamResult, error) {
	for {
		select {
		case chunk, ok := <-chunkChan:
			if !ok {
				return p.GetResult(true), nil
			}

			if len(chunk.Choices) == 0 {
				continue
			}

			choice := chunk.Choices[0]
			p.AccumulateContent(choice.Delta.Content)
			p.MergeToolCalls(choice.Delta.ToolCalls)

		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
}
