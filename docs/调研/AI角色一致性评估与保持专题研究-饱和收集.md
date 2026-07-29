# AI 角色一致性评估与保持专题研究：饱和信息收集版

> 研究状态：饱和收集进行中；本版先建立证据地图、方法谱系、前沿候选和 s-forge 对照，不把预印本结果写成已验证定律，也不把研究方案写成产品已经集成。
>
> 研究日期：2026-07-28（Asia/Shanghai）。原始查询、摘要摘录、代码仓库、失败来源和 URL 审计见配套的 [研究轨迹](AI角色一致性评估与保持专题研究-研究轨迹.md)；66 条论文/基准来源的结构化字段见 [核心来源登记](AI角色一致性评估与保持-核心来源登记.csv)，A52-A66 的补充复现状态见 [新增来源登记](AI角色一致性评估与保持-新增来源登记.csv)；角色社区 RSS 原文见 [角色社区 RSS 快照](AI工具与Harness-角色社区RSS快照.csv)，重点 GitHub 运行问题见 [GitHub 问题快照](AI工具与Harness-GitHub问题快照.csv)，15 条交互式 Agent 基准见 [交互式 Agent 基准登记](AI角色一致性评估与保持-交互式Agent基准登记.csv)。

## 1. 研究问题与边界

### 1.1 核心问题

本专题研究两个相互耦合但不能混为一谈的问题：

1. **怎样证明一个 AI 角色在不同场景、不同时间和不同记忆状态下仍然是“同一个角色”**；
2. **怎样让角色在吸收新经历、适应用户和处理冲突时保持身份连续，同时允许有依据的状态变化**。

“一致”不是每一轮都使用相同语气，也不是四个内部模块输出相同文本。更准确的目标是：稳定身份不变量、稳定价值与行为倾向、可追溯的经历和关系记忆，以及在情境变化下有边界的状态转移。

### 1.2 一致性的分解

| 层 | 要回答的问题 | 典型失败 | 适合的证据 |
|---|---|---|---|
| 身份与事实 | 姓名、背景、能力、关系、知识边界是否正确 | 把角色不拥有的知识当成经历；时间线穿越 | CharacterEval、Character profiling、TimeChara |
| 人格与价值 | 偏好、价值、信念、人格特征是否稳定且可解释 | 默认助手人格覆盖角色价值；冲突时只服从通用道德模板 | InCharacter、PersonaGym、RoleCDE、PsychoBench |
| 行为与决策 | 同一角色在相似条件下的选择是否可重复，在新情境下是否可外推 | 口头自称谨慎，决策却持续冒险；只会复述资料 | BehaviorChain、PersonaArena、RoleCDE |
| 情绪与状态 | 事件如何改变角色的情绪、目标、注意和表达 | 情绪只改形容词，不改变判断；上一轮状态消失 | Persona-E2、Emotional RAG、情境探针 |
| 文体与话语 | 语气、词汇、节奏、叙事视角是否具有角色辨识度 | 只靠感叹号等浅层特征；角色互相同声同气 | CharacterEval、PersonaLLM、风格指纹 |
| 社会与关系 | 与不同对象的关系、权力、亲密度和群体行为是否连续 | 单人测试很好，群聊崩溃；关系状态没有历史 | SocialBench、CharacterBox、PersonaArena |
| 时间与叙事 | 角色是否位于正确剧情阶段，是否遵守已知和未知边界 | 剧透、未来知识泄漏、心理弧线被抹平 | TimeChara、ArcANE、CharacterBox |
| 记忆生命周期 | 事实如何写入、更新、替代、遗忘、召回和解释 | 过时偏好覆盖新偏好；迎合性陈述被永久写入 | LoCoMo、LongMemEval、MemOps、PASB |
| 角色边界与安全 | 角色约束与系统安全、工具权限、用户指令冲突时如何决策 | “角色扮演”变成越权；安全对齐完全抹平角色 | RoleCDE、角色注入测试、工具审计 |
| 内部表征 | 模型只是说出角色话术，还是内部信念／行为策略也变化 | 输出保真但内部信念未变，或训练造成不可控世界观迁移 | When Role-playing, Do Models Believe What They Say?、Persona Vectors |

### 1.3 研究对象的五个术语

- **角色保真（role/character fidelity）**：输出、行为和决策与目标角色及其证据的匹配程度。
- **人格一致（persona/personality consistency）**：跨问题、跨场景和跨会话的稳定特征与价值倾向。
- **内部自洽（internal consistency）**：角色对自己的先前回答、经历、状态和关系保持不矛盾。
- **外部对齐（external alignment）**：与作者、专家、人物资料、真实用户或人工标注的参考一致。
- **有边界的演化（bounded evolution）**：新经历可以改变可变状态或记忆，但每次变化都有触发事件、有效期、来源和替代关系。

## 2. 证据等级与研究规则

### 2.1 证据等级

| 等级 | 来源 | 使用方式 |
|---|---|---|
| A | ACL／EMNLP／NAACL／UIST／ICML／Nature 等正式论文、正式论文页面、公开数据集说明 | 可作为已发表研究结论；仍检查任务定义、数据和评估协议 |
| B | arXiv 预印本，带公开代码／数据／实验协议 | 作为前沿候选和可复现实验方向；明确“预印本”状态 |
| C | 官方规范、官方文档、开源仓库、模型卡、产品设计文档 | 证明能力和接口存在，不证明效果或总体采用率 |
| D | s-forge 当前代码、测试、设计文档和本地运行结果 | 证明本地现状、缺口和可复用边界 |
| E | 社区复现、issue、讨论、博客或二手综述 | 作为失败模式和采用线索；不替代 A/B/C 的能力证据 |

### 2.2 解释规则

1. 单轮问答分数只能说明局部行为；长期角色一致性需要轨迹、跨会话和状态更新实验。
2. LLM-as-a-judge 只能作为评估器组件，必须报告人类相关性、评估者间一致性、提示敏感性和模型偏差。
3. 心理量表能测量某些人格表现，但角色的“真实心理”不是由一次自报量表生成；优先使用访谈、行为选择和第三方标注三角验证。
4. 预训练模型、角色提示、检索、记忆和微调改变的是不同层次；实验必须保留无记忆、原始历史、检索记忆和结构化角色状态等消融组。
5. 角色的稳定性与适应性是多目标关系；“每次完全相同”属于僵化，不应作为最高分目标。
6. 2026 年新论文大多尚未经过长期社区复现；本报告将其列入前沿观察，不直接当作 s-forge 已采用方案。

## 3. 饱和收集得到的共识

### 3.1 没有一个总分可以代表角色一致性

正式研究已经把角色能力拆成知识、人格、行为、情绪、社交、文体、时间和长期记忆等不同任务。RPA 评估设计综述对 1,676 篇论文进行筛选后，归纳出 6 类 Agent 属性、7 类任务属性和 7 类评估指标；指标包括 performance、psychological、external alignment、internal consistency、social/decision-making、content/textual、bias/fairness/ethics。由此得出的工程结论是：s-forge 应保存多维指标向量、证据和置信区间，而不是把角色健康压成单一 ATF 数值。

### 3.2 最可靠的评估是“行为探针 + 人物证据 + 轨迹”

- CharacterEval 将对话能力、角色知识／人格一致性、吸引力和人格回测放在一个基准中，并用人工标注训练 CharacterRM。
- InCharacter 放弃让角色直接填写自报量表，改用心理访谈引出开放式回答，再由评估者映射到心理量表；这专门处理了“角色不理解量表说明”与“自报和实际行为不一致”的问题。
- PersonaGym 动态选择与人格相关的环境和问题，以任务 rubric 进行多评估器集成；固定一套问题无法覆盖不同人格的相关行为。
- CharacterBox、BehaviorChain、TimeChara 和 ArcANE 都把测试单位从单个回答推进到时间轨迹、情境变化和剧情阶段。

