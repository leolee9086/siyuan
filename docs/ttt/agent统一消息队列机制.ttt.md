# Agent统一消息队列机制执行跟踪 (TikTocTak)

> **目标**: 为 native Agent 面板建立一套统一处理运行中输入的 SOTA 机制——支持 steer、严格 FIFO queue、interrupt、异步工具返回、持久化恢复和多面板事件同步；不同消息语义走独立 API 端点（避免污染上游 `/api/agent/chat`）；包内职责与消费者职责边界清晰，全部以测试保证。MAGI 内部、channel adapter、LLM 接口、API 和测试不属于本轮实施范围。
>
> **架构定位（已确认 2026-08-02，两次演进）**:
> 1. **一次性 agent ⊂ loop agent**: `AgentChat` 单次运行 ≡ loop 的一次迭代（一个 turn）；loop 所需的输入队列、事件驱动、主动触发、持久化由 agentqueue + 会话执行器补齐。
> 2. **native 常驻执行器 + 操作系统中断模型（本次确认）**: native Agent 不再由每轮 HTTP 请求独立驱动，而是由会话执行器**主动从抽象的消息源拉取外部消息**，处理结果经 HTTP/SSE 响应渠道输出。执行器 goroutine 阻塞在等待原语上（闲时零 CPU 消耗），消息到达 = 中断触发；前端无连接 = 新 queue 晋升被屏蔽，活动 turn 在宽限期后中断并保留 queue。MAGI 继续使用既有内部执行链路。
>
> **总体判定**: 🟢已完成并通过最终门禁：`packages/agentqueue`、native 会话执行器、独立控制 API、长生命周期事件 Hub、前端运行中 Composer、恢复路径和上游数据兼容均有直接自动化证据。本文现行规格取代下文历史阶段中“裸 injectCh”“runningSessions 表示执行器”“旧 `/chat` 忙时改 202”等过渡设想，历史内容仅保留为演进证据。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 2026-08-03 现行实施规格（权威）

### 最终可观察目标

1. native Agent 在当前 turn 生成、执行工具或等待交互期间，Composer 仍可编辑并提交消息。
2. 用户可显式选择 `steer` 或 `queue`：`steer` 在当前 turn 的下一个安全 provider 边界注入；`queue` 在前序 turn 完成并提交后严格 FIFO 地逐条开启新 turn。
3. native Agent 的 Dock、Tab、浮窗和独立页共享同一套输入视图与状态协议；宿主差异只通过既有能力端口表达，不在共享 UI 中散落宿主分支。
4. 队列 admission、状态变更和载荷在内核重启后可恢复；多面板订阅同一会话时状态一致，不重复执行或重复渲染。
5. 所有完成声明必须由本节验收矩阵中的自动化测试和运行态证据共同证明，局部单测不能替代端到端行为。

### 固定基线与参考证据

- S-Forge 基线：分支 `multipleAI`，提交 `5ee6ae1def81308e588707db95214712f6b9263f`，开始实施时工作树干净。
- Codex 参考：`D:\dev\s-temp\codex-ref` 提交 `c7a4a7e`；`turn/steer` 强制 `expectedTurnId`，无活动 turn、ID 不匹配以及 Review/Compact 等不可引导 turn 均原子拒绝。
- OpenCode 参考：`D:\dev\opencode` 提交 `3a938bb6d`；协议显式使用 `delivery: "steer" | "queue"`，输入先持久化 admission，再由执行循环 promotion；每个边界批量提升 steer，每轮只提升一个 queue。
- OpenCode 提交 `ae7e2eb3f` 只移除了设置界面的 queued follow-up 开关，核心 `session_input` admission/promotion 数据模型仍存在，不能据此删除 queue 架构。
- S-Forge 复用边界：`packages/agentqueue` 拥有队列原语；`kernel/api` 拥有 native 会话执行器、鉴权和响应渠道；`kernel/agent` 只执行一个 turn；共享 Agent 面板通过执行适配器使用能力；MAGI 现有链路保持独立。

### 不变量与禁止项

