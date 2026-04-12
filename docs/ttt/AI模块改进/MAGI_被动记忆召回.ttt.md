# MAGI 被动记忆召回执行跟踪 (TikTocTak)

> **目标**: 在 `kernel/nerv/magi` 中落地“主界面外界对话 + 睡眠轮次”的被动记忆召回，使三贤人在收到输入前能够获得最多 10 条“可能相关的笔记 ID + 整体关键词命中统计”线索，但不直接获得笔记正文；真实回忆仍需模型自行调用现有笔记搜索工具完成。量化指标：
> 1. 主界面外界对话 `100%` 与原始用户消息同轮附带被动召回结果。
> 2. 被动召回 `100%` 复用现有 `search_notes_by_keywords` 同源检索链路，不新增平行检索引擎。
> 3. 每人格被动召回结果数量上限固定为 `10`，正文直传率为 `0%`。
> 4. 睡眠轮次 `100%` 按“上一轮用户消息+AI 回复 / 上一轮睡前笔记”二选一构造查询依据。
> 5. 命中、空命中、失败、范围过滤四类路径均具备回归测试。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从“近期计划”中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到“已归档/已完成”区域。
> 4. 将“中期计划”中的条目提升到“近期计划”。
>
> **关联 ttt**:
> - [`docs/ttt/AI模块改进/MAGI_三贤人机制完善.ttt.md`](./MAGI_三贤人机制完善.ttt.md)
> - [`docs/ttt/AI模块改进/MAGI_词法SQL向量召回工具接线.shortterm.ttt.md`](./MAGI_词法SQL向量召回工具接线.shortterm.ttt.md)
>
> **适用规程**:
> - [`docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`](../../规程/tiktoctac文档(ttt)编写规程.procedure.md)

---

## 核心原则

1. **同源检索**: 被动召回必须复用现有笔记搜索同源链路，优先复用 `note_query_tool.go` 中的分词、查询构造和全文检索执行逻辑。
2. **只给线索不给正文**: 被动召回只向模型提供“笔记 ID + 整体关键词命中统计 + 召回原因”，不直接注入笔记正文、块内容或归档 JSON 明细。
3. **人格范围隔离**: Melchior、Balthazar、Casper 的被动召回范围必须独立可验证，不允许互相串用。
4. **同轮注入**: 主界面外界对话中的被动召回结果必须与原始用户消息同轮发送给 AI，不能滞后一轮，也不能只写入日志不入模。
5. **睡眠依据确定性**: 睡眠轮次的查询依据必须严格遵循“上一轮若存在用户消息则用用户消息+AI 回复，否则用上一轮睡前笔记”的固定规则。
6. **显式失败**: 空命中与召回失败必须可区分；非数据安全场景不允许用“空结果”掩盖检索或过滤错误。

**验证检查清单**:
- [x] 主界面对话入口可观察到被动召回注入，并与原始用户消息同轮进入模型输入。
- [x] 被动召回结果数量不超过 10，且上下文中不包含被召回笔记正文。
- [x] 被动召回结果包含整体关键词命中统计，模型可据此自行再次调用检索工具。
- [x] Melchior 只召回 AI 主笔记本及 AI 被允许查看范围内的笔记。
- [x] Casper 只召回睡前笔记范围。
- [x] Balthazar 只召回主动记录笔记范围。
- [x] 睡眠轮次可在“上一轮用户消息+AI 回复”与“上一轮睡前笔记”之间做确定性切换。
- [x] 命中、空命中、失败、范围过滤和数量截断均有测试覆盖。

---

## 现状评估（立项时基线，2026-04-11）

1. `kernel/nerv/magi/coordinator/note_query_tool.go` 已具备词级分词、全文检索、AI 主笔记本访问范围过滤与数量限制逻辑，是本次被动召回的直接复用基础。
2. `kernel/nerv/magi/prompts/source.go` 已具备把来源信封与原始用户消息打包进同一条模型输入的能力，适合扩展 recall envelope。
3. `kernel/nerv/magi/prompts/core.go` 已约定模型会接收多类 `<source=...>` / envelope 消息，但尚未定义被动召回信封及其使用规则。
4. `kernel/nerv/magi/coordinator/heartbeat.go` 与 `heartbeat_sleep.go` 已建立睡眠轮次、睡前笔记与合并睡前笔记流程，但尚未在唤醒轮次加入被动召回查询。
5. `kernel/nerv/magi/coordinator/tool_result_memory.go` 与 `diary_tool.go` 已为睡前笔记、主动记录笔记建立属性标记，为范围过滤提供了现成锚点。
6. 当前运行时只维护了睡眠摘要和轮次状态，尚缺“上一轮外界用户消息 + AI 回复摘要”的内部追踪结构。

### 代码参考（仅位置与影响范围）

1. `kernel/nerv/magi/coordinator/note_query_tool.go`
   - 影响范围：分词、查询构造、全文检索执行、AI 主笔记本访问过滤。
2. `kernel/model/ai_main_notebook.go`
   - 影响范围：AI 主笔记本、可访问根文档、被引用可读范围判定。
