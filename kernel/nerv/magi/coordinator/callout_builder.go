package coordinator

import "strings"

// CalloutField 表示 callout 块中的一个条目。
//
// 两种模式：
//   - Label != ""：结构化字段模式，输出 "> **Label**: value_line1\n> value_line2"
//   - Label == ""：原始内容模式，输出 "> line1\n> line2"（用于日记自由内容）
//
// 空 Value 的字段被跳过（不输出）。Value 中的多行被逐行前缀。
type CalloutField struct {
	Label string
	Value string
}

// BuildCalloutMarkdown 构建标准化的 callout markdown。
//
// 结构化字段模式（Label != ""）：
//
//	> [!Type] Title
//	> **Label1**: value_line1
//	> value_line2
//	> **Label2**: value
//
// 原始内容模式（Label == ""）：
//
//	> [!Type] Title
//	> 第一行
//	>
//	> 第三行
//
// Value 为空时字段被跳过。
// 返回字符串不含尾随换行。
func BuildCalloutMarkdown(calloutType, title string, fields ...CalloutField) string {
	var builder strings.Builder

	// Header
	builder.WriteString("> [!")
	builder.WriteString(calloutType)
	builder.WriteString("]")
	if title != "" {
		builder.WriteString(" ")
		builder.WriteString(title)
	}

	for _, field := range fields {
		if field.Value == "" {
			continue
		}

		// Normalize line endings
		value := field.Value
		value = strings.ReplaceAll(value, "\r\n", "\n")
		value = strings.ReplaceAll(value, "\r", "\n")

		lines := strings.Split(value, "\n")
		for i, line := range lines {
			builder.WriteString("\n")
			if line == "" {
				// 空行：输出 ">" 保持空行
				builder.WriteString(">")
			} else if field.Label != "" && i == 0 {
				// 结构化字段模式首行："> **Label**: line"
				builder.WriteString("> **")
				builder.WriteString(field.Label)
				builder.WriteString("**: ")
				builder.WriteString(line)
			} else {
				// 原始内容模式或后续行："> line"
				builder.WriteString("> ")
				builder.WriteString(line)
			}
		}
	}

	return builder.String()
}
