# Agent 新会话打开目标扩展（TikTocTak）

> **目标**: 为原生 Agent（非 MAGI）会话管理增加「添加新会话」时的目标选择：默认在 Dock 内创建，同时支持「添加并在新页签中打开」「添加并在新窗口中打开（Electron）」「添加并在浏览器中打开」。
>
> **流程**: 滚动更新的执行路线图。
> 1. 从「近期计划」中认领任务。
> 2. 完成开发、测试和验证。
> 3. 移动到「已归档/已完成」区。
> 4. 将「中期计划」条目提升到「近期计划」。

---

## 核心原则

1. 「添加」语义保持不变：旧会话在无活跃轮次时先持久化，再生成新会话 ID 并重置视图。
2. 目标选择只改变**新会话承载位置**，不改变会话持久化协议（`storage/ai/agent/sessions/`）与并发冲突语义。
3. 不同宿主（完整 App / 浏览器独立页）通过既有 `AgentPanelCapabilities` 能力门控，缺失能力时隐藏对应菜单项。
4. 打开新页签/新窗口/浏览器时，源面板保持当前会话不变（不切换、不销毁）。
5. 只新增会话菜单项，不改变标题栏已有「open-as-tab / open-as-dialog」按钮行为。

---

## 近期计划

- [ ] **Phase 1: 会话菜单新增「添加并…」分组（P0）**
  - **背景**: 会话弹层目前只有「新建会话」入口（标题栏 `+` 图标，调用 `createSession` 在当前面板内重置）。
  - **行动**: 在会话弹层空态/底部提供「添加并在新页签中打开」「添加并在新窗口中打开（Electron）」「添加并在浏览器中打开」菜单项；非 Electron 环境隐藏「新窗口」项。
  - **验收标准**: 点击各菜单项触发对应打开命令，Dock 面板自身不切换到新会话。

- [ ] **Phase 2: 新页签打开（P0）**
  - **背景**: 布局已具备 `requestOpenTabAsTab(tab)` + Agent 副本工厂（`tabFloat.factory.ts`），但副本会加载**当前会话**而非新会话。
  - **行动**: 扩展副本创建参数，使新建 Tab 副本以「全新会话」初始化（`initialConversation.sessionId` 置空）。
  - **验收标准**: 点击后中央布局出现新 Agent Tab，显示空白欢迎页；原 Dock 会话不变。

- [ ] **Phase 3: Electron 新窗口打开（P1）**
  - **背景**: Electron 主进程已有 `siyuan-open-window` IPC（`app/electron/main.js`），可加载任意 URL；`agent-app` 构建目标已存在（`/stage/build/agent-app/`）。
  - **行动**: 新增 IPC 常量与窗口 URL（指向 `agent-app/?kind=native-agent` 无 sessionId）；通过 `ipcSend` 拉起新 BrowserWindow。
  - **验收标准**: Electron 下点击后打开独立窗口的空白 Agent 面板；浏览器宿主隐藏该菜单项。

- [ ] **Phase 4: 浏览器中打开（P0）**
  - **背景**: `agent-app` 独立页支持 URL 参数 `kind`/`sessionId`（`agent-standalone/index.ts`）。
  - **行动**: 使用 `window.open("/stage/build/agent-app/?kind=native-agent", "_blank")` 打开新标签页。
  - **验收标准**: 浏览器与 Electron 环境下均可在浏览器新标签打开空白 Agent 面板。

- [ ] **Phase 5: i18n 与 lint 验证**
  - **背景**: 新增菜单文案需要所有语言文件同步；项目有 `check-lang-keys.py` 校验。
  - **行动**: 在全部 `langs/*.json` 顶部新增键；运行 `python scripts/check-lang-keys.py`；`cd app && pnpm run lint`。
  - **验收标准**: 语言键校验通过，ESLint 无新增错误。

---

## 中期计划

