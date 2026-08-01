# AgentChat 拆分校核报告

> **校核对象**：
> - 基线 A：`app/src/layout/dock/agent/AgentChat.ts.backup`（4049 行）
> - 基线 B：`app/src/layout/dock/agent/AgentChat.ts.remote`（3830 行，拆分功能的另一来源）
> - 拆分结果：`AgentChat.ts`（370 行门面）+ `app/src/layout/dock/agent/chat/`（93 文件）
>
> **校核时间**：2026-07-31
>
> **校核方法**：完整逐行阅读两个基线文件与全部拆分文件，建立三方方法映射。差异归因采用以下规则：
> 1. **新增功能（backup 与 remote 均不存在的行为）不计入"行为差异"**，仅登记为新增项。
> 2. **backup ↔ remote 之间既有的演进差异（拆分前已存在）单独列表**，标注为非拆分引入，不作为拆分校核的行为差异。
> 3. **只有 backup 与 remote 行为一致、而拆分后实现不同**的，才计为"拆分引入的行为差异"。

---

## 1. 结论摘要

- **行为一致结论**：**拆分引入的行为改写共 15 处**（严重 1 / 中等 4 / 轻微 10）。
- 其中**严重 1 处**为编辑器类型切换（Tiptap → Protyle），对 Dock/Tab 主宿主输入体验有实质影响。
- backup ↔ remote 之间存在约 20 项**既有演进差异**（轮次恢复、用户编辑、工具徽标、滚动恢复、异步校验等），remote 已包含，**非本次拆分引入**。
- backup/remote 均无的**新增功能**（会话文件上传、提示词来源、私有方法安装器等）**不计入行为差异**。
- **公开门面导出**（构造函数、`ready`/`getConversation`/`refreshSessions`/`setDraft`/`openConversation`/`setFloatingCopyOptions`/`getSessionId`/`restoreSessionById`/`destroy`/`insertBlockMentions`/`refreshModelOptions`/`createFloatingCopy`）对 `tabFloat.factory.ts`、`AgentPanelController.ts`、`dockModel.factory.ts`、`layout-deserialization.handlers.ts` 等外部调用方保持兼容。

---

## 2. 方法映射表（backup → 拆分后位置）