3. `kernel/nerv/magi/coordinator/coordinator.go`
   - 影响范围：主界面对话模型输入组装、来源感知用户输入封装。
4. `kernel/nerv/magi/prompts/source.go`
   - 影响范围：信封顺序、被动召回与原始用户消息同轮注入位置。
5. `kernel/nerv/magi/prompts/core.go`
   - 影响范围：模型对 recall envelope 的认知规则与“仅线索、不等同正文”的约束。
6. `kernel/api/magi.go`
   - 影响范围：外界对话入口、最近用户消息抽取、会话维持与前台轮次完成时机。
7. `kernel/api/magi_runtime.go`
   - 影响范围：心跳唤醒、睡眠完成、上一轮摘要的内部运行时记录。
8. `kernel/nerv/magi/coordinator/heartbeat.go`
   - 影响范围：睡眠轮次模型输入、被动召回接入位置。
9. `kernel/nerv/magi/coordinator/heartbeat_sleep.go`
   - 影响范围：上一轮睡前笔记来源、睡眠完成后的记忆追踪。
10. `kernel/nerv/magi/coordinator/tool_result_memory.go`
   - 影响范围：睡前笔记属性、查询结果归档、记忆块属性锚点。
11. `kernel/nerv/magi/coordinator/diary_tool.go`
   - 影响范围：主动记录笔记属性锚点与范围过滤。
12. `kernel/nerv/magi/types/types.go`
   - 影响范围：如需补充 recall payload 或运行时摘要结构，将在此处冻结字段语义。

---

## ℹ️ 如何维护此文档

1. **单任务在途**：近期计划中同时只能有一个任务标记为 `[-]`。
2. **先冻结契约再写代码**：在 recall envelope、ID 口径、范围过滤规则未冻结前，不进入实现归档。
3. **验收跟着规则走**：每个阶段归档时必须明确写出“命中数量、是否泄露正文、范围是否正确、测试是否存在”。
4. **不要把失败写成空命中**：若实现中发现查询失败、属性过滤失败或运行时摘要缺失，必须在文档和代码中保留显式错误语义。

---

## 🟢 近期计划

- [ ] **Phase 5: 被动召回排序与去重稳定性治理 (P1)**
  - **背景**: 睡前笔记、主动记录和普通笔记可能跨多天重复命中，需要稳定的去重和排序口径。
  - **行动**: 冻结不同记忆类型的去重键、排序规则和同分处理策略。
  - **验收标准**: 同一查询在无数据变化时返回顺序稳定，可解释。

- [ ] **Phase 6: 被动召回观测面板与调优字段补齐 (P2)**
  - **背景**: 后续需要调优命中质量与范围过滤命中率。
  - **行动**: 规划 recall 级别的观测字段，如 `queryBasisType`、`recallScope`、`hitCount`、`truncated`。
  - **验收标准**: 任一召回异常轮次可定位到查询依据、命中数量和过滤范围。

---

## 🟡 中期计划

- [ ] 暂无；待 Phase 5/6 拆出更细颗粒任务后回填。

---

## 风险与依赖

1. 若被动召回不严格复用现有笔记搜索同源链路，后续会出现“主动搜索”和“被动召回”结果不一致。
2. 若把睡前笔记或主动记录正文直接注入模型，会破坏“AI 需要自行调用工具回忆”的设计边界。
3. 若缺少“上一轮外界对话摘要”内部追踪，睡眠轮次查询依据会退化为固定心跳提示词。
4. 若 ID 口径没有冻结，模型可能拿到无法再次检索或无法解释的 recall item。
5. 若属性过滤测试不足，Balthazar/Casper 的范围很容易误召回到普通主笔记本内容。

---

## 🏁 已归档/已完成

- [x] **Phase 4: 回归测试与可观测性补齐 (P1)** [已完成 2026-04-11]
  - **背景**: 被动召回跨越提示词封装、主界面对话入口、心跳轮次与范围过滤，需要先把关键行为锁进测试。
  - **完成情况**:
    - 新增 `kernel/nerv/magi/coordinator/passive_recall_test.go`，覆盖 Melchior/Casper/Balthazar 的范围过滤、关联说明（`relatedTo`）、整体关键词命中统计（`keywordHitCounts`）、数量截断和显式错误。
    - 更新 `kernel/nerv/magi/coordinator/dominant_reply_test.go`、`collector_test.go`、`heartbeat_test.go` 以适配按人格注入的输入签名。
    - 新增 `kernel/api/magi_runtime_test.go` 用例，覆盖“上一轮对话优先，否则睡前笔记”的召回依据选择。
    - 补充回归：断言 `source=user_message` 保留原始 heartbeat 提示词本身，而不是退化为渠道历史说明文本。
    - 保留 `kernel/nerv/magi/prompts/source_test.go` 对 `passive_memory_recall` 信封的回归验证。
  - **验收结果**:
    - 命中、空命中、失败、范围过滤与数量截断均有测试覆盖。
    - 测试可直接断言 recall 结果不含正文，但会明确给出“这些 ID 跟什么相关”（`relatedTo`）以及整体关键词命中统计（`keywordHitCounts`）。
    - 定向测试通过：`go test -vet=off ./nerv/magi/coordinator -run "PassiveRecall|CoordinateHeartbeat|CollectHeartbeatResponses|CoordinateDominantDirectReply|BuildSourceAwareUserInput"`、`go test -vet=off ./api -run "MagiRuntimeManager"`、`go test -vet=off ./nerv/magi/prompts`。

