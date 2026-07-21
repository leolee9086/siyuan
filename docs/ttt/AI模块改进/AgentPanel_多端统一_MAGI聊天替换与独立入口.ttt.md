# Agent Panel 多端统一、MAGI 聊天替换与独立入口（TikTocTak）

> **最终目标**：以唯一 Agent Panel 实现覆盖主应用 Dock、普通 Tab、非模态浮窗、MAGI 桌面/移动端 CHAT 和独立网页，并允许在同一面板中切换 MAGI 与普通 Agent 会话。
> **当前目标**：完成主应用 Dock、Tab、浮窗真实交互回归，以及 MAGI/普通 Agent 双向会话验证和最终多视口视觉验收。
> **下一步任务**：在最新主应用开发构建中验证 Dock 完整能力入口、普通 Tab 与浮窗三实例并存，然后补齐请求过期事件隔离测试。
> **完成条件**：全部宿主可正常打开和交互，自动化检查通过，桌面/移动端多视口截图达到专业可用标准。

---

## 1. 不变量

- `app/src/layout/dock/agent` 保持唯一聊天实现，MAGI 和独立入口只挂载该实现，不复制消息列表、Composer 或会话状态机。
- 主应用 Agent Dock 的会话、模型、推理强度、引用、工具、确认、问答、任务目录、通知、Tab 和浮窗能力保持完整。
- 每个 Dock、Tab、浮窗、MAGI 和独立页实例拥有独立 DOM、请求、Composer、监听器和销毁生命周期。
- 普通 Agent 与 MAGI 会话使用明确的 `targetKind` 隔离；旧会话缺省解释为 `native-agent`。
- MAGI 仅替换 CHAT 主聊天区；三贤人、Trinity Monitor、投票、来源模拟和 Channels 保持现有事件链路。
- 宿主能力采用细粒度 Port 组合，禁止建立同时承载菜单、Dialog、通知、布局和业务状态的聚合 Host Port。
- 每个 Port 只描述一种可独立复用的能力，面板通过能力是否存在决定动作是否显示。
- 独立入口不启动完整 App/Layout，仅加载同源 Kernel 配置、语言、主题、图标和聊天渲染运行时。
- MAGI 完整提示词、响应、事件载荷和审计正文默认写入独立日志通道；主日志和 CLI 仅显示关键生命周期摘要及必要错误信息。

## 2. 当前基线

- 唯一聊天实现仍由 `app/src/layout/dock/agent/AgentChat.ts` 承载，具体宿主行为已经迁入细粒度 capability 适配器；`AgentPanelController` 提供独立 DOM 挂载和生命周期句柄。
- Dock 已支持新会话、会话管理、模型、推理强度、发送/停止、工具卡片、确认/问答、任务目录、普通 Tab、非模态浮窗和最小化。
- MAGI CHAT 已挂载统一 `AgentPanelHost`；旧 `MagiMainPanel`、`MagiInputBar`、`mainPanelMessages` 和聊天缓存已删除，`useMagi` 只保留监控事件源。
- MAGI 已有 `StandardLLMAdapter`、Identity Access 和独立桌面/移动构建入口。
- Protyle 已提供 ESM 独立入口、最小运行时 bootstrap 和浏览器契约测试，可作为入口结构参考。
- 工作区已有 MAGI 后端改动；本任务与其协同演进，不覆盖或回退这些修改。

## 3. 目标边界

### 3.1 面板公开契约

```ts
type AgentPanelConversation =
    | {kind: "native-agent"; sessionId?: string}
    | {kind: "magi"; sessionId?: string};

interface AgentPanelHandle {
    openConversation(target: AgentPanelConversation): Promise<void>;
    getConversation(): AgentPanelConversation;
    refreshSessions(): Promise<void>;
    destroy(): void;
}
```

### 3.2 细粒度宿主能力

- `SettingsNavigationPort`：打开指定设置页。
- `IdentityAccessPort`：读取身份状态并打开身份登录入口。
- `PanelMenuPort`：创建、定位和销毁菜单。
- `PanelDialogPort`：确认、路径输入和面板 Dialog。
- `NotificationPort`：完成与错误通知。
- `EditorContextPort`：读取当前文档、焦点块、选中块和可见块快照。
- `PluginActionPort`：列举并执行当前宿主插件动作。
- `PanelFocusPort`：聚焦面板宿主。
- `DockVisibilityPort`：最小化或恢复 Dock。
- `PanelTabOpenPort`：请求创建普通 Tab 副本。
- `PanelFloatOpenPort`：请求创建非模态浮窗副本。
- `DirectoryPickerPort`：选择外部目录；Web 宿主可仅提供路径输入 Dialog。
- `ContentRenderPort`：Markdown/Lute 后处理与代码块增强。

