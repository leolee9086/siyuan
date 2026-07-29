# MAGI问卷系统现状调研

## 1. 调研范围与结论速览

本次调研覆盖两套实现：

- 现行实现：[`app/src/magi`](app/src/magi)
- 历史原型：[`toread/MAGI`](toread/MAGI)

并对照以下设计文档：

- [`docs/设计/大五人格标测问卷(IPIP-NEO-120).design.md`](docs/设计/大五人格标测问卷(IPIP-NEO-120).design.md)
- [`docs/设计/MAGI_问卷系统迁移_自定义题库到IPIP-NEO-120.design.md`](docs/设计/MAGI_问卷系统迁移_自定义题库到IPIP-NEO-120.design.md)
- [`docs/设计/MAGI_大五人格映射掩码矩阵.design.md`](docs/设计/MAGI_大五人格映射掩码矩阵.design.md)
- [`docs/设计/AI人格种子双轨制结构.design.md`](docs/设计/AI人格种子双轨制结构.design.md)

结论：当前运行链路已经完成“前端题库迁移到 IPIP-NEO-120 + 原始答案落盘”的核心步骤，但仍处于“采集完成、闭环未全接通”状态。`P_base`权威计算、`persona_matrix`回写、四视角自述自动重织尚未在问卷链路中落地。

---

## 2. 现有问卷系统完整文件清单与职责

## 2.1 现行实现（app/src/magi）

### A. 数据模型与题库

1. [`questionnaire.types.ts`](app/src/magi/data/questionnaire.types.ts)
   - 问卷核心类型定义：`SingleQuestion`/`TextQuestion`/`MultipleTextQuestion`/`CompositeRatingQuestion`。
   - 迁移后新增 IPIP 类型：`IpipNeo120RawAnswer`、`IpipNeo120SubmissionPayload`、`IpipNeo120SubjectMeta`、`IpipPersonaProfile`、`PersonaBase`。
   - 关键点：`IpipNeo120SubmissionPayload`只包含原始答案，不包含计分字段（与迁移设计一致）。

2. [`ipip-neo-120.types.ts`](app/src/magi/data/ipip-neo-120.types.ts)
   - 定义题目元数据类型：`IpipNeo120Item`（`q/text/domain/facet/keyed`）。
   - 提供分布校验函数 [`validateIpipNeo120Distribution()`](app/src/magi/data/ipip-neo-120.types.ts:111)：
     - 总题数=120
     - 每个 Domain=24
     - 每个 Domain×Facet=4

3. [`ipip-neo-120.ts`](app/src/magi/data/ipip-neo-120.ts)
   - 120题题库常量：`ipipNeo120QuestionBank`。
   - 启动时执行分布门禁校验；不合法则 `throw Error` 阻断初始化。

4. [`questionnaire-sections.ts`](app/src/magi/data/questionnaire-sections.ts)
   - 已从“分贤者问卷聚合器”转为“IPIP题库 + Prompt能力”统一导出入口。
   - 导出：`ipipNeo120QuestionBank`、`summaryPrompts`、`filterExtremeFacets`、五层Prompt构建函数。

5. [`legacy-custom/*`](../archive/magi/questionnaire/legacy-custom)
   - 旧版四贤者问卷与旧计分逻辑归档。
   - 包含 `trinity/melchior/balthazar/casper` 分目录、[`calculateScore.ts`](../archive/magi/questionnaire/legacy-custom/calculateScore.ts)、[`questionnaire.guard.ts`](../archive/magi/questionnaire/legacy-custom/questionnaire.guard.ts)。

### B. 问卷UI组件

6. [`CompositeRating.types.ts`](app/src/magi/components/persona/CompositeRating.types.ts)
   - `props`同时兼容两种模式：
     - 旧模式：`question?: CompositeRatingQuestion`
     - 新模式：`questionBank?: IpipNeo120Item[]` + `subject?: IpipNeo120SubjectMeta`
   - `emits`定义新事件：`update:ipip-answer`、`submit:ipip`。

7. [`CompositeRating.guard.ts`](app/src/magi/components/persona/CompositeRating.guard.ts)
   - `isLikertScore`运行时校验（1~5整数）。

8. [`CompositeRating.ctx.ts`](app/src/magi/components/persona/CompositeRating.ctx.ts)
   - 组件核心交互逻辑：
     - IPIP模式逐题导航（上一题/下一题）
     - 作答状态Map：`Map<q, score>`
     - 进度计算
     - 组装提交载荷 [`buildIpipSubmissionPayload()`](app/src/magi/components/persona/CompositeRating.ctx.ts:117)
   - 兼容旧模式加权百分制计算 [`calculateLegacyScore()`](app/src/magi/components/persona/CompositeRating.ctx.ts:55)。