1. `steer` 不是高优先级 queue。它必须携带 `ExpectedTurnID`，只属于匹配的活动 turn；拒绝后不自动转换为 queue。
2. `queue` 每条消息对应一个独立新 turn，严格按 admission 序号 FIFO；活动 turn 的 provider 边界不得误取普通 queue。
3. 已经发出的 provider 请求和已经执行的工具不回滚；steer 只影响后续 provider 请求。更强语义由 `interrupt` 承担。
4. `done` 仅表示 runtime turn 已终止，`saveSession(commitTurnID)` 成功才表示 canonical session 已提交；提交确认前禁止晋升下一条 queue。
5. `runningSessions` 不再承载多个概念。执行器是否存在、活动 turn、turn phase、提交状态和订阅者数量必须分别建模。
6. 旧 `/api/ai/agent/chat` 请求与 SSE 事件保持兼容，忙时继续返回 409；新 `/steer` 和 `/queue` admission 才返回 202。
7. `Input.Metadata` 不承担跨进程载荷。持久化输入使用版本化、JSON 可恢复的稳定 payload；不落盘 bearer token 或其它秘密。
8. 外部目录会话的事件和队列状态不得进入未携带 owner capability 的全局 WebSocket。
9. 不以每 turn 一个 HTTP 请求作为终态；最终由独立会话事件流承担多 turn、多订阅者和断线 replay。
10. 保持上游思源 Agent 数据兼容：不改变既有 `session.json`、`runtime.json`、会话索引、Entry/turn 字段语义；新增队列快照独立存放于 `storage/ai/agent/queues`。旧数据必须可直接读取，未使用 queue/steer 时写回结果不得产生字段漂移。
11. 本轮只实施 native Agent 面板与其执行链路；MAGI 内部、channel adapter、LLM 接口、API 和测试保持现状，不接入本轮 controller。

### 活动 turn 状态机

```text
idle
  -> starting              领取一条 queue/user_message，尚无 turnID，只允许继续排队
  -> provider_stream       已建立 turnID，steer 可 admission，已发出的请求不可修改
  -> tool_running          工具执行中，steer 可 admission，在工具结束后的边界注入
  -> boundary              批量领取截止序号内的 steer，并按 FIFO 追加 user runtime delta
  -> sealing               原子关闭 steer admission，并执行最后一次领取
  -> awaiting_commit       runtime 已 done/error/interrupted，等待 saveSession 提交确认
  -> idle/starting         提交成功；有订阅者且有 queue 时只晋升一条
```

`steer` admission 与 `sealing` 必须经过同一 turn gate。最终边界执行 `SealAndClaimFinalSteers`：先封口再领取封口前已持久化的 steer；领取到消息则回到 `provider_stream`，否则进入 `awaiting_commit`。这条原子性是防止“HTTP 已返回 202，但 steer 永久遗失”的核心保证。

### 输入信封与持久化模型

| 字段 | 规则 |
|---|---|
| `inputID` | 客户端生成的全局幂等键；相同 ID、相同摘要返回原 admission，相同 ID、不同摘要返回冲突 |
| `sessionID` | 目标会话；所有查询和修改都重新执行会话访问校验 |
| `delivery` | `steer` 或 `queue`；包内继续映射到 `InputSemantics` |
| `expectedTurnID` | steer/interrupt 必填，queue 禁止携带 |
| `admittedSeq` | 会话内单调序号，决定 steer 批次和 queue FIFO |
| `queueVersion` | 每次 admission、claim、update、cancel、mark 后递增，供多实例快照覆盖和并发编辑 |
| `payloadVersion` | 从 `1` 开始；未知版本拒绝恢复，不用 `map[string]any` 猜测 Go 类型 |
| steer payload | `userEntryID`、message、blockHTML、references、editorContext、创建时间 |
| queue payload | steer 字段加 model、reasoningEffort、language、pluginActions、owner grant ID/identity/expiry；晋升时重新校验授权并读取权威 session revision |
| runtime source | 独立 executor anchor（`storage/ai/agent/executor-anchors`）关联 queue claim 与运行时 turn，不扩展上游 `runtime.json`；重启时据此避免重复启动 |

持久化快照使用 `{schemaVersion, queueVersion, nextSeq, items}`。所有生产 admission 和状态迁移必须“候选状态落盘成功后再发布内存状态与事件”。恢复分支固定为：

