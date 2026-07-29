# AI Harness／工具研究轨迹与证据记录

> 文档状态：旧版官方来源轨迹。它没有覆盖本轮新增的个人 Agent、终端 Agent、角色扮演前端和社区反馈，完整轨迹见 [社区证据深度调研轨迹](AI工具与Harness深度调研-研究轨迹.md)。

> 记录时间：2026-07-28（Asia/Shanghai）；研究对象：s-forge 当前工作树与公开官方资料；主结论见 [能力研究与集成计划](AI工具与Harness能力及s-forge长期陪伴集成计划.md)。本文件保留检索路径、HTTP 校验、证据摘录、排除项和决策变化，便于后续复核与更新。

## 1. 研究问题与方法

### 1.1 初始问题

1. 哪些主流 Agent harness 或 AI 工具已经解决了状态、工具、信息采集、记忆、恢复、评测或长期陪伴问题？
2. 哪些能力能通过扩展 s-forge 现有设施实现，哪些能力在范式上不同，必须建立平行模块？
3. 对长期陪伴和长期学习真正有价值的机制是什么，如何让用户可见、可纠正、可撤销？

### 1.2 检索策略

- 先读本地 `AGENTS.md`，确认仓库边界、禁止手工编辑目录、测试规则和文档风格。
- 使用 `rg --files`、`rg -n`、定向 `Get-Content` 盘点 `kernel/agent`、`kernel/mcp`、`kernel/api`、`kernel/vectordb`、`app/src/layout/dock/agent`、`app/src/magi` 以及既有设计／调研文档。
- 外部来源优先选择官方文档、官方 GitHub 仓库、论文原文；对每个候选 URL 使用 HTTP HEAD 校验，记录状态码；正文摘录使用官方 README 或文档页面的可见标题／段落。
- 能力判断分为事实、推论和方案三层：事实必须有外部或本地证据；推论明确标记为“长期价值”；方案明确标记为“集成判定”。
- 研究范围不把 skill 当作核心能力；skill 只作为反模式观察项，重点转向来源采集、事实账本、时间图、主动巩固、恢复和评测。

## 2. 本地源码发现记录

| 时间 | 检查项 | 命令／路径 | 发现 |
|---|---|---|---|
| 2026-07-28 | Agent runtime | `kernel/agent/runtime.go`，`rg -n "agentRuntime|loadRuntimeLocked|writeRuntimeLocked"` | 有 schemaVersion、revision、active turn、compaction、token breakdown 和锁定读写，可作为 durable turn 基础。 |
| 2026-07-28 | 上下文压缩 | `kernel/agent/compaction.go`，`rg -n "compactMessages|extractSummary"` | 已按最近用户消息保留窗口并摘要用户／助手／工具；需要扩展为带记忆 ID 和未完成任务的结构化摘要。 |
| 2026-07-28 | 工具执行 | `kernel/agent/tools.go`，`rg -n "executeTool|convertMCPToolsToOpenAI|convertSchema"` | 已有 schema 转换、任务目录授权、forge 保护、取消和未知副作用结果。 |
| 2026-07-28 | MCP registry | `kernel/mcp/tools/types.go`、`register.go` | Tool 有 source、schema、progress handler、effects 相关扩展位置；已有 native、plugin、mcp、task-directory、forge 来源。 |
| 2026-07-28 | 信息采集 | `kernel/mcp/tools/web_search.go`、`web_fetch.go`、`search.go` | 已有网页搜索、网页抓取、全文、语义和资产内容搜索；可统一 provenance，不需新网络设施。 |
| 2026-07-28 | Embedding／VectorDB | `kernel/api/embedding.go`、`kernel/api/vector.go`、`kernel/vectordb` | 已有 Block／Asset push、query、pending、dataset、collection、HNSW／Vamana 及量化代码。 |
| 2026-07-28 | 每日笔记 | `kernel/api/block_op.go:260-316`、`model.CreateDailyNote` | 每日笔记创建和块写入已存在，适合作为用户可见权威记忆载体。 |
| 2026-07-28 | 心跳 | `kernel/api/magi_runtime.go`、`magi.go` | 有 heartbeat loop、睡眠／唤醒间隔、passive recall basis、CoordinateHeartbeat 和状态推送。 |
| 2026-07-28 | 既有设计 | `docs/设计/AIagent设计.design.md`、`docs/设计/Agent架构调研.note.md` | 已提出 MemoryStore、Siyuan-native 记忆金字塔、Nudge、后台抽取、MessageBus、Heartbeat；本计划补齐证据和工程化阶段。 |
| 2026-07-28 | 类型工具 | `app/src/util/types/LooksLike.types.ts` | 当前已有导出的 StrictEqual、IsAssignable、InstanceLooksLike、StaticLooksLike、ClassIfLooksLike 以及构造函数约束；此前单文件严格检查和文件级 lint 已通过。 |
| 2026-07-28 | 工作树 | `git status --short` | 存在用户已有的 Outline 相关改动；研究文档只新增 `docs/调研` 文件，不触碰这些改动。 |

