package chatseqtrie

import (
	"encoding/json"
	"strings"
)

// ConvertOpenAIMessages 将 OpenAI Chat Completion 格式的消息序列转换为通用消息文档序列。
//
// 转换规则：
//   - 保留所有原始字段（role、content、reasoning_content、tool_calls、tool_call_id、name 等）
//   - 添加规范化字段：
//   - type：从 role 派生（system→system, user→user, assistant→assistant, tool→tool_result, function→tool_result）
//   - tool_calls 扁平化：原始 {id, type, function:{name, arguments}} → 规范化 {id, name, arguments}
//   - 原始 tool_calls 保留在 _raw_tool_calls 中
//
// 输入为 JSON 解析后的 map 切片，输出为文档式 Message 切片。
// 调用方负责将 HTTP 请求体 json.Unmarshal 为 []map[string]any。
func ConvertOpenAIMessages(msgs []map[string]any) []Message {
	result := make([]Message, 0, len(msgs))
	for _, raw := range msgs {
		result = append(result, ConvertOpenAIMessage(raw))
	}
	return result
}

// ConvertOpenAIMessage 转换单条 OpenAI 消息。
func ConvertOpenAIMessage(raw map[string]any) Message {
	doc := make(map[string]any, len(raw)+2)

	// 复制所有原始字段
	for k, v := range raw {
		doc[k] = v
	}

	// 从 role 派生 type
	if _, hasType := doc["type"]; !hasType {
		if role, ok := doc["role"].(string); ok {
			doc["type"] = openAIRoleToType(role)
		}
	}

	// 扁平化 tool_calls
	if rawTCs, ok := doc["tool_calls"].([]any); ok && len(rawTCs) > 0 {
		normalized := make([]map[string]any, 0, len(rawTCs))
		for _, rawTC := range rawTCs {
			tc, ok := rawTC.(map[string]any)
			if !ok {
				continue
			}
			flat := make(map[string]any)
			if id, ok := tc["id"].(string); ok {
				flat["id"] = id
			}
			// 从 function 嵌套中提取 name 和 arguments
			if fn, ok := tc["function"].(map[string]any); ok {
				if name, ok := fn["name"].(string); ok {
					flat["name"] = name
				}
				if args, ok := fn["arguments"]; ok {
					flat["arguments"] = normalizeArguments(args)
				}
			}
			// 保留原始 type 字段（通常为 "function"）
			if t, ok := tc["type"].(string); ok {
				flat["type"] = t
			}
			normalized = append(normalized, flat)
		}
		// 保留原始 tool_calls，用扁平化版本覆盖
		doc["_raw_tool_calls"] = doc["tool_calls"]
		doc["tool_calls"] = normalized
	}

	// 处理 reasoning_content → reasoning
	if rc, ok := doc["reasoning_content"].(string); ok && rc != "" {
		doc["reasoning"] = rc
	}

	return doc
}

// ConvertOpenAIMessagesFromJSON 从 JSON 字节直接转换。
func ConvertOpenAIMessagesFromJSON(data []byte) ([]Message, error) {
	var msgs []map[string]any
	if err := json.Unmarshal(data, &msgs); err != nil {
		return nil, err
	}
	return ConvertOpenAIMessages(msgs), nil
}

// openAIRoleToType 将 OpenAI role 映射为通用 type。
func openAIRoleToType(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "system":
		return "system"
	case "user":
		return "user"
	case "assistant":
		return "assistant"
	case "tool":
		return "tool_result"
	case "function":
		return "tool_result"
	default:
		return role
	}
}

// normalizeArguments 将 arguments 归一化为字符串。
// OpenAI 格式中 arguments 是 JSON 字符串；某些兼容实现可能传对象。
func normalizeArguments(args any) string {
	switch v := args.(type) {
	case string:
		return v
	case nil:
		return ""
	default:
		// 对象或其他类型：序列化为 JSON 字符串
		data, err := json.Marshal(v)
		if err != nil {
			return ""
		}
		return string(data)
	}
}