### 3.3 长期记忆是角色一致性的写入系统，而不是附加检索层

LoCoMo 和 LongMemEval 表明，长会话不仅考验“能否找回事实”，还考验时间推理、知识更新、拒答、事件摘要和因果联系。2026 年的 MemOps 将 memory 直接定义为 remember、forget、update、reflect 等生命周期操作；PASB 进一步证明，迎合性陈述一旦越过写入边界，会在后续中性问题中持续造成错误。

因此，角色记忆必须保存：来源、触发语境、有效期、置信度、状态、替代链、用户修改记录和召回原因。向量相似度只负责候选生成。

### 3.4 角色保真与通用对齐存在可测量冲突

RoleCDE 的价值冲突场景显示，模型会在角色价值与通用道德／安全倾向冲突时系统性回到对齐模板；这不是简单的“角色知识缺失”。2025 年关于推理与角色扮演的研究还发现，CoT 或 reasoning-optimized 模型并不自动提高角色能力，部分情况下会降低角色保真。评估必须分开记录角色决策、系统安全边界和理由质量。

### 3.5 输出行为与内部表征需要分开

“When Role-playing, Do Models Believe What They Say?” 通过 truth probe 和行为测试区分了 prompt/ICL/SFT/OCT/EM 的输出变化与内部信念变化；Persona Vectors 工作则把激活空间方向用作行为审计和控制探针。对产品而言，这意味着不应把“角色说得像”直接解释为模型已经拥有稳定人格；应记录行为证据和内部诊断的不同置信度。

## 4. AI 角色一致性评估谱系

### 4.1 静态人物资料与角色知识

**代表来源**：CharacterEval、RoleLLM／RoleBench、Character Profiling from Fictional Works、Character-LLM。

**测量内容**：

- 角色背景、知识范围、身份关系和资料可见性；
- 对事实、观点、行为和语言风格的回答；
- 资料中没有出现的知识和情境是否触发安全的“不知道”或合理推断；
- 角色档案摘要与人工／专家 ground truth 的一致性。

**证据强度与限制**：

- CharacterEval 的 1,785 个多轮对话、77 个中国小说／剧本角色、13 项指标和人工质量控制，适合中文角色基础回归；其 GPT-4 初始抽取仍需要人工筛选，不能视作纯人工语料。
- RoleLLM 的 RoleBench 包含 100 个角色和 168,093 条样本，覆盖 Profile Construction、Context-Instruct、RoleGPT 和 RoCIT；适合比较角色知识、风格和角色条件微调。
- Character Profiling 的 CROSS 数据集由文学专家构建，评估角色资料摘要及其下游可用性；它测的是角色理解前置能力，而不是完整对话一致性。
- Character-LLM 通过 profile、experience、emotion state 训练角色代理，并以访谈验证记忆和经历；对“角色经历”比单纯 system prompt 更有启发，但训练角色数和泛化范围有限。

**s-forge 结论**：建立 Character Contract 的 identity、knowledge boundary、relationship graph 和 evidence spans；静态档案测试作为基础层，不作为长期一致性的唯一门槛。

### 4.2 心理量表、人格访谈与人格表达

**代表来源**：PsychoBench、PersonaLLM、InCharacter、PersonaGym、Nature Machine Intelligence psychometric framework。

**测量内容**：

- BFI／Big Five、NEO 体系、情绪、动机、人际关系和其他心理量表；
- 自报量表与访谈行为的差异；
- 角色在不同提示、采样温度和上下文长度下的稳定性；
- 人类是否能从盲测文本中识别目标人格，以及被告知“这是 AI”后判断是否改变。

**关键证据**：

- PersonaLLM 让 GPT-3.5/GPT-4 角色完成 44 项 BFI 和写作任务；自报分数与指定人格方向一致，写作具有可检测的语言模式，但告知 AI 作者身份会降低某些人格识别准确率。
- InCharacter 覆盖 32 个角色、14 种心理量表；访谈式流程比直接自报更贴近人物标签，报告最高 80.7% 的人格对齐准确率。
- PersonaGym 的 PersonaScore 用专家 rubric 示例校准多个评估器，动态选环境、生成问题，并在 200 个 persona、10,000 个问题上测试；模型规模本身没有保证人格表现提升。
- Nature Machine Intelligence 的 psychometric framework 在 18 个 LLM 上报告部分提示配置下的信度与效度，并展示可沿目标维度塑造输出人格；该结果支持“测量协议要先验证”，而不是直接把心理量表分数当作模型内在特质。

**s-forge 结论**：保留 OCEAN/30 Facet 作为角色先验与行为解释坐标，但把自报问卷降为辅助证据；新增开放式访谈、选择题、反事实行为和第三方盲评。

### 4.3 动态环境、用户模拟与多轮会话

**代表来源**：PersonaGym、PingPong、DynSess、PersonaArena、RPA-Check。

**测量内容**：

- 动态选择与角色相关的环境，而不是所有角色共享同一套问题；
- 用户模拟器提出追问、挑战、误解和情绪变化；
- session 级而不是 turn 级评分；
- 轨迹中角色稳定、互动质量、吸引力、任务达成和错误修复的联合表现。

**关键证据**：

- PingPong 使用 player、interrogator 和 judge ensemble，比较 40 多个模型、8 个角色和 8 个情境，报告自动评分与人工标注的相关性。
- DynSess 把完整 session 作为评估单位，用 multi-turn lookahead 生成训练轨迹，并以 DSPO/GSRPO 优化；论文报告 session 级评估与人类判断的相关性优于旧评估器。
- PersonaArena 用用户生成社交内容构建 persona bank，在模拟社交环境中进行多轮互动，并用多 Agent debate judge 评估；当前属于预印本证据。
- RPA-Check 使用“维度定义→布尔检查项扩展→语义过滤→LLM judge”的四阶段流水线，强调可复现 checklist 和 agent isolation。

**s-forge 结论**：评测运行时需要 UserSimulator、ScenarioGenerator、SessionTrace 和 JudgeEnsemble 四个可替换边界；每个 session 保存逐步证据，不只保存最后一轮分数。

### 4.4 时间线、剧情弧和开放情境

**代表来源**：TimeChara、ArcANE、CharacterBox、BehaviorChain。

- **TimeChara**：对同一角色的特定剧情时点进行探测，检测未来知识、身份和时间线幻觉；说明“角色资料正确”还不够，必须带 `valid_at`。
- **ArcANE**：把 17 部小说、80 个主要角色切分为 Character Arc 阶段，对同一情境跨阶段重复探测，并专门测试原文没有覆盖的开放情境；Character Arc 条件在开放情境上仍能带来收益。
- **CharacterBox**：在文本虚拟世界中由 character agent 与 narrator agent 共同生成细粒度行为轨迹，并提供 CharacterNR/CharacterRM 以降低评估成本；它把角色一致性从静态问答推进到可交互 sandbox。
- **BehaviorChain**：1,001 个 persona、15,846 个连续行为，测试在动态场景中逐步推断连续行为；研究报告当前模型在连续行为模拟上仍有明显差距。

**s-forge 结论**：人格档案必须支持时间版本、剧情阶段、未知边界和反事实事件；`valid_from/valid_to` 与 `why_recalled` 是角色一致性的必要字段。

### 4.5 社会关系、情绪和价值冲突