1. **anchor 先落盘、runtime 未落盘**：释放 queue claim 回 `pending`，删除孤立 anchor，允许下一次只执行一次。
2. **runtime/commit 已落盘、anchor 删除失败**：以 canonical commit 为权威，完成 source input，再重试删除 anchor；不得再次执行 provider。
3. **旧 turn steer**：恢复时按 `expectedTurnID` 校验，标记 `failed` 并发布状态，不跨 turn replay。

`injecting` queue 只有存在匹配 anchor/runtime 证据时才继续恢复；提交确认前禁止晋升下一条 queue。

### 精确调度原语

- `ClaimSteerBatch(sessionID, activeTurnID, cutoffSeq)`：只领取匹配 turn 的 pending steer，按 admittedSeq 返回全部截止项。
- `ClaimNextQueued(sessionID)`：只领取一条最早 pending queue，不查看 steer 或其它即时语义。
- `ClaimByID(sessionID, inputID, semantics)`：供 interrupt、tool result 和显式转换使用，避免通用 `Take` 的语义泄漏。
- `UpdatePending` / `CancelPending`：只允许 pending 项，要求 expectedQueueVersion；与 claim 竞争时只有一个状态迁移成功。
- `SnapshotVersioned`：返回服务端权威版本和完整可见队列，前端不合并更低版本快照。

现有 `Take`/`TakeBatch` 保留兼容，但活动 turn 路径禁止调用，因为其“即时项取尽后继续取普通项”的规则会误消费 queue。

### HTTP API 契约

| 接口 | 成功语义 | 关键冲突 |
|---|---|---|
| `POST /api/ai/agent/steer` | 202，返回 inputID、acceptedTurnID、admittedSeq、queueVersion | no_active_turn、turn_mismatch、turn_not_steerable、input_id_conflict、queue_full |
| `POST /api/ai/agent/queue` | 202，持久化完整 queued-turn 快照；空闲且有订阅者时可异步立即晋升 | input_id_conflict、queue_full、authorization_expired |
| `GET /api/ai/agent/queue?sessionID=...` | 200，返回版本化完整快照 | forbidden、session_not_found |
| `POST /api/ai/agent/queue/update` | 200，仅修改 pending queue | queue_version_conflict、input_already_promoted |
| `POST /api/ai/agent/queue/cancel` | 200，仅取消 pending queue | queue_version_conflict、input_already_promoted |
| `POST /api/ai/agent/queue/promote` | 202，将 pending queue 原子转换为当前 turn steer | no_active_turn、turn_mismatch、input_already_promoted |
| `POST /api/ai/agent/interrupt` | 202，中断匹配 turn，默认 preserveQueue=true | no_active_turn、turn_mismatch |
| `GET /api/ai/agent/events?sessionID=...&after=SEQ` | 长生命周期 SSE；支持 Last-Event-ID、多订阅者和有限 replay | replay_too_old 时发送 resync_required |

### 会话事件协议

每个事件使用 SSE `id:` 承载单调 `eventSeq`，data 至少包含 `sessionID`、`eventSeq`、`timestamp`，turn 事件还包含 `turnID`。保留现有 `turn/content/thinking/reasoning/tool_call/tool_progress/tool_result/confirm/question/frontend_tool_call/usage/retry/snapshot/error/done`，新增：

- `session_state`：连接/重连时的活动 turn phase、steerable、subscriberCount 和 queue snapshot。
- `turn_phase`：starting/provider_stream/tool_running/boundary/sealing/awaiting_commit/idle。
- `input_promoted`：queue 已从 dock 晋升为对话 user entry。
- `steer_injected`：steer 已进入 runtime delta 和下一次 provider 请求；HTTP admission 不能替代该事件。
- `queue_state`：带 queueVersion 的完整服务端快照；始终覆盖前端较低版本 optimistic projection。
- `turn_committed`：canonical session 已提交，执行器现在才可晋升下一条 queue。
- `interrupted`：活动 turn 被显式或断线超时中断。
- `resync_required`：after 游标早于 replay 窗口，前端重新加载 session_state、session 和 queue。

