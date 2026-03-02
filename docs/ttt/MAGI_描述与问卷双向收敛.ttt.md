# MAGI 描述与问卷双向收敛执行跟踪 (TikTocTak)

> **目标**: 在不接入回答链路的前提下，完成“描述 -> 问卷建议”与“问卷 -> 描述补充”双向收敛闭环，实现 `建议生成 -> 用户确认 -> 回写保存` 的稳定流程。
>
> **阶段边界 (2026-03-02)**:
> 1. 本子任务只处理人格种子采集层，不改 `useMagi/initMagi/sendUserMessageWithConsensus`。
> 2. 自动“描述补全”必须使用 LLM；规则层仅做约束、映射与校验。
> 3. 所有自动建议默认 `pending`，只有用户确认才写入正式字段。
>
> **父任务**: [`docs/ttt/MAGI_人格种子闭环接线.ttt.md`](./MAGI_人格种子闭环接线.ttt.md)
>
> **关联设计**:
> - [`docs/设计/MAGI_人格种子生成机制.design.md`](../设计/MAGI_人格种子生成机制.design.md)
> - [`docs/设计/大五人格标测问卷(IPIP-NEO-120).design.md`](../设计/大五人格标测问卷(IPIP-NEO-120).design.md)

---

## 核心原则

1. **LLM 做语义，规则做约束**: LLM 负责理解文本与生成补充，规则负责分值映射、结构校验、冲突提示。
2. **不自动覆盖用户原文**: 系统仅生成建议，必须经用户逐项确认。
3. **可解释**: 每条建议带来源证据（对应 trait/facet、题号或摘要理由）。
4. **可回滚**: 任意建议可拒绝、撤销；失败不影响已有手工数据。
5. **弱耦合接线**: 优先在 `PersonaSeedPanel` 层实现，不侵入评分组件核心协议。

**验收检查清单**:
- [x] 支持“描述 -> 问卷建议分值”生成，且不强覆盖已答题
- [x] 支持“问卷 -> 四轨描述补充建议”生成，且不强覆盖手写原文
- [x] 支持“问卷 -> 描述建议”按钮触发与 pending 入列（`questionnaire_to_description`）
- [x] 每条建议具备 `pending/accepted/rejected` 状态
- [x] 用户可逐条确认或拒绝建议，并即时回写 UI
- [x] 建议列表支持“查看”入口，展示当前答案与建议答案
- [x] 用户在目标题点击任意分值后，自动注销该题对应待确认建议
- [x] 确认后的建议可持久化到草稿与落盘文件
- [x] LLM 输出走 JSON schema 校验，异常有重试和失败提示
- [x] 新增单测覆盖映射逻辑、状态机与回写行为
- [ ] `magi-mobile` 开发模式编译通过（生产构建已通过，开发构建需继续做稳定复核）

---

## 🟢 近期计划

- [x] **Phase A: 双向收敛数据模型与状态机 (P0)** [已完成 2026-03-02]
  - **背景**: 当前仅有问卷与四轨原始文本，缺少建议层和确认态结构。
  - **行动**:
    1. 定义建议项模型：`id/source/target/status/confidence/reason/payload`。
    2. 定义会话状态：`idle -> generating -> ready -> applying -> done/error`。
    3. 扩展草稿结构，保存建议状态与确认记录。
  - **验收标准**: 刷新页面后建议状态可恢复；可区分“建议内容”和“正式内容”。
  - **参考文件**: `app/src/magi/data/questionnaire.types.ts`、`app/src/magi/entry/PersonaSeedPanel.vue`

- [ ] **Phase B: 描述 -> 问卷建议 (P0)**
  - **背景**: 仅靠问卷手填会增加成本，缺少从描述到量表的建议入口。
  - **行动**:
    1. 设计 LLM 输出 schema：`traits/facets/confidence/reasons`。
    2. 规则映射到 120 题建议分（处理 plus/minus）。
    3. 已答题只标冲突，不自动覆盖；未答题可一键应用建议。
  - **当前进度**: 已完成 v1 可用链路（按钮触发 LLM -> JSON/guard 校验 -> pending 建议入列 -> 用户确认写回）；已完成 v1.1 交互增强（查看/定位/即时反馈/作答自动注销）；待补充 trait/facet 显式规则映射与环境编译阻塞清理。
  - **验收标准**: 任一四轨描述可触发建议生成；UI 可查看差异并选择应用。
  - **参考文件**: `app/src/magi/data/ipip-neo-120.ts`、`app/src/magi/data/ipip-neo-120-scoring.ts`

- [ ] **Phase B1: 开发编译稳定性修复 (`CompositeRating`) (P0)**
  - **背景**: 当前 `magi-mobile` 开发模式中，`CompositeRating` 模板链路持续报 `'readonly' type modifier` 解析错误，阻塞前端联调。
  - **行动**:
    1. 完成 `CompositeRating` 及其依赖类型定义中的 `readonly` 兼容性清理（已做一轮）。
    2. 在开发模式下复现并抓取完整错误上下文，定位是否为缓存或解析链差异。
    3. 给出稳定规避方案（必要时降级类型表达，避免模板链路触发 parser 异常）。
  - **验收标准**: `pnpm run dev:magi-mobile` 编译通过且不再出现该错误。
  - **参考文件**: `app/src/magi/components/persona/CompositeRating.vue`、`app/src/magi/components/persona/CompositeRating.ctx.ts`、`app/src/magi/components/persona/CompositeRating.types.ts`

