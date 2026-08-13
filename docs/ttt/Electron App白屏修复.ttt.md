# Electron App 白屏修复执行跟踪 (TikTocTak)

> **状态**: 进行中
> **创建日期**: 2026-08-13
> **目标**: 在不停止现有 Supervisor、Kernel 或 Electron 的前提下，确认 Forge Electron 主窗口白屏的首个真实断点，形成最小修复、聚焦回归测试和一次真实 App 启动验收。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 保留白屏现场并采集导航、DOM、控制台和启动协议证据。
> 2. 只修复已证实的入口或生命周期错误。
> 3. 完成测试后记录当前运行版本与待重新加载边界。
> 4. 完成真实 App 验收后移动到归档目录，保留全部证据。

## 核心原则

- 主窗口入口固定为 Kernel 提供的 `/stage/build/app/`，不切换到浏览器 `desktop` 入口。
- Electron 是可选宿主；Kernel 与浏览器端不得假定 Electron 必然存在。
- 诊断实例必须使用 `--attach-kernel=true`，不得拥有或停止现有 Kernel 生命周期。
- 不以普通浏览器结果代替 Electron 宿主结果，不以 `siyuan-ready-to-show` 超时结果代替首个失败原因。
- 不用构建、重启、清缓存或回退代码掩盖当前现场。
- 所有失败显式记录最终 URL、主帧加载状态和首个异常。
- Service Worker 已由当前 Profile 的缓存实证排除，不再作为本次回归的根因或解释。
- `webContents.getURL()` 为空只表示主窗口仍是初始 `about:blank`；在捕获主帧导航事件之前，不把目标 URL、重定向 URL或认证页写成已显示地址。

## 验证检查清单

- [x] 确认现有 Supervisor、Kernel、Electron 主进程和 Renderer 仍在运行。
- [x] 确认主窗口加载目标是 `/stage/build/app/`，物理产物为 `app/stage/build/app/index.html`。
- [x] 确认当前工作空间配置了访问密码；无会话访问 App 入口返回 `302 /check-auth`。
- [x] 确认认证页包含 Electron IPC `siyuan-ready-to-show`，正常认证页不应等待完整 `new App()`。
- [x] 确认 2026-08-12 15:12 的真实主进程日志只记录 60 秒就绪超时，没有主 URL 失败记录。
- [x] 捕获隔离 Electron attach 实例的最终 URL、DOM、控制台首错、请求失败和截图；该实例不代表当前真实 Profile 与窗口。
- [x] 确认认证页 Electron IPC 可用，`siyuan-ready-to-show` 被主进程消费并清理监听器，不存在认证页就绪协议缺失。
- [x] 隔离实例曾观察到自动创建并前置显示 `magi-app` 窗口；该观察没有建立 Magi 窗口与当前真实白屏之间的因果关系，也不构成修改既有启动契约的依据。
- [x] 完成认证后 `app` bundle 的隔离 Electron 诊断；该结果只说明隔离实例，不作为当前 PID `4912` 的验收证据。
- [x] 为 Renderer 配置顺序增加聚焦测试；主窗口 Magi 自动创建不再列为已证实断点或白屏修复。
- [ ] 在真实 Forge Electron 窗口完成启动验收，确认不再白屏且就绪协议闭合。

## 🟢 近期计划

### 纠错与当前现场（2026-08-13 15:xx）

- 当前仓库 HEAD 为 `6ce4088843`；Supervisor PID `39472`、Kernel PID `35148`、Electron 主进程 PID `19200` 均在运行。Kernel 活跃二进制记录的源码 revision 为 `06f6feac42`，不能把当前工作树 HEAD 与已运行进程版本混写。
- 用户截图中的深色窗口是 `boot.html` 启动窗；60 秒后出现的白色窗口是主 `BrowserWindow`。UI Host 的上一次现场读取为 `url=null`、`loading=true`、`didFinishLoadAt=null`、`rendererReadyAt=null`，因此白色内容是尚未提交文档的初始 `about:blank`，不是 `/check-auth`、App 页面或 Service Worker 页面。
- Kernel 的 HTTP `/stage/build/app/` 可在毫秒级返回 `302 /check-auth`，认证页可返回完整 HTML；真实 Electron 入口使用 HTTPS，OpenSSL 已确认当前端口可完成 TLS 1.3 握手。两种协议的结果必须分开记录。
- 隔离 Profile 在 13:01 使用同一 `electron/main.js --attach-kernel=true` 路径成功进入完整 App；14:00 的默认 Profile 冷启动停在 `about:blank`。隔离成功仅排除静态入口和通用 Renderer 代码必然失败，未证明默认 Profile 的真实启动链正常。
- 当前最早可证实断点是：`currentWindow.loadURL(https://127.0.0.1:6806/stage/build/app/...)` 已调用，但主帧没有已记录的提交、完成或失败事件。现有代码在 `loadURL` 之前缺少完整导航观测，并在 60 秒后错误展示 `about:blank`，造成白屏和审计断裂。
- 先前将 Magi 窗口自动创建描述为白屏根因或独立缺陷均缺少产品契约与当前窗口因果证据；`06f6feac42` 对该行为的删除已经恢复，不再把它列为修复成果。Renderer 配置顺序与 Service Worker 结论同样不得代替当前窗口证据。

