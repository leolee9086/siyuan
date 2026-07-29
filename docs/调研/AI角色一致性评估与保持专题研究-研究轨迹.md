# AI 角色一致性评估与保持专题研究：研究轨迹

> 研究日期：2026-07-28（Asia/Shanghai）。本文记录检索入口、原始摘要事实、来源等级、代码／数据链接、版本差异、失败请求和审计结果，与 [饱和收集主报告](AI角色一致性评估与保持专题研究-饱和收集.md) 配套。

## 1. 研究目标与证据策略

### 1.1 饱和收集目标

本轮先建立“角色一致性评估与保持”领域的饱和候选集，覆盖：

- role-playing／character fidelity benchmark；
- persona／personality psychometrics；
- dynamic／session／trajectory evaluation；
- timeline、character arc、world simulation；
- social、emotion、relationship、value conflict；
- long-term memory、temporal memory、memory lifecycle；
- prompt／character card／lorebook；
- SFT、contrastive learning、RL、activation steering；
- LLM-as-a-judge、人类相关性和评估器偏差；
- 真实产品与社区生态：角色卡/酒馆前端、互动叙事、陪伴平台、常驻 Agent、coding harness、本地模型工作台、记忆层、评测和可观测性；
- 本地 s-forge 的 PersonaBase、ATF、四盲测试、记忆和现有回归测试。

### 1.2 来源等级

| 等级 | 解释 | 例子 |
|---|---|---|
| A | 正式会议／期刊论文或正式出版页面，数据与方法可追溯 | ACL Anthology、EMNLP、NAACL、Nature Machine Intelligence |
| B | arXiv 预印本，摘要、代码或数据公开 | ArcANE、DynSess、MemOps、RoleCDE |
| C | 官方规范、产品文档、开源仓库或模型卡 | Character Card V2、SillyTavern、MemoryBank repo |
| D | s-forge 本地设计、源码、测试和问题验证报告 | ATF、PersonaBase、在线人格测试 |
| E | 社区讨论、博客、二手整理 | 仅用于失败模式和线索，不作为能力结论 |

### 1.3 重要解释边界

- 预印本摘要中的“state of the art”“显著提升”等属于作者报告，当前只记录为待复现事实。
- stars、引用数和代码仓库存在只能证明可发现性或可复现入口，不代表产品质量或真实用户量。
- 角色一致性指标通常针对目标任务；不同 benchmark 的分数不可直接横向比较。
- 心理测量的“人格”是输出行为或心理量表上的构念，不自动等同于模型内部真实意识或稳定本体。
- 产品社区证据用于证明真实需求、故障和迁移约束；它不能替代论文效度，也不能由 stars、HN points 或单条正面评价推出质量排名。

## 2. 查询记录

### 2.1 arXiv API

查询时间为 2026-07-28，使用 `https://export.arxiv.org/api/query`，按相关性和提交时间组合查询：

```text
all:"role-playing" AND all:language AND all:model
all:persona AND all:large language model
all:conversational AND all:memory AND all:agent
all:"CharacterEval"
all:"PersonaGym"
all:"LongMemEval"
all:"LoCoMo"
all:"LLM as a judge"
```

核心新候选包括 `ArcANE (2606.05553)`、`RoleCDE (2606.01552)`、`DynSess (2605.29256)`、`PersonaArena (2605.17044)`、`RPA-Check (2604.11655)`、`Persona-E² (2604.09162)`、`CRPO (2605.25511)`、`MemOps (2607.12893)`、`PASB (2607.10526)`、`RoleMemo (2605.25693)`、`BOOKMARKS (2605.14169)`、`TiMem (2601.02845)`、`LoCoMo-Plus (2602.10715)`、`Persona collapse repair (2607.08326)` 和 `Persona Vectors (2607.13162)`。

### 2.2 ACL Anthology

已直接读取正式页面和摘要：

- `https://aclanthology.org/2024.acl-long.638/` CharacterEval；
- `https://aclanthology.org/2024.acl-long.102/` InCharacter；
- `https://aclanthology.org/2024.findings-acl.878/` RoleLLM；
- `https://aclanthology.org/2024.findings-acl.125/` SocialBench；
- `https://aclanthology.org/2024.findings-acl.197/` TimeChara；
- `https://aclanthology.org/2024.emnlp-main.456/` Character Profiling；
- `https://aclanthology.org/2024.emnlp-industry.107/` CharacterGLM；
- `https://aclanthology.org/2024.findings-naacl.229/` PersonaLLM；
- `https://aclanthology.org/2024.findings-emnlp.969/` Persona survey；
- `https://aclanthology.org/2025.naacl-long.323/` CharacterBox；
- `https://aclanthology.org/2025.findings-acl.938/` RPA evaluation guideline；
- `https://aclanthology.org/2025.findings-acl.1344/` Persona-aware contrastive learning；
- `https://aclanthology.org/2025.findings-acl.537/` Reasoning Does Not Necessarily Improve Role-Playing；
- `https://aclanthology.org/2025.findings-acl.1094/` Beyond Profile；
- `https://aclanthology.org/2025.findings-acl.813/` BehaviorChain；
- `https://aclanthology.org/2025.acl-long.731/` Crab。

### 2.3 OpenAlex 与 DOI

用于交叉确认发表年份、DOI、引用快照和正式 landing page：

```text
https://api.openalex.org/works?search=character%20consistency%20role%20playing%20language%20model
https://api.openalex.org/works?search=persona%20consistency%20large%20language%20model
https://api.openalex.org/works?search=long%20term%20memory%20conversational%20agent%20evaluation
```

OpenAlex 返回的引用数是动态快照，只用于排序和发现，不写入主报告的效果结论。

### 2.4 跨生态产品与社区入口

由于前一轮样本主要集中在论文、SDK 和记忆库，本轮新增了 [跨生态样本登记表](AI工具与Harness-跨生态样本登记.csv)。登记表现有 61 条扩展记录，分为：角色扮演/陪伴产品（N01-N09）、常驻 Agent/harness（N10-N15、N36-N40）、记忆/评测/可观测性（N16-N25、N44-N49、N54-N56）、模型网关/推理底座（N26-N29、N41-N43、N50）、浏览器/工具协议/异步 coding（N51-N53、N57-N61）、游戏角色和角色卡边界样本（N30-N35）。每行保存官方入口、社区 artifact、采用信号、角色一致性关联、证据等级和状态；`deep-card`、`screened`、`gap` 三种状态不互相冒充。N36-N49 的 canonical 官方入口已做可访问性核验，6 条 issue 正文已快照但评论数为 `unknown`；N50-N61 有公开 HN/发布信号，但角色专项评测和版本复现仍在队列。

本轮实际使用的公开查询入口：

```text
https://hn.algolia.com/api/v1/search?query={product}&tags=story
https://api.github.com/repos/{owner}/{repo}
https://api.github.com/search/issues?q=repo:{owner}/{repo}+is:issue+sort:comments-desc
https://raw.githubusercontent.com/{owner}/{repo}/{branch}/README.md
```

社区证据优先保存可直接复核的 issue/RFC、HN item、官方 Discord/Slack/Reddit 入口；无法稳定访问的 Reddit、Discord 或论坛不会被补写成“用户普遍认可”。

### 2.5 社会智能、情绪、ToM、文化与安全补充

ArXiv API 本轮出现 429，因此先用 OpenAlex 做发现，再直接核对 ACL/PNAS/arXiv landing page；发现结果和最终入口如下：

