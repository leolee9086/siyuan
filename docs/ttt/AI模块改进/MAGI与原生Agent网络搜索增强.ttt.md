# MAGI 与原生 Agent 网络搜索增强执行跟踪 (TikTocTak)

> **目标**: 让 MAGI 与继承自上游的原生 Agent 共享一套真实可用的多引擎网络搜索与网页抓取能力。覆盖 `s-code` 的 186 个搜索适配器文件和 `s-forge/packages/websearch` 已注册的 203 个真实引擎，所有引擎必须有真实请求、真实解析和明确的凭据/失败状态；原生 Agent 的搜索能力不得弱于 s-code，且不得改变 MAGI 三贤人治理或原生 Agent 用户确认边界。
>
> **量化验收目标**:
> 1. `s-code` 与 `s-forge/packages/websearch` 的引擎映射表覆盖率 100%，通用辅助模块明确映射到通用实现，不注册虚假引擎。
> 2. 已配置凭据的引擎真实网络验证通过率 100%；未配置凭据的引擎必须明确标记 `requires_credentials`，禁止静默返回假结果。
> 3. 原生 Agent、MAGI 普通会话、MAGI 投票调查和非睡眠心跳读取均可调用搜索；原生 Agent 不进入 MAGI 治理，MAGI 不走原生 Agent 确认。
> 4. 搜索支持多引擎聚合、查询意图、时间范围、语言、provider 选择、Exa/Parallel MCP 和引擎诊断；网页抓取支持 markdown/text/html、超时、MIME/大小限制和截断。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从“近期计划”中认领一个任务。
> 2. 完成开发、测试和真实网络验证。
> 3. 将完成任务移动到“已归档/已完成”，写入证据、成果文件和原子提交哈希。
> 4. 将“中期计划”中的条目提升到“近期计划”。

---

## 核心原则

1. 所有搜索引擎都必须是真实的 HTTP/API/MCP 请求和真实解析；禁止占位实现、伪造 URL、测试 key 回退和虚假结果。
2. 运行时配置统一来自现有 `conf.AI.webSearch` 配置路径和 `/api/setting/setAI`，API key 使用现有加解密流程；环境变量不得作为正式凭据来源。
3. 搜索、抓取和诊断是只读能力，不触发 MAGI 行动治理或原生 Agent 用户确认；Forge 源码写入仍保持既有边界。
4. MAGI 与原生 Agent 共享底层搜索/抓取服务，但工具名称、工具 executor、确认策略、三贤人治理和结果归档链路必须保持独立。
5. 每个 Git 提交只包含一个逻辑变更，必须显式指定路径；不得混入用户已有的主题、键盘事件、ttt 或其他未提交改动。
6. 任何引擎的 HTTP、解析、凭据、验证码或限流失败都必须产生可诊断状态；不能以空结果掩盖协议错误。
7. TTT 记录必须与实现同步维护：阶段状态、验收证据、测试结果、受影响文件、提交哈希和最终归档均不可缺失。

## 验证检查清单

