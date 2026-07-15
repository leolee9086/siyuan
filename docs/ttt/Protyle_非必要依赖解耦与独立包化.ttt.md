# Protyle 独立入口、渐进式解耦与包化执行跟踪（TikTocTak）

> **最终目标**：将 Protyle 演进为仅硬依赖思源核心协议和浏览器标准能力的富文本编辑器标准模块，并提供可被其他应用直接挂载的微前端入口。
> **当前目标**：先建立可运行的 `protyle-app` 独立入口。独立入口既是第一项交付，也是后续所有渐进式解耦工作的持续验收基线。
> **下一步任务**：在入口基线稳定后，优先压缩 Protyle 对非必要宿主模块的直接静态导入，并建立可复用的本地 RPC/宿主能力边界。
> **领域约束**：Siyuan Kernel API、事务格式、块 DOM 和 WebSocket 推送协议是 Protyle 的领域核心，不属于去耦对象。
> **最终量化指标**：核心包内 `window.siyuan` 直接访问为 `0`；对 `layout/menus/dialog/editor/mobile/plugin` 等宿主模块的直接静态导入为 `0`；独立入口仅传挂载点和块 ID 即可工作。

---

## 1. 核心判断

独立入口必须前置，原因如下：

1. 当前 Protyle 的真实依赖主要隐藏在模块加载、构造、首次渲染、首次输入和 WebSocket 回调中，仅靠静态依赖图无法证明可运行。
2. 没有独立入口时，每次解耦只能依赖完整思源应用回归，无法判断某项依赖是否属于编辑器核心。
3. 独立入口可以先通过有台账的兼容垫片运行，再逐项将垫片替换为显式 Port；每删除一项垫片都能立即验收。
4. 入口必须直接消费当前 `app/src/protyle`，不能复制实现，也不在当前阶段移动源码目录。复制或搬迁都会增加跟进上游更新的成本。

首个入口不是最终包，也不要求首轮消除全部全局依赖。它的职责是建立最短编辑闭环和可测量的迁移抓手。

---

## 2. 不变量与非目标

### 2.1 必须保持的不变量

- 文档内容由思源核心加载和保存，前端不直接读写 `.sy` 文件。
- 编辑操作继续使用现有 Operations 和 `/api/transactions` 语义。
- 多实例、多窗口和多端修改继续由内核 WebSocket 推送协调。
- 主思源应用在迁移期继续使用同一套 Protyle 实现。
- `destroy()` 后必须停止事件监听、事务提交和 WebSocket 重连。

### 2.2 当前非目标

- 不重写块编辑模型、选区算法或键盘语义。
- 不在首个入口中实现全部页签、布局、插件和移动端宿主行为。
- 不将内核 API 抽象成与思源无关的通用文档协议。
- 不在边界稳定前一次性搬迁约八万行 Protyle 源码。

---

## 3. 当前基线

基线采集日期：2026-07-14。统计排除 `.bak/.backup/.old/.remote` 等备份源码。

| 指标 | 当前值 | 最终目标 |
|---|---:|---:|
| `app/src/protyle` 文件 | 494 | 保持原目录并收敛逻辑边界 |
| 有效源码 | 463 个文件，约 82,508 行 | 不以减少功能代码为目标 |
| 跨出 Protyle 的静态导入 | 1,172 条，涉及 288 个文件 | 非白名单为 0 |
| `window.siyuan` 直接访问 | 873 处 | 核心包为 0 |
| 直接出现的内核 API 路径 | 92 个 | 保持协议兼容并集中传输层 |

跨目录依赖主要集中在 `util`、`constants`、`menus`、`platform`、`dialog`、`layout`、`block`、`editor`、`emoji` 和 `plugin`。后续以自动扫描脚本生成的 JSON 为唯一基线，避免不同统计口径混用。

---

## 4. 首个独立入口契约

### 4.1 最小调用

构建产物提供浏览器原生 ESM 入口。其他页面通过标准模块导入，对外最低要求为挂载点和块 ID：

```ts
import {mountStandaloneProtyle} from "/stage/build/protyle-app/protyle.js";

const editor = await mountStandaloneProtyle({
    target: document.querySelector("#editor"),
});
```

