package chatseqtrie

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
)

// FieldPolicy 定义哪些字段属于「内容」（参与前缀匹配），哪些属于「修饰属性」（不参与）。
//
// 内容字段使用 JSON Pointer 风格的路径表示，支持通配符 * 遍历数组元素：
//   - "type"                          → 直接字段，整值参与匹配
//   - "content"                       → 直接字段
//   - "tool_calls/*/name"             → tool_calls 数组的每个元素的 name 字段
//   - "tool_calls/*/arguments"        → tool_calls 数组的每个元素的 arguments 字段
//   - "attachments"                   → 直接字段，整个数组参与匹配
//
// 未列出的字段自动归为修饰属性，不参与匹配但仍在文档中保留。
// 两个节点匹配当且仅当所有内容字段的 JSON 完全一致。
type FieldPolicy struct {
	// ContentPaths 参与匹配的字段路径集合。
// 路径格式：字段名用 / 分隔，* 表示遍历数组。
	contentPaths map[string]bool
	// pathTree 从路径构建的投影树，用于高效过滤文档。
	tree *pathNode
}

// pathNode 路径树节点，用于文档投影。
type pathNode struct {
	children map[string]*pathNode // 命名字段 → 子树
	wildcard *pathNode            // 数组通配符的子树
	isLeaf   bool                 // 是否为终端路径（此路径的值应被包含）
}

// NewFieldPolicy 从路径列表创建字段策略。
func NewFieldPolicy(paths ...string) *FieldPolicy {
	pathSet := make(map[string]bool, len(paths))
	for _, p := range paths {
		pathSet[strings.TrimSpace(p)] = true
	}
	return &FieldPolicy{
		contentPaths: pathSet,
		tree:         buildPathTree(paths),
	}
}

// DefaultFieldPolicy 返回适用于 LLM 聊天序列的默认字段策略。
//
// 内容字段（参与匹配）：
//   - type, role, content：消息核心语义
//   - tool_calls/*/name, tool_calls/*/arguments：工具调用的语义信息
//   - attachments：多模态附件
//
// 修饰字段（不参与匹配）：
//   - tool_calls/*/id, tool_call_id：不同 API 生成的 ID 格式不同，语义无意义
//   - reasoning：模型特定，切换模型时不同
//   - 时间戳、平台元数据、扩展字段等
func DefaultFieldPolicy() *FieldPolicy {
	return NewFieldPolicy(
		"type",
		"role",
		"content",
		"tool_calls/*/name",
		"tool_calls/*/arguments",
		"attachments",
	)
}

// IsContent 判断指定路径是否为内容字段。
func (p *FieldPolicy) IsContent(path string) bool {
	return p.contentPaths[strings.TrimSpace(path)]
}

// ComputeKey 根据字段策略从消息文档中提取内容字段，返回规范化 JSON 字符串。
// 两个消息的 ComputeKey 结果相同当且仅当所有内容字段完全一致。
// json.Marshal 对 map[string]any 按键名字母序排列，保证输出确定性。
//
// 内部先通过 JSON 往返归一化类型（[]map[string]any → []any 等），
// 因为 Go 的类型断言无法直接将 []map[string]any 当作 []any 处理。
func (p *FieldPolicy) ComputeKey(msg Message) (string, error) {
	// JSON 往返归一化：确保所有切片类型统一为 []any
	raw, err := json.Marshal(map[string]any(msg))
	if err != nil {
		return "", err
	}
	var normalized map[string]any
	if err := json.Unmarshal(raw, &normalized); err != nil {
		return "", err
	}

	if p == nil || p.tree == nil {
		// 无策略 = 全部字段参与匹配
		data, err := json.Marshal(normalized)
		if err != nil {
			return "", err
		}
		return string(data), nil
	}
	projected := projectDocument(normalized, p.tree)
	data, err := json.Marshal(projected)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// ComputeKeyHash 返回 ComputeKey 的 SHA-256 十六进制摘要，用于固定长度存储键。
func (p *FieldPolicy) ComputeKeyHash(msg Message) (string, error) {
	key, err := p.ComputeKey(msg)
	if err != nil {
		return "", err
	}
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:]), nil
}

// buildPathTree 从路径列表构建投影树。
//
// 路径解析规则：
//   - "type"       → root.children["type"].isLeaf = true
//   - "a/b/c"      → root.children["a"].children["b"].children["c"].isLeaf = true
//   - "a/*/b"      → root.children["a"].wildcard.children["b"].isLeaf = true
//   - "a/*/b/c"    → root.children["a"].wildcard.children["b"].children["c"].isLeaf = true
func buildPathTree(paths []string) *pathNode {
	root := &pathNode{children: make(map[string]*pathNode)}
	for _, raw := range paths {
		path := strings.TrimSpace(raw)
		if path == "" {
			continue
		}
		parts := strings.Split(path, "/")
		current := root
		for i, part := range parts {
			part = strings.TrimSpace(part)
			if part == "*" {
				if current.wildcard == nil {
					current.wildcard = &pathNode{children: make(map[string]*pathNode)}
				}
				current = current.wildcard
			} else if part != "" {
				if current.children[part] == nil {
					current.children[part] = &pathNode{children: make(map[string]*pathNode)}
				}
				current = current.children[part]
			}
			if i == len(parts)-1 {
				current.isLeaf = true
			}
		}
	}
	return root
}

// projectDocument 按照投影树过滤文档，只保留内容字段。
// 递归处理嵌套对象和数组通配符。
func projectDocument(doc map[string]any, tree *pathNode) map[string]any {
	if tree == nil {
		return doc
	}
	// 终端路径且无子节点与通配符：整个文档作为值参与匹配
	// 例如策略 "tool_calls/*" 中通配符节点本身是终端，数组元素应整体保留
	if tree.isLeaf && len(tree.children) == 0 && tree.wildcard == nil {
		return doc
	}
	result := make(map[string]any)
	for field, subTree := range tree.children {
		v, ok := doc[field]
		if !ok {
			continue
		}
		if subTree.isLeaf && len(subTree.children) == 0 && subTree.wildcard == nil {
			// 终端路径：直接复制整个值
			result[field] = v
		} else if subTree.wildcard != nil {
			// 数组通配符：遍历数组每个元素
			if arr, ok := v.([]any); ok {
				filtered := make([]any, 0, len(arr))
				for _, elem := range arr {
					if elemMap, ok := elem.(map[string]any); ok {
						filtered = append(filtered, projectDocument(elemMap, subTree.wildcard))
					} else {
						// 非对象元素直接保留
						filtered = append(filtered, elem)
					}
				}
				result[field] = filtered
			}
		} else if len(subTree.children) > 0 {
			// 嵌套对象：递归投影
			if m, ok := v.(map[string]any); ok {
				projected := projectDocument(m, subTree)
				if len(projected) > 0 {
					result[field] = projected
				}
			}
		} else if subTree.isLeaf {
			// 终端但无子节点：直接复制
			result[field] = v
		}
	}
	return result
}
