package chatseqtrie

import (
	"encoding/json"
	"strings"
)

// ConvertClaudeMessages 将 Claude Messages API 格式的消息序列转换为通用消息文档序列。
//
// Claude 格式与 OpenAI 格式的关键差异：
//   - system 是独立参数，不在 messages 数组内 → 转换时插入到序列最前面
//   - content 可以是字符串或 content blocks 数组 → 需要解析每种 block 类型
//   - tool_use 嵌在 content blocks 中 → 提取为 _tool_calls
//   - tool_result 嵌在 user 消息的 content blocks 中 → 拆分为独立的 tool_result 消息
//   - thinking 嵌在 content blocks 中 → 提取为 reasoning
//   - 一条 Claude 消息可能产生多条 Message（如含 tool_result 的 user 消息）
//
// 转换保留所有原始字段（_raw_content 存储原始 content blocks），添加规范化字段。
func ConvertClaudeMessages(msgs []map[string]any, system string) []Message {
	result := make([]Message, 0, len(msgs)+1)

	// system 参数 → 独立的 system 消息
	if strings.TrimSpace(system) != "" {
		result = append(result, Message{
			"type":    "system",
			"role":    "system",
			"content": system,
		})
	}

	for _, raw := range msgs {
		result = append(result, ConvertClaudeMessage(raw)...)
	}

	return result
}

// ConvertClaudeMessage 转换单条 Claude 消息。可能返回多条 Message。
func ConvertClaudeMessage(raw map[string]any) []Message {
	role, _ := raw["role"].(string)
	content := raw["content"]

	switch v := content.(type) {
	case string:
		// 纯文本消息
		doc := make(map[string]any, len(raw)+1)
		for k, val := range raw {
			doc[k] = val
		}
		doc["type"] = claudeRoleToType(role)
		return []Message{doc}

	case []any:
		// content blocks 数组：需要逐块处理
		return convertClaudeContentBlocks(raw, v)

	case nil:
		// content 为 nil（如纯 tool_use 的 assistant 消息）
		doc := make(map[string]any, len(raw)+1)
		for k, val := range raw {
			doc[k] = val
		}
		doc["type"] = claudeRoleToType(role)
		doc["content"] = ""
		return []Message{doc}

	default:
		// 未知格式，原样保留
		doc := make(map[string]any, len(raw)+1)
		for k, val := range raw {
			doc[k] = val
		}
		doc["type"] = claudeRoleToType(role)
		return []Message{doc}
	}
}

// convertClaudeContentBlocks 处理 Claude content blocks 数组。
// 根据块类型拆分为多条消息或合并为一条。
func convertClaudeContentBlocks(raw map[string]any, blocks []any) []Message {
	role, _ := raw["role"].(string)
	msgType := claudeRoleToType(role)

	var textParts []string
	var reasoning string
	var toolCalls []map[string]any
	var attachments []map[string]any
	var toolResults []map[string]any // 独立的 tool_result 消息

	for _, block := range blocks {
		b, ok := block.(map[string]any)
		if !ok {
			continue
		}
		blockType, _ := b["type"].(string)

		switch blockType {
		case "text":
			if text, ok := b["text"].(string); ok {
				textParts = append(textParts, text)
			}

		case "thinking":
			if thinking, ok := b["thinking"].(string); ok {
				reasoning = thinking
			}

		case "tool_use":
			tc := map[string]any{
				"id":   b["id"],
				"name": b["name"],
			}
			// Claude 的 input 是对象，归一化为 JSON 字符串
			if input, ok := b["input"]; ok {
				tc["arguments"] = normalizeArguments(input)
			}
			toolCalls = append(toolCalls, tc)

		case "tool_result":
			// tool_result 拆分为独立消息
			tr := map[string]any{
				"type":         "tool_result",
				"role":         "tool_result",
				"tool_call_id": b["tool_use_id"],
			}
			// content 可以是字符串或 content blocks
			if content, ok := b["content"].(string); ok {
				tr["content"] = content
			} else if contentArr, ok := b["content"].([]any); ok {
				// 提取 text blocks
				var trText []string
				for _, cb := range contentArr {
					if cbm, ok := cb.(map[string]any); ok {
						if t, ok := cbm["type"].(string); ok && t == "text" {
							if text, ok := cbm["text"].(string); ok {
								trText = append(trText, text)
							}
						}
					}
				}
				tr["content"] = strings.Join(trText, "\n")
			}
			toolResults = append(toolResults, tr)

		case "image":
			att := map[string]any{
				"type": "image",
			}
			if source, ok := b["source"].(map[string]any); ok {
				if mt, ok := source["media_type"].(string); ok {
					att["mime_type"] = mt
				}
				if st, ok := source["type"].(string); ok {
					att["source_type"] = st
					// base64 和 url 用不同字段避免相互覆盖
					if st == "base64" {
						if data, ok := source["data"].(string); ok {
							att["data"] = data
						}
					} else if st == "url" {
						if url, ok := source["url"].(string); ok {
							att["url"] = url
						}
					}
				} else {
					// 无 source_type 时分别保留
					if data, ok := source["data"].(string); ok {
						att["data"] = data
					}
					if url, ok := source["url"].(string); ok {
						att["url"] = url
					}
				}
			}
			attachments = append(attachments, att)
		}
	}

	result := make([]Message, 0, 1+len(toolResults))

	// tool_result 消息在前（对应 OpenAI 的 tool 消息在 user 消息之前的顺序）
	for _, tr := range toolResults {
		result = append(result, tr)
	}

	// 主消息
	doc := make(map[string]any, len(raw)+4)
	for k, v := range raw {
		doc[k] = v
	}
	doc["type"] = msgType
	doc["content"] = strings.Join(textParts, "\n")
	if reasoning != "" {
		doc["reasoning"] = reasoning
	}
	if len(toolCalls) > 0 {
		doc["tool_calls"] = toolCalls
	}
	if len(attachments) > 0 {
		doc["attachments"] = attachments
	}
	// 保留原始 content blocks 供回溯
	doc["_raw_content"] = blocks

	// 仅在有实际内容时添加主消息
	if len(textParts) > 0 || len(toolCalls) > 0 || len(attachments) > 0 || reasoning != "" {
		result = append(result, doc)
	}

	// 如果没有产生任何消息（所有块都是未知类型），至少返回一条基本消息
	if len(result) == 0 {
		doc["content"] = ""
		result = append(result, doc)
	}

	return result
}

// ConvertClaudeMessagesFromJSON 从 JSON 字节直接转换。
// 输入 JSON 格式：{"system": "...", "messages": [...]}
func ConvertClaudeMessagesFromJSON(data []byte) ([]Message, error) {
	var req struct {
		System   string           `json:"system"`
		Messages []map[string]any `json:"messages"`
	}
	if err := json.Unmarshal(data, &req); err != nil {
		return nil, err
	}
	return ConvertClaudeMessages(req.Messages, req.System), nil
}

// claudeRoleToType 将 Claude role 映射为通用 type。
func claudeRoleToType(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "system":
		return "system"
	case "user":
		return "user"
	case "assistant":
		return "assistant"
	default:
		return role
	}
}
