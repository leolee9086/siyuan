# Agent统一消息队列机制执行跟踪 (TikTocTak)

> **目标**: 建立一套统一处理「所有进入 agent 输入的消息」的 SOTA 队列机制——既满足 native agent 的队列/引导/中断/异步工具返回需求，也能直接替换 MAGI 现有队列；不同消息语义走独立 API 端点（避免污染上游 `/api/agent/chat`）；包内职责与消费者职责边界清晰，全部以测试保证。
>
> **架构定位（已确认 2026-08-02，两次演进）**:
> 1. **一次性 agent ⊂ loop agent**: `AgentChat` 单次运行 ≡ loop 的一次迭代（一个 turn）；loop 所需的输入队列、事件驱动、主动触发、持久化由 agentqueue + 会话执行器补齐。
> 2. **常驻执行器 + 操作系统中断模型（本次确认）**: 所有 agent 均视为「常驻」——普通 agent 不再由 HTTP 请求驱动，而是常驻循环**主动从抽象的「消息源（Message Source）」拉取外部消息**，处理结果经**响应渠道（Response Channel）**输出。普通 agent 当前**只有一个响应渠道：HTTP/SSE**。挂起模拟采用 **OS 中断模型**：执行器 goroutine 阻塞在等待原语上（闲时零 CPU 消耗），消息到达 = 中断触发；前端无连接 = 中断被屏蔽，执行器主动阻塞。
>
> **总体判定**: 🟡进行中：`packages/agentqueue` 独立包已完成（保护环优先队列、语义注册表、队列策略、持久化接口、per-session 调度、79 个测试全绿）；**agent 侧中断模型改造已完成**（WaitNext 原语 + kernel 接入 + 会话执行器 + agentChat handler 改造为 Subscribe→Submit→SSE，外部行为不变）；**资源隐患治理完成**（空闲回收/Prune/subscribe 单流限制/GetOrCreateInbox/runTurn 语义表驱动）；**Phase 1 剩余项**（AgentChat injectCh、新端点、runningSessions 409→202）未开始。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 🎯 核心原则

### 第一性排序

- **先独立包，再业务接入**: `packages/agentqueue` 独立实现、测试保证、职责边界清晰是第一步；native agent / MAGI / 前端接入只能在这些完成后进入近期计划。
- **独立端点，零参数污染**: 不同消息语义（steer / queue / interrupt / tool_result / channel_inbound / system）各走独立 API 端点，现有 `/api/agent/chat` 请求结构保持不动，避免与上游思源 merge 冲突。
- **语义与优先级分离**: 每条输入携带 Semantics（投递方式）与 Priority（调度顺序），由来源方声明，调度核心不感知具体业务。
- **包内/消费者职责边界**: 队列原语、策略、持久化接口、事件分发在包内；ResultChan、流式回传、抢占策略、SQLite 实现、前缀分流、回复路由由消费者处理。
- **SOTA 对标**: 队列语义对齐 OpenClaw（steer/followup/collect/interrupt、drop policy、dedupe、laneKey、claim 恢复、持久化、多订阅者事件）；覆盖 MAGI `DispatcherRingQueue` 全部能力（且为超集）。

### 验证检查清单（包内已完成项）

- [x] `packages/agentqueue` 独立 Go module，不依赖 kernel 任何包，`go test -race` 全绿（72 用例）。
- [x] 保护环优先队列 `RingQueue[T]` API 对齐 MAGI `DispatcherRingQueue`（Push/PopBlocking/PopNonBlocking/Peek/Len/RingLen + Close 超集）。
- [x] 语义注册表（`RegisterSemantics`）满足开闭原则：新增语义零修改既有代码。
- [x] 队列策略：drop policy（new/old/summarize）、dedupe（message-id/prompt/none）、collect（TakeBatch）、laneKey 串行、RecoverStale 超时恢复。
- [x] 持久化接口 `QueueStorage` + MemoryStorage/FileStorage 参考实现 + Checkpoint/RestoreFromStorage。
- [x] 多订阅者事件（Subscribe/Unsubscribe）+ 单回调兼容（SetOnChanged）。
- [x] 并发安全：Submit/Take 不写调用方对象、Take 返回深拷贝、锁顺序统一（复核修复项全部回归通过）。
- [x] kernel 接入后：`go test -race -count=1 ./kernel/agent/... ./kernel/api/...` 全绿（2026-08-02，含 agent_executor 9 用例）。
- [ ] 前端接入后：`pnpm test` 全绿（未开始）。