- [x] 新配置位于 `conf.AI.webSearch`，密钥可保存、加载、加密和解密，运行时不依赖搜索环境变量。
- [x] kernel 正式依赖 `packages/websearch`，常规构建和独立 module 测试均通过。
- [x] s-code 适配器文件与 s-forge 引擎注册表有 100% 映射；缺失真实适配器已补齐。
- [x] 所有适配器的 HTTP 错误、空响应、解析错误、验证码、拒绝访问和缺失凭据都有明确状态。
- [ ] 已配置引擎真实网络探测通过；未配置引擎不会被伪装成成功。
- [x] 原生 Agent `web_search` 支持多引擎、provider、查询类型、时间范围、语言和显式引擎选择。
- [x] 搜索来源防伪：模型上下文只保留 `ref:web-*`，真实 URL 只存在于 UI/MAGI 展示映射；未知引用和模型自写外链不会静默导航。
- [x] 原生 Agent `web_fetch` 支持 markdown/text/html、超时、MIME/大小限制、Cloudflare 重试和截断。
- [x] 原生 Agent `web_search_status` 为只读诊断工具，不触发确认。
- [x] MAGI 暴露 `search_web`、`fetch_web_page` 和 `inspect_web_search_engines`，工具 executor 路由正确。
- [x] MAGI 普通会话、投票调查和非睡眠心跳读取可搜索；搜索/抓取不进入行动治理。
- [x] MAGI 搜索结果写入查询归档和紧凑历史摘要，fetch 保持现有 JSON 文件落盘协议。
- [ ] 搜索包单元测试、kernel 定向测试、fetch 测试和真实网络矩阵均通过。
- [x] 已完成阶段均有独立原子提交、提交路径清单、测试证据和 TTT 状态记录。

## 近期计划

- [x] **Phase 1: TTT、配置模型与 websearch module 接入 (P0)** [已完成 2026-07-16]
  - **背景**: 现有 websearch 是独立 module，原生 Agent 只调用 Exa，MAGI 只有单 URL 抓取，且运行时凭据来自环境变量。
  - **行动**: 创建并维护本 TTT；增加 `conf.AI.webSearch` 运行时配置和密钥加解密；把 websearch module 接入 kernel；建立统一 service、结构化响应和 provider 配置边界。
  - **验收标准**: 配置可持久化且不泄露密钥；kernel 可导入 websearch；服务能按配置选择本地多引擎、Exa 或 Parallel；相关编译测试通过。
  - **参考**: `packages/websearch`、`kernel/conf/ai.go`、`kernel/api/setting.go`。

