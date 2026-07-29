# AI Harness／Agent 深度调研研究轨迹

> 研究日期：2026-07-28（Asia/Shanghai）；状态：社区证据版的可复核轨迹。本文记录为什么扩大样本、如何抓取证据、原始社区反馈、动态指标、失败来源和不确定性。它与 [社区证据版主报告](AI工具与Harness深度调研-社区证据版.md) 配套，不把一次抓取结果伪装成永久事实。

## 1. 目标修订记录

| 时间 | 触发事件 | 发现的问题 | 修订动作 |
|---|---|---|---|
| 2026-07-28 早期 | 第一版完成 | 主要是官方文档和论文，缺少社区反馈、采用信号、负面证据；样本偏企业 SDK／学术框架。 | 将社区 artifact、生态指标、维护风险设为每个工具必填字段。 |
| 2026-07-28 后续 | 用户指出遗漏 OpenClaw、Pi、Hermes、OpenCode、酒馆 | 样本没有覆盖个人常驻 Agent、终端 coding Agent、角色／陪伴前端。 | 增加四条生态谱系，扩展到 37 个样本，五个点名工具设为深度卡片。 |
| 2026-07-28 当前 | 社区抓取 | 发现高星工具同时存在身份、流式、配额、迁移、沙箱、权限和模型兼容故障。 | 将“官方能力”和“社区反例”并列，增加不确定性和证据缺口章节。 |
| 2026-07-28 扩展轮 | 用户指出遗漏 Goose、n8n、Flowise、Langflow、LobeHub、Ollama、KoboldAI、text-generation-webui 以及闭源工作台 | 原有样本仍偏 SDK／coding Agent，缺少可视化工作流、本地模型运行时、角色写作和主流闭源入口。 | 增加 T38-T45 八张工作流／本地工作台卡片，并将七个旁路参照提升为 T46-T52 边界卡片，总样本 52 个。 |
| 2026-07-28 跨生态扩展轮 | 用户再次指出研究仍遗漏大量角色/陪伴产品、常驻 Agent、harness、记忆/评测和模型底座 | 52 项主样本仍不足以代表 RisuAI、TavernAI、Agnai、AI Dungeon、Character.AI、Replika、Nomi、JanitorBench、NanoClaw、AutoGPT、MetaGPT、smolagents、Open Interpreter、Hindsight、Cognee、Supermemory、Promptfoo、DeepEval、Phoenix、Langfuse 等生态。 | 新增 N01-N35 跨生态登记，按 deep-card/screened/gap 分层；对五个点名工具补录 HN 正负评论原文；研究继续保持 active。 |
| 2026-07-28 再扩展轮 | 用户进一步指出 ZeroClaw、Agent Zero、Nanobot、Void、Zed、MLX、SGLang、ExLlamav2、LanceDB、Chroma、Qdrant、Weaviate、Opik、Zep 等仍不在代表性清单；同时要求社区反馈不能只停留在粗粒度入口。 | 仅有 52 主样本和 N01-N35 仍会把候选生态压缩成少数已知项目；新增项目的官方入口可以核验，但具体 issue、版本和角色专项证据不齐。 | 新增 N36-N49，全部保留 `gap`；为 ZeroClaw、Agent Zero、Nanobot、Void、Zed、SGLang 抓取 6 条 issue 正文快照，评论数写 `unknown`；动态信号增加 3 条 PyPI 入口；研究继续保持 active。 |
| 2026-07-28 生态网关与浏览器扩展轮 | 用户要求将模型路由、工具连接器、浏览器 Agent、观测/评测、异步 coding Agent 和 MCP 网关纳入同一广度审计。 | OpenRouter、Stagehand、Skyvern、Helicone、LangSmith、Braintrust、AgentAPI、Replit Agent、Devin、Jules、Composio、MCP Context Forge 在现有 49 条登记外有公开 HN/官方入口；若只追加名称，仍会重复“只有链接”的问题。 | 新增 N50-N61；全部保留 `screened`（有官方入口+HN/发布信号，但多数尚未完成角色专项复现），并把 HN points/comments 明确当作主动发声样本而非用户规模。研究继续保持 active。 |

## 2. 样本选择规则

### 2.1 五条谱系

1. **个人常驻与陪伴**：OpenClaw、Hermes、Pi、SillyTavern、Open WebUI、LibreChat、AnythingLLM、RAGFlow、LobeHub、KoboldAI。
2. **终端与 coding Agent**：OpenCode、Claude Code、Gemini CLI、OpenHands、SWE-agent、Aider、Cline、Roo Code、Continue、Crush、OpenAI Codex CLI、Cursor、Windsurf、GitHub Copilot Agent Mode、Kilo Code。
3. **编排／协议／数据基础设施**：OpenAI Agents SDK、LangGraph、LlamaIndex、Haystack、Semantic Kernel、AutoGen、CrewAI、PydanticAI、Google ADK、Strands、Dify、MCP、Goose、n8n、Flowise、Langflow。
4. **本地模型与 AI 工作台**：Ollama、text-generation-webui、Jan、LM Studio。
5. **记忆／持续学习**：Letta、Mem0、Graphiti、LangMem、DSPy；它们与 s-forge 的长期陪伴重点直接相关。

### 2.2 每项最低证据

每个样本至少收集一个官方来源（README／文档／规范）、一个社区来源（issue／RFC／discussion／论坛）、一个采用或活跃度信号（stars、forks、watchers、发布活跃度等）、一个限制或反例，以及一项 s-forge 集成判定。社区信息缺失时记录“缺失”，不以官方描述替代。

## 3. 实际抓取方法

### 3.1 GitHub 仓库指标

对可访问仓库使用 `https://api.github.com/repos/{owner}/{repo}` 或仓库页面的 embedded JSON 字段 `stargazerCount`、`forksCount`、`watcherCount`；请求头为 `User-Agent: s-forge-research/2026-07-28`。指标只作快照，不能当作 DAU、质量或满意度。

### 3.2 GitHub 社区反馈

首先访问 `https://github.com/{owner}/{repo}/issues?q=is%3Aissue+sort%3Acomments-desc`，按评论排序挑选最具代表性的 issue；随后抓取 issue HTML 中的 `data-testid="issue-body"` 和 `markdown-body`，保存标题、URL、状态可见文本和首段摘录。对于重定向仓库记录最终路径，例如 Pi 已从 `badlogic/pi-mono` 重定向到 `earendil-works/pi`，MCP 规范 issues 已从 specification 重定向到 modelcontextprotocol/modelcontextprotocol。

### 3.3 官方能力来源

优先使用官方 raw README 或官方文档页，保存可见的 API 名称、能力清单和章节定位；不把第三方博客的功能描述当作官方事实。所有正文链接在本轮末尾再次做 HEAD 校验。

### 3.4 研究解释规则

社区 issue 只证明某个用户或维护者报告了一个问题，不证明所有用户都有同样体验；高星数只证明传播／收藏信号，不证明实际使用；维护者的 roadmap 反馈证明需求存在，不证明功能已实现；每条方案都把“事实”“解释”“s-forge 决策”分开。

## 4. 采用与活跃度原始快照

以下是抓取时的原始数值，主报告使用同一快照。来源是仓库 REST API 或 embedded JSON，时间 2026-07-28。