- [-] **Phase 3A: 主导航断点闭环 (P0)**
  - **行动**: 在调用 `loadURL` 前安装主帧导航、重定向、提交、DOM、加载失败和控制台首错记录；删除通用 `ready-to-show` 与 60 秒强制展示 `about:blank` 路径；超时时显示包含目标 URL、当前 URL和阶段的明确错误。
  - **验收标准**: 任一启动结果都能被归类为认证页就绪、App 就绪、主帧导航失败、Renderer 初始化失败或明确超时；不再出现没有地址与原因的白色主窗口。

### 2026-08-13 11:08 现场导航断点（`ui.windows.inspect` 实证）

通过 Supervisor `/ui-hosts/invoke` 调用在线 UI Host（`electron-15396-cff7c31121d3544b`）的 `ui.windows.inspect`，获取当前白屏窗口**第一手导航时间线**：

```
11:08:13.573  target-prepared      https://127.0.0.1:6806/stage/build/app/?v=1786619293573
11:08:13.587  load-requested       （currentWindow.loadURL 调用）
11:08:13.593  did-start-navigation （主帧导航开始）
11:09:13.582  renderer-ready-timeout（60 秒超时）
```

**此后无任何事件**：无 `did-frame-navigate`（主文档提交）、无 `dom-ready`、无 `did-finish-load`、无 `did-fail-load`、无 `did-fail-provisional-load`、无控制台错误、无渲染器崩溃。窗口 `url=null`（仍为初始 about:blank）、`renderer.state="loading"` 持续 60+ 秒。

**断点定位**：`loadURL` 后主帧开始导航，但**主文档请求卡在「已发出、未响应」阶段**——既未提交也未失败。已排除的候选（见本 TTT 既有结论，不得推翻）：代理（NetworkService 到 `127.0.0.1:6806` 有 Established 连接、到 `127.0.0.1:7890` 为零）、Service Worker（缓存实证排除）、TLS 证书（`setCertificateVerifyProc` 已放行 127.0.0.1 自签）、端口/协议（`https://127.0.0.1:6806` 与导航目标一致）、渲染层平台判定（webpack 注入 `__SFORGE_PLATFORM__="electron"`，`isBrowser=false`）。

**2026-08-13 11:16 错误尝试与纠正**：曾错误提出「session 代理劫持主帧请求」假设并实施 `setProxy` 回环 bypass 修改——该假设直接违反本 TTT 第 75 行「代理已排除」的既有结论。**该修改已撤销，main.js 恢复基线**。教训：动手前必须重读 TTT 既有排除结论，禁止重复已排除的候选。

**下一步（需运行时证据）**：由于代理、证书、端口、平台均已排除，导航挂起指向运行时网络栈行为。需捕获：主帧请求在 `webRequest.onBeforeRequest`/`onSendHeaders`/`onResponseStarted` 的触发情况、NetworkService 到 6806 的实际连接与 TLS 握手状态、以及 `did-start-navigation` 后是否伴随 `did-create-window`/`did-redirect-navigation`。这些需在 Electron 主进程内打点或在重启后抓取，属于独立调查节点。

### 2026-08-13 11:25 诊断增量 + 拦截器健壮性修复