```text
SOTOPIA                  https://arxiv.org/abs/2310.11667
SOTOPIA-pi               https://aclanthology.org/2024.acl-long.698/
LIFELONG SOTOPIA         https://arxiv.org/abs/2506.12666
EmoBench                 https://aclanthology.org/2024.acl-long.326/
OpenToM                  https://aclanthology.org/2024.acl-long.466/
Investigating Cultural Alignment https://aclanthology.org/2024.acl-long.671/
Cultural bias/alignment  https://doi.org/10.1093/pnasnexus/pgae346
SafetyBench              https://aclanthology.org/2024.acl-long.830/
R-Judge                  https://aclanthology.org/2024.findings-emnlp.79/
Agent-SafetyBench        https://arxiv.org/abs/2412.14470
HarmBench                https://arxiv.org/abs/2402.04249
JailbreakBench           https://arxiv.org/abs/2404.01318
SALAD-Bench              https://aclanthology.org/2024.findings-acl.235/
WildGuard                https://arxiv.org/abs/2406.18495
OR-Bench                 https://arxiv.org/abs/2405.20947
```

其中 ACL/PNAS 是正式出版入口（A 级），arXiv 是预印本/代码复现入口（B 级）；它们不直接给出 s-forge 的角色分数，只扩展社会智能、情绪、心理状态、文化分层和角色安全边界的测试空间。

### 2.6 交互式 Agent 基准补充

角色一致性不能只在静态问答中测量；常驻 Agent、工具调用、浏览器和桌面轨迹会暴露身份漂移、记忆断裂、状态误报和跨渠道行为不一致。本轮新增 [交互式 Agent 基准登记表](AI角色一致性评估与保持-交互式Agent基准登记.csv)，登记 E01-E15 共 15 个入口：AgentBench、WebArena、BrowserGym、OSWorld、GAIA、AppWorld、AgentDojo、Tau-bench、ToolSandbox、TheAgentCompany、WebChoreArena、VisualWebArena、OS-Harm、False-success benchmark 与 MCP-AgentBench。

这些基准的原始任务目标不是“扮演某个角色”，因此不会直接替代 CharacterEval、SocialBench 或 PersonaGym；它们提供的是可复现的状态机和失败分类，可把角色一致性拆成：工具身份持续性、跨页面/应用记忆、关系与用户状态更新、长轨迹目标保持、实际结果与自报结果分离、间接提示注入后的边界稳定性。E05 GAIA 数据集页面本轮返回 401；E13-E15 的代码入口仍需单独核验，登记表保留 `unknown` 或 `watchlist`，不把论文入口等同于可运行套件。

## 3. 正式论文与数据集登记