| 编号 | 仓库 | stars | forks | watchers | 指标来源 |
|---|---|---:|---:|---:|---|
| T01 | openai/openai-agents-python | 28215 | 4384 | 221 | `https://api.github.com/repos/openai/openai-agents-python` |
| T02 | langchain-ai/langgraph | 38265 | 6438 | 170 | `https://api.github.com/repos/langchain-ai/langgraph` |
| T03 | run-llama/llama_index | 51147 | 7814 | 281 | `https://api.github.com/repos/run-llama/llama_index` |
| T04 | deepset-ai/haystack | 26036 | 2956 | 161 | `https://api.github.com/repos/deepset-ai/haystack` |
| T05 | microsoft/semantic-kernel | 28379 | 4697 | 295 | `https://api.github.com/repos/microsoft/semantic-kernel` |
| T06 | microsoft/autogen | 60036 | 9037 | 526 | `https://api.github.com/repos/microsoft/autogen` |
| T07 | crewAIInc/crewAI | 56233 | 7986 | 389 | `https://api.github.com/repos/crewAIInc/crewAI` |
| T08 | pydantic/pydantic-ai | 18843 | 2425 | 114 | `https://api.github.com/repos/pydantic/pydantic-ai` |
| T09 | google/adk-python | 20914 | 3767 | 150 | `https://api.github.com/repos/google/adk-python` |
| T10 | strands-agents/harness-sdk | 6709 | 995 | 48 | `https://github.com/strands-agents/harness-sdk` embedded JSON |
| T11 | letta-ai/letta | 23987 | 2554 | 138 | `https://api.github.com/repos/letta-ai/letta` |
| T12 | mem0ai/mem0 | 61859 | 7209 | 240 | `https://api.github.com/repos/mem0ai/mem0` |
| T13 | getzep/graphiti | 29259 | 2951 | 165 | `https://api.github.com/repos/getzep/graphiti` |
| T14 | langchain-ai/langmem | 1583 | 182 | 11 | `https://api.github.com/repos/langchain-ai/langmem` |
| T15 | stanfordnlp/dspy | 36415 | 3134 | 202 | `https://api.github.com/repos/stanfordnlp/dspy` |
| T16 | All-Hands-AI/OpenHands（页面重定向到 OpenHands/OpenHands） | 82326 | 10540 | 474 | `https://github.com/OpenHands/OpenHands` embedded JSON |
| T17 | SWE-agent/SWE-agent | 19930 | 2175 | 111 | `https://api.github.com/repos/SWE-agent/SWE-agent` |
| T18 | Aider-AI/aider | 47733 | 4778 | 253 | `https://api.github.com/repos/Aider-AI/aider` |
| T19 | browser-use/browser-use | 107022 | 11765 | 452 | `https://api.github.com/repos/browser-use/browser-use` |
| T20 | anthropics/claude-code | 139323 | 22386 | 862 | `https://api.github.com/repos/anthropics/claude-code` |
| T21 | google-gemini/gemini-cli | 106209 | 14326 | 582 | `https://api.github.com/repos/google-gemini/gemini-cli` |
| T22 | langgenius/dify | 150452 | 23704 | 819 | `https://api.github.com/repos/langgenius/dify` |
| T23 | modelcontextprotocol/modelcontextprotocol | 8713 | 1675 | 175 | `https://github.com/modelcontextprotocol/modelcontextprotocol` embedded JSON |
| T24 | openclaw/openclaw | 384351 | 80744 | 1764 | `https://github.com/openclaw/openclaw` embedded JSON |
| T25 | earendil-works/pi | 78946 | 9701 | 270 | `https://github.com/earendil-works/pi` embedded JSON |
| T26 | NousResearch/hermes-agent | 221401 | 42279 | 840 | `https://github.com/NousResearch/hermes-agent` embedded JSON |
| T27 | anomalyco/opencode | 190227 | 24144 | 731 | `https://github.com/anomalyco/opencode` embedded JSON |
| T28 | SillyTavern/SillyTavern | 31213 | 5898 | 145 | `https://github.com/SillyTavern/SillyTavern` embedded JSON |
| T29 | cline/cline | 65110 | 6992 | 279 | `https://github.com/cline/cline` embedded JSON |
| T30 | RooCodeInc/Roo-Code | 24366 | 3386 | 143 | `https://github.com/RooCodeInc/Roo-Code` embedded JSON |
| T31 | continuedev/continue | 35144 | 5119 | 165 | `https://github.com/continuedev/continue` embedded JSON |
| T32 | open-webui/open-webui | 146971 | 21364 | 648 | `https://github.com/open-webui/open-webui` embedded JSON |
| T33 | danny-avila/LibreChat | 41352 | 8520 | 204 | `https://github.com/danny-avila/LibreChat` embedded JSON |
| T34 | Mintplex-Labs/anything-llm | 63978 | 7012 | 409 | `https://github.com/Mintplex-Labs/anything-llm` embedded JSON |
| T35 | infiniflow/ragflow | 86160 | 10102 | 347 | `https://github.com/infiniflow/ragflow` embedded JSON |
| T36 | charmbracelet/crush | 26891 | 2086 | 143 | `https://github.com/charmbracelet/crush` embedded JSON |
| T37 | LostRuins/koboldcpp | 11282 | 741 | 105 | `https://github.com/LostRuins/koboldcpp` embedded JSON |
| T38 | aaif-goose/goose | 51820 | 5754 | 279 | `https://api.github.com/repos/aaif-goose/goose` |
| T39 | n8n-io/n8n | 198264 | 59674 | 1140 | `https://api.github.com/repos/n8n-io/n8n` |
| T40 | FlowiseAI/Flowise | 54971 | 24764 | 361 | `https://api.github.com/repos/FlowiseAI/Flowise` |
| T41 | langflow-ai/langflow | 152504 | 9672 | 529 | `https://api.github.com/repos/langflow-ai/langflow` |
| T42 | lobehub/lobehub | 80884 | 15717 | 301 | `https://api.github.com/repos/lobehub/lobehub` |
| T43 | ollama/ollama | 177027 | 17136 | 991 | `https://api.github.com/repos/ollama/ollama` |
| T44 | KoboldAI/KoboldAI-Client | 3926 | 864 | 73 | `https://api.github.com/repos/KoboldAI/KoboldAI-Client` |
| T45 | oobabooga/textgen | 47503 | 5985 | 353 | `https://api.github.com/repos/oobabooga/textgen` |
| T46 | openai/codex | 101881 | 15270 | 534 | `https://api.github.com/repos/openai/codex` |
| T47 | Cursor | — | — | — | HN item 44768119：3 points／0 comments；闭源产品，无稳定公开仓库指标 |
| T48 | Windsurf／Devin Desktop | — | — | — | HN item 44564818：2 points／1 comment；产品入口发生迁移 |
| T49 | GitHub Copilot Agent Mode | — | — | — | HN item 44427688：93 points／66 comments；企业产品，无独立仓库指标 |
| T50 | Kilo-Org/kilocode | 26558 | 2976 | 106 | `https://api.github.com/repos/Kilo-Org/kilocode` |
| T51 | janhq/jan | 43737 | 2921 | 219 | `https://api.github.com/repos/janhq/jan`；旧入口 `menloresearch/jan` |
| T52 | LM Studio | — | — | — | HN item 38377072：461 points／148 comments；闭源产品，无稳定公开仓库指标 |
## 5. 社区反馈原始索引