### 禁止事项

- **禁止**在 3 个架构决策确认前开始 kernel 接入（避免返工）。
- **禁止**修改 `/api/agent/chat` 现有请求/响应结构（上游兼容红线）。
- **禁止**把 MAGI 的 `DispatcherTask`/`ResultChan`/`ReplyStreamObserver` 概念硬塞进 agentqueue 核心包（属消费者职责）。
- **禁止**为了"快速接入"跳过测试门禁（包内 72 用例、kernel go test、前端 pnpm test）。
- **禁止**把 loop 逻辑（队列轮询、多 turn 循环、事件分发）塞进 `AgentChat`——它是 turn 执行体，loop 主循环必须在会话执行器外层（架构定位红线）。
- **禁止**用「每 turn 一个请求」的 SSE 模型作为终态方案——它只是过渡形态，最终应走向长生命周期事件流订阅（方案 B/C，见「近期计划」决策项 1）。

---

## 🧭 目标架构

### 架构定位：一次性运行 agent ⊂ loop 循环式 agent（已确认 2026-08-02）

**结论**：当前 s-forge 的一次性运行 agent 是 OpenClaw 等 loop 循环式 agent 的**子集**——`AgentChat` 单次运行正是 loop 的一次迭代（一个 turn），loop 的全部扩展能力（运行中输入、排队、主动触发、持久化、多通道路由）在 `AgentChat` 上均不存在，需要通过「会话执行器 + agentqueue」在外层补齐。

**能力对比表（源码级证据）**：

| 维度 | s-forge 一次性 AgentChat（`kernel/agent/agent.go`） | OpenClaw loop agent（`D:\dev\s-temp\openclaw`） |
|---|---|---|
| 触发方式 | HTTP 请求驱动，单次运行 | gateway 常驻，事件驱动 |
| 输入 | 单一 `userMessage` 参数（`agent.go:470`） | 多渠道消息 + 会话队列 + steering 结果 + 心跳 + cron |
| 执行循环 | `for round := 0; ...; round++`（LLM+工具，`agent.go:651`） | agent run（每 turn 一次，内部同样有工具循环） |
| 输出 | `<-chan AgentEvent` 流式事件 | 流式事件（workboard/chat 订阅） |
| 交互 | confirm/question/frontend 阻塞握手 | approval/ask 等（等价物） |
| 生命周期 | 请求 → done/error 结束 | 常驻，无限循环 |
| 持久化 | checkpoint（session.json）恢复 | SQLite（ingress queue + 状态） |

**关键映射**：

```text
OpenClaw「一次 agent run」  ≡  s-forge「一次 AgentChat 运行」   ← 同一概念
OpenClaw「gateway 主循环」   ≡  s-forge「会话执行器」缺失部分    ← 待构建
OpenClaw「队列 + 事件分发」  ≡  agentqueue InboxManager         ← 已完成
```

**三大架构含义**：

