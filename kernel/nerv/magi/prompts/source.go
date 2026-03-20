package prompts

import (
	"encoding/json"
	"fmt"
	"strings"
)

// BuildSourceAwareUserInput 构建带 request_source/source=user_message 封装的用户输入。
func BuildSourceAwareUserInput(userMessage string, sourcePayload map[string]interface{}) string {
	return BuildSourceAwareUserInputWithRuntime(userMessage, sourcePayload, nil, nil)
}

// BuildSourceAwareUserInputWithRuntime 构建带运行时信封的用户输入封装。
//
// 约定信封顺序：
// 1. runtime_clock（可选）
// 2. workspace_snapshot（可选）
// 3. request_source（必选，序列化失败直接 panic）
// 4. source=user_message（必选）
func BuildSourceAwareUserInputWithRuntime(
	userMessage string,
	sourcePayload map[string]interface{},
	runtimeClock map[string]interface{},
	workspaceSnapshot map[string]interface{},
) string {
	blocks := make([]string, 0, 4)

	if runtimeJSON, ok := marshalEnvelope(runtimeClock); ok {
		blocks = append(blocks, fmt.Sprintf("<runtime_clock>%s</runtime_clock>", runtimeJSON))
	}
	if workspaceJSON, ok := marshalEnvelope(workspaceSnapshot); ok {
		blocks = append(blocks, fmt.Sprintf("<workspace_snapshot>%s</workspace_snapshot>", workspaceJSON))
	}

	raw, err := json.Marshal(sourcePayload)
	if err != nil {
		panic(fmt.Errorf("request_source is required and must be JSON serializable: %w", err))
	}

	blocks = append(blocks, fmt.Sprintf("<request_source>%s</request_source>", string(raw)))
	blocks = append(blocks, fmt.Sprintf("<source=user_message>\n%s\n</source>", userMessage))
	return strings.Join(blocks, "\n")
}

func marshalEnvelope(payload map[string]interface{}) (string, bool) {
	if len(payload) == 0 {
		return "", false
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", false
	}
	return string(raw), true
}
