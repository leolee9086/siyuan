# Layout 非必要依赖解耦与开放扩展（TikTocTak）

> **归属**：[Protyle 非必要依赖解耦与独立包化](./Protyle_非必要依赖解耦与独立包化.ttt.md)
>
> **最终目标**：将 `app/src/layout` 演进为可由宿主注入渲染、持久化、窗口交互和业务模型能力的布局模块。布局核心只维护稳定的布局树、窗口/页签状态和命令式变更，不直接依赖具体业务模型或全局 App DOM。
>
> **当前目标**：完成 layout 的依赖扫描，确定最突出的非必要耦合和违反开闭原则的位置；在不改变完整思源行为的前提下，先建立可增量迁移的模型注册、命令和生命周期边界。
>
> **参考基线**：`D:/dev/dockview-reference`，参考提交 `0eef758`。借鉴模型与 DOM 渲染分离、稳定 ID、命令式增删移激活 API、可销毁的类型化事件、分层序列化和宿主能力注入；不引入 dockview runtime。

---

## 维护规则

- 每次扫描或改动都记录文件、行号、行为影响和验证方式。
- 兼容完整思源优先：旧 `window.siyuan.layout`、插件页签和布局 JSON 在迁移期必须继续可用。
- 先抽象边界，再迁移实现；不以一次性重写 `Layout/Wnd/Tab` 为目标。
- 模型层测试应可在无 DOM 环境运行；DOM renderer 和浏览器回归单独测试。

## 兼容基线

- 原有 `layoutToJSON`/`JSONToLayout`、窗口模式布局 JSON 和旧版 `instance` 字段必须继续双向兼容。
- 插件拿到的 `Tab`、`Wnd`、`Model` 句柄和既有方法签名保持稳定；新增能力通过 Port 或事件叠加，不替换旧接口。
- “作为浮窗打开”指当前 Tab 作为思源 `Dialog` 浮层显示，不等同于 Electron 的“移动到新窗口”；原 `tabToWindow` 行为继续保留。
- 浮窗关闭时必须恢复当前 Tab 的原始 DOM 位置；如果 Tab 已被关闭，则只能清理浮窗内容，不能把已关闭页签重新插回布局。

## 当前基线

- `Layout`、`Wnd`、`Tab` 同时持有业务状态、DOM 节点、事件监听、尺寸调整和持久化副作用。
- `getAll.ts` 直接导入并通过 `instanceof` 分派所有内置模型，新增模型必须修改中央文件。
- 序列化/反序列化通过具体类和 `instance` 字符串集中分派，创建实例时直接调用具体构造器。
- `Model` 仍管理 WebSocket、重连和 `window.siyuan` 生命周期；本阶段只增加 `disposeConnection` 保护边界，供 Agent Dock 副本停止重连，完整 `SyncPort` 抽离仍留在后续阶段。

## 近期计划（Phase 0：扫描与契约）

- [x] **创建 layout 专属 TTT**
  - **结果**：建立本文件，作为 layout 解耦工作的独立追踪入口。

- [x] **完成第一轮耦合扫描**
  - **结果**：确认 `getAll.ts` 的具体模型集中分派、`Layout` 的模型-DOM-尺寸副作用混合、`Wnd/Tab` 的 App/DOM/持久化黏合是最高风险区域。

- [x] **补齐序列化/反序列化扩展点扫描**
  - **结果**：确认 serializer/handler 通过具体类和 `instance` 字符串集中分派，并在同一流程中恢复 DOM、创建模型和触发 App 副作用；已形成第一版迁移映射，下一步转为注册表协议设计。