独立页面通过 `/stage/build/protyle-app/` 启动；传入 `blockId` 或 `?blockId=<id>` 时打开指定文档，未指定时调用核心日记接口打开当天日记。页面自身也使用上述 ESM 入口，不存在另一套初始化实现。`kernelBaseURL` 默认使用 `location.origin`；跨源内核地址和令牌属于后续显式配置，不进入首轮闭环。

### 4.2 首轮功能范围

首轮必须完成：

- 获取并显示指定文档。
- 未传入文档 ID 时获取并显示当天日记。
- 基础文本输入和格式工具栏。
- 通过 `/api/transactions` 保存修改。
- 接收当前 Protyle WebSocket 推送。
- 刷新后从内核恢复内容。
- 显示可诊断的启动和运行错误。
- 正确销毁编辑器实例。

首轮允许关闭：

- 面包屑、文档背景、块标和滚动定位。
- 主应用页签、大纲、反链和移动端空态联动。
- 插件注入和第三方宿主扩展。
- 重型图表渲染器的预加载。

### 4.3 启动顺序

1. 请求 `/api/system/getConf`。
2. 初始化最小运行时状态容器。
3. 加载语言、Emoji 和内核本地存储。
4. 加载默认主题、图标、Lute 和 `protyle-html`。
5. 注册最小 WebSocket 消息处理器。
6. 通过静态 ESM 依赖加载 Protyle；不得使用 `dynamic import`，模块初始化期依赖必须通过运行时准备顺序和显式适配器解决。
7. 创建编辑器并在 `after` 回调后进入 ready 状态。

---

## 5. 兼容垫片台账

独立入口首轮可以临时补齐下列字段，但每个字段必须有所有者、替代 Port 和删除阶段。禁止为通过运行测试而无记录地扩充成完整 `window.siyuan`。

| 临时字段或能力 | 当前用途 | 最终替代 | 删除阶段 |
|---|---|---|---|
| `config` | 编辑器、Markdown、主题和快捷键配置 | `RuntimeConfigPort` | Phase 3 |
| `languages` | 编辑器文案 | `I18nPort` | Phase 3 |
| `storage` | 滚动位置、最近代码语言等 UI 状态 | `StoragePort` | Phase 3 |
| `transactions` | 输入事务防抖队列 | `TransactionScheduler` | Phase 2 |
| `menus` | 浮动工具栏和上下文菜单容器 | `IProtyleMenuPort` | Phase 4 |
| `dialogs/blockPanels` | 遗留 UI 集合 | `HostUIPort` | Phase 4 |
| `Model handlers` | WebSocket 消息预处理 | `SyncPort` | Phase 2 |
| 最小 `App.plugins` | 构造和销毁时插件遍历 | `ExtensionPort` | Phase 4 |
| `LocalRpc/Application` | 宿主能力的请求-响应、中间件和生命周期 | `LocalRpcPort`（可承载完整 Koa Context） | Phase 2/4 |

垫片退出规则：某项能力完成 Port 迁移、主应用适配器回归、独立入口回归后，必须在同一阶段删除对应全局字段。

---

## 6. 目标架构

### 6.1 源码与入口结构

1. `app/src/protyle`
   - 保持现有位置，继续作为唯一 Protyle 实现，降低跟进上游更新和合并的成本。
   - 在目录内部逐步形成 `core/runtime/adapter/renderer` 等逻辑边界，但不以物理搬迁作为验收指标。
2. `app/src/protyle-standalone/index.ts`
   - 唯一公开 ESM 入口，导出异步挂载函数和稳定句柄。
3. `app/src/protyle-standalone/bootstrap.ts`
   - 独立准备内核运行环境，不调用主应用 `App` 启动链。
4. `app/src/protyle-standalone`
   - 同时承载独立页面；页面只通过公开 ESM 入口挂载，不直接访问 Protyle 内部实现。
5. `app/src/protyle/render`
   - 保持上游目录形态，在逻辑边界稳定后实现按需注册，不要求拆成独立包。

物理迁移到 `packages/*` 不属于本计划。未来只有在上游目录也形成稳定包边界，或发布流程明确要求独立仓库时，才另行立项评估。

### 6.2 运行时边界

