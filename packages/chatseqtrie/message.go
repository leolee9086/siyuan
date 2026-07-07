// Package chatseqtrie 提供通用聊天序列前缀树（prefix tree）构建与匹配能力。
//
// 本包的核心设计原则：
//   - 文档式存储：Message 使用 map[string]any，无固定 schema，新字段随加随存，无需迁移
//   - 格式无关：所有常用消息序列格式（OpenAI、Claude、SiYuan block、Kramdown、HTML）的字段均可直接存入
//   - 内容/修饰分离：通过 FieldPolicy 配置哪些字段参与前缀匹配，哪些为修饰属性
//   - 纯内容匹配：两个节点匹配当且仅当所有「内容字段」的 JSON 完全一致
package chatseqtrie

import (
	"encoding/json"
	"strings"
)

// Message 通用消息文档。使用 map[string]any 实现，是所有常用消息序列格式的严格超集。
//
// 设计理由：不使用固定 struct 是因为不同来源（OpenAI、Claude、SiYuan block、Kramdown、HTML）
// 的字段集合不同且会随格式演进而扩展。文档式存储保证新字段可直接存入，旧文档不含新字段也不报错，
// 永远不需要 schema 升级或数据迁移。
//
// 常用字段约定（非强制，由转换器和字段策略共同决定）：
//   - type: 消息类型（system|user|assistant|tool_result|block|ast|element|…）
//   - role: LLM 角色别名（与 type 互补，用于 LLM 消息）
//   - content: 文本内容（字符串）
//   - reasoning: 推理/思考内容
//   - tool_calls: 工具调用数组，每个元素含 id/name/arguments
//   - tool_call_id: 工具结果对应的调用 ID
//   - attachments: 多模态附件数组
//
// 任何其他字段（渠道来源、时间戳、平台元数据等）均可直接存入，是否参与匹配由 FieldPolicy 决定。
type Message map[string]any

// NewMessage 从任意 JSON 可序列化的值创建消息文档。
// 值会被 JSON 序列化后反序列化为 map[string]any，保证内部一致。
func NewMessage(v any) (Message, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return m, nil
}

// MustNewMessage 便捷构造，发生错误时 panic。仅用于测试或硬编码常量。
func MustNewMessage(v any) Message {
	m, err := NewMessage(v)
	if err != nil {
		panic(err)
	}
	return m
}

// NewMessageFromJSON 从 JSON 字节创建消息文档。
func NewMessageFromJSON(data []byte) (Message, error) {
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return m, nil
}

// JSON 返回消息文档的 JSON 字节。键按字母序排列（Go json.Marshal 对 map 的行为），保证确定性。
func (m Message) JSON() ([]byte, error) {
	return json.Marshal(map[string]any(m))
}

// --- 类型安全访问器 ---
// 这些访问器对缺失字段返回零值，对类型不匹配返回零值，不 panic。
// 仅覆盖最常用字段；不常用的字段由调用方直接从 map 取。

// Type 返回消息类型（type 字段）。
func (m Message) Type() string {
	v, _ := m["type"].(string)
	return v
}

// Role 返回消息角色（role 字段）。
func (m Message) Role() string {
	v, _ := m["role"].(string)
	return v
}

// Content 返回文本内容。若 content 是字符串则直接返回；
// 若是数组（如 Claude content blocks）则提取所有 type=="text" 的 text 字段拼接；
// 若不存在或为 nil 则返回空字符串。
func (m Message) Content() string {
	switch v := m["content"].(type) {
	case string:
		return v
	case []any:
		var sb strings.Builder
		for _, block := range v {
			if b, ok := block.(map[string]any); ok {
				if t, ok := b["type"].(string); ok && t == "text" {
					if text, ok := b["text"].(string); ok {
						sb.WriteString(text)
					}
				}
			}
		}
		return sb.String()
	default:
		return ""
	}
}

// Reasoning 返回推理/思考内容（reasoning 字段）。
func (m Message) Reasoning() string {
	v, _ := m["reasoning"].(string)
	return v
}

// ToolCallID 返回工具结果对应的调用 ID（tool_call_id 字段）。
func (m Message) ToolCallID() string {
	v, _ := m["tool_call_id"].(string)
	return v
}

// HasField 判断文档中是否存在指定字段。
func (m Message) HasField(field string) bool {
	_, ok := m[field]
	return ok
}

// GetString 从文档中安全获取字符串字段。
func (m Message) GetString(field string) string {
	v, _ := m[field].(string)
	return v
}

// GetInt64 从文档中安全获取 int64 字段。JSON 数字默认解析为 float64。
func (m Message) GetInt64(field string) int64 {
	switch v := m[field].(type) {
	case float64:
		return int64(v)
	case int:
		return int64(v)
	case int64:
		return v
	default:
		return 0
	}
}

// GetBool 从文档中安全获取布尔字段。
func (m Message) GetBool(field string) bool {
	v, _ := m[field].(bool)
	return v
}