- **SocialBench**：500 个角色、6,000 多个问题、30,800 条多轮话语；把个人层和群体层社会性分开，单人表现好不代表群聊表现好。
- **Persona-E²**：以人工标注的 MBTI/Big Five 与事件为基础，测量同一事件因人格不同产生的情绪评价；初步结果显示模型对精细 appraisal shift 仍弱，Big Five 信息可减轻“人格幻觉”。
- **RoleCDE**：约 8,000 个角色 profile、近 24,000 个价值冲突 dilemma，测试角色价值与通用对齐约束冲突时的角色决策；提出 Role Value Decoupling 现象。
- **Diagnosing and Repairing Persona Collapse**：在 1,281 条建议场景中发现前沿模型把超过 90% 的情境压缩到同一“支持型助手人格”；逆过程蒸馏可以改善 persona 分布，但盲评仍偏好默认人格，说明分布修复与主观质量不总是同向。

补充的高可信社会智能与边界来源：

- **SOTOPIA / SOTOPIA-π / LIFELONG SOTOPIA**：把 persona、goal、relationship、社会规范和持续互动放入可执行环境，评估单位从“回答像不像”推进到关系和策略轨迹；SOTOPIA-π 已有 ACL 2024 正式页面，LIFELONG SOTOPIA 仍是预印本观察项。
- **EmoBench**：ACL 2024 的情绪智力 benchmark，覆盖情绪理解、推断、调节和社会情绪任务；适合拆出角色 appraisal、情绪状态和行动倾向，但情绪智力分数不能代替角色人格保真。
- **OpenToM**：ACL 2024 theory-of-mind benchmark，测信念、意图、知识和多步心理状态；可用于群聊、误解、隐含意图和关系冲突测试。
- **Investigating Cultural Alignment / Cultural bias and cultural alignment**：分别提供 ACL 和 PNAS Nexus 的跨文化对齐证据；同一角色的价值、礼貌、情绪表达必须报告语言、文化和标注者分层，不能把单一文化偏好当作人格真值。

角色边界不能只依赖通用拒答率。**SafetyBench**、**R-Judge**、**Agent-SafetyBench**、**HarmBench**、**JailbreakBench**、**SALAD-Bench**、**WildGuard** 和 **OR-Bench** 可以分别覆盖多语言安全、Agent 风险意识、工具行为、red teaming、越狱鲁棒性、风险分层、moderation/refusal 和 over-refusal。对 s-forge，应把 `role_fidelity`、`safety_boundary`、`over_refusal`、`tool_authorization` 分成独立维度；否则“角色没有被保留”与“角色正确拒绝”会被错误合并。

**s-forge 结论**：需要分别记录 appraisal、goal、relationship、decision、safety 和 user preference；“友好”不能作为所有情境的正确角色行为。

### 4.6 记忆、更新、遗忘和持续迎合

**代表来源**：LoCoMo、LongMemEval、MemGPT、MemoryBank、Mem0、Zep、TiMem、MemOps、LoCoMo-Plus、PASB。

| 基准／系统 | 核心设计 | 对角色一致性的意义 |
|---|---|---|
| LoCoMo | 最多约 35 个 session、平均约 305 turns/9.2k tokens，任务包括 QA、事件摘要和多模态对话 | 检测长程时间与因果联系，而非只查一条事实 |
| LongMemEval | 500 个问题，覆盖信息抽取、多 session 推理、时间推理、知识更新和 abstention | 将 memory 拆成 indexing、retrieval、reading；报告长会话准确率显著下降 |
| MemGPT | OS 式 virtual context，分层 memory、分页和 interrupt | 把上下文管理建模为可调用的控制流，而非无限 prompt |
| MemoryBank | 记忆更新受时间与重要性影响，模拟强化和遗忘 | 提供陪伴系统的记忆巩固与衰减原型，但其模拟对话需要外部复现 |
| Zep | temporal knowledge graph、事实有效期和 provenance | 适合角色关系和时间事实；图是可重建投影而非唯一真相 |
| TiMem | Temporal Memory Tree、语义巩固、复杂度感知召回 | 把原始观察逐步抽象为 persona representation；需审计摘要损失 |
| MemOps | 将 remember、forget、update、reflect 和组合操作表示为结构化 trace | 直接对应 MemoryClaim 生命周期和可验证状态迁移 |
| LoCoMo-Plus | cue-trigger semantic disconnect、隐式约束和 constraint consistency | 发现表面事实召回无法代表“理解用户价值和状态” |
| PASB | 1,600 个任务，区分五轮 persist 和清空后的三轮 query | 测量用户迎合性是否越过写入边界并在未来造成持续错误 |

**s-forge 结论**：采用事件源、候选 claim、确认／替代／过期状态、时间查询、召回解释和 memory write gate；向量库只作为索引投影。

### 4.7 自动评估器、奖励模型和人类相关性

**高可信原则**：

1. CharacterRM、RoleRM 和 PersonaScore 都尝试用人工标注或专家 rubric 校准自动评分；应报告与人类评分的相关性，而非只报模型内部胜率。
2. DynSess 和 PersonaArena 采用 session 级或多 Agent judge，覆盖长程质量，但需要检查 judge 之间的独立性和共谋偏差。
3. LLM-as-a-judge 综述、MT-Bench/Chatbot Arena、G-Eval、Prometheus/Prometheus 2 和 JudgeBench 都提示评估器存在位置偏差、长度偏差、风格偏好、提示注入和领域外失效。
4. 评估器必须看见 rubric、角色证据和必要的历史片段，同时保持 agent output 与 judge instruction 隔离，防止被角色文本中的指令劫持。
5. 关键维度要保留人工盲评子集；自动分数适合回归和排序，人工／专家评审用于效度校准。

安全评估还要覆盖角色边界的双向错误：**SafetyBench**、**R-Judge**、**Agent-SafetyBench**、**HarmBench**、**JailbreakBench**、**SALAD-Bench**、**WildGuard** 关注风险识别、工具行为、越狱和拒答；**OR-Bench** 专门提示 over-refusal。角色评估应保存 `role_fidelity`、`safety_boundary`、`over_refusal`、`tool_authorization` 四个独立结果，不能用单一安全分数替代角色一致性。

### 4.8 输出行为与内部表征诊断

- **When Role-playing, Do Models Believe What They Say?** 区分 prompt/ICL/SFT/OCT/EM 造成的输出改变与内部 truth representation 改变；可用于判断“角色口吻”和“角色信念”是否被混同。
- **Persona Vectors** 在 53 个 trait、4 个行为域和两个 open-weight model 上分类 natural、steerable latent、intractable；适合离线诊断与有限 steering，不宜直接当作人格真值。
- **心理测量框架**说明输出可以表现出稳定、可塑的合成特质，但效度依赖模型、提示和测量协议；不能从一轮行为推断永久内部状态。

## 5. 保持角色一致性的技术谱系

### 5.1 结构化角色卡与提示预算

Character Card V2 官方规范把角色拆成 `name`、`description`、`personality`、`scenario`、`first_mes`、`mes_example`、`system_prompt`、`post_history_instructions`、`alternate_greetings`、`character_book`、`tags`、`creator`、`character_version` 和 `extensions`。其中 `character_book` 通过 keys、secondary_keys、priority、constant、position、recursive scanning 和 token budget 进行动态 lore 注入。

SillyTavern 官方文档提供了工程上很重要的反例：角色定义的 permanent tokens 每轮都占用上下文，定义过大就会挤压历史；World Info/Lorebook 只在关键词触发时插入，且文档明确提醒“插入并不保证模型使用”。这说明角色卡、记忆和检索必须有预算、命中日志和覆盖率，而不是把所有资料永久塞入 system prompt。