- `KernelPort`：HTTP 请求、上传、认证和内核资源地址解析。
- `SyncPort`：WebSocket 连接、订阅、重连和推送路由。
- `RuntimeConfigPort`：编辑器和 Markdown 配置快照。
- `StoragePort`：非文档 UI 状态持久化。
- `I18nPort`：语言资源读取。
- `HostUIPort`：提示、确认框、菜单和浮层。
- `IProtyleMenuPort`：菜单容器、条目追加、显示、定位、全屏和销毁；Protyle 按协议调用，不依赖具体 `Menu` 类。
- `NavigationPort`：打开块、文档和外部链接。
- `ExtensionPort`：插件提供的工具栏、提示和生命周期钩子。
- `RendererRegistry`：可选渲染器注册与按需加载。
- `LocalRpcPort`：跨边界请求-响应、错误传播、取消、超时和宿主能力调用；允许直接使用完整 Koa Context，不要求当前阶段压缩为更小的上下文对象。

同一个内核地址应共享一个 `ProtyleRuntime`。运行时集中持有配置、Lute、HTTP 客户端、WebSocket、多实例事务调度和资源缓存；编辑器实例只持有 DOM、选区和局部交互状态。

### 6.3 本地 RPC 参考实现

SACAssetsManager 的 `02e3b4d47aa4414bd397a94d7daa1747a3cb45e6` 快照提供了比当前 `app/src/util/pathRouter` 更完整的本地请求模型，参考目录为 `src/utils/webKoa`：

- `Application` 提供 Koa 风格中间件、Context 创建、错误传播和真实 HTTP 入口。
- `Router` 提供路径匹配、路由分组和洋葱模型执行。
- `internalFetch` 在不经过网络的情况下构造请求上下文，直接调用同一套路由处理器，并支持 `AbortSignal`。
- 同一套路由可以在本地函数调用和真实 HTTP 请求之间复用，适合作为 Protyle 宿主能力的请求-响应基础。

当前阶段允许 Protyle 直接依赖完整 Koa Context。解耦目标不是缩减 Context，而是将 Protyle 对具体 `Application`/`Router` 实现的依赖收口到 `LocalRpcPort`，使主应用、独立页面和未来 iframe/Worker 宿主可以替换传输实现。RPC 合约仍需统一请求 ID、响应结构、错误序列化、超时、取消和生命周期语义。

参考代码已在 `D:\dev\SACAssetsManager-02e3b4d47aa4414bd397a94d7daa1747a3cb45e6` 以 detached worktree 形式检出；该目录独立于本地 `D:\dev\SACAssetsManager`，不得将参考代码合并回本地仓库。

### 6.4 高频 DOM 事件、核心路由与剩余状态空间

高频 DOM 事件不应全部直接进入事件总线。Protyle 应先在同步路径内完成状态提取和核心决策，再把未被核心消费的剩余状态委托给插件、tips 和外部模块：

```text
原生 DOM 事件
  -> 一次性提取 EditorEventSnapshot
  -> CaliburRouter 核心路由
  -> 核心命令 / DOM 更新 / 事务
  -> ResidualEvent 剩余状态空间
  -> 类型化事件 + delegationSignal
  -> 动作表 / tips / 插件
  -> LocalRpc 宿主能力调用
```

#### 6.4.1 核心同步阶段

- 原始 `KeyboardEvent`、`InputEvent`、`Range` 和 DOM 节点只在 Protyle 内部同步处理。
- 状态提取器一次性生成不可变的 `EditorEventSnapshot`，避免每个插件重复遍历 DOM。
- `CaliburRouter` 只负责 `EditorEventSnapshot -> CoreCommand | IGNORE` 的确定性路由，不负责插件发现、tips 渲染或宿主 UI。
- 核心处理可以调用 `preventDefault`、`stopPropagation` 和核心 `coreSignal.abort()`；外部模块默认不能反向修改已经完成的核心编辑语义。
- 当前 `keydown.list/unified` 的“状态提取 -> CaliburRouter -> executeCommand”模式作为后续其他键盘域的迁移模板。

建议的核心状态契约如下，具体字段按事件类型拆分，不把完整 DOM 结构暴露给外部：

