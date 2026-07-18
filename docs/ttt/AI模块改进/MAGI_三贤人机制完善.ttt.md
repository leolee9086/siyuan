# MAGI 三贤人机制完善执行跟踪 (TikTocTak)

> **目标**: 完善 `kernel/nerv/magi` 三贤人执行机制，确保“被动召回 + 主动多工具查询 + Trinity 工作空间汇聚 + 直答门禁硬约束 + 崩溃优先错误语义”形成稳定闭环。
> 量化目标：
> 1. 三贤人在每轮请求中对分词器召回能力接线率达到 100%（请求上下文均携带被动召回参考片段或空结果显式标记）。
> 2. 三贤人单轮响应采用分角色工具策略：Melchior/Balthazar 支持多步主动工具调用（每轮各自至少 N>=3 步）；Casper 不进入主动多步工具查询，仅执行被动召回与快速决策结束信号，然后进入 Trinity 全局工作空间；`speak` 仅由 Trinity 在最终输出阶段调用。
> 3. 轮次编排满足“外部输入 -> 三贤人并发思考 -> 完成/超时 -> Trinity 汇聚”的固定状态机，覆盖率 100%。
> 4. 非直答许可来源（`DirectResponseAllowed=false`）请求 100% 路由至 Avatar，MAGI 直答路径命中率为 0%。
> 5. 非数据安全场景禁止静默兜底；所有错误必须可见（返回值、事件、日志三处至少两处可追踪）。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从“近期计划”中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到“已归档/已完成”区域。
> 4. 将“中期计划”中的条目提升到“近期计划”。
>
> **关联设计/文档**:
> - [`docs/设计/MAGI认知架构.design.md`](../设计/MAGI认知架构.design.md)
> - [`docs/设计/MAGI_Go后端落实工程设计.design.md`](../设计/MAGI_Go后端落实工程设计.design.md)
> - [`docs/设计/MAGI/ARCHITECTURE.md`](../../设计/MAGI/ARCHITECTURE.md)
>
> **关联 ttt**:
> - [`docs/ttt/MAGI_后端核心引擎落地.ttt.md`](./MAGI_后端核心引擎落地.ttt.md)
> - [`docs/ttt/MAGI_NERV_Avatar池化_内外工具隔离.ttt.md`](./MAGI_NERV_Avatar池化_内外工具隔离.ttt.md)
> - [`docs/ttt/MAGI_工具调用迁移_标准MCP_Skill机制.ttt.md`](./MAGI_工具调用迁移_标准MCP_Skill机制.ttt.md)
> - [`docs/ttt/MAGI_三贤人机制完善.shortterm.ttt.md`](./MAGI_三贤人机制完善.shortterm.ttt.md)
> - [`docs/ttt/MAGI_词法SQL向量召回工具接线.shortterm.ttt.md`](./MAGI_词法SQL向量召回工具接线.shortterm.ttt.md)
>
> **适用规程**:
> - [`docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`](../规程/tiktoctac文档(ttt)编写规程.procedure.md)

---

## 核心原则

1. **被动召回先于生成**: 三贤人在生成与工具调用前，先使用项目现有分词器能力从笔记中被动召回上下文参考。
2. **分角色工具循环**: Melchior/Balthazar 在单次 LLM 请求返回 `tool_calls` 后进入“执行工具 -> 回写 tool message -> 再次请求 LLM”的循环；Casper 不进入主动工具循环，只输出快速决策信号。
3. **Trinity 作为全局工作空间**: 三贤人输出在“完成或超时”时统一进入 Trinity 工作空间，由 Trinity 进行最终汇聚。
4. **路由强约束**: MAGI 仅服务直答许可来源（`DirectResponseAllowed=true`）；其余来源必须由 Avatar 响应，不允许策略回退到 MAGI 直答。
5. **任其崩溃 (Crash-Only)**: 除笔记数据安全防护外，不做静默回退，不吞错，不伪造成功。
6. **可观测性优先**: 工具步骤、终止原因、路由决策、错误原因必须可追踪并可回放。
7. **角色边界刚性**: Casper 维持“本能/时间基线”职责，仅被动召回并快速给出决策信号；主动多步查询仅属于 Melchior/Balthazar。

