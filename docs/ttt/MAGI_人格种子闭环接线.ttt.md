# MAGI 人格种子闭环接线执行跟踪 (TikTocTak)

> **目标**: 将当前已落地的 IPIP-NEO-120 问卷采集链路升级为“可驱动三贤者运行时人格”的闭环，达成 `原始答案 + 主体元信息 + 四轨描述 -> PersonaBase(OCEAN+30) -> 四视角Prompt -> MAGI实例重载` 的端到端接线。量化指标：前端保存后自动生成 `IpipPersonaProfile` 并生效到下一轮对话，且不破坏现有共识链路；支持“描述补问卷”和“问卷补描述”双向收敛。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。
>
> **关联调研**: [`docs/调研/MAGI实现状态调研.md`](../调研/MAGI实现状态调研.md)
>
> **设计文档**:
> - [`docs/设计/大五人格标测问卷(IPIP-NEO-120).design.md`](../设计/大五人格标测问卷(IPIP-NEO-120).design.md)
> - [`docs/设计/MAGI_人格种子生成机制.design.md`](../设计/MAGI_人格种子生成机制.design.md)
> - [`docs/设计/MAGI_大五人格映射掩码矩阵.design.md`](../设计/MAGI_大五人格映射掩码矩阵.design.md)
>
> **关联 ttt**:
> - [`MAGI_问卷系统迁移_自定义题库到IPIP-NEO-120.ttt.md`](./MAGI_问卷系统迁移_自定义题库到IPIP-NEO-120.ttt.md)
> - [`MAGI_人格种子采样问卷前端整合.ttt.md`](./MAGI_人格种子采样问卷前端整合.ttt.md)
> - [`MAGI_描述与问卷双向收敛.ttt.md`](./MAGI_描述与问卷双向收敛.ttt.md)
> - [`MAGI_通用Diff模块选型与落地.ttt.md`](./MAGI_通用Diff模块选型与落地.ttt.md)
> - [`MAGI_问卷结果接入三贤人_最小改造.ttt.md`](./MAGI_问卷结果接入三贤人_最小改造.ttt.md)
>
> **当前阶段边界 (2026-03-03)**: 已进入“问卷结果接入三贤人”实施阶段；当前优先完成最小接线（事件契约、提示词注入、重载回退），并保持现有回答链路与消息结构兼容。

---

## 核心原则

1. **先闭环后扩展**: 先打通“采集数据驱动运行时人格”，再做 EMA/四盲/Seraph 等增强。
2. **前后端职责清晰**: 前端可以先实现可复核计分用于运行时注入；权威长期档案仍由后端统一兜底。
3. **不破坏主链路**: 人格接线不得影响现有 `sendUserMessageWithConsensus` 正常行为。
4. **可回滚**: 注入失败时应回退到默认提示词，保证 MAGI 至少可用。
5. **可观测**: 每次人格重载必须有可追踪日志/系统消息，避免“生效与否不可见”。
6. **四轨描述分责**: 职业描述给 Melchior、生活描述给 Balthazar、自身需求描述给 Casper、综合自我描述给 Trinity，不混线。
7. **阶段推进受控**: 先完成接线方案与最小改造边界评审，再进入代码实施，避免一次性改动过大。

**验证检查清单**:
- [x] 主体元信息包含 `organization`、`role`、`careerGoal`
- [x] 四轨描述输入完整：`professionalDescription`、`lifeDescription`、`instinctNeedsDescription`、`integratedDescription`
- [x] `IPIP-NEO-120` 原始答案可计算为 `PersonaBase`（含 5 traits + 30 facets）
- [x] 生成的 `IpipPersonaProfile` 结构符合 `schemaVersion/subject/personaBase/generatedAt`
- [x] 支持“描述 -> 问卷建议作答”（用户可一键填充并逐题覆盖）
- [x] 建议交互增强：支持“查看建议并定位题目 / 接受拒绝即时反馈 / 作答后自动注销对应建议”
- [x] 支持“问卷 -> 描述补充建议”（含按维度更新、Trinity 门槛控制，不强覆盖手写原文）
- [ ] `magi-mobile` 开发编译稳定通过（`build:magi-mobile` 已通过，`dev:magi-mobile` 仍需稳定复核）
- [ ] 描述与问卷答案写入策略明确（是否分离写入 AI 主笔记 / 私有样本文件如何对齐）
- [ ] 四视角 Prompt 通过 `summaryPrompts` 生成并传入 `initMagi(options.prompts)`
- [ ] 问卷保存后触发人格重载，下一轮对话可见人格文本已变化
- [ ] 失败回退逻辑生效：人格注入失败时仍可使用默认提示词继续对话
- [ ] 相关测试通过（至少新增计分和 Prompt 接线的单测）

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 完整性评估 (2026-03-02)