```ts
interface EditorEventSnapshot {
    eventId: string;
    seq: number;
    type: "keydown" | "input" | "compositionend" | "click";
    editorId: string;
    rootId: string;
    blockId?: string;
    key?: string;
    modifiers?: Record<string, boolean>;
    selection: SelectionSnapshot;
    context: EditorContextSnapshot;
}

interface CoreDecision {
    handled: boolean;
    command?: string;
    preventedDefault: boolean;
    residual: boolean;
}
```

#### 6.4.2 剩余状态委托阶段

核心路由结束后生成 `ResidualEvent`，通过类型化事件发射给外部模块。默认传递规范化快照，而不是原始 DOM 事件：

```ts
interface ResidualEvent {
    snapshot: EditorEventSnapshot;
    core: CoreDecision;
    capabilities: readonly string[];
    delegationSignal: AbortSignal;
}
```

外部模块的职责分为三类：

1. **观察型事件**：记录、统计、同步状态或生成建议，不阻塞核心路径。
2. **tips 生成器**：接收快照后使用 `requestIdleCallback`、任务队列和 `signal` 延迟生成可选提示。
3. **动作表**：依据快照匹配候选动作，按优先级、来源和能力声明筛选；用户确认后通过 `LocalRpcPort` 执行真实行为。

动作表不是普通 EventBus。事件只负责广播“当前有一份剩余状态”，动作表负责描述“哪些行为可以处理该状态”，Local RPC 负责执行需要返回值、错误、取消或句柄的行为。

#### 6.4.3 Signal 与优先级

核心处理和外部委托必须使用不同的取消语义：

- `coreSignal`：只控制当前 Protyle 核心中间件链；核心命令完成时可以中止后续核心路由。
- `delegationSignal`：控制 tips、动作发现和异步 RPC；新事件、编辑器销毁或上下文失效时取消旧任务。

事件委托分为三个阶段：

1. `pre-core`：仅允许少量显式声明、受优先级和超时约束的扩展抢占核心事件。
2. `core`：Protyle 内部必须实时完成的编辑语义。
3. `post-core`：默认插件阶段，用于 tips、非核心菜单、统计和延迟动作。

默认插件只能进入 `post-core`。外部模块不得在该阶段直接调用原始事件的 `preventDefault` 或修改核心 DOM；需要改变编辑行为时，必须注册明确的核心动作或通过 RPC 请求宿主能力。

---

## 7. 执行阶段

### Phase 0：基础独立入口（P0，当前阶段）

- [x] 增加 `protyle-app` Webpack ESM 构建目标、独立 HTML 模板和启动脚本。[2026-07-14]
- [x] 实现 bootstrap，按固定顺序准备配置、语言、Emoji、存储、主题、图标和 Lute。[2026-07-14]
- [x] 通过标准模块导入当前 Protyle，并以最小 `App` 和最小渲染选项挂载。[2026-07-14]
- [x] 建立兼容垫片台账和启动错误面板。[2026-07-14]
- [x] 定义 `IProtyleMenuPort`，独立入口提供无主应用 `Menu` 依赖的 DOM 实现，并使用 Zod 在注册边界校验。[2026-07-14]
- [x] 建立独立 Vitest Playwright 浏览器测试层，菜单契约测试在 Chromium 通过。[2026-07-14]
- [x] 增加生产构建产物的原生 ESM 冒烟检查：Chromium 直接加载未经过 Vite 改写的 `protyle.js`，并验证 `mountStandaloneProtyle` 命名导出。[2026-07-14]
- [x] 连接真实思源核心完成独立入口编辑闭环冒烟检查：加载、输入、事务保存、刷新恢复和无 `blockId` 打开当天日记。[2026-07-15]
- [x] 将平台判断固定到构建目标，并把 Node/Electron 加载收口到浏览器可替换适配点；`protyle-app` 不再产生 `__non_webpack_require__` APIPlugin 警告。[2026-07-15]

验收标准：只启动思源核心、不启动主应用初始化流程时，独立 URL 能完成“加载文档 -> 输入 -> 内核保存 -> 刷新恢复”，并能接收同文档的事务广播。

### Phase 1：依赖基线自动化与负面门禁（P0）