**验证检查清单**:
- [ ] 每个三贤人请求均可观察到“分词器被动召回”阶段（包括空召回显式记录）。
- [ ] Melchior/Balthazar 工具循环支持多次调用（每轮各自 >=3 步），且存在统一最大步数与超时上限防止失控。
- [ ] Casper 不进入主动工具循环；若出现主动 tool_call 必须被拒绝或降级并记录结构化原因。
- [ ] 三贤人终止条件仅允许：`decision_signal/handoff_to_trinity`、达到最大步数、上下文超时、明确错误。
- [ ] Trinity 成功输出条件为 `speak(channel=public)`；`speak(channel=internal)`仅用于内部报告。
- [ ] 回合状态机固定为“外部输入 -> 三贤人并发 -> 完成/超时 -> Trinity 汇聚”，无旁路直出。
- [ ] 枚举口径清晰且一致：`TrustLevel=low|medium|high`，`SourceChannel=guardian|external-agent|system-cron|unknown`。
- [ ] 路由策略测试覆盖 `DirectResponseAllowed=true/false` 两类来源；`false` 全量走 Avatar。
- [ ] 代码中不存在静默 `catch` 或忽略错误返回的路径（涉及数据安全防护的例外需明确注释）。

---

## 现状评估 (2026-03-10)

1. 三贤人与 Trinity 主路径当前以“单次发送 + 流结束聚合”工作，缺少按贤者角色分层的多步工具执行循环。
2. `speak` 当前主要在 Trinity 路径生效；三贤人“思考结束并进入 Trinity”的工具语义尚未统一为工具族契约。
3. 回合流程具备并发收集与 Trinity 汇聚基础，但“思考过久进入全局工作空间”的状态机仍需明确化和可观测化。
4. 信道路由已存在 Avatar 分流能力，但“仅 `DirectResponseAllowed=true` 允许 MAGI 直答”的硬约束仍需制度化校验。
5. 错误处理路径存在部分历史兼容思路，需按“任其崩溃”原则统一收敛。

---

## 口径澄清（2026-03-10）

1. **信任等级枚举（TrustLevel）**: `low|medium|high`，不包含 `highest`。
2. **信道枚举（SourceChannel）**: `guardian|external-agent|system-cron|unknown`，其中 `unknown` 属于信道，不属于信任等级。
3. **直答判定口径**: “最高可信可直答”在实现层等价为 `DirectResponseAllowed=true`，而非独立的 `highest` 枚举值。
4. **验收口径统一**: 路由验收以 `DirectResponseAllowed` 为准；`false` 必须 Avatar 路径，`true` 才允许 MAGI 直答路径。
5. **“分词器”分层定义**: 需区分两层能力：`siyuan` 属于 SQLite FTS 检索分词层；MAGI 词法召回属于词级分词层（复用现有 `gse` 依赖能力）。
6. **“分词器接口”定义**: MAGI 不应把 FTS 分词器当作词级语义分词接口；应先经词级分词层做词项抽取，再路由到既有检索入口（搜索 API/模型层）。
7. **“分词器 vs 笔记召回”关系**: FTS 分词器负责检索索引匹配；词级分词层负责语义词项构造；笔记召回是 MAGI 编排层动作，统一封装词法/SQL/向量结果后注入贤者上下文。
8. **Phase 1 实施前提**: 先完成“分词分层口径 + 复用边界 + 工具契约”确认，再接线到三贤人入口；禁止并行设计新分词引擎或重复索引系统。
9. **`speak` 归属**: `speak` 是 Trinity 专用输出工具；三贤人不得把 `speak` 作为思考终止工具。
10. **三贤人终止工具口径**: 三贤人应使用“决策结束信号工具族”（如审慎信号、交接信号）标记本轮思考结束并进入 Trinity 工作空间。
11. **状态转换口径**: “三贤人思考结束 -> 进入 Trinity 工作空间 -> Trinity 调用 speak 输出”是串行状态转换，不是并列终止选项。
12. **验收拆分口径**: 终止指标需拆分为 `seel_termination_reason` 与 `trinity_output_reason` 两类独立核验。
13. **Casper 能力口径**: Casper 仅走“被动召回 + 快速判断/决策信号”路径，不承担主动多步工具查询职责。
14. **Phase 2 分角色验收口径**: Melchior/Balthazar 需满足多步主动工具调用；Casper 主动查询步数验收为 0。

