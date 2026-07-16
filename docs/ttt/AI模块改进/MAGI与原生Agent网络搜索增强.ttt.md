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
  - **未完成项**: 仍需逐项核对真实失败的可修复协议/解析问题，完成配置驱动的已配置凭据探测，并补齐 kernel、Agent、MAGI、fetch 定向回归后，才能将本阶段归档。

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