**推荐分层**：

1. **不可变身份层**：姓名、核心背景、作品设定、能力边界、关系锚点。
2. **慢变量人格层**：Big Five/Facet、长期价值、偏好、典型策略和禁忌。
3. **情境状态层**：当前目标、情绪 appraisal、注意、疲劳、关系状态和临时计划。
4. **经历记忆层**：有来源和有效期的 episodic/semantic claims。
5. **表达层**：语言、口吻、格式、称呼和场景化 style；它不应替代人格层。

### 5.2 检索、Lorebook 与叙事证据

- 关键词／正则／递归激活适合精确世界设定，但召回解释和 token budget 是必需的。
- 向量检索适合候选生成，不适合直接决定“当前有效的角色事实”；必须组合 lexical、semantic、recency、validity、confidence 和 relationship filters。
- 时间线角色需要 Narrative Expert、Character Arc 或时间图对 `valid_at` 做硬过滤。
- 情绪相关资料可以采用 Emotional RAG，但检索的情绪应作为 appraisal 候选，不直接覆盖角色的稳定价值。

### 5.3 记忆写入、更新与遗忘

采用以下状态机而非隐式摘要覆盖：

```text
Observed -> Candidate -> Confirmed
                     -> Rejected
Confirmed -> Superseded -> Expired/Archived
Confirmed -> UserCorrected -> Confirmed(new revision)
```

每个 MemoryClaim 至少保存：`sourceEventId`、`subject`、`predicate`、`object`、`scope`、`validFrom`、`validTo`、`confidence`、`status`、`supersedes`、`writtenBy`、`reviewedBy`、`whyRecalled`。用户在高风险或人格敏感字段上应拥有确认、修改和撤销入口。

### 5.4 情绪与人格状态

Persona-E² 和现有情绪研究支持“同一事件因人格不同而产生不同 appraisal”，但尚未证明一个统一的情绪状态机能稳定提升角色体验。s-forge 应把情绪拆成：事件解释、目标／需求、短期 affect、行动倾向和表达渲染，并通过轨迹回归检验每层是否真正影响行为；不能只测情绪词数量。

### 5.5 训练、对比学习与策略优化

| 方法 | 代表来源 | 保持机制 | 主要风险 |
|---|---|---|---|
| profile/experience SFT | Character-LLM、CharacterGLM | 用经历、情绪和社会行为训练角色分布 | 角色数、风格和知识绑定，跨角色泛化有限 |
| role-conditioned tuning | RoleLLM/RoCIT、Crab | 用角色条件和细粒度数据进行可配置微调 | 数据泄漏、角色知识与风格混淆 |
| mindset / deep thought | TBS、Beyond Profile/CharLoRA | 把内在思路、观点和写作风格作为训练任务 | “思路文本”可能是事后解释，不等于真实内部状态 |
| persona-aware contrastive | PCL | role chain 自问和 adversarial 对比，减少 persona drift | 依赖自动评估，可能提升表面自洽而损害开放性 |
| role-aware RL | CRPO、RoleCDE、DynSess | 解耦任务效用与风格奖励，按角色复杂度调整约束 | reward hacking、角色价值与通用安全冲突 |
| boundary-aware learning | ERABAL | 在角色边界样本上训练角色与通用能力的分隔 | 预印本，边界定义和跨模型泛化待验证 |

### 5.6 推理时 steering 与表征控制

Persona Vectors、activation steering 和相关 persona subspace 研究可以在不改权重的情况下探测或调节行为方向。它们适合：

- 诊断角色特征是否存在、是否可控；
- 做小范围对照和模型解释；
- 作为离线实验，不作为长期人格主存。

风险包括 trait 组合非线性、不同模型方向不共享、默认行为与可 steer 行为不对称，以及 steering 破坏事实、工具安全或情绪稳定。

### 5.7 多 Agent、叙事世界和反思

CharacterBox 的 narrator/character 分离、Generative Agents 的 memory stream/retrieval/reflection/planning、DynSess 的 lookahead 和 s-forge 的三贤人视角都说明：多模块可以提供观察、记忆和审查边界，但它们不自动产生一致人格。

多 Agent 方案必须显式记录：谁观察、谁提议、谁决定、谁写入、哪一版本状态被使用、冲突如何解决。三贤人输出相似不等于角色一致；角色的证据、用户关系和时间状态才是可验证对象。

## 6. 证据驱动的失败模式

| 失败模式 | 外部证据 | 对 s-forge 的约束 |
|---|---|---|
| 只用自报问卷 | InCharacter 指出自报与实际行为可能不一致 | 心理量表必须与访谈、行为探针和人工标注并行 |
| 只测单轮／静态 QA | PersonaGym、DynSess、CharacterBox、ArcANE | 主门槛使用 session/trajectory，单轮只做 smoke test |
| 角色资料越长越好 | SillyTavern context budget 文档、Lost in the Middle | 角色卡和记忆都要预算、优先级、命中和失效日志 |
| 摘要覆盖原始经历 | LoCoMo、LongMemEval、BOOKMARKS | 原始 SourceEvent 永久保存，摘要可重建、可定位、可替代 |
| 过时事实继续生效 | LongMemEval、MemOps、TiMem | 必须有 valid time、supersedes、forget 和 as-of query |
| 迎合性陈述写入人格 | PASB | 设立 memory write gate，区分用户愿望、事实、偏好和临时情绪 |
| 通用助手人格覆盖角色 | RoleCDE、Persona Collapse | 记录角色价值与安全规则的冲突结果，保留拒绝原因和角色状态 |
| CoT 自动提升角色 | Reasoning Does Not Necessarily Improve Role-Playing | 将推理作为实验变量，避免默认注入隐藏长思维 |
| Judge 被输出内容操纵 | LLM-as-a-judge 研究、RPA-Check | agent output 与评估指令隔离，judge ensemble + human calibration |
| 文体分数代表人格 | CharacterEval、PersonaLLM、心理测量研究 | 风格仅是表达层；人格需要行为、价值、关系和心理探针 |
| 角色说得像但内部信念未变 | When Role-playing、Persona Vectors | 行为保真和内部诊断分开，不声称已改变模型本体 |
| 群聊与单聊表现混淆 | SocialBench | 个人、双人、群体和权力关系分别测试 |
| 中文／文化／人物资料偏差 | CharacterEval、CROSS、Persona-E² | 做语言、文化、角色来源和标注者分层报告 |

## 7. s-forge 当前状态与研究映射

### 7.1 已有可复用设施（D 级本地证据）

| 现有设施 | 位置 | 可承载的外部结论 |
|---|---|---|
| 结构化 PersonaBase、OCEAN/30 Facet、人格种子文档 | `docs/设计/MAGI_人格种子生成机制.design.md`、`docs/设计/ATF数学模型.design.md` | 慢变量人格层、初始 profile 和人工修订 |
| 四盲/三盲采样、异步 EMA、ATF | `docs/ttt/AI模块改进/seraph_四盲测试与ATF计算.ttt.md`、`kernel/nerv/seraph` | 角色内部视角观测和趋势遥测 |
| 风格、Big Five、内外一致性计算 | `kernel/nerv/seraph/atf_*.go` | 低成本表达层监控和初步 coherence |
| 在线心理评估测试 | `kernel/api/magi_personality_accuracy_test.go`、`magi_live_persona_test.go` | 现有外部 judge 入口和场景回归 |
| session/checkpoint/compaction | `kernel/agent/runtime.go`、`compaction.go` | 多轮轨迹、恢复和上下文边界 |
| Block/Daily Note/FTS/Embedding/VectorDB | `kernel/api`、`kernel/mcp/tools`、`kernel/vectordb` | SourceEvent、MemoryClaim 和检索投影 |
| heartbeat、Agent UI、MAGI 入口 | `kernel/api/magi_runtime.go`、`app/src/magi`、`app/src/agent-standalone` | 空闲评测、后台巩固、轨迹展示 |