- [-] **Phase 5: 全量真实网络验证与引擎健康运营 (P1)**
  - **背景**: 代码阶段已完成，需要用真实配置验证并集引擎、凭据要求、失败原因、延迟和健康状态。
  - **行动**: 执行配置驱动的全量真实探测；记录引擎矩阵、凭据要求、响应和失败原因；修复真实网络验证暴露的问题。
  - **验收标准**: 已配置凭据的引擎请求和解析通过；未配置引擎明确为 `requires_credentials`；报告与测试输出写入 TTT；未完成前不归档。
  - **当前证据（2026-07-16）**: 第二轮 `TestAllEnginesIntegration` 实际探测 207 个已注册引擎：36 个成功、1 个真实零结果、150 个真实失败、20 个明确 `requires_credentials`。失败原因包含网络超时、HTTP 403/404/429 及目标站点拒绝访问；没有将失败或缺少凭据伪装成成功，因此本阶段仍保持 `[-]`。
  - **本轮修正**: 共享 HTTP 客户端现在实际应用每个引擎的运行时 `BaseURL` 和 headers，并补充空结果/协议契约测试；提交 `776891533 fix(websearch): apply runtime engine endpoints and headers`。定向契约测试命令 `go test . -run '^(TestEngineRegistryRejectsSilentNilResults|TestHTTPClientRetriesUnexpectedEOF|TestJSONAPIEngineReportsProtocolFailures|TestEngineHTTPClientAppliesConfiguredBaseURLAndHeaders|TestCodeEngineParsersMatchReferenceContracts|TestServiceDiagnoseReportsMissingCredentials|TestServiceDiagnoseMarksProtectedEnginesAsCredentialBound|TestServiceSearchReportsUnknownExplicitEngine|TestMCPResponseParserRejectsMalformedPayload)$' -count=1 -timeout=2m` 通过。
  - **代码回归证据**: `go test ./mcp/tools -run 'TestWebSearch|TestWebFetchHandler' -count=1 -timeout=2m`、`go test ./nerv/magi/config -run 'TestWebToolDefinitions|TestDefaultCoreSageToolsExposeAllWebTools' -count=1 -timeout=2m`、`go test ./nerv/magi/coordinator -run 'TestWebSearch|TestMAGIWeb|TestBuildHeartbeatRuntimeToolsBySage|TestAppendTurnToolCallsToContextWithExecutor_SummarizesQueryResultForNonMelchior' -count=1 -timeout=3m` 均通过；`go test ./websearch ./mcp/tools ./util -run '^$' -count=1` 编译通过。
  - **代理重测与 s-code 对照（2026-07-17）**: 使用 `http://127.0.0.1:7890` 实测 Go 注册表 207 个引擎：55 个成功、2 个零结果、131 个真实失败、19 个明确 `requires_credentials`。同一代理、同一 `test search` 查询下，s-code 当前 selector 实测 201 个引擎、76 个成功；Go 成功集合之外仍有 33 个 s-code 成功引擎需要修复或建立明确名称映射：`9gag`、`acfun`、`artic`、`bing-videos`、`bitchute`、`britannica-wiki`、`devicons`、`discourse`、`emojipedia`、`frinkiac`、`github-issues`、`ipernity`、`lemmy`、`lucide`、`material-icons`、`metacpan`、`microsoft-learn`、`openaire`、`openclipart`、`openfoodfacts`、`pinterest`、`pkg-go-dev`、`radio-browser`、`rottentomatoes`、`selfhst`、`sogou`、`sogou-images`、`sourcehut`、`theguardian`、`uxwing`、`wikivoyage`、`youtube`。
  - **当前基线**: s-code 在本轮实际成功且 Go 同步通过的硬基线为 `github`、`crates`、`imdb`、`bilibili`、`stackexchange`、`hackernews`；Go 侧 `duckduckgo` 额外成功，但 s-code 本轮返回空结果。`arxiv` 和 `bing` 两边均分别遭遇 HTTP 429 与 CAPTCHA/Turnstile，不能伪装为成功。提交 `0821cdd40 fix(websearch): align scode baseline and parser safety` 修复 GitHub 匿名访问契约和 Go `regexp` 不支持 lookahead 导致的 Google Scholar 矩阵 panic；6 个硬基线测试均通过。
  - **差集修复批次 1**: 对齐 Art Institute、OpenFoodFacts、Radio Browser、pkg.go.dev、Microsoft Learn 和 OpenAIRE 的真实请求/响应协议；增加 `openaire`、`britannica-wiki`、`wikivoyage` 的实际 MediaWiki 注册映射。代理矩阵由 207/55 成功提升到 210/61 成功；`artic`、`microsoft-learn`、`pkg-go-dev`、`openaire`、`britannica-wiki`、`wikivoyage` 已实测成功。OpenFoodFacts/Radio Browser 本轮分别收到 HTTP 503/502，暂不标记成功。原子提交 `2ebf29a09 fix(websearch): align public api engine adapters`。
  - **浏览器代理与 TLS 修正（2026-07-17）**: 移除 websearch 自定义 CONNECT/uTLS Transport；改用成熟 `tls-client` 的 Chrome profile 和显式 `WithProxyUrl`，代理 URL 只由 `EngineConfig.Proxy`/调用方传入。标准直连 Transport 清除 `ProxyFromEnvironment`；`AutoDetect` 仅返回明确错误，不再探测 `7890` 或其它本地端口。真实单请求验证：GitHub 200、SourceHut 200、9GAG API 200；SourceHut 伪装 Chrome UA 会 418，改用 s-code 的 `opencode-search/1.0 (bot; +https://opencode.ai)` 后引擎返回 2 条结果。原子提交 `9d32117b8 fix(websearch): use explicit browser proxy transport`。
  - **当前全量矩阵（2026-07-17）**: `TestAllEnginesIntegration` 实测 210 个注册引擎：80 个成功、2 个真实零结果、110 个真实失败、18 个明确 `requires_credentials`；代理为调用方显式传入的 `http://127.0.0.1:7890`。失败仍包含站点 403/404/429/503、CAPTCHA、超时、协议解析失败和目标站点主动拒绝，未将失败或凭据缺失伪装成成功。
  - **细粒度 s-code 对照（2026-07-17）**: 新增 `packages/websearch/cmd/enginecompare`，按指定引擎分别调用 s-code 与 Go，单引擎超时会清理 Bun 进程树并输出独立错误。`github` 对照为 s-code/Go 均成功 3 条；`9gag`、`sourcehut`、`theguardian`（显式传入 `test` key）均成功；`pinterest` 在同一代理同一查询下 s-code 成功 3 条，Go 请求超时，仍是当前已确认差异。无 Guardian key 时 Go 明确为 `requires_credentials`，符合凭据契约。原子提交 `e6f0d60a5 fix(websearch): align real engine adapters`。
  - **浏览器传输与 Sogou 细粒度修正（2026-07-17）**: 使用调用方显式传入的 `http://127.0.0.1:7890` 复测，`9gag`、`pinterest`、`sourcehut` 三项 s-code/Go 状态均为 `success`，其中 SourceHut s-code 返回 3 条、Go 返回 2 条但状态一致；Pinterest 不再超时。Sogou 真实响应曾返回 200/488KB 结果页，也实测返回搜狗验证码页；解析器已按 s-code 的 `vrwrap`/`rb`、`pt`/`vr-title` 结果块、跳转 URL、摘要和日期结构对齐，验证码返回类型化 `CaptchaError`，解析无结果返回非 nil 空切片。定向 fixture、代理契约、错误传播和 enginecompare 编译测试通过。原子提交 `ee83b8dc6 fix(websearch): align sogou parser and captcha contract`。
  - **kernel 真实工具路径与超时验证（2026-07-17）**: 新增受环境变量控制的 `TestWebSearchHandlerRealKernelPath`，按真实 `webSearchHandler -> kernel/websearch.NewService -> shared.Service.Search -> ExecuteAll` 链路调用，显式代理为 `http://127.0.0.1:7890`、显式引擎为 `github`。正常配置 `30000ms` 实测返回 3 条结果、0 个错误，最终耗时 `841ms`；配置 `1000ms` 实测约 `1.00s` 返回 0 条结果和 1 个明确引擎错误，没有拖到默认引擎超时。修复 `AI.webSearch.timeoutMs` 未传递到 shared runtime 的问题，并补齐 kernel module 对 `tls-client`/`fhttp` 的依赖校验记录；`-mod=readonly` kernel 定向测试通过。原子提交 `44cde4e4a test(kernel): exercise real web search tool path`。
  - **原生 Agent 搜索结果显示链路（2026-07-17）**: 已在 `0267a279d feat: enhance web search functionality with progress tracking` 接入 `tool_call/tool_progress/tool_result` SSE 事件和 `callID` 关联；运行中显示当前引擎、`done/total`、结果数和最近 5 条预览，完成后显示结构化结果、摘要、引擎状态和明确错误，历史会话可从持久化工具结果重建。真实代理复测正常请求约 `11.95s` 返回 3 条结果，`1000ms` 配置约 `1.00s` 返回明确超时错误；desktop 生产构建成功（仅有资源体积警告），产物包含 `tool_progress`、`latestResults` 和搜索进度卡片标记。补充修复大于 `40000` 字符的搜索响应：完整 JSON 只用于 UI 展示，模型上下文仍按限制截断；`go test ./agent ./mcp/tools -run 'TestBuildToolResultOutputsPreservesCompleteDisplayPayload|TestNativeAgentForge|TestLatestSearchProgressResultsKeepsFiveNewest|TestWebSearchToolSchemaIncludesSearchControls'`、`go build ./api` 均通过。原子提交 `53d424d62 fix(agent): preserve complete web search display output`。由于现有 `6806` 实例占用工作区，独立 UI 实例又被当前 MAGI 初始化 panic 阻断，真实浏览器 DOM 仍未完成验收，因此本阶段不能归档。
  - **原生 Agent 搜索卡片渲染隔离与浏览器验证（2026-07-17）**: 将搜索进度/完成态 HTML 渲染器从巨型 `AgentMessageRenderer.ts` 拆到 `app/src/layout/dock/agent/websearch/`，保留 `AgentChat` 按 `callID` 处理 `tool_call`、有序 `tool_progress` 和 `tool_result` 的运行时链路；新增 Chromium 浏览器测试，实际验证运行中显示当前引擎、`done/total`、最近结果和可点击安全 URL，完成态显示摘要，并拒绝 `javascript:` URL。`go test ./agent ./mcp/tools -run 'TestBuildToolResultOutputsPreservesCompleteDisplayPayload|TestNativeAgentForge|TestLatestSearchProgressResultsKeepsFiveNewest|TestWebSearchToolSchemaIncludesSearchControls' -count=1 -timeout=3m`、`go build ./api`、`pnpm exec vitest --run --config vitest.browser.config.ts test/browser/agent/web-search-renderer.browser.ts`（2/2）、新 `websearch` 模块定向 ESLint 和 `pnpm run build:desktop` 均通过；构建仅有资源体积警告。原子提交 `e114c153c feat(agent): show live web search progress`。完整 SiYuan Agent 会话 DOM 仍因既有实例占用及独立实例 MAGI 初始化 panic 未完成验收，本阶段继续保持 `[-]`。
  - **搜索来源短链接防伪与 MAGI 展示闭环（2026-07-17）**: 对齐 `SiyuanAssistantCollection` 的 `ref:<短标识> + linkMap` 原理；`packages/websearch/references.go` 现在保护结构化 URL、标题、摘要、全文摘要和文本字段，原生 Agent 在模型上下文移除真实映射后仍保留不透明引用；Agent 会话切换清空映射并规范化浏览器 URL，MAGI 将搜索映射作为 `webSearchLinks` 展示元数据传给独立面板，模型上下文不携带真实目标。新增 `MagiWebContent`/`webReferences`，可信引用才恢复为链接，未知 `ref:web-*` 和模型编造外链被隔离。`go test ./packages/websearch` 定向引用测试、`go test ./kernel/nerv/magi/coordinator` web 工具测试、`go build ./kernel/api`、`go test ./kernel/mcp/tools ./kernel/agent ./kernel/nerv/magi/config` 及原生 Agent 浏览器测试（3/3）、`pnpm run build:desktop` 均通过；桌面构建仅有资源体积警告。代码提交 `510f02ab0 fix(websearch): enforce trusted source references`。由于完整真实 MAGI 页面仍未在独立实例完成 DOM 验收，本阶段保持 `[-]`。
  - **可信引用历史预过滤（2026-07-17）**: 新增 `packages/bloom-filter` 独立 TypeScript 包，参考 `D:\dev\bloom-filter` 实现 FNV-1a 64 位哈希、双重哈希、位数组、误判率估算、JSON 状态和可增长分段；原生 Agent 在会话切换、历史恢复和新搜索结果登记时维护 token/URL 过滤器，MAGI 对历史 `webSearchLinks` 建立同样的预过滤。Bloom 只用于快速排除候选，命中后仍必须经过精确 `linkMap`/URL 集合校验，不能单独授权来源；URL 先按浏览器规则规范化，避免尾斜杠差异造成误拒绝。原子提交 `45db0c63f feat(packages): add scalable bloom filter`、`68e2ff10c fix(ai): prefilter trusted web references`。
  - **过滤器验证证据（2026-07-17）**: `bun test`（`packages/bloom-filter`）7/7 通过、10017 次断言，覆盖 10000 条历史记录的分段增长、零 false negative、误判率、状态往返、清空和参数错误；`pnpm exec vitest --run --config vitest.browser.config.ts test/browser/agent/web-search-renderer.browser.ts test/browser/magi/web-references.browser.ts` 2 个文件 6/6 通过，覆盖 MAGI 10000 条历史映射、未知引用隔离和 Bloom 命中后的精确拒绝；`pnpm run build:desktop` 成功，仅有既有资源体积警告。本批次未改变真实网络矩阵，Phase 5 仍保持 `[-]`。
  - **可信引用过滤回退精确索引（2026-07-17）**: 实测发现纯 TypeScript Bloom membership 查询比运行时原生 `Set.has` 更慢，且当前链路始终保留 `Map/Set` 做最终精确校验，未获得空间或外部 I/O 收益。因此移除 Agent/MAGI 的 Bloom 预过滤、前端依赖和独立包；可信引用继续只通过精确映射与精确 URL 集合恢复/放行，未知引用和模型编造 URL 的隔离行为保持不变。提交后定向浏览器测试 2 个文件、5 个测试全部通过，`pnpm run build:desktop` 通过（仅既有资源体积警告）；Phase 5 仍保持 `[-]`。代码原子提交 `ac02c4f2b`。
  - **实时工具调用与搜索预览闭环（2026-07-17）**: 对照上游 `origin/master` 的 Agent 实现，确认上游只有 `tool_call/tool_result`，没有 `tool_progress` 或搜索预览修正；s-forge 保留 MAGI 的进度快照模式并补齐原生 Agent 链路。后端为工具调用、进度和结果使用可等待事件发送，避免 SSE 背压时丢失卡片生命周期；模型缺少工具 ID 时生成稳定的 `agent-tool-<round>-<index>`，保证进度和结果关联同一卡片。前端新增普通工具调用卡片，运行中显示参数/状态/进度，完成后显示完整且转义的结果；`web_search` 保留当前引擎、完成数/总数、最近预览和最终来源卡片。原子提交 `fffd8fd55 fix(agent): preserve live tool lifecycle events`、`e5c5324fe feat(agent): show live tool call cards`。
  - **实时显示验证证据（2026-07-17）**: 浏览器测试使用延迟分块 SSE，按 `tool_call -> tool_progress(1/2) -> tool_progress(2/2) -> tool_result -> done` 顺序驱动实际解析器和 DOM 渲染，确认用户在最终结果到达前看到 `github`/`1/2`/第一条预览，再看到 `bing`/`2/2`，最后切换到完整结果；Agent 浏览器定向测试 3 个文件 6/6 通过，kernel Agent/MCP 定向测试通过，工具卡片目录 ESLint 通过，`pnpm run build:desktop` 成功（仅既有资源体积警告）。
  - **代理继承与显式覆盖（2026-07-18）**: 按“调用方显式代理 > 组件代理 > 系统有效代理 > 直连”实现统一传递；系统有效代理仍遵循“手动配置 > 自动探测 > 直连”，不硬编码 `7890`，代理端点始终由配置或调用方传入。原生 Agent 的聊天、标题、模型测试、编辑模型，MAGI 的 Provider 客户端及配置回退，WebSearch 默认引擎/单引擎、Exa/Parallel MCP、原生 `web_fetch` 和 MAGI `fetch_web_page` 均使用显式有效代理；空组件配置继承系统代理，组件配置覆盖系统代理，`NoProxy` 只在支持该协议的 HTTP 客户端中生效。OpenAI 客户端保留上游显式参数语义，并增加系统代理回退路径。
  - **代理验证证据（2026-07-18）**: 原子提交 `81a752978 fix(network): inherit configured proxy across AI clients`。`go test ./conf ./util ./websearch ./mcp/tools ./nerv/magi/llm ./nerv/magi/config -count=1 -timeout=10m` 通过；`go test . -count=1 -timeout=10m`（`packages/websearch`）因真实引擎批量网络探测中的站点超时/拒绝、CAPTCHA、空响应和既有 `github-issues` 凭据契约断言失败，未通过；该失败已保留为真实证据，Phase 5 继续保持 `[-]`。扩大到整个 coordinator 测试包时另有既有 `note_query_tool` 数据库状态 panic，未归因于代理改动。新增代理单测覆盖手动/自动/组件优先级、OpenAI/Fetch/MCP 显式 Transport、默认引擎代理继承和 `NoProxy`。
   - **当前未完成项**: 必须继续用细粒度工具修复尚未对齐的其它真实失败差异，完成配置驱动的已配置凭据探测，并补齐 kernel、Agent、MAGI、fetch 定向回归后，才能将本阶段从 `[-]` 移动到已归档。当前禁止标记 `[x]`。