Hub 为每个订阅者提供独立缓冲，慢消费者只断开自身，不阻塞执行器。零订阅者时不启动新 queue；活动 turn 在可配置宽限期内继续并写入 replay，宽限期后中断并保留 queue。

### 前端交互契约

1. `isStreaming` 不再禁用 Composer，也不隐藏发送按钮；发送和停止按钮同时保留稳定尺寸。
2. 活动 turn 时显示 `引导 / 排队` segmented control；没有 turnID、phase 不可引导或 adapter 不支持 steer 时禁用引导并保留排队。
3. queue dock 位于消息区与 Composer 之间，显示 pending/injecting/blocked/failed；提供编辑、转为引导、取消图标及 tooltip。
4. queued 输入晋升前不写入主历史；收到 `input_promoted` 后按稳定 EntryID 移入历史。steer 收到 `steer_injected` 后按事件顺序插入 user entry，并为后续 assistant segment 建立新渲染段。
5. 每个 optimistic 项以 inputID 对账；HTTP 响应可能先于或晚于事件，最终只接受更高 queueVersion 与 eventSeq。
6. Stop 只中断当前 turn，默认保留 queue。会话切换、销毁和重连必须释放旧订阅且丢弃迟到事件。
7. 共享 UI 依赖 `AgentConversationAdapter` 的 `supportsSteer`、`supportsQueue`、`supportsInterrupt`、`supportsQueueEdit`，不复用宿主 UI 的 `AgentPanelCapabilities` 表达执行能力。

### 分阶段任务与门禁

- [x] **Phase A：agentqueue 精确调度与持久化事务**
  - [x] 版本化快照、内容摘要幂等冲突、精确 claim、pending-only update/cancel、queueVersion。
  - [x] FileStorage 生产接线和旧快照迁移；每个变更先持久化再发布。
  - [x] 门禁：`packages/agentqueue` 下 `go test -race -count=1 ./...`。
- [x] **Phase B：native 执行器状态机与 turn 注入** [已完成 2026-08-04]
  - [x] 执行器注册、活动 turn、phase、commit barrier、subscriber count 分离建模；turn gate 线性化 steer admission、sealing 和 interrupt。
  - [x] AgentChat 在 provider/tool/final 边界领取 steer，并按既有 Entry 形状顺序持久化 user runtime delta 与后续 assistant segment。
  - [x] queued user entry 原子晋升；只有 canonical `saveSession(commitTurnID)` 成功后才发布 `turn_committed` 并解除下一轮屏障。
  - [x] 门禁：Kernel agent/api 专项并发、race、FIFO、崩溃窗口和恢复测试。
- [x] **Phase C：独立 API 与多订阅者事件 Hub** [已完成 2026-08-04]
  - [x] steer/queue/update/cancel/promote/interrupt/events 独立端点、结构化错误、owner capability 隔离和有限 replay/resync。
  - [x] `/chat` 保持兼容代理；旧客户端忙时仍为 409，不用 202 JSON 冒充 SSE。
  - [x] 门禁：API 合约、双订阅者、慢消费者、断线宽限、活动会话读取和外部目录泄漏测试。
- [x] **Phase D：Agent 面板运行中输入** [已完成 2026-08-04]
  - [x] native adapter 能力、事件控制器、运行中 Composer、投递模式控件、queue dock 和 optimistic 对账。
  - [x] 多 assistant segment、会话切换、销毁、迟到事件过滤和 replay resync；未注册目标不创建 controller。
  - [x] 门禁：`pnpm run test:agent-panel` 当前 50 个文件、149 个用例通过；lint、cycles、oversized 纳入 Phase E 最终记录。
- [x] **Phase E：恢复、浏览器与全量验收** [已完成 2026-08-04]
  - [x] 重启、保存失败、授权过期、同 ID 重试、编辑/取消晋升竞争、双面板和零订阅者场景已有自动化覆盖。
  - [x] 项目门禁：Kernel `go test -short -tags fts5 ./...`；前端 `pnpm test`、聚焦 lint/typecheck、`pnpm run lint:cycles`、`pnpm run scan:oversized`、专项 browser 测试；未运行通用 `pnpm build`。
  - [x] 本文件证据台账已按验收矩阵逐项记录直接测试、全量门禁、基线诊断和 MAGI 冻结结果。

