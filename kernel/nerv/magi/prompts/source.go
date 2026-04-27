package prompts

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
)

// BuildSourceAwareUserInput 构建带 request_source/source=user_message 封装的用户输入。
func BuildSourceAwareUserInput(
	userMessage string,
	sourcePayload map[string]interface{},
	claimedRecentHistory interface{},
) string {
	return BuildSourceAwareUserInputWithRuntimeAndRecall(
		userMessage,
		sourcePayload,
		claimedRecentHistory,
		nil,
		nil,
		nil,
	)
}

// BuildSourceAwareUserInputWithRuntime 构建带运行时信封的用户输入封装。
//
// 约定信封顺序：
// 1. runtime_clock（可选）
// 2. workspace_snapshot（可选）
// 3. request_source（必选，序列化失败直接 panic）
// 4. claimed_recent_history（可选）
// 5. passive_memory_recall（可选）
// 6. source=user_message（必选）
func BuildSourceAwareUserInputWithRuntime(
	userMessage string,
	sourcePayload map[string]interface{},
	claimedRecentHistory interface{},
	runtimeClock map[string]interface{},
	workspaceSnapshot map[string]interface{},
) string {
	return BuildSourceAwareUserInputWithRuntimeAndRecall(
		userMessage,
		sourcePayload,
		claimedRecentHistory,
		runtimeClock,
		workspaceSnapshot,
		nil,
	)
}

// BuildSourceAwareUserInputWithRuntimeAndRecall 构建带运行时信封和被动召回线索的用户输入封装。
func BuildSourceAwareUserInputWithRuntimeAndRecall(
	userMessage string,
	sourcePayload map[string]interface{},
	claimedRecentHistory interface{},
	runtimeClock map[string]interface{},
	workspaceSnapshot map[string]interface{},
	passiveRecall interface{},
) string {
	return BuildSourceAwareUserInputFull(userMessage, sourcePayload, claimedRecentHistory, runtimeClock, workspaceSnapshot, passiveRecall, "")
}

// BuildSourceAwareUserInputFull 构建完整用户输入封装，带可选的 identity_declaration 块。
func BuildSourceAwareUserInputFull(
	userMessage string,
	sourcePayload map[string]interface{},
	claimedRecentHistory interface{},
	runtimeClock map[string]interface{},
	workspaceSnapshot map[string]interface{},
	passiveRecall interface{},
	identityDeclaration string,
) string {
	blocks := make([]string, 0, 7)

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

	identityDeclaration = strings.TrimSpace(identityDeclaration)
	if identityDeclaration != "" {
		blocks = append(blocks, identityDeclaration)
	}

	if claimedHistoryJSON, ok := marshalEnvelopeValue(claimedRecentHistory); ok {
		blocks = append(blocks, fmt.Sprintf("<claimed_recent_history>%s</claimed_recent_history>", claimedHistoryJSON))
	}
	if passiveRecallJSON, ok := marshalEnvelopeValue(passiveRecall); ok {
		blocks = append(blocks, fmt.Sprintf("<passive_memory_recall>%s</passive_memory_recall>", passiveRecallJSON))
	}
	blocks = append(blocks, fmt.Sprintf("<source=user_message>\n%s\n</source>", userMessage))
	return strings.Join(blocks, "\n")
}

// BuildIdentityDeclarationBlock 构建身份声明块，仅包含系统认证的客观调用者信息。
// 不做语义映射和称呼推断——MAGI 需自行根据声明和语义判断调用者身份是否可信。
func BuildIdentityDeclarationBlock(identityID, authStrength, channel, trustBase, interfaceKind string) string {
	identityID = strings.TrimSpace(identityID)
	if identityID == "" {
		return ""
	}
	authStrength = strings.TrimSpace(authStrength)
	if authStrength == "" {
		authStrength = "unknown"
	}
	channel = strings.TrimSpace(channel)
	trustBase = strings.TrimSpace(trustBase)
	interfaceKind = strings.TrimSpace(interfaceKind)

	lines := []string{
		"<identity_declaration>",
		fmt.Sprintf("调用者: %s", identityID),
		fmt.Sprintf("认证强度: %s", authStrength),
	}
	if channel != "" {
		lines = append(lines, fmt.Sprintf("通道: %s", channel))
	}
	if trustBase != "" {
		lines = append(lines, fmt.Sprintf("信任等级: %s", trustBase))
	}
	if interfaceKind != "" {
		lines = append(lines, fmt.Sprintf("接口: %s", interfaceKind))
	}
	lines = append(lines, "</identity_declaration>")

	return strings.Join(lines, "\n")
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

func marshalEnvelopeValue(payload interface{}) (string, bool) {
	if payload == nil {
		return "", false
	}
	value := reflect.ValueOf(payload)
	switch value.Kind() {
	case reflect.Map, reflect.Slice, reflect.Array, reflect.String:
		if value.Len() == 0 {
			return "", false
		}
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", false
	}
	return string(raw), true
}