- [ ] 扫描跨目录导入、全局访问、API 路径和构建体积，生成 JSON 与 Markdown。
- [ ] 在 CI 中禁止新增 `layout/menus/dialog/editor/mobile/plugin` 直接依赖。
- [ ] 门禁先以当前基线为上限，再随迁移逐步下调。
- [ ] `imports.ts` 只作为明确边界的聚合出口，不能用于隐藏未解决依赖。

验收标准：每次提交都能回答独立入口新增、删除或保留了哪些宿主依赖。

### Phase 1A：非必要静态导入压缩（P0，下一步）

- [ ] 生成 `app/src/protyle` 的直接静态导入矩阵，按导入数量、初始化副作用、入口可达性和运行时调用频率排序。
- [ ] 首批处理 `menus`、`dialog`、`layout`、`editor`、`mobile`、`plugin` 等非核心宿主依赖；保持 `app/src/protyle` 原目录，不复制或搬迁实现。
- [ ] 将菜单、弹窗、导航、插件生命周期和全局 UI 协调改为 `HostUIPort`、`NavigationPort`、`ExtensionPort` 或 `LocalRpcPort` 调用。
- [ ] `imports.ts` 只能作为明确的边界聚合出口，禁止用它隐藏未解决的直接导入。
- [ ] 保持静态模块加载，不以 `dynamic import` 作为解耦手段；构建目标通过静态入口和平台适配器隔离 Node/Electron 依赖。
- [ ] 定义并校验 `EditorEventSnapshot`、`CoreDecision` 和 `ResidualEvent`，禁止默认向外部模块广播原始 DOM 事件。
- [ ] 将高频键盘域按“状态提取 -> `CaliburRouter` -> 核心命令 -> 剩余状态委托”迁移，保留核心同步路径的实时性。
- [ ] 将核心 `coreSignal` 与外部 `delegationSignal` 分离；新事件、上下文失效和实例销毁必须取消过期 tips/动作任务。
- [ ] 建立动作表注册协议，支持优先级、匹配条件、能力声明、来源和取消；动作执行统一通过 `LocalRpcPort` 或核心命令入口完成。
- [ ] 默认插件只能注册 `post-core` 能力；`pre-core` 扩展必须显式声明抢占权限、优先级和超时。
- [ ] 每迁移一个依赖域，必须同时通过主应用和独立入口回归，并更新直接导入基线。

验收标准：非必要宿主模块的直接静态导入数量持续下降；独立入口不因缺失完整 App DOM 而加载失败；主应用行为和构建产物保持稳定。

### Phase 2：纯内核传输、事务和同步运行时（P0）

- [ ] 实现不依赖 UI 的 `KernelClient`，支持基础地址、认证、取消和结构化错误。
- [ ] 将 `fetchPost` 的消息展示和 Electron 行为移出传输核心。
- [ ] 抽出 `TransactionScheduler`，替代全局 `window.siyuan.transactions`。
- [ ] 实现按内核地址共享的 `SyncHub`，路由 reload、transactions、readonly 等编辑器消息。
- [ ] 明确重连、销毁和多实例订阅语义。

验收标准：独立入口不再依赖主应用 `Model` 和 `processMessage` 注册链，两个编辑器实例可同步编辑同一文档。

### Phase 3：配置、语言和存储去全局化（P0）

- [ ] 定义并注入 `RuntimeConfigPort`、`I18nPort` 和 `StoragePort`。
- [ ] 先迁移 Options、Lute、事务和加载文档路径，再按访问频率迁移其余模块。
- [ ] 区分内核文档状态、内核用户设置和宿主临时 UI 状态。
- [ ] 删除独立入口对应的 `config/languages/storage` 全局垫片。

验收标准：核心编辑闭环无 `window.siyuan.config/languages/storage` 直接访问，主应用行为保持一致。

### Phase 4：菜单、导航、布局和插件宿主化（P1）