### 验收矩阵

| 场景 | 必须证明的结果 | 权威证据 |
|---|---|---|
| provider 流中提交 steer | 本次请求不变，流结束后同 turn 继续一次 provider 请求并包含 steer | `TestAgentChatInjectsSteerAtFinalProviderBoundary` + `steer_injected` 事件断言 |
| 工具执行中提交 steer | 已执行工具不回滚，工具结束后 steer 注入 | `TestAgentChatInjectsSteerAfterRunningTool` |
| sealing 竞争 | 202 的 steer 必注入；封口后的请求明确拒绝 | `TestAgentTurnGateLinearizesAdmissionAndSealing` + Kernel race 门禁 |
| 连续 3 条 queue | 前一 turn committed 后每次只晋升一条，共产生 3 个独立 turn | `TestAgentExecutorAdvancesThreeQueuedTurnsOneCommitAtATime` + Chromium 三项 queue DOM 场景 |
| saveSession 失败 | 保持 awaiting_commit，queue 不晋升；重试成功后继续 | `TestAgentQueueRunnerWaitsForSuccessfulSessionCommit` + `TestAgentExecutorQueueWaitsForTurnCommit` |
| 进程重启 | pending queue 保留；已有 runtime source 的 claim 不重复启动；旧 turn steer 不跨轮 | `TestAgentQueueRestoresPayloadAndExecutesWithoutMetadata`、`TestAgentExecutorReconcilesRuntimeSourceBeforeAdvancingQueue`、三个 crash-window 测试 |
| 两个面板 | 相同 eventSeq/queueVersion，不重复渲染、执行或提交 | `AgentConversation.controller.test.ts` 双控制器用例 + `agent-conversation-controls.browser.ts` |
| 断线与 replay | 宽限内重连补齐；游标过旧 resync；零订阅者不启新 turn | `agent_event_hub_test.go`、`agent_disconnect_grace_test.go`、`TestAgentExecutorKeepsPendingWithoutSubscriber` |
| 外部目录会话 | 未携带 capability 的全局 WS/SSE 不包含 sessionID 或队列数据 | `TestAgentTaskDirectoryRemoteGuardianManagesExistingDirectories` |
| native Agent 面板 | 控件由已注册 adapter capability 决定；未注册目标不创建本轮 controller | `AgentConversation.adapter.test.ts`、`AgentChat.conversationController.test.ts`、`agentPanel.runningInput.test.ts` |
| 上游 Agent 数据兼容 | 旧 session/runtime/index fixture 可读；基础聊天 round-trip 字段和行为不漂移；新增状态只进入独立 queue 文件 | `TestAppendQueuedUserEntryPreservesUpstreamSessionData`、`TestQueuedPromotionPreservesLegacyRuntimeAndIndexSchemas`、`TestGetSessionDuringExecutorTurnReturnsCanonicalBeforeReplay`、`TestLegacyAgentChatKeepsBusyConflictContract` |

### 证据台账

