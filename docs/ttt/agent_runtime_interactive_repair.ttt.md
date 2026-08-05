# Native Agent 运行中消息与交互通道修复跟踪（TikTocTak）

> **目标**：修复 native Agent 面板在 turn 执行期间发送 steer/queue、空闲发送普通消息、队列取消以及 confirm/question/frontend-tool 交互的跨层生命周期错误，并以真实 Kernel/API/事件流测试验证。MAGI 内部、channel adapter、Magi LLM 接口和 MAGI 前端路径不属于本次修改范围。
>
> **当前状态**：🟢 专项完成。运行态报告优先于此前“完成”声明；本文件记录实现边界、真实测试证据和仍存在的非本次全仓门禁债务。

## 固定边界

1. native Agent 的 session-event executor 是活动 turn 的唯一运行事实来源；旧 `/api/ai/agent/chat` 继续保留兼容行为。
2. confirm、question、frontend-tool、save、queue admission 和事件订阅必须读取同一套 executor 活动态，不能分别依赖旧 `runningSessions` 快照。
3. 普通空闲消息启动一个新的 user turn；只有活动 turn 中显式选择 queue 时才使用 queue admission。
4. queueVersion 只表示服务端已线性化的队列变更；HTTP admission、claim、状态事件和前端快照不得互相制造陈旧版本。
5. 运行中 admission 不得通过普通 session save 触发恢复或 `FinalizeOrphanedTurn`，也不得污染上游 `session.json`/`runtime.json` 的 turn 语义。
6. confirm 卡必须在 approved/rejected/expired/error 等终态后关闭操作入口；服务端业务错误必须保留 reason/status，不得统一伪装成网络错误。
7. 所有新增逻辑通过现有 adapter、controller、executor 和 repository 边界扩展；不增加 MAGI 特殊分支。

## 已确认根因

- session-event 发送在 admission 前无条件保存，会被旧 `runningSessions`/恢复检查误判为 `session has an uncommitted turn`。
- 新 executor 没有登记旧 `runningSessions`，而 confirm/question/frontend-tool 仍由旧表做活动会话门禁，造成有效交互请求统一 409。
- 空闲状态的 delivery 解析为 queue，native adapter 没有直接 user-turn admission，因此普通消息落入 queue dock。
- executor 主循环在 `runTurn` 内同步阻塞，`queueChangedCh` 不能及时转换为 `queue_state`，服务端 claim 后前端仍持旧 pending 快照。
- `InboxManager.Submit` 在通知 executor 后才读取响应版本，admission 版本可能已包含后续 claim；前端仅清除 optimistic 标记，无法知道真实状态。
- confirm 超时/失败没有投影到持久化卡片终态，前端 confirm 请求丢弃结构化错误并显示通用网络文案。

## 修复阶段

### Phase A：统一活动会话事实源（P0）

- [x] 为 executor 暴露受锁保护的活动 turn、phase、owner identity 和 commit 状态读取能力。
- [x] 让 confirm/question/frontend-tool/save 使用统一活动状态；保留旧 `/chat` 的 app/owner 兼容约束。
- [x] 活动 executor 存在时，普通保存不得调用 `FinalizeOrphanedTurn`；显式 `commitTurnID` 仍走 canonical commit barrier。

### Phase B：输入 admission 与队列事件（P0）

- [x] 首次会话初始化与运行中 admission 分离；活动 steer/queue 不再触发普通 session save。
- [x] 空闲普通消息使用 user-message turn 语义；queue 仅由活动 turn 的 queue delivery 产生。
- [x] 保证每次队列变更都能在活动 turn 中及时发布权威 `queue_state`，并让 admission 返回线性化版本。
- [x] 前端在控制命令失败时先按结构化版本刷新并正确结算项目，不把陈旧项目继续显示为可删除 pending。

### Phase C：交互卡片与兼容性（P1）

- [x] confirm/question/frontend-tool 成功、过期、拒绝和服务端错误均有明确状态投影。
- [x] 保持上游 session/runtime/index 字段形状与旧 `/chat` 行为；队列状态仍只写独立 queue 快照。

### Phase D：真实验证（P0）

- [x] API 级测试：session-event executor 活动时 confirm/question/frontend-tool 成功回传并唤醒真实 waiter。
- [x] API/执行器级测试：活动 turn 中 steer/queue admission 不经过 save 失败；事件流在 turn 未结束时收到 queue_state。
- [x] 版本级测试：admission、claim、mark、cancel 的事件顺序下删除使用最新版本且成功；陈旧版本只在真实外部竞争时返回冲突。
- [x] 前端集成测试：真实响应包络 reason/status 被展示，confirm 终态不可重复提交。
- [x] 上游兼容 fixture、专项 Go/Vitest、race、lint、cycles、typecheck 和 browser 门禁全部记录在证据台账。

## 实现落点

1. `agentSessionExecutor` 与 `agentTurnController` 成为唯一活动 turn 事实源；旧 `/chat` 只保留受 executor 管理的 SSE 传输租约，不再维护 `runningSessions`。
2. native adapter 通过既有 conversation adapter 边界把 idle `turn`、active `steer` 和 active `queue` 分派到独立控制端点；共享面板与 controller 不含 MAGI 特殊分支。
3. `InboxManager.Submit` 直接返回自身线性化点的 `queueVersion`，executor 订阅现有 manager 变更通知并即时发布权威 `queue_state`，消除 admission 响应误报后续 claim 版本的问题。
4. confirm/question/frontend-tool 统一产生 `*_resolved` 终态事件；HTTP 业务失败保留 `reason/status`，只有传输异常恢复重试入口，成功 HTTP 响应继续等待事件流给出的权威终态。
5. session-event 输入晋升后同步 canonical revision；普通运行中保存不触发 orphan recovery，显式 `commitTurnID` 仍由原有提交屏障结算。
6. queue 数据继续落在 `storage/ai/agent/queues` 独立快照；`session.json`、`runtime.json` 和 session index 不新增 queue 协调字段，未知上游字段继续透传保存。