- [ ] 将菜单、对话框、消息提示和浮层改由 `HostUIPort` 提供。
- [ ] 先将 `window.siyuan.menus.menu` 收口到 `IProtyleMenuPort`；独立入口提供 DOM 实现，思源宿主适配现有菜单实现。
- [ ] 使用 Zod 在菜单宿主注册时执行一次运行时校验，错误必须包含缺失能力的字段路径，避免问题延迟到具体交互中才暴露。
- [ ] 将打开文档、聚焦页签、大纲刷新和移动端空态移入思源适配器。
- [ ] 将 `App.plugins` 遍历改为 `ExtensionPort`。
- [ ] 对无宿主实现的能力提供明确禁用态，不允许静默空对象吞错。

验收标准：核心不再静态导入 `layout/menus/dialog/editor/mobile/plugin`，独立入口与主应用分别使用默认适配器和思源适配器。

### Phase 5：样式、图标和渲染器拆分（P1）

- [ ] 从 `base.scss` 提取 Protyle 基础样式、必要组件样式和 CSS 变量契约。
- [ ] 默认包提供基础可编辑样式，不携带布局、图谱、配置等应用样式。
- [ ] Lute、主题、图标和 `protyle-html` 统一由资源加载器管理。
- [ ] 重型渲染器使用注册表和动态加载，提供默认全功能预设。

验收标准：基础编辑入口不预加载 Mermaid/ECharts 等重型资源，样式不污染宿主页面。

### Phase 6：公共模块边界稳定化（P1）

- [ ] 提供异步 `createProtyle()`，替代直接调用当前同步构造器。
- [ ] 公共句柄仅暴露稳定生命周期和编辑命令，不暴露内部 `IProtyle`。
- [ ] 主应用和独立页面都通过同一个模块入口消费 Protyle，内部仍保留在 `app/src/protyle`。
- [ ] 输出稳定的 ESM、类型声明、CSS 和资源清单。

验收标准：外部项目可直接导入 ESM 入口并挂载；公开入口的依赖边界受自动门禁约束；上游 Protyle 更新仍可在原目录进行低冲突合并。

### Phase 7：微前端服务接口（P2）

- [ ] 提供轻 DOM Web Component，首阶段不使用 Shadow DOM，以兼容现有选区、浮层和主题机制。
- [ ] 保留独立页面形式，为需要 CSS 隔离的宿主提供 iframe 部署方式。
- [ ] 定义 `ready/dirty/saved/error/selection-change` 事件。
- [ ] 定义 `focus/reload/setBlock/destroy` 命令。

验收标准：非思源应用无需理解 Protyle 内部类型即可消费中心化同步和存储的编辑服务。

### Phase 8：发布、版本和生态（P2）

- [ ] 建立 Protyle 包与 Siyuan Kernel 的兼容矩阵和握手检查。
- [ ] 建立语义化版本、变更日志和迁移指南。
- [ ] 为渲染器和扩展 Port 建立第三方能力包规范。

---

## 8. 回归矩阵

每个阶段至少执行以下用例：

1. 加载文档、输入、插入块、删除块、刷新恢复。
2. 撤销、重做和连续输入事务合并。
3. 两个实例打开同一文档并互相接收修改。
4. 实例 A 销毁后不影响实例 B，且 A 不再重连或提交。
5. 块引用、搜索提示、代码块和粘贴的基础路径。
6. 上传、属性视图、嵌入块和可选渲染器的能力测试。
7. 桌面和移动视口布局。
8. 思源主应用页签、菜单、插件事件和移动端行为。
9. 核心路由消费事件后，外部模块不能改变已完成的核心编辑语义。
10. 新键盘/输入事件到来或编辑器销毁后，旧的 tips 和动作任务必须被 `delegationSignal` 取消。
11. `post-core` 动作可以延迟执行、失败或超时，不得阻塞核心输入；需要同步结果的动作必须通过 Local RPC 返回结构化结果。

---

## 9. 风险与控制