1. **AgentChat 应保持「单次运行」语义不动**——它是 turn 执行体，不该被塞进 loop 逻辑（loop 循环、队列轮询、事件分发均在外层）；
2. **loop 主循环（会话执行器）必须在外层**——持有 `InboxManager`，做「空闲 `Take(sessionID)` → 启动 AgentChat → 运行中注入 → 结束 → 再 Take」的循环；
3. **SSE 模型决策权重改变**：loop 模型下「每 turn 一个 HTTP 请求」（方案 A）是次优形态——OpenClaw 采用**长生命周期事件流订阅**（UI 订阅 session 事件，loop 推送所有 turn 的事件）。s-forge 已有 `broadcastAgentSessionChanged`（WS 广播）与 MAGI `websocket.Pusher` 基础，方案 B/C 可行性上升（详见「近期计划」决策项 1）。

---

### 架构定位（演进 2）：常驻执行器 + 操作系统中断模型（已确认 2026-08-02）

**结论**：所有 agent 均视为「常驻」。普通 agent 不再由 HTTP 请求驱动，而是常驻循环**主动从抽象的「消息源（Message Source）」拉取外部消息**，处理结果经**响应渠道（Response Channel）**输出。普通 agent 当前**只有一个响应渠道：HTTP/SSE**；消息源未来可扩展（HTTP、渠道桥、定时任务等）。

**MAGI 空闲时做什么（常驻 agent 现有范例，源码证据）**：

| 机制 | 源码 | 空闲时行为 |
|---|---|---|
| 心跳调度循环 | `magi_runtime.go:95-146` `heartbeatLoop` | 每 1 分钟 tick；按清醒/睡眠动态调整间隔（清醒 5min、睡眠 30/45/60min 渐进、唤醒过渡 `(n+1)*5min`） |
| 心跳任务入队 | `magi_runtime.go:191-254` `tryStartHeartbeat` | 无活动心跳时构造 `DispatcherTask{Type: TaskTypeHeartbeat}` 推入 **Ring1Heartbeat** |
| 常驻消费 | `magi.go:400-426` `unifiedDispatcher` | `PopBlocking()` 无限循环；心跳任务 → `CoordinateHeartbeat`（被动召回/工作日志/主动任务检查） |
| 外部消息抢占 | `magi.go:698` + `magi_runtime.go:329-346` | 外部消息到达 → `InterruptHeartbeat()` cancel 心跳 → Push **Ring0ExternalMessage**（更高优先级）→ 前台处理 |

**OS 中断模型类比映射**：

| OS 概念 | Agent 架构映射 |
|---|---|
| CPU 常驻调度循环 | Agent 执行器（每 session 一个常驻 goroutine） |
| 进程挂起（就绪/阻塞） | 执行器阻塞在等待原语上（无消息时零 CPU 挂起） |
| 中断（IRQ） | 消息到达 → `InboxManager.Submit()` 入队 |
| 中断向量/IDT 分发 | `Take` 返回 → 按语义分发（steer/queue/interrupt/tool_result） |
| ISR（中断服务程序） | 一次 turn 处理（`AgentChat` 单次运行） |
| IRET 返回 | turn 结束（done）→ 回到阻塞点继续循环 |
| 前端无连接 = 中断被屏蔽 | 执行器检测无 SSE 订阅者 → 事件无处推送 → 主动阻塞回等待原语 |

**挂起机制关键决策（本次确认）**：用什么模拟挂起——**闲时性能消耗要足够低**。

- **选定方案**：Go channel 阻塞接收（`select { case <-signal: ... }`）。
  - 阻塞在 channel 上的 goroutine 由 Go runtime 挂起，**不占用 CPU**（GOMAXPROCS 内不参与调度）；
  - 内存占用极小（一个 goroutine 栈 + 一个容量 1 的信号 channel）；
  - 唤醒路径是 runtime 直接投递，无轮询开销；
  - 与 OS「进程挂起等待中断」语义完全同构。
- **排除方案**：
  - 轮询 + sleep（有唤醒延迟与空转 CPU 开销，不满足「闲时足够低」）；
  - 自旋等待（忙等，禁止）；
  - 信号量/条件变量（可行但 Go 惯用法是 channel，且 channel 可直接参与 `select` 与 `ctx.Done()` 组合）。