- **[`main-navigation-diagnostics.js`](app/electron/main-navigation-diagnostics.js) 增加 webRequest 阶段打点**：`state.webRequestTimeline` 记录主帧（targetOrigin 匹配）请求的 `on-before-request`/`on-before-send-headers`/`on-headers-received`/`on-response-started`/`on-completed`/`on-error-occurred`。重启后 `ui.windows.inspect` 的 `startup.webRequestTimeline` 可直接区分：请求未发出 / 到达内核但响应未回 / 被拦截器卡住 / 请求失败。
- **[`main.js`](app/electron/main.js:1108) webRequest 拦截器健壮性修复**：`onBeforeSendHeaders`/`onHeadersReceived` 回调增加 try/catch + `responseHeaders` 判空。原实现若 `details.responseHeaders` 为 undefined 会在主进程回调抛错且不调用 `cb`，导致请求永久挂起且无 `did-fail-load`（与白屏吻合）；修复后任何异常都放行请求并记日志。
- **验证要求**：需重启 `pnpm forge` 使 Electron 重新加载；若白屏复现，读取新 `startup.webRequestTimeline` 定位请求停在哪一环。

### 2026-08-13 17:18 启动日志逐条根因分析（`pnpm forge` 报错现场）

用户提供 `pnpm forge` 启动日志，共 6 条关键记录，逐条确认来源与因果：

1. `E rhy.go:81: get version info failed: TLS handshake timeout`（17:18:39）
   - 来源: [`kernel/util/rhy.go`](kernel/util/rhy.go:74) 的 `getRhyResult0()`，由 6 小时一次的 `RefreshRhyResultJob`（[`kernel/job/cron.go`](kernel/job/cron.go:35)）异步触发，请求 `https://siyuan-sync.b3logfile.com/apis/siyuan/version?ver=3.7.3`。
   - 根因: 当时外部网络到 b3log 云端的 TLS 握手受限（超时）。
   - 因果: **与 Electron 白屏无关**。该调用运行在独立 goroutine（singleflight 包装），失败只影响云端版本/集市哈希缓存，不阻塞内核启动。日志末尾 17:18:50-52 gse 词典正常加载即内核继续启动的旁证。
2. `I dominance.go:216: 行动计划中选`（17:18:46）: 内核 agent 决策日志，属正常启动过程，与本次报错无因果。
3. `[forge] Electron main interface launch failed: Electron main interface did not confirm readiness within 60000ms`
   - 来源: [`app/scripts/forge-electron-launcher.js`](app/scripts/forge-electron-launcher.js:128) 的 `createLaunchAcknowledgement` 60 秒计时器（launcher 侧）。
   - 根因: Electron 主进程在 60 秒内未向 ack 服务器回执 `siyuan-ready-to-show`（认证页或 App bundle 均未就绪）。
4. `siyuan-ready-to-show timeout, force showing main window`
   - 来源: [`app/electron/main.js`](app/electron/main.js:1209) 的 `readyToShowTimeout` 兜底（main.js 侧），与第 3 条同源（同一个就绪未达成），此时强制显示主窗口。
5. `Forge launch acknowledgement failed: connect ECONNREFUSED 127.0.0.1:51106`
   - 来源: [`app/electron/main.js`](app/electron/main.js:125) 的 `acknowledgeForgeLaunch` 失败 catch，POST 到 launcher 创建的 ack 服务器 `http://127.0.0.1:51106/ready`。
   - 根因: **双 60 秒超时竞态**。launcher 侧超时先触发（spawn 前即创建 ack 服务器，计时起点更早），随后在 [`forge-electron-launcher.js`](app/scripts/forge-electron-launcher.js:337) 的 `finally` 中执行 `ready.close()` 关闭 51106 服务器；main.js 侧超时晚一步触发，再发 `{state:"rejected"}` 时端口已关闭 → `ECONNREFUSED`。该 ack 丢失使 Supervisor 无法获知 Electron 的 rejected 结论，但 Electron 本身已尽力显示窗口，与白屏无因果。
6. gse 词典加载（17:18:50-52）: 内核正常启动的独立日志。

结论:
- 白屏主断点仍是 TTT 已记录的「`loadURL` 已调用但主帧无提交/完成/失败事件」（`app/electron/main.js` 1087 行 `net.fetch(getNetwork)` → `loadMainURL` 链的导航长期 pending），本日志未推翻该结论，`siyuan-ready-to-show` 未回执是白屏的下游表现而非根因。
- 新增一个**独立代码缺陷**（P2 候选）: launcher 与 main.js 各持有独立的 60 秒就绪超时且 ack 服务器生命周期由 launcher 独占，双超时存在竞态导致 ECONNREFUSED。即使白屏修复，该竞态依然存在；建议将 ack 服务器关闭延迟到进程退出或由 main.js 单方面声明 rejected 后 launcher 再收尾。