### 代码参考（仅位置与影响范围）

1. `kernel/nerv/magi/types/types.go`
   - 影响范围：来源上下文字段定义、`TrustLevel` 与 `SourceChannel` 枚举边界、跨模块字段语义一致性。
2. `kernel/api/magi_source.go`
   - 影响范围：API 入口来源解析、`DirectResponseAllowed` 计算、来源信号归一化与准入判定。
3. `kernel/nerv/magi/coordinator/coordinator.go`
   - 影响范围：协调器路由分流（MAGI 直答 vs Avatar 路径）、轮次主流程入口门禁。
4. `kernel/api/magi_source_test.go`
   - 影响范围：入口门禁与来源上下文计算回归验证（包括 direct-main 策略约束）。
5. `kernel/nerv/magi/coordinator/coordinator_test.go`
   - 影响范围：协调器在不同来源门禁下的路径选择与行为稳定性验证。
6. `docs/技术文档/MAGI/SOURCE_SIMULATION_PANELS_INTEGRATION.md`
   - 影响范围：来源仿真面板的字段契约与联调口径（`trustBase/riskLevel/channel`）。
7. `docs/技术文档/MAGI/REQUEST_SOURCE_IDENTITY_PLAN.md`
   - 影响范围：来源身份体系设计口径、字段语义和策略边界文档对齐。

### speak 与决策结束信号代码参考（仅位置与影响范围）

1. `kernel/nerv/magi/config/config.go`
   - 影响范围：`speak` 工具定义归属、工具常量语义边界。
2. `kernel/nerv/magi/config/manager.go`
   - 影响范围：默认工具集装配，`speak` 目前注入在 Trinity 侧的边界。
3. `kernel/nerv/magi/coordinator/trinity.go`
   - 影响范围：Trinity 输出阶段对 `speak` 的强约束与失败语义。
4. `kernel/nerv/magi/prompts/core.go`
   - 影响范围：Trinity 提示词对 `speak` 的强制调用规则。
5. `kernel/nerv/magi/stream/processor.go`
   - 影响范围：`speak` 与 `deliberation_signal` 工具解析边界、终止信号可观测字段来源。
6. `kernel/nerv/magi/coordinator/collector.go`
   - 影响范围：三贤人结果收集与 `deliberation_signal` 解析范围（当前仅部分贤者路径）。
7. `kernel/nerv/magi/types/types.go`
   - 影响范围：`DeliberationSignal` 与 `TrinitySpeakTool` 结构体语义边界。

### 分词器与笔记召回代码参考（仅位置与影响范围）

1. `kernel/sql/database.go`
   - 影响范围：SQLite 驱动注册与 FTS 表构建，定义检索分词层（`siyuan`）边界。
2. `kernel/go.mod`
   - 影响范围：`go-sqlite3` replace 与 `github.com/go-ego/gse` 依赖声明，定义分词能力来源边界。
3. `kernel/nerv/seraph/atf_style.go`
   - 影响范围：现有 `gse` 初始化、分词调用与降级路径，可复用于 MAGI 词级分词层策略。
4. `kernel/api/router.go`
   - 影响范围：词法检索、SQL 检索、向量检索 API 暴露入口和路由契约。
5. `kernel/api/search.go`
   - 影响范围：词法检索参数解析（`query/paths/types/method/orderBy/groupBy`）与响应封装。
6. `kernel/model/search.go`
   - 影响范围：`FullTextSearchBlock` 主检索分发（关键字/查询语法/SQL/正则）及结果结构定义。