## 3. 外部来源 HTTP 校验清单

校验方式：PowerShell `Invoke-WebRequest -Method Head -MaximumRedirection 5 -TimeoutSec 25`，请求头 `User-Agent: SiYuan-Coding-Agent`，日期 2026-07-28；以下记录均为 HTTP 200。HEAD 只证明来源可访问，能力结论还需结合正文标题、API 名称或论文摘要复核。

| 编号 | 来源 | 状态 | 证据定位 |
|---|---|---:|---|
| T01 | https://raw.githubusercontent.com/openai/openai-agents-python/main/README.md | 200 | Agents、handoffs、MCP、guardrails、human in the loop、sessions、tracing 清单。 |
| T02 | https://platform.openai.com/docs/guides/tools | 200 | Tools 指南中的 function、web search、file search、computer use。 |
| T02b | https://platform.openai.com/docs/guides/conversation-state | 200 | response／conversation state 管理。 |
| T03 | https://docs.anthropic.com/en/docs/build-with-claude/tool-use | 200 | `tool_use`／`tool_result` 消息协议与 schema。 |
| T04 | https://modelcontextprotocol.io/specification/2025-06-18 | 200 | Tools、Resources、Prompts、capability negotiation。 |
| T05 | https://raw.githubusercontent.com/langchain-ai/langgraph/main/README.md | 200 | durable execution、human-in-the-loop、comprehensive memory、long-running stateful agents。 |
| T06 | https://python.langchain.com/docs/concepts/agents/ | 200 | Agent loop、tool calling、model／retriever 抽象。 |
| T06b | https://docs.langchain.com/langsmith/home | 200 | tracing、debugging、evaluation。 |
| T07 | https://raw.githubusercontent.com/run-llama/llama_index/main/README.md | 200 | Parse、Extract、Index、Agents、advanced retrieval/query。 |
| T07b | https://docs.llamaindex.ai/en/stable/module_guides/deploying/agents/ | 200 | AgentWorkflow、工具和数据上下文。 |
| T08 | https://raw.githubusercontent.com/deepset-ai/haystack/main/README.md | 200 | lifecycle hooks、step_count、token_usage、memory、MCP。 |
| T08b | https://docs.haystack.deepset.ai/docs/agents | 200 | Agent API、工具调用和 pipeline。 |
| T09 | https://raw.githubusercontent.com/microsoft/semantic-kernel/main/README.md | 200 | Agent Framework、plugins、memory、planning、Process Framework、MCP。 |
| T09b | https://learn.microsoft.com/en-us/semantic-kernel/frameworks/process/process-framework | 200 | 结构化流程与事件驱动过程。 |
| T10 | https://raw.githubusercontent.com/microsoft/autogen/main/README.md | 200 | 多 Agent、人类协作、MCP；维护状态与迁移提示。 |
| T11 | https://raw.githubusercontent.com/crewAIInc/crewAI/main/README.md | 200 | Crews、Flows、event-driven、tracing／observability。 |
| T12 | https://ai.pydantic.dev/agents/ | 200 | Agent、tools、dependencies、output validators、structured output。 |
| T13 | https://raw.githubusercontent.com/google/adk-python/main/README.md | 200 | graph-based Workflow、Task API、session／event schema、HITL。 |
| T14 | https://raw.githubusercontent.com/strands-agents/harness-sdk/main/README.md | 200 | model-driven agent loop、model providers、tools、MCP server。 |
| T15 | https://docs.dify.ai/en/guides/workflow | 200 | 可视化 Workflow、节点编排和运行配置。 |
| T15b | https://docs.dify.ai/en/guides/application-orchestration/readme | 200 | 应用编排、Knowledge、Tools、Agent。 |
| T16 | https://raw.githubusercontent.com/letta-ai/letta/main/README.md | 200 | advanced memory、learn and self-improve、stateful Agent SDK、continual learning。 |
| T17 | https://github.com/mem0ai/mem0 | 200 | intelligent memory layer、多级 User／Session／Agent memory。 |
| T17b | https://docs.mem0.ai/platform/overview | 200 | memory add／search、平台记忆模型。 |
| T18 | https://raw.githubusercontent.com/getzep/graphiti/main/README.md | 200 | temporal context graph、provenance、incremental updates、historical queries。 |
| T19 | https://raw.githubusercontent.com/langchain-ai/langmem/main/README.md | 200 | core memory API、hot-path tools、background memory manager、prompt refinement。 |
| T20 | https://raw.githubusercontent.com/stanfordnlp/dspy/main/README.md | 200 | programming rather than prompting、prompt／weight optimization、RAG／Agent loops。 |
| T21 | https://docs.openhands.dev/openhands/usage/agent-canvas/prebuilt-automations | 200 | schedule／webhook automations、外部服务集成。 |
| T21b | https://docs.openhands.dev/openhands/usage/agent-canvas/backends | 200 | local、Docker、VM、cloud backend 切换。 |
| T22 | https://raw.githubusercontent.com/SWE-agent/SWE-agent/main/README.md | 200 | autonomously use tools 修复真实 GitHub repositories、mini-SWE-agent 迁移。 |
| T23 | https://aider.chat/docs/repomap.html | 200 | repo map 的相关性上下文选择。 |
| T24 | https://raw.githubusercontent.com/browser-use/browser-use/main/README.md | 200 | opens pages、clicks、types、fills forms 的浏览器 Agent。 |
| T25 | https://github.com/anthropics/claude-code | 200 | terminal coding agent、文件／shell／项目上下文。 |
| T26 | https://raw.githubusercontent.com/google-gemini/gemini-cli/main/README.md | 200 | Search grounding、file／shell、MCP、checkpoint、`GEMINI.md`、非交互脚本。 |
| P01 | https://arxiv.org/abs/2210.03629 | 200 | ReAct：reasoning traces 与 actions 交替。 |
| P02 | https://arxiv.org/abs/2303.11366 | 200 | Reflexion：verbal reinforcement、feedback、episodic memory。 |
| P03 | https://arxiv.org/abs/2304.03442 | 200 | Generative Agents：memory stream、retrieval、reflection、planning。 |
| P04 | https://arxiv.org/abs/2310.08560 | 200 | MemGPT：virtual context management、hierarchical memory。 |
| P05 | https://arxiv.org/abs/2310.11511 | 200 | Self-RAG：retrieve、generate、critique 的自适应循环。 |
| P06 | https://arxiv.org/abs/2404.16130 | 200 | GraphRAG：entity graph、community summaries、local／global search。 |
| P07 | https://arxiv.org/abs/2405.14831 | 200 | HippoRAG：hippocampal indexing、knowledge graph、personalized PageRank。 |
| P08 | https://arxiv.org/abs/2306.07174 | 200 | LongMem：long-term memory bank、memory retrieval、side network。 |
| P09 | https://arxiv.org/abs/2305.16291 | 200 | Voyager：automatic curriculum、iterative prompting、skill library、environment feedback。 |