1. **写入域未闭环（问题1结论）**：当前问卷与描述落盘到 `/data/private/*_ipip120_sample_N.json`，并生成 `*_persona_profile_N.json`；尚未分离写入“AI 主笔记”。主要原因是当前阶段边界仍限定在“采集层落盘”，且 `MagiRoot` 保存回调仅追加系统消息，未实现主笔记写入适配。
2. **写入分离策略未定稿**：`sample` 已同时包含问卷答案与四轨描述，`profile` 只含 `personaBase`；尚无“主笔记中结构化分离写入”的规范。
3. **运行时消费缺口**：`MagiRoot` 当前仅在保存后追加系统消息，尚未消费 `profile` 并触发 `initMagi` 人格重载。
4. **开发编译稳定性待最终确认**：生产构建通过，但开发构建仍需做持续性验证，避免 `CompositeRating` 链路回归。
5. **治理能力缺口**：建议确认历史、版本追溯与撤销审计仍以草稿层为主，缺少独立持久化日志。

---

## 🟢 近期计划

- [ ] **Phase 3: 描述与问卷双向收敛 (P0)**
  - **背景**: 仅单向采集会导致“数值像我、文本不像我”或“文本像我、量表不像我”两类偏差。
  - **执行方式**: 已拆分子任务，按 `MAGI_描述与问卷双向收敛.ttt.md` 独立推进与验收。
  - **当前进度**: Phase A 完成；Phase B 已可用并完成交互增强；Phase C 已完成（问卷 -> 四轨描述建议，含 Trinity 门槛与按维度按钮）；当前重点转向“落盘分离策略 + 运行时消费接线”。
  - **行动**:
    1. 实现“描述 -> 问卷建议作答”能力（生成建议分值层，不直接覆盖用户已答）。
    2. 实现“问卷 -> 描述补充建议”能力（生成补充段，不直接覆盖手写原文）。
    3. 提供确认式写入（用户确认后才落入正式档案）。
  - **验收标准**: 双向功能均可触发并回写到 UI；用户可逐项确认或拒绝建议。
  - **参考文档**: `docs/设计/MAGI_人格种子生成机制.design.md`

- [ ] **Phase 4: 采样落盘与档案落盘双写 (P0)**
  - **背景**: 目前只存 `*_ipip120_sample_*.json`，运行时消费所需 `profile` 尚未落盘或缓存。
  - **行动**:
    1. 在问卷提交成功后，基于原始答案生成 `IpipPersonaProfile`。
    2. 增加档案落盘策略（建议并存）：`*_ipip120_sample_N.json` + `*_persona_profile_N.json`。
    3. 将 profile 路径或内容上抛给 `MagiRoot`，供后续注入流程使用。
  - **验收标准**: 提交一次问卷后，私有目录可见成对文件，且 profile 字段完整。
  - **参考文档**: `app/src/magi/entry/PersonaSeedPanel.vue`、`app/src/magi/entry/MagiRoot.ctx.ts`

- [ ] **Phase 4.5: 主笔记写入与数据分离策略定稿 (P0)**
  - **背景**: 当前问卷与描述数据未进入 AI 主笔记，且“样本文件与主笔记”的责任边界未明确。
  - **行动**:
    1. 定义写入拓扑：`sample/profile` 保留在 `/data/private`，主笔记仅写索引与可读摘要，避免重复冗余。
    2. 明确“描述与问卷答案是否分离写入主笔记”的规范（建议分栏分块写入，同一版本号关联）。
    3. 在 `MagiRoot` 保存回调中增加主笔记写入接口（失败不影响样本与档案落盘）。
  - **验收标准**: 一次提交后可在主笔记看到结构化摘要，并可追溯到对应 `sample/profile` 文件。
  - **参考文档**: `app/src/magi/entry/MagiRoot.ctx.ts`、`app/src/magi/entry/persona-seed-panel/PersonaSeedPanel.utils.ts`

- [ ] **Phase 5: 四视角 Prompt 注入与 MAGI 重载 (P1)**
  - **背景**: 现有 `summaryPrompts/personaPromptBuilder` 已存在，但未接入 `initMagi` 启动参数。
  - **执行方式**: 已拆分子任务，按 `MAGI_问卷结果接入三贤人_最小改造.ttt.md` 独立推进与验收。
  - **当前进度**: 已完成规划冻结，明确“提示词与消息结构最小化调整”原则；待进入代码实施。
  - **行动**:
    1. 建立 `IpipPersonaProfile -> options.prompts` 的映射层（melchior/balthazar/casper/trinity）。
    2. 问卷保存后触发 `initializeMAGI`，带入新提示词重建实例。
    3. 为重载成功/失败增加系统消息与回退策略。
  - **验收标准**: 不改用户输入内容时，仅切换 profile 即可观察到输出风格变化；失败时自动降级不崩溃。
  - **参考文档**: `app/src/magi/prompts/personaPromptBuilder.ts`、`app/src/magi/core/wise/mockWise.subclass.ts`、`app/src/magi/composables/useMagi.ts`

---

## 🟡 中期计划