### Phase 1 当前证据 (2026-08-13 12:28)

- 隔离 Electron 主进程 PID `32728` 附着当前 6806 Kernel，主文档最终 URL 为 `/check-auth?to=/stage/build/app/`；DOM `readyState=complete`、认证输入框聚焦、Renderer 未崩溃、无失败请求或页面异常。
- 认证页运行域中 `require`、`require("electron")`、`ipcRenderer` 与 `ipcRenderer.send` 均真实存在；采集时主进程 `siyuan-ready-to-show` 监听数量已回到 `0`，证明一次性就绪监听已由认证页消息消费并清理。
- 同一次隔离启动产生第二个 `/check-auth?to=/stage/build/magi-app/` 窗口；它可见且位于前台，主 `/stage/build/app/` 窗口已最小化。这只能描述该隔离实例的窗口状态，既没有证明当前真实白屏由此产生，也没有证明原有自动创建行为违反产品契约。
- `06f6feac42` 在上述证据不足的情况下删除了 `ready-to-show` 中的 `createOrShowMagiWindow(currentWindow)`，并以“最小修复”记录。该删除现已恢复，相关测试名称中暗示“不打开其他界面”的错误断言也已移除。

### Phase 2 当前证据 (2026-08-13 12:44)

- 使用持久认证隔离会话启动 `electron/main.js` 后进入 `/stage/build/app/`；此结果仅用于验证修改后的代码路径，不代表当前 PID `4912` 已加载修复。
- App DOM 已完整渲染：存在 `#toolbar` 与 `#layouts`，正文长度 `594922`，页面标题为真实工作空间文档标题；采集期间没有 `pageerror`、主文档失败或第二个 Magi 窗口。
- 继续审计 Renderer 启动链时确认独立竞态：构造器末尾原先立即调用首次 `setNoteBook()`，而 `/api/notebook/lsNotebooks` 响应会通过 `getSiyuanConfig()` 写 `config.fileTree.boxDocEnabled`；该响应先于 `/api/system/getConf` 时会以配置未初始化异常中止 Renderer。
- 最小修复保持两次刷新语义不变，只把首次刷新移动到 `window.siyuan.config = config` 之后；后续带回调的权威刷新仍负责进入 `onGetConfig`。
- 已增加真实乱序回归：测试让 `/api/notebook/lsNotebooks` 回调在请求函数内同步返回，确认回调读取配置前 `/api/system/getConf` 的结果已经注入，并验证笔记本集合与 `boxDocEnabled` 均由真实领域处理器更新。
- 聚焦 Vitest 共 `7/7` 通过：`installAppConfiguration.test.ts`、`getSiyuanConfig.environment.test.ts`、`notebookStore.runtime.test.ts`；主窗口展示 Node 测试 `4/4` 通过；`node --check` 与 `git diff --check` 通过。
- 现有 Supervisor PID `34424`、Kernel PID `22144`、Electron 主进程 PID `4912`、Renderer PID `32200` 在验证后仍在线；当前主进程仍是修改前启动的版本，未重载。
- 新 `stage/build/app` 产物已由现有构建监听更新，入口引用 `main.069cfb14209dc4bef966.js`，该产物包含配置顺序修复；未手工执行构建。
- 隔离认证矩阵的正确契约是：未认证会话必须停留在 `/check-auth`；提交正确密码后进入 App；仅勾选 `rememberMe` 的既有认证会话再次启动时才可直接进入 App。此前第二次启动复用了已认证会话，不代表绕过锁屏认证。
- 隔离实例的截图、DOM 和机器判定只保留为诊断材料，不计入 Phase 3 当前主窗口验收。
- Supervisor 已注册 PID `4912` 的 Electron UI Host：`electron-4912-2ca9e03efdadb020`，状态 `online`，能力为 `ui.windows.inspect`。通过现有 Kernel -> Supervisor -> Electron 控制链读取到工作空间窗口 `id=2`：`url=null`、`loading=true`、`didFinishLoadAt=null`、`rendererReadyAt=null`、`lastLoadFailure=null`，而 `loadRequestedAt=2026-08-13T03:06:56.742Z`；这证明主进程已经调用首个 `loadURL`，但导航长期 pending，认证页和 App 均未提交。
- 2026-08-13 用户提供的当前真实窗口截图仍停留在启动页底部“v3.7.3 即将完成启动...”，与上述窗口状态一致；普通浏览器或隔离 Electron 截图不作为该窗口验收。
- 只读进程核对确认 PID `4912` 的真实命令行为 `electron.exe app/electron/main.js --workspace=... --port=6806 --attach-kernel=true`，不是 `desktop` 入口；Supervisor、Kernel、主进程和 Renderer 均保持原进程在线。
- 只读连接核对确认 Electron NetworkService PID `29988` 只有两条到 `127.0.0.1:6806` 的 `Established` 连接，到本地代理 `127.0.0.1:7890` 的连接为零；`7890` 的监听进程为 `verge-mihomo-alpha.exe`。因此本地代理未参与当前导航，不能把代理规则作为本次白屏原因或修复依据。