- **实现载体**：`SessionInbox` 增加内部信号 channel（容量 1，合并唤醒），`Submit` 成功后非阻塞发送信号；`InboxManager` 暴露 `WaitNext(sessionID) <-chan struct{}` 供执行器阻塞等待。**该原语是本次实现项（见近期计划 Phase 0b）。**

**外部行为一致性**：HTTP 端点、SSE 事件类型（thinking/content/tool_call/done…）、`runningSessions` 语义**全部保持不变**——前端感知仍是「发一条消息 → 收一条流式回复 → done」；变的是内部驱动模型（请求驱动 → 中断驱动）。请求语义从「启动 agent」变为「投递消息到消息源 + 建立/复用响应订阅」。

### 依赖方向

```text
前端（app/src/layout/dock/agent/ + magi/）
    ↓ SSE / 独立 API 端点
kernel/api（新端点 + AgentEvent 扩展 + 会话执行器）
    ↓
kernel/agent（AgentChat 注入通道改造）/ kernel/api（MAGI 适配）
    ↓
packages/agentqueue（独立包，已完成）
    ↓
标准库
```

### 包内当前公共 API（已完成）

- `RingQueue[T]`：保护环优先队列（可直接实例化为 `RingQueue[*DispatcherTask]` 替换 MAGI 队列）。
- `Input` / `InputSemantics` / `InputPriority` / `SourceContext` / `InboxStatus`：统一输入信封。
- `RegisterSemantics(s, SemanticsMeta)`：语义注册表（开闭原则）。
- `QueueSettings`：drop policy / dedupe / collect / stale 恢复策略。
- `SessionInbox`：per-session 队列（Submit/Take/TakeBatch/RecoverStale/Mark*/Summary/Checkpoint/Restore）。
- `QueueStorage` 接口 + `MemoryStorage` / `FileStorage`：持久化。
- `InboxManager`：全局调度（Submit/Take/NextDue/Subscribe/RegisterInbox/RecoverAllStale/透传）。

### 待接入形态（kernel 侧）

- `kernel/agent/agent.go`：`AgentChat` 增加可选 `injectCh <-chan agentqueue.Input` 参数（不传则行为与现在完全一致）。
- 新增会话执行器（归属待决策）：持有 `InboxManager`，空闲 Take → 启动 AgentChat → 运行中注入 → 结束。
- `kernel/api/agent.go`：新端点（`/steer` `/queue` `/queue/cancel` `/interrupt` `/api/agent/tool/result`）+ SSE 新事件（`queue_state`/`steer_accepted`/`interrupted`）+ `runningSessions` 语义重构。
- `kernel/api/magi.go`：`DispatcherRingQueue` 替换 / `handleChannelInbound` 迁移 / `MessageStore` 实现 `QueueStorage`。

---

## 🟢 近期计划

- [x] **架构决策确认（P0）** [已完成 2026-08-02]
  - **背景**: 复核发现 3 个架构问题，原计划需修正后才能落地；架构定位两次演进后方向已明确。
  - **已确认结论**:
    1. **常驻执行器 + 中断模型**：所有 agent 视为常驻，普通 agent 由「请求驱动」改为「主动从消息源拉取 + 响应渠道输出」（详见「目标架构-架构定位（演进 2）」）。
    2. **挂起机制**：Go channel 阻塞接收（`WaitNext` 原语），闲时零 CPU 消耗（详见「挂起机制关键决策」）。
    3. **响应渠道**：普通 agent 当前唯一响应渠道为 HTTP/SSE；前端无连接时执行器主动阻塞（中断被屏蔽）。
  - **验收标准**: 已满足——结论写入本文档目标架构章节。