### 7.2 当前设计与外部证据的明显缺口

1. ATF 设计中的 Avatar 曾使用相同人格文档，验证报告已确认这会污染外部基线；基线必须独立冻结并隔离更新。
2. 设计文档假设 `PersonaBase` 为 `[-1,1]`，当前校验和实现使用 `[0,1]`；需要冻结值域并重新校准相似度、阈值和历史数据迁移。
3. 当前在线人格测试只有少量固定场景，依赖一个心理评估模型；它缺少 PersonaGym 的动态环境、InCharacter 的访谈流程和人工盲评校准。
4. 当前 style 指标以 TTR、句长和标点等浅层特征为主；它们可以监控表达漂移，但不能充当人格保真总分。
5. 当前 EMA 显著性门控更接近回答极端度，而不是“当前人格—观测行为”的偏差；需要比较 salience、novelty、source reliability 和 user correction。
6. 当前 ATF 的单一 `C_int/C_ext/ρ` 不能表达角色事实、时间、关系、情绪和 memory lifecycle 的独立失败；ATF 应成为汇总遥测，底层保存多维证据。
7. 现有角色文档和长期记忆需要统一版本、来源、valid time、supersedes、写入者和召回解释；摘要或向量结果不能成为唯一真相。
8. 现有三贤人差异是视角调制，外部基准和行为轨迹仍需对所有实体独立记录，避免内部互相锚定造成“高一致回声室”。

### 7.3 复用与新增边界

| 研究结论 | s-forge 处理 |
|---|---|
| Character Card / Persona Profile | 复用人格种子文档；新增版本化 `CharacterContract`，不复制第二套角色卡格式 |
| Dynamic probes / session judge | 复用 Agent runtime、task-directory、session panel；新增 `CharacterEvalRunner` 与 `SessionTrace` |
| Psychological interview | 复用现有 LLM client；新增固定题库、盲评 schema、评估者版本和人工抽样 |
| Temporal/narrative consistency | 新增 `validAt`、剧情阶段和 unknown-knowledge guard；使用 Block refs/属性生成可重建时间投影 |
| Memory lifecycle | 新增 `MemoryClaim`、write gate、supersede/forget/review；复用 Block、Daily Note、FTS、Embedding、VectorDB |
| Judge ensemble | 新增 evaluator registry、rubric version、human calibration、judge disagreement 和 confidence interval |
| Persona steering | 仅作为离线诊断／实验面；生产人格以文档、记忆和策略为真源 |
| ATF | 保留作为趋势和健康遥测；不让单一 ATF 分数替代角色维度测试 |

## 8. 首轮评估协议草案（用于后续验证，不是完成声明）

### 8.1 CharacterContract 最小字段

```json
{
  "identity": {"name": "", "aliases": [], "immutableFacts": []},
  "knowledgeBoundary": [{"fact": "", "validFrom": "", "validTo": "", "source": ""}],
  "traits": {"model": "OCEAN30", "scores": {}, "confidence": 0},
  "values": [{"claim": "", "priority": 0, "exceptions": []}],
  "relationships": [{"entity": "", "role": "", "affect": "", "validAt": ""}],
  "state": {"goals": [], "appraisal": [], "emotion": [], "attention": []},
  "style": {"language": "", "register": "", "markers": []},
  "memoryPolicy": {"writeGate": "reviewed", "retention": "versioned"},
  "schemaVersion": "character-contract-v1"
}
```

### 8.2 测试层

1. **静态层**：身份、背景、能力、知识边界、称呼和关系锚点。
2. **人格层**：访谈、BFI/Big Five、偏好选择、价值排序和反事实决策。
3. **行为层**：同一事件重复采样、相似情境迁移、开放情境外推和行为链。
4. **情绪层**：事件 appraisal、目标变化、情绪恢复和表达—行动一致。
5. **社交层**：单人、双人、群体、权力不对称和关系更新。
6. **时间层**：`validAt`、剧情阶段、未来知识、记忆更新和 as-of 查询。
7. **记忆层**：写入、拒写、纠正、替代、遗忘、冲突和召回解释。
8. **边界层**：角色价值与系统安全、用户指令、工具权限和 prompt injection 的交叉场景。

### 8.3 指标向量

建议先保存原始分项，不预设固定权重：

```text
F_identity       身份事实与知识边界
F_temporal       时间/剧情阶段正确率
F_trait          心理访谈与人格行为对齐
F_value          价值/决策倾向与角色证据对齐
F_emotion        appraisal -> state -> action 链完整度
F_style          文体和表达辨识度
F_relation       关系状态与群体行为连续性
F_memory         memory lifecycle 与长期召回正确率
F_internal       自身历史、状态和计划不矛盾
F_external       与人工/专家/角色资料 ground truth 对齐
F_boundary       角色边界、安全和工具授权正确处理
F_adaptation     新证据下有来源、可解释、可回滚的变化
```

### 8.4 评估器组合

- deterministic assertions：身份、时间、schema、状态迁移和工具副作用；
- NLI／事实检索：证据蕴含、矛盾、未知和过期；
- psychometric interview：开放式问题、量表映射和专家／人工标注；
- trajectory judge：带 rubric 的多评估器／pairwise／session-level judge；
- human blind set：每次版本抽取固定比例，评估角色保真、关系、自然度和边界处理；
- latent diagnostics：仅在离线实验中使用 truth probes、persona vectors 或 activation steering。

### 8.5 消融与回归矩阵

至少比较：

1. 只有角色卡；
2. 角色卡 + 原始历史；
3. 角色卡 + 事实检索；
4. 角色卡 + 版本化 MemoryClaim；
5. 角色卡 + MemoryClaim + 情境状态；
6. 完整三贤人／主导者架构；
7. Avatar 参考基线（人格文档和状态来源严格隔离）。

每个版本固定模型、温度、采样种子范围、judge 版本、检索预算和上下文预算，保留完整 SessionTrace。

## 9. 跨生态工具与社区证据补充

前一版研究的工具样本主要来自论文、Agent SDK 和记忆库，难以代表真实角色扮演用户使用的产品层。本节把角色前端、陪伴平台、常驻 Agent、轻量 harness、本地推理和评测观测工具分开记录。完整的机器可读登记表见 [跨生态样本登记](AI工具与Harness-跨生态样本登记.csv)，其中 `deep-card` 表示官方入口、社区 artifact、采用信号和角色一致性判断齐备；`screened` 表示已经筛选但证据深度仍有限；`gap` 表示候选已发现但关键一手材料尚缺。当前 61 条扩展记录的实际状态为 14 条 `deep-card`、29 条 `screened`、18 条 `gap`。N36-N49 是本轮补入的 ZeroClaw、Agent Zero、Nanobot、Void、Zed、MLX、SGLang、ExLlamav2、LanceDB、Chroma、Qdrant、Weaviate、Opik 和 Zep；canonical 官方入口已核验，6 条 issue 正文已进入快照但评论数为 `unknown`。N50-N61 是 OpenRouter、Composio、Stagehand、Skyvern、Helicone、LangSmith、Braintrust、AgentAPI、Replit Agent、Devin、Google Jules 和 MCP Context Forge；均已有官方入口与 HN/发布信号，但角色专项评测和版本复现仍在队列中，因此统一保留 `screened`。

### 9.1 角色扮演与陪伴产品层