9. [`CompositeRating.vue`](app/src/magi/components/persona/CompositeRating.vue)
   - 模板层双分支：
     - IPIP模式：单题展示+Likert 1~5按钮+进度条+导航+提交
     - 旧复合评分模式：子问题列表+百分比分数展示

10. [`PersonaSeedPanel.vue`](app/src/magi/entry/PersonaSeedPanel.vue)
    - 当前问卷入口面板（实际运行链路关键文件）。
    - 通过 `CompositeRating` 收集答案；本地草稿 `localStorage` 按 `subjectId` 保存。
    - 提交时将 [`IpipNeo120SubmissionPayload`](app/src/magi/data/questionnaire.types.ts:124) 写入 `/data/private/<id>_ipip120_sample_<n>.json`。
    - 文件系统API：`/api/file/readDir` + `/api/file/putFile`。

### C. 与人格生成链路集成

11. [`personaPromptBuilder.ts`](app/src/magi/prompts/personaPromptBuilder.ts)
    - 基于统一 `IpipPersonaProfile` 构建四视角 Prompt。
    - 关键机制：
      - 极值过滤 [`filterExtremeFacets()`](app/src/magi/prompts/personaPromptBuilder.ts:69)
      - 共享简历构建 [`buildSharedResume()`](app/src/magi/prompts/personaPromptBuilder.ts:96)
      - 视角叙述构建 [`buildPerspectiveNarrative()`](app/src/magi/prompts/personaPromptBuilder.ts:136)
      - 五层Prompt组装 [`buildFiveLayerPrompt()`](app/src/magi/prompts/personaPromptBuilder.ts:164)

12. [`SSETextDisplay.vue`](app/src/magi/components/persona/SSETextDisplay.vue) / [`SSETextDisplay.types.ts`](app/src/magi/components/persona/SSETextDisplay.types.ts)
    - 负责基于 Prompt 内容调用模型进行流式生成展示。
    - 属于“问卷后生成展示层”，不直接参与IPIP评分。

## 2.2 原型实现（toread/MAGI）

1. [`questionnaire.vue`](toread/MAGI/components/persona/questionnaire.vue)
   - 旧三栏大组件：左侧问卷、中间额外说明、右侧四系统SSE生成与导出。
   - 直接依赖旧问卷聚合 `questionnaireSections` + `summaryPrompts`。

2. [`data/questionnaire-sections.js`](toread/MAGI/data/questionnaire-sections.js)
   - 合并四贤者题库：`trinity/melchior/balthazar/casper`。

3. [`trinity.js`](toread/MAGI/data/questionnaire-sections/trinity.js)
4. [`melchior.js`](toread/MAGI/data/questionnaire-sections/melchior.js)
5. [`balthazar.js`](toread/MAGI/data/questionnaire-sections/balthazar.js)
6. [`casper.js`](toread/MAGI/data/questionnaire-sections/casper.js)
   - 旧版按贤者拆分的自定义题库与各自 `genSummaryPrompt`。
   - 大量 `composite_rating` 子题 + 权重 + 路径映射（中文路径层级）。

---

## 3. 当前题库内容（题量、维度覆盖、评分方式）

## 3.1 现行题库（app）

- 题目数量：120（硬校验）
- 结构：每题 `{ q, text, domain, facet, keyed }`
- Domain 覆盖：`N/E/O/A/C` 各24题
- Facet 覆盖：每个 Domain 下 1~6 各4题
- Keyed：含 `plus/minus`（反向题语义已记录）

评分策略现状：

- 前端采集层：仅采集原始 `score(1~5)`，不做IPIP反向计分与维度归一化。
- 旧兼容模式（非IPIP）：仍保留加权百分制 `weightedSum/(totalWeight*4)*100`。
- 结论：IPIP标准计分逻辑当前未在前端落地，符合“前端只采集，后端权威计分”的迁移目标。

## 3.2 原型题库（toread）

- 结构：按四贤者拆分，各自多组 `composite_rating`。
- 量表语义：偏“认知控制/伦理决策/本能反应”等自定义维度。
- 评分：大量子题按 `selectedOptionIndex * weight` 加权归一到百分制。
- 与IPIP关系：不可直接映射到统一 `5 Domain × 6 Facet` 标准框架。

---

## 4. 当前问卷UI交互流程

## 4.1 现行流程（PersonaSeedPanel + CompositeRating）