- [x] **Phase 0b: agentqueue 阻塞挂起原语（P0）** [已完成 2026-08-02]
  - **背景**: 常驻执行器需要在无消息时「挂起」且闲时零 CPU；当前 `InboxManager.Take` 是非阻塞返回 nil，无阻塞等待原语。
  - **行动**: `SessionInbox` 增加内部信号 channel（容量 1，合并唤醒）；`Submit` 成功后非阻塞发送信号；`InboxManager` 暴露 `WaitNext(sessionID) <-chan struct{}` 供执行器 `select { case <-signal: ... case <-ctx.Done(): ... }` 阻塞等待；测试覆盖唤醒正确性（Submit 后 WaitNext 返回）、零 CPU 挂起（阻塞不消耗）、并发安全。
  - **验收标准**: `go test -race` 全绿；新增 WaitNext 原语测试；闲时 goroutine 阻塞在 channel（runtime 不调度，零 CPU）。
  - **成果文件**: `packages/agentqueue/`（manager.go/inbox.go 扩展）。

- [x] **Phase 0: 接入准备（P0）** [已完成 2026-08-02]
  - **背景**: agentqueue 包已独立完成，kernel 侧目前零引用。
  - **行动**: `kernel/go.mod` 添加 `require github.com/siyuan-note/siyuan/packages/agentqueue v0.0.0` + `replace => ../packages/agentqueue`（仿 `packages/websearch` 模式）；`go build ./...` 验证编译。
  - **验收标准**: `go build ./...` 退出码 0；agentqueue 独立测试仍全绿（72 用例）。

- [ ] **Phase 1: native agent 会话执行器（P0，架构核心，工作量最大）——驱动模型改造已完成，注入通道与新端点未开始**
  - **背景**: `AgentChat` 是单次运行 goroutine（`agent.go:470`），无法感知新入队输入；原计划"主循环检查队列"需修正为执行器 + 注入通道。
  - **已完成（2026-08-02，外部行为不变）**:
    - `kernel/api/agent_executor.go`：会话执行器（每 session 常驻 goroutine，WaitNext 阻塞→Take→AgentChat→事件转发订阅），含资源治理（空闲回收/Prune/subscribe 单流限制/GetOrCreateInbox/runTurn 语义表驱动）。
    - `kernel/api/agent.go` agentChat handler：请求语义从「启动 agent」变为「订阅响应 + 投递消息到消息源（Submit）」，SSE 循环读订阅 channel——HTTP 端点、SSE 事件类型、runningSessions 语义（409 互斥、streamStart/streamEnd）与改造前完全一致。
  - **待办（Phase 1 剩余）**:
    1. `kernel/agent/agent.go`：`AgentChat` 增加可选 `injectCh <-chan agentqueue.Input` 参数；主循环每轮 LLM 请求前 `select` 注入通道 → 追加 user 消息到 `messages`/`checkpointMsgs` → 发 `steer_accepted` 事件（向后兼容：不传注入通道则行为不变）。
    2. 新端点（全部独立，`/api/agent/chat` 零改动）：`POST /steer`、`POST /queue`、`POST /queue/cancel`、`GET /queue`、`POST /interrupt`、`POST /api/agent/tool/result`；新增端点必须先 `getAgentExecutor` 或由调度器兜底，避免无执行器时消息滞留。
    3. `writeSSE` 增加 `queue_state`/`steer_accepted`/`interrupted` 事件；`AgentEvent` 增加 `InputID`/`QueueState` 字段；`runningSessions` 语义从「AgentChat 互斥」重构为「执行器存在」（运行中消息入队返回 202，409 保留给旧前端兜底）。
  - **验收标准**: `go test -short -tags fts5 ./kernel/agent/... ./kernel/api/...` 全绿；新增单测覆盖注入时机、steer 注入、409→202 语义。

## 🟡 中期计划

