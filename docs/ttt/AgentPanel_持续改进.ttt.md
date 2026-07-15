# Agent Panel 持续改进与能力演进（TikTocTak）

> **目标**：持续改进 `app/src/layout/dock/agent` 的 Agent Panel，使它同时具备 Dock、非模态浮窗和普通 Tab 页签三种宿主形态，并保持会话、布局、插件和核心 Agent 协议兼容。
>
> **归属与关联**：本任务属于 [Layout 非必要依赖解耦与开放扩展](./Layout_非必要依赖解耦与开放扩展.ttt.md)。Agent Panel 的对话运行时和产品设计参考 [AI Agent 设计](./AIagent设计.ttt.md)；如果触及 Protyle 编辑器能力边界，再关联 [Protyle 非必要依赖解耦与独立包化](./Protyle_非必要依赖解耦与独立包化.ttt.md)。
>
> **维护方式**：这是随 Agent Panel 生命周期长期存在的标准 TTT，不因某一项功能完成而删除。完成项移动到文末归档，并保留实现文件、兼容边界和验证记录。

---

## 不变量与边界

- Agent Dock 仍是现有布局中的常驻入口；新增宿主形态不能搬移或破坏原 Dock 的 `panelElement`。
- Dock、浮窗和 Tab 必须拥有独立 DOM、事件监听、编辑器/Composer 状态和销毁生命周期；禁止用 `cloneNode` 冒充可交互副本。
- Agent 会话以 `SessionStore` 和核心 Agent API 为事实来源；不同宿主打开同一会话时必须明确采用“独立副本”还是“同一实例视图”，不能隐式共享可变数组。
- 浮窗继续使用布局的类型化 Tab 浮窗 Port；Tab 页签能力应使用独立的布局能力/事件协议，不能把“打开为 Tab”错误复用为 Dialog 浮窗。
- 原有 Tab、Dock、布局 JSON、插件句柄和 Agent Session API 保持兼容；不使用动态 `import` 作为能力隔离手段。
- 关闭副本只释放副本资源，不关闭原 Dock；原 Dock 关闭也不能误销毁已经独立打开的 Tab/浮窗副本。

## 当前基线

- 生产实现：`app/src/layout/dock/agent/AgentChat.ts`。
- Agent Dock 标题栏已经提供新会话、会话管理、非模态浮窗和最小化动作。
- Agent Dock 右键菜单已经通过 `requestOpenTabAsDialog` 提供浮窗副本入口。
- `app/src/layout/tabFloat.app.factory.ts` 已注册 AgentChat 副本工厂；副本使用独立 `Tab`、独立 DOM 和独立 AgentChat，并挂载到非模态 Dialog。
- `app/src/layout/dock/agent/tabFloat.factory.ts` 负责 AgentChat 的浮窗副本创建和销毁；后续 Tab 页签能力应提取可复用的会话副本创建逻辑，避免再复制一套初始化流程。

## 近期计划

- [ ] **Agent Dock 增加“在 Tab 页签中打开”能力**
  - **背景**：当前 Agent Panel 可以作为 Dock 和非模态浮窗使用，但缺少标准布局 Tab 宿主；用户无法把 Agent 工作区放入正常页签区，与文档编辑器并列使用。
  - **协议设计**：在 Layout 层定义独立的 Dock-to-Tab 能力请求（建议包含稳定 Dock/Tab 句柄、来源、会话 ID 和打开策略），必要时提供类型化请求事件作为无宿主回退；不要直接从 AgentChat 导入 `Wnd/Layout` 具体实现。
  - **副本语义**：默认创建独立的普通 `Tab` 和独立 `AgentChat`，原 Agent Dock 保持可见且可继续使用；副本从 `SessionStore` 加载一致的会话快照，后续输入、流式响应和关闭均拥有独立生命周期。
  - **布局接入**：由完整 App 的布局适配器创建或激活普通 `Wnd/Tab`，挂载副本 `panelElement`，正确设置标题、图标、激活状态和关闭回收；不把临时 Tab 直接塞进 Dialog，也不移动原 Dock DOM。
  - **入口**：在 Agent Dock 标题栏和右键菜单复用同一类型化能力请求，增加“在 Tab 页签中打开”；浮窗副本中的入口是否隐藏或改为“转为 Tab”必须明确，不得递归创建不可管理的副本。
  - **持久化**：确定该 Tab 是普通可持久化页签还是临时页签。若作为普通 Tab，必须验证布局序列化/反序列化和重启恢复；若作为临时 Tab，必须在布局快照中明确排除并在关闭/切换时释放资源。
  - **失败回退**：宿主未声明能力时发出类型化事件或显示明确提示，不得静默搬移 Dock、复用原 DOM 或留下半初始化 Tab。
  - **验收**：从 Agent Dock 打开 Tab 后，原 Dock 仍可输入；Tab 可独立发送消息、切换会话、接收流式结果和关闭；关闭 Tab 不影响 Dock；布局和插件句柄无回归。
  - **验证**：增加 Layout/Agent 浏览器契约测试，覆盖能力请求、Tab 创建/激活、独立 DOM、会话快照、关闭清理、序列化策略和无宿主回退。