- [x] **Phase 3: 睡眠轮次查询依据与被动召回接线 (P1)** [已完成 2026-04-11]
  - **背景**: 睡眠轮次必须根据上一轮真实上下文触发被动召回，而不是只看固定 heartbeat 提示词。
  - **完成情况**:
    - 在 `kernel/api/magi_runtime.go` 增加上一轮用户消息、AI 回复和睡前笔记摘要追踪。
    - 在 `kernel/api/magi.go` 的前台共识完成路径记录最近一轮真实用户消息与 AI 回复。
    - 在 `kernel/nerv/magi/coordinator/heartbeat.go` 中接入 `PassiveRecallBasis`，将睡眠轮次的召回依据同轮注入三贤人。
    - 修正 `kernel/nerv/magi/coordinator/coordinator.go` 的 source-aware 输入构造，确保 heartbeat 的原始唤醒提示词与 recall 线索同轮直送模型。
  - **验收结果**:
    - 若上一轮存在真实用户消息，则睡眠轮次使用“用户消息 + AI 回复”作为查询依据。
    - 若上一轮不存在用户消息，则回退使用上一轮睡前笔记内容。
    - 睡眠轮次仍遵守“最多 10 条、只给线索不给正文”的边界。

- [x] **Phase 2: 主界面外界对话被动召回接线 (P0)** [已完成 2026-04-11]
  - **背景**: 主界面外界对话需要在入模前完成被动召回，并把 recall 线索和用户消息一同发送给 AI。
  - **完成情况**:
    - 新增 `kernel/nerv/magi/coordinator/passive_recall.go`，复用 `note_query_tool.go` 的分词、查询构造、全文检索与重排链路。
    - 在 `kernel/nerv/magi/coordinator/coordinator.go` 中按人格生成被动召回结果，并仅对 `magi-main-ui` 外界对话启用直连 recall。
    - 在 `kernel/nerv/magi/coordinator/dominant_reply.go`、`dominance.go`、`collector.go`、`heartbeat.go` 中接入“按人格输入”的模型入参，保证 Melchior/Balthazar/Casper 收到各自范围的 recall payload。
  - **验收结果**:
    - 被动召回最多返回 10 条线索，仅携带 ID、范围、关联说明（`relatedTo`）、整体关键词命中统计（`keywordHitCounts`）、空命中/失败状态与截断标记。
    - Melchior 仅召回 AI 主笔记本与 AI 可读范围；Casper 仅召回睡前笔记；Balthazar 仅召回主动记录。
    - recall 线索与用户消息同轮入模，并提示模型如需真正回忆正文，必须自行调用 `search_notes_by_keywords`。

- [x] **Phase 1: 被动召回契约与 envelope 顺序冻结 (P0)** [已完成 2026-04-11]
  - **背景**: 需要先冻结 recall envelope 契约，才能保证主界面外界对话与睡眠轮次使用同一套入模结构。
  - **完成情况**:
    - 在 `kernel/nerv/magi/types/types.go` 增加 `PassiveRecallBasis` 及其类型枚举，冻结查询依据字段。
    - 在 `kernel/nerv/magi/prompts/source.go` 增加 `BuildSourceAwareUserInputWithRuntimeAndRecall(...)`，固定 `runtime_clock -> workspace_snapshot -> request_source -> claimed_recent_history -> passive_memory_recall -> source=user_message` 顺序。
    - 在 `kernel/nerv/magi/prompts/core.go` 明确模型只能把 recall 视作“线索”，不能把它当作正文或直接记忆恢复结果。
  - **验收结果**:
    - 代码与文档可明确回答 recall 传什么、不传什么、放在什么位置、ID 如何解释。
    - recall envelope 可以表达空命中、显式失败与截断状态，且不混淆。

- [x] **立项：MAGI 被动记忆召回 TTT 建立** [已完成 2026-04-11]
  - **背景**: 在修改 `nerv/magi` 前，需要先按规程冻结这次“主界面对话 + 睡眠轮次”被动召回的执行路线。
  - **完成情况**: 已完成目标、核心原则、范围边界、阶段拆解、验收标准与影响文件清单。
  - **成果文件**:
    - `docs/ttt/AI模块改进/MAGI_被动记忆召回.ttt.md`
  - **参考文档**:
    - `docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`
    - `docs/规程/无限滚动任务(infinity-ttt)编写规程.procedure.md`
    - `docs/ttt/AI模块改进/MAGI_三贤人机制完善.ttt.md`