| ID | 来源 | 年份/状态 | 核心事实摘录 | 等级 |
|---|---|---|---|---|
| A01 | [CharacterEval](https://aclanthology.org/2024.acl-long.638/) | ACL 2024 | 中文角色基准；多轮对话、77 角色、13 指标/四类能力、CharacterRM 人工标注奖励模型。 | A |
| A02 | [InCharacter](https://aclanthology.org/2024.acl-long.102/) | ACL 2024 | 访谈式心理测量；32 角色、14 量表；报告最高 80.7% 人格对齐。 | A |
| A03 | [RoleLLM/RoleBench](https://aclanthology.org/2024.findings-acl.878/) | Findings ACL 2024 | 100 角色、168,093 样本；Profile、Context-Instruct、RoleGPT、RoCIT。 | A |
| A04 | [SocialBench](https://aclanthology.org/2024.findings-acl.125/) | Findings ACL 2024 | 500 角色、6,000+ 问题、30,800 多轮话语；个人社会性与群体社会性分离。 | A |
| A05 | [TimeChara](https://aclanthology.org/2024.findings-acl.197/) | Findings ACL 2024 | 10,895 个时点角色幻觉实例；测试知识、身份和剧情时间边界。 | A |
| A06 | [Character profiling](https://aclanthology.org/2024.emnlp-main.456/) | EMNLP 2024 | CROSS 文学角色资料集，由文学专家提供 ground truth；评估角色理解和下游可用性。 | A |
| A07 | [CharacterGLM](https://aclanthology.org/2024.emnlp-industry.107/) | EMNLP Industry 2024 | 社会角色 profile 与外部行为的中文语料及模型；强调跨场景定制和泛化。 | A |
| A08 | [PersonaLLM](https://aclanthology.org/2024.findings-naacl.229/) | Findings NAACL 2024 | GPT-3.5/GPT-4 的 Big Five 角色、自报 BFI、写作和人类识别；AI 作者提示会降低部分识别准确率。 | A |
| A09 | [Persona survey](https://aclanthology.org/2024.findings-emnlp.969/) | Findings EMNLP 2024 | 将领域分为 LLM role-playing 与 LLM personalization，并整理 persona evaluation。 | A |
| A10 | [CharacterBox](https://aclanthology.org/2025.naacl-long.323/) | NAACL 2025 | 文本虚拟世界 sandbox；character agent+narrator agent 生成细粒度行为轨迹，并提供轻量 CharacterNR/CharacterRM。 | A |
| A11 | [RPA evaluation guideline](https://aclanthology.org/2025.findings-acl.938/) | Findings ACL 2025 | 系统筛选 1,676 篇论文，归纳 6 类 Agent 属性、7 类任务属性和 7 类评估指标。 | A |
| A12 | [Persona-aware contrastive learning](https://aclanthology.org/2025.findings-acl.1344/) | Findings ACL 2025 | Persona-Aware Contrastive Learning；role chain 自问与 adversarial 对比；报告自动和人工评价提升。 | A |
| A13 | [Reasoning Does Not Necessarily Improve Role-Playing](https://aclanthology.org/2025.findings-acl.537/) | Findings ACL 2025 | 6 个 benchmark、24 个 LLM、3 种策略；CoT/推理优化并不保证角色能力，部分场景降低保真。 | A |
| A14 | [Beyond Profile](https://aclanthology.org/2025.findings-acl.1094/) | Findings ACL 2025 | CharacterBot 用外部语言结构和内部思维任务模拟鲁迅；CharLoRA 组合 style 与任务专家。 | A |
| A15 | [BehaviorChain](https://aclanthology.org/2025.findings-acl.813/) | Findings ACL 2025 | 1,001 personas、15,846 连续行为；测试动态行为链，现有模型仍有明显差距。 | A |
| A16 | [Crab](https://aclanthology.org/2025.acl-long.731/) | ACL 2025 | 可配置 RP LLM、Role-centric data、手工 benchmark、RoleRM；强调细粒度角色评价。 | A |
| A17 | [PersonaGym](https://arxiv.org/abs/2407.18416) | 2024 arXiv/公开框架 | 200 personas、10,000 questions、6 模型；PersonaScore 用专家 rubric 示例校准 judge ensemble。 | B |
| A18 | [PsychoBench](https://arxiv.org/abs/2310.01386) | 2023 arXiv/公开代码 | 13 个心理量表，覆盖人格、人际、动机、情绪；用于测量 LLM 输出的人格表现。 | B |
| A19 | [PingPong](https://arxiv.org/abs/2409.06820) | 2024 arXiv | player、interrogator、judge ensemble；40+ 模型、8 角色、8 情境，多模型评价与人工相关。 | B |
| A20 | [Identity-Driven Hierarchical RPA](https://arxiv.org/abs/2407.19412) | 2024 arXiv | Hierarchical Identity Role-Playing Framework；身份组合、身份对话集、量表与开放情境 benchmark。 | B |
| A21 | [Thinking Before Speaking](https://arxiv.org/abs/2409.13752) | 2024 arXiv | 以 mindset 扩展角色数据，处理角色不拥有的知识和角色逻辑；报告 tone/knowledge/mindset 改善。 | B |
| A22 | [ERABAL](https://arxiv.org/abs/2409.14710) | 2024 arXiv | Boundary-aware learning；作为角色边界保持和通用能力冲突的候选方法。 | B |
| A23 | [Emotional RAG](https://arxiv.org/abs/2410.23041) | 2024 arXiv | 以情绪相关检索增强角色扮演；需验证情绪召回对稳定人格与状态变化的影响。 | B |
| A24 | [LongMemEval](https://arxiv.org/abs/2410.10813) | 2024 arXiv/ACL track | 500 问题，测试信息抽取、多 session、时间推理、知识更新和 abstention；提出 indexing/retrieval/reading 分解。 | B |
| A25 | [LoCoMo](https://arxiv.org/abs/2402.17753) | ACL 2024 track/arXiv | 平均约 305 turns、19.3 sessions、9.2k tokens，最多约 35 sessions；QA、事件摘要、多模态对话。 | B |
| A26 | [MemGPT](https://arxiv.org/abs/2310.08560) | ICML 方向/公开论文 | OS 式 virtual context、分层 memory、interrupt；支持多 session 记忆、反思和演化。 | A/B |
| A27 | [Generative Agents DOI](https://doi.org/10.1145/3586183.3606763)／[arXiv](https://arxiv.org/abs/2304.03442) | UIST 2023 | memory stream、retrieval、reflection、planning；提供可交互社会模拟原型。DOI 页面本轮返回 403，arXiv 作为可访问复核入口。 | A |
| A28 | [MemoryBank](https://arxiv.org/abs/2305.10250) | 2023 arXiv | 时间与重要性驱动的记忆强化/遗忘；以 SiliconFriend 作为陪伴示例。 | B |
| A29 | [Zep temporal KG](https://arxiv.org/abs/2501.13956) | 2025 arXiv | temporal knowledge graph、有效期和 provenance；适合关系和时间事实。 | B |
| A30 | [Mem0](https://doi.org/10.3233/FAIA251160) | 2025 Frontiers in AI | production-ready scalable long-term memory；代码和论文分开评估，不能只依据产品宣传。 | A/B |
| A31 | [TiMem](https://arxiv.org/abs/2601.02845) | 2026 arXiv | Temporal Memory Tree、语义巩固、复杂度感知召回；报告 LoCoMo 与 LongMemEval 上的结果。 | B |
| A32 | [MemOps](https://arxiv.org/abs/2607.12893) | 2026 arXiv | 把 memory 视为 remember/forget/update/reflect 生命周期操作，保存 trigger/target/scope/state trace。 | B |
| A33 | [LoCoMo-Plus](https://arxiv.org/abs/2602.10715) | 2026 arXiv | cue-trigger semantic disconnect、隐式 constraint consistency；指出表面 factual recall 的盲点。 | B |
| A34 | [PASB](https://arxiv.org/abs/2607.10526) | 2026 arXiv | 1,600 persistent sycophancy tasks；区分 persist 与 cleared query，直测 durable state 写入。 | B |
| A35 | [RoleMemo/DualMem](https://arxiv.org/abs/2605.25693) | 2026 arXiv | 事实 cognition 与 persona-conditioned insight 双流记忆；RoleMemo 数据集和 4B 模型。 | B |
| A36 | [BOOKMARKS](https://arxiv.org/abs/2605.14169) | 2026 arXiv | 主动选择、初始化、更新 storyline bookmark；在 85 个角色、16 个作品上比较记忆基线。 | B |
| A37 | [DynSess](https://arxiv.org/abs/2605.29256) | 2026 arXiv | session-level rubric、multi-turn lookahead、DSPO/GSRPO；目标是长期对话级优化。 | B |
| A38 | [ArcANE](https://arxiv.org/abs/2606.05553) | 2026 arXiv | 17 部小说、80 角色、Character Arc 分段；同一情境跨阶段，并测试原文外情境。 | B |
| A39 | [PersonaArena](https://arxiv.org/abs/2605.17044) | 2026 arXiv | 社交内容 persona bank、动态环境、多 Agent debate judge；偏真实社交 persona。 | B |
| A40 | [RoleCDE](https://arxiv.org/abs/2606.01552) | 2026 arXiv | 约 8k role profiles、近 24k dilemma；测角色价值与 alignment constraint 冲突。 | B |
| A41 | [Persona-E²](https://arxiv.org/abs/2604.09162) | 2026 arXiv | 人工标注 MBTI/Big Five 与事件的情绪 appraisal 数据；测试“人格幻觉”。 | B |
| A42 | [CRPO](https://arxiv.org/abs/2605.25511) | 2026 arXiv | 角色中心 GRPO；解耦逻辑和 style reward、按角色复杂度约束、generic response negative baseline。 | B |
| A43 | [When Role-playing, Do Models Believe What They Say?](https://arxiv.org/abs/2606.11502) | 2026 arXiv | truth probes + behavior tests，区分 prompt/ICL/SFT/OCT/EM 的输出与内部信念变化。 | B |
| A44 | [Persona Vectors](https://arxiv.org/abs/2607.13162) | 2026 arXiv | 53 traits、4 行为域、两个 open-weight model；natural/steerable/intractable 分类。 | B |
| A45 | [Persona collapse repair](https://arxiv.org/abs/2607.08326) | 2026 arXiv | 1,281 advice posts；发现默认 supportive persona collapse，并以 inverse-process distillation 修复分布。 | B |
| A46 | [ZifaMem](https://arxiv.org/abs/2607.17564) | 2026 arXiv | session summary、episodic memory、user model；部署诚实比较 raw history、Mem0 和结构化 memory。 | B |
| A47 | [Ground Truth First](https://arxiv.org/abs/2607.21962) | 2026 arXiv | longitudinal memory evaluation instrument；关注 memory architecture 排名随 tenure 变化。 | B |
| A48 | [LongMemEval-V2](https://arxiv.org/abs/2605.12493) | 2026 arXiv | 面向 experienced-colleague 的长期 memory 评价扩展；版本与代码需持续核验。 | B |
| A49 | [RPA-Check](https://arxiv.org/abs/2604.11655) | 2026 arXiv | 四阶段 checklist、语义过滤、agent isolation、LLM judge；关注约束密集型场景。 | B |
| A50 | [AutoPersonas](https://arxiv.org/abs/2607.08252) | 2026 arXiv | 多时间尺度 persona evolution loop；候选记忆、状态和长期变化需要复现。 | B |
| A51 | [EvolvingWorld](https://arxiv.org/abs/2607.17250) | 2026 arXiv | open-schema role-play agent 与 world model 共演；关系和世界状态共同演化。 | B |
| A52 | [SOTOPIA](https://arxiv.org/abs/2310.11667) | 2023 arXiv | 互动式社会智能环境；以 persona、goal、relationship 和社会规范驱动开放式多轮交互，并由 agent/judge 评估。 | B |
| A53 | [SOTOPIA-π](https://aclanthology.org/2024.acl-long.698/) | ACL 2024 | 在 SOTOPIA 中进行互动学习，比较社会智能策略和长期互动结果。 | A |
| A54 | [LIFELONG SOTOPIA](https://arxiv.org/abs/2506.12666) | 2025 arXiv | 评估语言 Agent 在持续社会互动中的长期行为与关系变化。 | B |
| A55 | [EmoBench](https://aclanthology.org/2024.acl-long.326/) | ACL 2024 | 情绪智力 benchmark；覆盖情绪理解、推断、调节和社会情绪任务。 | A |
| A56 | [OpenToM](https://aclanthology.org/2024.acl-long.466/) | ACL 2024 | 综合 theory-of-mind benchmark；测试信念、意图、知识和多步心理状态推理。 | A |
| A57 | [Investigating Cultural Alignment](https://aclanthology.org/2024.acl-long.671/) | ACL 2024 | 跨文化价值与偏好对齐评估；可用于区分角色价值、模型默认文化和用户文化。 | A |
| A58 | [Cultural bias and cultural alignment](https://doi.org/10.1093/pnasnexus/pgae346)／[publisher landing](https://academic.oup.com/pnasnexus/article/doi/10.1093/pnasnexus/pgae346/7756548) | PNAS Nexus 2024 | 研究文化偏差和文化对齐，提示人格/价值评估必须报告文化分层；出版社页面受当前访问策略限制。 | A |
| A59 | [SafetyBench](https://aclanthology.org/2024.acl-long.830/) | ACL 2024 | 多语言、多类别 LLM 安全评估；适合作为角色边界和安全行为的外部基线。 | A |
| A60 | [R-Judge](https://aclanthology.org/2024.findings-emnlp.79/) | Findings EMNLP 2024 | 评估 LLM Agent 的安全风险意识，而非只看最终拒答文本。 | A |
| A61 | [Agent-SafetyBench](https://arxiv.org/abs/2412.14470) | 2024 arXiv | 面向工具型 Agent 的安全 benchmark；覆盖工具使用、规划和环境交互风险。 | B |
| A62 | [HarmBench](https://arxiv.org/abs/2402.04249) | 2024 arXiv | 标准化自动 red teaming 和 robust refusal 评估。 | B |
| A63 | [JailbreakBench](https://arxiv.org/abs/2404.01318) | 2024 arXiv | 开放 jailbreak robustness benchmark；可测试角色扮演提示对边界的影响。 | B |
| A64 | [SALAD-Bench](https://aclanthology.org/2024.findings-acl.235/) | Findings ACL 2024 | 分层、综合安全 benchmark；支持按风险类别和严重度分析。 | A |
| A65 | [WildGuard](https://arxiv.org/abs/2406.18495) | 2024 arXiv | 开放 moderation、jailbreak 和 refusal 工具；适合与角色输出/通用安全分层。 | B |
| A66 | [OR-Bench](https://arxiv.org/abs/2405.20947) | 2024 arXiv | over-refusal benchmark；用于测量安全边界是否过度抹平角色价值和正常对话。 | B |

## 4. 官方规范、产品实践与代码入口

| ID | 来源 | 事实 | 等级 |
|---|---|---|---|
| C01 | [Character Card V2 spec](https://github.com/malfoyslastname/character-card-spec-v2/blob/main/spec_v2.md) | `system_prompt`、`post_history_instructions`、`alternate_greetings`、`character_book`、keys/priority/constant/position、extensions 和版本字段。 | C |
| C02 | [SillyTavern Character Design](https://docs.sillytavern.app/usage/core-concepts/characterdesign/) | character description 永久注入；permanent tokens 会挤压历史上下文；first message/example messages 有不同生命周期。 | C |
| C03 | [SillyTavern World Info](https://docs.sillytavern.app/usage/core-concepts/worldinfo/) | Lorebook 依据关键词动态激活，可递归、设预算，并可绑定角色、persona 或 chat；文档明确提示“插入不保证使用”。 | C |
| C04 | [SillyTavern Personas](https://docs.sillytavern.app/usage/core-concepts/personas/) | 用户 persona 可保存描述、头像、注入位置和绑定 lorebook；与 character identity 分离。 | C |
| C05 | [CharacterEval repo](https://github.com/morecry/CharacterEval) | 论文公开代码、数据源和 reward model；GitHub stars 是 2026-07-28 快照，不代表复现成功。 | C |
| C06 | [SocialBench repo](https://github.com/X-PLUG/SocialBench) | ACL 页面链接到 `X-PLUG/RoleInteract` 的最终仓库 `X-PLUG/SocialBench`。 | C |
| C07 | [CharacterBox repo](https://github.com/Paitesanshi/CharacterBox) | NAACL 页面给出代码入口；仓库规模较小，优先视作可复现实验入口。 | C |
| C08 | [InCharacter repo](https://github.com/Neph0s/InCharacter) | 论文给出 code、dataset、results 和 demo。 | C |
| C09 | [PsychoBench repo](https://github.com/CUHK-ARISE/PsychoBench) | 13 类心理量表实验代码和数据入口。 | C |
| C10 | [LongMemEval repo](https://github.com/xiaowu0162/LongMemEval) | arXiv 摘要给出的官方代码入口；仓库路径需以最终页面为准。 | C |
| C11 | [LoCoMo page](https://snap-research.github.io/locomo) | 论文数据和评估项目主页；GitHub 搜索发现 `snap-research/locomo`。 | C |
| C12 | [RPA survey repo](https://github.com/CRChenND/LLM_roleplay_agent_eval_survey) | 评估设计综述的论文收集和 guideline 资源。 | C |
| C13 | [MemoryBank repo](https://github.com/zhongwanjun/MemoryBank-SiliconFriend) | 论文中给出的 SiliconFriend/MemoryBank 代码入口。 | C |
| C15 | [EmoBench repo](https://github.com/Sahandfer/EmoBench) | ACL 页面抽取到的公开代码入口；数据许可和复现命令仍需核对。 | C |
| C16 | [SafetyBench repo](https://github.com/thu-coai/SafetyBench) | ACL 页面给出的多语言安全 benchmark 代码/数据入口。 | C |
| C17 | [SALAD-Bench repo](https://github.com/OpenSafetyLab/SALAD-BENCH) | Findings ACL 页面给出的分层安全 benchmark 代码入口。 | C |
| C14 | [ZifaMem repo](https://github.com/zifacorp/zifamem) | 预印本摘要给出的 SDK、CLI 和 Agent Skills 入口；尚待独立复现。 | C/B |

## 5. 原始摘要摘录与解释

### 5.1 CharacterEval

ACL 正式摘要写明：数据集包含 1,785 个多轮角色对话、11,376 个 examples、77 个来自中国小说和剧本的角色；使用 13 个目标指标和四类能力，并用人工标注训练 CharacterRM。arXiv v2 摘要显示为 23,020 examples，与 ACL 页面数字不一致。主报告采用 ACL 正式页面的 11,376，并把差异保留为版本审计项。

论文正文提到的四类方向包括：conversational ability；character consistency（knowledge consistency 与 persona consistency）；role-playing attractiveness；personality back-testing。知识一致性包含 knowledge exposure、accuracy、hallucination；人格一致性包含 behavior 和 utterance；这直接支持将知识、行为、语言和心理测量分开。

### 5.2 InCharacter

核心流程是：

1. 用心理量表派生开放式访谈问题；
2. 与角色代理进行多轮 interview，诱发 mindset 和 behavior；
3. 由评估器将回答映射到 Likert／心理量表；
4. 与人物标签和人工熟悉者标注比较。

作者明确指出，自报测试受角色对说明的理解、偏差和“自报与实际行为不一致”影响；访谈可以通过追问获得更接近行为的证据。该结论直接反驳“让角色一次性填写 120 题就足够”的假设。

### 5.3 PersonaGym

PersonaGym 的 dynamic evaluation 流程包含：根据 persona 从 150 个环境中选择相关环境；生成任务问题；用专家 rubric 的可能分数示例校准评估器；集成多个 state-of-the-art judge。其 200 persona/10,000 question 规模和 6 模型比较说明，固定模型规模与角色能力不是单调关系。

### 5.4 RPA evaluation guideline

综述表格原始分类：

- Agent attributes：Activity History、Belief and Value、Demographic Information、Psychological Traits、Skill and Expertise、Social Relationships；
- Task attributes：Simulated Individuals、Simulated Society、Opinion Dynamics、Decision Making、Psychological Experiments、Educational Training、Writing；
- Metric categories：Performance、Psychological、External Alignment、Internal Consistency、Social and Decision-Making、Content and Textual、Bias/Fairness/Ethics。

这套分类适合直接转成 s-forge 的 capability matrix 和评估 manifest。

### 5.5 LongMemEval 与 LoCoMo

LongMemEval 的五项核心能力是 information extraction、multi-session reasoning、temporal reasoning、knowledge updates、abstention；论文报告商业聊天助手和长上下文模型在持续交互记忆上出现约 30% accuracy drop，并将 memory 设计拆成 indexing、retrieval、reading。

LoCoMo 的对话平均约 304.9 turns、19.3 sessions、9,209 tokens，最长覆盖约 35 sessions；任务包括 question answering、event summarization、multimodal dialogue generation。论文报告长上下文和 RAG 有帮助，但与人类表现仍有明显差距。

### 5.6 2026 前沿候选摘要

| 来源 | 摘要事实 | 当前解释 |
|---|---|---|
| [ArcANE](https://arxiv.org/abs/2606.05553) | Character Arc 分阶段；17 novels/80 characters；原文外情境收益最大。 | 将剧情阶段和开放情境加入 `validAt` 回归。 |
| [DynSess](https://arxiv.org/abs/2605.29256) | session-level rubric、lookahead trajectory、DSPO/GSRPO。 | 评估对象从 turn 移到 session；等待代码和人类复现。 |
| [RoleCDE](https://arxiv.org/abs/2606.01552) | 约 8k role profiles、24k dilemmas；发现 Role Value Decoupling。 | 价值冲突是角色保持与系统对齐的独立维度。 |
| [Persona-E²](https://arxiv.org/abs/2604.09162) | 人工标注 Big Five/MBTI 与事件 appraisal；模型难以捕获精细情绪变化。 | 不把情绪状态等同情感词或情绪分类。 |
| [CRPO](https://arxiv.org/abs/2605.25511) | 解耦 task logic/style reward，动态约束，generic response negative baseline。 | RL 需要角色奖励分解，避免 style collapse。 |
| [MemOps](https://arxiv.org/abs/2607.12893) | memory operation trace 含 trigger、target、scope、state transition、support。 | 直接对应 MemoryClaim 生命周期和审计。 |
| [PASB](https://arxiv.org/abs/2607.10526) | 1,600 tasks，persist 五轮、cleared query 三轮；测 persistent sycophancy。 | 用户迎合性是 write-gate 风险，不只是回答质量。 |
| [RoleMemo](https://arxiv.org/abs/2605.25693) | factual cognition 与 persona-conditioned insight 双流 memory。 | 事实和“从角色角度理解事实”应分层存储。 |
| [BOOKMARKS](https://arxiv.org/abs/2605.14169) | 主动初始化、维护和同步 storyline bookmarks；85 characters/16 artifacts。 | 比递归摘要更适合任务相关的剧情锚点。 |
| [TiMem](https://arxiv.org/abs/2601.02845) | Temporal Memory Tree、语义巩固、复杂度感知召回。 | 适合时间层级，但摘要损失需要 source trace。 |
| [LoCoMo-Plus](https://arxiv.org/abs/2602.10715) | cue-trigger semantic disconnect、constraint consistency。 | “能找回关键词”不等于“遵守隐式约束”。 |
| [Persona collapse repair](https://arxiv.org/abs/2607.08326) | 1,281 advice posts；90%+ collapse 到 supportive persona；inverse-process distillation 修复分布。 | 分布接近人工不等于人类偏好提升，需保留 blind preference。 |
| [When Role-playing](https://arxiv.org/abs/2606.11502) | prompting/ICL/SFT 主要改输出，EM/OCT 可改变 truth representation 程度不同。 | 外部保真与内部信念应分开报告。 |
| [Persona Vectors](https://arxiv.org/abs/2607.13162) | 53 traits、四行为域；natural/steerable/intractable。 | 作为离线诊断和 steering 实验，不作为主存。 |
| [ZifaMem](https://arxiv.org/abs/2607.17564) | 结构化 memory 对情绪连续性报告提升；与 Mem0 在主 preference endpoint 统计等价。 | 预印本、自报 judge protocol，需独立复现。 |

## 6. 版本差异、失败来源与不确定性

| 来源 | 现象 | 处理 |
|---|---|---|
| CharacterEval arXiv v2 vs ACL 页面 | examples 数量显示 23,020 vs 11,376。 | 正式 ACL 页面作为主报告数字；保留差异，后续核对 PDF/数据 release。 |
| Semantic Scholar API | 多次返回 429。 | 使用 OpenAlex、arXiv API、ACL 页面和 DOI 交叉确认，未把 Semantic Scholar 作为唯一元数据源。 |
| GitHub repository search | 本轮后段触发 secondary rate limit。 | 使用论文正文给出的仓库链接和已成功访问的 API；不从搜索失败推断仓库不存在。 |
| `PersonaGym/PersonaGym`、`wyf3/LongMemEval`、`snap-stanford/LoCoMo` | 候选组织路径返回 404。 | 以论文正文实际链接为准：PersonaGym 官方站点、`xiaowu0162/LongMemEval`、`snap-research/locomo` 页面。 |
| Character Card V2 | 规范仓库是 `malfoyslastname/character-card-spec-v2`；其他候选路径 404。 | 只引用官方仓库的 spec_v2.md。 |
| 2026 arXiv 候选 | 多数 v1/v2 预印本，引用和复现量有限。 | 统一降为 B 级 watchlist，进入本地复现实验后再升级。 |
| SillyTavern 文档 | World Info 明确写出“插入不保证模型使用”，Character Design 明确写出永久 token 挤压历史。 | 将 token budget、hit/miss、ignored content 作为评估日志字段。 |
| HN/社区资料 | 只能代表主动发声者，且页面可能限流。 | 社区内容只作为工程失败线索，不作为角色效果主证据。 |
| 跨生态扩展 URL（2026-07-28） | 原 68 个官方/社区入口第一轮 GET：50 成功、18 失败；N36-N49 另新增 28 个入口并完成 canonical 官方页面核验。 | HN item 改用 Algolia item API 复核；Character.AI/JanitorAI 保留“可访问性受限”；Ragdoll 当前入口降为历史线索；Convai 改用 `docs.convai.com`；N36-N49 的具体社区内容保持 gap。 |
| `https://about.janitorai.com` | TLS 连接不稳定，不能作为稳定官方来源。 | 登记表改用 `janitorai.com` 与 HN item，并把 JanitorBench 入口 403 写成证据限制。 |
| `https://ragdoll-studio.vercel.app` | 2026-07-28 返回 404。 | N09 状态降为 `gap`，只保留 HN 公开讨论，不宣称当前产品存在。 |
| `https://convai.com/community/` | 返回 404。 | N30 改用可访问的 `https://docs.convai.com/`，仍标 `gap`，等待真实社区 artifact。 |
| `https://doi.org/10.1093/pnasnexus/pgae346` | DOI/出版社页面对当前请求返回 403；Crossref 元数据和 DOI 重定向目标 `https://academic.oup.com/pnasnexus/article/doi/10.1093/pnasnexus/pgae346/7756548` 可复核题名。 | 保留 DOI 和 Crossref 作为来源，标记页面访问限制，不把 403 当作论文不存在。 |
| 全 corpus URL 扫描 | 从 15 份相关 Markdown/CSV 规范化提取 501 个去重 URL：396 成功、91 限流/禁止、7 个 404、1 个 400、1 个 422、1 个 503、5 个网络/编码错误和 1 个超时；扫描包含模板占位 URL 和历史失效入口。 | 对 HN 用 Algolia item API；对 DOI 用 Crossref/替代 landing；其余失败按访问类型保留为待复核，不宣称来源已永久可用。 |

## 6.1 跨生态扩展记录（61 条）

下面只列出本轮最能改变角色一致性判断的代表性 artifact；完整 URL、采用快照和状态见 [跨生态样本登记表](AI工具与Harness-跨生态样本登记.csv)。

| ID | 样本 | 官方事实 | 社区 artifact 与原始信号 | 研究解释 |
|---|---|---|---|---|
| N01 | RisuAI | [仓库](https://github.com/kwaroran/Risuai) 是跨平台 LLM roleplay 软件。 | [#51](https://github.com/kwaroran/Risuai/issues/51)：无法创建角色；约 1.56k stars。 | 角色卡和本地会话必须可编辑、可回归。 |
| N02 | TavernAI v1 | [仓库](https://github.com/TavernAI/TavernAI-v1) 支持多种角色模型后端。 | [#98](https://github.com/TavernAI/TavernAI-v1/issues/98)：文本框和 NovelAI 自动连接；约 2.7k stars。 | provider 适配和输入状态会影响角色连续性。 |
| N03 | Agnai | [README](https://raw.githubusercontent.com/agnaistic/agnai/main/README.md) 提供多用户、多 bot、Discord。 | [#86](https://github.com/agnaistic/agnai/issues/86)：Scale request socket hang up；765 stars/145 forks。 | 角色、用户、会话隔离需要单独主键。 |
| N04 | AI Dungeon | [产品](https://aidungeon.com/) 是互动叙事。 | [HN](https://news.ycombinator.com/item?id=21717022)：584/220；评论同时赞赏自由行动并指出世界状态不一致。 | 叙事趣味不能替代状态和剧情弧一致性。 |
| N05 | Character.AI | [产品](https://character.ai/) 是大规模角色社区。 | [HN](https://news.ycombinator.com/item?id=33020694)：282/138；另有未成年人政策讨论 93/95。 | 热度、关系体验和保真效果必须分开。 |
| N06 | Replika | [产品](https://replika.com/) 以关系型陪伴为核心。 | [HN](https://news.ycombinator.com/item?id=35005218)：95/106；另一条关系讨论 154/184。 | 关系连续性受产品版本变化影响。 |
| N07 | Nomi | [产品](https://nomi.ai/) 提供多 AI 朋友体验。 | [HN](https://news.ycombinator.com/item?id=42968438)：4/1；公开报道有行为争议。 | 公开采用证据弱，保留低置信边界。 |
| N08 | JanitorBench | [基准入口](https://bench.janitorai.com/)。 | [HN](https://news.ycombinator.com/item?id=45839468)：26/6，页面说明评论被处理。 | 数据污染、许可和多轮定义必须先审计。 |
| N10 | NanoClaw | [README](https://raw.githubusercontent.com/nanocoai/nanoclaw/main/README.md) 强调容器、多渠道、memory、scheduled jobs。 | [#80](https://github.com/nanocoai/nanoclaw/issues/80)：要求更多 provider；HN agent vault 112/31。 | 容器、secret memory isolation 和 provider 迁移是长期边界。 |
| N11 | AutoGPT | [仓库](https://github.com/Significant-Gravitas/AutoGPT) 是自治 Agent 工具集。 | [#15](https://github.com/Significant-Gravitas/AutoGPT/issues/15)：270 评论的 recursive self improvement 讨论；约 185.7k stars。 | 自改必须经过离线评测和回滚。 |
| N12 | MetaGPT | [canonical 仓库](https://github.com/FoundationAgents/MetaGPT) 用显式角色组成协作实体。 | [HN](https://news.ycombinator.com/item?id=37076125)：152/82；约 69.5k stars。 | 角色分工适合群体一致性，不等于人格状态。 |
| N13 | smolagents | [仓库](https://github.com/huggingface/smolagents) 是 barebones agent library。 | [#201](https://github.com/huggingface/smolagents/issues/201)：代码解析反复失败；约 28.6k stars。 | 工具语法错误必须进入行为轨迹。 |
| N14 | Open Interpreter | [仓库](https://github.com/openinterpreter/openinterpreter) 面向本地 coding agent。 | [#393](https://github.com/openinterpreter/openinterpreter/issues/393)：无动作且无错误；约 67.3k stars。 | not-started/unknown/completed 不能压成一个失败值。 |
| N15 | OpenManus | [仓库](https://github.com/FoundationAgents/OpenManus) 是通用 Agent harness。 | [#393](https://github.com/FoundationAgents/OpenManus/issues/393)：模型需支持 tools/function calling；约 57.7k stars。 | provider capability 是角色行动前置条件。 |
| N16 | Hindsight | [仓库/论文](https://github.com/vectorize-io/hindsight) 提供长期记忆路线。 | [HN](https://news.ycombinator.com/item?id=46294975)：4/2；官方文档和 Slack。 | retain/recall/reflect 可映射 MemoryClaim 生命周期。 |
| N17 | Cognee | [仓库](https://github.com/topoteretes/cognee) 是知识图记忆平台。 | [#3570](https://github.com/topoteretes/cognee/issues/3570)；HN [9/2](https://news.ycombinator.com/item?id=44169594) 直接追问时间演化。 | 图关系必须带 valid time、来源和用户纠正。 |
| N18 | Supermemory | [仓库](https://github.com/supermemoryai/supermemory) 是跨应用上下文引擎。 | [HN](https://news.ycombinator.com/item?id=46827133)：Claude Code memory 演示 5/0。 | 迁移能力要与删除、替代和隐私审计一起测。 |
| N19 | Promptfoo | [仓库](https://github.com/promptfoo/promptfoo) 提供 eval/red-team/CI。 | [HN](https://news.ycombinator.com/item?id=46945277)：5/0。 | 适合把角色探针和边界攻击纳入回归。 |
| N20 | DeepEval | [仓库](https://github.com/confident-ai/deepeval) 是 LLM evaluation framework。 | [HN](https://news.ycombinator.com/item?id=37649856)：18/8，讨论 CI、guardrail 和对比工具。 | metric 需与人工标注相关性校准。 |
| N21 | Phoenix | [仓库](https://github.com/Arize-ai/phoenix) 保存 trace、span、eval。 | [HN](https://news.ycombinator.com/item?id=37765954)：23/3。 | 让 memory write、retrieval 和 judge 输入可审计。 |
| N22 | Langfuse | [仓库](https://github.com/langfuse/langfuse) 提供 tracing、prompt、dataset。 | [HN](https://news.ycombinator.com/item?id=42441258)：215/61，评论强调 self-hosting 和敏感 trace。 | 角色回归需要版本化 trace 和隐私边界。 |
| N26 | LiteLLM | [仓库](https://github.com/BerriAI/litellm) 是多 provider gateway。 | [#24512](https://github.com/BerriAI/litellm/issues/24512)：供应链安全事件，487 评论；约 54.9k stars。 | provider、凭证和 fallback 必须记录并隔离。 |
| N27 | vLLM | [仓库](https://github.com/vllm-project/vllm) 是高吞吐推理服务。 | [#1441](https://github.com/vllm-project/vllm/issues/1441)：Mac/Metal 支持，115 评论；约 87.4k stars。 | 后端差异会改变同一角色的行为分布。 |
| N28 | llama.cpp | [仓库](https://github.com/ggml-org/llama.cpp) 提供多平台量化推理。 | 约 121.8k stars；本轮 issue API 受限，细项保留待补。 | 量化、上下文和模板是角色复现变量。 |
| N36 | ZeroClaw | [仓库](https://github.com/zeroclaw-labs/zeroclaw) 是 Rust 常驻 Agent 项目。 | [issues 入口](https://github.com/zeroclaw-labs/zeroclaw/issues) 可访问；具体 issue 评论和动态数值待补。 | 低资源运行、provider 替换和渠道身份可作为 OpenClaw 对照；当前 `gap`。 |
| N37 | Agent Zero | [canonical 仓库](https://github.com/agent0ai/agent-zero) 提供个人 Agent、规划和工具路线。 | [issues 入口](https://github.com/agent0ai/agent-zero/issues) 可访问；具体社区 artifact 待补。 | self-improvement 与工具审计边界；当前 `gap`，不把项目宣传当效果。 |
| N38 | Nanobot | [仓库](https://github.com/HKUDS/nanobot) 是轻量 Agent 运行时。 | [issues 入口](https://github.com/HKUDS/nanobot/issues) 可访问；PyPI `nanobot` 仅有低量入口快照，包身份需持续核对。 | 作为 NanoClaw/OpenClaw 的低资源对照；当前 `gap`。 |
| N39 | Void | [仓库](https://github.com/voideditor/void) 是开源 AI IDE。 | [issues 入口](https://github.com/voideditor/void/issues) 可访问；具体 provider/维护反馈待补。 | 本地模型、隐私和 IDE Agent 可控性对照；当前 `gap`。 |
| N40 | Zed Agent | [仓库](https://github.com/zed-industries/zed) 包含编辑器 Agent 与协作能力。 | [issues 入口](https://github.com/zed-industries/zed/issues) 可访问；非 Agent issue 占比高，未抽样评论。 | 项目上下文、协作身份和模型切换需与角色状态分开；当前 `gap`。 |
| N41 | MLX | [仓库](https://github.com/ml-explore/mlx) 是 Apple Silicon 本地推理框架。 | [issues 入口](https://github.com/ml-explore/mlx/issues) 可访问；`mlx-lm` PyPI rolling-week 入口已登记。 | 后端、量化和上下文改变角色复现；当前 `gap`，不是角色工具。 |
| N42 | SGLang | [仓库](https://github.com/sgl-project/sglang) 是模型服务/推理框架。 | [issues 入口](https://github.com/sgl-project/sglang/issues) 可访问；版本故障样本待补。 | provider/runtime、结构化输出和延迟是归因变量；当前 `gap`。 |
| N43 | ExLlamav2 | [仓库](https://github.com/turboderp-org/exllamav2) 是量化本地推理后端。 | [issues 入口](https://github.com/turboderp-org/exllamav2/issues) 可访问；前端模板差异待核对。 | 补足 llama.cpp/Ollama 之外的酒馆后端谱系；当前 `gap`。 |
| N44 | LanceDB | [仓库](https://github.com/lancedb/lancedb) 提供嵌入式向量与版本化数据。 | [issues 入口](https://github.com/lancedb/lancedb/issues) 可访问；删除/时间过滤案例待补。 | 记忆索引可重建性和 provenance 对照；当前 `gap`。 |
| N45 | Chroma | [仓库](https://github.com/chroma-core/chroma) 是轻量向量数据库。 | [issues 入口](https://github.com/chroma-core/chroma/issues) 可访问；PyPI `chromadb` rolling-week 入口已登记。 | metadata、租户隔离和迁移需单独测量；当前 `gap`。 |
| N46 | Qdrant | [仓库](https://github.com/qdrant/qdrant) 提供 payload/filter 与分布式向量检索。 | [issues 入口](https://github.com/qdrant/qdrant/issues) 可访问；schema migration 案例待补。 | 角色记忆的来源、时间与租户约束对照；当前 `gap`。 |
| N47 | Weaviate | [仓库](https://github.com/weaviate/weaviate) 是向量数据库与混合检索平台。 | [issues 入口](https://github.com/weaviate/weaviate/issues) 可访问；删除和云/本地迁移案例待补。 | 检索层与角色策略分离；当前 `gap`。 |
| N48 | Opik | [仓库](https://github.com/comet-ml/opik) 提供 LLM trace 与评测。 | [issues 入口](https://github.com/comet-ml/opik/issues) 可访问；角色专项指标和人类相关性待补。 | 观察 memory write、judge 输入和工具副作用；当前 `gap`。 |
| N49 | Zep | [仓库](https://github.com/getzep/zep) 是时间记忆平台；论文入口已登记为 A29。 | [issues 入口](https://github.com/getzep/zep/issues) 可访问；当前代码版本与社区反馈待补。 | 与 Graphiti/Hindsight 比较时间事实生命周期；当前 `gap`。 |

### 6.1.1 生态网关、浏览器 Agent、观测和异步 coding（N50-N61）

N50-N61 均有官方入口与 HN/发布信号，因此从 `gap` 提升为 `screened`；这只表示证据入口齐备，不表示角色专项效果已验证。

| ID | 样本 | 官方事实 | 社区 artifact 与原始信号 | 研究解释 |
|---|---|---|---|---|
| N50 | OpenRouter | [官方路由](https://openrouter.ai/) 提供多模型统一入口。 | [HN 48338660](https://news.ycombinator.com/item?id=48338660)：460/253；评论称其降低多 provider API 接入摩擦并支持 billing caps。 | provider/model、fallback、额度和路由原因必须进入 SessionTrace。 |
| N51 | Composio | [仓库](https://github.com/ComposioHQ/composio) 提供工具集成和连接器。 | [HN 44395954](https://news.ycombinator.com/item?id=44395954)：5/0；公开发布页强调 function calling 集成。 | 工具 schema/授权范围会改变角色行动空间；集成数量不能替代一致性测试。 |
| N52 | Stagehand | [仓库](https://github.com/browserbase/stagehand) 是 AI 浏览器自动化框架。 | [Show HN 42635942](https://news.ycombinator.com/item?id=42635942)：326/86；评论讨论 adversarial 网站、代理和 MCP/computer-use 扩展。 | 浏览器状态、DOM/视觉观察、重试和真实副作用必须独立记录。 |
| N53 | Skyvern | [仓库](https://github.com/Skyvern-AI/skyvern) 覆盖视觉/LLM 浏览器自动化。 | [Show HN 39706004](https://news.ycombinator.com/item?id=39706004)：422/139；评论同时讨论反垃圾和自动化可靠性。 | 长轨迹目标保持与自报成功分开；开源/云版本需分层。 |
| N54 | Helicone | [仓库](https://github.com/Helicone/helicone) 提供 LLM logging/observability。 | [Launch HN 35279155](https://news.ycombinator.com/item?id=35279155)：166/72；用户评论提到快速定位 token limit/API 响应问题。 | trace、成本、错误和敏感数据保留可用于角色 provider 审计。 |
| N55 | LangSmith | [平台](https://smith.langchain.com/) 提供 trace、dataset 和评估。 | HN [36777164](https://news.ycombinator.com/item?id=36777164)：37/2；公开发布入口可访问。 | prompt/trace/dataset 版本化适合跨 provider 角色回归；闭源保留边界待核。 |
| N56 | Braintrust | [平台](https://www.braintrust.dev/) 面向 AI 产品评测。 | [Show HN 37692239](https://news.ycombinator.com/item?id=37692239)：8/2；评论有实际使用者正向反馈。 | 用于 judge 与人工相关性校准；社区样本小，不能推导总体采用。 |
| N57 | AgentAPI | [仓库](https://github.com/coder/agentapi) 为多个 coding Agent 提供 HTTP API。 | [Show HN 43719447](https://news.ycombinator.com/item?id=43719447)：163/15；评论讨论 SSH/手机访问 coding harness。 | 跨 harness session/identity 迁移要带副作用状态和 receipt。 |
| N58 | Replit Agent | [官方 AI 入口](https://replit.com/ai) 支持应用生成/部署。 | [HN 41458940](https://news.ycombinator.com/item?id=41458940)：24/0；公开产品发布入口。 | 异步任务、项目状态和云端部署副作用进入长期轨迹。 |
| N59 | Devin | [官方产品](https://devin.ai/) 是长时程 coding Agent。 | [HN 39679787](https://news.ycombinator.com/item?id=39679787)：530/553；评论同时包含采用热情和对宣传/劳动力影响的质疑。 | 比较计划、工具行动、自报结果与真实仓库状态；热度不等效果。 |
| N60 | Google Jules | [实验入口](https://labs.google.com/jules/) 是异步 coding Agent。 | [HN 43697533](https://news.ycombinator.com/item?id=43697533)：3/0；公开社区信号弱。 | 作为后台 resume/仓库身份对照；区域和版本需要持续核验。 |
| N61 | MCP Context Forge | [IBM 仓库](https://github.com/IBM/mcp-context-forge) 提供 MCP Gateway/Registry。 | [HN 45010524](https://news.ycombinator.com/item?id=45010524)：73/17；评论讨论 gateway 竞争、客户端成熟度和非开发者用例。 | server 注册、工具来源、授权和跨 server 角色边界必须可审计。 |

这些样本的共同结论是：角色一致性并不是只由 system prompt 决定，而是由角色卡/世界书、模型 provider、上下文压缩、记忆生命周期、工具执行状态、渠道身份和评测观测共同决定。

### 6.2 点名工具社区摘录复核

为避免只列“某 issue 存在”，本轮对五个点名工具的 HN item 读取了公开顶层评论，并把正向采用理由和负向约束并列保存：

| 工具 | 公开正向/采用摘录 | 公开负向/限制摘录 | 证据状态 |
|---|---|---|---|
| OpenClaw | [46893970](https://news.ycombinator.com/item?id=46893970) 的评论称其“exactly what Apple Intelligence should have been”，并列举邮件、日历和电脑动作。 | [47633396](https://news.ycombinator.com/item?id=47633396) 的评论质疑 provider 所称的 “outsized strain”，建议 API key 和 usage cap。 | 正负两侧均有 HN 原文；HN 仍是主动发声样本。 |
| Pi | [47580883](https://news.ycombinator.com/item?id=47580883) 的评论称 Pi 是“great set of libraries”，以前被低估、现在相当 mainstream。 | 该 item 只有 3 points/1 条评论；可靠性负面来自 [#4945](https://github.com/earendil-works/pi/issues/4945) 的 TUI `Working...` 卡死复现。 | 采用证据弱、issue 证据强；不推导总体采用率。 |
| Hermes | [48419000](https://news.ycombinator.com/item?id=48419000) 的评论把 Hermes 与 Pi、OpenCode、OpenClaw、NanoClaw 放在同一迁移候选集。 | 同一讨论质疑文档域名；[Hermes #11179](https://github.com/NousResearch/hermes-agent/issues/11179) 记录 `response.output=null` 流式故障。 | 社区关注存在，但宣传、文档身份和运行可靠性需分开。 |
| OpenCode | [47460525](https://news.ycombinator.com/item?id=47460525) 的评论称喜欢 subagents、按 agent 选模型，并以它运行 llama.cpp、Claude、Gemini；另有人构建 web UI/插件。 | 同一讨论担心默认 telemetry；[46539718](https://news.ycombinator.com/item?id=46539718) 是未认证 RCE 讨论，[#7410](https://github.com/anomalyco/opencode/issues/7410) 是 Claude Max 中断。 | 采用理由和安全/服务连续性问题同时成立。 |
| SillyTavern | 官方 README、文档和公开 Discord/Reddit 入口是主要社区线索，HN item [48419761](https://news.ycombinator.com/item?id=48419761) 只有 3 points。 | [#729](https://github.com/SillyTavern/SillyTavern/issues/729) 复现 Poe token 失效；文档警告永久 token 挤压历史、lore 插入不保证使用。 | HN 代表性弱，保留 Discord/Reddit 社区补抓缺口。 |

本节的评论摘录只证明“有人这样采用/抱怨”，不证明功能质量、用户总量或角色一致性效果；所有样本仍按 `deep-card`/`screened`/`gap` 状态进入登记表。

## 7. s-forge 本地证据登记

| ID | 本地来源 | 读取结论 |
|---|---|---|
| D01 | `docs/设计/ATF数学模型.design.md` | 5×6 OCEAN matrix、style/BF composite、C_int/C_ext、EMA、Avatar baseline 和时间 tick。 |
| D02 | `docs/ttt/AI模块改进/seraph_四盲测试与ATF计算.ttt.md` | 四实体隔离、80/20 targeted sampling、style/BF 权重、EMA 和 ATF 任务清单。 |
| D03 | `docs/ttt/ATF实现问题验证报告.md` | 记录 Avatar 基线污染、[0,1]/[-1,1] 值域差异、rho sign、显著性门控和 style 特征缺口。 |
| D04 | `kernel/api/magi_personality_accuracy_test.go` | 3 个固定对话场景、目标 OCEAN/Facet、心理评估模型 JSON judge，在线测试需环境变量。 |
| D05 | `kernel/api/magi_live_persona_test.go` | 情感试探、任务压力、发散想象三个场景；单样本允许波动，整体至少通过 2/3。 |
| D06 | `docs/设计/MAGI_人格种子生成机制.design.md` | 结构化 Identity、Traits、Skills/Motives、Directives/Taboos、种子生命周期和视角自述。 |
| D07 | `docs/设计/MAGI_三贤人_Melchior记忆与披露机制.design.md` | 当前场景全量记忆、跨任务清零、摘要到语义知识/跨任务情景记忆。 |
| D08 | `kernel/agent/runtime.go`、`compaction.go` | session revision、checkpoint、context compaction、token breakdown 和恢复边界。 |
| D09 | `kernel/api/magi_runtime.go`、`kernel/api/magi.go` | heartbeat、sleep/wake、passive recall 和任务环。 |
| D10 | `kernel/mcp/tools/search.go`、Embedding、VectorDB | FTS、semantic、embedding、可重建索引和资产／Block 检索。 |

## 8. 下一步研究任务

1. 逐篇补录正式论文的完整实验设置、指标定义、人工标注协议、开源许可证和可复现实验命令。
2. 对 CharacterEval、InCharacter、PersonaGym、SocialBench、CharacterBox、LongMemEval、LoCoMo 的代码和数据入口做最终 URL/仓库审计。
3. 维护八份 machine-readable registry：66 条论文/基准的 [核心来源登记](AI角色一致性评估与保持-核心来源登记.csv)、15 条新增来源登记、[交互式 Agent 基准登记](AI角色一致性评估与保持-交互式Agent基准登记.csv)、[角色社区 RSS 快照](AI工具与Harness-角色社区RSS快照.csv)、[GitHub 问题快照](AI工具与Harness-GitHub问题快照.csv)、[主样本能力矩阵](AI工具与Harness-主样本能力矩阵.csv) 和 [跨生态工具样本登记](AI工具与Harness-跨生态样本登记.csv)；另有动态采用信号与 npm 四周时间序列。
4. 以 s-forge 脱敏角色 fixture 复现最小集：静态知识、访谈人格、时间线、价值冲突、关系变化、memory update/forget、三贤人隔离和 Avatar 独立基线。
5. 为 LLM judge 建立人类盲评校准、评估者间一致性、prompt injection、位置偏差、长度偏差和置信区间记录。
6. 把 ATF 作为汇总遥测与新多维指标做相关性研究，暂不依据 ATF 单分数改变角色主存。

## 9. 当前审计状态

- 主报告已建立 10 个一致性层、8 个评估谱系、7 个保持机制和 14 类失败模式。
- 来源登记包含 66 个论文／预印本候选、15 个交互式 Agent 基准、17 个官方规范／代码入口、10 个本地证据项、61 条跨生态工具/产品/评测扩展记录和 18 条角色社区 RSS 快照；扩展记录中 14 条为 deep-card、29 条 screened、18 条 gap。新增 A52-A66 覆盖 SOTOPIA、EmoBench、OpenToM、文化对齐和角色安全/越狱/过度拒答基准；E01-E15 另作为工具状态与长轨迹评估层，不能并入角色论文计数。N36-N49 统一标记为 `gap`；N50-N61 的 OpenRouter、Composio、Stagehand、Skyvern、Helicone、LangSmith、Braintrust、AgentAPI、Replit Agent、Devin、Google Jules 和 MCP Context Forge 统一标记为 `screened`，仍待角色专项复现。
- A 级正式来源与 B 级前沿候选已分开；2026 预印本均明确标注待复现。
- CharacterEval 数字差异、GitHub secondary rate limit、候选仓库 404、SillyTavern token budget、JanitorBench 页面处理和角色平台公开社区不均衡均已写入不确定性表。
- 研究仍未进入实现完成状态；后续通过本地复现和 URL 审计后，再决定是否冻结设计协议。

### 9.1 URL 审计

本轮原有论文/规范 URL 审计为 65 个去重 URL；跨生态登记扩展到 61 条记录、119 个去重官方/社区入口，N36-N49 新增 28 个入口，N50-N61 新增 24 个入口。相关 Markdown/CSV 扩展后重新规范化提取 562 个去重 URL；并发 GET 快照为 517 个成功、30 个限流/禁止、9 个 404、1 个 400、1 个 422、2 个网络超时和 2 个网络错误。该扫描包含查询模板占位 URL、失效历史入口和代码片段中的 API 地址，不能替代逐条语义审计；失败项已按类型保留，未从 404/限流推导能力结论。N50-N61 的 HN/官方入口已逐项读取或由 Algolia API 核验，但角色专项代码、版本和复现实验仍未完成；研究仍保持 active。