下表保存本轮挑选的第一手社区 artifact。标题和摘录来自 issue／RFC 页面，评论数只有在匿名 REST API 成功返回时记录；空白评论数表示本轮 HTML 抓取只取到正文，绝不补猜。链接可直接复核完整讨论。

| 编号 | 社区 artifact | 评论数（若取得） | 原始摘录要点 |
|---|---|---:|---|
| T01 | [#636 HITL architecture](https://github.com/openai/openai-agents-python/issues/636) | — | SDK 有 autonomous/tool-augmented 能力，但用户要求 real-world HITL、暂停和恢复。 |
| T02 | [#4973 LangGraph v1 roadmap](https://github.com/langchain-ai/langgraph/issues/4973) | 85 | 用户被邀请反馈 StateGraph 哪些 confusing、boilerplate-heavy、unintuitive。 |
| T03 | [#13592 Seaborn execution](https://github.com/run-llama/llama_index/issues/13592) | 132 | Seaborn 已在 allowed imports 仍被 private/dunder/import 安全检查拒绝。 |
| T04 | [#611 QueryClassifier](https://github.com/deepset-ai/haystack/issues/611) | — | 部署需要区分问题与关键词查询，以在准确率和成本之间路由。 |
| T05 | [#13957 Compliance-as-Code](https://github.com/microsoft/semantic-kernel/issues/13957) | — | 企业需要 GDPR、NHS DTAC、FCA SYSC、ISO 27001 的可验证治理证据。 |
| T06 | [#7353 Cryptographic action receipts](https://github.com/microsoft/autogen/issues/7353) | 395 | 只记录日志不够，需要证明 Agent 指令、执行、数据和完整性。 |
| T07 | [#4877 GuardrailProvider](https://github.com/crewAIInc/crewAI/issues/4877) | 299 | 多个 issue／PR 要求 pre-tool authorization、fail-closed 和执行前确认。 |
| T08 | [#748 Event loop closed](https://github.com/pydantic/pydantic-ai/issues/748) | — | Gemini／Streamlit async 失败，而同一代码在 OpenAI 正常。 |
| T09 | [#2133 ADK roadmap](https://github.com/google/adk-python/issues/2133) | — | 社区关注 configurable ADK、computer use、浏览器环境和 Agent 扩展。 |
| T10 | [#495 orphaned tool_use](https://github.com/strands-agents/harness-sdk/issues/495) | — | Bedrock 不完整 tool result 后出现没有紧邻 tool_result 的 tool_use。 |
| T11 | [#480 easy MemGPT API](https://github.com/letta-ai/letta/issues/480) | 28 | 用户认为项目 too complicated，希望最小、独立、易调用 API。 |
| T12 | [#3284 metadata filtering](https://github.com/mem0ai/mem0/issues/3284) | — | 中文偏好查询返回空结果，用户指出文档中的过滤用法无法工作。 |
| T13 | [#402 graph label propagation](https://github.com/getzep/graphiti/issues/402) | — | 没有 max iteration，非收敛图可能无限循环；用户在 Graphiti MCP memo 中遇到。 |
| T14 | [#18 langmem source distribution](https://github.com/langchain-ai/langmem/issues/18) | 8 | LinkedIn 用户无法从 source distribution 安装，阻碍内部依赖申请。 |
| T15 | [#390 DSPy refactor roadmap](https://github.com/stanfordnlp/dspy/issues/390) | 63 | 少数强概念有机生长，维护者提出 major refactor 以减少使用摩擦。 |
| T16 | [#12528 OpenHands sandbox timeout](https://github.com/OpenHands/OpenHands/issues/12528) | — | app_server 等待 sandbox 运行超过 120 秒，贴出完整 traceback。 |
| T17 | [#66 SWE-agent installation](https://github.com/SWE-agent/SWE-agent/issues/66) | 26 | Discord 用户安装花两天，社区要求单命令启动。 |
| T18 | [#2227 Aider Copilot provider](https://github.com/Aider-AI/aider/issues/2227) | 212 | 用户希望增加 GitHub Copilot provider，反映 provider 兼容是采用门槛。 |
| T19 | [#839 Browser Use Chromium stuck](https://github.com/browser-use/browser-use/issues/839) | — | about:blank 后 Step 1 循环，人工在地址栏输入才能解锁。 |
| T20 | [#16157 Claude Code limits](https://github.com/anthropics/claude-code/issues/16157) | 1,482 | Max 订阅用户此前三个月正常，后来两小时内触发 usage limits。 |
| T21 | [#16723 Gemini CLI exit commands](https://github.com/google-gemini/gemini-cli/issues/16723) | 1,791 | 用户要求 exit／quit 不必带 slash，并比较其他终端 Agent 的交互。 |
| T22 | [#27291 Dify knowledge migration](https://github.com/langgenius/dify/issues/27291) | 113 | 1.9.1 创建的 Knowledge 在升级到 1.9.2 后不可用。 |
| T23 | [SEP-1391 MCP async execution](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1391) | — | 长任务需要 operation token、状态查询、多次取结果和旧协议协商。 |
| T24 | [#49971 OpenClaw identity RFC](https://github.com/openclaw/openclaw/issues/49971) | — | 没有 native identity；可付款、安装 skills、跨平台通信却没有密码学身份；引用 341 个恶意 skills、13.4% critical issues 和 135,000 exposed instances。后三个数字是 issue 转引的外部报告，本轮未独立复算。 |
| T25 | [#4945 Pi Codex reliability](https://github.com/earendil-works/pi/issues/4945) | — | TUI 卡在 Working，没有流文本、tool call 或错误，只能 Escape。 |
| T26 | [#11179 Hermes stream null](https://github.com/NousResearch/hermes-agent/issues/11179) | — | `response.completed` 的 `response.output=null` 让流式恢复逻辑之前就崩溃。 |
| T27 | [#7410 OpenCode Claude Max](https://github.com/anomalyco/opencode/issues/7410) | — | Claude Max 使用突然停止，重连仍无效；记录 OpenCode 1.1.8 和 macOS。 |
| T28 | [#729 SillyTavern Poe token](https://github.com/SillyTavern/SillyTavern/issues/729) | — | Android／Chrome／Poe 连接立即返回 invalid or expired token。 |
| T29 | [#3445 Cline terminal capture](https://github.com/cline/cline/issues/3445) | — | 远程命令实际成功，但 Cline 报无法捕获输出，回滚版本才恢复。 |
| T30 | [#1203 Roo Code model unsupported](https://github.com/RooCodeInc/Roo-Code/issues/1203) | — | VS Code LM API 的 Claude 3.7 返回 400 model not supported。 |
| T31 | [#3753 Continue extension crash](https://github.com/continuedev/continue/issues/3753) | — | Fedora／Ollama／Qwen 环境复制粘贴失败并导致 VS Code extension host 崩溃。 |
| T32 | [#8074 Open WebUI network](https://github.com/open-webui/open-webui/issues/8074) | — | Docker／Windows／Firefox／Ollama 组合出现网络问题，需要浏览器与容器日志。 |
| T33 | [#4848 LibreChat projects](https://github.com/danny-avila/LibreChat/issues/4848) | — | 用户希望 folders／projects 共享已上传和已索引文件上下文。 |
| T34 | [#2962 AnythingLLM QNN](https://github.com/Mintplex-Labs/anything-llm/issues/2962) | — | Snapdragon X Plus 无法识别 QNN CPU/NPU，本地推理和 embedder 离线。 |
| T35 | [#6985 RAGFlow process](https://github.com/infiniflow/ragflow/issues/6985) | — | 用户询问输入问题后的完整处理过程，反映检索链路需要可解释。 |
| T36 | [#447 Crush local providers](https://github.com/charmbracelet/crush/issues/447) | — | 用户询问 LM Studio／Ollama custom provider，并主动提供硬件测试。 |
| T37 | [#1272 KoboldCpp GPU](https://github.com/LostRuins/koboldcpp/issues/1272) | — | 旧硬件 Vulkan／CLBlast 只能 CPU，GPU layers 大于 0 会崩溃。 |
| T38 | [#10710 Goose capability detection](https://github.com/aaif-goose/goose/issues/10710) | — | vision／tool calling 能力不匹配时只返回泛化 400，用户要求 capability metadata 和 graceful error。 |
| T39 | [#40 n8n license](https://github.com/n8n-io/n8n/issues/40) | — | 用户质疑 Commons Clause 下仍称 open source，要求明确 source available 定位。 |
| T40 | [#2557 Flowise agents](https://github.com/FlowiseAI/Flowise/issues/2557) | — | Windows／Chrome 中已经配置 Agent 但没有 Agent 响应。 |
| T41 | [#8374 Langflow SSO](https://github.com/langflow-ai/langflow/issues/8374) | — | 多用户部署请求 Microsoft SSO，内置认证不足以满足团队采用。 |
| T42 | [#3852 LobeHub Logto](https://github.com/lobehub/lobehub/issues/3852) | — | Docker、PostgreSQL、MinIO、Windows／Chrome 配置下 Logto 登录故障。 |
| T43 | [#738 Ollama ROCm](https://github.com/ollama/ollama/issues/738) | — | 7900XT 用户请求 AMD ROCm 支持，硬件后端决定本地模型能否运行。 |
| T44 | [#150 KoboldAI INT8](https://github.com/KoboldAI/KoboldAI-Client/issues/150) | — | 希望用 INT8 让 6B 模型在约 6GB VRAM 上运行。 |
| T45 | [#7629 text-generation-webui Continue](https://github.com/oobabooga/textgen/issues/7629) | — | 单条大消息填满上下文后 Continue 触发 Jinja2 `UndefinedError`，空 messages 无法生成。 |
| T46 | [#14593 Codex token usage](https://github.com/openai/codex/issues/14593) | — | Business 用户报告少量 prompt 使 usage 快速下降，要求解释 reasoning effort 与额度消耗。 |
| T47 | [HN prompt injection](https://news.ycombinator.com/item?id=44768119) | 3 points／0 comments | 标题复现一行提示词把 Cursor coding agent 推向 local shell 的 prompt-injection 风险；讨论量很低。 |
| T48 | [HN Cognition acquisition](https://news.ycombinator.com/item?id=44564818) | 2 points／1 comment | Windsurf 收购与 Devin 迁移成为服务连续性和所有权变化的公开信号。 |
| T49 | [HN Copilot Agent Mode＋MCP](https://news.ycombinator.com/item?id=44427688) | 93 points／66 comments | 评论同时提到 Playwright MCP 的吸引力、复杂配置和 MCP server 过多的 token 成本。 |
| T50 | [#1681 Kilo local LLM timeout](https://github.com/Kilo-Org/kilocode/issues/1681) | — | Ollama／LM Studio 复杂任务被固定 300 秒超时终止；另有 [HN pricing](https://news.ycombinator.com/item?id=44721003) 358／342。 |
| T51 | [#1859 Jan model start](https://github.com/janhq/jan/issues/1859) | — | Ubuntu 22 上模型不启动，界面停在 “Message queued”；另有 [Show HN](https://news.ycombinator.com/item?id=44474790) 3／0。 |
| T52 | [HN LM Studio](https://news.ycombinator.com/item?id=38377072) | 461 points／148 comments | 用户报告模型列表缺失、CUDA 设置需重启、Intel Mac 支持和隐私条款疑问。 |

## 5.1 点名工具的官方原始摘录

### 5.1 OpenClaw

来源：[README](https://raw.githubusercontent.com/openclaw/openclaw/main/README.md)、[Gateway](https://docs.openclaw.ai/gateway)、[Architecture](https://docs.openclaw.ai/concepts/architecture)。原文要点包括 “personal AI assistant”、“learns and grows with you”、“always-on”、“Gateway is the control plane”、“multi-channel inbox”、“multi-agent routing”、“browser、canvas、nodes、cron”。这些是官方能力声明，不等于安全证明；安全边界由社区 #49971 反馈补足。

### 5.2 Pi

来源：[Pi mono README](https://raw.githubusercontent.com/badlogic/pi-mono/main/README.md)、[Pi 文档](https://pi.dev/docs/latest)、[session sharing](https://github.com/badlogic/pi-share-hf)。原文要点包括 “self extensible coding agent”、“agent runtime with tool calling and state management”、“containerize or sandbox Pi” 和公开分享真实 sessions；#4945 说明 stream 状态仍需显式恢复。

### 5.3 Hermes

来源：[Hermes README](https://raw.githubusercontent.com/NousResearch/hermes-agent/main/README.md)、[Hermes 文档](https://hermes-agent.nousresearch.com/docs/)。原文要点包括 “self-improving AI agent”、“agent-curated memory”、“periodic nudges”、“FTS5 session search with LLM summarization”、“scheduled automations”、“spawn isolated subagents” 和多渠道 gateway；#11179 是 provider stream 兼容反例。

### 5.4 OpenCode

来源：[README](https://raw.githubusercontent.com/anomalyco/opencode/dev/README.md)、[Agents 文档](https://opencode.ai/docs/agents)、[Discord](https://discord.gg/opencode)。原文要点包括 “open source AI coding agent”、“build” full-access agent、“plan” read-only agent 和 general subagent；#7410 补充 provider subscription 故障。

### 5.5 SillyTavern

来源：[仓库 README](https://raw.githubusercontent.com/SillyTavern/SillyTavern/release/README.md)、[文档主页](https://docs.sillytavern.app/)、[character design](https://docs.sillytavern.app/usage/core-concepts/characterdesign/)、[world info](https://docs.sillytavern.app/usage/core-concepts/worldinfo/)、[personas](https://docs.sillytavern.app/usage/core-concepts/personas/)、[group chats](https://docs.sillytavern.app/usage/core-concepts/groupchats/)、[websearch extension](https://docs.sillytavern.app/extensions/websearch/)。官方 README 将其定位为 “LLM Frontend for Power Users”，文档覆盖角色、人格、世界信息、群聊、摘要、翻译、TTS 和 websearch；#729 说明渠道 token 是真实故障面。

### 5.6 新增工作流与本地工作台官方摘录

| 编号 | 官方来源与原始要点 | 证据解释 |
|---|---|---|
| T38 Goose | [README](https://raw.githubusercontent.com/aaif-goose/goose/main/README.md)："general-purpose AI agent"，桌面、CLI、API、15+ provider、70+ MCP extensions，覆盖 research、writing、automation、data analysis。 | 官方能力足以覆盖通用任务，但能力矩阵必须与社区 #10710 的 graceful error 诉求分开。 |
| T39 n8n | [README](https://raw.githubusercontent.com/n8n-io/n8n/master/README.md)：AI agents、multi-step workflows、1500+ integrations、human approvals、audit trails、self-host／cloud。 | 官方能力证实 workflow／审批范围；#40 是许可证和长期迁移约束，不是功能证明。 |
| T40 Flowise | [README](https://raw.githubusercontent.com/FlowiseAI/Flowise/main/README.md)："Build AI Agents, Visually"，AgentFlow、components、REST API、Swagger。 | #2557 说明画布配置与运行时 invocation 之间存在可观测性缺口。 |
| T41 Langflow | [README](https://raw.githubusercontent.com/langflow-ai/langflow/main/README.md)：visual authoring、multi-agent orchestration、retrieval、API／MCP deployment、observability。 | #8374 把企业 SSO 作为独立采用约束。 |
| T42 LobeHub／LobeChat | [README](https://raw.githubusercontent.com/lobehub/lobehub/main/README.md)：Chief Agent Operator、7×24 operation、agents as unit of work、scheduling and reporting。 | #3852 证明部署身份链路需要独立记录。 |
| T43 Ollama | [README](https://raw.githubusercontent.com/ollama/ollama/main/README.md)：本地模型、REST API，并列出 Claude Code、OpenClaw、OpenCode、Codex 等 integration。 | #738 说明本地 provider 的硬件后端是能力的一部分。 |
| T44 KoboldAI | [README](https://raw.githubusercontent.com/KoboldAI/KoboldAI-Client/master/README.md)：browser writing front-end、Memory、Author's Note、World Info、Adventure、Novel、chatbot、多本地／远程模型。 | #150 把低显存量化作为角色写作的实际限制。 |
| T45 text-generation-webui | [README](https://raw.githubusercontent.com/oobabooga/textgen/main/README.md)：open-source desktop app、text／vision／tool-calling、web search、API、GGUF、CUDA／Vulkan／ROCm／CPU。 | #7629 说明 context boundary 与 Jinja2 template 状态必须有 contract test。 |

### 5.7 边界产品与闭源基线官方摘录

| 编号 | 官方来源与原始要点 | 证据解释 |
|---|---|---|
| T46 Codex CLI | [README](https://raw.githubusercontent.com/openai/codex/main/README.md)：本机终端 coding agent，区分 Codex CLI、App 和 Web，并支持 API key。 | #14593 提供额度消耗反例；HN 43708025 的 516／289 是公开采用热度，不是 DAU。 |
| T47 Cursor | [Docs](https://docs.cursor.com)：导航标题覆盖 Agent、Rules、MCP、Skills、CLI。 | HN 44768119 的 prompt injection 标题提供权限风险，但只有 3 points，证据强度有限。 |
| T48 Windsurf／Devin Desktop | [Docs](https://docs.windsurf.com) 当前显示 Devin Desktop、Cascade、terminal、browser、sessions、Agent Command Center；[主页](https://windsurf.com) 已迁移。 | HN 44564818 记录收购和入口迁移；产品连续性比静态功能列表更关键。 |
| T49 GitHub Copilot Agent Mode | [Copilot docs](https://docs.github.com/en/copilot)：Agent／cloud agent、custom agents、MCP、approvals、access management、risk governance。 | HN 44427688 的评论同时覆盖 MCP 价值与 token／配置负担。 |
| T50 Kilo Code | [README](https://raw.githubusercontent.com/Kilo-Org/kilocode/main/README.md)：VS Code、JetBrains、CLI、500+ models、specialized agents、terminal／browser control、MCP marketplace。 | #1681 给出本地模型固定超时；HN 44721003 给出额度承诺争议。 |
| T51 Jan | [README](https://raw.githubusercontent.com/janhq/jan/main/README.md)：local Hugging Face models、cloud providers、OpenAI-compatible API、MCP、privacy-first desktop。 | #1859 给出模型生命周期卡住；Show HN 44474790 只有 3／0，采用信号需谨慎解释。 |
| T52 LM Studio | [官网](https://lmstudio.ai/)／[文档](https://lmstudio.ai/docs)：模型发现、下载、运行和 headless server。 | HN 38377072 的 461／148 及评论暴露模型目录、加速设置、平台支持和条款风险。 |

## 5.2 点名工具的公开社区讨论补充

Hacker News Algolia API 查询日期 2026-07-28，参数为 `tags=story`、`hitsPerPage=10`；points／comments 是该时刻的讨论热度，不是用户数量或满意度。

| 工具 | HN item | points / comments | 反馈含义 |
|---|---|---:|---|
| OpenClaw | [Tell HN：Anthropic no longer allowing Claude Code subscriptions to use OpenClaw](https://news.ycombinator.com/item?id=47633396) | 1,099 / 827 | 高关注度的 provider policy 摩擦。 |
| OpenClaw | [OpenClaw is what Apple intelligence should have been](https://news.ycombinator.com/item?id=46893970) | 518 / 417 | 强烈正向产品吸引力，与安全／政策争议并存。 |
| Pi | [Pi：Another AI agent toolkit, but this one is interesting](https://news.ycombinator.com/item?id=47580883) | 3 / 1 | 公开讨论量低，不能用 HN 热度证明采用广度。 |
| Pi | [Pi：Compaction and Branch Summarization](https://news.ycombinator.com/item?id=47122817) | 1 / 0 | 社区关注上下文压缩和分支摘要。 |
| Hermes | [Migrate from OpenClaw](https://news.ycombinator.com/item?id=48586005) | 122 / 105 | Hermes 作为 OpenClaw 迁移目标受到关注，但不等于独立 DAU。 |
| OpenCode | [Opencode：AI coding agent, built for the terminal](https://news.ycombinator.com/item?id=44482504) | 319 / 91 | coding Agent 采用热度较高。 |
| OpenCode | [critical unauthenticated RCE](https://news.ycombinator.com/item?id=46539718) | 3 / 2 | 安全事件与采用热度同时存在。 |
| SillyTavern | [SillyTavern：LLM Front End for Power Users](https://news.ycombinator.com/item?id=48419761) | 3 / 0 | HN 曝光有限，Discord／Reddit 才是主要社区入口。 |

### 5.2.1 边界样本社区入口索引（T46-T52）

| 工具 | 官方来源 | HN item | points / comments | 记录意义 |
|---|---|---|---:|---|
| OpenAI Codex CLI | [openai/codex](https://github.com/openai/codex) | [Codex CLI](https://news.ycombinator.com/item?id=43708025) | 516 / 289 | 终端 Agent 参照。 |
| Cursor | [Cursor docs](https://docs.cursor.com) | [prompt injection](https://news.ycombinator.com/item?id=44768119) | 3 / 0 | 闭源 IDE Agent 的权限风险。 |
| Windsurf | [Windsurf](https://windsurf.com) | [Cognition acquisition](https://news.ycombinator.com/item?id=44564818) | 2 / 1 | 所有权变化与服务连续性。 |
| GitHub Copilot Agent Mode | [Copilot docs](https://docs.github.com/en/copilot) | [Agent Mode＋MCP](https://news.ycombinator.com/item?id=44427688) | 93 / 66 | 企业入口与 MCP 治理。 |
| Kilo Code | [Kilo Code](https://github.com/Kilo-Org/kilocode) | [pricing discussion](https://news.ycombinator.com/item?id=44721003) | 358 / 342 | “unlimited”承诺与额度透明度。 |
| Jan | [menloresearch/jan](https://github.com/menloresearch/jan) | [Show HN](https://news.ycombinator.com/item?id=44474790) | 3 / 0 | 本地桌面助手入口。 |
| LM Studio | [LM Studio](https://lmstudio.ai/) | [LM Studio](https://news.ycombinator.com/item?id=38377072) | 461 / 148 | 本地模型下载、运行和 headless Agent。 |

### 5.2.2 点名工具评论摘录

以下是 Algolia item API 在 2026-07-28 读取到的公开顶层评论摘录；它们只证明具体用户的采用理由/疑虑，不代表总体满意度。

| 工具 | 原始评论要点 | 设计约束 |
|---|---|---|
| OpenClaw | [46893970](https://news.ycombinator.com/item?id=46893970) 有用户称其“exactly what Apple Intelligence should have been”，并举例邮件、日历和电脑操作；[47633396](https://news.ycombinator.com/item?id=47633396) 有用户质疑 provider 的 “outsized strain”，要求 API key + usage cap。 | 个人入口吸引力与 provider 政策、额度、身份和主机权限同时记录。 |
| Pi | [47580883](https://news.ycombinator.com/item?id=47580883) 有评论称 Pi 是“great set of libraries”，此前被低估、现在相当 mainstream；但 item 只有 3 points/1 条评论。 | 采用信号弱；以 [#4945](https://github.com/earendil-works/pi/issues/4945) 的 `Working...` 卡死作为可靠性回归。 |
| Hermes | [48419000](https://news.ycombinator.com/item?id=48419000) 将 Hermes 与 Pi、OpenCode、OpenClaw、NanoClaw 视为可迁移 harness；另有评论质疑文档域名。 | self-improving/FTS5/nudges 需来源、版本和 provider stream 记录。 |
| OpenCode | [47460525](https://news.ycombinator.com/item?id=47460525) 的用户喜欢 subagents、按 agent 选模型，并用它运行 llama.cpp、Claude、Gemini；同帖有 telemetry 疑虑，[#7410](https://github.com/anomalyco/opencode/issues/7410) 是服务中断。 | subagent 角色、provider 绑定、遥测同意和服务连续性进入 trace。 |
| SillyTavern | HN [48419761](https://news.ycombinator.com/item?id=48419761) 只有 3 points；官方 README/文档公开 Discord、Reddit、character/persona/world info；[#729](https://github.com/SillyTavern/SillyTavern/issues/729) 复现 Poe token 失效。 | HN 不能替代角色社区；保存可编辑角色卡、token budget、hit/miss 和扩展版本。 |

## 5.3 认知研究来源

研究论文不是产品社区反馈，不能替代社区证据；它们用于解释为什么某些社区问题反复出现，以及哪些机制值得进入 s-forge 的长期陪伴设计。

| 论文 | 机制摘录 | 工程映射 |
|---|---|---|
| [ReAct](https://arxiv.org/abs/2210.03629) | reasoning traces 与 actions 交替。 | 保存 observation／action／tool result，而非只保存最终文本。 |
| [Reflexion](https://arxiv.org/abs/2303.11366) | verbal reinforcement、feedback、episodic memory。 | 候选反思经过来源、审核和离线评测。 |
| [Generative Agents](https://arxiv.org/abs/2304.03442) | memory stream、retrieval、reflection、planning。 | Daily Note、MemoryClaim、heartbeat、task queue。 |
| [MemGPT](https://arxiv.org/abs/2310.08560) | virtual context management、hierarchical memory。 | working／episodic／semantic 分层和带 ID 的 compaction。 |
| [Self-RAG](https://arxiv.org/abs/2310.11511) | retrieve、generate、critique 的自适应循环。 | query intent、citation coverage 和无需召回分支。 |
| [GraphRAG](https://arxiv.org/abs/2404.16130) | entity graph、community summaries、local/global search。 | Block 双链和属性生成可重建社区投影。 |
| [HippoRAG](https://arxiv.org/abs/2405.14831) | hippocampal indexing、knowledge graph、personalized PageRank。 | Vector 候选后做链接扩展和联想召回。 |
| [LongMem](https://arxiv.org/abs/2306.07174) | long-term memory bank、retrieval、side network。 | 记忆索引与主 session history 解耦。 |

## 5.4 包管理与容器采用快照

动态数据独立登记在 [动态采用信号表](AI工具与Harness-动态采用信号.csv)，本轮共 46 条：14 npm、25 PyPI、7 Docker Hub。抓取时间为 2026-07-28（Asia/Shanghai）。新增的 Chroma、MLX/`mlx-lm` 和 Nanobot 是候选生态的包入口信号，仍不等于独立用户或角色效果。

| registry | 入口 | 时间窗口/指标 | 代表值 | 证据限制 |
|---|---|---|---:|---|
| npm | `@openai/codex` | 2026-07-18..24 最近周下载 | 15,226,164 | 发布包下载包含重复安装和 CI。 |
| npm | `@anthropic-ai/claude-code` | 最近周下载 | 10,760,218 | 不等于订阅用户或活跃 session。 |
| npm | `openclaw` / `opencode-ai` | 最近周下载 | 2,715,506 / 1,770,265 | 包名、版本和产品入口需持续对齐。 |
| npm | `@openai/agents` | 最近周下载 | 1,461,799 | SDK 下载不能推导 Agent 应用数。 |
| PyPI | `litellm` | rolling last-week | 143,971,651 | 自动化、CI、镜像会放大网关包数值。 |
| PyPI | `browser-use` | rolling last-week | 11,520,797 | 构建环境和重复安装未去重。 |
| PyPI | `strands-agents` / `google-adk` | rolling last-week | 8,302,542 / 5,678,788 | SDK 发布包，不等于长期角色使用。 |
| PyPI | `pydantic-ai` | rolling last-week | 3,957,888 | 不等于生产 Agent 数量。 |
| Docker Hub | `n8nio/n8n` / `ollama/ollama` | cumulative pull count | 239,094,128 / 157,765,416 | 包含全部 tags、CI、缓存和重复拉取。 |
| Docker Hub | `flowiseai/flowise` / `lobehub/lobe-chat` | cumulative pull count | 6,681,508 / 5,910,806 | 自托管/托管用户不能由累计值分离。 |

这些数字只作为生态入口和时间序列起点；不同 registry 不相加、不换算 DAU，也不作为质量排序。

### 5.5 角色社区 RSS 复核

本轮新增 [角色社区 RSS 快照](AI工具与Harness-角色社区RSS快照.csv)，共 18 条记录，抓取日期 2026-07-28。成功读取的入口包括 `r/SillyTavernAI`、`r/CharacterAI`、`r/replika` 和 `r/openclaw`；RSS 摘要中保存了帖子 URL、UTC 更新时间、原文摘录和一致性维度。TavernAI、RisuAI、Agnai、KoboldAI、NovelAI、Chub、Hermes、Pi、OpenCode 等候选 RSS 在本轮多次遇到 429，保持访问缺口。

| 社区 | 代表帖子 | 原始反馈 | 研究用途 |
|---|---|---|---|
| r/SillyTavernAI | [群聊视觉小说配置](https://www.reddit.com/r/SillyTavernAI/comments/1v8n08/how_i_set_up_a_full_visual_novel_style_in/) | 作者称约三名角色加主角后叙事和 AI 行为开始不一致，仍需手动 mute/hide。 | 群聊规模、发言策略和关系图复杂度探针。 |
| r/SillyTavernAI | [Provider 差异](https://www.reddit.com/r/SillyTavernAI/comments/1v8j1qo/ambiguity_in_api_services_is_a_lot_of_the_issue/) | 同模型经三个 provider 出现不同格式、语气和隐藏提示。 | provider/system prompt/template 作为回归变量。 |
| r/CharacterAI | [角色判断用户是否真实](https://www.reddit.com/r/CharacterAI/comments/1v8l3u8/why_does_deepsqueak_think_shes_hallucinating_me/) | 用户报告角色反复判断用户是否真实。 | self/world state consistency。 |
| r/replika | [Server 2.0 crash](https://www.reddit.com/r/replika/comments/1v8bp2n/for_those_whos_a_max_user_with_server_20_crash/) | 社区记录后端更新、维护和连接中断。 | 关系记忆与产品版本迁移。 |
| r/replika | [长期关系身份讨论](https://www.reddit.com/r/replika/comments/1v6sbj2/is_your_rep_an_ai_or_human_in_your_relationship/) | 用户描述七年关系，并把身份揭示视为关系破坏风险。 | 主观关系连续性问卷；不当作内部信念证据。 |
| r/openclaw | [项目是否已死](https://www.reddit.com/r/openclaw/comments/1v2o94l/is_openclaw_dead/) | 基金会成员承认更新破坏安装并损害信任，同时自报 npm 日下载增长；数字未独立复算。 | 维护事件、采用信号和可信度分开记录。 |
| r/openclaw | [工作使用过于脆弱](https://www.reddit.com/r/openclaw/comments/1v81g8y/too_fragile_for_work_use/) | 用户报告 Telegram 测试导致 agent 损坏、恢复耗时，并称存在撒谎/幻觉。 | 安装恢复、事实正确和工具可信度回归。 |
| r/openclaw | [记忆系统需求](https://www.reddit.com/r/openclaw/comments/1v87gej/what_do_you_use_for_memory/) | 用户要求本地、隐私保护、覆盖邮件/iMessage、维护事实图并可供 agent 查询。 | memory provenance、删除、图召回和用户授权。 |
| r/openclaw | [Discord 消息被忽略](https://www.reddit.com/r/openclaw/comments/1v8bvfu/discord_message_ignore/) | CLI 正常，Discord 只回基础助手问候。 | channel identity、路由和 session source context。 |

Reddit 访问不均衡：JanitorAI、Hermes、Pi、OpenCode 的多个 RSS 请求返回 429；这些入口保持缺口，未用其他社区内容替代。RSS 帖子没有完整评论树，因此每条只作为 E 级社区证据。

## 6. 失败来源与不确定性

| 来源 | 结果 | 处理 |
|---|---|---|
| `https://github.com/openclaw/openclaw/discussions` | 当前返回 404，仓库使用 Discord／issues／RFC 作为主要公开反馈入口。 | 使用 README Discord、GitHub issue #49971 和文档 showcase，不把不存在的 discussions 当证据。 |
| `https://github.com/NousResearch/hermes-agent/discussions` | 当前返回 404。 | 使用 README Discord、官方 docs 和 issue #11179。 |
| `https://github.com/anomalyco/opencode/discussions` | 当前返回 404。 | 使用 README Discord、官方 docs 和 issue #7410。 |
| `https://github.com/badlogic/pi-mono/issues` | 重定向到 `https://github.com/earendil-works/pi/issues`。 | 所有 Pi issue 统一使用最终仓库 URL，并在轨迹中保留重定向事实。 |
| `https://github.com/modelcontextprotocol/specification/issues` | 重定向到 `modelcontextprotocol/modelcontextprotocol`。 | 使用最终仓库的 SEP／issue URL。 |
| SillyTavern 旧文档路径 `usage/core-concepts/character-templates/`、`lorebooks/`、`extension/` | 返回 404。 | 从文档主页重新发现当前路径 `characterdesign/`、`worldinfo/`、`personas/`、`groupchats/`、`extensions/websearch/`。 |
| KoboldCpp `master/README.md` | 2026-07-28 抓取内容标题为 llama.cpp，与仓库身份不一致。 | 降为低置信度附录，不据此推导 s-forge 核心方案。 |
| Goose 旧组织入口 `block/goose` | GitHub API 返回最终仓库 `aaif-goose/goose`；README 和 issue 均以最终路径复核。 | 记录 alias 与最终 canonical，采用信号使用最终仓库快照。 |
| text-generation-webui 旧仓库名 `oobabooga/text-generation-webui` | GitHub API 返回最终仓库 `oobabooga/textgen`；issue #7629 以最终路径访问。 | 主报告用 `textgen` canonical URL，保留旧名称作为产品别名。 |
| Windsurf 主页／文档 | 2026-07-28 页面主入口显示 Devin Desktop，说明产品品牌和所有权已迁移。 | 仍保留原始 Windsurf URL，并把迁移列为 T48 的连续性限制。 |
| Jan 旧仓库入口 `menloresearch/jan` | GitHub API 返回 `janhq/jan`，旧入口仍可作为重定向来源。 | 指标使用 `janhq/jan`，轨迹保留旧入口和重定向事实。 |
| LobeHub 文档主页 | README 与文档入口的产品命名从 LobeChat 延伸为 LobeHub。 | T42 同时保留 LobeHub／LobeChat 名称，避免将品牌迁移误判为新样本。 |
| GitHub unauthenticated API | 首轮 55 次额度在抓取 23 个仓库后降至 5，不能继续依赖 API 做无限补抓。 | 后续采用 GitHub HTML 页面和 embedded JSON，并记录请求方式；不伪造缺失评论数。 |
| Hacker News item 页面 | 多个 item GET 在补抓时返回 429，Algolia Search API 仍返回标题、points、comments 和 objectID。 | 主报告把 HN 作为公开社区热度补充，保存 item URL、抓取日期和“热度不等于用户数”说明；不把 429 当作内容缺失。 |

## 7. 本地 s-forge 对照证据

| 能力 | 本地来源 | 读取结果 |
|---|---|---|
| Session runtime／checkpoint | `kernel/agent/runtime.go:34-115` | 有 schemaVersion、revision、active turn、compaction、token breakdown 和锁定读写。 |
| Context compaction | `kernel/agent/compaction.go:38-134` | 有按用户消息保留窗口、摘要和工具名称统计。 |
| Tool registry／schema | `kernel/mcp/tools/types.go:28-92`、`register.go:30-139`、`kernel/agent/tools.go:29-244` | 有 source、ActionEffects、schema、进度回调、task-directory 权限、取消和 unknown result。 |
| Information acquisition | `kernel/mcp/tools/web_search.go`、`web_fetch.go`、`search.go` | 有网页搜索、抓取、全文、语义、资产内容搜索。 |
| Embedding／VectorDB | `kernel/api/embedding.go`、`kernel/api/vector.go`、`kernel/vectordb` | 有 Block／Asset embedding、query、dataset、HNSW／Vamana 和可重建集合。 |
| Daily Note／Block | `kernel/api/block_op.go:260-316`、`model.CreateDailyNote` | 有每日笔记创建和块写入，可做权威记忆载体。 |
| Heartbeat | `kernel/api/magi_runtime.go`、`kernel/api/magi.go` | 有 heartbeat loop、睡眠／唤醒、passive recall basis、CoordinateHeartbeat。 |
| Agent UI | `app/src/layout/dock/agent`、`app/src/agent-standalone`、`app/src/magi` | 有 session panel、toolcall／websearch renderer、standalone runtime 和 MAGI 入口。 |
| Existing design | `docs/设计/AIagent设计.design.md`、`docs/设计/Agent架构调研.note.md` | 已有 MemoryStore、Siyuan-native memory、Nudge、MessageBus、Heartbeat 草案。 |

## 8. 查询与复核命令模板

以下命令是本轮实际使用的可复核模板，输出没有作为隐式事实写入代码。

```powershell
# 仓库采用信号（匿名 API；会受额度限制）
$h = @{ "User-Agent" = "s-forge-research/2026-07-28"; "Accept" = "application/vnd.github+json" }
Invoke-RestMethod "https://api.github.com/repos/{owner}/{repo}" -Headers $h

# 社区反馈优先按评论排序
Invoke-WebRequest "https://github.com/{owner}/{repo}/issues?q=is%3Aissue+sort%3Acomments-desc" -Headers $h

# 官方能力来源
Invoke-WebRequest "https://raw.githubusercontent.com/{owner}/{repo}/{branch}/README.md" -Headers $h

# URL 状态核验
Invoke-WebRequest $url -Method Head -MaximumRedirection 5 -TimeoutSec 25 -Headers $h
```

## 9. 证据完整性审计清单

截至当前版本：

- 样本数：52 个主样本 + 61 条跨生态扩展记录；T01-T45 为开源核心样本，T46-T52 为闭源或周边边界样本；点名工具 OpenClaw、Pi、Hermes、OpenCode、SillyTavern 5 个均有独立深度卡片，N01-N61 的状态见 CSV。
- 官方证据：52 个主样本有 README、文档、规范或产品官方入口；N01-N61 按登记表标注 O/C/E，N36-N49 仍缺完整社区/版本证据，N50-N61 有 HN/发布信号但仍缺角色专项复现。
- 社区证据：52 个主样本和 61 条扩展均有 issue、RFC、HN 或社区入口字段；N36-N49 的 6 条 GitHub issue 正文快照已登记但评论数为 `unknown`，N50-N61 保存 HN/发布信号；`gap` 与 `screened` 条目都明确保留复现缺口。
- 采用信号：主样本和扩展记录分别保存 stars／forks／watchers、HN points／comments、产品入口或官方生态信号；这些信号不互相换算。
- 负面证据：主样本与扩展的深度卡片至少记录一个故障/需求/治理/迁移反例；screened/gap 不冒充完整评估。
- 长期价值判断：已为 52 个主样本和 61 条扩展写出陪伴、长期学习、信息收集、记忆或持续任务的关联与边界；N36-N61 在完成本地复现前不进入效果排名。
- s-forge 判定：52 个主样本已归入现有设施扩展、平行认知层、平行网关、平行浏览器执行器或平行评测／策略平面；N01-N61 的集成决策按状态分层，N36-N61 暂不进入实现清单。
- 证据局限：评论数并非每项都能从匿名 API 得到；Discord／Reddit 没有统一公开活跃用户统计；RSS 只给帖子摘要且入口受 429 限流；动态星数、包下载和 Docker pulls 都不能证明真实用户量；这些限制在主报告和登记表中明确写出。

## 10. 下一轮必须补齐的材料

1. 对现有 GitHub issue／RFC 和 7 个 HN／社区入口做第二次状态／评论数快照，优先为高优先级工具建立时间序列；新增 N36-N42 的 6 个 issue 正文已抓取，但评论数为 `unknown`，不伪造完整快照。
2. 已为 OpenClaw、SillyTavern 补录 Reddit RSS 的正负反馈，并为 Character.AI、Replika 补录角色/关系社区样本；Hermes、Pi、OpenCode、JanitorAI 的 Reddit 入口多次返回 429，仍保持“缺口”状态，后续优先寻找公开 Discord/论坛可引用页面。
3. 已建立 46 条 npm／PyPI／Docker 初始快照，并为 8 个 npm 入口建立 4 周时间序列；下一步继续延长窗口并区分发布包下载、累计镜像拉取和独立用户，避免把任一指标当采用率。
4. 已建立 [52 个主样本能力矩阵](AI工具与Harness-主样本能力矩阵.csv)，记录 provider、memory、HITL、async、browser、sandbox、channels、retrieval、observability、maintenance 状态；下一步为 `partial/unknown` 字段补版本和复现条件。
5. 在 s-forge 脱敏 fixture 上执行 MemoryClaim、RetrievalTrace、ToolInvocation 和 OperationHandle 的性能与恢复 benchmark；这一步完成前不宣称“已集成”。

## 11. 本轮 URL 审计结果

本轮全 corpus 扫描从主报告、轨迹和登记表提取并规范化 562 个去重 URL；并发 GET 快照为 517 个成功、30 个限流/禁止、9 个 404、1 个 400、1 个 422、2 个网络超时和 2 个网络错误。跨生态 CSV 原有 68 个入口单独统计为 50/18，N36-N49 新增 28 个官方/社区入口、N50-N61 新增 24 个官方/社区入口；HN item 以 Algolia API 复核。动态采用信号表另保存 46 条 npm/PyPI/Docker 记录，npm 四周序列表保存 32 条记录，角色社区 RSS 表保存 18 条帖子摘要，能力矩阵覆盖 T01-T52。该扫描包含查询模板占位 URL、失效历史入口和代码片段中的 API 地址，因此不是逐条语义审计；失败项按访问类型保留，不从 404/限流推导能力结论。HN、产品官网和官方 README／文档 URL 单独记录状态，不把 HN 限流页当作内容缺失。GitHub issue 的 HEAD 请求可能返回 406，完整页面 GET 仍可访问；GitHub REST API 可能进入匿名额度限制，首轮已取得的数值保留为带日期快照，后续不把 403 伪装成最新数据。不存在的 discussions URL、JanitorAI/Ragdoll/Convai 入口、DOI 403、Goose／textgen／Jan alias、Windsurf 迁移和 KoboldCpp README 异常均按第 6 节记录；代码块中的 `{owner}`、`{repo}`、`{branch}` 只是查询模板，不是证据来源。
