package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
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

type ToolContextAppendResult struct {
	RequiresGovernedRetry bool
	LostDominance         bool
	GovernedToolName      string
	GovernedInstruction   string
	RequiresLinkRetry     bool
	LinkRetryInstruction  string
}

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
	appendTurnToolCallsToContextWithExecutorContext(context.Background(), sessionID, roundID, sage, assistantContent, "", toolCalls, nil, ackBuilder)
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
	appendTurnToolCallsToContextWithExecutorContext(context.Background(), sessionID, roundID, sage, assistantContent, "", toolCalls, resultExecutor, ackBuilder)
}

func appendTurnToolCallsToContextWithExecutorContext(
	ctx context.Context,
	sessionID string,
	roundID string,
	sage *sages.Sage,
	assistantContent string,
	reasoningContent string,
	toolCalls []types.ToolCall,
	resultExecutor ToolCallResultExecutor,
	ackBuilder func(toolName string) string,
) ToolContextAppendResult {
	var appendResult ToolContextAppendResult
	if sage == nil || len(toolCalls) == 0 {
		return appendResult
	}

	content := strings.TrimSpace(assistantContent)
	if content == "" {
		content = " "
	}
	_ = sage.AddToContextWithSession(sessionID, types.ContextMessage{
		Role:             types.RoleAssistant,
		Content:          content,
		ReasoningContent: reasoningContent,
		ToolCalls:        toolCalls,
	})

	for _, call := range toolCalls {
		toolResult := `{"ok":true}`
		var toolMeta map[string]interface{}
		handled := false
		if resultExecutor != nil {
			if result, executorHandled, execErr := resultExecutor(call); executorHandled {
				handled = true
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
					toolMeta = webSearchMetaFromResult(parsed)
					toolResult = materializeToolResultForContext(ctx, sessionID, roundID, sage, assistantContent, call, parsed)
				}
			} else if ackBuilder != nil {
				if ack := strings.TrimSpace(ackBuilder(call.Function.Name)); ack != "" {
					handled = true
					toolResult = maybeMaterializeAckToolResult(ctx, sessionID, roundID, sage, assistantContent, call, ack)
				}
			}
		} else if ackBuilder != nil {
			if ack := strings.TrimSpace(ackBuilder(call.Function.Name)); ack != "" {
				handled = true
				toolResult = maybeMaterializeAckToolResult(ctx, sessionID, roundID, sage, assistantContent, call, ack)
			}
		}
		if !handled {
			if payload, marshalErr := json.Marshal(map[string]interface{}{
				"ok":    false,
				"error": fmt.Sprintf("未找到处理工具 %s 的 executor", call.Function.Name),
			}); marshalErr == nil {
				toolResult = string(payload)
			} else {
				toolResult = `{"ok":false}`
			}
		}
		_ = sage.AddToContextWithSession(sessionID, types.ContextMessage{
			Role:    types.RoleTool,
			Content: toolResult,
			ToolID:  call.ID,
			Meta:    toolMeta,
		})

		control := parseGovernedActionToolControl(call.Function.Name, toolResult)
		if control.RequiresGovernedRetry {
			appendResult.RequiresGovernedRetry = true
		}
		if control.LostDominance {
			appendResult.LostDominance = true
		}
		if appendResult.GovernedToolName == "" && control.ToolName != "" {
			appendResult.GovernedToolName = control.ToolName
		}
		if appendResult.GovernedInstruction == "" && control.Instruction != "" {
			appendResult.GovernedInstruction = control.Instruction
		}

		if !appendResult.RequiresGovernedRetry && !appendResult.LostDominance {
			if linkRetry, linkInstruction := parseLinkRequirementToolControl(call.Function.Name, toolResult); linkRetry {
				appendResult.RequiresLinkRetry = true
				appendResult.LinkRetryInstruction = linkInstruction
			}
		}
	}
	return appendResult
}

func maybeMaterializeAckToolResult(
	ctx context.Context,
	sessionID string,
	roundID string,
	sage *sages.Sage,
	assistantContent string,
	call types.ToolCall,
	toolResult string,
) string {
	if !config.IsWannaSleepOrRestToolName(strings.TrimSpace(call.Function.Name)) {
		return toolResult
	}
	return materializeToolResultForContext(ctx, sessionID, roundID, sage, assistantContent, call, toolResult)
}

type governedActionToolControl struct {
	RequiresGovernedRetry bool
	LostDominance         bool
	Instruction           string
	ToolName              string
}

func parseGovernedActionToolControl(toolName string, toolResult string) governedActionToolControl {
	toolName = strings.TrimSpace(toolName)
	if !isGovernedActionToolName(toolName) {
		return governedActionToolControl{}
	}

	var payload struct {
		State       string `json:"state"`
		Instruction string `json:"instruction"`
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(toolResult)), &payload); err != nil {
		return governedActionToolControl{}
	}

	control := governedActionToolControl{
		Instruction: strings.TrimSpace(payload.Instruction),
		ToolName:    toolName,
	}
	switch strings.TrimSpace(payload.State) {
	case "rejected":
		control.RequiresGovernedRetry = true
	case "dominance_revoked":
		control.LostDominance = true
	}
	return control
}

func parseLinkRequirementToolControl(toolName string, toolResult string) (requiresRetry bool, instruction string) {
	toolName = strings.TrimSpace(toolName)
	if !isActiveNoteWriteToolName(toolName) {
		return false, ""
	}

	retry, instruction := isLinkInsufficientResult(toolResult)
	return retry, instruction
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
	return toolSetHasAllFunctionTools(sage.GetTools(), toolNames...)
}

func toolSetHasAllFunctionTools(tools []openai.Tool, toolNames ...string) bool {
	if len(tools) == 0 || len(toolNames) == 0 {
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

	for _, tool := range tools {
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