各 Port 单独定义、单独注入、单独测试。`AgentPanelCapabilities` 仅为可选 Port 的只读集合，不包含业务逻辑，也不作为新的全能宿主接口。

### 3.3 会话目标适配器

- `NativeAgentTargetAdapter`：复用 `/api/ai/agent/*`、`SessionStore` 和原生 Agent SSE。
- `MagiTargetAdapter`：复用 `StandardLLMAdapter` 与 Identity Access，将结果规范化为面板事件。
- 两类 Adapter 共享会话加载、保存、删除、发送、中止和错误契约；目标专属能力通过 capability flags 表达。

## 4. 近期计划

- [x] **Phase 1：建立滚动 TTT 与基线**
  - [x] 登记现有宿主、功能清单和独立入口参考。
  - [x] 将细粒度 Port 作为架构不变量。
  - [x] 增加 Dock 能力注入、控制器生命周期和 MAGI 宿主生命周期公共契约测试。

- [ ] **Phase 2：建立可复用 Agent Panel 核心**
  - [x] 定义公开挂载、会话目标、能力集合和各细粒度 Port 类型。
  - [x] 将 AgentChat 的具体宿主行为迁入 App 适配器。
  - [x] 保持 Dock、Tab 和浮窗行为并补齐独立销毁测试。
  - [x] 将常驻 Dock 创建收口到细粒度 `createAgentDockModel`，确保 Dock 与副本分别获得对应宿主能力。

- [x] **Phase 3：MAGI 与普通 Agent 目标统一**
  - [x] 会话增加 `targetKind`，后端列表支持目标过滤并兼容旧数据。
  - [x] 接入 Native/MAGI 目标执行链路与目标选择器。
  - [x] 请求期间锁定目标、新会话和会话切换，并按目标、会话、中止及销毁状态隔离过期异步事件。

- [ ] **Phase 4：替换 MAGI CHAT**
  - [x] 在 MAGI Vue 生命周期内挂载统一面板，默认目标为 MAGI。
  - [x] 移除旧主聊天消息与输入状态，保留监控和来源模拟。
  - [x] 验证 MAGI 与普通 Agent 会话双向切换。
  - [ ] 使用已登录 Guardian Armor 完成 MAGI 多轮消息与刷新恢复验收。

- [x] **Phase 5：独立 ESM 与网页入口**
  - [x] 增加 `agent-app` 构建目标、模板、bootstrap 和公开挂载函数。
  - [x] 支持 `kind`、`sessionId` 查询参数及刷新恢复。
  - [x] 缺失宿主 Port 时隐藏相关动作并保持聊天闭环。

- [ ] **Phase 6：专业界面与多端验收**
  - [ ] 完成全视口、Dock、Tab、浮窗和移动端响应式样式。
  - [x] MAGI desktop/mobile 使用独立布局入口，移动端 CHAT/MONITOR 使用 Tab 切换。
  - [x] 移动 MONITOR 使用等半径四组六边形选择器，贤者内容区无 SVG 框架和卡片背景。
  - [x] MAGI 后端详细日志与主日志分离，高频事件静默落盘，CLI 仅保留轮次、共识、失败/取消和审慎决策摘要。
  - [x] Agent Panel 公共样式在桌面 `base.scss`、移动 `mobile.scss` 和独立入口中使用同一 `_ai_agent.scss`，不由控制器隐式加载宿主整套样式。
  - [ ] 补齐加载、空会话、零模型、错误和冲突状态；身份缺失状态已通过真实宿主验证。
  - [ ] 完成自动化、截图和真实交互验收。

## 5. 中期计划

- [ ] 将通用细粒度 Port 提升到共享 UI runtime，供其它 Dock 和独立面板复用。
- [ ] 为同一会话的多宿主视图增加更细粒度的同步与只读镜像提示。
- [ ] 建立 Agent Panel 公共契约版本与宿主兼容矩阵。

## 6. 远期计划

- [ ] 支持外部应用通过自定义 Kernel/身份/布局 Port 挂载 Agent Panel。
- [ ] 支持更多符合 Target Adapter 契约的 Agent 后端。

## 7. 验收矩阵