## 4. 原始摘录与解释记录

### 4.1 最直接支持长期陪伴的来源

- **LangGraph**：官方 README 的原文要点是 “long-running, stateful agents”，并列出 durable execution、human-in-the-loop 和 comprehensive memory；因此被归入 P0 恢复与记忆，而不是普通 workflow。
- **Letta**：官方 README 的原文要点是 “Build AI with advanced memory that can learn and self-improve over time”；因此把 memory 当作 Agent 状态，而非外挂检索服务。
- **Graphiti**：官方 README 的原文要点是 “track how facts change over time, maintain provenance” 和 “precise historical queries”；因此决定新增时间图投影，但不新增图数据库。
- **LangMem**：官方 README 的原文要点是 “background memory manager” 与 “extracts, consolidates, and updates agent knowledge”；因此决定复用 MAGI heartbeat 做闲时巩固。
- **Gemini CLI**：官方 README 的原文要点是 “Conversation checkpointing to save and resume complex sessions” 与 custom context files；因此确认 `runtime.json`＋用户可编辑 Block 是合理组合。
- **Mem0**：官方 README 的原文要点是 “intelligent memory layer” 和 “User, Session, and Agent state”；因此采用分层记忆 API，但把权威数据留在 Siyuan Block。

### 4.2 最直接支持信息采集的来源

