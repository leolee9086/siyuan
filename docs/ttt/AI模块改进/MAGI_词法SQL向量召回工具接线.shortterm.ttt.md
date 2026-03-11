# MAGI 词法SQL向量召回工具接线（近期子计划）执行跟踪 (TikTocTak)

> **目标**: 在不重复实现内核检索能力的前提下，为三贤人补齐“被动召回 + 主动查询”工具接线，统一词法检索、SQL 检索、向量检索契约，并纳入单轮多步工具循环。
> 量化目标：
> 1. 被动召回 100% 复用现有内核检索链路，并完成“检索分词层”与“MAGI 词级分词层”职责拆分。
> 2. 仅 Melchior/Balthazar 单轮可多次主动调用笔记查询工具（各自每轮至少 N>=3 步）；Casper 不进行主动查询，仅走被动召回与快速决策信号路径，直到 `decision_signal/handoff_to_trinity/预算终止`；`speak` 仅由 Trinity 调用。
> 3. 词法/SQL/向量工具的请求字段、返回结构、错误语义、预算字段全部文档化并可测试。
> 4. 非数据安全场景不做静默回退，错误在返回值、事件、日志至少两处可观测。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从“近期计划”中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到“已归档/已完成”区域。
> 4. 将“中期计划”中的条目提升到“近期计划”。
>
> **父计划**:
> - [`docs/ttt/MAGI_三贤人机制完善.ttt.md`](./MAGI_三贤人机制完善.ttt.md)
>
> **适用规程**:
> - [`docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`](../规程/tiktoctac文档(ttt)编写规程.procedure.md)

---

## 核心原则

1. **分词能力分层**: `siyuan` 分词器用于 SQLite FTS 检索索引与匹配；MAGI 词法召回使用词级分词层（复用现有 `gse` 能力）做语义词项抽取与查询构造。
2. **复用优先**: 分词层复用现有 `gse` 依赖，检索层复用现有 FTS/SQL/向量 API，仅在 MAGI 工具层做接线。
3. **契约先行**: 先冻结输入/输出/错误/预算契约，再进入实现与测试。
4. **循环受控**: 主动查询必须纳入统一步数和超时预算，不允许失控循环。
5. **任其崩溃**: 非数据安全场景不得静默回退，不以“空结果”掩盖错误。
6. **角色能力隔离**: 主动查询能力仅向 Melchior/Balthazar 开放，Casper 维持“被动召回 + 快速判断”职责。

**验证检查清单**:
- [ ] “FTS 检索分词层 vs MAGI 词级分词层”模块位置、调用边界、返回结构、成本边界可直接定位。
- [ ] MAGI 工具层存在词法/SQL/向量三类查询契约，且与内核入口一一对应。
- [ ] Melchior/Balthazar 单轮工具循环支持多步调用并具备统一终止原因。
- [ ] Casper 主动查询步数为 0，仅输出快速决策信号进入 Trinity。
- [ ] 三贤人使用“决策结束信号工具族”进入 Trinity，不将 `speak` 作为终止工具。
- [ ] 不存在新增分词器/重复索引/平行检索引擎建设计划。
- [ ] 错误语义在返回值、事件、日志至少两处可追踪。

---

## 现状评估 (2026-03-10)

1. 内核已具备词法检索、SQL 查询、向量查询入口与实现路径，可直接复用为召回执行层。
2. FTS 分词能力由 SQLite 扩展与 FTS 表定义提供，适合作为检索底座而非 MAGI 词级语义分词层本体。
3. 后端已引入 `gse` 并在 `seraph` 模块落地词级分词，可复用于 MAGI 词法召回前处理。
4. MAGI 当前默认工具集未暴露完整“按贤者分层的笔记查询工具 + 决策结束信号工具族”契约，角色边界仍可能被混淆。
5. 向量栈已包含 `vectordb` 能力与 Vamana/Disk 索引路径，可作为语义召回能力源。

### 代码参考（仅位置与影响范围）

1. `kernel/sql/database.go`
   - 影响范围：`sqlite3_extended` 驱动与 FTS 表（`siyuan` 分词）创建，定义检索分词层边界。
2. `kernel/go.mod`
   - 影响范围：`go-sqlite3` replace 与 `github.com/go-ego/gse` 依赖声明，定义双分词能力来源边界。
3. `kernel/nerv/seraph/atf_style.go`
   - 影响范围：现有 `gse` 初始化、分词调用与降级路径，可复用于 MAGI 词级分词层实现策略。
4. `kernel/api/router.go`
   - 影响范围：`/api/search/fullTextSearchBlock`、`/api/query/sql`、`/api/embedding/blocks/query`、`/api/vector/query` 路由入口。