- [x] **为所有 Tab 菜单增加 Dialog 浮窗入口**
  - **行动**：`menus/tab.ts` 通过 `requestOpenTabAsDialog` 调用布局能力，不直接依赖 Dialog；无适配器时发出 Zod 校验的 `tab-open-as-dialog-requested` 事件。
  - **结果**：所有 Tab 的右键菜单都出现现有本地化“在浮窗中打开”菜单项；原 Electron “移动到新窗口”菜单和序列化路径不变。通用搬移 DOM 的临时适配器已撤回，避免把“浮窗”错误实现为移动原 Tab。
  - **验证**：`app/test/browser/layout/tabFloat.browser.ts` 基础入口、宿主转发和拒绝回退共 3 个契约用例通过；`pnpm run build:app` 通过。

- [x] **Phase 2：从 Agent Dock 开始实现 Tab/Dock 副本浮窗**
  - **背景**：副本必须拥有独立 DOM、状态、事件监听、输入编辑器和销毁生命周期；不能使用 `panelElement` 搬移或 `cloneNode` 冒充可交互副本。
  - **行动**：新增 `layout/tabFloat.app.factory.ts`，完整 App 通过宿主 Port 调用模型副本工厂，创建临时 `Tab`、独立面板和模型，再挂载到 `Dialog`；原 Tab 的 `panelElement` 从不移动。AgentChat 增加 `ready/createFloatingCopy/destroy` 生命周期边界，并支持浮窗副本独立关闭。
  - **行动**：`Model` 增加可禁止自动重连的销毁协议，避免浮窗副本关闭后 WebSocket 重新连接；`requestOpenTabAsDialog` 在 Port 返回 `false` 时继续发出类型化请求事件。
  - **行动**：补齐 Agent Dock 实际右键路径 `menus/dock.ts` 的“在浮窗中打开”入口；菜单从 Dock 模型缓存或 Dock 布局树解析 Tab 句柄，避免依赖普通 Tab header 菜单。
  - **扩展**：Editor 和 AgentChat 已注册首批副本工厂；后续为 Search、Custom、Graph、Outline、Backlink、Files 等 Dock 按同一协议接入。无法安全复制的模型必须明确返回“不支持”，不能静默共享可变状态。
  - **验收**：Agent Dock 副本路径已实现；Editor 工厂已接入；原 Tab 保持可用；副本拥有独立 DOM、状态、编辑器、WebSocket 和销毁生命周期；关闭副本不改变原 Tab；布局 JSON 和插件句柄不发生变化。其余 Dock 当前明确返回未处理，等待各自副本协议。
  - **验证**：`pnpm run build:app` 通过；`test/browser/layout/tabFloat.browser.ts` 3 个 Port/事件契约用例通过；Agent Dock 右键菜单入口已接入；`git diff --check` 通过。

- [x] **修复 Editor Tab 浮窗静默无效，并统一副本能力分派（2026-07-15）**
  - **根因**：完整 App 的 Tab 浮窗 Port 只识别 AgentChat；Editor Tab 返回未处理且当时没有事件订阅者，因此菜单点击没有可见动作。
  - **行动**：新增 `layout/tabFloat.registry.ts` 和 `ILayoutTabFloatFactory`。Editor、AgentChat 在各自静态模块中注册 `canCreate/createTab/create/dispose` 能力；`tabFloat.app.factory.ts` 只负责通用 Dialog 容器、挂载目标 Tab、关闭回收和关闭动作转发，不再 `instanceof` 分派具体模型。
  - **Editor 语义**：Editor 工厂复用现有 `copyTab`，保留 rootID/blockID、Protyle action 和滚动位置兼容；浮窗始终使用新 `Tab`、新 `panelElement` 和新 Protyle，原 Tab 的布局树和 DOM 不移动。
  - **生命周期**：副本工厂返回统一 `ILayoutTabFloatCopy.dispose`；Dialog 销毁、创建失败和关闭竞态都走同一清理边界；Agent 的最小化动作通过 `setCloseHandler` 关闭当前 Dialog，不再切换原始 Dock。
  - **兼容边界**：浮窗能力仍通过 `ILayoutTabFloatPort` 注入；没有工厂的模型返回 `false`，由原有类型化请求事件继续委托宿主；Electron `tabToWindow`、布局序列化/反序列化和插件 Tab 句柄不变。
  - **验证**：`pnpm run build:app` 通过（main 入口约 6.41 MiB，common 4.21 MiB，vendors 2.15 MiB）；`pnpm run typecheck:protyle-contract` 通过；`test/browser/layout/tabFloat.browser.ts` 3/3 通过；`git diff --check` 通过。
  - **待浏览器验收**：在真实文档上验证 Editor 浮窗的加载、点击、输入、快捷键、标题编辑、关闭后 Protyle/WebSocket 清理；重点观察 detached Tab 没有 `Wnd` parent 时，搜索/定位/错误响应等低频路径是否需要进一步能力事件化。