| 领域 | backup 方法（行号） | 拆分后位置 |
|---|---|---|
| 公开门面 | `constructor` L198 | `AgentChat.ts` L222 + `chat/AgentChat.privateMethods.ts` |
| 公开门面 | `ready` L481 / `getConversation` L485 / `refreshSessions` L489 / `setDraft` L497 / `openConversation` L508 / `setFloatingCopyOptions` L533 / `getSessionId` L541 / `restoreSessionById` L546 | `chat/ui/AgentChat.facade.ts` + `chat/core/AgentChat.conversation.ts` + `chat/session/AgentChat.sessionLoad.ts` |
| 公开门面 | `createFloatingCopy` L561 / `destroy` L614 | `AgentChat.ts` L342/L316 + `chat/ui/AgentChat.dispose.ts` + `chat/core/AgentChat.runtime.factory.ts` |
| 配置/身份 | `checkConfigChangedHandler` L245 / `handleMagiIdentitySessionChanged` L281 | `AgentChat.ts` L202/L210 + `chat/ui/AgentChat.shell.methods.ts` |
| 面板能力 | `applyCapabilityVisibility` L249 / `applyConversationCapabilityVisibility` L258 | `chat/ui/AgentChat.shell.methods.ts` |
| 目标策略 | `resolveTargetPolicy` L288 | `chat/core/AgentChat.targetPolicy.ts` |
| 初始化 | `initUI` L341 | `chat/ui/AgentChat.init.methods.ts` + `chat/ui/AgentChat.init.helpers.ts` |
| 模型 | `initModelSelect` L645 / `openAiSetting` L662 | `chat/ui/AgentChat.composer.ts` |
| 拖拽 | `bindComposerDragDrop` L668 | `chat/ui/AgentChat.composer.ts`（条件化，见 S2） |
| 模型列表 | `refreshModelOptions` L728 / `updateModelLabel` L798 / `getSelectedModel` L816 / `applySessionModelIfValid` L859 | `chat/ui/model/AgentChat.model.methods.ts` |
| 推理强度 | `updateReasoningEffortLabel` L821 / `showReasoningEffortMenu` L835 | `chat/ui/model/AgentChat.model.methods.ts::initReasoningEffortSelect`（同 remote，见 E-11） |
| 欢迎页 | `showWelcome` L866 | `chat/ui/AgentChat.welcome.methods.ts` |
| 导航 | `initNavRail` L930 / `rebuildNavMarkers` L954 / `updateActiveMarker` L981 / `jumpToMessage` L1005 | `chat/ui/navigation/AgentChat.navigation.ts` |
| 事件 | `bindEvents` L1020 | `chat/ui/AgentChat.events.methods.ts` + `chat/ui/AgentChat.events.helpers.ts` |
| 会话初始化 | `initSessions` L1155 | `chat/session/AgentChat.session.ts` |
| 保存 | `saveSession` L1178 | `chat/session/AgentChat.save.ts` + `chat/session/AgentChat.bootstrap.helpers.ts`（同 remote，见 E-1） |
| MAGI | `resetMagiConversationView` L1200 / `renderMagiConversation` L1222 / `renderMagiConversationState` L1243 / `loadMagiIdentityConversation` L1250 | `chat/session/AgentChat.magi.ts` |
| WS 镜像 | `onWsMessage` L1311 / `showMirrorPlaceholder` L1352 / `removeMirrorPlaceholder` L1369 | `chat/session/AgentChat.websocket.ts` + `chat/session/AgentChat.mirror.ts` |
| 磁盘重载 | `reloadFromDisk` L1377 / `updateMetaFromSession` L1414 / `entriesEqual` L1430 / `isScrolledToBottom` L1440 | `chat/session/AgentChat.reload.ts` |
| 会话切换 | `handleCurrentSessionDeleted` L1446 / `switchSession` L1466 | `chat/session/AgentChat.switch.ts` |
| 引用索引 | `resetWebReferenceIndex` L1518 / `registerWebSearchReferences` L1523 / `renderAssistantMarkdown` L1539 / `postRenderAssistant` L1545 | `chat/message/AgentChat.persisted.methods.ts` |
| 持久化渲染 | `appendPersistedAssistant` L1562 / `appendPersistedToolCalls` L1577 / `appendPersistedConfirm` L1627 / `slimToolCallsForPersistence` L1664 / `appendPersistedQuestion` L1682 | `chat/message/AgentChat.persisted.methods.ts` + `chat/message/AgentChat.toolPersistence.ts` |
| 会话渲染 | `renderLoadedSession` L1725 / `buildEntriesFromSession` L1820 | `chat/message/AgentChat.sessionRender.methods.ts` + `chat/message/AgentChat.sessionRender.helpers.ts` |
| 会话管理 | `createSession` L1852 / `deleteSession` L1904 | `chat/session/AgentChat.manage.methods.ts` + `chat/session/AgentChat.manage.helpers.ts` |
| 发送 | `sendMessage` L1927 / `sendMagiMessage` L2009 | `chat/message/AgentChat.send.methods.ts` + `chat/message/AgentChat.send.helpers.ts` + `chat/message/AgentChat.magiSend.ts` |
| 冲突 | `handleConflictReject` L2056 | `chat/message/AgentChat.conflict.ts` |
| 编辑器上下文 | `captureEditorContext` L2080 / `readEditorContext` L2158 | `chat/message/AgentChat.context.methods.ts` + `chat/message/AgentChat.context.helpers.ts` |
| SSE 分派 | `handleSSEEvent` L2238 | `chat/stream/AgentChat.sse.methods.ts` + `chat/stream/AgentChat.sse.helpers.ts` |
| 错误处理 | `handleError` L2326 / `handleConfigError` L2339 / `rollbackUserEntry` L2362 / `appendConfigurableError` L2374 | `chat/stream/AgentChat.errorHandling.ts` |
| 用户消息 | `appendUserMessage` L2392 | `chat/message/user/AgentChat.userMessage.ts` + `userRender.ts` + `userActions.ts` |
| 令牌流 | `createAIMessagePlaceholder` L2418 / `appendToken` L2435 / `flushTokenUpdate` L2483 | `chat/message/user/AgentChat.tokenStream.ts` |
| 工具状态 | `findCurrentToolCall` L2505 / `webSearchQuery` L2520 / `findToolCallCard` L2525 | `chat/interaction/tools/AgentChat.toolState.ts` |
| 工具卡片 | `appendWebSearchCall` L2538 / `updateWebSearchProgress` L2557 / `completeWebSearch` L2566 / `appendToolCall` L2585 / `updateToolCallProgress` L2597 / `completeToolCall` L2607 | `chat/interaction/tools/AgentChat.toolCards.ts` |
| 思考流 | `appendThinking` L2628 / `appendReasoning` L2792 | `chat/stream/AgentChat.thinking.methods.ts` + `thinking.helpers.ts` |
| 助手动作 | `addCopyButton` L2824 | `chat/message/actions/AgentChat.assistantActions.ts` |
| 重发 | `regenerateResponse` L2871 | `chat/stream/AgentChat.regenerate.methods.ts` + `regenerate.helpers.ts` |
| 流式收尾 | `finalizeStreamingBody` L2958 / `finishResponse` L2976 | `chat/message/AgentChat.assistantBody.ts` + `chat/stream/AgentChat.finish.methods.ts` + `response.helpers.ts` |
| 思考步骤 | `attachStepContent` L3062 / `flushThinkingStep` L3069 | `chat/stream/AgentChat.thinkingStep.ts` |
| 标题 | `tryGenerateTitle` L3098 | `chat/stream/AgentChat.finish.methods.ts` |
| 重试判定 | `canRetryLastUserTurn` L3128 | `chat/interaction/AgentChat.errorCards.ts` |
| 错误卡片 | `appendErrorActions` L3136 / `appendError` L3152 / `appendRetry` L3172 | `chat/interaction/AgentChat.errorCards.ts` + `AgentChat.errors.methods.ts` |
| 快照 | `appendSnapshotInfo` L3186 / `appendRollbackInfo` L3230 | `chat/interaction/snapshot/AgentChat.snapshot.ts` |
| 停止 | `stopGeneration` L3246 | `chat/interaction/AgentChat.errors.methods.ts` |
| 插入 | `insertBeforeAI` L3304 | `chat/ui/feedback/AgentChat.messagePlacement.ts` |
| 确认 | `appendConfirm` L3312 / `postConfirm` L3379 / `handleFrontendToolCall` L3405 / `postFrontendResult` L3433 | `chat/interaction/confirm/AgentChat.confirm.methods.ts` + `confirm.helpers.ts` |
| 问答 | `appendQuestion` L3448 / `postQuestionAnswer` L3525 | `chat/interaction/AgentChat.question.methods.ts` + `question.helpers.ts` + `question.submit.ts` |
| 思考卡片 | `renderSingleThinkingCard` L3548 / `renderMergedThinkingCard` L3559 / `formatThinkingHeader` L3626 | `chat/interaction/AgentChat.metrics.methods.ts` |
| 令牌展示 | `updateTokenDisplay` L3635 / `appendUsage` L3659 / `showTokenBreakdownPopup` L3668 / `closeTokenBreakdownPopup` L3747 / `formatTokenBreakdown` L3765 / `formatTokenCount` L3802 | `chat/interaction/AgentChat.metrics.methods.ts` + `metrics.helpers.ts` |
| 思考状态 | `clearThinking` L3825 / `startThinkingTimer` L3835 / `stopThinkingTimer` L3856 / `finishActiveThinking` L3863 | `chat/ui/feedback/AgentChat.thinkingState.ts` |
| 流式锁 | `setStreaming` L3899 / `updateSendButtonState` L3913 / `hasComposerInput` L3931 | `chat/ui/feedback/AgentChat.streamingState.ts` |
| 滚动 | `scrollToThinkingCardBelow` L3940 / `scrollToBottom` L3965 / `observeStickTarget` L4010 | `chat/ui/feedback/AgentChat.scrolling.ts` |
| 展示 | `toolCategory` L4026 / `formatMessageTime` L4040 | `chat/ui/feedback/AgentChat.presentation.ts` |

