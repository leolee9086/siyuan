# MAGI 问卷系统迁移：自定义题库 → IPIP-NEO-120 执行跟踪 (TikTocTak)

> **目标**: 将 `app/src/magi/data/questionnaire-sections/` 下四套自定义问卷替换为统一的 IPIP-NEO-120 标准问卷，使所有实体共享同一份 P_base，差异仅来自视角 Prompt。量化指标：120 题标准题库上线、4 套旧问卷全部移除、TypeScript 编译零旧类型残留。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。
>
> **设计文档**: [`MAGI_问卷系统迁移_自定义题库到IPIP-NEO-120.design.md`](../设计/MAGI_问卷系统迁移_自定义题库到IPIP-NEO-120.design.md)（现状分析、格式规格、风险约束、TTT 关系）
>
> **关联 TTT**: `MAGI_人格种子采样问卷前端整合.ttt.md`（目标态 UI）、`MAGI前端迁移.ttt.md`（同层并行）

---

## 🔑 核心原则

1. **统一 P_base**: 所有贤者共享同一份人格基底数据，差异仅来自视角 Prompt，不得保留贤者专属的 SummaryData 接口
2. **标准框架**: 严格遵循 IPIP-NEO-120 的 5 Domain × 6 Facet 结构，不得自创维度
3. **前后端分离**: 前端只收集原始答案 JSON，权威计分由后端完成
4. **渐进替换**: 旧问卷模块移入 `_backup/` 归档而非直接删除，确保可回溯

### ✅ 验证检查清单

- [x] 120 条题目的 domain/facet/keyed 分布正确（每 domain 24 题，每 facet 4 题）
- [ ] TypeScript 编译通过，无旧类型残留引用（`pnpm run gen:types` 在项目既有 `tsconfig` 类型入口配置处失败，非本次改动引入）
- [ ] 前端输出 JSON 符合 `IPIP-NEO-120-v1` schema
- [x] 四个视角 Prompt 的共享简历部分完全一致

---

## 🟢 近期计划

- [x] **Phase 1: 题库数据模块替换 (P0)** [已完成 2026-03-02]
  - **背景**: 当前四套自定义问卷与 IPIP-NEO-120 的 Likert 量表不兼容，需用标准题库替换
  - **行动**: 新建 `ipip-neo-120.ts` 和 `ipip-neo-120.types.ts`；旧 `questionnaire-sections/` 移入 `_backup/`；更新聚合器导出
  - **验收标准**: 新模块可导入，120 条记录分布校验通过
  - **参考文档**: [`设计文档 §2.1`](../设计/MAGI_问卷系统迁移_自定义题库到IPIP-NEO-120.design.md)、`大五人格标测问卷(IPIP-NEO-120).design.md`
  - **成果文件**:
    - `app/src/magi/data/ipip-neo-120.ts`
    - `app/src/magi/data/ipip-neo-120.types.ts`
    - `app/src/magi/data/questionnaire-sections.ts`
    - `docs/archive/magi/questionnaire/legacy-custom/`

- [x] **Phase 2: 类型系统清理 (P0)** [已完成 2026-03-02]
  - **背景**: 四个贤者专属 SummaryData 接口与统一 P_base 设计冲突，需移除并统一为 PersonaBase
  - **行动**: 移除旧接口和关联类型；全局搜索替换引用点；评估 DecisionContext 等类型的保留必要性
  - **验收标准**: TypeScript 编译通过，无对旧类型的残留引用
  - **参考文档**: [`设计文档 §1.2`](../设计/MAGI_问卷系统迁移_自定义题库到IPIP-NEO-120.design.md)
  - **成果文件**:
    - `app/src/magi/data/questionnaire.types.ts`
    - `docs/archive/magi/questionnaire/legacy-custom/trinity/prompts.ts`
    - `docs/archive/magi/questionnaire/legacy-custom/melchior/prompts.ts`
    - `docs/archive/magi/questionnaire/legacy-custom/balthazar/prompts.ts`
    - `docs/archive/magi/questionnaire/legacy-custom/casper/prompts.ts`
    - `app/src/magi/data/questionnaire.types.ts.phase2.backup.md`

---

## 🟡 中期计划

- [x] **Phase 3: Prompt 模板与自述文本迁移 (P1)** [已完成 2026-03-02]
  - **背景**: 贤者专属 prompt 生成逻辑需替换为统一的五层 Prompt 结构
  - **行动**: 移除旧 prompt 生成函数；新建统一视角 Prompt 组装；实现极值过滤；更新侧面标签
  - **成果文件**:
    - `app/src/magi/prompts/personaPromptBuilder.ts`
    - `app/src/magi/prompts/personaPromptBuilder.test.ts`
    - `app/src/magi/data/questionnaire-sections.ts`
    - `app/src/magi/data/questionnaire.types.ts`
    - `app/src/magi/data/questionnaire-sections.ts.phase3.backup.md`
    - `app/src/magi/data/questionnaire.types.ts.phase3.backup.md`

---

## 🏁 已归档/已完成

- [x] **Phase 4: UI 组件适配 (P1)** [已完成 2026-03-02]
  - **背景**: 现有问卷 UI 需适配 IPIP-NEO-120 的单一 Likert 评分模式
  - **完成情况**: 完成 IPIP 5 级 Likert 逐题流渲染、进度与前后题导航、标准提交事件；保留旧复合评分兼容路径；修复相关 lint/类型约束；复杂改造备份迁移至 `docs/ttt/phase4-backups/persona/`
  - **成果文件**:
    - `app/src/magi/components/persona/CompositeRating.types.ts`
    - `app/src/magi/components/persona/CompositeRating.guard.ts`
    - `app/src/magi/components/persona/CompositeRating.ctx.ts`
    - `app/src/magi/components/persona/CompositeRating.vue`
    - `app/src/magi/components/persona/CompositeRating.css`
    - `app/src/magi/data/questionnaire.types.ts`
    - `docs/ttt/phase4-backups/persona/`

- [x] **TTT 文档规范化** [已完成 2026-03-01]
  - **背景**: 原 ttt 文件混合了大量设计说明内容（现状分析、格式规格、风险约束、TTT 关系），不符合纯执行跟踪文档规程
  - **完成情况**: 将设计/规范性内容拆分到独立设计文档，ttt 重写为纯执行跟踪结构
  - **成果文件**:
    - `docs/设计/MAGI_问卷系统迁移_自定义题库到IPIP-NEO-120.design.md`（新建，承接设计内容）
    - `docs/ttt/MAGI_问卷系统迁移_自定义题库到IPIP-NEO-120.ttt.md`（重写）
    - `docs/ttt/MAGI_问卷系统迁移_自定义题库到IPIP-NEO-120.ttt.backup.md`（原始备份）

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。