## 中期计划

- [ ] **Phase 6: 搜索结果质量和缓存优化 (P1)**
  - **行动**: 对齐 s-code 的意图识别、去重、评分、域名多样性、缓存和价格比较行为，使用真实回放数据验证结果质量。

- [ ] **Phase 7: 配置 API、文档和长期回归 (P2)**
  - **行动**: 完善配置字段文档、诊断使用说明、引擎新增准入规则和持续网络回归流程。

## 已归档/已完成

- [x] **Phase 4: MAGI 独立工具链与结果归档** [已完成 2026-07-16]
  - **完成情况**: 新增独立 `search_web`、`inspect_web_search_engines`，保留并增强 `fetch_web_page` 的 JSON 文件落盘协议；普通会话、投票调查和非睡眠心跳读取均接入只读搜索/抓取/诊断；MAGI 使用独立 executor，不复用原生 Agent 确认或 MCP 执行链路；搜索/诊断/抓取结果进入查询归档，非 Melchior 上下文使用紧凑历史摘要，Melchior 保留详细结果；Forge 写入工具的三贤人治理未改变。
  - **成果文件**: `kernel/nerv/magi/config/toolset_web.go`、`kernel/nerv/magi/config/config.go`、`kernel/nerv/magi/config/manager.go`、`kernel/nerv/magi/coordinator/web_search_tool.go`、`kernel/nerv/magi/coordinator/web_fetch_tool.go`、`kernel/nerv/magi/coordinator/collector_sage.go`、`kernel/nerv/magi/coordinator/voting.go`、`kernel/nerv/magi/coordinator/heartbeat.go`、`kernel/nerv/magi/coordinator/tool_result_memory.go`
  - **验证**: `go test ./nerv/magi/config -run 'TestWebToolDefinitions|TestDefaultCoreSageToolsExposeAllWebTools'` 通过；`go test ./nerv/magi/coordinator -run 'TestWebSearch|TestMAGIWeb|TestBuildHeartbeatRuntimeToolsBySage|TestAppendTurnToolCallsToContextWithExecutor_SummarizesQueryResultForNonMelchior'` 通过；编译检查通过。
  - **提交**: `f52fee19c feat(magi): add independent web search tools`

