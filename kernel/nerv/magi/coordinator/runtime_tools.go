package coordinator

import (
	"strings"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
)

func buildRuntimeTool(toolDef config.ToolDef) openai.Tool {
	return openai.Tool{
		Type: openai.ToolType(toolDef.Type),
		Function: &openai.FunctionDefinition{
			Name:        toolDef.Function.Name,
			Description: toolDef.Function.Description,
			Parameters:  toolDef.Function.Parameters,
		},
	}
}

func buildRequiredFunctionToolChoice(toolName string) any {
	toolName = strings.TrimSpace(toolName)
	if toolName == "" {
		return "required"
	}
	return openai.ToolChoice{
		Type: openai.ToolTypeFunction,
		Function: openai.ToolFunction{
			Name: toolName,
		},
	}
}