7. `kernel/api/sql.go`
   - 影响范围：`/api/query/sql` 入口协议与返回错误语义。
8. `kernel/sql/block_query.go`
   - 影响范围：SQL 查询解析、`LIMIT` 注入、`UNION`/`||` 兼容路径与查询成本边界。
9. `kernel/api/embedding.go`
   - 影响范围：语义检索 API（文本->向量->相似块）参数与返回结构约束。
10. `kernel/api/vector.go`
   - 影响范围：通用向量查询 API（collection/vector/top_k/ef_search）与结果结构约束。
11. `kernel/vectordb`
   - 影响范围：向量索引实现能力边界（含 BBQ/Vamana/Disk 索引路径）。
12. `kernel/nerv/magi/config/config.go`
   - 影响范围：MAGI 工具定义注册点，新增“笔记查询工具”契约扩展位置。
13. `kernel/nerv/magi/config/manager.go`
   - 影响范围：贤者默认工具集装配与强制注入规则，决定“是否具备主动查询能力”。

### 复用边界（禁止重复造轮子）

1. 词法被动召回采用“双层复用”：词级分词复用现有 `gse` 能力，检索执行复用 `fullTextSearchBlock -> model.FullTextSearchBlock` 链路。
2. 主动 SQL 查询优先复用 `/api/query/sql` 与 `sql.Query`，不新增并行 SQL 引擎。
3. 语义召回优先复用 `/api/embedding/blocks/query` 或 `/api/vector/query`，不新建第二套向量索引框架。
4. 若需扩展能力，仅允许在 MAGI 工具层做“契约接线/编排”，不得复制内核检索实现。
5. `S-Forge` 分支已存在的向量存储与 DiskANN 路径属于优先复用候选，先做兼容接线评估，再考虑增量开发。

---

## 外部参考实现（myclaw / nanoClaw）

1. **目标 0：被动召回（上下文前置）**
   - `myclaw`：`internal/memory/memory.go` 的 `GetMemoryContext()` 在系统提示前组装长期/近期记忆。
   - `nanoClaw`：`nanoclaw/core/agent.py` 在每轮先 `get_history + search_memories`，`nanoclaw/core/context.py` 将记忆注入 system prompt。
   - **可借鉴点**：把召回做成“每轮必经阶段”，并把“空召回”当作显式状态，而不是隐式忽略。

2. **目标 1：单轮多步工具循环**
   - `myclaw`：`internal/config/config.go` 暴露 `DefaultMaxToolIterations` 作为统一步数上限。
   - `nanoClaw`：`nanoclaw/core/agent.py` 的 `LLM -> tool_calls -> tool -> LLM` 迭代、并行工具执行、tool result 回写；`tests/test_agent.py` 验证了至少一轮工具往返。
   - `nanoClaw`：`nanoclaw/security/budget.py` 提供迭代数/速率/超时预算约束。
   - **可借鉴点**：循环执行器必须有统一终止条件和预算闸门，防止失控循环。

3. **目标 2：外部输入到汇聚的固定状态机**
   - `myclaw`：`internal/gateway/gateway.go` + `internal/bus/bus.go` + `internal/channel/manager.go` 的“入口/处理/出口”分层。
   - `nanoClaw`：`nanoclaw/channels/gateway.py` 统一入口并按 `session_id=channel:user` 路由到 agent。
   - **可借鉴点**：状态迁移节点要单一、可观测，避免隐藏旁路。

4. **目标 3：信道硬路由与权限边界**
   - `myclaw`：`internal/channel/base.go` 通过 `allowFrom` 明确来源白名单。
   - `nanoClaw`：`nanoclaw/channels/telegram.py` 对 `allowed_users` 做入口阻断。
   - **可借鉴点**：在入口就阻断不符合信任约束的请求，避免进入主推理链路后再回退。