- [x] **Phase 3: 原生 Agent 搜索、抓取和诊断工具** [已完成 2026-07-16]
  - **完成情况**: 原生 `web_search` 支持结果数量、查询类型、时间范围、语言、provider、搜索深度、livecrawl 和显式引擎；新增只读 `web_search_status`；`web_fetch` 支持 markdown/text/html、超时、MIME/大小限制、Cloudflare challenge 重试、重定向 SSRF 检查和截断信息。所有能力通过现有 native 工具注册和执行链路暴露，未改变写操作确认规则。
  - **成果文件**: `kernel/mcp/tools/web_search.go`、`kernel/mcp/tools/web_search_status.go`、`kernel/mcp/tools/web_fetch.go`、`kernel/mcp/tools/web_search_test.go`、`kernel/util/webfetch.go`
  - **验证**: `go test ./mcp/tools -run 'TestWebSearch|TestWebFetchHandler'` 通过；`go test ./mcp/tools ./util -run '^$'` 通过；无效查询、未知引擎和不支持协议均返回明确错误/状态。
  - **提交**: `1dc6d275d feat(agent): expand web search and fetch tools`

- [x] **Phase 2: 引擎契约、缺失适配器与真实诊断** [已完成 2026-07-16]
  - **完成情况**: 补齐 `lib-rs`、`niconico`、`nvd`、`repology` 四个真实适配器；JSON/HTML 通用框架、执行器和 MCP 响应对 HTTP 错误、空响应、解析失败、`nil` 结果和非法 MCP 内容返回明确协议错误；引擎元数据进入运行时诊断，缺失凭据标记为 `requires_credentials`，显式未知引擎标记为 `not_registered`；集成报告改用测试临时目录。
  - **映射证据**: `s-code` 搜索适配器文件 186 个；Go 注册表 207 个唯一引擎；`google-traits`、`json-api`、`open-api`、`site-scoped`、`site-search` 保持通用辅助实现，不冒充独立注册引擎。
  - **成果文件**: `packages/websearch/engines_missing.go`、`packages/websearch/engines_framework.go`、`packages/websearch/executor.go`、`packages/websearch/runtime.go`、`packages/websearch/mcp.go`、`packages/websearch/engines_test.go`、`packages/websearch/runtime_contract_test.go`
  - **验证**: `go test . -run '^$'`（`packages/websearch`）通过；定向契约测试通过；无正式 API key 的诊断返回 `requires_credentials`，未知显式引擎返回 `not_registered`。
  - **提交**: `aefd65210 feat(websearch): enforce engine runtime contracts`

