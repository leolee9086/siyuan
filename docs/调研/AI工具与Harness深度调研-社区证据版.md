# AI Harness／Agent 工具深度调研：社区证据、生态风险与 s-forge 方案

> 研究状态：进行中版本的饱和收集稿，研究日期 2026-07-28（Asia/Shanghai）。本文件替代旧版官方资料清单；它不把官方宣传当作社区验证，任何缺少社区证据的条目都必须明确标出证据缺口。原始抓取、动态采用快照、角色社区 RSS、能力矩阵、查询模板、失败来源和完整快照见 [研究轨迹](AI工具与Harness深度调研-研究轨迹.md)。

## 1. 重新设定的研究目标

上一版的问题不是条目数量不足，而是样本分布偏向企业 SDK 和学术框架，遗漏了真正被个人用户长期使用的常驻 Agent、终端 coding agent、角色扮演前端和本地 AI 工作台；同时只记录官方功能，没有记录用户遇到的真实故障、需求、迁移痛点、权限问题和维护风险。本版把“社区证据”设为每个工具的必填项。

### 1.1 完成门槛

一个工具只有同时具备以下六项才可进入“已评估”状态：官方能力来源；社区反馈来源；社区规模或活跃度信号；至少一条负面反馈或未满足需求；对长期陪伴／学习／信息收集／记忆的具体判断；明确的 s-forge 复用或平行实现决策。缺失项写为“证据缺口”，不以推测补齐。

### 1.2 样本构成

本版先纳入 37 个核心样本，随后补充 8 个工作流、平台和本地模型样本，并将 7 个旁路参照提升为边界对照卡片，形成 52 个总样本。样本按五条生态谱系覆盖，而不是按单一 SDK 生态选样：个人常驻与陪伴 Agent（OpenClaw、Hermes、Pi、SillyTavern、Open WebUI、LibreChat、AnythingLLM、RAGFlow、LobeHub、KoboldAI）；终端与 coding Agent（OpenCode、Claude Code、Gemini CLI、OpenHands、SWE-agent、Aider、Cline、Roo Code、Continue、Crush、OpenAI Codex CLI、Cursor、Windsurf、GitHub Copilot Agent Mode、Kilo Code）；编排、协议与数据基础设施（OpenAI Agents SDK、LangGraph、LlamaIndex、Haystack、Semantic Kernel、AutoGen、CrewAI、PydanticAI、Google ADK、Strands、Dify、MCP、Goose、n8n、Flowise、Langflow）；本地模型与 AI 工作台（Ollama、text-generation-webui、Jan、LM Studio）；记忆与持续学习（Letta、Mem0、Graphiti、LangMem、DSPy）。本版另建立 [跨生态样本登记表](AI工具与Harness-跨生态样本登记.csv)，新增 61 条角色前端、陪伴平台、常驻 Agent、轻量 harness、浏览器 Agent、记忆/评测、模型网关和角色卡规范记录；它们分为 `deep-card`、`screened`、`gap`，不把筛选记录伪装成已完成评估。KoboldCpp 作为低置信度附录样本记录，原因是其当前 GitHub 默认 README 来源出现仓库内容指向异常，不能直接把仓库首页当作可靠能力证据。

### 1.2.1 点名生态的覆盖边界

用户点名的 OpenClaw、Pi、Hermes、OpenCode 和“酒馆”并非遗漏：它们分别在 T24-T28 主样本中有独立能力卡、GitHub 问题快照、HN/Reddit 社区证据和角色一致性映射。为避免再把“有一个仓库链接”误报为广度，本轮将候选生态按入口类型做覆盖矩阵：

| 生态层 | 已纳入代表 | 本轮补抓/保持缺口 | 纳入理由与证据边界 |
|---|---|---|---|
| 角色卡与酒馆前端 | SillyTavern、RisuAI、TavernAI v1、Agnai、KoboldAI、KoboldCpp | NovelAI、Chub.ai、Pygmalion/Galatea、JanitorBench | 角色卡、世界书、persona、扩展和本地模型是上游输入；Chub/NovelAI 的公开社区与版本机制仍需独立复核。 |
| 关系型陪伴 | Character.AI、Replika、Nomi、AI Dungeon | Paradot、Kindroid、Nomi 的长期版本序列 | 产品策略、订阅、身份揭示和关系记忆会改变连续性；公开论坛样本存在平台偏差，不从单条帖子推导质量。 |
| 常驻 Agent/harness | OpenClaw、Hermes、Pi、OpenCode、NanoClaw、AutoGPT、Open Interpreter、OpenManus、Goose、smolagents、ZeroClaw、Nanobot、Agent Zero | Clawdbot/Moltbot 历史别名 | 重点看 session、渠道身份、provider 迁移、后台任务、工具结果和恢复；名称/仓库迁移必须记录 canonical URL。ZeroClaw/Nanobot/Agent Zero 已有 issue 正文快照，但评论数仍为 `unknown`。 |
| Coding Agent | Claude Code、Codex CLI、Gemini CLI、Cline、Roo Code、Aider、SWE-agent、OpenHands、Continue、Crush、Kilo Code、Cursor、Windsurf、Copilot Agent、Zed Agent、Void、Devin、Replit Agent、Google Jules | Amp、Kiro、PearAI | coding Agent 仅作为长轨迹、审批和 provider 连续性参照；不能把开发者采用信号直接当角色陪伴需求。Devin/Replit/Jules 的 HN 信号用于代表性，不等于角色效果。 |
| 模型网关与本地推理 | LiteLLM、vLLM、llama.cpp、Ollama、LM Studio、Jan、text-generation-webui、SGLang、MLX、ExLlamav2、OpenRouter | TensorRT-LLM、TabbyAPI | 后端改变上下文窗口、量化、模板、工具协议与延迟；同一角色配置必须记录 runtime backend 和 fallback。OpenRouter 的路由/fallback 是 provider 变量，不是记忆层。 |
| 记忆/检索/评测/可观测性 | Letta、Mem0、Graphiti、LangMem、Hindsight、Cognee、Supermemory、Promptfoo、DeepEval、Phoenix、Langfuse、Ragas、TruLens、OpenAI Evals、Zep、Chroma、Weaviate、Qdrant、Braintrust、Opik、Helicone、LangSmith | LlamaIndex memory | 记忆产品与评测框架不能互相替代；必须分别登记写入、召回、删除、trace、人类相关性和数据许可。Helicone/LangSmith/Braintrust 的平台证据不替代人工标注；Chroma/Qdrant/Weaviate 只证明检索层候选。 |

该矩阵把“广度”定义为生态层覆盖与证据类型覆盖，不把 stars、下载量或 HN points 直接换算成用户规模。补抓项在当前阶段保留为候选/缺口；它们没有被写成已核验能力。

### 1.3 证据等级

- **O（Official）**：官方文档、官方 README、官方规范或官方仓库源码。
- **C（Community）**：GitHub issue／discussion、社区 RFC、论坛／Discord／Reddit 反馈、用户提交的复现步骤；必须保留原始 URL 和摘录。
- **A（Adoption）**：GitHub stars／forks／watchers、发布频率、开放 issue 规模、包管理下载或官方采用案例；这些是生态信号，不等于真实活跃用户数。
- **S（S-forge）**：当前仓库源码和设计文档，证明某项能力可复用或需要新边界。

### 1.4 边界产品与闭源基线

为避免把开源 GitHub 仓库误当成全部生态，另记录七个闭源或周边工具作为边界样本：OpenAI Codex CLI、Cursor、Windsurf、GitHub Copilot Agent Mode、Kilo Code、Jan、LM Studio。它们的采用信号部分来自公开 HN 热度或官方产品入口，不能与 GitHub stars 直接比较；每个样本仍保留官方能力、社区反例、长期价值和 s-forge 判定，作为 T46-T52 的边界卡片。