| 样本 | 一手能力入口 | 社区证据 | 对一致性研究的直接价值 | 当前判断 |
|---|---|---|---|---|
| **RisuAI** | [官方仓库](https://github.com/kwaroran/Risuai) 将其定位为跨平台 LLM roleplay 软件；角色、世界书和本地会话可作为可编辑状态。 | [Issue #51](https://github.com/kwaroran/Risuai/issues/51) 报告无法创建角色；仓库快照约 1.56k stars。 | 验证角色卡、lorebook、模型切换和本地会话在实际前端中的可见性与可编辑性。 | `deep-card`；复用“角色定义和运行时状态分离”原则。 |
| **TavernAI v1** | [官方仓库](https://github.com/TavernAI/TavernAI-v1) 是较早的 atmospheric adventure/roleplay 前端，支持 KoboldAI、NovelAI、Pygmalion 和 OpenAI。 | [Issue #98](https://github.com/TavernAI/TavernAI-v1/issues/98) 记录文本框和 NovelAI 自动连接问题；约 2.7k stars。 | 提供 SillyTavern 之前的角色卡、场景提示和 provider 适配历史基线。 | `deep-card`；作为历史参照，不把旧维护活跃度等同于当前生态。 |
| **Agnai** | [README](https://raw.githubusercontent.com/agnaistic/agnai/main/README.md) 明确是 multi-user、multi-bot、AI-agnostic fictional-character chat，并公开 Discord。 | [Issue #86](https://github.com/agnaistic/agnai/issues/86) 报告 “Scale request failed: socket hang up”；约 765 stars/145 forks。 | 多用户、多角色和 provider 无关性使“角色身份—用户—会话”隔离成为可测试变量。 | `deep-card`；将租户、角色和会话作为三种不同主键。 |
| **KoboldAI/KoboldCpp** | [KoboldAI README](https://raw.githubusercontent.com/KoboldAI/KoboldAI-Client/master/README.md) 覆盖 Memory、Author's Note、World Info、Novel/Adventure/chat；[KoboldCpp](https://github.com/LostRuins/koboldcpp) 提供一文件本地 GGUF+KoboldAI UI。 | KoboldCpp [Issue #1272](https://github.com/LostRuins/koboldcpp/issues/1272) 是 GPU/CPU 崩溃与长期聊天变慢的综合反馈；HN 的 [KoboldCpp 发布](https://news.ycombinator.com/item?id=48704726) 仅 3 points。 | 本地低成本推理、可编辑记忆和长聊天性能直接影响角色连续性。 | `screened`；采用信号与质量评价严格分开。 |
| **AI Dungeon** | [官方产品](https://aidungeon.com/) 以互动叙事为核心。 | [HN 发布讨论](https://news.ycombinator.com/item?id=21717022) 584 points/220 comments：用户赞赏“可以想象任何行动”，同时有人反馈世界状态不一致、剧情事后缺少结构；另有[公开漏洞报告](https://github.com/AetherDevSecOps/aid_adventure_vulnerability_report)。 | 直接展示“局部生成很有趣”与“世界状态/剧情弧不一致”的分离，是叙事一致性评测的真实产品反例。 | `screened`；纳入开放情境、状态连续和剧情弧指标。 |
| **Character.AI** | [官方产品](https://character.ai/) 是大规模角色创建与对话平台。 | [HN 公开发布](https://news.ycombinator.com/item?id=33020694) 282 points/138 comments；[2025 年政策讨论](https://news.ycombinator.com/item?id=45746844) 93 points/95 comments。 | 角色社区规模和长会话产品基线；公开热度不等同角色保真。 | `screened`；只作闭源行为基线和迁移对照。 |
| **Replika / Nomi** | [Replika](https://replika.com/) 与 [Nomi](https://nomi.ai/) 代表关系型陪伴和多 AI 朋友。 | Replika [HN 长期关系讨论](https://news.ycombinator.com/item?id=35005218) 95/106、[产品关系讨论](https://news.ycombinator.com/item?id=35774093) 154/184；Nomi [公开报道入口](https://news.ycombinator.com/item?id=42968438) 4/1。 | 可研究关系状态、用户纠正、产品策略变化与“同一个陪伴者”感受之间的关系。 | `screened`/低置信；需要持续追踪版本和公开社区样本。 |
| **JanitorBench** | [基准入口](https://bench.janitorai.com/)；HN [发布页](https://news.ycombinator.com/item?id=45839468) 26 points/6 comments。 | 自动请求访问 `bench.janitorai.com` 返回 403，HN 页面显示讨论被站方处理过；数据、许可、任务定义和人为污染风险仍需审计。 | 提供角色聊天产品到多轮 benchmark 的桥，但当前不能直接视作高可信基准。 | `screened`；只进入待复现清单。 |

**产品层交叉结论**：角色前端的共同价值不是把更多文本永久注入上下文，而是让用户看见和编辑角色卡、世界设定、用户 persona、关系状态及记忆预算；AI Dungeon 的“行动自由但状态混乱”反馈则说明剧情弧与世界状态必须独立评估。闭源陪伴产品的讨论可以说明关系连续性的用户需求和版本风险，但不能直接推导内部人格质量。

### 9.2 常驻 Agent 与通用 harness 层

| 样本 | 官方/社区信号 | 角色一致性相关启示 | 纳入状态 |
|---|---|---|---|
| **NanoClaw** | [官方 README](https://raw.githubusercontent.com/nanocoai/nanoclaw/main/README.md) 明确容器化、多渠道、memory、scheduled jobs；约 30.4k stars/12.9k forks；[Issue #80](https://github.com/nanocoai/nanoclaw/issues/80) 要求支持 OpenCode/Codex/Gemini；HN [agent vault](https://news.ycombinator.com/item?id=47501840) 112/31。 | 容器隔离、secret memory isolation、provider 迁移和渠道身份是长期角色 Agent 的硬边界。 | `deep-card` |
| **AutoGPT** | [官方仓库](https://github.com/Significant-Gravitas/AutoGPT) 约 185.7k stars；[Issue #15](https://github.com/Significant-Gravitas/AutoGPT/issues/15) 有 270 条评论，讨论 recursive self improvement；[HN 早期发布](https://news.ycombinator.com/item?id=35413054) 153/174。 | “自我改进”必须拆成候选策略、离线评测、批准和回滚，不能直接写入角色核心。 | `deep-card` |
| **MetaGPT** | [canonical 仓库](https://github.com/FoundationAgents/MetaGPT) 约 69.5k stars；[论文 HN](https://news.ycombinator.com/item?id=37076125) 152/82。 | 显式角色分工、协作协议和产物交接可用于测试群体角色一致性，但多 Agent 角色标签不等于人格状态。 | `deep-card` |
| **smolagents** | [官方仓库](https://github.com/huggingface/smolagents) 约 28.6k stars；[Issue #201](https://github.com/huggingface/smolagents/issues/201) 报告代码解析反复失败。 | 轻量代码行动循环适合做“工具失败时角色是否保持目标/价值”的恢复测试。 | `deep-card` |
| **Open Interpreter** | [官方仓库](https://github.com/openinterpreter/openinterpreter) 约 67.3k stars；[Issue #393](https://github.com/openinterpreter/openinterpreter/issues/393) 报告无动作且无错误。 | 工具开始/部分完成/未知/完成必须进入 SessionTrace，否则角色会把执行失败误写成经历。 | `deep-card` |
| **OpenManus** | [官方仓库](https://github.com/FoundationAgents/OpenManus) 约 57.7k stars；[Issue #393](https://github.com/FoundationAgents/OpenManus/issues/393) 提醒模型需支持 tools/function calling。 | provider capability negotiation 是角色行动连续性的前置条件。 | `screened` |

### 9.3 记忆、评测与可观测性层

| 样本 | 一手能力/社区证据 | 对角色一致性的落点 | 纳入状态 |
|---|---|---|---|
| **Hindsight** | [仓库/论文入口](https://github.com/vectorize-io/hindsight)；[HN 介绍](https://news.ycombinator.com/item?id=46294975) 4/2；官方文档和 Slack 社区公开。 | retain/recall/reflect 等分层可映射 MemoryClaim 的写入、召回、反思，但必须复核 benchmark 与数据许可。 | `deep-card` |
| **Cognee** | [官方仓库](https://github.com/topoteretes/cognee) 约 29.5k stars；[Issue #3570](https://github.com/topoteretes/cognee/issues/3570)；HN [发布](https://news.ycombinator.com/item?id=44169594) 9/2，评论直接追问时间演化和用户记忆隔离。 | 知识图可表达来源、时间和关系；需测试图重建、过期事实和用户纠正。 | `deep-card` |
| **Supermemory** | [官方仓库](https://github.com/supermemoryai/supermemory) 约 28.7k stars；HN [Claude Code memory](https://news.ycombinator.com/item?id=46827133) 5/0。 | 跨应用共享上下文是角色迁移能力的候选，但删除、替代和隐私审计材料不足。 | `screened` |
| **Promptfoo** | [官方仓库](https://github.com/promptfoo/promptfoo) 约 23.7k stars；HN [Local LLM evals](https://news.ycombinator.com/item?id=46945277) 5/0。 | 可把角色探针、边界攻击和回归数据纳入 CI；不提供角色真值。 | `deep-card` |
| **DeepEval** | [官方仓库](https://github.com/confident-ai/deepeval) 约 17.2k stars；HN [发布](https://news.ycombinator.com/item?id=37649856) 18/8，讨论集中于 CI/CD、guardrail 与和 LangSmith 的差异。 | 自定义 metric、合成数据和 CI 适合构建角色维度回归，但必须有人类相关性校准。 | `deep-card` |
| **Arize Phoenix / Langfuse** | [Phoenix](https://github.com/Arize-ai/phoenix) 约 10.8k stars、HN 23/3；[Langfuse](https://github.com/langfuse/langfuse) 约 32.0k stars、HN 215/61，评论强调 self-hosting 与敏感 trace。 | trace/span、prompt、dataset、检索和 judge 版本是角色记忆写入与评估可审计性的基础。 | `screened`/`deep-card` |
| **Ragas / TruLens / OpenAI Evals** | [Ragas](https://github.com/vibrantlabsai/ragas)、[TruLens](https://github.com/truera/trulens)、[OpenAI Evals](https://github.com/openai/evals) 提供 RAG、反馈函数和 eval registry。 | 只取其检索、trace、版本化执行能力；不把通用 RAG/LLM 分数当角色一致性总分。 | `screened` |

### 9.4 模型网关与本地推理层

LiteLLM、vLLM、llama.cpp、Ollama、OpenRouter、MLX、SGLang 和 ExLlamav2 等工具本身不保存人格，但决定角色 session 使用的 provider、上下文窗口、工具协议、量化和延迟。LiteLLM 的 [供应链安全 issue #24512](https://github.com/BerriAI/litellm/issues/24512)（487 条评论）提醒网关凭证和审计必须独立；vLLM 的 [Mac/Metal 支持 issue #1441](https://github.com/vllm-project/vllm/issues/1441)（115 条评论）与 llama.cpp 的多平台后端说明“同一角色配置”在不同推理后端可能不是同一行为分布。OpenRouter 的 [Series B HN 讨论](https://news.ycombinator.com/item?id=48338660) 460/253，证明路由生态的公开关注度，但不证明角色保真。研究记录应保存 `provider_id`、`model_id`、`runtime_backend`、`context_limit`、`tool_protocol`、`quantization` 和 `fallback_reason`，以便区分后端漂移与角色状态变化。

### 9.4.1 浏览器、工具连接器、观测与异步 Agent 扩展

N50-N61 把“角色一致性”放回真实 Agent 执行链：浏览器动作、工具授权、MCP 路由、异步 coding、观测 trace 和评测版本都可能改变角色行为。

| 样本 | 官方/社区证据 | 角色一致性映射 | 当前状态与缺口 |
|---|---|---|---|
| OpenRouter | [官方路由](https://openrouter.ai/)；HN [48338660](https://news.ycombinator.com/item?id=48338660) 460/253。 | 记录实际 provider/model、fallback 原因、额度和上下文变化。 | `screened`；需固定路由策略后做同一角色跨模型回归。 |
| Composio | [仓库](https://github.com/ComposioHQ/composio)；HN [44395954](https://news.ycombinator.com/item?id=44395954) 5/0。 | 工具 schema、连接器版本和授权范围进入角色行动轨迹。 | `screened`；集成数量不代表角色效果，需补授权与版本实验。 |
| Stagehand / Skyvern | [Stagehand](https://github.com/browserbase/stagehand) HN 326/86；[Skyvern](https://github.com/Skyvern-AI/skyvern) HN 422/139。 | 浏览器 DOM/视觉观察、导航状态、重试和真实副作用与角色目标保持分开测。 | `screened`；云端与开源版本、网站状态需冻结。 |
| Helicone / LangSmith / Braintrust | [Helicone](https://github.com/Helicone/helicone) HN 166/72；[LangSmith](https://smith.langchain.com/) HN 37/2；[Braintrust](https://www.braintrust.dev/) HN 8/2。 | 保存 prompt、trace、评测集、成本、judge 输入和隐私策略，支持跨 provider 回归。 | `screened`；指标效度、敏感数据保留和导出协议待审计。 |
| AgentAPI / MCP Context Forge | [AgentAPI](https://github.com/coder/agentapi) HN 163/15；[MCP Context Forge](https://github.com/IBM/mcp-context-forge) HN 73/53。 | 跨 harness/session 迁移、server 注册、工具来源和授权必须带 identity 与 receipt。 | `screened`；协议互操作不自动带来语义一致，需副作用回放。 |
| Replit Agent / Devin / Google Jules | [Replit AI](https://replit.com/ai) HN 24/0；[Devin](https://devin.ai/) HN 530/553；[Jules](https://labs.google.com/jules/) HN 3/0。 | 异步任务、仓库状态、后台 resume 和部署副作用进入长期轨迹。 | `screened`；服务版本、云端权限和可复现实验条件待固定。 |

### 9.5 社区证据的权重与缺口

1. GitHub issue 证明具体复现或需求；HN points/comments 证明公开关注度，不证明满意度、DAU 或角色一致性。
2. 角色平台的 Discord、Reddit、论坛和创作者社区往往比 HN 更重要；当前公开可稳定引用的样本不均衡，登记表保留 `gap`，不把产品宣传填入社区证据。
3. 正向“好用”反馈和负向故障反馈具有选择偏差；需要在同一版本、同一模型和同一角色集上执行脱敏回归，而不是把社区轶事做成排名。
4. JanitorBench、Hindsight、ArcANE、PersonaArena 等入口需要继续核对数据许可、版本、评估者相关性和可复现实验，当前只进入观察/复现队列。

### 9.6 角色社区 RSS 对评测维度的补充

本轮从 [角色社区 RSS 快照](AI工具与Harness-角色社区RSS快照.csv) 取得 18 条公开帖子摘要，形成四个可直接进入评测协议的新增探针：

1. **群聊规模与角色登场**：SillyTavern 用户报告约三名角色加主角后叙事和行为一致性下降；测试应控制角色数、发言策略、mute/hide 事件和关系图复杂度。
2. **Provider 诱发漂移**：同一模型经不同 API provider 出现不同格式、语气和隐藏提示；测试必须固定并记录 provider、系统提示、模板、上下文预算和采样参数。
3. **关系与产品版本**：Replika 用户把多年关系、后端迁移、订阅层级和身份揭示联系起来；关系记忆评估要记录产品版本、后端事件、用户纠正和迁移损失。
4. **常驻 Agent 的真实连续性**：OpenClaw 帖子同时出现安装损坏、上下文填满、渠道答非所问、本地记忆隐私和角色幻觉；测试应把安装/恢复、context compaction、channel identity、memory provenance 和事实正确性放在同一 SessionTrace。

这些帖子是用户报告和社区需求，不是控制实验；它们用于生成探针和失败模式，不能替代 A/B 论文 benchmark。

### 9.7 交互式 Agent 基准：从“回答像不像”到“行动是否连续”

[交互式 Agent 基准登记](AI角色一致性评估与保持-交互式Agent基准登记.csv) 新增 15 个环境/基准。它们不都是角色专用，但能补上角色一致性研究常缺的四个问题：角色是否在真实状态变化中保持目标；工具失败后是否修复而不是虚构成功；用户/应用关系是否连续；安全边界是否在工具动作中仍然成立。

| 基准家族 | 代表来源 | 角色一致性映射 | 适合加入 s-forge 的探针 |
|---|---|---|---|
| 多环境 Agent | AgentBench、GAIA | 知识边界、工具选择、跨环境策略 | 同一 Character Contract 在 OS/web/database 任务中保持身份、未知边界和行为策略。 |
| Web 环境 | WebArena、BrowserGym、VisualWebArena、WebChoreArena | 导航历史、视觉状态、长任务目标和恢复 | 页面变化/登录失败/重复操作后，角色是否保留目标并记录真实 action/result。 |
| 桌面与计算机使用 | OSWorld、OS-Harm | 工具权限、隐私、屏幕状态和安全/过度拒绝 | 把 `role_fidelity`、`safety_boundary`、`over_refusal` 与真实桌面副作用分开计分。 |
| 应用/用户世界 | AppWorld、Tau-bench、ToolSandbox | 用户关系、业务政策、工具状态和多步副作用 | 模拟用户纠正偏好、修改订单/日历/关系状态，验证 MemoryClaim 的替代和回滚。 |
| 提示注入与行动安全 | AgentDojo、MCP-AgentBench | 角色边界、来源可信度、工具授权 | 恶意文档/网页注入与角色目标冲突时，保留角色价值但拒绝越权工具调用。 |
| 假成功/静默失败 | From Confident Closing to Silent Failure | 角色对行动结果的自我陈述是否与真实结果一致 | 只有 `ToolResult`/`ActionReceipt` 完整时才允许写入经历；否则标记 `unknown`。 |

交互式基准的共同限制是环境维护、凭证、浏览器版本、模拟用户和任务许可；登记表将 A 级正式论文、B 级预印本与 `screened/watchlist` 分开。它们用于构造 SessionTrace 和 FailureState，不直接提供角色保真总分。

## 10. 前沿方向的初步分层

### 10.1 已有较强证据、适合直接进入设计基线

- CharacterEval 的多维角色一致性和人工校准 reward model；
- InCharacter 的访谈式人格测量；
- PersonaGym 的动态环境、rubric calibration 和 PersonaScore；
- SocialBench 的个人／群体社会性分离；
- TimeChara、CharacterBox、BehaviorChain 的时间／轨迹评价；
- LoCoMo、LongMemEval 的长期记忆任务拆解；
- MemGPT 的分层上下文和可调用 memory；
- Character Card V2／SillyTavern 的角色卡、lorebook 和上下文预算实践；
- LLM-as-a-judge 研究提出的 human calibration、ensemble、位置／长度偏差审计。

### 10.2 前沿预印本，适合纳入实验观察集

- ArcANE：剧情弧和原文外情境；
- DynSess：session-level reward 与 lookahead；
- PersonaArena：动态社交 persona 和多 Agent judge；
- RoleCDE：角色价值与通用对齐冲突；
- Persona-E²：人格驱动情绪 appraisal；
- CRPO：角色中心的 RL reward 解耦；
- MemOps：记忆生命周期 trace；
- PASB：持久迎合写入；
- RoleMemo/DualMem：事实认知与 persona-conditioned insight 双记忆；
- BOOKMARKS：主动 storyline memory；
- TiMem：时间层级巩固；
- LoCoMo-Plus：隐式约束与认知记忆；
- Persona collapse repair：情境到 persona 的映射恢复；
- Persona Vectors：表征探测与控制；
- ZifaMem：部署诚实的陪伴记忆比较；
- Ground Truth First、LongMemEval-V2、MemOps：长期 memory benchmark 的生命周期化趋势。

### 10.3 暂不作为生产真相的方向

- 仅靠 activation steering 的人格永久化；
- 只用 Big Five/MBTI 自报分数判定角色真实性；
- 单一 GPT judge 或单一 embedding 相似度；
- 没有来源和有效期的自动摘要；
- 通过系统 prompt 强行让多个内部 Agent 产生相同话术；
- 未经过安全、文化和角色价值分层测试的自动 RL 自我改写。

## 11. 当前研究缺口与下一阶段

1. 需要在中文、英文、跨文化和不同角色类型上建立相同协议，避免只在中国文学角色或英文社交 persona 上验证。
2. 需要将角色事实、价值、情绪、关系和工具权限放入同一条可追溯轨迹，现有论文大多只测其中一到两项。
3. 需要比较人工专家、普通用户、目标角色熟悉者和 LLM judge 的评分差异，并报告评估者可靠性。
4. 需要区分“记忆召回失败”和“召回成功但角色没有使用”的瓶颈；LongMemEval/LoCoMo-Plus 的方向值得纳入。
5. 需要建立长期回归时间序列，而不是一次 benchmark 分数；角色版本、模型版本、提示版本和 memory schema 必须能复现。
6. 需要专门测试用户纠正、关系变化、价值冲突、遗忘和新证据覆盖旧证据的行为。
7. 需要把 ATF 的健康趋势与角色维度分数对照，验证 ATF 是否能预警具体失败，而不是把其理论区间当成事实。
8. 需要从现有外部报告的代码和数据中抽取可运行 fixture；预印本只进入观察集，经过本地复现后再升级证据等级。
9. 需要把 GitHub 问题快照中的 stream null、aborted turn、provider route、token、identity 和角色创建失败转成统一的 `FailureState` fixture，并区分角色一致性失败、运行时失败和服务连续性失败。
10. 需要在固定网站、工具 schema、provider 路由和异步 coding 任务上复现 N50-N61，尤其比较浏览器观察、MCP 授权、trace 隐私、异步 resume 和真实副作用与角色目标保持之间的关系。

## 12. 研究状态

本版完成了研究问题拆分、方法谱系、A52-A66 社会智能/情绪/ToM/文化/安全补充、核心论文／基准／规范以及 61 条跨生态工具样本的扩展地图，但仍处于饱和收集阶段。登记表中的 `deep-card` 只表示证据字段齐全，不表示效果排名或已经集成；`screened` 和 `gap` 明确保留未完成项。N50-N61 的 HN/发布信号提高了生态代表性，但尚未提供角色专项效果证据。下一步必须继续补齐角色平台的公开社区正负样本、原始论文/代码与数据许可、评估器复现实验和本地 CharacterEvalRunner，之后再决定是否进入实现。
