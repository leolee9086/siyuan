// Package chatseqtrie 提供通用聊天序列前缀树构建与匹配能力。
// 本文件：动态区段（Dynamic Segment）——聊天序列变换的一部分。
// 所有动态内容（工具列表、status、runtime_clock 等）统一拼装为一个动态区段，
// 整体作为一条消息追加到消息序列真正末尾（动态内容后缀化），绝不零散追加、绝不附着已有消息。
package chatseqtrie

import "strings"

// Segment 单次请求的动态区段（有序动态块列表）。
//
// 用法：调用方按构建路径依次 Add 各动态块（如 "tool_list"、"status"），
// 每个请求的构建路径固定 → 块顺序自然稳定；区段只存在于请求快照，不持久化。
// 本类型是通用容器，不预定义任何业务字段名（kind 由调用方决定）。
type Segment struct {
	blocks []segmentBlock
}

type segmentBlock struct {
	kind    string
	content string
}

// NewSegment 创建空动态区段。
func NewSegment() *Segment {
	return &Segment{}
}

// Add 添加一个动态块。content 为纯文本内容（不含包裹标签），Render 时自动用
// <kind>...</kind> 包裹；空内容忽略。同一 kind 重复 Add 时更新内容并保持首次位置
// （避免同一来源的块在区段内漂移），不同 kind 按首次添加顺序排列。
func (s *Segment) Add(kind, content string) *Segment {
	if s == nil || strings.TrimSpace(content) == "" {
		return s
	}
	content = strings.TrimSpace(content)
	for i := range s.blocks {
		if s.blocks[i].kind == kind {
			s.blocks[i].content = content
			return s
		}
	}
	s.blocks = append(s.blocks, segmentBlock{kind: kind, content: content})
	return s
}

// IsEmpty 判断区段是否无任何动态块。
func (s *Segment) IsEmpty() bool {
	return s == nil || len(s.blocks) == 0
}

// Render 渲染动态区段完整文本（<dynamic>...</dynamic> 包裹，块按添加顺序）。
// 无任何动态块时返回空字符串。
func (s *Segment) Render() string {
	if s.IsEmpty() {
		return ""
	}
	var sb strings.Builder
	sb.WriteString("<dynamic>\n")
	for _, b := range s.blocks {
		sb.WriteString("<")
		sb.WriteString(b.kind)
		sb.WriteString(">\n")
		sb.WriteString(b.content)
		sb.WriteString("\n</")
		sb.WriteString(b.kind)
		sb.WriteString(">\n")
	}
	sb.WriteString("</dynamic>")
	return sb.String()
}

// ToMessage 把动态区段渲染为一条通用消息文档（type 由调用方指定，如 "system"/"user"）。
// 区段为空时返回 nil。该消息应追加到消息序列真正末尾。
func (s *Segment) ToMessage(msgType string) Message {
	if s.IsEmpty() {
		return nil
	}
	return Message{
		"type":    msgType,
		"role":    msgType,
		"content": s.Render(),
	}
}