---

## 3. 拆分引入的行为差异（backup 与 remote 一致，拆分后改变）

### 3.1 严重（1 处）

- **S1 编辑器类型切换（Tiptap → Protyle）**：backup L451 与 remote L322 均调用 `mountComposer(host, onSend, onChange)`（3 参，Tiptap）；拆分后 `chat/ui/AgentChat.init.helpers.ts::mountAgentChatComposer` L174-181 传入第 4 参 `runtime.app`，有 App 的主宿主走 `mountProtyleComposer`（见 [`AgentComposer.ts`](app/src/layout/dock/agent/AgentComposer.ts:14)）。**影响**：Dock/Tab 输入编辑器从 Tiptap 切换为 Protyle，输入交互、工具栏、块粘贴语义变化。两个基线一致，拆分独有，属拆分引入。

### 3.2 中等（4 处）

- **S2 自定义块拖拽条件化**：backup L458 无条件 `bindComposerDragDrop()`；remote L328 删除自定义拖拽（注释"protyle 统一处理"）；拆分后 `if (!runtime.app) { bindComposerDragDrop(runtime); }`（init.helpers L178-180）。**影响**：有 App 宿主等价 remote（不绑）、无 App 宿主等价 backup（绑定）。相对 backup 变化，但可视为两基线语义的按宿主融合。
- **S3 navRail 悬浮展开延迟移除**：backup L934-938 与 remote L562-566 均 200ms 延迟展开（`navExpandTimer`）；拆分后 `chat/ui/navigation/AgentChat.navigation.ts` L14-19 立即展开，字段删除。**影响**：悬浮展开节奏变化。
- **S4 token popup hover 延迟移除**：backup L1026-1037 与 remote L649-660 均 mouseenter 200ms / mouseleave 300ms；拆分后 `chat/ui/AgentChat.events.helpers.ts` L19-40 立即显示/立即关闭（relatedTarget 判定）。**影响**：hover 交互节奏变化。
- **S5 postFrontendResult 重试与 409 语义**：remote L3166-3189 重试退避 `200ms×(attempt+1)`、409 静默成功返回；拆分后 `confirm.methods.ts::postFrontendResult` L159-180 改用 `waitForAgentChatFrame()` 退避、409 视为失败并最终抛错。**影响**：前端工具结果回传的重试时序与 409 处理不同（backup L3433-3446 单次无重试；remote 为基线对照）。

### 3.3 轻微（10 处）

- **S6 jumpToMessage 高亮清理机制**：backup L1015-1017 与 remote L637-640 均 `setTimeout(1500)`；拆分后 `navigation.ts` L89-96 改 `animationend`，无 `.agent-chat__body` 时立即移除高亮。
- **S7 scrollToBottom smooth 1s 超时兜底移除**：backup L3991 与 remote L3772 均 `setTimeout(finish, 1000)`；拆分后 `scrolling.ts` L96-103 仅 scrollend/wheel 结束。
- **S8 思考计时器 setInterval → requestAnimationFrame**：backup L3852 与 remote L3609 均 `setInterval(100ms)`；拆分后 `thinkingState.ts` L5-16 rAF 驱动。
- **S9 scrollToThinkingCardBelow 定位时机**：backup L3958 与 remote L3739 均 `setTimeout(align, delay)`；拆分后 `scrolling.ts` L59-73 优先监听 `transitionend`、无过渡时 rAF。
- **S10 recoverInterruptedTurn 退避机制**：remote L934-937 用 `[100,200,400,800,1600,3200]` setTimeout 序列（backup 无此方法）；拆分后 `recoverTurn.ts` L50 用 `waitForAgentChatFrame()`（rAF）×6。
- **S11 私有方法安装机制**：backup/remote 均为类原型方法；拆分后 `chat/AgentChat.privateMethods.ts` L96-106 用 `Object.defineProperty` 安装为实例自有属性（enumerable: false）。外部不可见，仅影响原型遍历与子类覆写方式。
- **S12 方法原型链变化**：同上，方法不再位于 `AgentChat.prototype`。无外部调用方依赖（已核对 import 方）。
- **S13 字段初始化方式**：backup/remote 用 `private x: T;`（构造中赋值，早期访问为 undefined）；拆分后门面用非空断言 `private x!: T`。类型层差异，运行时空值语义相同。
- **S14 思考卡片 detail 更新方式**：backup L2754 与 remote L2386 均 `existingBody.innerHTML += detailLines`（重建子树）；拆分后 `thinking.helpers.ts::renderActiveThinkingCard` L185 用 `insertAdjacentHTML("beforeend", …)`（保留已有节点）。**影响**：前者会丢失既有子节点绑定的事件，后者保留——拆分实际是修复，但相对基线为行为变化。
- **S15 MAGI identity 新增 interfaceKind**：backup L2010-2013 无 `interfaceKind`；拆分后 `magiSend.ts` L30-35 设 `interfaceKind: "magi-main-ui"`。remote 无 MAGI 路径无法对照，相对 backup 新增字段。