- [ ] **Phase 2: 前端接入（P1，与 Phase 1 并行）**
  - **背景**: 前端 `isStreaming` 时锁死 composer（`streamingState.ts`），`send.helpers.ts:29` 拦截运行中发送；需解锁并支持排队/引导。
  - **行动**: 解锁 composer（运行中发送 → steer/queue 端点）；移除 `isStreaming` 发送拦截；新增 queue 面板 + SSE 事件消费；stop → 中断+引导输入流；按决策的 SSE 模型实现续发。
  - **验收标准**: `pnpm test` 全绿（vitest）；手动验证运行中输入、排队徽标、中断+引导流程。

- [ ] **Phase 3: MAGI 替换（P1，分两步）**
  - **背景**: MAGI 队列 = `DispatcherRingQueue` + `unifiedDispatcher` + `DispatcherTask`（含 ResultChan/ReplyStreamObserver）+ 心跳 Ring1 + `MessageStore` 持久化；agentqueue 已覆盖队列核心并明确消费者职责。
  - **行动 3a（轻量替换）**: `magi_priority_queue.go` 内部改用 `RingQueue[*DispatcherTask]`；`unifiedDispatcher`/ResultChan/心跳不动；心跳显式 Push(Ring1)。
  - **行动 3b（增强迁移）**: `handleChannelInbound`/`handleCLIInbound`（`magi.go:694/842`）改为构造 `agentqueue.Input` 进 `InboxManager`（ResultChan/ReplyStreamObserver 经 `Metadata` 携带）；`MessageStore` 实现 `QueueStorage` 接口（SQLite 适配，对齐 `channel/message_store.go` 模型）。
  - **验收标准**: `go test -short -tags fts5 ./kernel/api/...` 全绿；MAGI 多通道回归（微信/CLI/心跳抢占）。

## 🔴 远期计划

- [ ] **Phase 4: 持久化与崩溃恢复端到端（P2）**
  - **愿景**: native agent 执行器接入 `QueueStorage`（FileStorage 起步，SQLite 后补）；崩溃恢复端到端（运行中入队 → 杀内核 → 重启 → 队列恢复）；与现有 `AgentChat.recoverTurn.ts` 恢复协议交互验证。
  - **前置条件**: Phase 1/2/3 完成；持久化时机（turn 边界 Checkpoint）与现有恢复协议协调明确。

- [ ] **Phase 5: OpenClaw 对标增强（P2，可选）**
  - **愿景**: 补齐 OpenClaw 对标差距中仍属包内职责的部分（如需）：EventHub 式事件流（多订阅者 + replay）、prompt 级跨会话去重缓存、laneKey 与 collect 的 drain 层整合。
  - **前置条件**: 接入稳定后按实际需求评估；debounce 计时、prompt 合并等已确认属消费者职责的不回包。

---

## 🏁 已归档/已完成

- [x] **agentqueue 独立包第一版（P0）** [已完成 2026-08-02]
  - **背景**: 原计划要求在 `packages/` 以独立包实现队列，既能满足普通 agent 需求，也能直接替换 MAGI 队列。
  - **完成内容**: 创建 `packages/agentqueue`（module `github.com/siyuan-note/siyuan/packages/agentqueue`）；`ring.go`（保护环优先队列，API 对齐 MAGI `DispatcherRingQueue` + Close 超集）；`types.go`（统一输入信封 + 语义注册表 + SourceContext + LaneKey）；`settings.go`（QueueSettings：drop policy/dedupe/collect/stale 恢复）；`inbox.go`（per-session 队列：策略应用、lane 串行、TakeBatch、RecoverStale、Summary）；`storage.go`（QueueStorage 接口 + Memory/File 实现 + Checkpoint/RestoreFromStorage）；`manager.go`（全局调度：多订阅者事件、RegisterInbox、透传方法）。
  - **修复内容（生产级复核）**: 默认值常量化；语义特性表驱动（开闭原则）；Submit 不写调用方对象（克隆补默认）；Take 返回深拷贝；Metadata 递归深拷贝；Push 持锁发送消除 TOCTOU；NextDue 锁顺序统一。
  - **测试验证**: `go test -race -count=1 ./...` 全绿，72 用例（ring 15 / inbox 15 / manager 20 / regress 5 / settings 17）；`gofmt -l` 干净；`go vet` 通过。
  - **成果文件**: [`packages/agentqueue`](../../../packages/agentqueue)。