- [ ] **定义布局核心最小协议**
  - **行动**：设计 `LayoutNode`、`WindowState`、`TabState`、`LayoutCommand`、`LayoutEvent` 和 `LayoutHostPort`，先只写类型与兼容适配，不替换现有实现。
  - **验收**：模型命令可脱离 DOM 描述 `add/remove/move/activate/split`，宿主能力为可选注入。

## 关键发现与优先级

### P0：`getAll.ts` 违反开闭原则并扩大传递性依赖

- 证据：`app/src/layout/getAll.ts:1-15` 直接导入 `Editor`、`Graph`、`Outline`、`Backlink`、`Asset`、`Search`、`Files`、`Bookmark`、`Tag`、`Custom`、`Forwardlink` 等具体模型。
- 证据：`app/src/layout/getAll.ts:105-159` 使用连续 `instanceof` 分支分类模型；`app/src/layout/getAll.ts:242-276` 再次使用另一套 `instanceof` 进行类型匹配。
- 证据：`app/src/layout/getAll.ts:31-81` 除布局树外还直接扫描移动端编辑器、Dialog 和 BlockPanel。
- 影响：新增一种 Tab/Model 必须修改导入、`IModels` 字段、分类分支、编辑器收集逻辑；layout 因此传递性拉入所有业务域，也让独立 Protyle 难以裁剪。
- 方向：引入模型/能力注册表。注册项提供稳定 `kind`、`getEditors`、`matches`、可选 serializer 和 renderer factory；`getAll` 只遍历节点并调用注册项。保留 `instanceof` 作为完整 App 兼容回退，迁移完成后删除具体导入。

### P0：`Layout` 同时承担布局树和 DOM/resize 渲染

- 证据：`app/src/layout/index.ts:67-105` 构造器创建 DOM、写入 CSS 类并初始化 children。
- 证据：`app/src/layout/index.ts:114-143`、`154-199` 的 `addLayout/addWnd` 同时修改 children、插入 DOM、设置 flex 尺寸、添加 resize、刷新 Tab 尺寸和设置 parent。
- 影响：布局命令无法在无 DOM 环境验证；插入失败路径仍执行 resize/parent 副作用，存在模型树与 DOM 不一致风险；任何渲染策略变化都要修改核心类。
- 方向：先抽出纯命令层和 `LayoutRendererPort`，让 `Layout` 只产生结构变更和事件；现有 DOM 行为放入兼容 renderer。命令成功后再由 renderer 应用 DOM 和 resize。

### P1：`Wnd` 是 App、DOM、Tab、持久化和窗口交互的黏合点

- 证据：`app/src/layout/Wnd.ts:35-110` 构造器读取 `window.siyuan`、拼接 `.layout__*` DOM 并绑定鼠标、粘贴和菜单行为。
- 证据：`app/src/layout/Wnd.ts:204-345` 关闭逻辑直接销毁具体模型、操作全局 blockPanels/storage/layout，并调用 `saveLayout`。
- 证据：`app/src/layout/Wnd.ts:384-467` 拆分/合并逻辑直接创建 `Layout`、操作 DOM resize 节点并调用 `resizeTabs`。
- 影响：Wnd 无法作为稳定的窗口模型复用；宿主 DOM、Electron/桌面配置和持久化策略变化都会迫使 Wnd 修改。
- 方向：拆分 `WndState`、`WndController` 和 `WndRenderer`；关闭、拆分、持久化改为类型化命令/事件，具体 App 行为由 `LayoutHostPort` 注入。