5. **目标 4：错误可见与审计**
   - `nanoClaw`：`nanoclaw/security/audit.py` 对 tool/response 做持久化审计与完整性校验。
   - `nanoClaw`：`nanoclaw/security/prompt_guard.py` 对不可信工具输出进行标记和注入防护。
   - **可借鉴点**：错误路径必须形成结构化审计证据；对不可信内容做显式分层标记。

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，必须剪切到【已归档/已完成】，并补充完成日期、成果文件、验证证据。
2. **单任务在途**：仅允许一个近期任务标记为 `[-]`，避免多路并发改造导致状态机漂移。
3. **先验收后迁移**：必须满足“验收标准”再推进到下一阶段，不得跳阶段。
4. **错误不美化**：任何“失败但继续”的决定都必须记录理由和风险，不得静默处理。
5. **数据安全优先**：只有涉及笔记数据安全时允许保护性兜底，且必须记录触发条件。

---

## 🟢 近期计划

- [ ] **Phase 1: 三贤人被动召回接线 (P0)**
  - **背景**: 目标 0 要求三贤人可基于上下文被动召回笔记参考，当前需明确接入点与输出格式。
  - **行动**:
    1. 明确分词分层口径：`siyuan` 用于 FTS 检索分词层，词级分词层复用现有 `gse` 能力。
    2. 梳理被动召回输入字段口径：`query`、词级词项、`paths`、`types`、`method`、分页与排序预算（仅文档层契约，不新增内核接口）。
    3. 定义 recall envelope 返回结构口径（命中数组、空命中标记、错误字段、截断信息、耗时信息、`tokenizer_profile`、`lexicon_version`），并约束注入贤者上下文方式。
    4. 增加自定义词表规划：基于笔记词频统计构建领域词典，明确版本、更新周期、回滚策略。
    5. 建立成本边界：每轮召回步数/条数上限、单次召回超时、总召回预算；超过预算时必须显式记录终止原因。
  - **验收标准**:
    - 三贤人请求链路 100% 带 recall envelope。
    - 文档明确“分词分层模块位置 + 调用边界 + 字段契约 + 成本边界”，可直接指导实现而无需补口径。
    - 明确 `gse` 词级分词与词表管理策略，不再将词法召回口径锁死为 FTS 分词器。
    - 被动召回失败时返回显式错误，不静默降级为“正常命中”。
    - 回归测试覆盖命中、空命中、异常、预算截断四类场景。
  - **参考文档**:
    - `kernel/sql/database.go`
    - `kernel/go.mod`
    - `kernel/nerv/seraph/atf_style.go`
    - `kernel/api/router.go`
    - `kernel/api/search.go`
    - `kernel/model/search.go`
    - `kernel/api/sql.go`
    - `kernel/sql/block_query.go`
    - `kernel/api/embedding.go`
    - `kernel/api/vector.go`
    - `kernel/vectordb`
    - `kernel/nerv/magi/sages/sage.go`
    - `kernel/nerv/magi/coordinator/collector.go`
    - `toread/myclaw/internal/memory/memory.go`
    - `toread/nanoClaw/nanoclaw/core/agent.py`
    - `toread/nanoClaw/nanoclaw/core/context.py`
    - `toread/nanoClaw/nanoclaw/memory/store.py`
    - `toread/nanoClaw/nanoclaw/tools/memory_tools.py`