---

## 4. backup ↔ remote 既有演进差异（非拆分引入）

以下差异在 remote 基线中已存在，拆分后保持了 remote（或 backup）语义，**不属于拆分校核的行为差异**，仅登记备查：

| # | 差异点 | backup | remote | 拆分后 |
|---|---|---|---|---|
| E-1 | 会话轮次恢复/提交 | 无 | `currentTurnID`/`recoveryCommitTurnIDs`/`pendingRecoverySessionIDs`/`recoveryInFlightSessionIDs` | 同 remote |
| E-2 | saveSession 重构 | 简单组装 | 返回 `AgentSession\|null`、`commitTurnID`、pendingTitle 递归保存、`allowEmpty` | 同 remote |
| E-3 | 用户消息富文本 | `escapeHtml` 纯文本 | `Md2BlockDOM` + `disabledWYSIWYG` + 编辑 | 同 remote |
| E-4 | 用户消息编辑 | 无 | `editingUserEntryID`/`pendingEditDraft`/`restorePendingEditDraft` | 同 remote |
| E-5 | 工具运行徽标 | 无 | `toolCallStartedAt`/`setToolCallRunning`/`finishToolCall` | 同 remote |
| E-6 | 滚动位置恢复 | 无 | `scrollBottomBySession`/`layoutVisible`/`restoreScrollToBottom` | 同 remote |
| E-7 | 推理强度 UI | Menu 弹层（`capabilities.menu`） | 原生 `<select>` | 同 remote |
| E-8 | 模型签名判定 | `getUsableModelSignature` 要求 apiKey | `countUsableModels` 仅判 enabled | `getUsableModelSignature` 去 apiKey（同 remote 语义） |
| E-9 | SSE turn/interrupted 事件 | 无 | 有 | 同 remote |
| E-10 | 错误路径 | 内存保留 + saveSession | 磁盘重载 + `recoverInterruptedTurn` + `SessionStore.remove` | 同 remote |
| E-11 | finishResponse 权威重绘 | 仅 saveSession | `canonicalSession` 重绘 | 同 remote |
| E-12 | stopGeneration | 仅 saveSession | 重载 + recover | 同 remote |
| E-13 | regenerate 状态校验 | 无 | `isAgentRegenerateStateCurrent`/`confirmHistoryTruncation`/revision 校验 | 同 remote（确认弹窗改为消息提示，见 E-20） |
| E-14 | 请求参数 | 无 userEntryId/revision | `userEntryId` + `contentRevision` | 同 remote |
| E-15 | 409 冲突 | 手动回滚 user entry | `reloadFromDisk(true)` + `restorePendingEditDraft` | 同 remote |
| E-16 | 会话切换/新建条件保存 | 无条件 saveSession | `hadActiveTurn` 才不保存 | 同 remote |
| E-17 | 删除会话忙碌拒绝 | 无 | 流式中拒绝删除 | 同 remote |
| E-18 | 确认/问答异步校验 + effects | 立即改文案、无 effects | 异步校验 + `effects` 渲染 | 同 remote |
| E-19 | 标题请求 | 带 sessionID + agentOwnerHeaders | 不带两者、带 pendingTitle | 同 remote 的 pendingTitle，请求头同 backup（agentOwnerHeaders + sessionID） |
| E-20 | regenerate 历史工具确认 | backup 无 / remote `confirmDialog` 弹窗 | `confirmDialog` | `canRegenerateHistoryFrom` 消息提示（`hasAgentExecutedToolsAfter` 保留，交互方式不同，列为拆分期取舍） |
| E-21 | frontend 工具调度 | `capabilities.pluginActions`/`frontendReload` | `frontendActions` 注册表 `lookupAction` | 同 backup（capabilities） |
| E-22 | confirm always 按钮 | 隐藏（forge_runtime_restart/approve_tests） | 无条件显示 | 同 backup |
| E-23 | web_search 卡片 | 有（progress/result/引用注册） | 无（仅 todo_write） | 同 backup |

---

## 5. 新增功能（backup 与 remote 均无，非行为差异）

| 功能 | 位置 |
|---|---|
| 提示词来源控制器（Phase 1 产物） | `AgentPromptSourceController.ts`，门面 `promptSourceController` 字段 |
| 会话文件上传 / 任务目录菜单 | `chat/session/files/`（`AgentChat.files.ts`/`fileOperation.ts`），`sessionFilesBtn/sessionFilesInput` 字段 |
| 私有方法安装器 | `chat/AgentChat.privateMethods.ts::installAgentChatPrivateMethods` |
| 运行时断言守卫 | `chat/core/AgentChat.runtime.guard.ts`（`toAgentChatRuntime`/`requireElement`/`readAPIResult` 等） |
| 平台对象工厂 | `chat/core/AgentChat.runtime.factory.ts`、`chat/ui/feedback/AgentChat.observer.factory.ts` |
| rAF 等待工具 | `chat/core/AgentChat.async.ts::waitForAgentChatFrame` |
| 布局序列化 getter | `AgentChat.ts` L333-335 `layoutSerialization` |
| 用户编辑/重发事件总线 | `chat/message/user/AgentChat.userEditEvent.factory.ts`、`chat/message/actions/AgentChat.regenerateEvent.ts` |
| 会话文件操作串行锁 | `sessionFileOperationSerial/sessionFileOperationPending` + `AgentChat.fileOperation.ts` |