- [x] **Phase C: 问卷 -> 描述补充建议 (P0)** [已完成 2026-03-02]
  - **背景**: 仅有分值时文本表达不足，需要结构化补充建议。
  - **行动**:
    1. 在收敛 LLM 层新增 `问卷 -> 描述` 入口，输入为 `subject + answers + 四轨当前文本 + 题库上下文`。
    2. 定义并落地 JSON schema：按四轨字段返回补充建议（`field/text/reason/confidence`）。
    3. 将输出解析为 `PersonaConvergenceSuggestion`（`source=questionnaire_to_description`，`payload.kind=description_append`）。
    4. 在 `PersonaSeedConvergencePanel` 增加触发按钮，建议以 `pending` 进入现有建议列表。
    5. 在描述表单新增“按维度生成”按钮，支持职业/生活/本能/Trinity 四维定向更新。
    6. 对 Trinity 增加门槛：仅当三侧描述齐备且问卷作答进度 > 1/3 时允许生成。
    7. 复用当前确认流：接受时追加到目标描述，拒绝时仅改状态，不覆盖手写原文。
    8. 完成草稿恢复与失败提示接线，保证刷新后建议状态一致。
  - **当前进度**: 已完成，可触发四轨建议、逐条确认回写，并通过门槛控制 Trinity 生成时机。
  - **验收标准**: 四轨建议均可生成和逐条确认；确认后回写对应文本框。
  - **参考文件**:
    - `app/src/magi/data/convergence/q2d/persona-seed-convergence-q2d-llm.types.ts`
    - `app/src/magi/data/convergence/q2d/persona-seed-convergence-q2d-llm.guard.ts`
    - `app/src/magi/data/convergence/q2d/persona-seed-convergence-q2d-llm-parser.ts`
    - `app/src/magi/data/convergence/q2d/persona-seed-convergence-q2d-llm.ts`
    - `app/src/magi/entry/persona-seed-panel/handlers/PersonaSeedPanel.async.handlers.ts`
    - `app/src/magi/entry/persona-seed-panel/components/PersonaSeedConvergencePanel.vue`

- [ ] **Phase D: LLM 调用通道与容错 (P0)**
  - **背景**: 双向收敛依赖 LLM，需复用现有 OpenAI 兼容配置并保证失败可控。
  - **行动**:
    1. 抽取收敛专用调用器，复用 MAGI 当前模型配置。
    2. 增加 JSON 解析与 schema 校验，不合规重试 1 次。
    3. 落地用户可见错误提示和降级策略（保留手工流程）。
  - **验收标准**: 配置缺失/接口失败时不中断面板使用，错误可见。
  - **参考文件**: `app/src/magi/composables/consensus/realVote.ts`

- [ ] **Phase E: 联调与测试 (P0)**
  - **背景**: 涉及 LLM + UI 状态写回，回归风险高。
  - **行动**:
    1. 增加规则映射与状态机单测。
    2. 增加“确认式写入”行为测试。
    3. 完成手工联调清单：生成、确认、拒绝、刷新恢复、落盘检查。
  - **验收标准**: 关键路径测试通过；手工联调清单全绿。
  - **参考文件**: `app/src/magi/data/*.test.ts`、`app/src/magi/entry/PersonaSeedPanel.vue`

---

## 🏁 已归档/已完成

- [x] **立项：双向收敛子 TTT 建立** [已完成 2026-03-02]
  - **背景**: 父任务 Phase 3 复杂度高，需拆分独立跟踪。
  - **完成情况**: 建立本子任务并细化到数据模型、双向生成、确认写回与测试阶段。
  - **成果文件**: `docs/ttt/MAGI_描述与问卷双向收敛.ttt.md`

---

## 执行记录

| 日期 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-02 | 创建子 TTT | ✅ | 从父任务 Phase 3 拆分独立执行跟踪 |
| 2026-03-02 | Phase A 实施完成 | ✅ | 完成建议模型/会话状态机/确认写回与草稿恢复；新增 convergence 单测并通过 |
| 2026-03-02 | Phase B v1 可用链路落地 | ✅ | 新增“描述->问卷建议”LLM 入口、JSON 守卫校验、重试与 pending 建议回写 |
| 2026-03-02 | Phase B v1.1 交互增强 | ✅ | 新增查看/定位、接受拒绝即时反馈、作答自动注销建议 |
| 2026-03-02 | Phase B1 编译阻塞排查 | 🔄 | `magi-mobile` dev 链路 `CompositeRating` 模板解析 `readonly` 报错，作为当前最高优先级阻塞 |
| 2026-03-02 | Phase C 启动：问卷 -> 描述接线 | 🔄 | 已冻结实现路径与接线文件，开始实现 `questionnaire_to_description` 生成与回写 |
| 2026-03-02 | Phase C 完成：问卷 -> 四轨描述接线 | ✅ | 已接通 q2d LLM 链路，支持四轨字段与确认回写 |
| 2026-03-02 | Trinity 门槛与按维度按钮接线 | ✅ | Trinity 仅在“三侧齐备 + 问卷进度>1/3”可触发；每个描述框可单独触发生成 |