- [ ] **Phase 2: 单轮多步工具调用循环 (P0)**
  - **背景**: 目标 1 要求保持三贤人职责边界：Melchior/Balthazar 在一轮内可多次主动查笔记，Casper 维持被动召回与快速决策信号路径。
  - **行动**:
    1. 设计分角色工具循环执行器（Melchior/Balthazar: assistant -> tool -> assistant；Casper: 不进入主动查询循环）。
    2. 拆分终止信号：三贤人仅允许 `decision_signal/handoff_to_trinity/max_steps/timeout/error`；Trinity 仅允许 `speak` 作为最终输出信号。
    3. 定义三贤人“决策结束信号工具族”（至少覆盖审慎信号与交接信号）及最小载荷字段。
    4. 为 Melchior/Balthazar 引入主动查询笔记工具，并定义每轮最小步数与预算上限。
    5. 明确 Casper 仅使用被动召回结果，不注册主动查询工具；若出现主动查询调用则拒绝并记录原因。
    6. 统一 Trinity `speak` 载荷结构，至少包含 `message_id`、`channel`、`content`，并与三贤人决策信号建立映射关系。
  - **验收标准**:
    - Melchior/Balthazar 每轮至少支持 3 步主动工具调用，并以“决策结束信号/预算终止/错误”之一收敛进入 Trinity。
    - Casper 主动查询工具调用步数为 0；若尝试主动查询，必须可观测地拒绝或降级。
    - 三贤人不调用 `speak`；Trinity 成功输出路径必须包含 `speak(channel=public)`。
    - `message_id + channel + termination_reason` 在事件流与上下文回写中一致可追踪。
    - 发生工具异常时显式中断并上抛错误，不静默吞错。
  - **参考文档**:
    - `kernel/nerv/magi/stream/processor.go`
    - `kernel/nerv/magi/coordinator/collector.go`
    - `kernel/nerv/magi/coordinator/trinity.go`
    - `docs/ttt/MAGI_词法SQL向量召回工具接线.shortterm.ttt.md`
    - `toread/myclaw/internal/config/config.go`
    - `toread/nanoClaw/nanoclaw/core/agent.py`
    - `toread/nanoClaw/nanoclaw/security/budget.py`
    - `toread/nanoClaw/tests/test_agent.py`
    - `docs/ttt/MAGI_三贤人机制完善.shortterm.ttt.md`

- [ ] **Phase 3: 回合状态机与 Trinity 全局工作空间收敛 (P1)**
  - **背景**: 目标 2 要求明确“外部输入 -> 三贤人并发 -> 完成/超时 -> Trinity”固定链路。
  - **行动**:
    1. 固化回合状态机并编码为可测试的转换图。
    2. 增加“思考过久”判定与超时策略，统一进入 Trinity 的输入封包。
    3. 将三贤人阶段性决策信号与中间结论统一汇入 Trinity 工作空间，禁止三贤人直接生成对外 `speak`。
    4. 补充 WebSocket 事件语义，使阶段切换可回放。
  - **验收标准**:
    - 状态机路径覆盖测试通过，非法跳转全部报错。
    - 超时场景下仍可稳定进入 Trinity 汇聚，不出现悬空协程。
    - Trinity 工作空间输入包含三贤人结果、终止原因、耗时元数据。
  - **参考文档**:
    - `kernel/nerv/magi/coordinator/coordinator.go`
    - `kernel/nerv/magi/coordinator/trinity.go`
    - `kernel/nerv/magi/websocket/events.go`
    - `toread/myclaw/internal/gateway/gateway.go`
    - `toread/myclaw/internal/bus/bus.go`
    - `toread/myclaw/internal/channel/manager.go`
    - `toread/nanoClaw/nanoclaw/channels/gateway.py`

- [ ] **Phase 4: 直答门禁硬路由治理 (P1)**
  - **背景**: 目标 3 明确 MAGI 永远只响应直答许可来源（`DirectResponseAllowed=true`），其它全部由 Avatar 响应。
  - **行动**:
    1. 固化来源口径：`TrustLevel=low|medium|high` 与 `SourceChannel=guardian|external-agent|system-cron|unknown`，禁止业务层自定义“highest”。
    2. 将“`DirectResponseAllowed=false` -> Avatar”变为强制规则，并建立拒绝原因字段。
    3. 对所有入口补充路由一致性测试与回归测试。
  - **验收标准**:
    - `DirectResponseAllowed=false` 请求 MAGI 直答命中率为 0。
    - `DirectResponseAllowed=true` 请求才允许进入 MAGI 直答路径。
    - 路由拒绝均带结构化理由，不存在隐式回退。
    - Avatar 不可用时返回明确错误，不自动改走 MAGI 直答。
  - **参考文档**:
    - `kernel/nerv/magi/types/types.go`
    - `kernel/api/magi_source.go`
    - `kernel/nerv/magi/coordinator/coordinator.go`
    - `kernel/nerv/magi/coordinator/avatar_runtime.go`
    - `kernel/api/magi_source_test.go`
    - `kernel/nerv/magi/coordinator/coordinator_test.go`
    - `toread/myclaw/internal/channel/base.go`
    - `toread/myclaw/internal/channel/manager.go`
    - `toread/nanoClaw/nanoclaw/channels/gateway.py`
    - `toread/nanoClaw/nanoclaw/channels/telegram.py`