| 日期 | 阶段 | 变更范围 | 验证结果 | 状态 |
|---|---|---|---|---|
| 2026-08-03 | 规格冻结 | 本节；Codex/OpenCode/S-Forge 当前源码复核 | 基线提交与工作树已核对；实现测试已由 2026-08-04 Phase A-E 证据闭环 | 完成 |
| 2026-08-03 | Phase A | `packages/agentqueue`；`kernel/api/agent_executor.go` 生产 FileStorage 挂载 | `go test -race -count=3 ./...` 与 `go vet ./...` 通过；Kernel `go test -race -count=1 ./api` 通过；覆盖摘要幂等冲突、精确 claim、版本竞争、持久化失败回滚、旧裸数组迁移和真实 DataDir 恢复 | 完成 |
| 2026-08-04 | Phase B-C | `kernel/agent`、`kernel/api` | `go test -race -count=1 ./agent ./api`、`go vet ./agent ./api`、`go test -short -tags fts5 ./...` 全部通过；验收矩阵中的 provider/tool 边界、sealing、FIFO、commit barrier、恢复、replay、授权和旧 `/chat` 合约均有直接测试 | 完成 |
| 2026-08-04 | Phase D | `app/src/layout/dock/agent`、Agent 面板测试 | `pnpm run test:agent-panel` 50 文件/149 用例通过；专项 Chromium 1 文件/1 用例通过；覆盖运行中 Composer、steer/queue 控件、queue 编辑/取消/提升、双面板同步和三项 queue DOM | 完成 |
| 2026-08-04 | 数据兼容 | 旧 `session.json`、`runtime.json`、`index.json` 与独立 queue/anchor 文件 | 新旧兼容 fixture 通过；queue 晋升保留未知 session 字段和既有 Entry 形状、不改写旧 runtime fixture、不向 index 写入 queue 协调字段；活动 executor 的 `getSession` 返回 canonical 历史并由 replay 补流 | 完成 |
| 2026-08-04 | 全量与结构门禁 | Kernel、前端、i18n、依赖图、文件规模 | `pnpm test`：Node 261、Vitest 226 文件/985 用例通过；21 语言/2250 键完整；`lint:cycles` 扫描 2605 文件且 0 循环；`scan:oversized` 退出码 0；`git diff --check` 通过 | 完成 |
| 2026-08-04 | 诊断基线 | 当前 57 个变更/新增 typed 文件 | 全量 typecheck 的 11,679 条仓库基线诊断中当前文件为 0；ESLint 当前新增诊断为 0，剩余 53 条均来自两个既有 `imports.ts` 的 `HEAD` 基线；imports gateway 剩余项和 25 个 hop 均位于未改动基线路径 | 完成 |
| 2026-08-04 | MAGI 冻结 | MAGI 内部、channel adapter、LLM、API、模板和测试 | 名称含 `magi` 的 583 个受控路径逐文件哈希与 `HEAD=5ee6ae1def81308e588707db95214712f6b9263f` 一致，暂存/未跟踪差异均为 0；native registry 只登记 `native-agent` adapter | 完成 |

---

## 🎯 核心原则

### 第一性排序

- **先独立包，再业务接入**: `packages/agentqueue` 独立实现、测试保证、职责边界清晰是第一步；native Agent 执行器和前端 adapter 只在包内契约稳定后接入，MAGI 保持既有实现。
- **独立端点，零参数污染**: 不同消息语义（steer / queue / interrupt / tool_result / channel_inbound / system）各走独立 API 端点，现有 `/api/agent/chat` 请求结构保持不动，避免与上游思源 merge 冲突。
- **语义与优先级分离**: 每条输入携带 Semantics（投递方式）与 Priority（调度顺序），由来源方声明，调度核心不感知具体业务。
- **包内/消费者职责边界**: 队列原语、策略、持久化接口、事件分发在包内；ResultChan、流式回传、抢占策略、SQLite 实现、前缀分流、回复路由由消费者处理。
- **SOTA 对标**: native Agent 队列语义对齐 OpenClaw（steer/followup/collect/interrupt、drop policy、dedupe、laneKey、claim 恢复、持久化、多订阅者事件）；MAGI `DispatcherRingQueue` 仅作为历史参考，不进入本轮依赖或替换范围。

### 验证检查清单（包内已完成项）

- [x] `packages/agentqueue` 独立 Go module，不依赖 kernel 任何包，`go test -race` 全绿（72 用例）。
- [x] 保护环优先队列 `RingQueue[T]` 提供独立的 Push/PopBlocking/PopNonBlocking/Peek/Len/RingLen/Close 契约，native consumer 可按需注册语义。
- [x] 语义注册表（`RegisterSemantics`）满足开闭原则：新增语义零修改既有代码。
- [x] 队列策略：drop policy（new/old/summarize）、dedupe（message-id/prompt/none）、collect（TakeBatch）、laneKey 串行、RecoverStale 超时恢复。
- [x] 持久化接口 `QueueStorage` + MemoryStorage/FileStorage 参考实现 + Checkpoint/RestoreFromStorage。
- [x] 多订阅者事件（Subscribe/Unsubscribe）+ 单回调兼容（SetOnChanged）。
- [x] 并发安全：Submit/Take 不写调用方对象、Take 返回深拷贝、锁顺序统一（复核修复项全部回归通过）。
- [x] kernel 接入后：`go test -race -count=1 ./kernel/agent/... ./kernel/api/...` 全绿（2026-08-02，含 agent_executor 9 用例）。
- [x] 前端接入后：Agent 面板专项 Vitest 已通过；全量前端和浏览器证据归入 Phase E。

