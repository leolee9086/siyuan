# MAGI 查询归档 Callout + 嵌入块化

## 任务概述

将查询工具结果归档（`/MAGI查询结果`）的存储格式从 JSON 代码块（````json````）改为原生 callout 容器格式，并使用嵌入块（`{{! blockID}}`）引用查询命中的内容块，彻底消除 JSON 递归序列化导致的文件膨胀和 FTS 自引用放大问题。

## 问题背景

查询归档当前使用 `json.MarshalIndent` 将完整搜索结果序列化为 JSON，再包装为 ````json\n...\n```` 代码块写入。此格式导致：

1. **FTS 自引用递归放大**：代码块内容被 FTS 索引 → MAGI 搜索可能命中自身归档 → 结果再次被归档 → 内容持续膨胀
2. **JSON 嵌套转义膨胀**：Block.Content 已含 HTML 转义（`&#34;`等），经 Go json.Marshal 再转义（`\u003c`等），最终 .sy 文件三重转义（`\\u003c`等）
3. **冗余内容存储**：搜索结果中每个 Block 的完整 Content 被重复存储，而内容已存在于原始文档中

## 参考实现

- [`diary_tool.go`](../../kernel/nerv/magi/coordinator/diary_tool.go:264) 的 `buildDiaryCalloutMarkdown` - callout 容器 markdown 构建模式
- [`tool_result_memory.go`](../../kernel/nerv/magi/coordinator/tool_result_memory.go:361) 的 `buildSleepNoteCalloutMarkdown` - 睡前笔记 callout 格式
- [`tool_result_memory.go`](../../kernel/nerv/magi/coordinator/tool_result_memory.go:248) 的 `persistWannaSleepMemoryEntryToNotebook` - Callout 持久化模式

Lute 引擎已启用 callout 支持（[`lute.go`](../../kernel/util/lute.go:83) 设 `SetCallout(true)`），通过 `appendMarkdownBlock` 写入 callout markdown 会被正确解析为 `NodeCallout` 块。

嵌入块语法：`{{! blockID}}` - SiYuan 原生支持，Lute 解析为 `NodeBlockQueryEmbed` 节点。

## 修改的文件

| 文件 | 修改内容 |
|------|----------|
| [`tool_result_memory.go`](../../kernel/nerv/magi/coordinator/tool_result_memory.go:108) | 重构 `persistDetailedQueryToolResultToNotebook`：移除 `json.MarshalIndent` + ````json` 包装；新增 `buildQueryArchiveCalloutMarkdown` 生成 callout 格式；对 `search_notes_by_keywords` 结果提取 block IDs 并生成嵌入块引用 |

## 产出格式

### search_notes_by_keywords（笔记关键词搜索）

```
> [!QUERY_RESULT] 笔记关键词搜索
> **查询**: {query}
> **搜索目的**: {purpose}
> **匹配块数**: {visibleBlockCount}（共 {matchedBlockCount} 个命中）
> **搜索时间**: {storedAt}
>
> **结果**:
> {{! blockID1}}
> {{! blockID2}}
> {{! blockID3}}
```

### forge 工具（代码仓库操作）

```
> [!QUERY_RESULT] {toolDisplayName}
> **搜索目的**: {purpose}
> **路径**: {path}
> **匹配数**: {matchCount}
> **搜索时间**: {storedAt}
>
> **路径列表**:
> {truncated path list}
```

## 实现要点

### 1. 解析 detailedResult 提取 block IDs

`noteKeywordSearchToolResult` 结构：
```go
type noteKeywordSearchResult struct {
    Blocks []struct {
        ID string `json:"id"`
        // 不需要其他字段，通过嵌入块实时渲染
    } `json:"blocks"`
    MatchedBlockCount int `json:"matchedBlockCount"`
    MatchedRootCount  int `json:"matchedRootCount"`
}
```

仅提取 `id` 字段，避免存储完整的 Block Content。

### 2. 构建 callout markdown

新函数 `buildQueryArchiveCalloutMarkdown`：
- 参数：toolName, purpose, query, blockIDs, matchedCount, storedAt
- 对于 search_notes_by_keywords：生成包含 `{{! id}}` 嵌入块引用的 callout
- 对于 forge 工具：生成纯文本摘要 callout，无嵌入块

### 3. 保留块属性

保持现有的 `custom-magi-query-archive`、`custom-magi-tool-name`、`custom-magi-tool-call-id`、`custom-magi-round-id`、`custom-magi-session-id`、`custom-magi-sage`、`custom-magi-purpose` 等属性不变。

### 4. 兼容性

- 旧的 JSON 代码块归档文档无需迁移，新旧格式共存
- `buildCompactToolHistorySummary` 保持不变，它已生成轻量摘要供上下文使用
- Melchior 的特殊路径（直接返回 detailedResult）保持不变

## 测试验证

- 修改后 `go build ./kernel/nerv/magi/...` 编译通过
- 运行 `go test ./kernel/nerv/magi/coordinator/...` 确保现有测试不中断
- 新增 `TestBuildQueryArchiveCalloutMarkdown` 测试，验证：
  - 正确生成 callout 格式
  - 嵌入块引用格式正确
  - 空结果正确处理
  - forge 工具格式正确

## 状态

- [x] 计划审批
- [x] 实现: 新增 `buildQueryArchiveCalloutMarkdown` 函数
- [x] 实现: 重构 `persistDetailedQueryToolResultToNotebook` 使用 callout 格式
- [x] 实现: 解析 detailedResult 提取 block IDs 的逻辑
- [x] 测试验证 — 编译通过，所有相关测试 PASS（仅 2 个预先存在的 Avatar 测试失败，与本次修改无关）
