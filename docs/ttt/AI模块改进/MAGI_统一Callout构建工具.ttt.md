# MAGI 统一 Callout 构建工具执行跟踪 (TikTocTak)

> **目标**: 创建一个统一的 `BuildCalloutMarkdown` 工具函数，替换当前全部 6 个分散的 callout markdown 构建实现，消除多行内容导致 callout 块被撕裂的缺陷。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

## 核心原则

1. **统一入口**: 所有 callout markdown 构建必须通过 `BuildCalloutMarkdown` 单一函数，不得再直接拼接字符串。
2. **逐行安全**: 任何字段 Value 中的多行文本必须按 `\n` 拆解后逐行添加 `> ` 前缀，彻底消除 Lute 解析撕裂。
3. **双模式覆盖**: `CalloutField` 同时支持结构化字段模式（`Label != ""`）和原始内容模式（`Label == ""`），覆盖全部 6 个现有 builder。
4. **空值跳过**: Value 为空的字段自动跳过，减少调用方空值检查代码。
5. **紧凑输出**: 字段间无额外空行，保持 callout 内容紧凑。

**验证检查清单**:
- [ ] 新建 `callout_builder.go` 包含 `CalloutField` 和 `BuildCalloutMarkdown`
- [ ] `buildDiaryCalloutMarkdown` 改用 `CalloutField{Value: markdown}` 原始内容模式
- [ ] `buildSleepNoteCalloutMarkdown` 改用结构化字段模式调用
- [ ] `buildMergedSleepNoteCalloutMarkdown` 改用结构化字段模式调用（根治多行 dominantSummary 撕裂）
- [ ] `buildNoteSearchArchiveCallout` 改为混合模式调用
- [ ] `buildForgeArchiveCallout` 改为结构化字段模式调用
- [ ] `buildGenericArchiveCallout` 改为结构化字段模式调用
- [ ] 所有现有 callout 测试回归通过
- [ ] 新增单元测试覆盖多行值、空值跳过、原始内容模式场景

## ℹ️ 如何维护此文档

1. **完成归档**: 任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**: 当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**: 如果发现计划不合理，随时修改或删除。
4. **数据驱动**: 用数据说话，不凭感觉。

## 🟢 近期计划

- [x] **Phase 1: 计划审批与设计确认 (P0)** [已完成 2026-04-25]
  - **背景**: 需要确认统一 Callout 构建工具的抽象方案是否合理，确认 `CalloutField` 双模式设计是否能覆盖全部 6 个 builder
  - **行动**:
    1. 审核 [`plans/MAGI_统一Callout构建工具设计.md`](../../plans/MAGI_统一Callout构建工具设计.md) 中的类型定义和函数签名
    2. 确认 `buildDiaryCalloutMarkdown` 的 `Label=""` 原始内容模式方案
    3. 确认各 builder 的字段映射方案
    4. 审批后由主任务管理器切换至 Code 模式实施
  - **验收标准**: 设计方案通过用户审批，TTT 状态更新为 `[x]`
  - **完成情况**: 设计方案已通过用户审批
  - **成果文件**: [`plans/MAGI_统一Callout构建工具设计.md`](../../plans/MAGI_统一Callout构建工具设计.md)

- [-] **Phase 2: 实现核心工具函数 (P0)**
  - **背景**: 需要创建 `callout_builder.go` 文件，实现 `CalloutField` 类型和 `BuildCalloutMarkdown` 函数
  - **行动**:
    1. 在 `kernel/nerv/magi/coordinator/` 下新建 `callout_builder.go`
    2. 定义 `CalloutField` 结构体
    3. 实现 `BuildCalloutMarkdown` 函数，处理两种模式、多行拆解、空值跳过
    4. 实现 `BuildCalloutMarkdown` 函数后更新 `callout_builder_test.go`
    5. 单元测试验证所有边界场景
  - **验收标准**: `BuildCalloutMarkdown` 通过全部单元测试，包括多行、空值、无标题、原始内容模式

- [ ] **Phase 3: 重构 callout builder 调用方 (P0)**
  - **背景**: 需要将全部 6 个现有 builder 改为调用 `BuildCalloutMarkdown`
  - **行动**:
    1. 重构 `diary_tool.go` 中的 `buildDiaryCalloutMarkdown`
    2. 重构 `tool_result_memory.go` 中的 `buildSleepNoteCalloutMarkdown`、`buildNoteSearchArchiveCallout`、`buildForgeArchiveCallout`、`buildGenericArchiveCallout`
    3. 重构 `heartbeat_sleep.go` 中的 `buildMergedSleepNoteCalloutMarkdown`
    4. 更新对应测试文件
  - **验收标准**: 所有现有测试通过，`go build ./kernel/nerv/magi/...` 编译通过

- [ ] **Phase 4: 回归测试与验证 (P1)**
  - **背景**: 确保重构不破坏现有功能
  - **行动**:
    1. 运行全部 coordinator 包测试
    2. 验证 `.sy` 文档中 callout 结构正确（`NodeCallout` 包含所有子节点）
  - **验收标准**: 全部测试通过，callout 结构正确无撕裂

## 🟡 中期计划

- [ ] **无**（单次有限任务，无中期计划）

## 🏁 已归档/已完成

（暂无）