- [ ] **Phase 3: 真实 App 验收与收口 (P1)**
  - **背景**: 单元测试和隔离探针不等同于当前 Forge 主窗口验收。
  - **行动**: 只检查当前 PID `4912` 对应的真实主窗口；在用户明确确认重新加载时机后加载修复版本，核对认证页、认证提交、App 渲染和就绪回执。
  - **验收标准**: 未认证时真实主窗口停留认证页；认证成功后同一窗口进入完整 App；记住认证的既有会话可直接进入 App；Magi 窗口维持原有产品启动契约，不再用改变该行为掩盖白屏。

## 🟡 中期计划

- [ ] 将主窗口最终 URL、主文档标题和首个控制台异常纳入通用只读 UI Host 诊断能力，保持能力粒度独立。
- [ ] 为启动失败增加结构化本地日志，区分导航、认证、资源加载和 App 初始化。

## 🔴 远期计划

- [ ] 建立 Windows/macOS/Linux 的 Electron 启动矩阵，覆盖启用访问密码、会话过期和外部 Kernel attach。

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，必须剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充证据**：每次状态变化记录对应文件、命令结果、运行版本和残余风险。
3. **保持单点进行**：同一时间只允许一个 `[-]` 条目，未满足验收标准不得标记完成。
4. **保留现场边界**：重启、关闭、重新加载现有进程必须先说明影响范围并等待用户决定时机。

## 🏁 已归档/已完成

- [x] **Phase 2: Renderer 配置顺序修复与聚焦回归** [已完成 2026-08-13，非白屏根因闭环]
  - **完成情况**: 恢复配置先于笔记本响应的启动契约；同步回调回归和隔离 Electron 代码路径检查通过。无依据删除 Magi 自动创建的改动已从本节点撤销，不计入任何完成成果。这些结果不证明当前真实主窗口白屏已修复。
  - **成果文件**: `app/electron/main-window-presentation.js`、`app/test/electron-main-window-presentation.test.js`、`app/src/boot/installAppConfiguration.ts`、`app/test/boot/installAppConfiguration.test.ts`、`app/src/util/siyuanEnvironments/getSiyuanConfig.environment.ts`、`app/test/util/siyuanEnvironments/getSiyuanConfig.environment.test.ts`。

- [x] **Phase 1: 隔离实例诊断** [已完成 2026-08-13，证据边界已纠正]
  - **完成情况**: 隔离 Electron 复现过双窗口遮蔽，并验证隔离 Profile 可进入完整 App；已保存该隔离实例的导航、DOM、控制台与截图。当前真实 Profile 的白屏现场由 Phase 3A 单独追踪。
  - **成果文件**: `.forge-runtime/diagnostics/electron-white-screen-probe.json`、`.forge-runtime/diagnostics/electron-white-screen-probe.png`、`app/electron/main.js`、`app/electron/main-window-presentation.js`。

- [x] **Phase 0: 入口与现场边界确认** [已完成 2026-08-13]
  - **完成情况**: 确认当前 Electron 主窗口使用 `/stage/build/app/`；Supervisor 与 Kernel 在线；主进程日志显示 60 秒就绪超时；无会话 App 请求重定向到认证页；未停止或重启任何现有进程。
  - **成果文件**: `app/electron/main.js`、`app/src/index.ts`、`app/stage/auth.html`、本 TTT。