- 主应用桌面/Web Agent Dock 可打开并保持全部现有功能。
- 普通 Tab 与非模态浮窗可独立打开、交互和关闭。
- MAGI 桌面 `1280x720` 与移动端 `390x844` CHAT 可打开并切换 MAGI/普通 Agent。
- 独立页 `1440x900` 可通过 URL 和 ESM API 打开指定目标与会话。
- 浅色/深色主题下图标、Markdown、代码块、工具卡片和 Composer 正常渲染。
- 工具栏、消息、菜单、浮层和输入区无重叠、溢出和布局跳动。
- 销毁实例后无残留请求、WebSocket、定时器、观察器或窗口级监听。
- lint、目标单元测试、浏览器契约测试和多视口截图检查通过。

## 8. 风险与控制

- **宿主耦合扩散**：每种行为使用独立 Port，核心目录禁止直接导入 Layout、Dialog、Menu 和完整 App 实现。
- **功能弱化**：先锁定 Dock 回归基线，再逐项迁移；App 适配器始终注入完整能力集合；Agent 核心工具栏动作常显以支持鼠标、键盘和自动化访问，缺失 capability 的动作继续由 `fn__none` 隐藏。
- **会话串线**：所有异步结果携带目标和会话 ID，切换后仅当前请求可以写入界面。
- **双消息源**：MAGI CHAT 接线完成后移除旧 `mainPanelMessages` 写入链路。
- **独立入口膨胀**：入口只引入 Agent Panel、必要渲染器和运行时资源，不引入完整布局启动链。
- **过度统一**：Native SSE 的工具/确认/问答事件与 MAGI 标准 LLM 响应保留独立执行链路；仅共享请求身份、交互锁和公共消息呈现规则，不通过参数上下文强行合并差异逻辑。

## 9. 已归档/已完成