1. 打开 [`PersonaSeedPanel.vue`](app/src/magi/entry/PersonaSeedPanel.vue)
2. 输入被试元信息：`subjectId/name/type`
3. `CompositeRating` 进入IPIP模式（检测 `questionBank.length > 0`）
4. 逐题作答（Likert 1~5）
5. 支持上一题/下一题，显示进度与答题数量
6. 全部答完后允许提交
7. 生成载荷：
   - `schema_version`
   - `subject`
   - `date`
   - `answers[{q,text,score}]`
8. 写入 `/data/private/<id>_ipip120_sample_<n>.json`
9. 本地草稿持续保存（`localStorage`）

## 4.2 原型流程（questionnaire.vue）

- 一次性长问卷（非IPIP）
- 支持随机填充、补充说明绑定系统、四系统并行SSE生成、导出聚合JSON
- 交互与数据结构高度耦合旧自定义题库

---

## 5. 与MAGI其它模块的集成方式

1. 数据采集→文件存储：
   - 前端提交后直接入 `/data/private` 样本文件（便于后续后端消费）。

2. 人格Prompt构建：
   - `questionnaire-sections.ts` 与 `personaPromptBuilder.ts` 已形成统一导出与调用面。
   - Prompt层采用“共享P_base + 视角约束 + 极值Facet注入”设计思想（与掩码矩阵设计一致）。

3. 当前缺口：
   - 问卷提交与 `IpipPersonaProfile/PersonaBase` 的自动计算回填尚未在同一链路打通。
   - `persona_matrix`（双轨制“骨”）的更新、阈值漂移重织未见接线实现。

---

## 6. 与设计目标差距分析（IPIP-NEO-120统一P_base）

## 6.1 已达成

1. 题库已统一为 IPIP-NEO-120（120题、domain/facet分布门禁）。
2. 前端输出已是标准原始答案 schema（`IPIP-NEO-120-v1`）。
3. 旧四贤者问卷已从主路径移出到 `_backup`（运行链路不再依赖）。
4. Prompt工具已围绕统一 `PersonaBase`/`IpipPersonaProfile` 组织。

## 6.2 未达成/待接线

1. 后端权威计分闭环未显式接入问卷提交流程（当前仅落盘）。
2. `answers -> P_base(traits+facets)` 的服务接口、错误回传、状态反馈未见。 
3. `P_base -> 四视角自述文件` 自动生成写入链路未接入当前面板。
4. 与双轨制中的 `persona_matrix.json` 漂移更新（EMA）机制未接入。
5. 旧问卷兼容提示（“版本升级需重填”）未在当前UI看到明确策略。

---

## 7. 迁移所需具体工作项清单

1. **后端计分服务接线**
   - 新增/确认 API：接收 `IpipNeo120SubmissionPayload`，返回标准 `PersonaBase`（含30 facets键名规范）。
   - 实现 `keyed=minus` 的反向计分与0~1归一化。

2. **前端提交流程升级**
   - 在 [`PersonaSeedPanel.vue`](app/src/magi/entry/PersonaSeedPanel.vue) 的提交后流程中增加“调用计分服务 + 获取P_base + 展示结果/错误”。
   - 将“仅落盘”改为“落盘 + 计算确认”双阶段状态。

3. **人格基座写回接线**
   - 将后端计算结果接入 `persona_matrix` 存储更新流程（双轨制“骨”）。
   - 明确样本文件与基座文件的关系（审计、版本、回滚）。

4. **四视角自述生成接线**
   - 使用 `personaPromptBuilder` 产物生成 `professional/relational/instinctive/whole` 文本。
   - 完成侧面文件命名规范落地（`<id>_as_*.md`）。

5. **旧链路清理与隔离**
   - 确认 `_backup` 与 `toread` 代码仅用于参考，不被构建产物引用。
   - 若存在隐式引用（如旧字段名），逐项清理。

6. **兼容性与提示策略**
   - 在UI增加问卷版本提示与旧数据不可自动迁移说明。
   - 统一错误语义：题库校验失败、提交失败、计分失败、写回失败。

7. **测试补齐**
   - 题库分布单测（已含基础校验，可补题号连续性/重复文本校验）。
   - 提交流程集成测试：作答完整性、payload顺序一致性、文件命名递增。
   - 计分契约测试：正反向题、domain/facet聚合、0~1范围。

---

## 8. 总体判断

当前代码库中，问卷系统从“自定义四套量表”迁移到“IPIP-NEO-120标准采集”的主体工作已完成，且架构方向与设计文档一致（统一P_base、视角约束、极值过滤）。

剩余核心工作不是“再造问卷UI”，而是把“采集样本 -> 权威计分 -> P_base持久化 -> 四视角自述重织”这条生产闭环接通，并补齐契约测试与错误处理语义。