### P1：`Tab` 将内容模型、DOM、焦点和持久化绑定在一起

- 证据：`app/src/layout/Tab.ts:27-101` 创建页签 DOM 并绑定拖拽、全局 `window.siyuan.dragElement` 和文档级查询。
- 证据：`app/src/layout/Tab.ts:120-123` 通过全局 `.layout__wnd--active` DOM 查询判断焦点。
- 证据：`app/src/layout/Tab.ts:150-212` pin/unpin 和标题/图标更新直接修改 DOM 并调用 `saveLayout`。
- 影响：页签行为不可在不同 renderer 中复用；新增页签操作需要修改 Tab 本体，缺少命令注册点。
- 方向：稳定 `tabId` + `TabState`，以 `TabCommand` 和 `TabEvent` 表达 activate/pin/close/title-change；DOM header 由 renderer 管理，持久化由 host port 订阅事件。

### P1：序列化/反序列化是具体类注册的中央分派点

- 证据：`app/src/layout/layout-serialization.serializers.ts:1-18` 直接导入全部具体模型。
- 证据：`app/src/layout/layout-serialization.serializers.ts:45-80` 通过 `instanceof` 推断语言标识；`135-185` 为每个具体模型提供专用 serializer。
- 证据：`app/src/layout/layout-serialization.serializers.ts:188-264` 通过容器、面板、特殊模型三组 `instanceof` 分派。
- 证据：`app/src/layout/layout-deserialization.handlers.ts:55-187` 直接 `new Layout/Wnd/Tab` 及 `new Asset/Backlink/Bookmark/Files/Graph/Outline/Tag/Search`。
- 影响：新增模型必须改中央 serializer/handler；布局 JSON 恢复、DOM 样式恢复和模型创建副作用耦合在一起。
- 方向：引入 `LayoutModelDefinition` 注册表与版本化数据协议，序列化只处理状态，反序列化通过注册项 factory 创建模型；旧 `instance` 分派保留为兼容适配层。

### P1：布局核心缺少统一的类型化生命周期事件与销毁协议

- 证据：`app/src/layout/index.ts:67-199` 的 `Layout` 只有公开可变 `children/parent/element` 和增添方法，没有 `add/remove/move/activate/destroy` 事件；`app/src/layout/Wnd.ts:35-42` 和 `app/src/layout/Tab.ts` 也没有对外的可销毁事件流。
- 证据：当前实现把监听器直接绑定到具体 DOM 节点（`app/src/layout/Wnd.ts:72-147`、`app/src/layout/Tab.ts:47-101`），销毁路径分散在 `Wnd`、`Wnd.tabAction` 和各个 Dock 模型中。
- 影响：宿主无法只订阅“布局状态变化”而不依赖 DOM；插件和布局适配器容易持有已移除节点；新增行为只能继续在核心类中追加分支。
- dockview 对照：`packages/dockview-core/src/events.ts` 提供类型化 `Event/Emitter`，组件通过 `onDidAdd/onDidRemove/onDidActiveChange` 暴露事件，并在 `dispose` 时统一清理订阅。
- 方向：定义 `LayoutEvent`（`node-added/node-removed/node-moved/tab-activated/layout-changed/disposed`）和 `Disposable` 订阅返回值；先由兼容适配器从现有命令路径发射，后续再把 DOM 监听迁移到 renderer。

### P1：序列化模块直接绑定主应用 DOM、配置和存储

