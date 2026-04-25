# MAGI 统一 Callout 构建工具 — 详细设计

## 核心类型

```go
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
```

## 单一构建函数

```go
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
func BuildCalloutMarkdown(calloutType, title string, fields ...CalloutField) string
```

## 行为规范

1. **Header 行**：`> [!` + calloutType + `]`，如果 title 非空则追加 `" " + title`
2. **逐字段处理**：
   - `Value == ""` → 跳过该字段（不生成任何输出）
   - 统一换行符：`strings.ReplaceAll(strings.ReplaceAll(value, "\r\n", "\n"), "\r", "\n")`
   - 按 `\n` 拆分为行
   - 首行（Label != ""）：`> **Label**: line1`
   - 首行（Label == ""）：`> line1`
   - 后续非空行：`> lineN`
   - 空行：`>`
   - 字段间无额外空行
3. **末尾**：无尾随 `\n`，工具函数本身不处理末尾换行
4. **紧凑**：字段间无空行分隔，保持紧凑

## 各函数重构方案

### A. `buildDiaryCalloutMarkdown`（`diary_tool.go:264`）

当前实现已正确（逐行前缀），但需改为调用统一工具：

```go
func buildDiaryCalloutMarkdown(args *types.WriteDiaryTool) string {
	if args == nil {
		return ""
	}
	return BuildCalloutMarkdown(
		normalizeDiaryCalloutType(args.CalloutType),
		normalizeDiaryTitle(args.Title),
		CalloutField{Value: normalizeDiaryMarkdown(args.Markdown)},
	)
}
```

使用 `Label == ""` 原始内容模式，`normalizeDiaryMarkdown` 预处理逻辑保持不变。

### B. `buildSleepNoteCalloutMarkdown`（`tool_result_memory.go:358`）

当前：直接拼接字符串，多行 `summary` 会撕裂 callout。

改为：

```go
func buildSleepNoteCalloutMarkdown(
	sage *types.Sage,
	toolCall types.ToolCall,
	summary, sleepAt string,
) string {
	if summary == "" {
		return ""
	}
	title := sage.DisplayName + " 睡前笔记"
	sageName := sage.DisplayName
	toolName := toolCall.Function.Name
	sessionID := strconv.Itoa(sage.Context.SessionID)
	roundID := strconv.Itoa(sage.Context.RoundID)
	return BuildCalloutMarkdown("SLEEP_NOTE", title,
		CalloutField{Label: "摘要", Value: summary},
		CalloutField{Label: "贤者", Value: sageName},
		CalloutField{Label: "工具", Value: toolName},
		CalloutField{Label: "睡眠时间", Value: sleepAt},
		CalloutField{Label: "会话", Value: sessionID},
		CalloutField{Label: "轮次", Value: roundID},
	)
}
```

### C. `buildMergedSleepNoteCalloutMarkdown`（`heartbeat_sleep.go:360`）

当前：直接拼接字符串，多行 `dominantSummary` 会撕裂 callout。

改为：

```go
func buildMergedSleepNoteCalloutMarkdown(
	casperNote, melchiorNote, balthazarNote *types.WannaSleepMemory,
	dominantSummary, sleepAt, sessionID, roundID string,
) string {
	if casperNote == nil && melchiorNote == nil && balthazarNote == nil {
		return ""
	}
	fields := []CalloutField{}
	if casperNote != nil && casperNote.Summary != "" {
		fields = append(fields, CalloutField{Label: "当前记录", Value: strings.TrimSpace(casperNote.Summary)})
	}
	if melchiorNote != nil && melchiorNote.NextStepPlan != "" {
		fields = append(fields, CalloutField{Label: "下一步计划", Value: strings.TrimSpace(melchiorNote.NextStepPlan)})
	}
	if balthazarNote != nil && balthazarNote.DreamScene != "" {
		fields = append(fields, CalloutField{Label: "画面式描述", Value: strings.TrimSpace(balthazarNote.DreamScene)})
	}
	if dominantSummary != "" {
		fields = append(fields, CalloutField{Label: "补充整理描述", Value: strings.TrimSpace(dominantSummary)})
	}
	fields = append(fields,
		CalloutField{Label: "睡眠时间", Value: sleepAt},
		CalloutField{Label: "会话", Value: sessionID},
		CalloutField{Label: "轮次", Value: roundID},
	)
	return BuildCalloutMarkdown("SLEEP_NOTE", "合并睡前笔记", fields...)
}
```

### D. `buildNoteSearchArchiveCallout`（`tool_result_memory.go:429`）

当前：直接拼接字符串。

改为混合使用结构化字段和原始内容模式：

```go
func buildNoteSearchArchiveCallout(
	toolCall types.ToolCall,
	purpose, detailedResult, storedAt string,
) string {
	query := extractQueryFromPayload(toolCall.Arguments)
	blockIDs := extractBlockIDsFromResult(detailedResult)
	matchedCount := extractMatchedBlockCount(detailedResult)
	visibleCount := len(blockIDs)

	fields := []CalloutField{
		{Label: "查询", Value: query},
		{Label: "搜索目的", Value: purpose},
		{Label: "匹配块数", Value: strconv.Itoa(visibleCount) + "（共 " + strconv.Itoa(matchedCount) + " 个命中）"},
		{Label: "搜索时间", Value: storedAt},
	}
	// 结果列表使用原始内容模式
	if len(blockIDs) > 0 {
		var embedLines strings.Builder
		for _, id := range blockIDs {
			embedLines.WriteString("{{! " + id + "}}")
			embedLines.WriteString("\n")
		}
		fields = append(fields, CalloutField{Label: "结果", Value: strings.TrimRight(embedLines.String(), "\n")})
	}
	return BuildCalloutMarkdown("QUERY_RESULT", "笔记关键词搜索", fields...)
}
```

### E. `buildForgeArchiveCallout`（`tool_result_memory.go:470`）

改为使用 `BuildCalloutMarkdown`，逻辑不变。

### F. `buildGenericArchiveCallout`（`tool_result_memory.go:498`）

改为使用 `BuildCalloutMarkdown`，逻辑不变。

## 测试方案

| 测试函数 | 覆盖场景 |
|----------|----------|
| `TestBuildCalloutMarkdown_StructuredFields` | 结构化字段基本功能：带标题、多字段 |
| `TestBuildCalloutMarkdown_MultiLineValue` | 多行值被逐行 `> ` 前缀：验证多行摘要正确折行 |
| `TestBuildCalloutMarkdown_RawContent` | `Label=""` 原始内容模式：验证日记用例 |
| `TestBuildCalloutMarkdown_EmptyValueSkipped` | 空 `Value` 字段被跳过，不产生空行 |
| `TestBuildCalloutMarkdown_EmptyTitle` | 标题为空时只生成 `> [!TYPE]` |
| `TestBuildCalloutMarkdown_MixedFields` | 混合结构化字段+原始内容字段 |
| 现有测试回归 | 所有调用方测试继续通过 |

## 文件位置

| 文件 | 路径 |
|------|------|
| 新建工具文件 | `kernel/nerv/magi/coordinator/callout_builder.go` |
| 测试文件 | `kernel/nerv/magi/coordinator/callout_builder_test.go` |