### 禁止事项

- **禁止**在 3 个架构决策确认前开始 kernel 接入（避免返工）。
- **禁止**修改 `/api/agent/chat` 现有请求/响应结构（上游兼容红线）。
- **禁止**把 MAGI 的 `DispatcherTask`/`ResultChan`/`ReplyStreamObserver` 概念硬塞进 agentqueue 核心包，也不得通过 channel adapter 绕过既有 MAGI 边界。
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
3. **SSE 模型决策权重改变**：loop 模型下「每 turn 一个 HTTP 请求」（方案 A）是次优形态——OpenClaw 采用**长生命周期事件流订阅**（UI 订阅 session 事件，loop 推送所有 turn 的事件）。本轮以独立 `agentSessionEventHub` 落地有限 replay、多订阅者和 resync，不复用 MAGI websocket 或 channel adapter。

---

### 架构定位（演进 2）：常驻执行器 + 操作系统中断模型（已确认 2026-08-02）

**结论**：native Agent 会话按「常驻执行器」建模。执行器不再由每个 turn 的 HTTP 请求独立驱动，而是常驻循环**主动从抽象的消息源拉取输入**，处理结果经 HTTP/SSE 响应渠道输出；消息源可通过语义注册表扩展，MAGI 继续使用原有内部驱动模型。

**既有 MAGI 空闲机制（只读历史参考，不属于本轮实施）**：

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
前端（app/src/layout/dock/agent/）
    ↓ SSE / 独立 API 端点
kernel/api（新端点 + AgentEvent 扩展 + 会话执行器）
    ↓
kernel/agent（单 turn provider/tool 边界注入）
    ↓
packages/agentqueue（独立包，已完成）
    ↓