---

## 6. 外部导出兼容性核对

| 调用方 | 使用成员 | 兼容性 |
|---|---|---|
| `tabFloat.factory.ts` | `new AgentChat`、`ready`、`createFloatingCopy`、`setFloatingCopyOptions`、`destroy` | 兼容 |
| `runtime/AgentPanelController.ts` | `new AgentChat`、`getConversation`、`refreshSessions`、`setDraft`、`openConversation`、`getSessionId`、`restoreSessionById`、`layoutSerialization` | 兼容 |
| `dockModel.factory.ts` | `new AgentChat`、构造 options | 兼容 |
| `layout-deserialization.handlers.ts` | `AgentChat` 构造与布局恢复 | 兼容 |

公开成员签名与返回类型均未改变；新增公开成员（`insertBlockMentions`/`refreshModelOptions`/`layoutSerialization`）为纯新增，不影响既有调用方。

---

## 7. 差异分类统计

| 类别 | 数量 |
|---|---|
| 拆分引入的行为改写（严重） | 1 |
| 拆分引入的行为改写（中等） | 4 |
| 拆分引入的行为改写（轻微） | 10 |
| **拆分引入行为差异合计** | **15** |
| backup ↔ remote 既有演进差异（非拆分引入） | 23 项登记 |
| 新增功能（非行为差异） | 9 项登记 |

---

## 8. 结论

- 拆分后门面对外部调用方的公开契约保持兼容，`chat/` 目录职责划分清晰、依赖方向单一（`pnpm lint:cycles` 无环）。
- 按"backup 与 remote 为共同基线、新增功能不计差异"的口径，**拆分真正改写的既有行为共 15 处**：**严重 1**（编辑器 Tiptap→Protyle）、**中等 4**（拖拽条件化、navRail/token hover 延迟移除、postFrontendResult 重试与 409 语义）、**轻微 10**（高亮清理、平滑滚动兜底、计时器机制、字段初始化等）。
- 其余差异均可归因于 backup → remote 的既有演进（remote 已包含，拆分保持其语义）或纯新增功能，**不属拆分校核范围内的行为差异**。
- 建议后续修复子任务优先处理 **S1**（若需保持 Tiptap 则回退第 4 参），其次核对 **S2/S5** 是否符合预期取舍；**S3–S15** 多为实现细节，可保留并在回归测试中覆盖。

---

## 9. 修复记录（2026-07-31 子任务执行）

> 修复口径：以 backup 与 remote 共同语义为准恢复拆分改写的行为；**用户裁决**：编辑器 Protyle 为预期演进方向（remote 的 `AgentComposer` 即 Protyle 实现，tiptap 在逐步清理中），S1/S2 保留拆分语义不回退；remote 的改进不得丢失。
>
> 备份位置：`docs/ttt/AI模块改进/行为修复备份/`（修改前快照）。

### 9.1 实际修复（9 处）

| 差异 | 修复文件 | 修复方式 |
|---|---|---|
| S3 navRail 悬浮展开延迟 | `chat/ui/navigation/AgentChat.navigation.ts` | 恢复 200ms 延迟展开（`navExpandTimer`），mouseleave 取消未到期延迟；runtime 与门面补充 `navExpandTimer` 字段 |
| S4 token popup hover 延迟 | `chat/ui/AgentChat.events.helpers.ts`、`chat/interaction/AgentChat.metrics.helpers.ts` | 恢复 mouseenter 200ms 显示 / mouseleave 300ms 关闭；弹窗 mouseenter 取消关闭延迟；runtime 与门面补充 `tokenPopupShowTimer/tokenPopupHideTimer` 字段 |
| S5 postFrontendResult 重试与 409 | `chat/interaction/confirm/AgentChat.confirm.methods.ts` | 改为 3 次尝试、退避 `200ms×(attempt+1)`、409 视为过期静默返回（与 remote L3166-3189 一致） |
| S6 jumpToMessage 高亮清理 | `chat/ui/navigation/AgentChat.navigation.ts` | 改回 `setTimeout(1500)` 清理，删除 animationend 依赖与无 body 立即清理分支 |
| S7 scrollToBottom 超时兜底 | `chat/ui/feedback/AgentChat.scrolling.ts` | 恢复 1s `setTimeout(finish)` 兜底与 wheel 中断逻辑（与 backup L3991 一致） |
| S8 思考计时器机制 | `chat/ui/feedback/AgentChat.thinkingState.ts` | 改回 `setInterval(100ms)` 驱动，stop 用 `clearInterval` |
| S9 scrollToThinkingCardBelow 定位时机 | `chat/ui/feedback/AgentChat.scrolling.ts` | 恢复 `setTimeout(align, delay)` 默认 220ms 延迟；保留 transitionend 优先分支 |
| S10 recoverInterruptedTurn 退避 | `chat/session/AgentChat.recoverTurn.ts` | 改回 `[100,200,400,800,1600,3200]` setTimeout 退避序列（与 remote L934-937 一致） |
| S14 思考卡片 detail 追加 | `chat/stream/AgentChat.thinking.helpers.ts` | 改回 `existingBody.innerHTML += detailLines`（重建子树，与 backup L2754 一致） |

### 9.2 经核实无需修复（6 处）