- [x] 2026-07-20：创建本滚动 TTT，冻结目标、基线、细粒度 Port 原则和验收矩阵。
- [x] 2026-07-21：完成移动端监控专用布局；CHAT/MONITOR 通过 Tab 切换，四个入口采用外细内粗双层六边形。
- [x] 2026-07-21：移动端贤者面板关闭共享 SVG 框架并保持透明背景；桌面端 `SeelPanel` 不受影响。
- [x] 2026-07-21：`390x844` 浏览器验收确认三位贤者到 Trinity 的中心距为 `88px / 87.82px / 87.82px`，完整名称无溢出，原生矩形焦点框已由六边形聚焦线替代。
- [x] 2026-07-21：`pnpm run build:magi-mobile` 通过，仅保留既有 bundle 体积警告。
- [x] 2026-07-21：删除旧 `MagiMainPanel`、`MagiInputBar`、`mainPanelMessages`、旧请求 pending 状态和聊天缓存；Avatar 草稿事件通过公共 `AgentPanelHandle.setDraft()` 写入统一 Composer。
- [x] 2026-07-21：MAGI Vue 卸载现在释放 websocket、重连定时器、EventBus 订阅和 Projector；异步初始化晚于卸载或初始化失败时同样走幂等清理路径。
- [x] 2026-07-21：`AgentPanelController.test.ts` 的草稿/会话委托、重复销毁和 ready 失败清理 3 项测试通过；独立 ESM 浏览器契约测试通过。
- [x] 2026-07-21：浏览器实测 `390x844` MAGI mobile CHAT/MONITOR、`1280x720` MAGI desktop CHAT 和 `1440x900` agent-app；统一面板均非空且无页面滚动溢出，桌面标题栏动作完整显示，独立页普通 Agent 到 MAGI 切换正常。
- [x] 2026-07-21：共享 `kernel/logging.FileLogger` 已承接主日志和独立组件日志的统一日期/大小分片、级别、并发与终端镜像能力，未在 MAGI 内复制文件日志实现。
- [x] 2026-07-21：MAGI 完整 WebSocket 载荷、安全审查、行动计划、审慎决策参数、前缀参数和 Forge 审计写入 `<workspace>/temp/magi/magi-YYYY-MM-DD[-N].log`，按日期和 `10 MiB` 大小分片；主日志不再输出正文，高频 chunk、LLM 请求、工具和上下文裁剪事件不生成 CLI 摘要。
- [x] 2026-07-21：`go test -race ./...`（`kernel/logging`）、`go test ./nerv/magi/websocket ./nerv/magi/observability ./nerv/magi/prefix`、`go test ./nerv/magi/coordinator -run '^$'` 和 `go test ./api -run '^$'` 通过；协调器全量测试另触发现有搜索环境未初始化崩溃，不属于本次日志调用链。
- [x] 2026-07-21：新增 `createAgentDockModel` 并由主 Dock 注册表使用；常驻 Dock 注入完整 App capability，普通 Tab/浮窗副本按目标 Tab 重建能力，避免裸构造导致动作被隐藏。
- [ ] 2026-07-21：最新 desktop bundle 已确认 Agent Dock 新会话、会话管理、Tab、浮窗和最小化动作 DOM 与 capability 完整；为消除仅悬停可达问题，Agent 专用工具栏动作已改为常显，待 watcher 更新后执行实际点击复验。
- [x] 2026-07-21：MAGI `AgentPanelHost` 的异步挂载、头像草稿转发和幂等销毁提取为独立生命周期工厂；依赖通过同目录 `imports.ts` 网关收口，Vue 宿主只持有 `ready/destroy` 最小句柄。
- [x] 2026-07-21：`dock.factory.test.ts`、`AgentPanelController.test.ts`、`AgentPanelHost.runtime.test.ts`、`useMagi.lifecycle.test.ts` 共 9 项测试通过，覆盖 Dock capability、副本能力、晚到实例销毁、引导失败清理、头像草稿积压转发以及 MAGI websocket/EventBus/Projector 幂等释放。
- [x] 2026-07-21：`dockModel.factory.ts`、`AgentPanelHostRuntime.factory.ts`、`AgentPanelHostRuntime.types.ts` 和目录依赖网关通过定向 ESLint；未使用 class、嵌套包装函数或规则豁免绕过架构约束。
- [x] 2026-07-21：新增可独立测试的 `isActiveAgentPanelRequest` 与 `applyAgentPanelInteractionLock`；Native SSE 在写入前统一核对目标、会话、中止和销毁状态，流式期间目标、新会话、会话菜单和列表切换均被锁定，停止后恢复。
- [x] 2026-07-21：请求身份守卫、交互锁、Dock 工厂、控制器、MAGI 宿主和 `useMagi` 生命周期共 6 个测试文件 12 项通过；请求守卫与交互锁模块通过定向 ESLint 和 `git diff --check`。
- [x] 2026-07-21：标准 LLM 适配器契约增加可选 `AbortSignal`，MAGI Agent Panel 的停止动作现在中止实际后端 `fetch`，不再只丢弃晚到回调；适配器契约测试验证信号透传。
- [x] 2026-07-21：Native SSE 与 MAGI 标准 LLM 保留各自适合的执行链路，共享边界限定为请求身份守卫和交互锁；相关 Adapter、请求隔离、生命周期与 Dock 测试累计 8 个文件 19 项通过。
- [x] 2026-07-21：最新主应用 desktop bundle 真实发送“Agent Panel 验收：请只回复 OK”；请求中目标、新会话和会话菜单进入锁定且停止按钮可见，约 3 秒后收到 `OK` 并恢复交互，会话标题自动生成。
- [x] 2026-07-21：结构化读取会话文件确认本轮真实交互以 `targetKind=native-agent` 落盘，用户消息、assistant `OK`、标题和更新时间完整；Dock 刷新按既有行为进入新会话，不作为最近会话恢复入口。
- [x] 2026-07-21：MAGI desktop 最新 bundle 确认统一面板数量为 1、旧聊天组件为 0、默认目标为 `magi`；切换到 `native-agent` 后真实发送并收到 `NATIVE OK`，模型控件和请求解锁正常。
- [x] 2026-07-21：从普通 Agent 切回 MAGI 后，身份缺失错误完整显示且交互恢复，宿主自动打开 `/stage/build/magi-identity/`；Identity Access 页面非空，`LOGIN & ACTIVATE` 入口存在。已登录 MAGI 多轮对话仍待具备有效 Guardian Armor 会话后验收。
- [x] 2026-07-21：独立入口调整为配置、语言、主题、图标和 Lute bootstrap 完成后再加载面板核心；懒加载控制器与浏览器 capability 通过单一 `panel-runtime` 入口合并，避免两个 5.54 MiB 重复 chunk。
- [x] 2026-07-21：`build:agent-app` 通过，初始 ESM 由 5.55 MiB 降至 6.76 KiB，核心保持单一 5.54 MiB chunk；独立入口目录网关通过定向 ESLint，ESM 浏览器契约测试通过且无语言字典提前求值警告，仅保留既有核心 chunk 体积警告。
