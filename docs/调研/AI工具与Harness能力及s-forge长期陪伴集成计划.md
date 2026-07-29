# 主流 AI Harness／工具能力研究与 s-forge 长期陪伴集成计划

> 文档状态：旧版官方资料基线。它缺少系统性的社区反馈、采用信号和负面证据，已由 [社区证据深度调研版](AI工具与Harness深度调研-社区证据版.md) 替代，不作为最终调研结论。

> 研究日期：2026-07-28；仓库基线：当前工作树；目标：总结至少二十种主流 harness 或 AI 工具的可验证特色，并形成面向长期陪伴、信息收集、长期记忆和持续学习的落地路线。来源、访问状态、原始摘录和研究过程另见 [研究轨迹](AI工具与Harness研究轨迹.md)。

## 1. 结论先行

1. s-forge 不需要再造一个通用 Agent 外壳：`kernel/agent` 已有会话状态、运行时 checkpoint、上下文压缩、工具循环和 MCP 工具转换；优先把它扩展为稳定的状态机与能力网关。
2. s-forge 的差异化优势是“可被用户直接编辑的原生记忆”：每日笔记、Block、双链、全文检索、语义检索、Embedding 和 VectorDB 已在内核中存在；长期陪伴应把这些作为权威事实源，而不是新增外部记忆数据库。
3. 最值得吸收的能力不是名为 skill 的提示词包，而是四条数据闭环：来源采集→带出处的记忆写入→混合检索→用户纠正后的再学习；skill 作为反模式不进入核心架构。
4. 需要新增但应保持平行的部分有三类：面向长期记忆的事件／事实投影层、面向浏览器的观察—动作轨迹执行器、面向回放与评测的实验平面；它们通过现有 Agent、MCP、Block、VectorDB、心跳和 WebSocket 协调，而不是替换这些设施。
5. 计划分七阶段交付：契约冻结、能力网关、记忆平面、采集与检索、心跳与反思、长任务与浏览器、评测与迁移。每阶段都有可执行的文件边界、测试和验收指标。

## 2. 研究边界与评价方法

### 2.1 术语

- **Harness**：围绕模型提供状态、工具、调度、记忆、恢复、观测和人机协作的运行时；模型本身不等于 harness。
- **长期陪伴**：跨会话保持身份连续性、用户偏好、共同经历和可解释的行为策略，并允许用户查看、纠正和撤销。
- **长期学习**：不是无条件训练模型，而是从交互中抽取候选事实、验证来源、更新可检索知识或策略，并能在未来行为中被验证。
- **信息收集**：搜索、网页抓取、文档解析、浏览器操作和工具结果的采集；每条进入记忆的内容必须保留来源、时间和置信度。

### 2.2 评分维度

每个能力按 0～5 分评估：持久状态（S）、信息采集（I）、记忆写入与检索（M）、反思／学习（L）、长任务恢复（D）、人类可控与可解释（H）、与 s-forge 复用程度（R）。分数是架构优先级，不是产品排名。

### 2.3 证据等级

- **A 级**：官方文档或官方仓库明确描述，并可通过链接复核；主报告引用的工具能力均至少有一条 A 级来源。
- **B 级**：论文摘要、正文或官方实验报告可复核；用于认知机制，不直接当作生产承诺。
- **C 级**：s-forge 当前源码和已有设计文档；用于判断能否复用，不替代外部工具证据。

## 3. s-forge 当前能力基线（C 级证据）

| 现有边界 | 可验证事实 | 对本计划的含义 |
|---|---|---|
| `kernel/agent/runtime.go:34-115` | `agentRuntime`、`agentRuntimeTurn`、`runtimeCompaction` 持久化会话运行态、turn、摘要、token 和 revision。 | 直接扩展为 durable turn、幂等提交和恢复，不另造 workflow 状态库。 |
| `kernel/agent/compaction.go:38-134` | 已有按用户消息保留窗口的压缩以及工具／用户／助手摘要。 | 增加结构化记忆引用和事实 ID，保留现有压缩入口。 |
| `kernel/agent/tools.go:29-244` | MCP 工具可转为 OpenAI function schema；执行时注入 session、tool call、任务目录授权并处理未知副作用。 | 扩展 ToolEffects、幂等键、预算和审计字段，不改变调用协议。 |
| `kernel/mcp/tools/types.go:28-92`、`register.go:30-139` | Tool 有来源、输入输出 schema、进度回调和统一注册；来源区分 native、plugin、mcp、task-directory、forge。 | 能力目录、策略和动态发现应作为现有注册器的扩展。 |
| `kernel/mcp/tools/web_search.go:27-139`、`web_fetch.go:27-68` | 已有带进度的网页搜索和只读网页抓取，并声明 HTTP、SSRF、MIME、大小和超时约束。 | 直接接入研究采集流水线，新增来源封装和去重，不另造网络设施。 |
| `kernel/mcp/tools/search.go:26-224` | 已有全文、语义、资产内容三类搜索；语义搜索依赖 Embedding。 | 采用混合检索和记忆专用过滤器，复用现有搜索工具。 |
| `kernel/api/embedding.go:27-779`、`kernel/api/vector.go:49-389` | 已有 Block／Asset Embedding 推送、查询、待处理和 VectorDB 集合操作。 | 长期记忆索引优先落到现有 embedding/vector API，避免引入外部向量服务。 |
| `kernel/api/magi_runtime.go:42-548`、`kernel/api/magi.go:407-418` | MAGI runtime 有 heartbeat loop、睡眠／唤醒间隔、被动召回基础和 CoordinateHeartbeat。 | 直接承载闲时巩固、主动采集和自省调度。 |
| `kernel/model` 的每日笔记接口及 `kernel/api/block_op.go:260-316` | 内核已有 CreateDailyNote 和块写入路径。 | 记忆权威载体使用用户可见的每日笔记／Block。 |
| `docs/设计/AIagent设计.design.md:103-186` | 既有 MemoryStore 草案区分工作、经历、语义／灵魂记忆，并计划使用 Daily Note 与 VectorDB。 | 本计划补齐接口、证据、状态机和迁移顺序，而不是推翻方向。 |
| `docs/设计/Agent架构调研.note.md:12-42` | 已记录 Nudge、后台记忆抽取、MessageBus、MEMORY.md、Heartbeat 的外部启发。 | 本计划把启发转成可验证的模块与验收标准。 |