标准库
```

MAGI 的前端、API、channel adapter 和 LLM 接口不在该依赖图内，本轮 controller 注册表只登记 `native-agent` adapter。

### 包内当前公共 API（已完成）

- `RingQueue[T]`：独立保护环优先队列；consumer 通过泛型类型和语义注册表扩展，不依赖具体 Agent/MAGI 任务结构。
- `Input` / `InputSemantics` / `InputPriority` / `SourceContext` / `InboxStatus`：统一输入信封。
- `RegisterSemantics(s, SemanticsMeta)`：语义注册表（开闭原则）。
- `QueueSettings`：drop policy / dedupe / collect / stale 恢复策略。
- `SessionInbox`：per-session 队列（Submit/Take/TakeBatch/RecoverStale/Mark*/Summary/Checkpoint/Restore）。
- `QueueStorage` 接口 + `MemoryStorage` / `FileStorage`：持久化。
- `InboxManager`：全局调度（Submit/Take/NextDue/Subscribe/RegisterInbox/RecoverAllStale/透传）。

### 已接入形态（native Kernel）

- `kernel/agent`：`AgentChatWithControl` 只依赖 `AgentTurnControl` 端口，在 provider/tool/final 边界领取 steer；原 `AgentChat` facade 保持调用契约。
- `kernel/api`：`agentSessionExecutor` 持有 `InboxManager`、turn controller、commit barrier、独立 executor anchor 和 session event hub；空闲等待、每次只晋升一条 queue。
- `kernel/api`：steer/queue/update/cancel/promote/interrupt/events 使用独立端点；旧 `/api/ai/agent/chat` 与既有 SSE 事件保持兼容。
- `app/src/layout/dock/agent`：共享 UI 通过 `AgentConversationAdapter` 注册表取得执行能力；当前仅 `native-agent` 注册新 controller，未注册目标继续走原链路。

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

- [x] **Phase 1: native Agent 会话执行器与控制 API（P0）** [已完成 2026-08-04]
  - **背景**: `AgentChat` 是单次运行 goroutine（`agent.go:470`），无法感知新入队输入；原计划"主循环检查队列"需修正为执行器 + 注入通道。
  - **已完成（2026-08-02，外部行为不变）**:
    - `kernel/api/agent_executor.go`：会话执行器（每 session 常驻 goroutine，WaitNext 阻塞→Take→AgentChat→事件转发订阅），含资源治理（空闲回收/Prune/subscribe 单流限制/GetOrCreateInbox/runTurn 语义表驱动）。
    - `kernel/api/agent.go` agentChat handler：请求语义从「启动 agent」变为「订阅响应 + 投递消息到消息源（Submit）」，SSE 循环读订阅 channel——HTTP 端点、SSE 事件类型、runningSessions 语义（409 互斥、streamStart/streamEnd）与改造前完全一致。
  - **完成内容（2026-08-04）**:
    1. `kernel/agent` 通过可选 `AgentTurnControl` 在 provider、tool 和 final boundary 领取 steer；未注入控制器时 `AgentChat` facade 行为保持原样。
    2. `kernel/api` 增加 steer、queue、update、cancel、promote、interrupt 和 events 独立端点；执行器按 turn gate、commit barrier 和独立 anchor 驱动。
    3. `agentSessionEventHub` 提供事件序号、多订阅者、有限 replay/resync、慢订阅者隔离和断线宽限；旧 `/chat` 继续保持 409/SSE 合约。
  - **验收标准**: Kernel agent/api race、并发 barrier、FIFO、恢复、API 合约和外部目录隔离测试通过；最终全量命令记录在证据台账。

## 🟡 中期计划

- [x] **Phase 2: native Agent 面板接入（P1）** [已完成 2026-08-04]
  - **背景**: 前端 `isStreaming` 时锁死 composer（`streamingState.ts`），`send.helpers.ts:29` 拦截运行中发送；需解锁并支持排队/引导。
  - **完成内容**: 运行中 Composer、steer/queue segmented control、queue dock、编辑/取消/提升、optimistic 对账、多 assistant segment、事件订阅/重连/resync 和精确 interrupt 均通过 `AgentConversationAdapter` 能力实现。
  - **验收标准**: Agent 面板专项 Vitest 与 Chromium DOM 场景通过；全量前端命令记录在证据台账。

- [x] **MAGI 边界冻结（非本轮交付）** [已确认 2026-08-04]
  - **结论**: MAGI 内部、channel adapter、LLM 接口、API、模板和测试保持基线；native controller 注册表不登记 MAGI adapter，也不以 agentqueue 绕过既有 channel adapter。
  - **验收标准**: 全部名称含 `magi` 的 583 个受控路径逐文件哈希与基线 `HEAD` 一致；冻结目录的工作区、暂存区和非忽略未跟踪差异均为 0。

## 🔴 远期计划

- [x] **Phase 4: 持久化与崩溃恢复端到端（P2）** [已完成 2026-08-04]
  - **完成内容**: FileStorage 自动持久化、版本化 payload、独立 executor anchor、三类崩溃窗口恢复、旧 turn steer 失败结算和 canonical commit barrier 已落地。
  - **验收标准**: FileStorage 重建、无 Metadata 执行、anchor/runtime/commit 崩溃窗口和队列连续晋升测试通过。

- [x] **Phase 5: 本轮所需 OpenClaw 对标能力（P2）** [已完成 2026-08-04]
  - **完成内容**: 多订阅者 Event Hub、有限 replay/resync、session queueVersion、幂等 inputID、laneKey/collect 原语和持久化恢复均已具备。
  - **边界**: prompt 级跨会话去重、debounce 和 prompt 合并不属于“运行中 steer/queue”目标，不进入本轮完成条件。

---

## 🏁 已归档/已完成

> 本节中的 MAGI 对照与替换设想只记录 2026-08-02 的历史研究，不构成当前实施范围；2026-08-04 起以本文 native-only 不变量和「MAGI 边界冻结」为权威。

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
**维护范围**: `packages/agentqueue` 独立包、`kernel/agent` 单 turn 注入、`kernel/api` native 会话执行器与独立控制端点、前端 native Agent 面板；MAGI 全链路冻结
**当前阶段**: 🟢 Phase A-E 全部完成，最终验收矩阵与证据台账已闭环