- **LlamaIndex**：官方 README 的 Parse／Extract／Index／Agents 组合说明，文档解析和抽取应与 Agent workflow 解耦；s-forge 已有 Asset、web_fetch、embedding，可在这些入口上补 provenance。
- **Haystack**：官方 README 将 retrieval、routing、memory、generation、evaluation 放在透明 pipeline 中，并支持 MCP server；因此把采集结果、检索 trace 和评测作为显式事件。
- **Browser Use**：官方 README 的行为动词是 opens、clicks、types、fills，证明动态浏览器操作不是静态网页抓取的别名；因此建立平行 trajectory executor。
- **MCP**：规范将 Tools、Resources、Prompts 分开，证明“能力入口”和“记忆内容”可以解耦；s-forge 继续把 MCP 当数据平面，不把它当长期记忆库。

### 4.3 最直接支持认知机制的论文

- **ReAct** 证明工具观察可以进入下一次推理；s-forge 的 tool invocation event 必须保留 observation，而不是只保存最终回答。
- **Reflexion** 证明语言化反馈和 episodic memory 可在不改权重时改善后续行为；s-forge 采用 candidate reflection＋离线评测，避免生产自改人格。
- **Generative Agents** 将 memory stream、retrieval、reflection、planning 串为循环；s-forge 用每日笔记、VectorDB、heartbeat 和 task queue 对应四个环节。
- **MemGPT** 说明有限上下文需要层级内存和主动分页；s-forge 的 compaction 需要从纯摘要升级为带 ID 的分层召回。
- **Self-RAG** 说明检索本身应该被决策和批评；s-forge ContextBuilder 增加 query intent、citation coverage 和“无需召回”分支。
- **GraphRAG／HippoRAG** 说明图结构可以解决跨文档和联想召回；s-forge 复用双链与 Block 属性形成可重建投影。

## 5. 选择、排除与版本判断