## 4. 外部工具与研究能力证据台账

以下条目按能力家族组织；每条都给出可访问的官方来源、可复核的证据定位、对长期陪伴的价值和在 s-forge 中的处理方式。来源编号与完整访问记录见研究轨迹。

### 4.1 通用 Agent 与工作流 Harness

#### T01 OpenAI Agents SDK

- **特色**：轻量多 Agent workflow；Agents、handoffs、agents-as-tools、MCP、guardrails、人类介入、跨运行 sessions 和 tracing 都是一等概念。
- **证据**：[官方 README](https://raw.githubusercontent.com/openai/openai-agents-python/main/README.md) 的能力清单明确列出 “Agents configured with instructions, tools, guardrails, and handoffs”、“Sessions: Automatic conversation history management across agent runs” 和 “Tracing”。
- **长期价值**：提供跨运行历史、交接和可观测性的最小组合；对 s-forge 的启发是把 handoff、session、trace 作为领域事件，而不是只拼 prompt。
- **集成判定**：扩展现有 `kernel/agent` 的 turn／工具事件和追踪字段；不引入 Python runtime。

#### T02 OpenAI Responses API 工具层

- **特色**：统一的 hosted tools／function calling／web search／file search／computer use 入口，模型响应中可携带工具调用和结果。
- **证据**：[Tools 指南](https://platform.openai.com/docs/guides/tools) 展示 function、web search、file search、computer use 等工具类别；[Conversation state 指南](https://platform.openai.com/docs/guides/conversation-state) 说明用 response 或 conversation 维持跨轮状态。
- **长期价值**：将模型提供商的托管能力和本地工具统一在同一响应循环，减少 provider-specific 分支。
- **集成判定**：扩展现有 LLM adapter 与 `Tool` schema 映射；外部托管工具作为 provider capability，不复制到 native 工具目录。

#### T03 Anthropic tool use

- **特色**：模型返回结构化 `tool_use` block，客户端执行后以 `tool_result` block 回传；支持并行工具调用和严格的 schema 描述。
- **证据**：[官方 Tool use 文档](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) 的 “How to implement tool use” 和 `tool_use`／`tool_result` 消息示例可直接复核协议顺序。
- **长期价值**：明确区分模型决策、工具执行和结果回注，有利于审计副作用和恢复未知结果。
- **集成判定**：在现有 Go OpenAI 兼容层旁增加 Anthropic message adapter；共享 `Tool`、审计、幂等和预算接口。

#### T04 Model Context Protocol（MCP）

- **特色**：把 tools、resources、prompts 和能力发现标准化，客户端与服务端解耦，可通过本地或远程服务器扩展工具。
- **证据**：[MCP 规范](https://modelcontextprotocol.io/specification/2025-06-18) 的 Server features、Resources、Prompts、Tools 章节定义能力协商和调用协议；s-forge 当前 `kernel/mcp/client` 已有对应实现。
- **长期价值**：长期陪伴需要持续接入消息、网页、日历、文件和外部知识；MCP 是低耦合数据入口，而不是记忆本体。
- **集成判定**：扩展现有 MCP client／registry，增加来源 provenance、权限、速率、缓存和撤销；不再造另一套 plugin protocol。

#### T05 LangGraph

- **特色**：低层、长时间、可恢复、有状态的 Agent orchestration；强调 durable execution、human-in-the-loop、短期／长期 memory 和 trace。
- **证据**：[官方 README](https://raw.githubusercontent.com/langchain-ai/langgraph/main/README.md) 明确写出 “low-level orchestration framework for building, managing, and deploying long-running, stateful agents”，并列出 durable execution、human-in-the-loop、comprehensive memory。
- **长期价值**：把恢复点、人工修改状态和跨会话存储纳入同一图状态，是 s-forge 目前 runtime checkpoint 的外部对照。
- **集成判定**：复用 `agentRuntime` 和 session revision，补充显式节点／边与中断事件；不引入 LangGraph runtime。

#### T06 LangChain

- **特色**：通用模型、工具、retriever 和 agent 抽象，生态连接器广；LangSmith 提供 tracing、评测和运行观测。
- **证据**：[LangChain Agents 概念文档](https://python.langchain.com/docs/concepts/agents/) 与 [LangSmith 文档](https://docs.langchain.com/langsmith/home) 分别定义 agent loop 和 trace／evaluation 工作流。
- **长期价值**：连接器生态适合信息收集，但抽象层较宽，不能直接成为 s-forge 的记忆语义模型。
- **集成判定**：只吸收 retriever、trace、eval 的接口思想；以 MCP 和 native Tool 为唯一运行时入口。

#### T07 LlamaIndex

- **特色**：以数据接入、解析、索引、检索和 document agent 为中心，提供 Workflows、agentic OCR、结构化抽取和 RAG。
- **证据**：[官方 README](https://raw.githubusercontent.com/run-llama/llama_index/main/README.md) 写明 “Parse、Extract、Index、Agents” 以及 “advanced retrieval/query interface over your data”；[Agents 文档](https://docs.llamaindex.ai/en/stable/module_guides/deploying/agents/) 描述 AgentWorkflow。
- **长期价值**：文档解析和增量索引直接对应信息收集入口，尤其适合资产、PDF、网页和笔记的统一抽取。
- **集成判定**：扩展现有 Asset／Block 索引和 `web_fetch` 结果解析；不把 LlamaIndex 的存储模型引入内核。

#### T08 Haystack

- **特色**：显式 pipeline／agent workflow，可控制 retrieval、routing、memory、generation；Agent 支持 lifecycle hooks、并行工具调用、step/token 计数和 MCP server 暴露。
- **证据**：[官方 README](https://raw.githubusercontent.com/deepset-ai/haystack/main/README.md) 的 “Agents built for production” 和 “Built for context engineering” 段落列出 `before_llm`、`before_tool`、`on_exit`、`step_count`、`token_usage`、memory 和 MCP。
- **长期价值**：生命周期 hook 和 token budget 是无人值守陪伴的重要可观测边界。
- **集成判定**：在 `executeTool` 前后增加 hook／cost event；复用现有进度回调，不再增加一套 pipeline DSL。

#### T09 Microsoft Semantic Kernel／Agent Framework

- **特色**：插件、prompt template、memory、planning、process framework 和多 Agent 编排，支持 MCP；官方仓库已说明 Agent Framework 是 Semantic Kernel 的后继方向。
- **证据**：[官方仓库 README](https://raw.githubusercontent.com/microsoft/semantic-kernel/main/README.md) 的 Agent Framework、Plugin Ecosystem、Process Framework 段落；[Process Framework 文档](https://learn.microsoft.com/en-us/semantic-kernel/frameworks/process/process-framework) 定义结构化业务流程。
- **长期价值**：把“长期任务”表达为可恢复的业务过程，而不是单轮对话，适合同步、整理、周期性研究。
- **集成判定**：借鉴 process／plugin contract；用现有 cron、heartbeat、agent session 组合，不增加 SK 依赖。

#### T10 AutoGen

- **特色**：多 Agent 对话、人工协作、AgentChat、代码执行和 MCP 连接器；当前官方 README 标为 maintenance mode，并指向 Microsoft Agent Framework 迁移。
- **证据**：[官方 README](https://raw.githubusercontent.com/microsoft/autogen/main/README.md) 同时给出 “multi-agent AI applications” 和 maintenance／migration notice；AgentChat 文档包含 Playwright MCP browsing assistant 示例。
- **长期价值**：多角色协作和人工介入值得保留，但维护状态说明不能把 AutoGen API 当作新核心依赖。
- **集成判定**：把角色协作建模为 MAGI／sub-agent 的视角事件；不直接移植 AutoGen runtime。

#### T11 CrewAI

- **特色**：Crews 面向角色协作，Flows 面向精确、事件驱动的流程；提供 tracing、metrics、logs 和统一控制平面。
- **证据**：[官方仓库 README](https://raw.githubusercontent.com/crewAIInc/crewAI/main/README.md) 明确区分 “Crews” 与 “Flows”，并列出 tracing、observability 和 event-driven control。
- **长期价值**：长期陪伴既需要自主协作，也需要确定性日程；Crews／Flows 的二分有助于定义人格协作与后台工作边界。
- **集成判定**：扩展 MAGI task ring 和 cron event；把角色配置存为可编辑 Block，不引入 CrewAI YAML。

#### T12 PydanticAI

- **特色**：类型安全的 Agent、工具和结构化输出，支持依赖注入、模型无关适配和可测试的结果校验。
- **证据**：[官方 Agents 文档](https://ai.pydantic.dev/agents/) 展示 Agent、tools、dependencies、output validators 和 structured output。
- **长期价值**：长期记忆写入必须先经过 schema、置信度和来源校验，类型化输出比自由文本更适合事实账本。
- **集成判定**：把 Pydantic 的契约思想转为 Go struct／JSON Schema；结合已修复的 `LooksLike.types.ts` 做前端契约校验，不引入 Python。

#### T13 Google ADK

- **特色**：code-first Agent 与 graph-based Workflow，支持 routing、human-in-the-loop、nested workflows、Task API 和事件／session schema。
- **证据**：[官方仓库 README](https://raw.githubusercontent.com/google/adk-python/main/README.md) 的 Workflow Runtime、Task API、Agent／Workflow 段落；明确说明 session schema 和 event model。
- **长期价值**：把事件和 session schema 作为稳定公共契约，适合 s-forge 的多入口、断点恢复和跨版本迁移。
- **集成判定**：为 `agentRuntime` 增加 schema version、event envelope、task parent／child；复用现有 revision 和 recovery tests。

#### T14 AWS Strands Agents

- **特色**：model-driven agent loop，以少量代码组合模型、工具和 MCP；同一 SDK 覆盖简单对话到复杂 autonomous workflow，并配套工具仓库和部署生态。
- **证据**：[官方仓库 README](https://raw.githubusercontent.com/strands-agents/harness-sdk/main/README.md) 明确写出 “model-driven approach” 和 agent loop、model providers、tools、MCP server 组件。
- **长期价值**：说明复杂能力可以建立在稳定的 model-driven loop 上，不必把每个行为硬编码成复杂 planner。
- **集成判定**：保留 s-forge 现有 ReAct／tool loop，增加可插拔 policy；不新增 Strands 运行时。

#### T15 Dify

- **特色**：面向应用编排的可视化 workflow、RAG、工具和 Agent 节点，适合把采集、抽取、审核和发布串成可观察流程。
- **证据**：[官方 Workflow 文档](https://docs.dify.ai/en/guides/workflow) 和 [应用编排文档](https://docs.dify.ai/en/guides/application-orchestration/readme) 的 Workflow、Knowledge、Tools 和 Agent 章节；其定位是可视化构建 LLM 应用和 RAG pipeline。
- **长期价值**：可视化编排适合运营人员维护采集规则，但不应成为 s-forge 核心状态源。
- **集成判定**：只借鉴“可视化流程→版本化定义→运行记录”模式；以 Block／JSON schema 保存流程，后台仍由现有 Agent runtime 执行。

### 4.2 记忆、个性化与持续学习

#### T16 Letta（MemGPT 生产化路线）

- **特色**：把 Agent 当作带有可读写 memory blocks 的有状态实体，强调 advanced memory、continual learning、模型无关和跨本地／云端运行。
- **证据**：[官方仓库 README](https://raw.githubusercontent.com/letta-ai/letta/main/README.md) 写明 “Build AI with advanced memory that can learn and self-improve over time”，并描述 stateful Agent SDK、memory、continual learning。
- **长期价值**：最接近长期陪伴的产品范式：记忆不是检索插件，而是 Agent 能主动管理的持续状态。
- **集成判定**：把“可读写记忆块”落到 Siyuan Block；新增记忆策略接口和用户确认状态，不引入 Letta server。

#### T17 Mem0

- **特色**：面向个性化助手的 memory layer，区分 User、Session、Agent 多层状态，强调从交互中持续学习和 token-efficient retrieval。
- **证据**：[官方仓库 README](https://github.com/mem0ai/mem0) 说明 “intelligent memory layer”、“Multi-Level Memory: User, Session, and Agent state”；[平台概览](https://docs.mem0.ai/platform/overview) 描述 memory add／search 与多级记忆。
- **长期价值**：多层记忆和低 token 召回适合把工作记忆、用户偏好、Agent 自身策略分开管理。
- **集成判定**：在现有 Block／VectorDB 上实现同样的层级与检索 API；保留原始对话和事实来源，避免黑盒覆盖用户笔记。

#### T18 Zep／Graphiti

- **特色**：面向 Agent 的 temporal context graph，追踪事实随时间变化、来源 provenance、增量更新和历史查询。
- **证据**：[Graphiti 官方 README](https://raw.githubusercontent.com/getzep/graphiti/main/README.md) 明确写出 temporal context graphs、provenance、incremental updates 和 precise historical queries。
- **长期价值**：长期关系和偏好会改变，单纯向量相似度无法回答“何时有效、后来是否被纠正”；时间图是不可替代的范式补充。
- **集成判定**：创建平行的 `kernel/agent/memorygraph` 投影层，用 Block ID、属性和双链表示节点／边；不引入 Neo4j，先在现有存储上构建可重建索引。

#### T19 LangMem

- **特色**：提供 core memory API、会话热路径的 memory tools、后台 memory manager，可抽取、合并、更新知识并优化 Agent 行为。
- **证据**：[官方 README](https://raw.githubusercontent.com/langchain-ai/langmem/main/README.md) 列出 “extract important information”、“prompt refinement”、“background memory manager” 和 LangGraph long-term store integration。
- **长期价值**：前台即时记忆与后台巩固分离，正好对应 s-forge 的用户交互与闲时 heartbeat。
- **集成判定**：扩展 MAGI heartbeat 为 memory consolidation scheduler；前台写候选事实，后台合并／过期／升级状态。

#### T20 DSPy

- **特色**：从手写 prompt 转向可组合的 typed signatures、modules 和 optimizer，对 prompt／权重进行自动优化，覆盖 RAG 和 Agent loop。
- **证据**：[官方 README](https://raw.githubusercontent.com/stanfordnlp/dspy/main/README.md) 直接定义 “programming—rather than prompting” 和 prompt／weight optimization。
- **长期价值**：长期学习应包含可回放的策略改进，而不是让模型任意改写人格；DSPy 提供“程序—数据—评测”闭环。
- **集成判定**：建立独立 `docs/` 与 eval corpus 驱动的 policy tuning 平面；不在生产运行时自动改写 prompt。

### 4.3 编码、浏览器与持续运行工具

#### T21 OpenHands Agent Canvas

- **特色**：自托管、always-on 的 Agent 控制中心，可在本地、Docker、VM、云端切换 backend，并按 webhook／schedule 运行自动化。
- **证据**：[官方文档](https://docs.openhands.dev/openhands/usage/agent-canvas/prebuilt-automations) 和 [backend 文档](https://docs.openhands.dev/openhands/usage/agent-canvas/backends) 描述 scheduled／webhook automations、多个 agent backend 和 self-hosting。
- **长期价值**：把 Agent 从聊天窗口提升为可长期运行的工作单元，适合研究报告、同步和定时清理。
- **集成判定**：复用 s-forge cronjob、heartbeat、task directory 和 session；另建自动化定义与运行记录模块，不改造普通对话为无限循环。

#### T22 SWE-agent／mini-SWE-agent

- **特色**：为软件工程任务设计的工具环境、代码编辑循环和 benchmark 驱动评测；官方 README 已提示 mini-SWE-agent 取代旧版。
- **证据**：[SWE-agent README](https://raw.githubusercontent.com/SWE-agent/SWE-agent/main/README.md) 写明可让模型自主使用工具修复真实 GitHub 仓库，并指向 mini-SWE-agent 与 SWE-bench。
- **长期价值**：展示“任务目录＋可重复工具轨迹＋基准评测”的闭环，比泛化聊天更适合长期工程协作。
- **集成判定**：扩展现有 task-directory 工具和 revision／recovery 测试；将 SWE-bench 类回放放入平行 eval harness。

#### T23 Aider

- **特色**：代码库地图（repo map）、增量编辑、自动 git commit、diff／undo 工作流，并可把网页和图片作为上下文。
- **证据**：[Repo map 文档](https://aider.chat/docs/repomap.html) 描述按相关性选择代码上下文；[官方 README](https://raw.githubusercontent.com/Aider-AI/aider/main/README.md) 描述自动 commit、diff、undo、网页／图片上下文。
- **长期价值**：将每次修改作为可回滚、可追踪的经历记忆，代码库地图是信息压缩而非盲目截断。
- **集成判定**：复用现有 task-directory、session snapshot 和 git 审计；增加结构化 repo map cache，不引入 Aider CLI。

#### T24 Browser Use

- **特色**：通过浏览器观察页面、点击、输入和提交表单，使用自然语言完成多步骤网页任务，并可接入其他 Agent。
- **证据**：[官方 README](https://raw.githubusercontent.com/browser-use/browser-use/main/README.md) 的 “What can Browser Use do?” 明确列出 opens pages、clicks buttons、types、fills forms。
- **长期价值**：网页是动态环境，DOM／截图观察和动作结果必须作为轨迹保存，单次 `web_fetch` 无法覆盖这一范式。
- **集成判定**：创建平行 `browser-trajectory` executor，通过 MCP 暴露启动、观察、动作、回放；结果以来源事件写入记忆，浏览器凭据不进入长期记忆。

#### T25 Claude Code

- **特色**：面向代码库的终端 Agent，强调文件、shell、版本控制和项目级上下文文件；官方仓库持续演进且可独立运行。
- **证据**：[官方仓库](https://github.com/anthropics/claude-code) 展示 terminal coding agent、工具调用和项目配置；以仓库 README 与版本记录为可复核入口。
- **长期价值**：项目级上下文文件体现“可编辑外部记忆”，适合把团队约定、偏好和任务状态纳入用户控制范围。
- **集成判定**：用 Siyuan 文档／Block 代替散落上下文文件；继续复用 task directory 权限和 agent session。

#### T26 Gemini CLI

- **特色**：开源终端 Agent，内置 Google Search grounding、文件／shell 工具、MCP 扩展、非交互脚本、conversation checkpoint 和 `GEMINI.md` 项目上下文。
- **证据**：[官方 README](https://raw.githubusercontent.com/google-gemini/gemini-cli/main/README.md) 明确列出 built-in tools、MCP、non-interactive automation、conversation checkpointing 和 custom context files。
- **长期价值**：checkpoint 与项目上下文文件展示了“可恢复任务＋局部长期记忆”的组合。
- **集成判定**：复用 `runtime.json` 和用户可编辑 Block；将 Google Search 作为 provider capability，不复制供应商实现。

## 5. 认知研究证据与不可替代机制

#### P01 ReAct

- **机制**：在推理与外部行动之间交替，让模型通过工具观察环境并修正计划。
- **证据**：[论文](https://arxiv.org/abs/2210.03629) 摘要明确描述 reasoning traces 与 task-specific actions 的交替。
- **s-forge 用法**：保留现有 tool loop；将每个 observation、action、decision 写为可追溯事件，供后续摘要和评测。

#### P02 Reflexion

- **机制**：通过语言化自我反思和 episodic memory 进行 verbal reinforcement，不直接更新模型权重。
- **证据**：[论文](https://arxiv.org/abs/2303.11366) 摘要描述 verbal reinforcement learning、feedback 和 episodic memory。
- **s-forge 用法**：失败任务结束后生成候选反思 Block，经过来源和用户确认后才升级为长期策略。

#### P03 Generative Agents

- **机制**：memory stream、检索、reflection 和 planning 组合出持续的社会行为；反思把多个经历压缩为高层信念。
- **证据**：[论文](https://arxiv.org/abs/2304.03442) 摘要与正文标题描述 memory stream、retrieval、reflection、planning。
- **s-forge 用法**：把工作日志、反思摘要、未来计划映射到每日笔记和关系链接；heartbeat 负责闲时反思。

#### P04 MemGPT

- **机制**：仿照操作系统的分层内存管理，让 Agent 自主在有限上下文与外部持久内存之间分页／换入换出。
- **证据**：[论文](https://arxiv.org/abs/2310.08560) 描述 virtual context management 和 hierarchical memory。
- **s-forge 用法**：把现有 compaction 从纯文本摘要提升为带引用的 working／episodic／semantic 分层召回。

#### P05 Self-RAG

- **机制**：模型按需检索，并用 reflection tokens 判断是否需要检索及评估生成内容的支持度。
- **证据**：[论文](https://arxiv.org/abs/2310.11511) 摘要描述 retrieve、generate、critique 的自适应循环。
- **s-forge 用法**：在 ContextBuilder 中加入“需不需要召回”的决策和 citation coverage 指标，避免每轮灌入全部记忆。

#### P06 GraphRAG

- **机制**：先从语料抽取实体关系并构建社区摘要，再提供 local search 和 global search，解决跨文档主题问题。
- **证据**：[论文](https://arxiv.org/abs/2404.16130) 描述 entity graph、community summaries、local/global search。
- **s-forge 用法**：用 Block 双链和属性形成关系投影，按主题社区生成可编辑摘要；不引入独立图数据库。

#### P07 HippoRAG

- **机制**：以海马体联想记忆为启发，使用知识图和个性化 PageRank 做一跳／多跳联想召回。
- **证据**：[论文](https://arxiv.org/abs/2405.14831) 摘要描述 hippocampal indexing、knowledge graph 和 personalized PageRank。
- **s-forge 用法**：在 VectorDB 召回后增加链接扩展和图分数，提升“相关但未共享关键词”的共同经历召回。

#### P08 LongMem

- **机制**：引入独立的 long-term memory bank 和 side network，使模型在长上下文外保留可训练记忆。
- **证据**：[论文](https://arxiv.org/abs/2306.07174) 摘要描述 long-term memory bank、memory retrieval 和 side network。
- **s-forge 用法**：借鉴 memory bank 与主模型解耦，把记忆索引作为独立可重建层，避免污染主对话窗口。

#### P09 Voyager

- **机制**：在开放环境中使用自动课程、迭代 prompting、技能库和环境反馈持续提升任务能力。
- **证据**：[论文](https://arxiv.org/abs/2305.16291) 摘要描述 automatic curriculum、iterative prompting 和 skill library。
- **s-forge 用法**：只吸收课程、反馈和评测闭环；按用户要求不把 skill 作为核心设施，策略以可审计任务模板和记忆事实表示。

## 6. 对长期陪伴最有价值的能力排序

| 优先级 | 能力 | 主要证据 | s-forge 目标形态 | 原因 |
|---|---|---|---|---|
| P0 | 可编辑、带来源的长期事实 | T16、T17、T18、T19、P04 | Block 事实账本＋状态／置信度／来源／有效期 | 用户能纠正，Agent 能解释“为何记得”。 |
| P0 | 混合召回与时间图 | T18、P05、P06、P07、P08 | FTS＋VectorDB＋双链／时间过滤的 rank fusion | 解决同义、跨文档、时间变化和共同经历。 |
| P0 | 会话恢复与幂等 | T01、T05、T13、T26 | `runtime.json`＋event envelope＋revision／turn id | 长任务中断后继续，避免重复副作用。 |
| P0 | 信息采集 provenance | T02、T04、T07、T08、T24 | source event（URL、块 ID、工具、时间、摘要、hash） | 研究结果和记忆必须可回溯。 |
| P1 | 后台巩固与心跳 | T19、T21、P02、P03 | MAGI heartbeat → consolidate／expire／reflect | 让长期陪伴有闲时学习而非只在用户追问时工作。 |
| P1 | 人类介入与可撤销 | T01、T05、T08、T13 | pending memory queue、review UI、supersede／revert | 维持用户主权，避免错误事实永久化。 |
| P1 | 浏览器观察—动作轨迹 | T24、T10 | 平行 browser executor＋trajectory log | 动态网页操作不是静态抓取的简单扩展。 |
| P1 | 任务目录与代码回放 | T22、T23、T25、T26 | task-directory＋snapshot＋eval harness | 长期工程合作需要可重复、可回滚、可评测。 |
| P2 | 策略优化 | T20、P02、P09 | 离线 eval corpus＋版本化 policy | 先验证后发布，避免生产中自改人格。 |
| P2 | 多角色认知 | T09、T10、T11、T13 | MAGI 视角／子任务事件 | 仅在单 Agent 记忆和恢复稳定后引入。 |

## 7. 架构决策：扩展现有设施与平行实现

### 7.1 直接扩展现有设施

1. **Tool／MCP 能力网关**：在 `kernel/mcp/tools/types.go` 增加 `Effects`（read、write、network、externalSideEffect）、`IdempotencyKey`、`CostHint`、`Provenance` 和 capability version；保留现有 registry、schema 转换、来源过滤和任务目录授权。
2. **Agent 状态与恢复**：在 `kernel/agent/runtime.go` 增加事件序列号、父子任务、等待原因、工具执行记录和恢复策略；沿用 `runtime.json`、session revision、commitTurnID 和现有锁。
3. **上下文构造与压缩**：扩展 `kernel/agent/compaction.go` 的摘要结构，保存 memory IDs、未完成任务、约束、来源和待确认事实；继续使用 token budget 和最近用户消息窗口。
4. **信息采集**：扩展 `web_search`、`web_fetch`、`search` 的结果 schema，统一返回 `sourceID`、canonical URL、抓取时间、内容 hash、引用片段和错误状态；不新增网络客户端。
5. **Embedding／VectorDB**：新增记忆 dataset 命名与过滤字段，复用 `kernel/api/embedding.go`、`kernel/api/vector.go` 和现有 Vamana／HNSW；不引入外部向量数据库。
6. **心跳与定时任务**：扩展 `magi_runtime.go` 的 heartbeat reason、预算、冷却、任务优先级和 consolidate job；保留现有睡眠／唤醒逻辑和 MAGI coordinator。
7. **前端观察与审核**：在现有 Agent session panel、websearch renderer、toolcall renderer 上增加记忆候选、来源和审计视图；不另造聊天 UI。

### 7.2 以平行模块实现根本不同范式

1. **长期记忆投影层 `kernel/agent/memory`**：它不是 session history，也不是普通 vector collection，而是由“不可变来源事件＋可编辑事实声明＋时间／关系投影”组成的独立认知数据平面；权威内容仍落在 Block，索引可重建。
2. **浏览器轨迹执行器 `kernel/agent/browser`**：浏览器需要页面观察、动作、导航、截图、等待和失败重试的状态机，不能硬塞进只读 `web_fetch`；通过 MCP／Tool registry 与主 Agent 协调。
3. **评测与回放平面 `kernel/agent/eval`**：需要固定输入、工具 mock、轨迹 replay、指标和回归样本，与生产 session 隔离；它不是用户记忆，也不是 cron job。
4. **策略学习平面 `kernel/agent/policy`**：离线消费已确认事实、失败反思和评测结果，产出版本化提示／路由／检索策略；生产运行时只读取已发布版本。

## 8. 目标数据模型

### 8.1 记忆状态

记忆单元采用 `candidate → confirmed → superseded／expired` 状态；`candidate` 可由 Agent 自动产生，`confirmed` 需要用户确认或高可信规则，`superseded` 保留替代链，`expired` 只在有效期结束时从默认召回中排除，不直接删除来源。

### 8.2 Block 属性建议

建议在记忆 Block 上使用 `custom-sforge-memory-kind`、`custom-sforge-memory-id`、`custom-sforge-memory-status`、`custom-sforge-memory-confidence`、`custom-sforge-memory-source`、`custom-sforge-memory-valid-from`、`custom-sforge-memory-valid-to`、`custom-sforge-memory-derived-from` 和 `custom-sforge-memory-updated-by`；属性是可见元数据，正文保持自然语言和可编辑引用。

### 8.3 来源事件

```text
SourceEvent = { id, sessionID, turnID, kind, uri, blockID, toolName, capturedAt, contentHash, excerpt, rawRef, trust }
MemoryClaim = { id, kind, subject, predicate, object, text, status, confidence, validFrom, validTo, sourceIDs[], supersedes[], blockID }
RetrievalTrace = { queryID, query, filters, lexicalIDs[], semanticIDs[], graphIDs[], finalIDs[], scores, latency, modelVersion }
```

每次记忆写入都必须关联至少一个 `SourceEvent`；模型生成的总结不能自证，若没有来源只能标为 `candidate`。用户编辑 Block 后，系统生成新的 claim 并将旧 claim 标为 `superseded`，避免下次索引把旧版本重新召回。

### 8.4 召回算法

默认召回分为 lexical、semantic、graph、recency、confidence 五路：先用 FTS／语义接口取候选，再用双链／时间过滤扩展，最后按来源可信度、用户确认状态、时间有效性和 token 预算做 rank fusion；每轮返回 citations 和 `why_recalled`，而不是只返回纯文本。

## 9. 分阶段实施计划

### Phase 0：契约冻结与样本集（1 周）

- **改动边界**：新增 `kernel/agent/memory`、`kernel/agent/eval` 的接口草案和 `docs/调研` 样本索引，不改变运行行为。
- **任务**：冻结 `SourceEvent`、`MemoryClaim`、`RetrievalTrace`、ToolEffects、event envelope；从现有 Agent 日志、网页搜索、每日笔记建立 100 条脱敏样本。
- **验收**：每条样本有来源 URL／Block ID、时间、hash；schema round-trip 测试通过；研究轨迹可重放来源状态。

### Phase 1：能力网关与统一事件（2 周）

- **改动边界**：`kernel/mcp/tools/types.go`、`register.go`、`kernel/agent/tools.go`、LLM provider adapter、前端 toolcall types。
- **任务**：加入 Effects、idempotency、cost、provenance、trace ID；把 OpenAI／Anthropic／MCP tool call 统一映射到 `ToolInvocationStarted／Finished／Unknown`。
- **验收**：同一工具在同步、取消、重试和未知副作用下只产生一个可审计 invocation；schema 与前端类型双向测试通过。

### Phase 2：长期记忆平面 MVP（3 周）

- **改动边界**：新增 `kernel/agent/memory/store.go`、`claims.go`、`provenance.go`、`retrieval.go`；复用 Block／DailyNote／Embedding／VectorDB API。
- **任务**：实现 candidate／confirmed／superseded 生命周期、来源事件落盘、每日笔记写入、记忆 dataset、FTS＋semantic 基础召回；增加用户审核 API 和 Agent panel 列表。
- **验收**：用户纠正一个偏好后，后续检索只返回新 claim；删除／撤销不丢来源；跨会话召回 recall@5 ≥ 0.8（基于 Phase 0 样本）。

### Phase 3：时间图与主动信息收集（3 周）

- **改动边界**：新增 `kernel/agent/memorygraph` 投影；扩展 `web_search`、`web_fetch`、`search` 结果 schema；不引入图数据库或新网络客户端。
- **任务**：从 Block refs、属性和来源事件构建时间边；支持 as-of 查询、冲突边、有效期和社区摘要；把网页／资产／MCP 结果统一为 SourceEvent。
- **验收**：能回答“某偏好在指定日期是否有效”并返回来源；同一网页更新后只产生新版本边；图投影可删除后从 Block 重建。

### Phase 4：心跳、巩固与反思（2 周）

- **改动边界**：`kernel/api/magi_runtime.go`、MAGI coordinator、cronjob；扩展而非替换 heartbeat loop。
- **任务**：增加 `memory-consolidation`、`source-refresh`、`reflection` 三类后台任务，支持冷却、预算、睡眠窗口和人工暂停；引入 Reflexion／Generative Agents 风格的候选反思，但必须经过 schema 和 provenance。
- **验收**：闲时任务不会抢占用户 turn；失败有重试上限和 nudge；每次巩固产生可见日志、来源链和 token／耗时指标。

### Phase 5：长任务、浏览器与代码协作（4 周）

- **改动边界**：新增 `kernel/agent/browser`、`kernel/agent/eval`；扩展 task-directory、session snapshot、MCP。
- **任务**：实现观察—动作—等待—回滚轨迹；接入 Browser Use 类浏览器工具；增加 repo map、代码 diff、测试结果和工具轨迹回放；所有写操作沿用现有授权和确认。
- **验收**：浏览器任务可从 checkpoint 恢复且不重复提交；代码任务可重放并得到相同工具序列；凭据、cookie、临时页面不进入长期记忆。

### Phase 6：策略学习与多角色协作（3 周）

- **改动边界**：新增 `kernel/agent/policy`、eval fixtures；扩展 MAGI 视角和 task parent／child。
- **任务**：用 DSPy／Reflexion 思路离线比较 prompt、检索和路由策略；将 AutoGen／CrewAI／ADK 的角色协作映射到 MAGI perspective，不在生产动态改写人格。
- **验收**：策略版本可回滚；离线集合上成功率、引用覆盖率和 token 成本达到发布阈值；任何策略发布都有评测报告和人工批准。

### Phase 7：迁移、观测与长期运营（持续）

- **任务**：把旧 session 摘要转换为带来源的记忆候选；增加 memory dashboard、来源点击、纠正、过期和导出；定期运行回归与数据完整性检查。
- **验收**：旧会话可读；无来源记忆默认不进入高信任召回；VectorDB／图投影损坏时可从 Block 和 SourceEvent 全量重建。

## 10. 验收指标与测试矩阵

| 领域 | 指标 | 最低门槛 | 测试方法 |
|---|---|---|---|
| 事实召回 | recall@5、nDCG@10 | 0.80、0.75 | 固定跨会话问答集，比较 FTS、semantic、graph 和 fusion。 |
| 时间一致性 | as-of accuracy、冲突误召回率 | 0.90、≤0.05 | 构造偏好变更、撤销、有效期和同名实体样本。 |
| 来源完整性 | 有效 claim 的 source coverage | 100% | schema 校验＋随机点击来源回放。 |
| 用户纠正 | correction propagation | 下一次召回生效 | UI 编辑 Block 后重建索引并查询。 |
| 长任务恢复 | checkpoint resume success | ≥0.95 | 在工具前、工具中、响应提交前注入中断。 |
| 副作用安全 | duplicate side-effect rate | 0 | 重试同一 turn／tool call，检查幂等键和审计。 |
| 成本 | 压缩后 token、检索延迟 | 相对基线下降 30%，p95 ≤ 1 s（本地索引） | 固定对话长度和索引规模压测。 |
| 后台陪伴 | 用户 turn 抢占率、heartbeat 完成率 | 0、≥0.95 | 睡眠／唤醒、资源不足和人工暂停场景。 |
| 浏览器轨迹 | 恢复后动作一致性 | ≥0.95 | mock browser replay，禁止真实凭据。 |
| 策略发布 | 回归通过率 | 100% 必测集 | 版本化 eval harness，失败禁止发布。 |

## 11. 主要风险与取舍

- **记忆污染**：自动抽取容易把猜测当事实；用 candidate 状态、来源覆盖和用户确认阻断默认高信任召回。
- **向量幻觉**：相似度不等于事实；必须与 FTS、时间边和来源交叉验证，回答显示 citations。
- **后台失控**：heartbeat 可能消耗资源或重复操作；使用 budget、cooldown、priority ring、nudge、幂等和全局暂停。
- **外部协议漂移**：OpenAI／Anthropic／AutoGen 等 API 会变；核心只依赖内部 event／Tool contract，provider adapter 可替换。
- **过度设施化**：不新增独立向量库、图数据库、技能市场和第二套插件协议；只有浏览器轨迹、记忆投影、eval、policy 这些范式差异足够大的部分才建立平行模块。
- **隐私与可见性**：记忆以用户可见 Block 为权威，敏感网页凭据、cookie、原始密钥和临时 token 只在短期运行态存在，并在写入前做字段级过滤。

## 12. 交付清单

1. 本文档：能力台账、证据链接、s-forge 映射、架构取舍、阶段计划和验收指标。
2. [研究轨迹](AI工具与Harness研究轨迹.md)：URL 状态校验、原始摘录、选择／排除记录、本地源码证据和决策日志。
3. Phase 0 产物：四个 JSON Schema、100 条脱敏样本、source manifest、首版 eval fixtures。
4. Phase 2 产物：记忆 Block 属性、candidate review API、混合检索和用户纠正测试。
5. Phase 4 产物：heartbeat consolidation、reflection provenance、预算和暂停控制。
6. Phase 5 产物：browser trajectory、repo map、任务回放和凭据隔离测试。
7. Phase 6 产物：策略版本、离线评测报告、发布／回滚记录。

## 13. 当前决策摘要

| 决策 | 结论 |
|---|---|
| 是否增加外部记忆数据库 | 否；Block 是权威源，VectorDB／FTS／双链是索引和投影。 |
| 是否增加第二套插件协议 | 否；统一使用现有 MCP／native Tool registry。 |
| 是否把 skill 做成核心设施 | 否；按反模式处理，改用来源事实、策略版本和可评测任务模板。 |
| 是否把浏览器硬塞进 web_fetch | 否；浏览器是观察—动作状态机，建立平行 executor。 |
| 是否允许生产自改 prompt／人格 | 否；学习在 eval 平面离线完成，版本化后人工批准。 |
| 是否保留 MAGI 心跳 | 是；扩展为巩固、刷新和反思调度，并与普通用户 turn 隔离。 |