5. `kernel/api/search.go`
   - 影响范围：词法检索参数解析和响应字段边界。
6. `kernel/model/search.go`
   - 影响范围：`method=0/1/2/3` 检索分发语义（关键字/查询语法/SQL/正则）与块结果结构。
7. `kernel/api/sql.go`
   - 影响范围：SQL API 入口协议与错误返回边界。
8. `kernel/sql/block_query.go`
   - 影响范围：SQL 解析与 `LIMIT` 成本控制路径。
9. `kernel/api/embedding.go`
   - 影响范围：文本到向量的相似块查询入口及参数边界。
10. `kernel/api/vector.go`
   - 影响范围：通用向量查询入口及 `top_k/ef_search` 查询预算边界。
11. `kernel/vectordb`
    - 影响范围：向量索引能力边界（含 BBQ/Vamana/Disk 索引实现）。
12. `kernel/nerv/magi/config/config.go`
    - 影响范围：MAGI 工具定义扩展点，新增查询工具契约的注册边界。
13. `kernel/nerv/magi/config/manager.go`
    - 影响范围：贤者默认工具装配与强制注入逻辑，决定查询工具是否生效。
14. `kernel/nerv/magi/stream/processor.go`
    - 影响范围：`speak` 与 `deliberation_signal` 解析边界，三贤人终止信号与 Trinity 输出信号拆分影响范围。
15. `kernel/nerv/magi/coordinator/collector.go`
    - 影响范围：三贤人结果收集阶段对决策信号工具族的解析与回填语义。
16. `kernel/nerv/magi/coordinator/trinity.go`
    - 影响范围：Trinity 阶段 `speak` 强约束与最终输出判定边界。
17. `kernel/nerv/magi/prompts/core.go`
    - 影响范围：Trinity `speak` 强制调用口径与输出规则约束。

---

## ℹ️ 如何维护此文档

1. **只写接线**: 本文档仅覆盖“检索能力接线与契约”，不承载新检索引擎设计。
2. **单任务在途**: 同时仅允许一个近期任务为 `[-]`。
3. **契约先归档**: 每个阶段归档前必须具备字段契约、预算边界、验收证据。
4. **拒绝重复建设**: 发现与内核现有能力重叠的计划，必须先回退并改为复用方案。

---

## 🟢 近期计划

- [ ] **Phase R1: 分词器与检索入口口径冻结 (P0)**
  - **背景**: Phase 1 阻塞点是“分词器是什么、接口在哪、是否可直接调用”未被明确。
  - **行动**:
    1. 锁定双层口径：`siyuan` 归属 FTS 检索分词层；MAGI 词法召回归属词级分词层（复用 `gse`）。
    2. 冻结词法/SQL/向量三条复用入口与字段边界（请求字段、返回字段、预算字段）。
    3. 明确“MAGI 词级分词层先做词项抽取与查询构造，再路由到既有检索链路完成召回”。
    4. 增加自定义词表计划：基于笔记词频统计构建领域词典，定义版本、更新周期和回滚策略。
  - **验收标准**:
    - 文档可回答“模块位置、调用边界、返回结构、成本边界”四个问题且无冲突。
    - 明确 `gse` 为 MAGI 词级分词层基础能力，并给出词典管理策略。
    - 不存在新增分词器/检索引擎的任务项。
  - **参考文档**:
    - `kernel/sql/database.go`
    - `kernel/go.mod`
    - `kernel/nerv/seraph/atf_style.go`
    - `kernel/api/router.go`
    - `kernel/api/search.go`
    - `kernel/model/search.go`
    - `kernel/api/sql.go`
    - `kernel/api/embedding.go`
    - `kernel/api/vector.go`

- [ ] **Phase R2: 被动召回契约与 recall envelope 接线设计 (P0)**
  - **背景**: 三贤人每轮必须先被动召回，但当前缺少统一 envelope 契约。
  - **行动**:
    1. 约定被动召回最低字段集（查询条件、命中列表、空命中标记、错误字段、预算字段）。
    2. 约定空命中与失败的区分语义，禁止以空结果掩盖错误。
    3. 约定召回结果注入贤者上下文的位置和顺序，保证三贤人行为一致。
    4. 在 envelope 中补充分词观测字段（`tokenizer_profile`、`lexicon_version`、`token_count`）。
  - **验收标准**:
    - 三贤人被动召回契约字段一致，且可直接映射到现有检索返回结构。
    - 命中/空命中/失败/预算终止可被结构化区分。
    - 可追踪到本轮使用的词级分词配置与词表版本。
  - **参考文档**:
    - `kernel/nerv/magi/sages/sage.go`
    - `kernel/nerv/magi/coordinator/collector.go`
    - `kernel/api/search.go`
    - `kernel/model/search.go`