- [ ] **统一 Agent 宿主副本工厂**
  - 抽取 Dock、Dialog 浮窗和 Tab 页签共用的 Agent Session/Composer 初始化和销毁边界。
  - 为副本声明 `ready/create/dispose` 生命周期，禁止宿主直接操作 AgentChat 私有状态。
  - 验证 SessionStore 并发写入、流式会话互斥和副本关闭后的 WebSocket 重连保护。

- [ ] **补齐 Agent Panel 的宿主能力 Port**
  - 将布局激活、Tab 创建、窗口标题、通知、Dialog 和资源选择等行为通过可选能力注入。
  - 高频输入和流式状态留在 Agent 核心；跨边界行为使用类型化事件或 Local RPC，不让宿主 DOM 查询进入 AgentChat 核心。

## 中期计划

- [ ] 支持 Agent Panel 在多个普通 Tab 之间打开不同会话，并提供明确的会话锁定/冲突提示。
- [ ] 支持从 Tab/浮窗返回 Dock 或创建新的独立副本，统一关闭、最小化和激活语义。
- [ ] 为 Agent Panel 建立无 DOM 会话模型测试、DOM renderer 测试和真实浏览器端到端测试三层验证。
- [ ] 将 Agent Dock、Tab、浮窗的标题栏动作声明为可扩展能力菜单，减少 `AgentChat.initUI()` 中的固定分支。

## 远期计划

- [ ] Agent Panel 作为可由外部应用挂载的微前端工作区，宿主只提供布局、Dialog、存储和 Agent Kernel 能力。
- [ ] 为不同宿主提供一致的 `dock/tab/dialog` 生命周期事件、会话快照和错误协议。
- [ ] 建立 Agent Panel 与 Layout、Kernel Agent、Protyle 的版本兼容矩阵。

## 风险与控制

- **状态分裂**：所有副本必须通过 SessionStore/核心协议同步，禁止复制私有 DOM 状态作为事实来源。
- **布局污染**：临时 Tab 必须有明确序列化策略，不能把浮窗临时节点写入布局 JSON。
- **资源泄漏**：副本创建失败、Dialog/Tab 竞态关闭和宿主销毁都必须走同一个 `dispose` 边界。
- **能力漂移**：Tab、浮窗和 Dock 的打开动作必须共享类型化能力定义，不能在菜单、AgentChat 和布局适配器中各自实现一套。
- **输入阻塞**：宿主能力调用不得阻塞 Agent 流式渲染和 Composer 输入；需要等待结果的操作必须异步化并支持取消。

## 关联实现与文档

- [AgentChat 实现](../../app/src/layout/dock/agent/AgentChat.ts)
- [Agent 浮窗副本工厂](../../app/src/layout/dock/agent/tabFloat.factory.ts)
- [Layout Tab 浮窗适配器](../../app/src/layout/tabFloat.app.factory.ts)
- [Layout 浮窗解耦 TTT](./Layout_非必要依赖解耦与开放扩展.ttt.md)
- [AI Agent 设计 TTT](./AIagent设计.ttt.md)
- [Protyle 独立入口 TTT](./Protyle_非必要依赖解耦与独立包化.ttt.md)

## 已归档/已完成

- [x] 2026-07-15：Agent Dock 标题栏增加非模态浮窗入口；浮窗副本隐藏递归入口，并复用统一 Tab 浮窗 Port。
- [x] 2026-07-15：Tab/Dock 浮窗 Dialog 改为非模态，不渲染遮罩且不注册全局 Dialog 栈。