- [ ] **Phase 6: 会话状态透传与跨实例同步（P1）**
  - **背景**: 新窗口/浏览器打开时若想携带当前会话（而非空白新会话），需要把 `sessionId` 写入 URL。
  - **行动**: 评估 URL 长度与安全边界，把「新会话」与「当前会话副本」分开命令。
  - **同步前置条件（必须满足）**:
    - 所有实例（Dock/Tab/浮窗/独立页）通过 `enableSessionWebSocket !== false` 接入全局 WS，由后端广播 `agentSessionChanged`（`streamStart`/`streamEnd`/`update`/`delete`）驱动镜像锁定 + 权威重载（[`AgentChat.websocket.ts`](../../app/src/layout/dock/agent/chat/session/switching/AgentChat.websocket.ts)）。
    - **独立页（新窗口/浏览器打开的 `agent-app`）默认 `enableSessionWebSocket: false`，不参与同步**（[`agent-standalone/index.ts`](../../app/src/agent-standalone/index.ts:32)）；若要同一会话在独立页打开，必须改为 `true` 接入 WS。
    - 独立页认证：`postStandaloneKernel` 目前不带认证头（[`standalone-runtime/kernel.ts`](../../app/src/standalone-runtime/kernel.ts:7)），而 `/api/ai/agent/*` 走 `CheckAuth`；需确认同源会话/cookie 认证是否可用，否则独立页无法执行会话 API。
    - 并发写冲突已有兜底：save 返回 409 时 [`handleConflictReject`](../../app/src/layout/dock/agent/chat/message/sending/AgentChat.conflict.ts:11) 重载权威并提示。
  - **广播机制改造（必须）：移除对 `X-SiYuan-App-ID` 的依赖，改用「全量广播 + 前端自排除」**:
    - **缺陷证据**：
      1. `Constants.SIYUAN_APPID` 是页面加载时的 `Math.random()` 随机值（[`constants.ts`](../../app/src/constants.ts:18)），不持久、不可靠。
      2. `BroadcastByTypeAndExcludeApp` 按 **appId 桶**排除整个页面（[`kernel/util/websocket.go`](../../kernel/util/websocket.go:43)），而同一页面内 Dock / Tab 副本 / 浮窗副本**共享同一个 `SIYUAN_APPID`**，会被一起排除——即现有 Tab 副本本来就收不到广播。
      3. `broadcastAgentSessionChanged` 的 excludeApp 参数取自 HTTP 头 `X-SiYuan-App-ID`（[`kernel/api/agent.go`](../../kernel/api/agent.go:1200)），独立页一旦 appId 与发起方不同就靠"碰巧不同"才能收到，判定脆弱。
    - **更可靠的设计**：后端 `broadcastAgentSessionChanged` 从 `BroadcastByTypeAndExcludeApp` 改为 `BroadcastByType`（**全量广播**，不排除任何人）；发起者自身的忽略已由前端 `onWsMessage` 的 `payload.sessionID !== runtime.sessionId || runtime.isStreaming` 自排除覆盖（[`AgentChat.websocket.ts`](../../app/src/layout/dock/agent/chat/session/switching/AgentChat.websocket.ts:28)）——发起者流式中 `isStreaming=true` 忽略 streamStart/update，流结束后收到自己的 update 只会触发 `entriesEqual` 幂等检查，无害。
    - **验证点**：全量广播后，发起者收到自己的 `delete`（此时 sessionId 已切换或已删除，`payload.sessionID !== runtime.sessionId` 被忽略）；发起者收到自己的 `streamEnd`（非镜像态，`removeMirror`/`restorePendingEditDraft` 幂等）。`finishRunningSession` 的 uncommitted 分支已经用全量 `BroadcastByType` 发 update（[`kernel/api/agent.go`](../../kernel/api/agent.go:437)），证明全量广播路径已被现有代码采用。
  - **权限安全分析（必须满足，涉及任务目录绑定 session）**:
    - **广播载荷最小化**：`agentSessionChanged` 载荷只含 `sessionID` + `action`（[`kernel/api/agent.go`](../../kernel/api/agent.go:1199)），**不含任何消息内容、路径、owner 身份或目录信息**。全量广播只是把「哪些 session 发生了状态变化」的通知发给所有已认证 WS 客户端，不传输受保护数据。
    - **受保护 session 的广播豁免（第一层）**：`broadcastAgentSessionChanged` 入口 `GetTaskDirectoryBinding` 发现 `binding != nil` 时**直接 return，不广播**（[`kernel/api/agent.go`](../../kernel/api/agent.go:1191)）。带任务目录绑定的 session 的 ID、活动状态、时序**永不进入全局 WS 通道**——这层保护与广播方式（排除/全量）无关，全量广播不会绕过它。
    - **受保护 session 的 API 访问控制（第二层）**：所有会话 API 入口经 `requireAgentSessionAccess`（[`kernel/api/agent.go`](../../kernel/api/agent.go:156)），绑定存在时强制校验 `X-SiYuan-Agent-Owner-Token` 与 `OwnerIdentityID` 常量时间相等，不匹配返回 403；`listAgentTaskDirectories` 同样强制 owner（[`kernel/api/agent.go`](../../kernel/api/agent.go:618)）。即使前端误加载受保护 sessionId，也无法读取其内容或目录。
    - **受保护 session 的列表脱敏（第三层）**：`lsSessions` 在 service 层按 owner 过滤（无 owner token 的绑定 session 直接跳过，[`kernel/agent/session.go`](../../kernel/agent/session.go:622)），返回前再经 `RedactSessionList` 抹掉 `Path`/`OwnerIdentityID`（[`kernel/agent/session.go`](../../kernel/agent/session.go:413)）。未授权端**连 session 的存在都看不到**。
    - **结论**：广播改造（全量广播）**不造成权限逃逸**——受保护 session 根本不会进入广播通道；即使广播通道被恶意端监听，也只能收到无绑定 session 的 ID+action 通知，无法借此获取绑定 session 的任何信息。Phase 6 打开「当前会话副本」时，前端必须先具备 owner token 才能加载绑定 session，天然与 owner 授权一致。
  - **本任务（新会话）范围说明**: 每次「添加」都生成**独立新 sessionId**，各位置持有不同会话，不存在同一会话的同步需求；同步仅在 Phase 6「当前会话副本打开」时成为硬前置。但广播改造（全量广播）建议随 Phase 6 一并落地，因为它同时修复同页面 Dock+Tab 副本收不到广播的既有缺陷。

---

## 已归档/已完成

（暂无）

---

## 如何维护此文档

1. **完成归档**: 任务满足验收标准后，剪切到「已归档/已完成」，标记 `[x]` 并添加完成日期。
2. **补充弹药**: 近期计划少于 3 个任务时，从中期计划提升可执行任务。
3. **因地制宜**: 发现计划不合理时记录原因并调整。
4. **数据驱动**: 同步记录测试结果、受影响文件和原子化提交信息。