- [ ] **Phase R3: 主动查询工具接线设计（Melchior/Balthazar 词法+SQL+向量） (P0)**
  - **背景**: 主动查询能力需保留给 Melchior/Balthazar，避免 Casper 角色漂移。
  - **行动**:
    1. 定义三类查询工具契约并映射到既有内核入口。
    2. 约定词级分词前处理（`gse`）与检索执行层（FTS/SQL/向量）的拼接顺序。
    3. 约定三类工具在单轮循环中的预算和优先级（先词法，再 SQL/向量按需触发）。
    4. 明确工具注册分层：Melchior/Balthazar 开启主动查询；Casper 不注册主动查询工具。
    5. 约定工具错误传播和中断语义，保持 crash-only。
    6. 约定仅在 `decision_signal/handoff_to_trinity/预算终止/错误` 下结束该贤者本轮，`speak` 留给 Trinity 输出阶段。
  - **验收标准**:
    - 三类工具均有明确契约和入口映射，不新增平行实现。
    - Melchior/Balthazar 每轮可执行多步查询并保持可观测终止原因。
    - Casper 主动查询步数为 0，且保持可观测的快速决策信号路径。
    - 三贤人终止与 Trinity `speak` 输出边界清晰且可回放。
  - **参考文档**:
    - `kernel/nerv/magi/config/config.go`
    - `kernel/nerv/magi/config/manager.go`
    - `kernel/nerv/magi/stream/processor.go`
    - `kernel/api/search.go`
    - `kernel/api/sql.go`
    - `kernel/api/embedding.go`
    - `kernel/api/vector.go`

- [ ] **Phase R4: 向量能力分层接入与 S-Forge 复用评估 (P1)**
  - **背景**: 向量召回需兼容现有 `vectordb` 与上游 S-Forge 能力，避免重复建设。
  - **行动**:
    1. 评估当前分支 `vectordb` 能力与 S-Forge 分支向量路径的接口兼容性。
    2. 制定“先接线后增强”的分层方案：先复用现有 `/api/embedding` 与 `/api/vector`，再评估 DiskANN 增强。
    3. 定义向量召回灰度策略和失败语义（不可用即显式失败，不静默降级为伪成功）。
  - **验收标准**:
    - 向量接线计划明确“当前复用路径”和“后续增强路径”边界。
    - 不存在新建独立向量存储栈的任务项。
  - **参考文档**:
    - `kernel/vectordb`
    - `kernel/api/embedding.go`
    - `kernel/api/vector.go`
    - `docs/ttt/vectordb/DiskANN设计.shortterm.ttt.md`
    - `docs/ttt/vectordb/Vamana-BBQ集成.ttt.md`

---

## 🟡 中期计划

- [ ] **Phase R5: 三贤人工具观测与回放治理 (P1)**
  - **背景**: 多步检索接线后需要长期稳定性与问题回放能力。
  - **行动**: 对齐 `round_id/seel/step/tool/termination_reason` 事件字段，并形成回放模板。
  - **验收标准**: 任一异常轮次可在不看源码情况下定位到工具层失败点。

- [ ] **Phase R6: 检索预算自适应策略 (P2)**
  - **背景**: 不同输入复杂度下固定预算可能导致高延迟或低命中。
  - **行动**: 制定按来源可信度和轮次上下文自适应调整召回预算的策略。
  - **验收标准**: 预算调整有明确上限且不破坏 crash-only 语义。

---

## 风险与依赖

1. 若不区分“词级分词层”与“检索分词层”，词法/SQL/向量契约会出现语义漂移。
2. Melchior/Balthazar 多步主动查询若无预算闸门，可能引发延迟放大和成本失控。
3. 角色门禁若配置错误，Casper 可能被卷入主动查询循环，导致快速响应特性退化。
4. 自定义词表若无版本与回滚策略，可能引入召回不稳定和线上漂移。
5. 向量能力跨分支复用若边界不清，容易出现重复建设或兼容性回退。
6. Crash-only 收敛会提升显式失败率，需要同步事件与日志治理。

---

## 🏁 已归档/已完成

- [x] **立项：词法SQL向量召回工具接线子计划创建** [已完成 2026-03-10]
  - **背景**: 主计划 Phase 1/2 对“分词器口径与查询工具接线”存在高耦合阻塞，需要独立子计划分解。
  - **完成情况**: 已建立阶段目标、复用边界、验收标准和代码影响范围清单。
  - **成果文件**:
    - `docs/ttt/MAGI_词法SQL向量召回工具接线.shortterm.ttt.md`
  - **参考文档**:
    - `docs/ttt/MAGI_三贤人机制完善.ttt.md`
    - `docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`