| 差异 | 原因 |
|---|---|
| S1 编辑器类型切换（Tiptap→Protyle） | **用户裁决**：Protyle 为预期演进方向，remote 的 `AgentComposer.ts.remote` 即 Protyle 实现；拆分后的按 app 判定（有 App 走 Protyle、无 App 走 Tiptap）正是为同时保留两条宿主路径 |
| S2 自定义块拖拽条件化 | remote L328 注释"块拖拽由 protyle 统一处理"；拆分后无 App 宿主仍绑定拖拽（等价 backup），有 App 宿主不绑（等价 remote），属两基线语义的按宿主融合，符合预期 |
| S11 私有方法安装机制 | `Object.defineProperty` 安装为实例自有属性是拆分架构的核心设计（安装器），外部不可见，且 `enumerable: false` 不改变遍历语义 |
| S12 方法原型链变化 | 方法不再位于 `AgentChat.prototype`，已核对全部 import 方无依赖原型链的调用 |
| S13 字段初始化方式 | `private x!: T` 非空断言与 backup 的构造赋值在运行时语义相同，仅类型层差异 |
| S15 MAGI identity interfaceKind | `buildRuntimeMainInterfaceIdentity()` 默认即返回 `interfaceKind: "magi-main-ui"`（见 `magiStandardLLMAdapter.backend.ts` L126），拆分后显式写出该字段，未引入新行为 |

### 9.3 附带修改与遗留

- **附带修改**（为支撑修复，不改变行为）：
  - `chat/core/AgentChat.runtime.types.ts`：补充 `navExpandTimer/tokenPopupShowTimer/tokenPopupHideTimer` 字段声明并补齐既有 import/export 注释
  - `AgentChat.ts`（门面）：补充三个 timer 字段声明
  - `chat/core/AgentChat.runtime.guard.ts`：新增 `readCustomEventDetail` 类型守卫（替代既有 `as` 断言）
- **遗留问题**：
  - `chat/ui/AgentChat.events.helpers.ts` 与 `chat/interaction/confirm/AgentChat.confirm.methods.ts` 存在拆分前既有的 lint 存量（import 注释缺失、内联回调超限），本次修复未扩大，后续可另行清理
  - `chat/session/` 目录 13 个文件超出 10 个条目的 lint 上限，属拆分架构既有问题，建议后续子任务评估目录重组

---

## remote 功能保留校核

> **校核时间**：2026-07-31（子任务）
>
> **校核口径**：以 `AgentChat.ts.remote`（3830 行）为基准，识别其相对 `AgentChat.ts.backup`（4049 行）的新增功能/新行为/新方法（remote 有而 backup 没有，或行为不同），逐一核对拆分结果（门面 `AgentChat.ts` + `chat/` 93 文件）是否完整保留。本章节仅回答"remote 的新功能在拆分后是否丢失"，不重新计算拆分校核的行为差异（见 §3/§4）。
>
> **验证方式**：完整逐行阅读 remote 全部 3830 行；对 backup 用代码搜索确认目标方法/字段是否存在于 backup；对拆分结果逐个模块核对实现。以下清单中 remote 行号均指 `AgentChat.ts.remote`。

### 10.1 remote 新增功能清单与保留状态