- **兼容垫片固化**：通过台账、删除阶段和 CI 全局访问上限控制。
- **入口能打开但不能保存**：首轮验收必须包含事务、刷新恢复和双实例同步，不能以首屏渲染作为完成标准。
- **大规模迁移回归**：按依赖域迁移，每个 PR 同时通过独立入口和主应用回归。
- **共享运行时串扰**：事务队列、WebSocket 订阅和资源缓存必须按内核地址与编辑器实例明确分区。
- **样式污染宿主**：稳定独立模块前先形成 CSS 变量契约和最小样式入口。
- **跨源认证复杂化**：首轮固定同源；跨源能力在 KernelPort 稳定后单独设计和验收。
- **RPC 语义漂移**：以 `webKoa` 的本地请求模型为参考，但统一请求 ID、错误、超时、取消和销毁语义，避免各宿主自行约定。
- **Node 依赖进入浏览器入口**：将 `Application` 的 HTTP `listen` 和 Node-only polyfill 与浏览器本地 RPC 核心分离，保持静态导入可构建。
- **外部事件拖慢核心输入**：核心路由只消费一次状态快照，外部事件默认异步调度并受时间预算、优先级和 `delegationSignal` 控制。
- **核心 Signal 与外部 Signal 语义混淆**：禁止用核心 `AbortController` 直接表示外部任务取消；两类 Signal 必须在契约中分开。
- **插件越权修改 DOM 或默认行为**：`post-core` 只接收规范化快照和能力声明，菜单、弹窗、导航等行为必须通过 Host Port 或 Local RPC 执行。

### Dialog 解耦门禁（当前阶段）

- Protyle 内部禁止直接导入 `app/src/dialog`、`app/src/dialog/message`、`app/src/dialog/confirmDialog`、`app/src/dialog/tooltip` 和 `app/src/asset/assetDialog`。
- Protyle 只依赖 `app/src/protyle/runtime/dialog.port.ts` 与 `dialog.types.ts`。`Dialog` 实例保留 `element`、`destroy`、`fullscreen`、`bindInput`、`listen` 等结构兼容能力，避免原版插件回调和现有 DOM 操作失效。
- 完整思源通过 `app/src/dialog/protyleDialogPort.factory.ts` 注册原版实现；独立入口通过 `IStandaloneProtyleOptions.dialog` 注入宿主实现，未注入时使用轻量 DOM 回退实现。
- 消息、确认框、Tooltip、资源选择器和 `moveResize` 均属于同一 Host UI Port；Protyle 业务只调用能力方法，不感知宿主的全局 DOM 容器、Vue 组件或窗口管理器。
- Dialog Port 必须静态导入。禁止以 `dynamic import` 作为解耦手段；主应用和独立入口分别在构建期确定宿主适配器。
- 兼容验收：主应用继续返回原版 Dialog 实例，插件可以继续使用 `dialog.element`、`destroyCallback` 和键盘确认；独立入口可以通过自定义 Port 替换默认弹窗，并且无 Dialog Port 时编辑器仍可加载和编辑。

---

## 10. 完成记录

- [x] 2026-03-04：建立 Protyle 非必要依赖解耦与独立包化长期任务。
- [x] 2026-07-14：重新采集当前依赖基线，确认采用“基础独立入口先行、持续驱动渐进式解耦”的实施顺序。
- [x] 2026-07-14：完成 `protyle.js` ESM 入口、独立 bootstrap、菜单能力协议、Zod 宿主校验和 Chromium 浏览器契约测试；待运行思源核心后执行完整编辑闭环冒烟测试。
- [x] 2026-07-15：确认下一阶段优先压缩非必要静态导入；允许 LocalRpc 使用完整 Koa Context，并将 SACAssetsManager 的 `webKoa` 作为本地 RPC 参考实现。
- [x] 2026-07-15：将 SACAssetsManager commit `02e3b4d47aa4414bd397a94d7daa1747a3cb45e6` 独立检出到 `D:\dev\SACAssetsManager-02e3b4d47aa4414bd397a94d7daa1747a3cb45e6`，未修改 `D:\dev\SACAssetsManager`。
- [x] 2026-07-15：确定高频事件采用“状态快照 -> CaliburRouter 核心路由 -> 剩余状态委托”模型；类型化事件承载通知，动作表/tips 承载延迟扩展，Local RPC 承载外部行为执行。
- [x] 2026-07-15：完成 Dialog Host Port：Protyle 全部 Dialog/confirm/message/Tooltip/资源选择触发改由类型化能力调用，完整 App 通过原版适配器注册，独立入口支持宿主注入和轻量 DOM 回退；移除 Protyle 内 Dialog 动态导入。
