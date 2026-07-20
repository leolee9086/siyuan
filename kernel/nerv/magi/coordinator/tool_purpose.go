package coordinator

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

func requireExplicitToolPurpose(rawArgs, toolName string) (string, error) {
	return requireExplicitToolStringArgument(rawArgs, toolName, "purpose")
}

func requireExplicitToolMotivation(rawArgs, toolName string) (string, error) {
	return requireExplicitToolStringArgument(rawArgs, toolName, "motivation")
}

func requireExplicitToolStringArgument(rawArgs, toolName, fieldName string) (string, error) {
	rawArgs = strings.TrimSpace(rawArgs)
	if rawArgs == "" {
		return "", fmt.Errorf("%s 参数不能为空", toolName)
	}

	var args map[string]interface{}
	if err := json.Unmarshal([]byte(rawArgs), &args); err != nil {
		return "", fmt.Errorf("%s 参数解析失败: %w", toolName, err)
	}
	value, ok := args[fieldName].(string)
	value = strings.TrimSpace(value)
	if !ok || value == "" {
		return "", fmt.Errorf("%s 的 %s 不能为空", toolName, fieldName)
	}
	return value, nil
}

func explicitToolCallPurpose(toolCall types.ToolCall) (string, error) {
	return requireExplicitToolPurpose(
		toolCall.Function.Arguments,
		strings.TrimSpace(toolCall.Function.Name),
	)
}