- [x] **需求与可行性研究（P0）** [已完成 2026-08-02]
  - **背景**: 明确需求不是简单"队列+引导"，而是「所有进入 agent 输入的消息的统一处理」（含异步工具返回等）；且不同语义走独立 API 端点而非参数。
  - **完成内容**: 读透 MAGI 队列（`DispatcherRingQueue`/`unifiedDispatcher`/心跳抢占/`MessageStore`）；对照 OpenClaw 源码（`D:\dev\s-temp\openclaw`：ingress-queue/queue/steering-queue/EventHub/heartbeat）；输出两份对照报告（OpenClaw 响应方式支撑度、MAGI 队列覆盖度）；明确包内/消费者职责边界。
  - **结论**: 队列核心机制 100% 覆盖 MAGI 且为超集；OpenClaw 对标差距（持久化、collect、drop policy、debounce、laneKey、claim 恢复、事件流）已纳入包内实施或消费者职责。

- [x] **原计划可行性复核（P0）** [已完成 2026-08-02]
  - **背景**: 任务逐渐复杂，需复核此前 kernel 接入计划是否可行。
  - **完成内容**: 发现 3 个架构问题——(1) AgentChat 单次运行 vs 队列持续消费（需会话执行器 + 注入通道）；(2) "turn 结束自动提升" 与 "每请求一个 SSE 流" 模型冲突（方案 A 前端驱动续发 / 方案 B 单连接推流）；(3) MAGI 替换的 ResultChan 语义需经 Metadata 适配。输出调整后 Phase 0-4 计划。
  - **结论**: 大方向正确、分层合理；3 个架构决策待用户确认后进入 Phase 0/1。