| 项目 | 处理 | 理由 |
|---|---|---|
| AutoGen | 纳入但标记迁移风险 | 官方 README 标为 maintenance mode，并建议迁移到 Microsoft Agent Framework；保留多 Agent 和 MCP 经验，不绑定 API。 |
| Semantic Kernel | 纳入但标记后继关系 | 官方仓库说明 Microsoft Agent Framework 是后继；关注 process／plugin／memory 设计，不新增 SK 依赖。 |
| SWE-agent | 纳入但以 mini-SWE-agent 为后续观察对象 | 官方 README 明确旧版被 mini-SWE-agent 超越；保留工具轨迹和 benchmark 方法。 |
| OpenHands | 采用当前 Agent Canvas 文档 | 当前官方资料强调 always-on、backend 和 scheduled／webhook automation，比旧版单一 coding agent 入口更符合长期运行目标。 |
| skill 机制 | 不作为核心设施 | 用户明确要求视为反模式；只吸收 Voyager 的课程／反馈思想，改用版本化策略与可审计任务模板。 |
| 独立向量数据库 | 排除 | s-forge 已有 Embedding、FTS、HNSW／Vamana／VectorDB 和 Block 权威源，新增数据库会破坏用户可见和可重建属性。 |
| 独立知识图数据库 | 排除首期 | Graphiti 的时间图范式有价值，但 Block 双链和属性已能表达权威关系；首期只做平行投影，不增加部署设施。 |

## 6. 研究过程中的关键决策日志

| 编号 | 决策 | 触发证据 | 结果 |
|---|---|---|---|
| D01 | 记忆权威源采用 Siyuan Block | 本地 `AIagent设计.design.md`、每日笔记 API、Graphiti provenance | 外部工具只提供抽取／检索能力，不能成为不可见真相源。 |
| D02 | 保留现有 Agent runtime | `runtime.go` 的 revision、active turn、compaction | 以扩展字段和事件 envelope 实现 durable execution。 |
| D03 | 采集结果统一 provenance | MCP Resources／Tools 分层、LlamaIndex ingestion、web_search／web_fetch 已存在 | 新增 SourceEvent schema，不新造网络层。 |
| D04 | 时间图作为平行投影 | Graphiti、GraphRAG、HippoRAG | 以 Block refs／属性可重建，不引入 Neo4j。 |
| D05 | 心跳用于巩固而非无限聊天 | 本地 `magi_runtime.go`、LangMem、Generative Agents | 用预算、冷却、优先级和暂停控制后台工作。 |
| D06 | 浏览器单独建状态机 | Browser Use 的观察／动作范式 | 不把点击、等待、导航硬塞进只读 web_fetch。 |
| D07 | 学习离线评测后发布 | DSPy、Reflexion、Voyager 与安全需求 | 生产只读已发布 policy，保留回滚。 |
| D08 | 不把 skill 作为核心抽象 | 用户约束、Voyager skill library 的边界 | 使用事实、策略版本、任务模板和评测集替代。 |

## 7. 未决问题与下一轮验证

1. 需要用真实但脱敏的用户笔记确认 Block 属性和双链投影在大规模更新下的写入成本。
2. 需要以当前 Embedding provider 测量中文短句、代码、网页摘要和时间过滤的 rank fusion 参数。
3. 需要确定 `SourceEvent.rawRef` 的保留策略：完整原文、压缩快照还是仅 hash＋可重新抓取 URL。
4. 需要在 Windows、移动端和离线模式分别验证 heartbeat、VectorDB rebuild 和浏览器 executor 的可用边界。
5. 需要为 provider adapter 建立 OpenAI、Anthropic、MCP 三套 contract test，避免工具调用协议漂移影响记忆审计。
6. 需要把当前 Agent 日志中的错误循环样本整理为 nudge／reflection 回归集，而不是仅依赖人工观察。

## 8. 复核指引

复核者先检查本文件第 3 节的 HTTP 状态和第 2 节的本地源码路径，再打开主报告第 4 节逐条点击来源；如果来源页面版本变化，保留同一编号、更新证据定位和访问日期，并在本节追加决策变更，不覆盖旧结论。