- [x] **Phase 1: TTT、配置模型与 websearch module 接入** [已完成 2026-07-16]
  - **完成情况**: 创建本 TTT；在 `conf.AI.webSearch` 增加 provider、代理、缓存、引擎和凭据配置；接入现有 API key 加解密；kernel 通过本地 module 正式依赖共享 websearch；增加结构化搜索 service、provider 选择、引擎运行时凭据和代理注入，并移除搜索包对环境变量凭据的运行时读取。
  - **成果文件**: `kernel/conf/ai.go`、`kernel/go.mod`、`kernel/websearch/service.go`、`packages/websearch/runtime.go`、`packages/websearch/types.go`、`packages/websearch/provider.go`
  - **验证**: `go test . -run '^$'`（`packages/websearch`）通过；`go test ./websearch -run '^$'`（kernel）通过。
  - **提交**: `8eb9bdb39 feat(websearch): add configured runtime service`

- [x] **Phase 0: 创建网络搜索增强 TTT** [已完成 2026-07-16]
  - **完成情况**: 创建本任务的完整执行跟踪文档，记录目标、量化验收标准、核心原则、验证清单、阶段计划和原子提交要求。
  - **成果文件**: `docs/ttt/AI模块改进/MAGI与原生Agent网络搜索增强.ttt.md`
  - **提交**: `799f9168c docs(ttt): track web search enhancement`

## 如何维护此文档

1. **完成归档**：阶段满足验收标准后，移动到“已归档/已完成”，标记 `[x]`、完成日期、成果文件、测试证据和提交哈希。
2. **单阶段在途**：近期计划最多一个阶段标记为 `[-]`，不得同时推进多个未记录阶段。
3. **同步证据**：每次原子提交后立即更新状态、变更路径、测试命令、真实网络结果和提交哈希。
4. **不跳过状态**：任务必须经历 `[ ]`、`[-]`、`[x]`，不得在未验收时归档。
5. **保护用户改动**：更新 TTT 时只修改本文件，不回滚或覆盖其他用户改动。
6. **数据驱动**：引擎状态、失败原因、延迟、凭据要求和回归结果以实际输出为准，不以静态注册代替可用性证明。
