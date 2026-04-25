# MAGI 睡前笔记 Callout 化

## 任务概述

将睡前笔记（wanna_sleep）的笔记记录格式从 ````json...```` 代码块改为原生 callout 容器格式。

## 参考实现

[`diary_tool.go`](../../kernel/nerv/magi/coordinator/diary_tool.go:264) 中的 `buildDiaryCalloutMarkdown` 提供了 callout 容器 markdown 的构建模式：
- `> [!TYPE] Title`
- `> line1`
- `> line2`

Lute 引擎已启用 callout 支持（[`lute.go:83`](../../kernel/util/lute.go:83) 设 `SetCallout(true)`），通过 `appendMarkdownBlock` 写入 callout markdown 会被正确解析为 `NodeCallout` 块。

## 修改的文件

| 文件 | 修改内容 |
|------|----------|
| [`tool_result_memory.go`](../../kernel/nerv/magi/coordinator/tool_result_memory.go:248) | 移除 `json.MarshalIndent` + ````json` 包装；新增 `buildSleepNoteCalloutMarkdown` 生成 callout 格式 |
| [`heartbeat_sleep.go`](../../kernel/nerv/magi/coordinator/heartbeat_sleep.go:318) | 移除 `json.MarshalIndent` + ````json` 包装；新增 `buildMergedSleepNoteCalloutMarkdown` 生成 callout 格式 |

## 产出格式

### 单贤者睡前笔记（`tool_result_memory.go`）

```
> [!SLEEP_NOTE] {sage.DisplayName} 睡前笔记
> **摘要**: {summary}
> **贤者**: {sage.DisplayName}
> **工具**: {toolCall.Function.Name}
> **睡眠时间**: {sleepAt}
> **会话**: {sessionID}
> **轮次**: {roundID}
```

### 合并睡前笔记（`heartbeat_sleep.go`）

```
> [!SLEEP_NOTE] 合并睡前笔记
> **当前记录**: {casperNote.Summary}
> **下一步计划**: {melchiorNote.NextStepPlan}
> **画面式描述**: {balthazarNote.DreamScene}
> **补充整理描述**: {dominantSummary}
> **睡眠时间**: {sleepAt}
> **会话**: {sessionID}
> **轮次**: {roundID}
```

## 测试结果

所有相关测试通过：
- `TestParseWannaSleepToolContent_ValidatesToolSpecificFields` — PASS
- `TestCoordinateHeartbeat_MergesSleepNotesIntoSharedHistory` — PASS
- `TestAppendTurnToolCallsToContextWithExecutor_PersistsWannaSleepMemoryAndAnnotatesToolResult` — PASS
- `TestAppendTurnToolCallsToContextWithExecutor_WannaSleepPersistenceFailureStillWritesToolResult` — PASS
- `TestBuildDiaryCalloutMarkdown_ProducesNativeCalloutContainer` — PASS
- `TestBuildDiaryCalloutMarkdown_PreservesBlankLinesAndTitle` — PASS

存在 2 个预存失败的 avatar 相关测试（`TestCoordinateDecision_DispatchesAvatarForNonDirectSource`、`TestCoordinateDecision_AvatarHeartbeatTimeoutReturns404UntilRewriteDone`），与本次修改无关。

## 状态

- [x] 计划审批（用户批准，附加要求使用 `SLEEP_NOTE` 自定义 callout 类型）
- [x] 实现: `tool_result_memory.go` 修改 — 新增 `buildSleepNoteCalloutMarkdown`，使用 `> [!SLEEP_NOTE]` 格式
- [x] 实现: `heartbeat_sleep.go` 修改 — 新增 `buildMergedSleepNoteCalloutMarkdown`，使用 `> [!SLEEP_NOTE]` 格式
- [x] 测试验证
