# MAGI Trinity 控制失效微调决策动议（codex01）

## 文档元信息
- 动议角色: `codex01`
- 文档状态: `Draft / 待多人评审`
- 讨论范围: `仅方案商讨，不改代码`
- 背景日志:
  - `toread/MAGILOG/202603030246/rei_ipip120_sample_1.json`
  - `toread/MAGILOG/202603030246/magi_exports/magi-session-1772477000498_20260303_024501.json`

## 1. 问题定义（基于日志）
- 观测到的核心故障不是问卷分布，而是 `Trinity 最终答案` 未被 `三贤人提案/投票结果` 稳定约束。
- 典型表现:
  - 用户问蹦极建议，`proposedAction` 已形成“提供决策框架”。
  - 投票通过后，`finalConsensus` 回退为身份宣言文本（答非所问）。
- 结论: 当前是 `控制链路失效`（control failure），不是单纯的文本质量问题。

## 2. 决策目标与约束
- 目标:
  - 提升“任务相关性”和“决策一致性”。
  - 保留三贤人结构价值（分工视角 + 审慎投票）。
- 约束:
  - 对现有架构做最小破坏。
  - 提供可验证指标，不依赖“感觉正确”。

## 3. 待选方案（B 主导 + C 融合）

### 方案 B（绝对主导）: 保留 Trinity，提示词工程优先
- 描述:
  - 不改主流程，重点强化 Trinity 与三贤人提示词结构与优先级。
  - 通过明确输出契约，确保“先回答问题，再表达人格/立场”。
  - 将冲突处理、任务命中、提案覆盖写入提示词硬约束。
- 优点:
  - 改动最小、上线快，便于高频迭代与对照验证。
  - 可直接针对“身份宣言劫持”和“答非所问”做快速修复。
- 风险:
  - 仅靠 prompt 仍可能出现“表面服从、深层漂移”。
  - 在复杂冲突轮次下，稳定性受模型状态波动影响。
- 适用:
  - 作为当前默认主路径与唯一主导策略。

### 方案 C（融合配套）: 轻量可验证约束层
- 描述:
  - 保留 Trinity 角色，增加最小必要的一致性校验作为护栏。
  - 校验层服务于方案 B，不替代主生成链路。
  - 仅在高风险/疑似偏航时触发一次重生与纠偏。
- 约束契约（建议）:
  - `Q1 任务命中`: 最终答案必须直接回应当前用户问题。
  - `Q2 提案覆盖`: 必须覆盖 `proposedAction` 的关键动作点。
  - `Q3 决策一致`: 不得与已通过投票结论冲突。
  - `Q4 反劫持`: 禁止与当前问题无关的身份宣言占主导。
- 优点:
  - 在不重构架构前提下补充可观测、可复盘的安全边界。
  - 可作为 prompt 失败场景下的兜底纠偏机制。
- 风险:
  - 校验阈值不当时可能过严或过宽。
  - 仍需控制工程复杂度，避免反向拖慢主链路。
- 适用:
  - 作为方案 B 的增强层渐进启用，不单独立项主导。

## 4. AI 心理学与机制论据（检索后）

### 4.1 “只靠层级提示词”不可靠
- 证据:
  - `Control Illusion` 指出 LLM 对指令层级的一致执行并不稳健，系统/用户分层本身不足以保证优先级服从。
- 含义:
  - 仅靠“更强提示词”难以从根本解决控制失效。

### 4.2 冲突指令下，模型往往不主动澄清冲突
- 证据:
  - `ConInstruct` 显示模型即使能检测冲突，也常不显式提示用户冲突并请求澄清。
- 含义:
  - 需要外部策略强制执行冲突处理流程，而不是期待模型自发处理。

### 4.3 Persona/Role 提示会显著改变推理行为
- 证据:
  - `PHAnToM` 与后续 persona prompting 研究均显示：角色化提示会实质性改变推理表现。
- 含义:
  - “身份宣言抢占回答”是可预期风险，必须做任务导向约束。

### 4.4 上下文忠实性与内部记忆存在冲突
- 证据:
  - `Context-faithful Prompting`、`Taming Knowledge Conflicts` 指出参数记忆与上下文证据会冲突。
- 含义:
  - “自我叙事模板”可能压过当前问题上下文，需在执行层做纠偏。

### 4.5 多代理讨论可提升，但需收敛机制
- 证据:
  - `Multiagent Debate`、`Self-Consistency` 显示多路径推理有增益。
- 含义:
  - 三贤人机制本身有价值，但必须配套确定性的收敛规则。

### 4.6 人类认知心理学可解释该故障
- `Goal Shielding`（目标屏蔽）:
  - 强激活目标会抑制替代目标。对应到当前故障，即“身份维持目标”压制“回答当下问题目标”。
- `Task Switching Cost`（任务切换成本）:
  - 任务集切换存在残留激活。对应到对话中，上一轮身份叙事可能侵入下一轮任务问答。