- [ ] **Phase 5: 任其崩溃与错误语义收敛 (P1)**
  - **背景**: 目标 4 要求非必要不兜底、不得静默错误，除非涉及笔记数据安全。
  - **行动**:
    1. 全量审查 MAGI 链路中的 fallback/retry/swallow error 点位。
    2. 定义“数据安全威胁”判定标准和唯一允许的保护性兜底类型。
    3. 为错误路径补全事件与日志，建立错误码和可观测字段。
    4. 清理不必要“成功回退”逻辑，保留显式失败。
  - **验收标准**:
    - 非数据安全场景无静默错误路径。
    - 所有异常在返回值+事件+日志中至少两处可见。
    - 保护性兜底均可被审计追踪并含触发证据。
  - **参考文档**:
    - `kernel/nerv/magi/coordinator/*.go`
    - `kernel/nerv/magi/llm/client.go`
    - `kernel/nerv/magi/websocket/events.go`
    - `toread/nanoClaw/nanoclaw/security/audit.py`
    - `toread/nanoClaw/nanoclaw/security/prompt_guard.py`
    - `toread/nanoClaw/nanoclaw/security/budget.py`

---

## 🟡 中期计划

- [ ] **Phase 6: 工具治理与权限分级 (P2)**
  - **背景**: 多步工具后需长期治理工具权限与生命周期。
  - **行动**: 建立工具注册、权限级别、弃用策略、审计策略统一模型。
  - **验收标准**: 任一工具调用可追溯“谁在何信道、以何权限调用”。

- [ ] **Phase 7: Trinity 工作空间可视化与回放 (P2)**
  - **背景**: 调试多步思考链路需要高质量回放能力。
  - **行动**: 将三贤人阶段输出和 Trinity 汇聚过程可视化。
  - **验收标准**: 支持按 `round_id` 重建完整执行轨迹。

- [ ] **Phase 8: 故障演练与压测基线 (P2)**
  - **背景**: Crash-only 策略需通过故障注入验证而非口头保证。
  - **行动**: 建立超时、工具失败、路由拒绝、并发拥塞四类演练。
  - **验收标准**: 四类故障均有稳定失败语义和可观测输出。

---

## 风险与依赖

1. **高风险**: Melchior/Balthazar 多步工具循环若无严密终止条件，可能导致无限循环或响应阻塞。
2. **高风险**: 若未做角色分层门禁，Casper 可能被误配置为主动多步查询，破坏“本能/快速响应”特性。
3. **高风险**: 三贤人“决策结束信号工具族”与 Trinity `speak` 双协议扩展会影响现有事件消费端兼容性。
4. **中风险**: 直答门禁硬路由可能暴露历史入口的隐式依赖。
5. **中风险**: Crash-only 收敛会短期增加显式失败数量，需要配套运维观测。
6. **关键依赖**: 词级分词（`gse`）与 FTS/SQL 检索链路（`/api/search/fullTextSearchBlock`、`/api/query/sql`）在容量和延迟上可满足召回预算。
7. **关键依赖**: Avatar 路径必须在 `DirectResponseAllowed=false` 来源下具备可用性与容量。

---

## 🏁 已归档/已完成

- [x] **立项：三贤人机制完善 TTT 创建** [已完成 2026-03-10]
  - **背景**: 需要将目标 0-4 结构化为可执行、可验收、可归档的阶段计划。
  - **完成情况**: 已按 TTT 规程建立目标、原则、阶段、验收标准、风险和归档机制。
  - **成果文件**:
    - `docs/ttt/MAGI_三贤人机制完善.ttt.md`
  - **参考文档**:
    - `docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`