## 验收矩阵

| 场景 | 必须证明的结果 | 证据 |
|---|---|---|
| provider/tool 执行中 steer | admission 成功，目标 turn 收到 steer，不触发 uncommitted save | `TestActiveSessionEventTurnAcceptsSteerQueueSaveAndCurrentVersionCancel` |
| provider/tool 执行中 queue | admission 成功，queue_state 在当前 turn 期间可见 | 同一真实 provider/API/事件流测试在 `done` 前观察 pending queue 快照 |
| 空闲普通发送 | 直接启动 user turn，不进入 queue dock | `AgentChat.conversationSend.test.ts`、`AgentConversation.adapter.test.ts`、`AgentConversation.controller.test.ts` |
| queue 取消 | 最新权威版本下 pending 项可取消；claim 后只返回真实状态 | `TestManagerSubmitReturnsItsOwnMutationVersion`、`TestAgentQueueAPIVersionedUpdateCancelAndPromote`、活动 turn 综合测试 |
| confirm/question/frontend-tool | 实际 waiter 收到结果并继续 turn | `agent_runtime_interaction_test.go` 的真实 confirm/question/frontend waiter 场景 |
| confirm 超时/错误 | 卡片终态持久化，按钮关闭，业务 reason 可见 | `TestSessionEventExecutorConfirmTimeoutEmitsExpiredAndRejectsOnlyExpiredWaiter`、`AgentChat.interactionCards.test.ts` |
| 上游数据兼容 | 旧 session/runtime/index fixture 可读且字段无漂移 | `TestSaveSessionRevisionConflictAndUnknownFields`、`TestQueuedPromotionPreservesLegacyRuntimeAndIndexSchemas`、活动 turn 综合测试 |
| MAGI 冻结 | 本次 diff 不包含 MAGI 路径 | `git diff --name-only` 对 MAGI 路径匹配为 0 |

## 证据台账

| 日期 | 阶段 | 结果 | 状态 |
|---|---|---|---|
| 2026-08-05 | 故障复核 | 真实会话确认卡 409、queueVersion=6 快照和 pending/timeout 不一致已留证；现有局部测试仍通过 | 完成 |
| 2026-08-05 | Kernel 专项 | `go test -tags fts5 ./agent ./api -count=1` 通过；`packages/agentqueue` 全部测试通过 | 完成 |
| 2026-08-05 | 并发与静态分析 | Kernel `agent/api` race、`agentqueue` race、两处 `go vet` 与 Go 格式检查全部通过 | 完成 |
| 2026-08-05 | Kernel 全仓门禁 | `go test -short -tags fts5 ./...` 全部通过 | 完成 |
| 2026-08-05 | 前端专项 | 定向 8 文件 31 项、Agent panel 52 文件 161 项全部通过 | 完成 |
| 2026-08-05 | 前端全仓门禁 | `pnpm test` 通过：Node 261 项，Vitest 228 文件 999 项，共 1260 项 | 完成 |
| 2026-08-05 | 浏览器专项 | 不触发构建，直接运行两个 Agent Chromium 文件，2 文件 2 项通过 | 完成 |
| 2026-08-05 | 结构门禁 | 本次 29 个源文件 lint 为 0；2611 个 `app/src` 文件循环依赖为 0；5 个受影响 imports gateway 无未使用导出；`git diff --check` 通过 | 完成 |
| 2026-08-05 | 类型与兼容 | 全仓 typecheck 当前 11681 条非本次路径诊断，本次路径匹配为 0；未知字段、旧 runtime/index fixture 与 queue 隔离测试通过 | 完成 |
| 2026-08-05 | Phase A-D | 验收矩阵全部取得真实 API、事件流、DOM、兼容 fixture 和仓库门禁证据 | 完成 |

## 全仓基线记录

- `pnpm run typecheck` 当前仍报告 11681 条仓库诊断；本次 29 个源文件及其所属路径过滤结果为 0，因此不把全仓存量类型债务计入本专项回归。
- `pnpm run lint:imports-gateway-hops` 当前只报告未修改的 `composer/imports.ts`、`composer/protyle/imports.ts` 和 `composer/tiptap/imports.ts` 共 25 条；本次 5 个受影响网关逐文件检查均通过。
- `pnpm run scan:oversized` 扫描 2651 个文件并报告 217 个既有超限文件，本次文件不在清单中。
- 全仓 Chromium 直接运行时为 14 文件通过、3 个 Protyle 文件失败，原因分别为当前 Vite 配置未加载 Vue 插件、一个旧参数断言漂移和 `protyle-app` 导入失败；两个 Agent 浏览器文件单独运行全部通过。

## 完成条件

验收矩阵中的跨层测试、上游兼容测试和专项门禁均已取得可复核输出；全仓非本次债务已单列，工作树中的 Agent 改动均由本文件说明，MAGI 路径保持冻结。