## 5. codex01 动议（建议采纳）
- 主动议:
  - 采用 `方案 B（绝对主导）+ 方案 C（融合配套）` 作为主路线。
- 配套策略:
  - 以提示词工程作为第一优先级（任务命中、提案覆盖、冲突披露、反劫持）。
  - `方案 C` 仅提供轻量可验证护栏，默认不改变主流程与角色分工。
  - 当前决策仅采用 `B 主导 + C 融合` 路径。

## 6. 建议的评估指标（多人协作共识用）
- `任务命中率`: 最终回答是否直接回答用户问题（Top-1）。
- `提案一致率`: 最终回答覆盖 `proposedAction` 关键点的比例。
- `答非所问率`: 包含强身份宣言且未回答问题的比例。
- `冲突披露率`: 当检测到冲突时，是否显式说明并请求澄清。
- `重试/降级率`: 校验失败后重试与降级触发频率。

## 7. 会议用待决问题
- 是否接受“Trinity 从自由生成改为受约束综合器”这一角色变更？
- 校验器是 `规则优先`、`LLM Judge 优先`，还是 `混合裁决`？
- 何种阈值触发“提示词重试”与“约束层纠偏重生”？

## 8. 主要涉及代码文件（本议题）
- `app/src/magi/composables/useMagi.consensus.ts`
  - 共识主链路入口；三贤人响应采集、审慎投票触发、`proposedAction` 与 `finalConsensus` 接线。
- `app/src/magi/composables/magiConsensus.ts`
  - 投票流程与响应聚合核心；`requires_deliberation` 判定、投票收敛与结果组织。
- `app/src/magi/composables/magiConsensus.deliberation.ts`
  - Melchior 的“行动提案/执行”提示词与调用逻辑（审慎模式关键）。
- `app/src/magi/composables/magiConsensus.reply.ts`
  - 标准/审慎两类最终回复的拼装位置（`trinity-synthesis` 元信息来源）。
- `app/src/magi/core/wise/mockWise.prompts.ts`
  - Trinity 拼接提示词与触发信号；当前“身份宣言劫持”风险的主要提示词面来源。
- `app/src/magi/core/wise/mockWise.subclass.ts`
  - `TRINITY-00` 与三贤者实例构建、提示词注入入口（人格/系统提示词装配层）。
- `app/src/magi/core/wise/promptTemplates/Melchior.ts`
  - `requires_deliberation` 标记模板来源，影响是否进入投票与审慎路径。
- `app/src/magi/composables/useMagi.ts`
  - `initializeMAGI` 与 seel 生命周期；人格注入后是否真正重建链路的关键位置。
- `app/src/magi/prompts/personaRuntimePromptBuilder.ts`
  - 问卷人格档案到运行时 prompt 注入的构建器，影响三贤人/Trinity 运行上下文。
- `app/src/magi/entry/MagiRoot.ctx.ts`
  - 问卷保存后 `onQuestionnaireSaved` 的人格重载接线与系统消息回显（日志可见性入口）。
- `app/src/magi/utils/messageFactory.types.ts`
  - `consensus` 元信息类型定义（`mode`, `source`, `vote`），约束导出与后续校验字段。
- `app/src/magi/composables/useMagi.export.ts`
  - 会话导出聚合器；本次问题定位所依赖的 `rounds/voteStatuses/finalConsensus` 证据出口。

## 9. 参考文献（用于评审追溯）
1. Control Illusion: The Failure of Instruction Hierarchies in Large Language Models (arXiv, 2025)  
   https://arxiv.org/abs/2502.15851
2. ConInstruct: Evaluating Large Language Models on Conflict Detection and Resolution in Instructions (arXiv, 2025)  
   https://arxiv.org/abs/2511.14342
3. PHAnToM: Persona-based Prompting Has An Effect on Theory-of-Mind Reasoning in Large Language Models (arXiv, 2024)  
   https://arxiv.org/abs/2403.02246
4. Context-faithful Prompting for Large Language Models (arXiv, 2023)  
   https://arxiv.org/abs/2303.11315
5. Taming Knowledge Conflicts in Language Models (arXiv, 2025)  
   https://arxiv.org/abs/2503.10996
6. Improving Factuality and Reasoning in Language Models through Multiagent Debate (arXiv, 2023)  
   https://arxiv.org/abs/2305.14325
7. Self-Consistency Improves Chain of Thought Reasoning in Language Models (arXiv, 2022)  
   https://arxiv.org/abs/2203.11171
8. Self-Refine: Iterative Refinement with Self-Feedback (arXiv, 2023)  
   https://arxiv.org/abs/2303.17651
9. Forgetting All Else: On the Antecedents and Consequences of Goal Shielding (JPSP, 2002)  
   https://doi.org/10.1037/0022-3514.83.6.1261
10. Task switching (Trends in Cognitive Sciences, 2003)  
   https://doi.org/10.1016/S1364-6613(03)00028-7
