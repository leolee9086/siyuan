# MAGI心跳唤醒工作日志改造执行跟踪 (TikTocTak)

> **目标**: 将 MAGI 心跳的 sleep/rest 两种模式彻底分离：
> - 非睡眠时段使用 `wanna_rest_*` 工作日志工具，Balthazar 字段为 `mood`（心情），tool_choice 为 `required`
> - 睡眠时段 Melchior 字段改为 `reflection`（回想反思）
> - callout 标记区分：睡眠用 DREAM/🌙，工作日志用 NOTE/📋
> - 命名彻底分离：消除 ~70+ 处 sleep/rest 命名混淆
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 🟢 近期计划

*暂无——以下为待办事项*

---

## 🟡 中期计划

- [ ] **Phase 9: 已有测试文件适配 + 测试验证**
  - **背景**: 测试文件中引用旧字段名/函数名需同步；`collector_test.go`、`heartbeat_test.go`、`passive_recall_test.go`、`config_test.go`、`api/magi_runtime_test.go` 中残留旧命名需修复
  - **行动**:
    1. 修复所有测试文件编译错误
    2. 运行 `go test ./nerv/magi/...` 和 `go test ./api/...`
    3. 修复测试逻辑中因字段重命名导致的断言失败
  - **验收标准**: 全部测试通过

---

## 🏁 已归档/已完成

- [x] **Phase 1: config_rest.go 常量与函数定义** [已完成 2026-05-02]
  - **完成情况**: 创建独立文件 `config/config_rest.go`，包含 4 个常量 + 3 个 Build*Def + 3 个 Is/Resolve 函数
  - **成果文件**: `kernel/nerv/magi/config/config_rest.go`

- [x] **Phase 2: heartbeat 分派 + prompt + collector 解析 + ack** [已完成 2026-05-02]
  - **完成情况**: 非 sleepMode 使用 `wanna_rest_*` 工具 + tool_choice `required`；提示词改为"工作日志工具"；解析/ack 支持 rest
  - **成果文件**: `coordinator/heartbeat.go`, `prompts/core.go`, `coordinator/collector_helpers.go`, `coordinator/collector_state.go`

- [x] **Phase 3: tool_result_memory 持久化 + downtime 整理路径** [已完成 2026-05-02]
  - **完成情况**: callout 区分 DREAM/NOTE；新增 rest 整理路径（finalizeHeartbeatRestRound + 配套函数）；`materializeToolResultForContext` 修复为支持 rest 工具
  - **成果文件**: `coordinator/tool_result_memory.go`, `coordinator/heartbeat_downtime.go`

- [x] **Phase 4: collector_sage + toolcall_context + passive_recall + types 适配** [已完成 2026-05-02]
  - **完成情况**: `checkWannaDowntime` / `maybeMaterializeAckToolResult` / `matchDowntimeRecallBlock` 扩展支持 rest；消息 meta 区分 `"wanna-sleep"`/`"wanna-rest"`
  - **成果文件**: `coordinator/collector_sage.go`, `coordinator/toolcall_context.go`, `coordinator/passive_recall.go`, `types/types.go`

- [x] **Phase 5-7: 命名彻底分离** [已完成 2026-05-02]
  - **完成情况**:
    - `types.go`: `WannaSleepTool` → `HeartbeatDowntimeTool`；`WantsSleep` → `WantsDowntime`；`SleepNote` → `DowntimeNote`；`SleepSummary` → `DowntimeSummary`；`SleepToolCall` → `DowntimeToolCall`；`SleepAssistantDraft`/`SleepReasoningDraft` → `Downtime*`；`PassiveRecallBasisPreviousSleep` → `PassiveRecallBasisPreviousDowntime`；`RuntimeStateSleeping` → `RuntimeStateDowntime`；`LastSleepAt`/`LastSleepSummary` → `LastDowntime*`
    - `collector_helpers.go`: `parseWannaSleepToolContent` → `parseWannaDowntimeToolContent`；`cloneWannaSleepToolCall` → `cloneWannaDowntimeToolCall`；`countSleepingResponses` → `countDowntimeResponses`；`buildHeartbeatSleepPreview` → `buildHeartbeatDowntimePreview`
    - `collector_sage.go`: `checkWannaSleep` → `checkWannaDowntime`；内部变量 `sleepNote`/`hasSleep` → `downtimeNote`/`hasDowntime`
    - `heartbeat_sleep.go` → 重命名为 `heartbeat_downtime.go`；`resolveHeartbeatSleepResponses` → `resolveHeartbeatDowntimeResponses`；`synthesizeHeartbeatSleepWithDominant` → `synthesizeHeartbeatDowntimeWithDominant`；`buildHeartbeatSleepHistoryToolCall` → `buildHeartbeatDowntimeHistoryToolCall`
    - `tool_result_memory.go`: `wannaSleepMemoryLocation` → `downtimeMemoryLocation`；`materializeWannaSleepToolResultForContext` → `materializeWannaDowntimeToolResultForContext`；`persistWannaSleepMemoryEntryToNotebook` → `persistWannaDowntimeMemoryEntryToNotebook`；`buildSleepNoteCalloutMarkdown` → `buildDowntimeNoteCalloutMarkdown`
    - `passive_recall.go`: `matchSleepRecallBlock` → `matchDowntimeRecallBlock`；scope `"casper-sleep-notes"` → `"casper-downtime-notes"`
    - `heartbeat.go`/`collector.go`: `Sleeping`/`Sleeper`/`SleepSummary` → `Downtime`/`DowntimeSage`/`DowntimeSummary`
    - `api/magi_runtime.go` + websocket/events.go + 测试文件同步更新
  - **成果文件**: 全部 9 个 Go 源文件

- [x] **Phase 8: 持久化路径漏修** [已完成 2026-05-02]
  - **完成情况**: `materializeToolResultForContext` 条件 `IsWannaSleepToolName` → `IsWannaSleepOrRestToolName`，rest 工具结果正确经过持久化处理
  - **成果文件**: `coordinator/tool_result_memory.go`