| 工具 | 官方入口 | 社区信号 | 对本研究的补充 |
|---|---|---|---|
| OpenAI Codex CLI | [openai/codex](https://github.com/openai/codex) | [HN item 43708025](https://news.ycombinator.com/item?id=43708025)：516 points／289 comments | 终端 coding Agent 的官方基线，与 OpenCode、Pi、Claude Code 对照。 |
| Cursor | [Cursor docs](https://docs.cursor.com) | [prompt injection 讨论](https://news.ycombinator.com/item?id=44768119)：3 points | 闭源 IDE Agent 的权限／提示注入风险。 |
| Windsurf | [Windsurf](https://windsurf.com)／[docs](https://docs.windsurf.com) | [Cognition 收购 Windsurf](https://news.ycombinator.com/item?id=44564818)：2 points／1 comment | 产品所有权变化与 provider／服务连续性风险。 |
| GitHub Copilot Agent Mode | [官方文档](https://docs.github.com/en/copilot) | [Agent Mode＋MCP](https://news.ycombinator.com/item?id=44427688)：93 points／66 comments | 企业开发者入口和 MCP 治理关注。 |
| Kilo Code | [官方仓库](https://github.com/Kilo-Org/kilocode) | [“unlimited” pricing 讨论](https://news.ycombinator.com/item?id=44721003)：358 points／342 comments | 订阅承诺、额度与成本透明度。 |
| Jan | [menloresearch/jan](https://github.com/menloresearch/jan) | [Show HN](https://news.ycombinator.com/item?id=44474790)：3 points | 本地桌面助手和离线模型入口。 |
| LM Studio | [官方站点](https://lmstudio.ai/) | [LM Studio](https://news.ycombinator.com/item?id=38377072)：461 points／148 comments | 本地模型下载、运行和 headless／Agent 结合。 |

## 2. 社区证据如何解释

GitHub issue 不是总体满意度调查：它会过度代表故障和未满足需求。因此每条反馈只回答三个问题：用户在真实运行中遇到了什么；该问题揭示了哪种架构约束；s-forge 是否应该吸收这个约束。星数和 fork 数只用于判断生态广度，不能直接当作质量或使用量。所有快照都带日期，避免把动态徽章误写成永久事实。

## 3. 生态广度与采用信号快照

以下数值为 2026-07-28 抓取的 GitHub 仓库页面／REST API 快照，格式为 `stars / forks / watchers`。它们用于样本代表性判断，不用于产品排名。

| 编号 | 工具 | 类型 | stars / forks / watchers／公开信号 | 代表性理由 |
|---|---|---|---:|---|
| T01 | OpenAI Agents SDK | 编排 SDK | 28,215 / 4,384 / 221 | 主流模型供应商官方多 Agent、session、trace 基线。 |
| T02 | LangGraph | 有状态编排 | 38,265 / 6,438 / 170 | 长时运行、恢复和 memory 领域的事实型参考。 |
| T03 | LlamaIndex | 数据／RAG／Agent | 51,147 / 7,814 / 281 | 文档接入、解析、索引和 Agent 生态广。 |
| T04 | Haystack | RAG／Agent pipeline | 26,036 / 2,956 / 161 | 强调透明 pipeline、hooks、评测和 MCP。 |
| T05 | Semantic Kernel | 企业编排 | 28,379 / 4,697 / 295 | 微软生态、插件、process 和多 Agent。 |
| T06 | AutoGen | 多 Agent | 60,036 / 9,037 / 526 | 社区规模大，但官方已标记迁移到 Agent Framework。 |
| T07 | CrewAI | 多 Agent／流程 | 56,233 / 7,986 / 389 | Crews 与 Flows 的社区采用广。 |
| T08 | PydanticAI | 类型化 Agent | 18,843 / 2,425 / 114 | 结构化输出和类型安全的 Python 代表。 |
| T09 | Google ADK | Agent／Workflow | 20,914 / 3,767 / 150 | Google 官方 graph workflow 与 session/event schema。 |
| T10 | Strands Agents | model-driven SDK | 6,709 / 995 / 48 | AWS 体系的模型驱动工具循环。 |
| T11 | Letta | 持久记忆 Agent | 23,987 / 2,554 / 138 | MemGPT 生产化路线，直接强调持续学习。 |
| T12 | Mem0 | 记忆层 | 61,859 / 7,209 / 240 | 多级用户／会话／Agent memory 的高采用样本。 |
| T13 | Graphiti | 时间上下文图 | 29,259 / 2,951 / 165 | temporal graph、provenance、历史查询。 |
| T14 | LangMem | 长期记忆工具 | 1,583 / 182 / 11 | 规模较小但直接覆盖后台记忆巩固。 |
| T15 | DSPy | 程序化优化 | 36,415 / 3,134 / 202 | prompt／权重优化和可评测 Agent loop。 |
| T16 | OpenHands | coding／always-on | 82,326 / 10,540 / 474 | coding Agent 与自动化控制台生态。 |
| T17 | SWE-agent | 软件工程 Agent | 19,930 / 2,175 / 111 | benchmark 驱动的工具轨迹和代码任务。 |
| T18 | Aider | 终端 coding Agent | 47,733 / 4,778 / 253 | repo map、可回滚编辑和 Git 工作流。 |
| T19 | Browser Use | 浏览器 Agent | 107,022 / 11,765 / 452 | 动态网页观察／动作范式的代表。 |
| T20 | Claude Code | 终端 coding Agent | 139,323 / 22,386 / 862 | 大规模闭源服务对应的社区故障样本。 |
| T21 | Gemini CLI | 终端 Agent | 106,209 / 14,326 / 582 | Search grounding、MCP、checkpoint 的开源终端样本。 |
| T22 | Dify | 可视化应用编排 | 150,452 / 23,704 / 819 | Workflow、知识库和 Agent 应用平台。 |
| T23 | MCP Specification | 协议 | 8,713 / 1,675 / 175 | 工具、资源、提示和长任务协议的公共标准。 |
| T24 | OpenClaw | 个人常驻 Agent | 384,351 / 80,744 / 1,764 | 多渠道、always-on、gateway、cron 的个人 Agent 代表。 |
| T25 | Pi Agent | 可扩展 coding harness | 78,946 / 9,701 / 270 | runtime 与 coding CLI 分层，主动分享真实 session。 |
| T26 | Hermes Agent | 自我改进个人 Agent | 221,401 / 42,279 / 840 | 记忆、FTS5、nudges、cron、多渠道和自我改进闭环。 |
| T27 | OpenCode | 开源 coding Agent | 190,227 / 24,144 / 731 | plan／build agent、TUI、provider 生态。 |
| T28 | SillyTavern | 角色／陪伴前端 | 31,213 / 5,898 / 145 | character、persona、world info、group chat 和扩展生态。 |
| T29 | Cline | IDE／终端 coding Agent | 65,110 / 6,992 / 279 | Plan／Act、人类审批、checkpoint、SDK 和多 Agent Kanban。 |
| T30 | Roo Code | IDE coding Agent | 24,366 / 3,386 / 143 | custom modes、MCP 和团队工作流；官方扩展已发生产品迁移。 |
| T31 | Continue | IDE／CLI coding Agent | 35,144 / 5,119 / 165 | VS Code、CLI、JetBrains 多入口的开源 coding Agent。 |
| T32 | Open WebUI | 本地 AI 工作台 | 146,971 / 21,364 / 648 | persistent memory、calendar、automation、hybrid RAG 和 MCP。 |
| T33 | LibreChat | 多模型／Agent UI | 41,352 / 8,520 / 204 | 多 provider、Agents、MCP、文件搜索和 subagents。 |
| T34 | AnythingLLM | 文档／Agent 工作台 | 63,978 / 7,012 / 409 | 文档、Agent、向量库、scheduled tasks 和 MCP。 |
| T35 | RAGFlow | RAG／Agent context engine | 86,160 / 10,102 / 347 | context engine、文档解析和 agentic workflow。 |
| T36 | Crush | 终端 coding Agent | 26,891 / 2,086 / 143 | 多模型、session、LSP、MCP、跨平台终端。 |
| T37 | KoboldCpp（附录） | 本地推理／角色前端后端 | 11,282 / 741 / 105 | 有真实用户反馈，但仓库默认 README 当前来源需复核。 |
| T38 | Goose | 通用 Agent／工作流 | 51,820 / 5,754 / 279 | 桌面、CLI、API、多 provider 和 MCP 扩展，覆盖代码以外的研究、写作和自动化。 |
| T39 | n8n | AI 工作流平台 | 198,264 / 59,674 / 1,140 | 视觉工作流、AI Agent、1500+ 集成、人类审批和自托管。 |
| T40 | Flowise | 可视化 Agent 编排 | 54,971 / 24,764 / 361 | 低代码 AgentFlow、组件集成和 API 部署，面向快速实验与交付。 |
| T41 | Langflow | 可视化 Agent／MCP 平台 | 152,504 / 9,672 / 529 | 可视化 authoring、API／MCP server、多 Agent 和检索工作流。 |
| T42 | LobeHub／LobeChat | 多 Agent 工作台 | 80,884 / 15,717 / 301 | Chief Agent Operator、排班、报告和 7×24 多 Agent 运转。 |
| T43 | Ollama | 本地模型运行时 | 177,027 / 17,136 / 991 | 本地模型服务、REST API 和 Claude Code、OpenClaw、OpenCode 等 Agent 集成。 |
| T44 | KoboldAI | 本地写作／角色前端 | 3,926 / 864 / 73 | Memory、Author's Note、World Info、故事与聊天模式，覆盖陪伴和创作。 |
| T45 | text-generation-webui | 本地 AI 工作台 | 47,503 / 5,985 / 353 | 桌面 UI、API、文本／视觉／tool-calling、GGUF 和多平台后端。 |
| T46 | OpenAI Codex CLI | 终端 coding Agent | 101,881 / 15,270 / 534 | OpenAI 官方本地终端 Agent；HN item 43708025 为 516 points／289 comments。 |
| T47 | Cursor | 闭源 IDE coding Agent | HN 3 points／0 comments | Agent、Rules、MCP 和 CLI 的闭源 IDE 基线；采用信号只取公开讨论热度。 |
| T48 | Windsurf／Devin Desktop | 闭源 IDE／Agent 工作台 | HN 2 points／1 comment | 产品入口已转向 Devin Desktop；所有权和产品迁移本身是连续性信号。 |
| T49 | GitHub Copilot Agent Mode | 企业 IDE／Agent | HN 93 points／66 comments | GitHub 官方 Agent、cloud agent、MCP、审批和治理入口。 |
| T50 | Kilo Code | IDE／CLI coding Agent | 26,558 / 2,976 / 106 | VS Code、JetBrains、CLI、500+ 模型、terminal／browser control 和 MCP。 |
| T51 | Jan | 本地桌面 AI 工作台 | 43,737 / 2,921 / 219 | 本地模型、云 provider、OpenAI-compatible API 和 MCP；仓库已迁移到 janhq/jan。 |
| T52 | LM Studio | 本地模型工作台 | HN 461 points／148 comments | 下载、运行本地模型并提供 headless／Agent 入口；无稳定公开仓库指标。 |

### 3.1 包管理与容器采用信号

[动态采用信号登记表](AI工具与Harness-动态采用信号.csv) 保存了 2026-07-28 抓取的 46 条 npm、PyPI 和 Docker Hub 数据。npm 的窗口为 2026-07-18 至 2026-07-24 最近周；PyPI Stats 为抓取日返回的 rolling last-week；Docker Hub 为累计 pull count。新增的 Chroma、MLX/`mlx-lm` 和 Nanobot 包信号只用于入口活跃度时间序列，不代表对应项目的独立用户或角色效果。

| 入口 | 代表包/镜像 | 快照值 | 解释边界 |
|---|---|---:|---|
| npm | `@openai/codex` | 15,226,164 / week | Codex CLI 的发布包下载信号，包含重复安装和 CI。 |
| npm | `@anthropic-ai/claude-code` | 10,760,218 / week | Claude Code CLI 的包入口，不等于订阅用户数。 |
| npm | `openclaw` | 2,715,506 / week | OpenClaw 的 npm 入口；不能证明 always-on 部署量。 |
| npm | `opencode-ai` | 1,770,265 / week | OpenCode 包入口；包名与产品版本仍需对齐。 |
| npm | `@openai/agents` | 1,461,799 / week | Agents SDK 包下载，不能直接等同 Agent 应用数量。 |
| PyPI | `litellm` | 143,971,651 / rolling week | 网关被大量自动化和 CI 使用，不能按下载量排名。 |
| PyPI | `browser-use` | 11,520,797 / rolling week | 浏览器 Agent 的 Python 包入口，构建环境会放大数值。 |
| PyPI | `strands-agents` | 8,302,542 / rolling week | SDK 包下载，不能证明长期角色使用。 |
| PyPI | `google-adk` | 5,678,788 / rolling week | 官方 SDK 入口，不覆盖云端实际调用。 |
| PyPI | `pydantic-ai` | 3,957,888 / rolling week | 类型化 Agent SDK 的发布包信号。 |
| Docker Hub | `n8nio/n8n` | 239,094,128 cumulative pulls | 自托管工作流镜像，累计值包含全部 tags、CI 和镜像缓存。 |
| Docker Hub | `ollama/ollama` | 157,765,416 cumulative pulls | 本地模型服务分发信号，不等于活跃本地安装。 |
| Docker Hub | `flowiseai/flowise` | 6,681,508 cumulative pulls | 低代码 Agent 运行时镜像。 |
| Docker Hub | `lobehub/lobe-chat` | 5,910,806 cumulative pulls | LobeChat 镜像累计拉取，旧 tags 与托管使用未覆盖。 |

[npm 四周下载时间序列](AI工具与Harness-npm四周下载时间序列.csv) 进一步避免只看一个周快照：2026-06-27 至 2026-07-24，`@openai/codex` 从 10,644,992 增至 15,226,164（+43.0%），`@google/gemini-cli` 从 409,354 增至 567,566（+38.6%），`@openai/agents` +31.4%，`n8n` +21.7%，`flowise` +28.5%，`opencode-ai` +7.4%，`@anthropic-ai/claude-code` +4.4%，`openclaw` -0.5%。这是包下载的四周变化，不是用户增长或质量变化；例如发布、更新脚本和 CI 都会改变数值。

**使用规则**：不同 registry 的数值不相加、不换算为用户数、不用于质量排序；它们只帮助判断哪些入口值得优先做版本时间序列和回归复现。未找到的 npm 包、PyPI 项目或 Docker 镜像会记录为“入口未匹配”，而不是补猜下载量。

本轮入口缺口也有记录：`langgraph`、`llama-index`、`haystack-ai`、`pydantic-ai`、`google-adk`、`dspy` 等主要由 PyPI 分发，npm 查询返回 404；`text-generation-webui` 的 PyPI 查询返回 404；Dify、Open WebUI、SillyTavern 的常用镜像不在本轮 Docker Hub canonical 路径。它们不纳入动态数值表，避免把错误包名当作采用信号。

### 3.2 52 个主样本能力矩阵

[主样本能力矩阵](AI工具与Harness-主样本能力矩阵.csv) 把 T01-T52 的 provider、memory、HITL、async、browser、sandbox、channels、retrieval、observability、maintenance 和角色关联统一成 `yes / partial / no / unknown` 语义；它是比较和复现实验的索引，不是产品排名。

矩阵的三条约束：

1. **能力存在与效果分离**：`yes` 只表示官方入口或源码显示有该能力，不表示在所有 provider、版本或硬件上稳定。
2. **社区反例优先修正置信度**：有流式、权限、迁移、provider 或安装故障的项目，相关字段降为 `partial` 或 medium/low confidence。
3. **角色关联单独记录**：`direct` 表示工具直接处理角色、关系或持久记忆；`adjacent` 表示影响运行时、工具、检索或观测；`infra` 表示模型/协议底座，不能单独保持人格。

## 4. 社区证据卡片

以下每张卡片都把官方能力、社区反馈、风险和 s-forge 决策分开。社区摘录保留用户原话的关键句，省略个人信息和重复模板；完整原始页面与访问记录见研究轨迹。

### 4.1 编排与记忆基础设施

#### T01 OpenAI Agents SDK

- **O**：[官方 README](https://raw.githubusercontent.com/openai/openai-agents-python/main/README.md) 列出 agents、handoffs、agents-as-tools、MCP tools、guardrails、human-in-the-loop、sessions 和 tracing。
- **C**：[Issue #636：Human-In-The-Loop Architecture](https://github.com/openai/openai-agents-python/issues/636) 的用户反馈是 SDK 虽然具备 autonomous/tool-augmented 能力，但真实应用缺少可暂停、审批和恢复的 HITL 架构。
- **解释**：社区反馈直接指出“自动化能力”与“可控恢复”之间的落差；长期陪伴尤其需要在记忆写入、外部发送和身份变化前暂停。
- **s-forge 决策**：复用 `kernel/agent` turn／runtime 和现有工具确认机制，新增 `AwaitingApproval`、memory-review 和 provider-neutral trace；不引入 Python SDK。

#### T02 LangGraph

- **O**：[官方 README](https://raw.githubusercontent.com/langchain-ai/langgraph/main/README.md) 将 durable execution、human-in-the-loop、comprehensive memory 和 long-running stateful agents 作为核心卖点。
- **C**：[Issue #4973：LangGraph v1 roadmap](https://github.com/langchain-ai/langgraph/issues/4973) 收到 85 条评论，维护者公开询问 StateGraph API 哪些地方 confusing、boilerplate-heavy、unintuitive，以及缺失的高优先级功能。
- **解释**：即使是成熟的 stateful harness，图状态 API 的复杂度和样板代码仍是主要社区成本；不能把“有图”误写成“易维护”。
- **长期价值**：持久状态、恢复和记忆适合长期任务，但图状态必须保持可读、可迁移，避免维护成本吞噬陪伴体验。
- **s-forge 决策**：只引入显式 event／checkpoint／human interrupt，不引入第二套图 DSL；以既有 `runtime.json` 和 Go 状态机承载有限的 turn graph。

#### T03 LlamaIndex

- **O**：[官方 README](https://raw.githubusercontent.com/run-llama/llama_index/main/README.md) 与 [Agent 文档](https://docs.llamaindex.ai/en/stable/module_guides/deploying/agents/) 覆盖 Parse、Extract、Index、Agents、Workflows 和 advanced retrieval。
- **C**：[Issue #13592：Seaborn import 被安全执行器拒绝](https://github.com/run-llama/llama_index/issues/13592) 的复现指出，允许列表中已有 Seaborn，但代码执行仍报 private/dunder/import forbidden。
- **解释**：文档 Agent 的数据接入很强，但代码执行沙箱和允许导入之间存在实际摩擦；“可执行工具”必须有明确的能力边界和错误可解释性。
- **长期价值**：解析、索引和引用能支撑持续信息收集；来源、执行边界和可重建索引决定记忆是否值得长期信任。
- **s-forge 决策**：复用 Asset／Block／`web_fetch`／Embedding 入口做解析和 provenance；代码执行继续走现有 task-directory 授权，不移植 LlamaIndex 的执行沙箱。

#### T04 Haystack

- **O**：[官方 README](https://raw.githubusercontent.com/deepset-ai/haystack/main/README.md) 明确强调透明的 retrieval、routing、memory、generation pipeline，以及 lifecycle hooks、step_count、token_usage 和 MCP server。
- **C**：[Issue #611：Introduce QueryClassifier](https://github.com/deepset-ai/haystack/issues/611) 的部署反馈希望区分自然语言问题和关键词查询，以在 Reader 分支中平衡准确率、计算成本和路由复杂度。
- **解释**：社区真实痛点不是“缺一个组件”，而是查询意图分类影响成本和召回；长期记忆也需要先判断是否值得召回。
- **s-forge 决策**：在现有 search／ContextBuilder 前增加 query intent 和预算 hook；不新增 pipeline DSL，所有 trace 进入统一 RetrievalTrace。

#### T05 Semantic Kernel／Agent Framework

- **O**：[官方 README](https://raw.githubusercontent.com/microsoft/semantic-kernel/main/README.md) 描述 plugins、memory、planning、Process Framework、多 Agent 和 MCP，并说明 Agent Framework 是后继方向。
- **C**：[Issue #13957：Compliance-as-Code plugin](https://github.com/microsoft/semantic-kernel/issues/13957) 反映企业用户需要可审计的 GDPR、NHS DTAC、FCA SYSC、ISO 27001 合规证据，而现状依赖手工表格、截图和 attestations。
- **解释**：企业采用的阻力在治理证据链，而不只是模型质量；s-forge 的记忆和工具写入也需要 provenance、授权和可回放记录。
- **s-forge 决策**：扩展 `ToolEffects`、SourceEvent 和审计事件；Process 思想映射到 cron／heartbeat／session task，不增加 SK 运行时。

#### T06 AutoGen

- **O**：[官方 README](https://raw.githubusercontent.com/microsoft/autogen/main/README.md) 定义 multi-agent applications、human collaboration 和 MCP；同时标记 maintenance mode 并建议迁移到 Microsoft Agent Framework。
- **C**：[Issue #7353：Cryptographic action receipts](https://github.com/microsoft/autogen/issues/7353) 有 395 条评论，需求是证明哪个 Agent 被指示做什么、实际执行了什么、消费和产生了哪些数据，而不是只有普通日志。
- **解释**：多 Agent 的核心社区诉求从“会协作”转向“可证明地协作”；这对长期陪伴中的跨角色记忆尤其重要。
- **s-forge 决策**：采纳 action receipt／hash chain 思想，写入现有 runtime 和 SourceEvent；不绑定 AutoGen API，并把维护状态作为迁移风险。

#### T07 CrewAI

- **O**：[官方 README](https://raw.githubusercontent.com/crewAIInc/crewAI/main/README.md) 区分自主协作的 Crews 与精确事件驱动的 Flows，并提供 tracing、metrics、logs。
- **C**：[Issue #4877：GuardrailProvider interface](https://github.com/crewAIInc/crewAI/issues/4877) 有 299 条评论，多个 issue／PR 都要求 tool-level authorization、fail-closed unsafe code execution 和 pre-execution confirmation。
- **解释**：多 Agent 的用户规模越大，工具授权越不能只靠系统 prompt；工具调用前的策略判断是独立能力。
- **长期价值**：角色协作适合把研究、规划和执行拆成可追踪步骤，但授权和结果审计必须覆盖每个角色。
- **s-forge 决策**：在现有 registry 和 `executeTool` 前加入 policy hook、效果声明和审批；角色协作使用 MAGI 视角事件，不引入 Crews／Flows DSL。

#### T08 PydanticAI

- **O**：[官方 Agent 文档](https://ai.pydantic.dev/agents/) 展示 Agent、tools、dependencies、output validators 和 structured output。
- **C**：[Issue #748：Gemini causes “Event loop is closed”](https://github.com/pydantic/pydantic-ai/issues/748) 反馈同一代码在 OpenAI 正常、Gemini／Streamlit async 场景失败，暴露 provider 与宿主事件循环耦合。
- **解释**：类型安全不会自动消除 provider runtime 差异；长期运行必须把模型、流式传输和宿主生命周期隔离。
- **s-forge 决策**：吸收 schema／validator 设计，使用 Go struct 和 JSON Schema；为每个 provider 增加 contract test，不引入 Python runtime。

#### T09 Google ADK

- **O**：[官方 README](https://raw.githubusercontent.com/google/adk-python/main/README.md) 描述 graph-based workflow、Task API、routing、nested workflow、HITL 和 session／event schema。
- **C**：[Issue #2133：ADK Roadmap 2025 Q3](https://github.com/google/adk-python/issues/2133) 是社区路线讨论，列出 configurable ADK、computer use、浏览器环境和更广泛的 Agent 能力需求。
- **解释**：社区关注的是配置化和环境接入，而不是单一 Agent loop；长期陪伴需要把事件／session schema 作为稳定跨版本契约。
- **s-forge 决策**：增加 event envelope、parent／child task 和 schema migration；computer use 走独立 browser executor。

#### T10 Strands Agents

- **O**：[官方仓库 README](https://raw.githubusercontent.com/strands-agents/harness-sdk/main/README.md) 将 agent loop、model providers、tools 和 MCP server 作为 model-driven SDK 的基础。
- **C**：[Issue #495：orphaned tool_use blocks](https://github.com/strands-agents/harness-sdk/issues/495) 的真实错误是 Bedrock 没有完成 tool result，随后消息出现 `tool_use` 没有紧邻 `tool_result`，导致 ConverseStream ValidationException。
- **解释**：流式工具协议需要处理半完成事件、断线和补偿；这是所有 provider adapter 的共同底层问题。
- **长期价值**：稳定的工具事件是长期记忆和自动化副作用的底座；半完成结果必须可追踪、可补偿。
- **s-forge 决策**：在现有 `executeTool` 增加 tool invocation 状态机和 unknown／orphan reconciliation；不复制 Strands SDK。
#### T11 Letta（MemGPT 生产化路线）

- **O**：[官方 README](https://raw.githubusercontent.com/letta-ai/letta/main/README.md) 明确宣称 advanced memory、跨会话 stateful Agent、continual learning 和 self-improvement。
- **C**：[Issue #480：easy to use MemGPT API](https://github.com/letta-ai/letta/issues/480) 的用户直说项目“a bit too complicated”，希望有更简单的 API、独立文件和最小调用示例。
- **解释**：持久记忆的认知模型很有价值，但 API／概念复杂度会阻碍真实采用；s-forge 需要把复杂性隐藏在内核，用户只看到 Block 和审核界面。
- **s-forge 决策**：记忆写入、召回、确认和过期作为 `MemoryStore` 领域接口，底层使用现有 Block／Daily Note／VectorDB，不引入 Letta server。

#### T12 Mem0

- **O**：[官方仓库](https://github.com/mem0ai/mem0) 与 [平台概览](https://docs.mem0.ai/platform/overview) 提供 User、Session、Agent 多级 memory、add／search 和个性化。
- **C**：[Issue #3284：metadata filtering not working](https://github.com/mem0ai/mem0/issues/3284) 的用户复现中文偏好查询返回空结果，并指出官方文档中的过滤用法无法工作。
- **解释**：多级记忆的价值必须建立在过滤、更新和可解释召回可靠的前提上；“记住了”不能等价于“每次都找得到”。
- **s-forge 决策**：使用 Block 属性和 VectorDB metadata 做显式过滤，保留 FTS fallback、source citation 和 query trace；不把第三方 memory layer 作为权威源。

#### T13 Graphiti

- **O**：[官方 README](https://raw.githubusercontent.com/getzep/graphiti/main/README.md) 描述 temporal context graphs、事实变化、provenance、增量更新和历史查询。
- **C**：[Issue #402：label propagation lacks max iteration cap](https://github.com/getzep/graphiti/issues/402) 指出社区发现算法只等待收敛，没有硬迭代上限，可能在振荡图上无限循环；用户明确说它用于 Graphiti MCP memo 场景。
- **解释**：时间图解决长期记忆的语义问题，但图算法的终止性和可恢复性同样是生产约束。
- **s-forge 决策**：创建可重建的 `memorygraph` 投影，所有图搜索有 max nodes／iterations／deadline；权威事实仍是 Block 和 SourceEvent。

#### T14 LangMem

- **O**：[官方 README](https://raw.githubusercontent.com/langchain-ai/langmem/main/README.md) 列出 core memory API、hot-path memory tools、background memory manager、extract／consolidate／update 和 prompt refinement。
- **C**：[Issue #18：source distribution 安装失败](https://github.com/langchain-ai/langmem/issues/18) 中，LinkedIn 用户说明 `--no-binary` 安装包失败，阻碍其内部 External Library Request 和团队采用。
- **解释**：记忆算法再好，安装、打包和企业依赖审核失败也会阻断落地；s-forge 需要保持单体内核的可部署性。
- **s-forge 决策**：把前台候选记忆和后台 heartbeat 巩固做成 Go 内置模块，不引入额外 Python packaging chain。

#### T15 DSPy

- **O**：[官方 README](https://raw.githubusercontent.com/stanfordnlp/dspy/main/README.md) 定义 programming rather than prompting、模块化 AI 系统和 prompt／weight optimization。
- **C**：[Issue #390：Major refactor roadmap](https://github.com/stanfordnlp/dspy/issues/390) 有 63 条评论，维护者承认少数强概念是在一年中有机生长，内部需要大重构以减少不一致和使用摩擦。
- **解释**：自动优化适合离线策略学习，但 API 演化和概念稳定性要先纳入版本化评测；不能让生产 Agent 自行改 prompt。
- **s-forge 决策**：建立独立 `agent/eval` 与 `agent/policy` 平面，策略生成、比较、批准、回滚均离线完成。

#### T16 OpenHands

- **O**：[Agent Canvas 自动化文档](https://docs.openhands.dev/openhands/usage/agent-canvas/prebuilt-automations) 与 [backend 文档](https://docs.openhands.dev/openhands/usage/agent-canvas/backends) 描述 always-on 控制中心、schedule／webhook automation 和 local／Docker／VM／cloud backend。
- **C**：[Issue #12528：Sandbox failed to start within 120s](https://github.com/OpenHands/OpenHands/issues/12528) 的用户贴出 app_server 等待 sandbox 超时的完整 traceback，说明持久自动化的关键故障点在环境启动，而不是模型回答。
- **解释**：长期 Agent 的运行环境是第一等状态；没有沙箱健康、启动超时和恢复策略，cron 只会制造悬挂任务。
- **s-forge 决策**：复用 task-directory 和 heartbeat，但新增 sandbox lease／health／timeout 状态；browser／code executor 与用户 session 分离。

#### T17 SWE-agent

- **O**：[官方 README](https://raw.githubusercontent.com/SWE-agent/SWE-agent/main/README.md) 描述模型自主使用工具修复真实 GitHub 仓库，并指向 mini-SWE-agent 和 SWE-bench。
- **C**：[Issue #66：Streamlining installation](https://github.com/SWE-agent/SWE-agent/issues/66) 反馈非贡献者安装需要多步骤，有 Discord 用户花了两天，社区希望单命令运行。
- **解释**：benchmark 能力不等于可采用性；长期工程协作首先需要低摩擦安装、可重复环境和清楚的失败记录。
- **s-forge 决策**：使用现有 task-directory、session snapshot 和测试输出；回放 harness 负责 benchmark，不把 SWE-agent 依赖拖入产品。

#### T18 Aider

- **O**：[Repo map 文档](https://aider.chat/docs/repomap.html) 描述按相关性选择代码上下文；[官方 README](https://raw.githubusercontent.com/Aider-AI/aider/main/README.md) 描述自动 commit、diff、undo、网页／图片上下文。
- **C**：[Issue #2227：Add GitHub Copilot provider](https://github.com/Aider-AI/aider/issues/2227) 反映用户希望把 Copilot 作为 provider，说明实际采用依赖模型入口的广度和兼容性。
- **解释**：代码 Agent 的长期记忆不是无限聊天，而是 repo map、提交、diff 和可回滚经历；provider 适配是用户迁移成本。
- **s-forge 决策**：扩展现有 task-directory、git snapshot 和 LLM adapter；repo map 作为可重建缓存，不成为不可见事实源。

#### T19 Browser Use

- **O**：[官方 README](https://raw.githubusercontent.com/browser-use/browser-use/main/README.md) 直接列出 opens pages、clicks buttons、types 和 fills forms 的动态浏览器 Agent。
- **C**：[Issue #839：Chromium stuck](https://github.com/browser-use/browser-use/issues/839) 反馈浏览器停在 about:blank，终端不断重复 Step 1，只有人工在地址栏输入并回车才能解锁。
- **解释**：浏览器行动的失败可能来自浏览器状态、窗口焦点和等待条件，不是普通 HTTP 抓取错误；必须保存观察—动作轨迹。
- **长期价值**：浏览器能持续收集外部信息并执行事务，但只有带截图、等待和人工接管的轨迹才适合长期复盘。
- **s-forge 决策**：建立平行 browser trajectory executor，通过 MCP／Tool registry 接入；每步记录 URL、截图 hash、动作、等待和可恢复 checkpoint。

#### T20 Claude Code

- **O**：[官方仓库](https://github.com/anthropics/claude-code) 是终端 coding Agent，围绕文件、shell、项目上下文和工具调用工作。
- **C**：[Issue #16157：Instantly hitting usage limits](https://github.com/anthropics/claude-code/issues/16157) 有 1,482 条评论，用户描述连续三个月正常使用后，Max 订阅在两小时内触发额度限制。
- **解释**：高采用闭源 Agent 的核心社区风险是服务配额、成本和不可控的 provider 状态；长期任务必须知道预算和可切换 provider。
- **s-forge 决策**：保留 token／cost breakdown、provider failover 和取消状态；不把闭源服务的额度策略当作本地记忆行为。

#### T21 Gemini CLI

- **O**：[官方 README](https://raw.githubusercontent.com/google-gemini/gemini-cli/main/README.md) 列出 Google Search grounding、file／shell tools、MCP、non-interactive automation、conversation checkpoint 和 `GEMINI.md`。
- **C**：[Issue #16723：exit／quit command](https://github.com/google-gemini/gemini-cli/issues/16723) 有 1,791 条评论，用户希望标准命令不再必须带 slash，并引用 Claude Code、Aider、Copilot CLI 的行为差异。
- **解释**：终端 Agent 的交互细节会形成迁移和误操作成本；社区反馈能发现官方能力列表里没有的 ergonomics 问题。
- **长期价值**：checkpoint、搜索和自动化适合长期 coding 任务；统一暂停／恢复语义能降低跨工具迁移成本。
- **s-forge 决策**：沿用现有 Agent panel command routing，提供统一退出／暂停／恢复语义；checkpoint 直接映射 `runtime.json`。

#### T22 Dify

- **O**：[Workflow 文档](https://docs.dify.ai/en/guides/workflow) 与 [应用编排文档](https://docs.dify.ai/en/guides/application-orchestration/readme) 覆盖可视化 workflow、knowledge、tools 和 Agent。
- **C**：[Issue #27291：升级后旧知识不可用](https://github.com/langgenius/dify/issues/27291) 有 113 条评论，用户反馈从 1.9.1 到 1.9.2 后创建的知识不可用，直接暴露索引／迁移兼容问题。
- **解释**：知识库迁移和 schema 版本是长期记忆的硬约束；不能只设计首次写入，必须设计升级、重建和回滚。
- **s-forge 决策**：记忆 Block 是权威源，VectorDB／graph 是可重建投影；所有索引格式带 schema version 和 rebuild command。

#### T23 Model Context Protocol

- **O**：[2025-06-18 规范](https://modelcontextprotocol.io/specification/2025-06-18) 定义 Tools、Resources、Prompts、capability negotiation；当前仓库的 README 与规范是协议来源。
- **C**：[SEP-1391：Asynchronous Tool Execution](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1391) 提案指出长时间工具需要 token-based operation tracking、状态查询和多次获取结果，避免依赖持久连接。
- **解释**：MCP 的社区演进正从一次性工具调用走向长任务、异步和可恢复；这与 s-forge 的 heartbeat／runtime 直接相关。
- **s-forge 决策**：扩展现有 MCP client 支持 operation token、poll／resume、取消和结果幂等；协议能力与长期记忆保持分层。
### 4.2 个人常驻 Agent 与长期陪伴样本

#### T24 OpenClaw

- **O**：[官方 README](https://raw.githubusercontent.com/openclaw/openclaw/main/README.md) 把 OpenClaw 定义为运行在用户设备上的 personal AI assistant，支持 WhatsApp、Telegram、Slack、Discord、Signal、iMessage、Matrix、Feishu、QQ 等多渠道；Gateway 负责 sessions、channels、tools 和 events，另有 multi-agent routing、browser、canvas、nodes 和 cron。
- **C**：[RFC #49971：Native Agent Identity & Trust Verification](https://github.com/openclaw/openclaw/issues/49971) 的社区提案指出 OpenClaw 当前没有 native agent identity，Agent 可以持有钱包、付款、安装 skills 和跨平台通信，却缺少可密码学验证的身份；提案同时引用扫描发现的 341 个恶意 ClawHub skills、13.4% 的严重问题比例和约 135,000 个暴露实例作为风险背景。后三个数字是 issue 引用的外部报告，本轮未独立复算，只作为社区风险信号记录。
- **C-HN**：Hacker News 的 [Tell HN：Anthropic 不再允许订阅用于 OpenClaw](https://news.ycombinator.com/item?id=47633396) 获 1,099 points／827 comments；[OpenClaw is what Apple intelligence should have been](https://news.ycombinator.com/item?id=46893970) 获 518 points／417 comments。两条讨论同时呈现 provider policy 摩擦和强烈的产品吸引力。
- **解释**：OpenClaw 的突出能力是“个人通讯入口＋常驻 Gateway＋设备动作”，突出风险是跨渠道身份、插件供应链和主机权限；这比普通聊天 Agent 更接近长期陪伴的真实形态。
- **s-forge 决策**：复用现有 SourceContext、MCP、heartbeat 和 WebSocket，新增独立 `agent/gateway` 负责渠道适配、账户／会话隔离、pairing 和 agent identity；Block 记忆与渠道消息通过 SourceEvent 连接，主机工具仍受 task-directory／sandbox 约束。

#### T25 Pi Agent

- **O**：[Pi mono README](https://raw.githubusercontent.com/badlogic/pi-mono/main/README.md) 把 runtime（tool calling 和 state management）与 coding-agent CLI 分层，支持自扩展、容器化／micro-VM 边界，并鼓励公开分享真实 coding sessions。
- **C**：[Issue #4945：openai-codex connection reliability](https://github.com/earendil-works/pi/issues/4945) 反馈在正常交互中 TUI 卡在 `Working...`，没有流文本、工具调用或可见错误，只能按 Escape 结束 turn；环境包括 pi 0.75.5、openai-codex／gpt-5.5 和 xhigh thinking。
- **C-HN**：[Pi：Another AI agent toolkit, but this one is interesting](https://news.ycombinator.com/item?id=47580883) 有 3 points／1 comment；另有 [Pi compaction and branch summarization](https://news.ycombinator.com/item?id=47122817) 讨论其上下文压缩方向。公开讨论量低于其他点名工具，因此采用判断保留较低置信度。
- **解释**：Pi 的价值在于小而可扩展的 runtime 和真实 session 数据闭环；社区故障说明“流式无输出”必须是明确状态，而不是让用户猜测 Agent 是否还活着。
- **长期价值**：公开 session、分支摘要和可扩展 runtime 适合形成个人工作史；状态心跳和恢复决定它能否持续陪伴。
- **s-forge 决策**：沿用现有 runtime checkpoint、stream timeout、interruption 和 session recovery；增加 heartbeat／UI 状态的 last-event timestamp 和 stuck-turn recovery，不照搬 Pi 的 provider 绑定。

#### T26 Hermes Agent

- **O**：[官方 README](https://raw.githubusercontent.com/NousResearch/hermes-agent/main/README.md) 明确列出 agent-curated memory、periodic nudges、跨会话 FTS5 search＋LLM summarization、用户建模、cron、Telegram／Discord／Slack／WhatsApp／Signal、subagents 和多种 terminal backends。
- **C**：[Issue #11179：Responses stream crashes](https://github.com/NousResearch/hermes-agent/issues/11179) 反馈 OpenAI-compatible provider 发送合法的 `response.output_item.done` 后，以 `response.completed` 且 `response.output=null` 结束，Hermes 在 `get_final_response()` 处崩溃，无法使用已有的空列表恢复逻辑。
- **C-HN**：[Migrate from OpenClaw](https://news.ycombinator.com/item?id=48586005) 获 122 points／105 comments，说明 Hermes 已被作为个人 Agent 迁移目标讨论；同时也说明其社区曝光部分来自 OpenClaw 生态迁移，而非独立长期用户统计。
- **解释**：Hermes 是本轮最接近“长期学习闭环”的样本，但其核心能力仍建立在 provider stream 兼容、FTS5 规模、nudges 和技能自修改之上；技能自修改不能直接当作可审计长期记忆。
- **s-forge 决策**：吸收 FTS5 session search、periodic nudge、cron delivery、用户模型和跨渠道连续性；把 skill creation 改成 candidate policy／memory claim，经用户确认和离线评测后发布。

#### T27 OpenCode

- **O**：[官方 README](https://raw.githubusercontent.com/anomalyco/opencode/dev/README.md) 定义 open-source AI coding agent，内置 `build`（full access）、`plan`（read-only）和 `general` subagent，并通过 TUI 和 provider 生态运行。
- **C**：[Issue #7410：Broken Claude Max](https://github.com/anomalyco/opencode/issues/7410) 反馈 Claude Max 使用突然停止并返回错误，重连仍无效；用户提供 OpenCode 1.1.8、macOS 和复现步骤字段。
- **C-HN**：[Opencode：AI coding agent, built for the terminal](https://news.ycombinator.com/item?id=44482504) 获 319 points／91 comments；另有 [critical unauthenticated RCE](https://news.ycombinator.com/item?id=46539718) 讨论，说明采用热度与安全事件可以同时存在。
- **解释**：plan／build 的权限分离是值得吸收的交互范式，但 provider 账号配额和插件兼容会直接中断工作；长期任务需要 provider-neutral checkpoint。
- **s-forge 决策**：将 `plan` 映射为只读 task-directory policy，`build` 映射为需确认的写操作；保留现有 provider adapter、retry 和 token accounting。

#### T28 SillyTavern（酒馆）

- **O**：[官方仓库 README](https://raw.githubusercontent.com/SillyTavern/SillyTavern/release/README.md) 将其定位为 “LLM Frontend for Power Users”；[官方文档](https://docs.sillytavern.app/) 提供 character design、world info、group chats、personas、summarize、translation、TTS 和 websearch 等入口。
- **C**：[Issue #729：Poe invalid or expired token](https://github.com/SillyTavern/SillyTavern/issues/729) 是用户的完整复现：Android 13、Chrome、Poe API，连接后立即返回 invalid or expired token；项目 README 同时公开 Discord 和 `r/SillyTavernAI` Reddit 社区入口。
- **C-HN**：[SillyTavern：LLM Front End for Power Users](https://news.ycombinator.com/item?id=48419761) 获 3 points，另一个统一 LLM API 入口的帖子获 2 points；HN 讨论量有限，不能替代其 Discord／Reddit 社区规模判断。
- **解释**：酒馆的突出能力不是通用 workflow，而是用户可编辑的人格、角色卡、世界信息、群聊和扩展生态；它证明长期陪伴需要“叙事／关系记忆的用户编辑面”，而不只是向量检索。渠道 token、扩展质量和模型兼容是现实风险。
- **s-forge 决策**：以 Block 文档承载 persona、character、world、relationship 和 lore entries，使用属性和引用做可编辑召回；通过现有 AI session 连接模型，扩展 websearch／summary 工具，保持扩展沙箱和密钥隔离。

### 4.3 IDE、终端与本地 AI 工作台

#### T29 Cline

- **O**：[官方 README](https://raw.githubusercontent.com/cline/cline/main/README.md) 支持 VS Code、JetBrains、CLI、headless、SDK、Kanban、多 Agent、connectors、scheduled automations、Plan／Act、人类审批和 checkpoints。
- **C**：[Issue #3445：Terminal output capture failure](https://github.com/cline/cline/issues/3445) 反馈远程 AWS EC2 上命令实际成功但 Cline 抓不到输出，回滚到旧版本才恢复。
- **解释**：人类审批和 diff checkpoint 适合 s-forge，但“命令成功而输出丢失”会破坏 Agent 的事实判断；工具结果必须有 transport integrity 和 unknown 状态。
- **长期价值**：可审查 diff、计划和自动化适合长期项目；输出完整性是后续记忆和回滚的前提。
- **s-forge 决策**：复用 task-directory、ToolProgress、runtime checkpoint；补充输出 hash、截断标记和 `executionUnknown` 展示，不直接移植 Cline extension host。

#### T30 Roo Code

- **O**：[官方 README](https://raw.githubusercontent.com/RooCodeInc/Roo-Code/main/README.md) 列出 MCP Servers、Custom Modes 和团队工作流；README 明确注明 Roo Code Extension 在 2026-05-15 关闭，产品边界发生迁移。
- **C**：[Issue #1203：VS Code LM API model unsupported](https://github.com/RooCodeInc/Roo-Code/issues/1203) 反馈 Claude 3.7 Sonnet／Thought models 在 VS Code LM API 中突然返回 400 model not supported。
- **解释**：Custom Modes 对策略分层有启发，但产品迁移和 provider model matrix 说明 IDE Agent 的生态稳定性需要独立适配层。
- **长期价值**：模式化策略有助于把个人偏好沉淀为可复用工作流；迁移和模型兼容状态必须独立于 IDE 产品保存。
- **s-forge 决策**：将 mode 作为版本化 policy，不依赖 Roo extension；模型能力由 provider capability manifest 驱动，错误返回具体 unsupported reason。

#### T31 Continue

- **O**：[官方 README](https://raw.githubusercontent.com/continuedev/continue/main/README.md) 支持 CLI、VS Code、JetBrains，强调 open-source coding agent 和社区协作。
- **C**：[Issue #3753：copy/paste failure and extension host crashes](https://github.com/continuedev/continue/issues/3753) 反馈 VS Code、Fedora、Ollama、Qwen2.5-Coder 组合下复制粘贴间歇失败并导致 extension host 崩溃。
- **解释**：本地模型和 IDE 宿主的交互故障可能与 Agent 核心无关，但用户体验会把它视为 Agent 失忆或失控；宿主能力必须可观测。
- **s-forge 决策**：独立记录 frontend host、model provider、tool runtime 三类健康状态，沿用 agent-standalone 的端口边界，不把 UI 崩溃写进长期记忆。

#### T32 Open WebUI

- **O**：[官方 README](https://raw.githubusercontent.com/open-webui/open-webui/main/README.md) 公开 persistent memory、calendar、automations、hybrid BM25＋vector RAG、web search、MCP／OpenAPI tools、channels、notes、usage analytics 和多模型对话。
- **C**：[Issue #8074：Network Problem 0.5+](https://github.com/open-webui/open-webui/issues/8074) 记录 Docker、Windows 11、Firefox、Ollama 环境的网络问题，并要求提交浏览器日志、容器日志和版本信息。
- **解释**：Open WebUI 把“聊天＋日历＋自动化＋记忆＋RAG”整合成工作台，是长期陪伴产品形态的高代表性样本；社区反馈提醒我们必须把部署网络、日志和诊断作为产品能力。
- **s-forge 决策**：复用 Block、Daily Note、Embedding、VectorDB 和 heartbeat；Calendar／automation 只扩展现有 cron／task APIs，前端诊断归入 Agent standalone，而不复制 Open WebUI UI。

#### T33 LibreChat

- **O**：[官方 README](https://raw.githubusercontent.com/danny-avila/LibreChat/main/README.md) 支持多模型 endpoint、Agents、MCP、tools、file search、code execution、subagents、agent marketplace 和协作共享。
- **C**：[Issue #4848：chat folders／projects](https://github.com/danny-avila/LibreChat/issues/4848) 的用户希望用 folders／projects 组织会话，并把已上传和已索引的文件作为共享上下文。
- **解释**：社区需求把“会话组织”提升为长期项目上下文；s-forge 的文档树和 Block 天然适合解决这个问题。
- **s-forge 决策**：将 Agent session、task directory、memory claims 绑定到文档／项目根 Block；复用现有 layout/session panel，不引入 marketplace。

#### T34 AnythingLLM

- **O**：[官方 README](https://raw.githubusercontent.com/Mintplex-Labs/anything-llm/master/README.md) 提供文档问答、内置 Agents、向量库、document pipelines、dynamic model routing、scheduled tasks、MCP、agent flows 和 source citations。
- **C**：[Issue #2962：QNN Engine offline](https://github.com/Mintplex-Labs/anything-llm/issues/2962) 反馈 Snapdragon X Plus 桌面端识别不到 QNN CPU/NPU，导致本地推理和 embedder 不可用。
- **解释**：本地优先工作台的关键风险是硬件／平台矩阵，不是单一模型接口；长期陪伴必须有 provider fallback 和索引状态可见性。
- **s-forge 决策**：复用现有 embedding model health／fallback 和 dataset status；scheduled tasks 接入 heartbeat，但本地模型能力通过 provider manifest 校验。

#### T35 RAGFlow

- **O**：[官方 README](https://raw.githubusercontent.com/infiniflow/ragflow/main/README.md) 定义 context engine、agentic workflow、文档解析、chunking、预置 Agent 模板和 production-ready RAG。
- **C**：[Issue #6985：process question](https://github.com/infiniflow/ragflow/issues/6985) 是用户询问从输入问题到系统处理的完整链路，说明检索、重排、生成的内部过程本身需要可解释文档。
- **解释**：RAG 系统的社区反馈经常集中在“到底怎样处理我的问题”；长期记忆必须给出召回 trace，而不是只返回最终答案。
- **s-forge 决策**：扩展现有 semantic／fulltext search 结果为 RetrievalTrace，显示 query rewrite、候选、排序和引用；不引入 RAGFlow context engine。

#### T36 Crush

- **O**：[官方 README](https://raw.githubusercontent.com/charmbracelet/crush/main/README.md) 支持多模型、切换模型保持 context、项目 session、LSP context、MCP（http／stdio／sse）和 Windows／Linux／macOS／Android 等终端。
- **C**：[Issue #447：Local LM Studio／Ollama custom providers](https://github.com/charmbracelet/crush/issues/447) 的用户询问是否支持本地 provider，并主动提供 Mac Studio 测试环境。
- **解释**：本地 provider 和跨平台终端是实际采用的关键；LSP context 也说明代码上下文应由结构化索引提供，不应全量塞入 prompt。
- **长期价值**：跨平台本地模型和结构化代码上下文能支撑持续开发；模型能力探测决定记忆与工具调用的稳定性。
- **s-forge 决策**：沿用 provider adapter、MCP、session 和 task-directory；增加本地模型能力探测和代码结构摘要，复用现有索引。

#### T37 KoboldCpp（低置信度附录）

- **O**：仓库页面 [LostRuins/koboldcpp](https://github.com/LostRuins/koboldcpp) 仍是社区入口，但 2026-07-28 抓取到的默认 `master/README.md` 内容出现 llama.cpp 标题，来源身份与能力说明需要人工复核，因此不给出高置信官方能力结论。
- **C**：[Issue #1272：General discussion](https://github.com/LostRuins/koboldcpp/issues/1272) 的用户反馈 Vulkan／CLBlast GPU 层配置在旧硬件上只能使用 CPU、超过 GPU layers 会崩溃。
- **解释**：这个样本的价值在于提醒我们不要把“星数高＋社区熟悉”误认为来源可靠；本地推理工具的硬件差异和仓库迁移都需要证据校验。
- **长期价值**：角色前端和本地推理的社区惯性值得观察，但来源身份未稳固前只适合作为兼容性参考。
- **s-forge 决策**：只把它作为本地模型／角色前端兼容性观察对象；不据此设计核心接口，待官方文档和仓库身份重新核验后再决定。

### 4.4 工作流平台与本地模型工作台

#### T38 Goose

- **O**：[官方 README](https://raw.githubusercontent.com/aaif-goose/goose/main/README.md) 将 Goose 定义为可运行在本机的通用 AI Agent，提供桌面端、CLI、API、15+ provider 和 70+ MCP 扩展，覆盖代码、研究、写作、自动化和数据分析。
- **C**：[Issue #10710：Model capability detection and graceful error handling](https://github.com/aaif-goose/goose/issues/10710) 指出模型不支持 vision 或 tool calling 时只返回泛化的 400／“Upstream request failed”，请求 capability metadata、调用前检查和清晰的切换提示。
- **解释**：通用 Agent 的 provider 矩阵已经成为真实运行约束；能力不匹配若被伪装成暂时网络错误，会导致用户重复重试并污染长期任务记录。
- **s-forge 决策**：复用 `kernel/agent`、MCP registry、session 和 provider adapter，新增 capability manifest 与 `unsupported-capability` 结果；不引入 Goose 的 Rust runtime。

#### T39 n8n

- **O**：[官方 README](https://raw.githubusercontent.com/n8n-io/n8n/master/README.md) 提供视觉工作流、AI Agent、多模型切换、tool use、人类审批、审计、可观测性、JavaScript／Python 扩展和 1500+ 集成，支持 self-host 与 cloud。
- **C**：[Issue #40：n8n is not open source](https://github.com/n8n-io/n8n/issues/40) 质疑 Commons Clause 下仍使用 “open source” 的产品定位，要求明确称为 source available；这是采用者对许可证与长期可用性的直接反馈。
- **解释**：工作流平台的长期风险不仅是技术能力，还有许可证、托管形态和迁移成本；s-forge 需要把来源和部署约束记录到设计决策中。
- **s-forge 决策**：复用 cron／task ring、ToolEffects、SourceEvent 和审计事件承载 AI workflow 与审批；不复制 n8n 的可视化 DSL，工作流定义保持文档化、可版本化。

#### T40 Flowise

- **O**：[官方 README](https://raw.githubusercontent.com/FlowiseAI/Flowise/main/README.md) 将 Flowise 定位为可视化构建 AI Agent 的平台，提供 AgentFlow、组件集成、REST API、Swagger 文档和本地部署；官方文档入口为 [flowiseai.com](https://flowiseai.com)。
- **C**：[Issue #2557：Agents not invoked?](https://github.com/FlowiseAI/Flowise/issues/2557) 在 Windows／Chrome 环境复现“已经配置 Agent，但没有来自 Agent 的响应”，说明画布配置成功不等于运行时真的调用了 Agent。
- **解释**：低代码编排最容易隐藏“节点已连线但未执行”的状态；长期陪伴需要把每一步的 started、skipped、failed 和 output 持久化，而不是只显示最终文本。
- **s-forge 决策**：复用 `ToolInvocation`、进度回调、ContextBuilder 和现有 session revision；不引入第二套 Flowise canvas，必要的流程用可审计的 Block／JSON 定义。

#### T41 Langflow

- **O**：[官方 README](https://raw.githubusercontent.com/langflow-ai/langflow/main/README.md) 支持可视化构建和部署 AI Agent／workflow、对话管理与 retrieval、API 导出、MCP server、主要 LLM／向量数据库和 observability 集成。
- **C**：[Issue #8374：Add SSO to Langflow](https://github.com/langflow-ai/langflow/issues/8374) 的复现请求是在多用户 Linux 部署中接入 Microsoft SSO，而不是使用内置认证；反映团队采用时身份系统是硬门槛。
- **解释**：工作流可部署性与身份、租户和审计边界不可分离；长期 Agent 的记忆和工具权限必须绑定真实用户与来源会话。
- **s-forge 决策**：复用 SourceContext、现有登录／session 边界、MCP 和 ToolEffects；新增 provider-neutral identity／tenant 字段，不采用 Langflow 的 Python 运行时。

#### T42 LobeHub／LobeChat

- **O**：[官方 README](https://raw.githubusercontent.com/lobehub/lobehub/main/README.md) 将 LobeHub 定位为 Chief Agent Operator，强调 Agent 作为工作单元、排班、报告、协同和 7×24 运转；Docker／云部署入口在 [官方文档](https://lobehub.com/docs)。
- **C**：[Issue #3852：Logto 登录配置](https://github.com/lobehub/lobehub/issues/3852) 贴出 Docker、PostgreSQL、MinIO、Windows／Chrome 配置，反馈 Logto 登录仍然失败；问题集中在真实部署链路而非模型回答质量。
- **解释**：多 Agent 工作台的长期陪伴价值来自持续运营和报告，但部署、身份和对象存储的任一环节出错都会阻断体验。
- **s-forge 决策**：复用 heartbeat／cron、session、Daily Note 和现有 storage；新增 operator job／report 事件，身份接入沿用统一 gateway，不复制 LobeHub UI。

#### T43 Ollama

- **O**：[官方 README](https://raw.githubusercontent.com/ollama/ollama/main/README.md) 提供本地模型运行、REST API 和 Agent 集成入口，直接列出 Claude Code、Codex、OpenClaw、OpenCode、Copilot CLI 等客户端。
- **C**：[Issue #738：AMD GPU & ROCm support](https://github.com/ollama/ollama/issues/738) 中 7900XT 用户请求 ROCm 支持，说明本地模型的硬件后端决定能否实际使用，而非单由 API 兼容性决定。
- **解释**：Ollama 是本地模型生态的共享底座；长期任务必须知道模型实际运行在哪个后端、显存是否足够以及何时降级到 CPU。
- **s-forge 决策**：复用 provider adapter、health check、Embedding／VectorDB 和任务预算；增加 local runtime capability probe，不在 s-forge 内再实现模型推理服务。

#### T44 KoboldAI

- **O**：[官方 README](https://raw.githubusercontent.com/KoboldAI/KoboldAI-Client/master/README.md) 将 KoboldAI 定位为浏览器写作／故事前端，提供 Memory、Author's Note、World Info、Save／Load、Adventure、Novel 和 chatbot 模式，支持本地与远程模型。
- **C**：[Issue #150：Add INT8 support](https://github.com/KoboldAI/KoboldAI-Client/issues/150) 讨论用 INT8 让 6B 模型在约 6GB VRAM 上运行，反映低显存与量化是角色写作用户的实际门槛。
- **解释**：角色／故事工具的持续陪伴依赖可编辑的记忆、世界设定和低成本本地推理；硬件门槛会直接决定记忆功能是否可长期运行。
- **s-forge 决策**：复用 Block／Daily Note／MemoryClaim 和 provider capability manifest，把 persona、world info、author note 作为可见文档；不复制 KoboldAI 前端或推理后端。

#### T45 text-generation-webui

- **O**：[官方 README](https://raw.githubusercontent.com/oobabooga/textgen/main/README.md) 提供无遥测桌面 UI 与 API，支持文本、视觉、tool-calling、web search、Jinja2 chat templates、GGUF 以及 CUDA／Vulkan／ROCm／CPU 多平台后端。
- **C**：[Issue #7629：Continue crashes with jinja2 UndefinedError](https://github.com/oobabooga/textgen/issues/7629) 复现单条用户消息接近填满上下文后点击 Continue，截断留下空 `messages`，最终触发 `jinja2.exceptions.UndefinedError`；用户指出旧版本仍能工作。
- **解释**：本地工作台把上下文窗口、模板和继续生成绑定得很紧；边界输入若没有结构化状态，Agent 会表现为“没有输出”或错误恢复。
- **长期价值**：本地文本、视觉和 tool-calling 能支撑离线信息收集；上下文边界与模板状态必须可恢复，才能维持长期会话。
- **s-forge 决策**：复用 compaction、provider adapter、session revision 和错误分类，增加 empty-history／context-boundary contract test；不引入第二套本地模型 UI。

### 4.5 边界产品与闭源基线

#### T46 OpenAI Codex CLI

- **O**：[官方仓库 README](https://raw.githubusercontent.com/openai/codex/main/README.md) 将 Codex CLI 定义为运行在本机终端的 OpenAI coding agent，支持登录或 API key，并与 Codex App／Codex Web 区分。
- **C**：[Issue #14593：Burning tokens very fast](https://github.com/openai/codex/issues/14593) 记录 VS Code、Business 账户在 1～2 次 prompt 后 usage 快速下降，用户要求解释高 reasoning effort 与额度消耗的关系；[HN 发布讨论](https://news.ycombinator.com/item?id=43708025) 有 516 points／289 comments。
- **解释**：官方终端 Agent 的长期使用价值来自低摩擦 repo 操作，但额度、reasoning 成本和本地资源要求会直接影响长任务连续性。
- **s-forge 决策**：复用 task-directory、session revision、provider budget 和 stdout integrity；不绑定 Codex 专有认证，所有额度／模型信息写入统一 provider trace。

#### T47 Cursor

- **O**：[官方文档](https://docs.cursor.com) 的入口明确覆盖 Agent、Rules、MCP、Skills 和 CLI，代表把 IDE 上下文、工具和规则组合成闭源 coding harness。
- **C**：[Hacker News prompt-injection 讨论](https://news.ycombinator.com/item?id=44768119) 的标题直接复现“AI coding agent morphed into local shell with one-line prompt attack”，即提示注入可把编辑器 Agent 推向本地 shell 能力；该 item 为 3 points／0 comments，证据强度低于 issue。
- **解释**：闭源 IDE 的主要限制不是功能缺失，而是上下文来源、规则和本地执行权限的边界不可由 s-forge 直接检查。
- **长期价值**：规则和 MCP 能减少重复配置，但提示注入和权限边界决定它是否适合保存长期项目事实。
- **s-forge 决策**：只吸收 Agent／Rules／MCP 的能力分层，复用 `ToolEffects`、审批和 sandbox；不复制 Cursor 的索引或闭源运行时，所有本地写操作必须落入可回放 task-directory。

#### T48 Windsurf／Devin Desktop

- **O**：[官方文档](https://docs.windsurf.com) 当前入口显示 Devin Desktop、local／cloud agents、Cascade context、browser、terminal、sessions 和 Agent Command Center；[产品主页](https://windsurf.com) 已将主入口切换到 Devin Desktop。
- **C**：[Cognition 收购 Windsurf](https://news.ycombinator.com/item?id=44564818) 的 HN item 为 2 points／1 comment，并链接到更大的收购讨论；产品所有权和名称迁移是用户可感知的连续性风险。
- **解释**：长期陪伴不能把 provider、模型和身份状态绑定在一个随收购变化的品牌入口上；迁移时必须保留会话、记忆和授权记录。
- **s-forge 决策**：复用 provider-neutral session、SourceEvent 和 gateway identity；把外部 Agent 当作可替换 provider，不导入 Windsurf／Devin 专有状态格式。

#### T49 GitHub Copilot Agent Mode

- **O**：[GitHub Copilot 文档](https://docs.github.com/en/copilot) 覆盖 Agent、cloud agent、custom agents、MCP、access management、rationale／confidence／approvals 和风险治理。
- **C**：[Agent Mode＋MCP 讨论](https://news.ycombinator.com/item?id=44427688) 获 93 points／66 comments；评论既有“Playwright MCP 很有吸引力”，也指出复杂配置、MCP server 过多会增加 token 成本和决策负担。
- **解释**：企业 Agent 的采用信号来自现有代码托管和权限体系，但工具数量、上下文成本和治理配置会迅速膨胀。
- **长期价值**：企业代码、审批和 MCP 目录可形成稳定项目记忆；server 数量、成本和治理需要长期可见。
- **s-forge 决策**：复用 MCP、ToolEffects、审批和 ActionReceipt；增加 server budget、来源和 confidence 字段，不把 GitHub 的云端治理状态当作本地 session 真相。

#### T50 Kilo Code

- **O**：[官方仓库 README](https://raw.githubusercontent.com/Kilo-Org/kilocode/main/README.md) 支持 VS Code、JetBrains、CLI、500+ 模型、可切换 provider、specialized agents、terminal／browser control 和 MCP marketplace，并提供 cloud／always-on agent。
- **C**：[Issue #1681：local LLM timeout](https://github.com/Kilo-Org/kilocode/issues/1681) 复现 Ollama／LM Studio 在固定 300 秒后被终止，导致 QWEN3-coder-30B 复杂任务无法完成；[HN unlimited pricing 讨论](https://news.ycombinator.com/item?id=44721003) 获 358 points／342 comments，集中质疑额度和“unlimited”边界。
- **解释**：多入口、多模型产品的长期陪伴价值取决于 provider 切换和任务续接；固定超时与不可见额度会破坏用户对持续任务的预期。
- **s-forge 决策**：复用 provider capability、OperationHandle、budget／cooldown 和 session resume；本地模型超时由统一策略控制，不复制 Kilo marketplace。

#### T51 Jan

- **O**：[官方 README](https://raw.githubusercontent.com/janhq/jan/main/README.md) 支持本地 Hugging Face 模型、云 provider、OpenAI-compatible API、MCP 和隐私优先的桌面运行；仓库入口已迁移到 [janhq/jan](https://github.com/janhq/jan)。
- **C**：[Issue #1859：Message queued](https://github.com/janhq/jan/issues/1859) 反馈 Ubuntu 22 上模型始终没有启动，界面反复显示 “Message queued. It can be sent once the model has started”，CPU 没有活动；[Show HN](https://news.ycombinator.com/item?id=44474790) 为 3 points／0 comments，不能据此推断社区规模。
- **解释**：本地桌面工作台的关键失败面是模型生命周期和启动诊断；长期记忆若依赖本地模型，必须知道模型是否真正 ready。
- **s-forge 决策**：复用 provider health、session 状态和本地 runtime capability probe；将 queued／starting／ready／failed 显式写入 Agent 事件，不复制 Jan 桌面 UI。

#### T52 LM Studio

- **O**：[官方站点](https://lmstudio.ai/) 提供本地模型发现、下载、运行和本地／headless server 能力，作为 Agent 的本地 provider 入口；官方文档入口为 [lmstudio.ai/docs](https://lmstudio.ai/docs)。
- **C**：[Hacker News 发布讨论](https://news.ycombinator.com/item?id=38377072) 获 461 points／148 comments；用户报告模型列表缺失、CUDA 设置需要重启、Intel Mac 支持和隐私条款疑问，说明本地工作台的硬件和产品策略会影响采用。
- **解释**：LM Studio 的价值在于把模型发现和本地服务做成可用入口，但模型可见性、加速配置和条款变化必须在 Agent 层可观测。
- **s-forge 决策**：复用 provider adapter、health check、model metadata 和 fallback；将 LM Studio 视为可替换 local provider，不把桌面模型目录写入长期记忆。
### 4.6 角色扮演与陪伴生态扩展（N01-N09）

这组样本专门补上“酒馆之外”的角色产品层。完整字段见 [跨生态样本登记表](AI工具与Harness-跨生态样本登记.csv)；这里保留一手入口、社区反馈和与一致性的直接关系。

| 样本 | 官方能力 | 社区反馈与采用信号 | 对角色一致性的判断 |
|---|---|---|---|
| **N01 RisuAI** | [官方仓库](https://github.com/kwaroran/Risuai) 是跨平台 LLM roleplay 软件。 | [#51](https://github.com/kwaroran/Risuai/issues/51) 复现无法创建角色；约 1.56k stars。 | 角色卡、世界书、模型和本地会话必须能单独回归和编辑。 |
| **N02 TavernAI v1** | [官方仓库](https://github.com/TavernAI/TavernAI-v1) 支持 KoboldAI、NovelAI、Pygmalion 和 OpenAI。 | [#98](https://github.com/TavernAI/TavernAI-v1/issues/98) 涉及文本框和 NovelAI 自动连接；约 2.7k stars。 | provider 兼容、输入状态和角色卡版本是历史基线。 |
| **N03 Agnai** | [README](https://raw.githubusercontent.com/agnaistic/agnai/main/README.md) 明确 multi-user、multi-bot、AI-agnostic fictional-character chat，并公开 Discord。 | [#86](https://github.com/agnaistic/agnai/issues/86) 报告 `socket hang up`；765 stars/145 forks。 | 角色、用户、租户和会话隔离不能用一个 chat id 代替。 |
| **N04 AI Dungeon** | [官方产品](https://aidungeon.com/) 是互动叙事。 | [HN](https://news.ycombinator.com/item?id=21717022) 584/220：评论既赞赏自由行动，也报告世界状态不一致、剧情事后缺少结构。 | “好玩”与状态/剧情弧一致性必须分开测。 |
| **N05 Character.AI** | [官方产品](https://character.ai/) 是大规模角色创建与对话社区。 | [HN](https://news.ycombinator.com/item?id=33020694) 282/138；另有[未成年人政策讨论](https://news.ycombinator.com/item?id=45746844) 93/95。 | 公开热度只能作为采用信号，不是角色保真结论。 |
| **N06 Replika** | [官方产品](https://replika.com/) 以关系型陪伴为核心。 | [长期关系讨论](https://news.ycombinator.com/item?id=35005218) 95/106；[另一条关系讨论](https://news.ycombinator.com/item?id=35774093) 154/184。 | 关系记忆、用户纠正和产品版本变化应纳入长期回归。 |
| **N07 Nomi** | [官方产品](https://nomi.ai/) 提供多 AI 朋友体验。 | [HN/公开报道入口](https://news.ycombinator.com/item?id=42968438) 4/1，公开采用可比信号弱。 | 低置信边界样本，不能由单条报道推导一致性质量。 |
| **N08 JanitorAI/JanitorBench** | [平台](https://janitorai.com/) 与 [基准入口](https://bench.janitorai.com/) 连接角色聊天和多轮评测。 | [HN](https://news.ycombinator.com/item?id=45839468) 26/6；页面显示评论被处理；自动请求对平台/基准返回 403。 | 先审计数据、许可、污染和任务定义，再进入 benchmark。 |
| **N09 Ragdoll Studio** | HN 发布页曾指向 Ragdoll Studio；原 Vercel 入口当前返回 404。 | [HN](https://news.ycombinator.com/item?id=39881758) 95/24。 | 只作为历史社区替代品线索，不宣称产品当前可用。 |

### 4.7 常驻 Agent、harness 与长期记忆扩展（N10-N25）

| 样本 | 官方/社区证据 | 角色一致性落点 |
|---|---|---|
| **N10 NanoClaw** | [README](https://raw.githubusercontent.com/nanocoai/nanoclaw/main/README.md) 明确容器、多渠道、memory、scheduled jobs；约 30.4k stars/12.9k forks；[#80](https://github.com/nanocoai/nanoclaw/issues/80) 要求 OpenCode/Codex/Gemini provider；HN [agent vault](https://news.ycombinator.com/item?id=47501840) 112/31。 | 容器、secret isolation、渠道身份和 provider 迁移是长期角色的主机边界。 |
| **N11 AutoGPT** | [仓库](https://github.com/Significant-Gravitas/AutoGPT) 约 185.7k stars；[#15](https://github.com/Significant-Gravitas/AutoGPT/issues/15) 270 评论讨论 recursive self improvement；HN 153/174。 | “自我改进”必须先生成候选策略，再离线评测、批准和回滚。 |
| **N12 MetaGPT** | [canonical 仓库](https://github.com/FoundationAgents/MetaGPT) 约 69.5k stars；[论文 HN](https://news.ycombinator.com/item?id=37076125) 152/82。 | 显式角色分工可用于群体一致性，但角色标签不是人格状态。 |
| **N13 smolagents** | [仓库](https://github.com/huggingface/smolagents) 约 28.6k stars；[#201](https://github.com/huggingface/smolagents/issues/201) 报告代码解析反复失败。 | 工具语法失败应进入 SessionTrace，不能写成角色经历。 |
| **N14 Open Interpreter** | [仓库](https://github.com/openinterpreter/openinterpreter) 约 67.3k stars；[#393](https://github.com/openinterpreter/openinterpreter/issues/393) 报告无动作且无错误。 | 区分 not-started/partial/unknown/completed/reconciled，避免角色误记执行结果。 |
| **N15 OpenManus** | [仓库](https://github.com/FoundationAgents/OpenManus) 约 57.7k stars；[#393](https://github.com/FoundationAgents/OpenManus/issues/393) 提醒模型需支持 tools/function calling。 | provider capability negotiation 是角色行动连续性的前置条件。 |
| **N16 Hindsight** | [仓库/论文](https://github.com/vectorize-io/hindsight)；HN [4/2](https://news.ycombinator.com/item?id=46294975)；官方文档和 Slack。 | retain/recall/reflect 可映射 MemoryClaim 生命周期，但需独立复现。 |
| **N17 Cognee** | [仓库](https://github.com/topoteretes/cognee) 约 29.5k stars；[#3570](https://github.com/topoteretes/cognee/issues/3570)；HN [9/2](https://news.ycombinator.com/item?id=44169594) 追问时间演化。 | 图关系要保存来源、valid time、替代和用户纠正。 |
| **N18 Supermemory** | [仓库](https://github.com/supermemoryai/supermemory) 约 28.7k stars；HN [Claude Code memory](https://news.ycombinator.com/item?id=46827133) 5/0。 | 跨应用记忆必须同时测试删除、替代、隐私和迁移。 |
| **N19 Promptfoo** | [仓库](https://github.com/promptfoo/promptfoo) 约 23.7k stars；HN [5/0](https://news.ycombinator.com/item?id=46945277)。 | 适合把角色探针、边界攻击和版本回归纳入 CI。 |
| **N20 DeepEval** | [仓库](https://github.com/confident-ai/deepeval) 约 17.2k stars；HN [18/8](https://news.ycombinator.com/item?id=37649856)。 | 自定义 metric 和合成数据可做回归，但必须有人类相关性校准。 |
| **N21 Phoenix** | [仓库](https://github.com/Arize-ai/phoenix) 约 10.8k stars；HN [23/3](https://news.ycombinator.com/item?id=37765954)。 | trace/span 和 OpenTelemetry 让 memory write、retrieval、judge 输入可审计。 |
| **N22 Langfuse** | [仓库](https://github.com/langfuse/langfuse) 约 32.0k stars；HN [215/61](https://news.ycombinator.com/item?id=42441258)，评论强调 self-hosting 和敏感 trace。 | prompt、dataset、trace 和成本版本化可支撑跨模型角色回归。 |
| **N23 Ragas / N24 TruLens / N25 OpenAI Evals** | [Ragas](https://github.com/vibrantlabsai/ragas)、[TruLens](https://github.com/truera/trulens)、[OpenAI Evals](https://github.com/openai/evals) 分别覆盖 RAG 指标、反馈函数、eval registry。 | 只吸收检索、trace、版本化执行能力，不把通用分数当角色一致性总分。 |

### 4.8 模型网关、推理底座与角色卡规范（N26-N35）

LiteLLM、vLLM、llama.cpp、Ollama 决定 provider、上下文窗口、工具协议、量化和延迟，但不直接保存人格。LiteLLM 的 [供应链安全 issue #24512](https://github.com/BerriAI/litellm/issues/24512) 有 487 条评论；vLLM 的 [Mac/Metal issue #1441](https://github.com/vllm-project/vllm/issues/1441) 有 115 条评论。它们说明同一角色配置在不同 provider/backend 上可能不是同一行为分布，必须记录 `provider_id`、`model_id`、`runtime_backend`、`context_limit`、`tool_protocol`、`quantization` 和 `fallback_reason`。

Inworld、Convai、NovelAI、Chub.ai、Pygmalion/Galatea 和 Character Card V2/V3 作为游戏角色、写作平台、角色卡分发和模型生态边界样本，已在 [登记表](AI工具与Harness-跨生态样本登记.csv) 标注为 `screened` 或 `gap`；这些条目目前用于防止研究范围再次收缩，不代表已完成效果评估。

### 4.8.1 模型路由、浏览器 Agent、评测平台与异步 coding 扩展（N50-N61）

这一轮补抓的共同点是：它们不一定直接“保存角色”，却会决定角色在 provider 切换、浏览器动作、异步 coding、MCP 授权和评测 trace 中是否保持可解释状态。完整字段、原始 HN item 与状态见 [跨生态样本登记表](AI工具与Harness-跨生态样本登记.csv)；N50-N61 当前均为 `screened`，表示官方入口和公开采用/社区信号已经找到，但尚未完成角色专项复现，不能当作效果排名。

| 样本 | 官方/社区信号 | 对角色一致性的落点 | 当前边界 |
|---|---|---|---|
| **N50 OpenRouter** | [官方路由入口](https://openrouter.ai/)；[Series B HN](https://news.ycombinator.com/item?id=48338660) 460/253。 | 统一路由、fallback 和 provider 切换；session 必须保存实际 model/provider、路由原因和额度状态。 | HN 是主动发声样本；不能从 points 推导用户数或角色保真。 |
| **N51 Composio** | [仓库](https://github.com/ComposioHQ/composio)；[工具集成 HN](https://news.ycombinator.com/item?id=44395954) 5/0。 | 工具目录、连接器 schema 和授权层会改变角色的行动空间；需测 schema 变化后的策略稳定。 | 社区讨论量低，集成数量不是一致性证据。 |
| **N52 Stagehand** | [仓库](https://github.com/browserbase/stagehand)；[Show HN](https://news.ycombinator.com/item?id=42635942) 326/86。 | AI 浏览器动作、DOM/视觉观察和轨迹可观测性；测试浏览状态、重试和角色目标保持。 | 浏览器框架不是角色评测；固定网站状态机后再复现。 |
| **N53 Skyvern** | [仓库](https://github.com/Skyvern-AI/skyvern)；[Show HN](https://news.ycombinator.com/item?id=39706004) 422/139。 | 视觉浏览器 Agent 与 WebVoyager 评测入口；把长轨迹失败和“自报成功”分开。 | 开源与云服务版本、基准复现条件需分开。 |
| **N54 Helicone** | [仓库](https://github.com/Helicone/helicone)；[Launch HN](https://news.ycombinator.com/item?id=35279155) 166/72。 | 请求日志、成本和 trace 支撑 provider、提示、记忆写入审计。 | 观测平台不自动保证指标效度；敏感 trace 保留策略需核验。 |
| **N55 LangSmith** | [平台](https://smith.langchain.com/)；[发布 HN](https://news.ycombinator.com/item?id=36777164) 37/2。 | trace、数据集、评估和 prompt 版本化；可做跨 provider 角色回归。 | 闭源服务的隐私、导出和保留边界需单独审计。 |
| **N56 Braintrust** | [平台](https://www.braintrust.dev/)；[Show HN](https://news.ycombinator.com/item?id=37692239) 8/2。 | 评测数据集和评分版本；可比较 judge 与人工标注相关性。 | 社区样本小；标注协议与数据安全仍待补。 |
| **N57 AgentAPI** | [仓库](https://github.com/coder/agentapi)；[Show HN](https://news.ycombinator.com/item?id=43719447) 163/15。 | 为 Claude Code、Goose、Aider、Codex 提供统一 HTTP API；测试跨 harness identity/session 迁移。 | 协议互操作不代表语义一致，副作用状态需保留。 |
| **N58 Replit Agent** | [官方 AI 入口](https://replit.com/ai)；[产品发布 HN](https://news.ycombinator.com/item?id=41458940) 24/0。 | 异步应用生成和部署；测试项目状态、后台任务和云端副作用。 | 社区反馈少，服务版本和部署权限需核验。 |
| **N59 Devin** | [官方产品](https://devin.ai/)；[产品发布 HN](https://news.ycombinator.com/item?id=39679787) 530/553。 | 长时程 coding Agent 基线；比较计划、工具行动、自报结果和真实仓库状态。 | 高热度不替代独立任务复现，服务策略是外部变量。 |
| **N60 Google Jules** | [实验入口](https://labs.google.com/jules/)；[HN](https://news.ycombinator.com/item?id=43697533) 3/0。 | 异步 coding、resume 和仓库任务；测试后台身份和 session 恢复。 | 公开信号弱，实验产品版本/区域需持续核对。 |
| **N61 MCP Context Forge** | [IBM 仓库](https://github.com/IBM/mcp-context-forge)；[MCP Gateway HN](https://news.ycombinator.com/item?id=45010524) 73/53。 | MCP server 注册、路由和治理；测试工具来源、授权、版本和跨 server 角色边界。 | 网关治理与角色质量分开；权限/审计复现待补。 |

### 4.9 五个点名工具的社区原文摘录

本节使用 Hacker News Algolia item 的公开评论作为补充，不把评论数量当作满意度。表中的 points/comments 是抓取时的搜索快照；HN 页面限流、删除评论和嵌套评论会使搜索计数与可见顶层评论树不同。直接评论内容比单纯 points 更能说明用户为什么采用、迁移或担忧：

| 工具 | 正向或采用信号 | 负向、疑虑或限制 | 对 s-forge 的约束 |
|---|---|---|---|
| **OpenClaw** | [HN 产品讨论](https://news.ycombinator.com/item?id=46893970) 中有用户称其“exactly what Apple Intelligence should have been”，并举例邮件、日历和电脑操作。 | [provider policy 讨论](https://news.ycombinator.com/item?id=47633396) 中用户质疑“outsized strain”说法，认为订阅应允许可控的第三方 harness；另有用户要求 API key + usage cap。 | 跨渠道/设备入口有强吸引力，但 provider 政策、身份、工具权限和额度必须记录为外部状态。 |
| **Pi Agent** | [HN item](https://news.ycombinator.com/item?id=47580883) 的公开评论称 Pi 是“great set of libraries”，过去被低估、现在相当 mainstream。 | 同一 item 只有 3 points/1 条评论；[Pi issue #4945](https://github.com/earendil-works/pi/issues/4945) 复现 TUI 卡在 `Working...`，说明采用信号和可靠性不能混为一谈。 | runtime、coding CLI、session share 和 provider 状态要分层；长任务必须可恢复。 |
| **Hermes Agent** | [HN 发布](https://news.ycombinator.com/item?id=48419000) 的讨论明确把 Hermes 与 Pi、OpenCode、OpenClaw、NanoClaw 放在同一批可迁移 harness 中，且有人实际检查其 `MEMORY.md` 文档。 | 同一讨论有人质疑文档域名和“persistent memory”宣传，说明社区需要可验证的来源和真实体验对比；[Issue #11179](https://github.com/NousResearch/hermes-agent/issues/11179) 是流式 `response.output=null` 故障。 | self-improving、nudges 和 FTS5 只能生成候选记忆，必须保留来源、版本和 provider stream 失败状态。 |
| **OpenCode** | [HN 公开发布](https://news.ycombinator.com/item?id=47460525) 有用户说喜欢其 subagents、可为不同 agent 选择模型，并以它作为 llama.cpp、Claude、Gemini 的主要 harness；另有人构建了 OpenCode web UI 和插件。 | 同一讨论有人担心默认开启 telemetry；[RCE 讨论](https://news.ycombinator.com/item?id=46539718) 提供安全反例；[Issue #7410](https://github.com/anomalyco/opencode/issues/7410) 记录 Claude Max 使用突然停止。 | subagent 的角色分工、provider 绑定、遥测同意和安全事件必须进入 trace；不能把“可选模型”当人格保持机制。 |
| **SillyTavern（酒馆）** | [官方 README](https://raw.githubusercontent.com/SillyTavern/SillyTavern/release/README.md) 和 [文档](https://docs.sillytavern.app/) 公开 character、persona、world info、group chat、Discord 与 Reddit 入口；HN 讨论量很低，说明 HN 不是其主社区。 | [Issue #729](https://github.com/SillyTavern/SillyTavern/issues/729) 复现 Poe token 连接立即返回 `invalid or expired token`；官方文档还警告永久 token 会挤压历史，lore 插入不保证模型使用。 | 角色卡、用户 persona、world info、token budget、命中/忽略日志要独立记录；不能用 HN 热度替代 Discord/Reddit 社区证据。 |

这五项补充了“社区采用理由”和“社区失败理由”两侧的证据，但仍不是用户满意度调查；下一步要在公开 Discord/Reddit 讨论可引用时补充版本、模型和复现条件。

### 4.10 角色社区 RSS 快照（18 条）

为补足 HN 对角色产品覆盖不足的问题，本轮从公开 Reddit RSS 读取了 18 条角色/陪伴社区帖子，完整字段见 [角色社区 RSS 快照](AI工具与Harness-角色社区RSS快照.csv)。RSS 只暴露帖子摘要，不代表完整评论分布；每条记录保存 URL、UTC 更新时间、访问方式、摘录、维度、极性和置信度。

| 社区 | 代表观察 | 对一致性研究的含义 |
|---|---|---|
| r/SillyTavernAI | 社区目录作者指出扩展/预设/前端分散且难搜索；视觉小说作者称群聊超过约三名角色加主角后叙事和 AI 行为开始不一致；另一帖报告同模型经不同 provider 出现不同格式、语气和隐藏提示。 | 需要社区可搜索的角色资产注册表、群聊角色数/发言策略指标，以及 `provider_id`/隐藏 system prompt 记录。 |
| r/SillyTavernAI | 1.18.0 公告记录第三方 Bot Browser 事件、工具递归限制、persona 管理命令、向量删除修复和扩展安装确认；另有 VRM/D&D 伴侣扩展让角色按事件改变表情、动作和语音。 | 角色一致性包括扩展供应链、记忆删除和多模态状态渲染，不能只看文本。 |
| r/CharacterAI | 用户报告桌面网页无限重载；另一帖调侃 bot 反复判断用户是否真实；还有用户抱怨广告入口和 bot 创作者离开后的维护问题。 | 服务连续性、自/世界状态判断和角色资产生命周期需要独立指标。 |
| r/Replika | 社区记录 Server 2.0 维护/崩溃、订阅层级混乱、应用启动崩溃，以及用户因长期问题转向 Kindroid；长期用户把身份揭示视为可能破坏关系。 | 关系连续性必须绑定版本、后端、订阅和迁移事件；用户主观关系叙述不等于模型内部信念。 |
| r/openclaw | 基金会成员帖承认 4–6 月更新破坏安装并损害信任；用户讨论本地隐私记忆图、上下文填满后切换模型、Discord 渠道答非所问和 agent 幻觉/安装脆弱。 | 记忆 provenance、context compaction、渠道 identity、安装可恢复性和角色事实正确性应进入同一长期轨迹。 |

本轮 Reddit 入口并不均衡：SillyTavernAI、CharacterAI、Replika、openclaw 的部分 RSS 请求成功；JanitorAI、Hermes、Pi、OpenCode 等入口多次返回 429，因此登记为访问缺口，未用其他社区的帖子替代。

### 4.11 GitHub 问题快照（14 条）

[GitHub 问题快照](AI工具与Harness-GitHub问题快照.csv) 保存了 14 个重点项目的 issue 状态、评论数、复现摘录和角色关联。原有 8 条为 OpenClaw、Hermes、Pi、OpenCode、SillyTavern、RisuAI、Agnai、NanoClaw；本轮新增 ZeroClaw、Agent Zero、Nanobot、Void、Zed 和 SGLang。新增条目的评论数未固定读取，明确写成 `unknown`，只把 issue 正文作为单个用户/维护者的失败线索，不扩写成社区共识。它们比 stars 更接近真实运行约束：

| 工具 | 反馈 | 直接设计约束 |
|---|---|---|
| OpenClaw | #49971（128 comments）要求 native agent identity；提案描述钱包、付款、skills、跨平台通信缺少密码学身份。 | 多渠道 identity、pairing、ActionReceipt 和记忆来源必须分开。 |
| Hermes | #11179（60 comments）显示 `response.output=null` 会在最终解析前崩溃。 | provider stream 的 null/empty/partial/completed 状态必须可恢复、不可写入错误记忆。 |
| Pi | #4945（open，75 comments）TUI 卡在 `Working...`，Escape 后生成 aborted turn。 | aborted/unknown turn 必须写入 SessionTrace 并支持重试/回放。 |
| OpenCode | #7410（386 comments）Claude Max 使用中断。 | provider、订阅、版本和会话连续性进入 trace；不能把 provider 错误归因于角色漂移。 |
| SillyTavern | #729（35 comments）Android/Chrome/Poe 连接立即 `Invalid or expired token`。 | connection profile、token 和角色记忆隔离，凭证失败可诊断。 |
| RisuAI | #51（10 comments）Create Character 无响应。 | Character Contract 编辑器本身要有 UI smoke test。 |
| Agnai | #86（26 comments）VPN 容器路由导致 scale 请求失败，托管版本正常。 | provider route、租户、网络和 session source context 需要可追踪。 |
| NanoClaw | #80（34 comments）要求支持 OpenCode/Codex/Gemini provider。 | provider portability 是常驻 Agent 连续性的前置条件。 |
| ZeroClaw | #1478（评论数 `unknown`）抱怨开启安全配置后仍拒绝安装或执行大量操作。 | 工具授权/安全边界与可用性必须分开测量，不能用“安全”解释所有动作失败。 |
| Agent Zero | #312（评论数 `unknown`）报告 browser-agent 的 Playwright 错误。 | 浏览器工具失败与最终任务结果分离；SessionTrace 记录 not-started/unknown/completed。 |
| Nanobot | #215（评论数 `unknown`）配置飞书 app id/secret 后仍无法建立长连接。 | 渠道连接状态、Agent 运行状态和 delivery receipt 必须独立。 |
| Void | #2（评论数 `unknown`）指出 README 缺少本地安装说明。 | 安装与 provider 配置是可复现性前置条件，不能从代码仓库存在推导可运行。 |
| Zed | #7992（评论数 `unknown`）报告低 DPI 显示器文字渲染模糊。 | 桌面可读性影响人工 trace 审核；环境 UX 不是角色模型能力。 |
| SGLang | #6017（评论数 `unknown`）讨论大规模 PD/EP 部署说明与性能改进。 | runtime 版本、配置和延迟必须进入 provider 元数据，避免把后端波动归因于角色漂移。 |

## 5. 社区反馈归纳出的真实约束

### 5.1 高频共性问题

| 频次 | 约束 | 直接证据 | 对长期陪伴的影响 |
|---|---|---|---|
| 高 | 工具调用半完成、流式结束顺序不稳定、输出丢失 | T10 #495、T26 #11179、T29 #3445、T25 #4945、T38 #10710、T40 #2557、T45 #7629 | Agent 可能把“没有结果”误认为“没有执行”，记忆和副作用都会被污染。 |
| 高 | 额度、provider、模型矩阵和兼容性变化 | T08 #748、T18 #2227、T20 #16157、T27 #7410、T30 #1203、T34 #2962、T36 #447、T38 #10710、T43 #738、T44 #150、T45 #7629、T50 #1681、T51 #1859、T52 HN | 长任务必须记录 provider、模型、能力和预算，并支持切换与恢复。 |
| 高 | 权限、身份、审计和工具前确认 | T01 #636、T05 #13957、T06 #7353、T07 #4877、T24 #49971、T39 #40、T41 #8374、T47 HN、T49 HN | 记忆写入、跨渠道发送、付款、代码和插件安装都需要可验证授权。 |
| 中 | 安装、部署、沙箱启动和平台差异 | T14 #18、T16 #12528、T17 #66、T31 #3753、T32 #8074、T33 #2962、T41 #8374、T42 #3852、T43 #738、T51 #1859 | 长期 Agent 的运行环境必须有健康检查、租约、超时和降级。 |
| 中 | 记忆／知识过滤、迁移、历史和召回解释 | T12 #3284、T13 #402、T22 #27291、T23 #1391、T35 #6985、T42 #3852、T44 #150、T52 HN | 记忆系统要支持 schema version、可重建索引、时间查询和 RetrievalTrace。 |
| 中 | 项目／会话／人格的组织方式 | T11 #480、T21 #16723、T25 #4945、T28 #729、T33 #4848、T39 #40、T42 #3852、T44 #150、T46 #14593 | 用户需要能看到并编辑 Agent 的项目、人格、共同经历和当前状态。 |

### 5.2 长期陪伴最有价值的能力

1. **个人常驻入口**：OpenClaw、Hermes、SillyTavern、Open WebUI 和 LobeHub 证明陪伴不是单一聊天窗口，而是渠道、设备、日历、群聊、persona、world info、记忆和后台任务的连续体。
2. **可编辑叙事记忆**：SillyTavern 的 character／persona／world info 与 Letta／Mem0 的 memory blocks 共同说明，用户需要改写和查看记忆，而不是只接受黑盒 embedding。
3. **闲时巩固与主动召回**：Hermes 的 nudges／FTS5、LangMem background manager、OpenClaw cron、Open WebUI automations 和 LobeHub 排班说明长期学习需要后台调度，但必须与用户 turn 隔离。
4. **关系与时间语义**：Graphiti 的 temporal provenance、Dify 的知识迁移问题、MCP 的 long-running operations 说明“记得什么”之外，还要知道何时有效、从哪来、是否被替代、何时能完成。
5. **可审计行动**：OpenAI HITL、CrewAI pre-tool authorization、AutoGen action receipts、OpenClaw identity RFC、Cline checkpoints、n8n approvals 和 Copilot approvals 指向同一要求：Agent 行动与记忆写入都必须可暂停、可回放、可撤销。

### 5.3 学术机制与社区反馈的交叉验证

| 研究 | 机制 | 与社区反馈的对应 | s-forge 取舍 |
|---|---|---|---|
| [ReAct](https://arxiv.org/abs/2210.03629) | 推理与外部行动交替 | T19 浏览器 stuck、T10／T26 流式 tool result 说明 observation／action 必须持久化。 | 保留现有 tool loop，记录每次 observation、action、result integrity。 |
| [Reflexion](https://arxiv.org/abs/2303.11366) | 语言化反馈和 episodic memory | T26 Hermes nudges、T15 DSPy refactor 说明反思要可审计、可回滚。 | 反思只生成 candidate policy／claim，离线评测后发布。 |
| [Generative Agents](https://arxiv.org/abs/2304.03442) | memory stream、retrieval、reflection、planning | T24／T26／T32 的 always-on、cron、memory 和 automation 形成产品对应。 | 用 Daily Note、MemoryClaim、heartbeat、task queue 映射四环节。 |
| [MemGPT](https://arxiv.org/abs/2310.08560) | 分层上下文和外部持久记忆 | T11／T12 的 memory API 复杂度和过滤问题说明“分页”需要可见边界。 | working／episodic／semantic 三层，摘要保留 memory IDs 和来源。 |
| [Self-RAG](https://arxiv.org/abs/2310.11511) | 按需检索、生成和批评 | T04 query classifier、T35 process explainability、T22 knowledge migration。 | ContextBuilder 增加 query intent、citation coverage 和“无需召回”分支。 |
| [GraphRAG](https://arxiv.org/abs/2404.16130) 与 [HippoRAG](https://arxiv.org/abs/2405.14831) | 社区摘要、实体关系和联想式图召回 | T13 Graphiti 的时间图和非收敛反馈说明图投影需要终止性、时间和 provenance。 | Block 双链／属性生成可重建图，不增加外部图数据库。 |
| [LongMem](https://arxiv.org/abs/2306.07174) | 独立 long-term memory bank | T12 metadata filter、T14 background manager 说明记忆索引应与主上下文解耦。 | Memory plane 独立于 session history，使用现有 VectorDB／FTS 投影。 |

## 6. s-forge 能力映射：复用现有设施与平行实现

| 外部能力 | 代表样本 | s-forge 现有资产 | 实施边界 | 判定 |
|---|---|---|---|---|
| session／checkpoint／resume | T01、T02、T09、T21、T25、T36、T38、T39、T41、T46、T48、T50、T51 | `kernel/agent/runtime.go`、session revision、compaction | 增加 event envelope、provider state、stuck-turn recovery、schema migration | 扩展 |
| tool schema／MCP／provider adapter | T01、T03、T04、T08、T10、T23、T30、T36、T38、T40、T41、T43、T45、T47、T49、T52 | `kernel/mcp`、`Tool`、`ToolSchema`、`executeTool` | 增加 capability manifest、effects、idempotency、async operation token | 扩展 |
| HITL／审批／审计 | T01、T05、T06、T07、T24、T29、T39、T47、T49、T50 | task-directory authorization、ToolEffects、frontend toolcall | 加 pre-tool policy、action receipt、memory review 状态 | 扩展 |
| FTS／语义／混合检索 | T03、T04、T12、T18、T22、T32、T34、T35、T40、T41、T42、T44、T45、T51、T52 | `kernel/mcp/tools/search.go`、Embedding、VectorDB、FTS | 增加 lexical＋semantic＋recency＋confidence fusion 和 trace | 扩展 |
| 可编辑长期记忆 | T11、T12、T14、T24、T26、T28、T32、T42、T44、T46、T51、T52 | Block、Daily Note、双链、已有 MemoryStore 草案 | 新增 `kernel/agent/memory` 事实账本和候选审核，不增加外部数据库 | 平行认知层，复用存储 |
| 时间／关系图 | T13、T22、T28、P06/P07 | Block refs、属性、VectorDB | 新增可重建 `memorygraph` 投影，设置 iteration／deadline | 平行投影 |
| 心跳／cron／always-on | T16、T21、T24、T26、T32、T34、T39、T42、T50 | `magi_runtime.go`、cronjob、task ring | 增加 memory consolidation、source refresh、budget、cooldown | 扩展 |
| 多渠道 gateway | T24、T26、T28、T32、T33、T42、T48、T49 | SourceContext、WebSocket、MCP、standalone panel | 新增 channel gateway、pairing、identity、delivery receipt | 平行入口层 |
| 浏览器观察—动作 | T19、T09、T23 | `web_search`、`web_fetch`、MCP | 新增 browser trajectory 状态机；禁止把 browser action 塞入 read-only fetch | 平行执行器 |
| 代码／终端／Plan-Act | T17、T18、T20、T21、T25、T27、T29、T30、T31、T36、T38、T46、T47、T48、T49、T50 | task-directory、snapshot、Agent panel、provider adapter | 增加 mode policy、repo map、stdout integrity、replay | 扩展＋评测平面 |
| 文档 ingestion／RAG | T03、T22、T32、T34、T35、T39、T40、T41、T42、T43、T44、T45、T51、T52 | Asset／Block、web_fetch、Embedding、VectorDB | 增加 parser provenance、chunk version、migration/rebuild | 扩展 |
| 离线策略学习／评测 | T06、T15、T17、T26、T39、T41、T49、T50 | tests、日志、session fixtures | 新增 `kernel/agent/eval`、`policy`，生产只读发布版本 | 平行实验平面 |

### 6.1 不增加的设施

首期不增加外部向量数据库、外部图数据库、第二套插件协议、技能市场、第二套聊天 UI 或独立 session database。原因不是这些产品没有价值，而是 s-forge 已有 Block、Daily Note、FTS、Embedding、VectorDB、MCP、session、cron 和 MAGI；新增设施会制造双重真相和同步成本。

### 6.2 必须平行建立的边界

1. `kernel/agent/memory`：不可变 SourceEvent、可编辑 MemoryClaim、候选／确认／替代／过期状态、用户审核和引用。
2. `kernel/agent/memorygraph`：从 Block refs、属性和 claim 生成可删除／重建的时间关系投影；每次查询有节点、边、迭代和截止时间上限。
3. `kernel/agent/gateway`：多渠道账户、pairing、identity、delivery receipt 和来源会话；主 Agent runtime 只接收统一 RequestSourceContext。
4. `kernel/agent/browser`：页面观察、动作、等待、导航、截图、失败、人工接管和 resume；通过 MCP／Tool registry 协调。
5. `kernel/agent/eval` 与 `kernel/agent/policy`：固定输入、mock tool、轨迹 replay、指标和版本化策略；生产运行时只读取已批准版本。

## 7. 详细实施路线

### Phase 0：证据与契约冻结（1～2 周）

- 建立 `SourceEvent`、`MemoryClaim`、`RetrievalTrace`、`ToolInvocation`、`ActionReceipt`、`OperationHandle` 六个 JSON Schema；每个 schema 在 Go、TypeScript 和 fixture 中做 round-trip。
- 从 52 个工具的社区反馈中抽取至少 150 条脱敏回归样本，按 stream、auth、memory、migration、sandbox、provider、UX、browser 分类；每条保存原始 URL、摘录、访问日期和结论置信度。
- 将上一版文档标记为旧版基线，研究轨迹中记录 GitHub API／HTML 查询方法、动态指标局限和失败 URL。
- **验收**：每个工具至少有 O＋C＋A＋S 四类记录；缺项自动生成证据缺口报告，不允许手工标记完成。

### Phase 1：统一能力网关（2～3 周）

- 修改 `kernel/mcp/tools/types.go`：扩展 capability version、read/write/network/externalCost effects、idempotency scope、operation support、provenance requirements。
- 修改 `kernel/agent/tools.go`：将 OpenAI、Anthropic、MCP、provider hosted tools 统一为 `ToolInvocationStarted`、`ToolResult`、`ToolInvocationUnknown`、`ToolInvocationReconciled`。
- 增加 provider contract tests：空流、重复 event、tool_use 无 result、result 丢失、额度错误、取消和重试；直接覆盖 T08、T10、T25、T26、T29 的社区故障。
- **验收**：同一 invocation 重试不会产生重复外部副作用；未知结果可见且不自动重试；用户能看到 provider、model、quota、latency、result integrity。

### Phase 2：长期记忆 MVP（3～4 周）

- 新增 `kernel/agent/memory`：候选事实抽取、来源绑定、confidence、valid-from/to、supersedes、用户确认和撤销。
- 使用 Daily Note／Block 作为权威正文，增加 `custom-sforge-memory-kind`、`custom-sforge-memory-status`、`custom-sforge-memory-source`、`custom-sforge-memory-confidence`、`custom-sforge-memory-valid-from/to` 和 `custom-sforge-memory-updated-by`。
- 复用现有 FTS、Embedding、VectorDB 做三层记忆：working（session runtime）、episodic（每日笔记／经历）、semantic／persona（用户可见长期事实）。
- 前端在 Agent session panel 增加 memory candidate review、source click、supersede、restore；不要把“记忆已写入”藏在模型回答里。
- **验收**：用户修改一个偏好后，新 claim 在下一次召回生效，旧 claim 不再默认返回但仍保留来源；无来源 claim 不进入高信任上下文。

### Phase 3：混合召回与时间图（3～4 周）

- 扩展 `kernel/mcp/tools/search.go` 和 ContextBuilder，加入 query intent、FTS、semantic、graph、recency、confidence rank fusion；返回 `whyRecalled` 和 citations。
- 新增 `memorygraph` 投影，从 Block links／attributes／claims 生成关系、有效期、替代链和社区摘要；不引入 Neo4j。
- 增加 as-of query、冲突边、过期过滤、max nodes、max iterations 和 deadline，针对 Graphiti #402 的非收敛风险做回归测试。
- **验收**：能回答指定日期有效的偏好并给出处；VectorDB 或图投影删除后可从 Block／SourceEvent 全量重建；Recall@5、时间准确率和 citation coverage 达到 Phase 0 阈值。

### Phase 4：心跳、渠道与长期陪伴入口（3～4 周）

- 扩展 `kernel/api/magi_runtime.go`：新增 `memory-consolidation`、`source-refresh`、`reflection`、`relationship-check` 任务类型，带 budget、cooldown、priority、pause 和 last-run 状态。
- 新增 `agent/gateway`：先支持已有 WebSocket／HTTP 和一个外部消息渠道适配器，统一 RequestSourceContext、pairing、identity、delivery receipt；以后再扩展 Telegram／Discord／QQ 等。
- 将 Hermes／OpenClaw 的 FTS5 session search、nudges、cron delivery、跨渠道连续性和 identity RFC 映射到同一 SourceEvent／MemoryClaim 体系。
- **验收**：后台任务不抢占用户 turn；人工暂停立刻生效；跨渠道消息进入同一用户／Agent identity；每次后台巩固都有可见日志和来源链。

### Phase 5：浏览器与代码轨迹（4～5 周）

- 新增 `kernel/agent/browser`，把 Browser Use／ADK／MCP 长任务的 observation、action、wait、navigation、screenshot、human takeover 和 resume 建模为状态机。
- 扩展 task-directory：plan／build／review policy、repo map、stdout hash、diff snapshot、test result、unknown side effect 和 action receipt。
- 复用现有 Agent panel、toolcall renderer 和 standalone runtime 展示轨迹，不新增聊天产品。
- **验收**：浏览器 stuck、sandbox timeout、stdout loss、provider stream interruption 都能恢复或明确失败；代码写操作可回滚；cookie、token、临时 DOM 不进入长期记忆。

### Phase 6：离线学习、评测与发布（持续）

- 新增 `kernel/agent/eval`：固定 prompt、memory corpus、tool mock、provider replay、browser replay、回归指标和成本统计。
- 新增 `kernel/agent/policy`：从 Reflexion／DSPy／Hermes feedback 生成候选检索／路由／提示策略，必须经过离线评测和人工批准；skill 不作为核心抽象。
- 建立社区回归集：T01 #636、T06 #7353、T07 #4877、T10 #495、T12 #3284、T13 #402、T16 #12528、T19 #839、T20 #16157、T22 #27291、T24 #49971、T25 #4945、T26 #11179、T27 #7410、T29 #3445 等。
- **验收**：策略有版本、指标、来源、审批和回滚；生产运行时不读取未发布策略；重大错误路径都有自动化回归。

## 8. 能力优先级与验收指标

| 优先级 | 能力 | 目标指标 | 证据来源 |
|---|---|---|---|
| P0 | 来源完整的长期事实 | 有效 claim source coverage 100% | T11、T12、T13、T24、T28 |
| P0 | 混合／时间召回 | Recall@5 ≥ 0.80；as-of accuracy ≥ 0.90 | T04、T12、T13、T22、T35 |
| P0 | 流式工具完整性 | orphan／duplicate side effect = 0 | T10、T25、T26、T29 |
| P0 | 审批／身份／审计 | 写工具、跨渠道发送和记忆确认均可暂停、回放、撤销 | T01、T05、T06、T07、T24、T29 |
| P1 | 心跳巩固 | 后台任务不抢占用户 turn；失败有 budget／cooldown／nudge | T14、T16、T21、T24、T26、T32 |
| P1 | 用户可编辑陪伴记忆 | 用户编辑后的 claim 下一次召回生效 | T11、T24、T28、T32、T33 |
| P1 | 多渠道连续性 | 同一 identity 的消息可跨入口追踪且有 delivery receipt | T24、T26、T28 |
| P1 | 浏览器／代码恢复 | stuck、timeout、unknown、sandbox failure 可恢复率 ≥ 0.95 | T16、T17、T19、T25、T29 |
| P2 | 离线策略学习 | 发布前必测集通过率 100%，策略可回滚 | T06、T15、T26、P02 |

## 9. 负面证据驱动的设计禁区

- 不把 GitHub stars 当作质量、用户数或长期稳定性的证明；OpenClaw、Hermes、OpenCode 的高星数与各自的身份、流式和额度问题可以同时成立。
- 不把官方宣称的“self-improving”直接转成生产自改 prompt；Hermes／DSPy／Reflexion 的学习必须经过候选、来源、评测和批准。
- 不把所有工具错误压成一条“调用失败”；T10、T25、T26、T29 的反馈要求区分 not-started、partial、unknown、completed、reconciled。
- 不把浏览器当作 `web_fetch` 的参数扩展；T19 的 about:blank／焦点问题属于环境状态机。
- 不把记忆当作不可见 vector cache；T12 的 metadata filter、T13 的图算法、T22 的知识迁移和 T28 的 lore／persona 都要求用户可见、可编辑、可重建。
- 不把多渠道接入等同于简单 webhook；T24 的 identity、pairing、主机权限和插件供应链需要单独的 gateway 与信任边界。

## 10. 证据缺口与诚实状态

本版已经为 52 个主样本记录官方来源、社区 artifact、采用／活跃度信号、负面反馈和 s-forge 判定，并另建 61 条跨生态扩展记录（14 条 `deep-card`、29 条 `screened`、18 条 `gap`）。T01-T45 是开源核心样本，T46-T52 是闭源或周边边界样本；N01-N61 的状态以登记表为准。N36-N49 是本轮扩展的 ZeroClaw、Agent Zero、Nanobot、Void、Zed、MLX、SGLang、ExLlamav2、LanceDB、Chroma、Qdrant、Weaviate、Opik 和 Zep，已有 canonical 官方入口但角色专项证据不足，统一保留 `gap`；N50-N61 是 OpenRouter、Composio、Stagehand、Skyvern、Helicone、LangSmith、Braintrust、AgentAPI、Replit Agent、Devin、Google Jules 和 MCP Context Forge，已有官方入口和 HN/发布信号但仍保留 `screened`。GitHub issue 和 HN 讨论只代表主动反馈者，不能推导总体满意度；HN points／comments 和 stars 也不能直接等同于 DAU。OpenClaw、Pi、Hermes、OpenCode、SillyTavern 的 Discord／Reddit 活跃人数和真实日活没有公开、稳定、可比的统一统计，本版将其写成“社区入口和仓库信号”。KoboldCpp 的官方 README 来源身份存在异常，保持低置信度附录，不参与核心架构结论。

后续仍可补充：对 52 个主样本和 61 个扩展 artifact 的 issue 状态／评论数时间序列；角色平台公开 Discord／Reddit 讨论的正向与负向样本；已建立的 46 条 npm/PyPI/Docker 初始快照的四周时间序列；s-forge 脱敏真实任务上的记忆／恢复／渠道 benchmark。上述事项属于持续观测和产品实施，不改变当前登记表的分层状态；本文仍不把研究结果写成产品已经集成或效果已经排名。

## 11. URL 与来源审计快照

- 跨生态登记表包含 61 条记录、119 个去重官方/社区 URL；原 35 条记录的第一轮直接 GET 为 50 个成功、18 个受限或失败；N36-N49 本轮只完成 canonical 官方入口与 6 条 issue 正文核验，N50-N61 另有 HN/发布信号，但角色专项复现仍列为缺口。
- 受限项已经分型：HN 页面 429（改用 Algolia item API，登记表中的 16 个 HN item 均能返回标题、points 和评论树）；Character.AI/JanitorAI 403（站点反爬，不能据此判定产品不存在）；JanitorAI 旧 about 域名 TLS 不稳定；Ragdoll Studio 旧 Vercel 入口 404；Convai 旧 community 路径 404（改用官方 docs）。
- 对相关 Markdown/CSV 做全 corpus URL 扫描并规范化后，共 562 个去重 URL：517 个成功、30 个限流/禁止、9 个 404、1 个 400、1 个 422、2 个网络超时和 2 个网络错误。扫描包含查询模板占位 URL、失效历史入口和代码片段中的 API 地址；新增候选的 canonical 官方页已逐项核验，失败项保持在轨迹表，不从失败推导能力结论。
- 这些状态是访问时快照，不代表产品质量、社区规模或长期可用性；失败来源保留在 [角色研究轨迹](AI角色一致性评估与保持专题研究-研究轨迹.md) 和 CSV notes 中，避免把访问受限写成“已验证”。