- [x] **Phase 0b + Phase 0 + Phase 1 驱动模型改造（P0）** [已完成 2026-08-02]
  - **背景**: 用户确认「首先完成 agent 侧的中断模型改造，但现阶段必须保证 agent 外部行为和原本一致」——即先落地常驻执行器驱动模型，HTTP 端点 / SSE 事件类型 / runningSessions 语义全部保持不变。
  - **完成内容**:
    1. **Phase 0b 阻塞挂起原语**: `SessionInbox` 内部 signal channel（容量 1，合并唤醒）+ `Submit` 持锁内非阻塞发送；`InboxManager.WaitNext(sessionID) <-chan struct{}` 透传（同包直接访问私有字段，无 SessionInbox 层冗余抽象）；新增 5 个 WaitNext 测试（唤醒/阻塞/合并/并发/未知会话）。
    2. **Phase 0 接入**: `kernel/go.mod` 添加 `require` + `replace => ../packages/agentqueue`（仿 websearch 模式）；`go build ./...` 通过。
    3. **Phase 1 驱动模型改造（外部行为不变）**: 新建 `kernel/api/agent_executor.go` 会话执行器（每 session 常驻 goroutine：WaitNext 阻塞 → Take → 按语义表驱动分发 turn → 事件转发订阅 channel）；`agentChat` handler 改造为「订阅响应（subscribe）→ 投递消息到消息源（Submit 入队）→ SSE 循环读订阅」，`runningSessions` 409 互斥、streamStart/streamEnd、SSE 事件类型与改造前完全一致。
  - **资源隐患治理（超高并发审查后）**:
    - **空闲自动回收**: 执行器 `idleTimeout`（默认 10min）到期且队列为空时 selfStop 移出注册表，下次请求懒重建——解决「常驻 goroutine 随会话数无限增长」；selfStop 持 `agentExecutorsMu` 原子检查 PendingCount + 删除，杜绝「timer 与 WaitNext 同时就绪随机选中导致消息丢失」；drain 后清空过期 timer 信号再 Reset，避免长任务后误回收。
    - **Prune 历史项**: `safeDrain` defer 统一 `manager.Prune(sessionID, maxRetained)`（默认 100），解决 inbox items 无限累积。
    - **subscribe 单流限制**: 已有活动订阅时返回 `ErrAgentSessionBusy` 而非 close 旧 channel——消除「send on closed channel」panic 面，为 Phase 1 放开 409 预留边界。
    - **GetOrCreateInbox**: `InboxManager` 新增复用语义方法，执行器重建时不再 RegisterInbox 覆盖——解决「selfStop 后竞态窗口内入队消息被覆盖丢失」。
    - **runTurn 语义表驱动**: `turnRunners` 注册表按 `InputSemantics` 分发（开闭原则），未注册语义防御性 MarkFailed；保留 `runTurnFn` 测试注入。
    - **stopAgentExecutor 幂等清理**: ex==nil（已被 selfStop 移除）时也执行 RemoveSession，避免 inbox 残留。
    - **魔法数字常量**: `agentEventBufferSize`（256）/`agentEventErrorBuffer`（1）。
    - **forwardEvents 取消语义**: AgentChat channel 关闭时按 `sub.ctx.Err()` 区分正常结束（injected）与请求取消（cancelled），修复取消竞态下误标 injected。
  - **测试验证**:
    - `packages/agentqueue`: `go test -race -count=1 ./...` 全绿，79 用例（原 72 + WaitNext 5 + GetOrCreateInbox 2）。
    - `kernel`: `go test -race -count=1 ./agent/... ./api/...` 全绿（agent_executor 9 用例：事件转发/取消/无订阅者失败/串行 turn/空闲回收/回收后重建/Prune/订阅冲突/selfStop 非空拒绝/回收保留消息）；`gofmt -l` 干净；`go vet ./api/... ./agent/...` 通过；`go build ./...` 通过。
  - **成果文件**: [`packages/agentqueue`](../../../packages/agentqueue)（manager.go/inbox.go）、`kernel/api/agent_executor.go`、`kernel/api/agent_executor_test.go`、`kernel/api/agent.go`（agentChat handler）、`kernel/go.mod`。

## 📎 适用规程

- [`docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`](../../规程/tiktoctac文档(ttt)编写规程.procedure.md)：本文档结构规程。
- [`docs/规程/代码质量/Go后端代码重构.procedure.md`](../../规程/代码质量/Go后端代码重构.procedure.md)：独立包化和接口统一规程。
- [`docs/规程/测试与修复/后端Go测试编写.procedure.md`](../../规程/测试与修复/后端Go测试编写.procedure.md)：Go 测试补齐规程。
- 参考对照：`docs/ttt/vectordb/向量数据库独立包化与SOTA实现.ttt.md`（独立包化任务模板）。

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】少于 2 个任务时，从【中期计划】里挑选任务挪上来。
3. **因地制宜**：如果发现计划不合理，随时修改或删除，但不得改变"先独立包与测试保证，后业务接入"的顺序。
4. **数据驱动**：所有结论必须有测试命令、用例数与结果记录。
5. **决策优先**：任何 kernel 接入任务进入近期计划前，必须先确认 3 个架构决策点已明确。
6. **loop 定位校验**：任何涉及 `AgentChat` 的改动，先自问「这是 turn 执行体的职责，还是 loop 主循环的职责」——前者改 `AgentChat`，后者改会话执行器/agentqueue，不得混淆。

---

**创建时间**: 2026-08-02
**维护范围**: `packages/agentqueue` 独立包、`kernel/agent`（AgentChat 注入 + 会话执行器）、`kernel/api`（新端点 + MAGI 适配）、前端 agent 面板
**当前阶段**: 🟢 近期计划——Phase 0b/0/1 驱动模型改造已完成（外部行为不变）；Phase 1 剩余（AgentChat injectCh、新端点、409→202）待启动