- 证据：`app/src/layout/layout-serialization.ts:98-116` 直接查询 `#barDock` 并读取具体 Dock 实例；`164-176` 在同一模块中决定 `sessionStorage` 或 `/api/system/setUILayout` 保存路径。
- 证据：`app/src/layout/layout-serialization.serializers.ts:28-59` 从 DOM class/style/client 尺寸推导布局状态，`95-107` 从 Tab header DOM 推导 pin/active 状态。
- 影响：布局快照无法在无 DOM 环境生成；改 CSS 或替换 renderer 会改变持久化数据；独立宿主必须伪造完整 App DOM 才能保存布局。
- 方向：把布局树状态（方向、尺寸、active、pin）作为模型真值；`LayoutSnapshotPort` 负责持久化，`LayoutRenderer` 只提供必要测量值，禁止序列化器自行查询全局 DOM/选择存储后端。

### P1：Tab 菜单把 Dialog 浮窗和 Electron 新窗口混为一个具体实现问题

- 证据：`app/src/menus/tab.ts:242-253` 原菜单只在 `isElectron` 时直接调用 `openNewWindow(tab)`；这条路径序列化 Tab 并移除原页签，语义是“移动到新窗口”，不是 Dialog 浮层。
- 影响：浏览器、独立宿主和插件无法获得统一的 Tab 浮窗入口；若直接复用 `openNewWindow`，会错误改变布局树和插件观察到的 Tab 生命周期。
- 当前边界：新增 `app/src/layout/tabFloat.types.ts`、`tabFloat.port.ts` 和 `tabFloat.events.factory.ts`。菜单只发出能力请求；外部宿主可以注册副本 Port 或订阅类型化事件。
- 兼容策略：不修改 `Tab`/`Wnd` 构造器和布局 JSON；当前阶段不搬移原 `panelElement`，由下一阶段的副本工厂创建独立内容。
- 后续：按 Dock 类型注册独立副本工厂，避免复杂 Model 对 `.layout__wnd` 祖先结构和共享可变状态产生隐式依赖；此项必须在插件和旧 JSON 回归覆盖后进行。

### P2：`Model` 混合同步传输和 App 生命周期

- 证据：`app/src/layout/Model.ts:19-81` 构造 WebSocket、重连、读取 `window.siyuan.config` 并销毁 Dialog。
- 影响：布局基础模型被同步实现和 App 全局状态绑住。
- 方向：后续抽出 `SyncPort`/`ModelLifecyclePort`；当前阶段只记录边界，不改写同步协议。

## 中期计划（Phase 1：兼容边界）

- [ ] **建立模型注册表**：先覆盖 Editor/Custom，保留旧分支回退；增加注册表单元测试。
- [x] **建立浮窗副本能力注册表**：覆盖 Editor/AgentChat，保留未注册模型的事件回退；后续 Dock 通过同一工厂协议接入。
- [ ] **建立布局命令与事件协议**：实现 add/remove/move/activate/split 的纯状态变更和可销毁事件订阅。
- [ ] **接入兼容 DOM renderer**：让现有 Layout/Wnd/Tab 行为通过 renderer/port 执行，保持完整 App 的 CSS、resize 和插件行为。
- [ ] **迁移序列化与反序列化**：按注册项分发，增加未知模型占位符，确保旧 JSON 可恢复。

## 远期计划（Phase 2：宿主能力化）

- [ ] 将菜单、窗口、持久化、同步、Dialog、插件和 Electron 行为全部变为可选 `LayoutHostPort` 能力。
- [ ] 为无 DOM 的布局核心增加模型级测试，为浏览器 renderer 增加独立 DOM/浏览器测试。
- [ ] 当全部调用方迁移完成后，移除 `getAll.ts`、序列化器和反序列化器中的具体模型直接导入。

## 已归档/已完成

- [x] 创建本 TTT 并记录 layout 第一轮扫描结果（2026-07-15）。
- [x] 增加所有 Tab 的 Dialog 浮窗菜单入口，并保留原序列化、反序列化和 Electron 新窗口兼容；通用副本工厂转入 Phase 2（2026-07-15）。