| # | remote 功能（行号） | remote 行为要点 | 拆分后位置 | 保留状态 |
|---|---|---|---|---|
| R-1 | 中断轮次恢复协议（L928-1000） | `recoverInterruptedTurn`/`prepareForNewTurn` + `currentTurnID`/`recoveryCommitTurnIDs`/`pendingRecoverySessionIDs`/`recoveryInFlightSessionIDs`，`[100,200,400,800,1600,3200]` 退避轮询提交 | `chat/session/AgentChat.recoverTurn.ts`（退避序列 L54、提交逻辑 L31-43） | 完整 |
| R-2 | 用户消息内联编辑（L1587-1597、L2032-2091） | `editingUserEntryID`/`pendingEditDraft`/`restorePendingEditDraft`/`beginEditUserMessage` + Escape/Ctrl+Enter 快捷键 | `chat/message/user/AgentChat.userActions.ts`（编辑控件 L29-44、快捷键 L83-96、草稿恢复 L170-180） | 完整 |
| R-3 | 用户消息富文本渲染（L1966-2023） | `Md2BlockDOM` + `disabledWYSIWYG` + 复制/编辑入口 + 正文点击编辑 | `chat/message/user/AgentChat.userRender.ts` + `userMessage.ts` + `userActions.ts` | 完整 |
| R-4 | 工具运行徽标（L2180-2238） | `toolCallStartedAt`/`setToolCallRunning`/`finishToolCall`，其中 `finishToolCall` 有 **600ms 保底**（`Math.max(600 - (Date.now() - startedAt), 0)` + setTimeout 延迟清除，L2228-2237） | `chat/interaction/tools/AgentChat.toolState.ts`（L80-87 直接清除，无 600ms 保底） | **部分保留**（见 10.2-R4） |
| R-5 | 会话滚动位置恢复（L149-155、L356-369、L3691-3717） | `scrollBottomBySession`/`layoutVisible`/`restoreScrollToBottom`（rAF 循环校正约 320ms），dock 折叠期间不记录 | `chat/ui/feedback/AgentChat.scrolling.ts::restoreScrollToBottom`（L27-53）+ `chat/ui/AgentChat.init.helpers.ts::observeAgentChatLayout`（L220-233）/`bindAgentChatScroll`（L150-171） | 完整 |
| R-6 | 推理强度原生 select（L271-272、L462-477） | `reasoningEffortSelect` 4 档（Default/low/medium/high），change 记忆 `selectedReasoningEffort` | `chat/ui/model/AgentChat.model.methods.ts::initReasoningEffortSelect`（L97-112） | 完整 |
| R-7 | 模型可用性计数去 apiKey（L220-233） | `countUsableModels` 仅判 `enabled`，不要求 apiKey | `chat/ui/model/AgentChat.modelSignature.ts::getUsableModelSignature`（L8-17） | 完整（等价实现） |
| R-8 | SSE turn/interrupted/error 权威恢复（L1774-1870） | `turn` 记录 `currentTurnID`；`interrupted`/`error` 走 `handleError` → 磁盘重载 + `recoverInterruptedTurn`；事件处理器异常恢复（L1847-1869） | `chat/stream/AgentChat.sse.helpers.ts`（turn L92-95、interrupted L189-192、失败恢复 L200-222）+ `stream/AgentChat.errorHandling.ts` | 完整 |
| R-9 | 409 冲突权威重载 + 草稿恢复（L1576-1597） | `handleConflictReject`：重载磁盘权威会话 + `restorePendingEditDraft` + 繁忙提示 | `chat/message/AgentChat.conflict.ts`（L11-21） | 完整 |
| R-10 | 流式中切换会话（L1065-1135） | **无 `isStreaming` 守卫**：流式中切换将旧会话加入 `pendingRecoverySessionIDs`、abort 当前请求、后台恢复 | `chat/session/AgentChat.switch.ts`（L118-121 加回 `if (runtime.isStreaming) return`；`prepareAgentChatSessionSwitch` L14-32 保留 hadActiveTurn 处理） | **部分保留**（见 10.2-R10） |
| R-11 | finishResponse 权威重绘（L2744-2766） | 提交后采用 `canonicalSession` 权威会话重绘，避免前端流式快照覆盖 | `chat/stream/AgentChat.response.helpers.ts::reconcileCanonicalSession`（L119-139） | 完整 |
| R-12 | stopGeneration 重载 + 恢复（L2938-3005） | abort 后 `reloadFromDisk(true)` + `recoverInterruptedTurn`，不直接保存 runtime | `chat/interaction/AgentChat.errors.methods.ts::stopGeneration`（L35-63） | 完整 |
| R-13 | regenerate 状态校验（L2510-2549） | `isAgentRegenerateStateCurrent` + revision 比对 + 双重 `findAgentUserEntryIndex` 校验 | `chat/stream/AgentChat.regenerate.helpers.ts::prepareRegeneration`（L47-72） | 完整 |
| R-14 | regenerate 历史截断确认弹窗（L2510-2519） | `confirmHistoryTruncation` 用 `confirmDialog` 弹窗，用户可确认截断继续 | `chat/message/actions/AgentChat.assistantActions.ts::canRegenerateHistoryFrom`（L88-98 用 `showMessage` 提示并直接拒绝） | **部分保留**（E-20 已登记取舍） |
| R-15 | 请求参数 userEntryId + contentRevision（L551-552、L2646-2647） | `fetchAgentSSE` 传 `userEntryId` + `SessionStore.getRevision(sessionId)` | `chat/message/AgentChat.send.helpers.ts`（L128、L238） | 完整 |
| R-16 | 会话切换/新建条件保存（L1068、L1400） | `hadActiveTurn`（isStreaming 或 currentTurnID）时才不保存、标记恢复 | `chat/session/AgentChat.manage.helpers.ts`（L9-24）+ `switch.ts::prepareAgentChatSessionSwitch`（L17-31） | 完整 |
| R-17 | 删除会话忙碌拒绝（L1459-1464） | 流式中/有轮次/恢复中拒绝删除并提示 | `chat/session/AgentChat.manage.methods.ts::deleteSession`（L15-20） | 完整 |
| R-18 | 确认/问答异步校验 + effects 渲染（L3015-3034、L3111-3146、L3274-3307） | `renderConfirmEffects`、`postConfirm`/`postQuestionAnswer` 校验响应码、失败解锁按钮 | `chat/interaction/confirm/AgentChat.confirm.methods.ts` + `confirm.helpers.ts` + `question.submit.ts` | 完整 |
| R-19 | 标题请求 pendingTitle（L2817-2847） | 标题请求带 `pendingTitle` 语义，流式中不单独保存、收尾统一提交 | `chat/stream/AgentChat.finish.methods.ts::tryGenerateTitle`（L52-87，请求头同 backup 带 sessionID + agentOwnerHeaders） | 完整（E-19 口径） |
| R-20 | frontendActions 注册表（L9-10、L3148-3164） | `listActions`/`lookupAction` 注册表 + `handleFrontendToolCall` 分派 | `frontendActions/` 目录（`index.ts` 注册表 + `builtIns.ts` 4 个内建动作）完整存在；`confirm.methods.ts::handleFrontendToolCall`（L134-160）经 capabilities 执行（分派路径同 backup，E-21 已登记） | 完整 |
| R-21 | confirm always 按钮无条件显示（L3051） | 所有确认卡片都渲染 Session Allow 按钮 | `chat/interaction/confirm/AgentChat.confirm.helpers.ts::renderSessionAllowButton`（L36-44 对 `forge_runtime_restart`/`forge_runtime_approve_tests` 隐藏，同 backup） | **部分保留**（E-22 已登记取舍） |
| R-22 | 系统通知（L2772-2775、L3106-3108） | 页面未聚焦/隐藏时 `sendNotification` 提示响应完成与确认到达 | `chat/stream/AgentChat.response.helpers.ts::notifyFinishedResponse`（L142-147）+ `confirm.methods.ts`（L84-86，经 `capabilities.notification`） | 完整（等价实现） |
| R-23 | snapshot 回滚确认 + rollback entry 持久化（L2878-2936） | 回滚前 `confirmDialog` 确认、回滚后 push rollback entry + saveSession | `chat/interaction/snapshot/AgentChat.snapshot.ts`（L50-73 经 `capabilities.confirm`，等价） | 完整（等价实现） |
| R-24 | 问题卡片 radio 再点击取消（L3216-3232） | mousedown 记录 `wasChecked`，click 时已选 radio 再点取消 | `chat/interaction/AgentChat.question.helpers.ts::bindQuestionOptionToggles`（L5-23） | 完整 |
| R-25 | reasoning 流式渲染（L2424-2454） | `pendingReasoningUpdate` + rAF 合并追加 `agent-chat__thinking-reasoning-text` | `chat/stream/AgentChat.thinking.methods.ts::appendReasoning`（L44-63） | 完整 |
| R-26 | thinking 卡片边界重置（L2319-2376） | `hasInterveningCard` 结算：落盘思考/工具/pendingConfirms、重置 `renderedToolNames`、重置计时 | `chat/stream/AgentChat.thinking.helpers.ts::settleInterveningThinkingCard`（L141-154） | 完整 |
| R-27 | frontend_tool_call SSE 分派（L1843-1845） | `handleFrontendToolCall(event.callID, event.arguments)` | `chat/stream/AgentChat.sse.helpers.ts`（L194-196） | 完整 |
| R-28 | insertBlockMentions 公开方法（L401-405） | 公开入口，`composer.insertMentions(mentions)` | `chat/ui/AgentChat.composer.ts::insertBlockMentions`（L27-31） | 完整 |

