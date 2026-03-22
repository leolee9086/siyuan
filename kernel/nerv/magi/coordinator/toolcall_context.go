package coordinator

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

type ToolCallEventCallback func(
	toolCallIndex int,
	toolCallId string,
	toolName string,
	rawArguments string,
	arguments map[string]interface{},
	isComplete bool,
	detectedTime int64,
)

type ToolCallResultExecutor func(toolCall types.ToolCall) (result string, handled bool, err error)

type streamedToolCallCollector struct {
	byIndex           map[int]*types.ToolCall
	firstDetectedTime map[int]int64
	onToolDetected    ToolCallEventCallback
}

func newStreamedToolCallCollector() *streamedToolCallCollector {
	return &streamedToolCallCollector{
		byIndex:           make(map[int]*types.ToolCall),
		firstDetectedTime: make(map[int]int64),
	}
}

func (c *streamedToolCallCollector) SetCallback(callback ToolCallEventCallback) {
	c.onToolDetected = callback
}

func (c *streamedToolCallCollector) Merge(deltas []types.ToolCallDelta) {
	now := time.Now().UnixMilli()
	for _, delta := range deltas {
		call, ok := c.byIndex[delta.Index]
		if !ok {
			call = &types.ToolCall{
				Index: delta.Index,
				Type:  "function",
				Function: types.ToolCallFunction{
					Name:      "",
					Arguments: "",
				},
			}
			c.byIndex[delta.Index] = call
			c.firstDetectedTime[delta.Index] = now
		}

		argumentsChanged := false
		if delta.ID != "" {
			call.ID = delta.ID
		}
		if delta.Type != "" {
			call.Type = delta.Type
		}
		if delta.Function != nil {
			if delta.Function.Name != "" {
				call.Function.Name = delta.Function.Name
			}
			if delta.Function.Arguments != "" {
				call.Function.Arguments += delta.Function.Arguments
				argumentsChanged = true
			}
		}

		if c.onToolDetected != nil && argumentsChanged && call.Function.Name != "" {
			detectedTime := c.firstDetectedTime[delta.Index]
			var argsMap map[string]interface{}
			isComplete := false
			if err := json.Unmarshal([]byte(call.Function.Arguments), &argsMap); err == nil {
				isComplete = true
			}
			c.onToolDetected(
				delta.Index,
				call.ID,
				call.Function.Name,
				call.Function.Arguments,
				argsMap,
				isComplete,
				detectedTime,
			)
		}
	}
}

func (c *streamedToolCallCollector) GetFirstDetectedTime(toolName string) int64 {
	for idx, call := range c.byIndex {
		if call.Function.Name == toolName {
			if ts, ok := c.firstDetectedTime[idx]; ok {
				return ts
			}
		}
	}
	return time.Now().UnixMilli()
}

func (c *streamedToolCallCollector) BuildSorted() []types.ToolCall {
	if len(c.byIndex) == 0 {
		return nil
	}
	var indexes []int
	for idx := range c.byIndex {
		indexes = append(indexes, idx)
	}
	for i := 0; i < len(indexes); i++ {
		for j := i + 1; j < len(indexes); j++ {
			if indexes[i] > indexes[j] {
				indexes[i], indexes[j] = indexes[j], indexes[i]
			}
		}
	}

	result := make([]types.ToolCall, 0, len(indexes))
	for _, idx := range indexes {
		call := *c.byIndex[idx]
		if call.ID == "" {
			call.ID = fmt.Sprintf("tool_call_%d", idx)
		}
		if call.Type == "" {
			call.Type = "function"
		}
		result = append(result, call)
	}
	return result
}

func appendTurnToolCallsToContext(
	sessionID string,
	roundID string,
	sage *sages.Sage,
	assistantContent string,
	toolCalls []types.ToolCall,
	ackBuilder func(toolName string) string,
) {
	appendTurnToolCallsToContextWithExecutor(sessionID, roundID, sage, assistantContent, toolCalls, nil, ackBuilder)
}

func appendTurnToolCallsToContextWithExecutor(
	sessionID string,
	roundID string,
	sage *sages.Sage,
	assistantContent string,
	toolCalls []types.ToolCall,
	resultExecutor ToolCallResultExecutor,
	ackBuilder func(toolName string) string,
) {
	if sage == nil || len(toolCalls) == 0 {
		return
	}

	content := strings.TrimSpace(assistantContent)
	if content == "" {
		content = " "
	}
	sage.AddToContextWithSession(sessionID, types.ContextMessage{
		Role:      types.RoleAssistant,
		Content:   content,
		ToolCalls: toolCalls,
	})

	for _, call := range toolCalls {
		toolResult := `{"ok":true}`
		if resultExecutor != nil {
			if result, handled, execErr := resultExecutor(call); handled {
				if execErr != nil {
					if payload, marshalErr := json.Marshal(map[string]interface{}{
						"ok":    false,
						"error": execErr.Error(),
					}); marshalErr == nil {
						toolResult = string(payload)
					} else {
						toolResult = `{"ok":false}`
					}
				} else if parsed := strings.TrimSpace(result); parsed != "" {
					toolResult = materializeToolResultForContext(sessionID, roundID, sage, assistantContent, call, parsed)
				}
			} else if ackBuilder != nil {
				if ack := strings.TrimSpace(ackBuilder(call.Function.Name)); ack != "" {
					toolResult = ack
				}
			}
		} else if ackBuilder != nil {
			if ack := strings.TrimSpace(ackBuilder(call.Function.Name)); ack != "" {
				toolResult = ack
			}
		}
		sage.AddToContextWithSession(sessionID, types.ContextMessage{
			Role:    types.RoleTool,
			Content: toolResult,
			ToolID:  call.ID,
		})
	}
}

func withToolCallIndexOffset(deltas []types.ToolCallDelta, offset int) []types.ToolCallDelta {
	if len(deltas) == 0 || offset == 0 {
		return deltas
	}
	out := make([]types.ToolCallDelta, len(deltas))
	copy(out, deltas)
	for i := range out {
		out[i].Index = out[i].Index + offset
	}
	return out
}

func sageHasAllFunctionTools(sage *sages.Sage, toolNames ...string) bool {
	if sage == nil || len(toolNames) == 0 {
		return false
	}
	toolSet := make(map[string]struct{}, len(toolNames))
	for _, name := range toolNames {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		toolSet[name] = struct{}{}
	}
	if len(toolSet) == 0 {
		return false
	}

	for _, tool := range sage.GetTools() {
		if tool.Type != openai.ToolTypeFunction || tool.Function == nil {
			continue
		}
		delete(toolSet, strings.TrimSpace(tool.Function.Name))
		if len(toolSet) == 0 {
			return true
		}
	}
	return false
}