- [ ] **Phase 6: 人格重载体验优化 (P1)**
  - **背景**: 当前规划默认全量重建，用户体验可能有闪断。
  - **行动**:
    1. 评估热更新 `updateConfig(systemPromptForChat)` 与全量重建的稳定性差异。
    2. 在稳定前提下尝试无重连热注入，保留 fallback 到重建方案。
  - **验收标准**: 在不影响一致性的前提下减少重连等待与消息跳变。

- [ ] **Phase 7: 问卷质量与守卫修正 (P2)**
  - **背景**: 现有题干存在少量文案异常，且 `wise.guard` 有 `@AITODO` 弱守卫。
  - **行动**:
    1. 校对 `ipip-neo-120.ts` 中异常题面并更新对照表。
    2. 修复 `是AI响应Chunk` 守卫，避免仅对象判定带来的误判。
  - **验收标准**: 题库文案与设计文档一致；守卫具备最小结构校验能力。

---

## 🏁 已归档/已完成

- [x] **立项：人格种子闭环接线 TTT 建立** [已完成 2026-03-02]
  - **背景**: 调研结论已明确“问卷已采集但未驱动运行时人格”是当前首要缺口。
  - **完成情况**: 建立独立执行跟踪文档，拆分近期/中期阶段并定义量化验收标准。
  - **成果文件**: `docs/ttt/MAGI_人格种子闭环接线.ttt.md`
  - **参考文档**: `docs/调研/MAGI实现状态调研.md`

- [x] **Phase 1: 主体元信息与四轨描述输入落地 (P0)** [已完成 2026-03-02]
  - **背景**: 当前问卷面板缺少职业目标与四轨描述，无法形成稳定人格种子结构。
  - **完成情况**: 已完成职业侧字段、四轨描述输入、草稿持久化与提交载荷结构接线。
  - **成果文件**:
    - `app/src/magi/data/questionnaire.types.ts`
    - `app/src/magi/entry/PersonaSeedPanel.vue`
    - `app/src/magi/components/persona/CompositeRating.ctx.ts`
  - **备注**: 未接入回答流程，保持阶段隔离。

- [x] **Phase 2: PersonaBase 计分模块落地 (P0)** [已完成 2026-03-02]
  - **背景**: 原始答案已采集，但缺少 `answers -> OCEAN+30` 标准化计算与可复核测试。
  - **完成情况**:
    1. 新增计分模块：支持 plus/minus，minus 按 `6-score` 转换。
    2. 完成 `PersonaBase` 与 `IpipPersonaProfile` 构造函数。
    3. 新增单测覆盖中性样本、方向性计分、异常输入、防护 invariant。
    4. 核对设计文档与题库 keyed 分布：`minus=55`，并已修正常量与测试一致。
  - **成果文件**:
    - `app/src/magi/data/ipip-neo-120-scoring.ts`
    - `app/src/magi/data/ipip-neo-120-scoring.test.ts`
    - `app/src/magi/data/questionnaire-sections.ts`

---

## 执行记录

| 日期 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-02 | 创建 ttt | ✅ | 按 `tiktoctac文档(ttt)编写规程` 建立“人格种子闭环接线”执行跟踪 |
| 2026-03-02 | Phase 1 主体元信息与四轨描述输入落地 | ✅ | 完成 UI + 草稿 + 提交载荷结构接线，暂未接入回答流程 |
| 2026-03-02 | Phase 2 PersonaBase 计分模块落地 | ✅ | 完成计分链路与单测；核对设计文档与题库后确认 `minus=55` |
| 2026-03-02 | Phase 3 子任务 Phase A 完成 | ✅ | 双向收敛建议模型、状态机、确认写回与草稿恢复已落地，详见子 TTT |
| 2026-03-02 | Phase 3 子任务 Phase B v1 完成 | ✅ | “描述->问卷建议”已可用：LLM 生成 pending 建议并支持确认写回 |
| 2026-03-02 | Phase 3 子任务 Phase B 交互增强 | ✅ | 新增查看/定位、接受拒绝即时反馈、作答自动注销对应建议 |
| 2026-03-02 | `CompositeRating` 开发编译错误调查 | 🔄 | `magi-mobile` dev 链路持续报 `readonly` 模板解析错误，作为当前 P0 阻塞跟进 |
| 2026-03-02 | Phase 3 子任务 Phase C 启动 | 🔄 | 启动“问卷 -> 描述补充建议”接线，先实现 LLM 生成、pending 入列、确认回写 |
| 2026-03-02 | Phase 3 子任务 Phase C 完成 | ✅ | 问卷 -> 四轨描述建议已可用，支持按维度更新与 Trinity 门槛控制 |
| 2026-03-02 | 完整性评估与落盘策略补缺 | 🔄 | 识别“未写入 AI 主笔记/分离策略未定稿”为当前 P0 完整性缺口 |
| 2026-03-03 | Phase 5 子任务立项（最小改造） | ✅ | 新建“问卷结果接入三贤人”子 TTT，冻结最小改造边界，进入规划态 |
| 2026-03-03 | Phase 5 子任务实施首轮完成 | ✅ | 已落地保存契约扩展、profile->提示词注入、带回退的人格重载与最小回归验证 |