### 10.2 部分保留项详述

- **R4 工具徽标 600ms 保底缺失**：remote `finishToolCall`（L2223-2238）在清除运行徽标前，先读 `toolCallStartedAt.get(name)`，若工具开始至今不足 600ms，用 `window.setTimeout(() => { ... this.setToolCallRunning(name, false); this.toolCallStartedAt.delete(name); }, Math.max(600 - (Date.now() - startedAt), 0))` 延迟清除，保证徽标至少可见 600ms 防闪烁。拆分后 `chat/interaction/tools/AgentChat.toolState.ts::finishToolCall`（L80-87）为：
  ```ts
  export function finishToolCall(runtime: AgentChatRuntime, name: string) {
      const stillRunning = runtime.currentToolCalls.some((item) => item.name === name && item.result === undefined);
      if (stillRunning) { return; }
      setToolCallRunning(runtime, name, false);
      runtime.toolCallStartedAt.delete(name);
  }
  ```
  缺失了 `toolCallStartedAt` 的读取、600ms 保底与 `setTimeout` 延迟清除。**表现**：快速完成（<600ms）的工具其 running 徽标立即消失，可能与下一工具徽标创建同帧产生闪烁；`toolCallStartedAt` 字段虽保留在 runtime 契约（`runtime.types.ts` L96）但已不再承担保底职责。

- **R10 流式中切换会话回退 backup 语义**：remote `switchSession`（L1065-1135）无 `isStreaming` 守卫，流式中切换会将旧会话 `pendingRecoverySessionIDs.add`、abort 当前请求、随后由 `recoverInterruptedTurn` 后台恢复（对应 remote 的 `hadActiveTurn` 分支）。拆分后 `chat/session/AgentChat.switch.ts::switchSession`（L118-121）：
  ```ts
  export async function switchSession(runtime: AgentChatRuntime, id: string) {
      if (runtime.isStreaming) { return; }
      await prepareAgentChatSessionSwitch(runtime);
  ```
  入口守卫与 backup（L1466-1468 `if (this.isStreaming) return`）一致，导致 `isStreaming=true` 时直接拒绝切换，remote 的"流式中切换并后台恢复"能力丢失。`prepareAgentChatSessionSwitch` 内 `hadActiveTurn` 处理（abort、pendingRecovery、条件保存）仍保留，仅当 `currentTurnID` 非空且非流式时才可达（partial 保留 remote 语义）。

- **R14 regenerate 历史截断确认交互（E-20 已登记取舍）**：remote `confirmHistoryTruncation`（L2510-2519）用 `confirmDialog` 弹窗询问用户，确认后继续截断重发；拆分后 `canRegenerateHistoryFrom`（`assistantActions.ts` L88-98）检测到已执行工具时仅 `showMessage(agentEditHistoryWarning)` 并直接拒绝，**无确认继续路径**。`hasAgentExecutedToolsAfter` 判定保留，交互方式不同，E-20 已登记为拆分期取舍。

- **R21 confirm always 按钮按 backup 隐藏（E-22 已登记取舍）**：remote（L3051）所有确认卡片无条件渲染 Session Allow 按钮；拆分后 `renderSessionAllowButton`（`confirm.helpers.ts` L36-44）对 `forge_runtime_restart`/`forge_runtime_approve_tests` 两个工具隐藏该按钮，与 backup 一致。E-22 已登记为拆分后同 backup。

### 10.3 保留结论

- **remote 相对 backup 的新增功能/新行为共 28 项**（R-1 ~ R-28）。
- **完整保留 24 项**（含等价实现，如 R-7/R-22/R-23 经 capabilities 注入或函数等价）。
- **部分保留（弱化）4 项**：R-4（工具徽标 600ms 保底）、R-10（流式中切换会话）、R-14（regenerate 截断确认弹窗，E-20 取舍）、R-21（confirm always 按钮，E-22 取舍）。
- **完全缺失 0 项**：不存在 remote 有而拆分后完全没有的功能。
- 其中 **R-4、R-10 为拆分引入的实际弱化**（拆分前两基线语义不同处取了 backup 语义或简化实现）；**R-14、R-21 为已登记的分期取舍**（E-20/E-22），非拆分引入丢失。R-4/R-10 可留给后续修复子任务按 remote 语义恢复（若需保持 remote 行为）。
