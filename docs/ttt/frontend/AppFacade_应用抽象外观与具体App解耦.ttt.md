# AppFacade 应用抽象外观与具体 App 解耦（TikTocTak）

> **最终目标**：为完整应用建立带厂牌的 `AppFacade` 抽象外观，使下层模块只依赖稳定应用契约；具体 App 运行时仅出现在启动、工厂、注册和契约校验边界。
>
> **当前目标**：完成生产模块对具体 `App` class 的全量依赖迁移，使所有下层应用句柄统一通过带厂牌的 `AppFacade` 传递；Vue `App` 与三个平台组合根保持各自独立语义。
>
> **下一步任务**：继续把需要完整 App 身份的导航行为收口到 AppFacade 公共方法，并按循环图审计剩余组合根适配器；跨调用生命周期状态统一进入 SForge 注册表，不以工厂闭包保存 App 或可变状态。

---

## 不变量

- 下层模块依赖 `AppFacade`，不直接导入具体 `App` class。
- npm `siyuan@1.2.3` 的公开类型是插件生态和共享数据格式的外部兼容基线，不是临时脚手架或可选依赖；本地领域类型只能在保持可赋值兼容的前提下强化已初始化不变量。
- 具体 App 只在运行时创建、工厂装配、宿主注册和契约校验中出现。
- 类型依赖本身不作为问题；类型契约反向依赖具体实现的生产模块边界才需要消除。
- 不使用批量文本替换掩盖构造、生命周期、事件顺序或宿主行为差异。
- 不使用 `unknown`、宽泛对象或可选空能力掩盖尚未完成的应用契约；外部输入仍通过明确校验类型接入。
- 不按单个函数制造细碎 App 子接口；先从完整应用领域公共表面抽取一个领域根。
- `AppFacade` 的厂牌由应用装配边界创建，普通结构相同对象不自动获得应用身份。
- AppFacade 公共行为由桌面/移动具体 App 的实例方法实现；禁止用返回回调的工厂捕获 App 或可变状态来模拟公共方法。
- 跨调用、跨模块或需要 HMR/测试重置的状态由统一 Symbol 注册表拥有；无状态参数传递与同步实例调用不登记为状态。
- 契约校验文件可同时依赖抽象接口和具体实现，但该依赖只存在于测试/契约层。
- 生产代码中的应用初始化顺序、全局 `window.siyuan` 状态、WebSocket、插件注册和销毁语义保持不变。
- 新增测试统一放在 `app/test`，不将测试基础设施或契约校验引入 `app/src` 生产依赖图。
- 每完成一批迁移，必须同步运行专项测试、循环图检查和 `git diff --check`；循环图未净下降时不归档阶段。

## 关联任务

- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)：记录全图 SCC、简单环和 imports 网关约束。
- [前端上帝对象领域拆分](./前端上帝对象领域拆分.ttt.md)：记录 `App`、Editor、Layout 查询等上帝对象的领域拆分。

## 现状基线

- **2026-07-25**：`app/src/index.ts` 同时承载具体 `App` class、应用启动编排、主 WebSocket 处理和模块级 `new App()` 副作用。
- 基线扫描记录 `192` 个生产文件包含具体 `App` 导入，其中直接类型导入与直接运行时导入均已登记；`app.plugins/app.appId/app.eventBus` 共有 `125` 个成员使用点。
- 大量下层模块通过 `import type {App} from "../index"` 或经 `imports.ts` 间接获得具体 class 类型；这些模块的真实能力需求按插件集合、事件总线、模型宿主和初始化边界分组，迁移从完整应用领域根开始。
- 当前具体 `App` 公共表面至少包含 `plugins`、`appId`、`eventBus`，但调用方还通过该类型参与 Model、Tab、布局、窗口、插件和启动流程，因此不能仅按字段表面直接定义契约。
- 当前循环图基线：唯一 Tarjan SCC 为 `872`，Madge 简单环为 `1069`；后续每批以同一扫描方式比较净变化。
- `app/src/util/types/LooksLike.types.ts` 已接入 `StrictEqual` 与 `IsAssignable`；抽象类型模块独立 TypeScript 检查已通过。
- 上游类型基线使用 npm 包 `siyuan@1.2.3`，公开声明提供 `Plugin`、`EventBus` 及插件生态共享的数据结构；生产构建仅作 type-only 引用，但其契约约束是长期、强制且不可由本地玩具类型替代的。

## 目标架构

```text
下层业务模块 ───────────────> AppFacade
                                  ▲
                                  │
启动/注册边界 ──> AppRuntime ──> AppFacade 厂牌实例
                                  │
契约校验文件 ────────────────────┘
```

### 抽象外观

- 在低层类型模块定义完整 `AppFacadeShape` 与带唯一符号厂牌的 `AppFacade`。
- 厂牌表达“已由应用装配边界验证并创建的应用句柄”，不作为每个能力的独立小接口。
- `AppFacade` 只暴露经过盘点的应用公共领域表面；内部状态、实现细节和启动临时变量不进入契约。
- 已存在的稳定领域 Port 直接复用；缺少能力时从领域根补齐，不复制具体实现。

### 具体运行时

- 将现有 `App` 的具体初始化职责整理为 `AppRuntime` 或等价具体实现模块。
- 具体 App class 直接声明模块级 Symbol 厂牌并由独立契约文件验证；`createAppFacade()` 只服务于无状态夹具登记，不保存实例或运行时状态。
- `app/src/index.ts` 保留组合根职责，负责创建厂牌实例、启动应用和注册全局入口；下层模块不再从该文件取得具体 class 类型。
- 需要按标识查找的 App/宿主实例或跨调用生命周期数据进入统一注册表；不以组合根工厂返回的闭包承担状态所有权。
- 外部公共入口可以重新导出 `AppFacade` 类型，但内部模块直接引用低层契约文件，避免入口模块重新成为类型聚合点。

### 契约校验

- 在 `app/test/app/AppFacade.contract.test.ts` 中使用类型导入同时引用具体运行时和抽象契约。
- 使用 `StrictEqual`/`AssertStrictEqual` 对明确的应用公共表面执行双向校验：实现满足契约，契约覆盖预期领域表面。
- 比较范围排除框架继承成员、私有状态和启动专属实现细节，避免把实现细节伪装成应用能力。
- 契约文件不参与生产运行时装配，不向 `app/src` 引入具体 class 依赖。

## 分阶段计划

### Phase 1：依赖基线与能力清单

- [x] 枚举所有直接或经 `imports.ts` 间接依赖具体 `App` class 的生产模块。
- [x] 标记直接类型/运行时导入与初始化入口；构造、身份判断和全局初始化边界列入后续逐文件审计。
- [x] 统计 `plugins`、`appId`、`eventBus` 成员使用点，按应用领域根归档，不按单个函数制造接口。
- [x] 保存基线文件数量、SCC、简单环和专项测试结果。

### Phase 2：建立 AppFacade 与厂牌工厂

- [x] 新增低层 `AppFacade` 类型模块，定义泛型 `AppFacadeShape` 和唯一符号厂牌；`plugins` 与 `eventBus` 由抽象类型槽代入。
- [x] 明确厂牌创建与验证边界：模块级不可变 `Symbol` 作为厂牌键，`createAppFacade()` 幂等登记并保持对象身份。
- [ ] 整理 `AppRuntime` 具体实现边界，保持现有初始化、WebSocket 和全局状态顺序。
- [x] 新增 `createAppFacade()`，完成抽象形状到厂牌外观的同步装配函数；实际 AppRuntime 绑定留在入口拆分阶段。
- [x] 创建独立契约测试：使用 `InstanceLooksLike<typeof App, AppFacade<...>>` 双向严格校验具体 App 的完整公开实例表面，并使用 `IsAssignable` 检查本地 Plugin/EventBus 覆盖 `siyuan` 类型包的公开兼容表面；Asset/Files 的既有领域契约也在同一测试边界校验。

> 当前类型检查证据：`src/app/AppFacade.types.ts` 独立 `tsc --noEmit` 已通过；对契约测试入口执行 `tsc --noEmit` 在 `120s` 内未结束，原因是 `App` 类型导入牵引 `app/src/index.ts` 的完整入口图。具体实现兼容性不记录为通过，待运行时边界下沉后复核。

### Phase 3：组合根与基础模型迁移

- [x] 在 `layout/layout.types.ts` 建立布局领域根 `LayoutWindow`/`LayoutTab` 抽象，Outline 不再自行声明 Window/Tab Host 局部契约。
- [x] 将 `app/src/index.ts` 收缩为组合根，不再作为下层模块的具体 App 类型所有者。
- [x] 将 `Model`、布局、Tab、Window 和生命周期参数改为 `AppFacade` 或既有稳定宿主身份。
- [ ] 在实际初始化边界绑定 `AppRuntime`，向下传递已厂牌化的 `AppFacade`。
- [ ] 保持模型 WebSocket、重连、销毁和父子关系行为不变。
- [ ] 运行 Model/Layout/Tab 专项测试和循环图检查。

### Phase 4：编辑器、Protyle 与 Dock 迁移

- [x] Agent Panel 运行时、Composer、消息渲染器、前端动作注册表和 App 宿主 capability 适配器改用 `AppFacade`；Protyle/Tab/菜单具体实现仍保留在宿主组合边界。
- [x] 迁移 Editor、Protyle、BlockPanel、Dock、菜单、Dialog 和通知相关的其余具体 App 类型依赖。
- [ ] 复用已有完整领域契约；确需新能力时扩展 `AppFacade` 领域根或既有宿主 Port。
- [ ] 具体 `AppRuntime` 只在创建、注册和宿主适配器中出现。
- [ ] 验证编辑器上下文、布局查询、Tab/浮窗、Dialog 生命周期和工具栏行为。

### Phase 5：插件、集市、卡片与移动端迁移

- [x] 首批迁移 Plugin 生命周期、加载器、卸载器和菜单工厂；业务参数使用官方 `siyuan.Plugin`，本地 `Plugin` class 仅保留运行时构造/继承校验。
- [x] 迁移 Bazaar、Card、Onboarding、同步和移动端菜单/编辑器入口。
- [ ] 将插件 API 的应用参数改为稳定外观，保留需要真实插件身份的边界校验。
- [ ] 桌面和移动宿主分别提供完整外观适配，不用全局断点或可选空能力掩盖差异。
- [ ] 更新全局声明文件，消除对 `import("../index").App` 的下层反向类型依赖。

### Phase 6：契约收口与直接依赖清零

- [x] 扩展契约测试覆盖所有 AppFacade 公共成员和关键生命周期行为。
- [x] 审计生产目录中所有 `App` class 导入，保留初始化、工厂、注册和必要身份判断边界；静态门禁确认具体入口导入为零，Vue `App` 与组合根单独保留。
- [ ] 对项目自有 `implements` 逐个替换为独立契约校验，不进行无差别文本替换。
- [x] 确认具体类只存在于允许边界；类型导入不会被错误升级为运行时导入。
- [ ] 重新运行 Tarjan SCC、Madge 简单环、Node/Vitest/浏览器契约测试和类型检查。

### Phase 7：归档与持续门禁

- [ ] 将直接具体 App 依赖清单更新为零或明确登记的初始化边界。
- [ ] 将最终 SCC、简单环、测试、类型检查和 `git diff --check` 证据写入本 TTT。
- [ ] 将 `AppFacade` 契约测试纳入持续测试脚本和循环依赖检查前置门禁。
- [ ] 关联更新主循环解耦 TTT 与上帝对象 TTT，再归档本任务。

## 风险与控制

- **外观过窄**：先完成全量能力清单，再冻结 `AppFacadeShape`；契约测试发现遗漏后扩展领域根，不用空能力或 `unknown` 掩盖。
- **外观过宽**：不把所有 `AppRuntime` 内部字段暴露到外观；启动私有状态留在组合根或具体适配器。
- **厂牌伪造**：厂牌声明和创建入口集中管理，外部只接收 `AppFacade`，不直接构造带厂牌对象。
- **隐藏实现依赖**：契约文件允许双向类型依赖，生产模块禁止从契约网关反向导入具体 class。
- **行为漂移**：每个迁移阶段保留原有事件顺序、错误传播、全局状态和销毁生命周期专项测试。
- **形式解环**：只有 SCC 净下降、直接依赖审计通过且测试通过的批次才进入完成记录。
- **闭包状态漂移**：工厂闭包无法统一枚举、重置和审计跨调用状态；此类状态必须登记到统一注册表，普通事件回调仅可捕获一次调用所需的局部值。
- **测试位置污染**：契约测试全部位于 `app/test`，不在 `app/src` 新增测试文件或测试专用网关。

## 验收标准

- 下层生产模块对具体 `App` class 的直接依赖清零；保留项均属于初始化、工厂、注册或必要身份边界并有清单记录。
- `AppFacade` 作为完整应用领域根，带厂牌且由唯一装配工厂创建。
- `app/src/index.ts` 仅承担组合根职责，不作为下层具体类类型入口。
- 契约测试对实现公共表面与抽象契约执行双向校验。
- 项目自有实现类不再依赖 `implements` 作为唯一契约保证，契约校验文件全部位于 `app/test`。
- 迁移前后应用初始化、编辑器、布局、插件、桌面/移动宿主和销毁行为保持一致。
- 关联循环图的 SCC 数量和规模相对阶段基线净下降，未新增独立 SCC。
- Node、Vitest、浏览器契约测试、类型检查、循环依赖检查和 `git diff --check` 全部通过。
- 所有阶段状态、实现文件、测试证据和日期均已写入本 TTT。

## 已完成记录

- **2026-07-25**：创建本 TTT。确认 `app/src/index.ts` 同时承担具体 App class、启动组合根和全局副作用；确认后续任务以“下层模块消除具体 App 直接依赖”为主线，采用带厂牌的完整 `AppFacade` 领域根和独立契约校验文件推进。当前仅完成任务登记，未宣称任何迁移阶段完成。
- **2026-07-25**：完成 Phase 1 基线：`192` 个生产文件包含具体 `App` 导入，`app.plugins/app.appId/app.eventBus` 共 `125` 个成员使用点；唯一 SCC `872`，Madge 简单环 `1069`。新增 `AppFacadeShape`/厂牌类型和契约测试，`AppFacade` 运行时测试 `1/1` 通过；类型检查因入口图牵引在 `120s` 内未结束，Phase 2 工厂和入口拆分继续进行。
- **2026-07-25**：接入 `siyuan@1.2.3` 开发期类型包，AppFacade 默认插件/事件总线槽位使用上游 `Plugin`/`EventBus` 声明；新增 `IsAssignable` 兼容校验。模块级不可变 `Symbol` 纳入 `no-module-level-var` 精确豁免，并新增规则测试 `2/2`；抽象类型模块独立 TypeScript 检查通过。
- **2026-07-25**：首批解环迁移 `plugin/index.ts`：移除其对 `app/src/index.ts` 的运行时导入，改用 `AppFacade<Plugin, EventBus>`；完整 App 组合根附加厂牌字段。Madge 简单环 `1069 -> 1068`，唯一 SCC 保持 `872`；AppFacade 契约测试 `2/2`、模块级 Symbol 规则测试 `2/2` 通过。目标文件仅剩既有 `index.ts`/Plugin 超长文件与函数门禁，未计入本批新问题。类型全量检查待入口拆分后复核。
- **2026-07-25**：完成插件公开表面首批官方类型收口：`App.plugins`、`pluginHost`、加载器、卸载器和 after-load 生命周期参数统一使用 npm `siyuan.Plugin`；本地 `Plugin` class 仅保留构造与 `instanceof` 运行时用途，`app` 改为公开 `AppFacade`，`customBlockRenders.action` 与 Dock 工厂字段对齐官方声明；菜单工厂改用官方插件类型，不新增项目自有插件接口。契约测试 `2/2`、Node 测试 `138/138` 通过；受控入口 TypeScript 检查在 244 秒内仍未完成，全量检查曾因约 4GB 堆耗尽，暂不记录为通过。Madge 简单环本次扫描为 `1063`，相对本批开始的 `1068` 净下降 `5`，仍需 Tarjan 复核。
- **2026-07-25**：Agent Panel 运行时、Composer、消息渲染器、前端动作注册表及 App 宿主 capability 适配器的纯类型依赖改用 `AppFacade`；Protyle、Tab、菜单等具体实现仍留在宿主/工厂边界，未复制实现。Agent Panel Vitest `23/23` 文件、`67/67` 项通过，Node 回归 `138/138` 通过；Agent 域既有大文件规模和函数长度 lint 继续由上帝对象任务追踪。Madge 简单环进一步降至 `1058`，本批累计净下降 `10`。
- **2026-07-25**：继续迁移 MAGI 身份适配器、Asset 模型、Bazaar 入口和 onboarding 的应用参数为 `AppFacade`；具体 Dock/Tab/Protyle 仍由既有宿主实现负责。Agent/MAGI Vitest `23/23` 文件、`67/67` 项和 Node `138/138` 通过；受影响文件仅报告既有 `forEach`、函数长度和未使用变量门禁。Madge 简单环降至 `1054`，本批累计净下降 `14`。
- **2026-07-25**：将颜色工具 Dock 工厂和设置 Builder 的应用参数也切到 `AppFacade`，不引入新的能力子接口；完整 Node 回归和 Agent/MAGI 专项仍通过，Madge 简单环降至 `1052`，本批累计净下降 `16`。颜色初始化与设置 Builder 的文件规模/注释 lint 仍是既有门禁。
- **2026-07-25**：继续迁移 keymap、顶栏初始化和 Bookmark Dock 的应用参数为 `AppFacade`，其余具体模型仍在实现边界保留；Node 回归 `138/138` 通过，Madge 简单环降至 `1050`，本批累计净下降 `18`。
- **2026-07-25**：继续处理 class 领域根：Tag、Files、Outline、Graph 四个 Dock 模型改用 `Model<AppFacade, Tab>`，不改变 WebSocket、树和编辑器生命周期；Node 回归 `138/138` 通过，Madge 简单环降至 `1047`，本批累计净下降 `21`。
- **2026-07-25**：移除 Asset 与 Files 对 `implements` 的依赖，改由 `AppFacade.contract.test.ts` 使用 `IsAssignable` 校验 `IWindowHashModel`、`FilesEventHost` 和 `FilesDragContext`；没有新增接口或运行时包装，契约测试 `2/2`、Node `138/138`、`git diff --check` 通过，循环数保持 `1047`。
- **2026-07-25**：修正 Outline 的布局抽象边界：删除 `IOutlineWindowHost`/`IOutlineTabHost`，在 `layout/layout.types.ts` 建立 `LayoutWindow`/`LayoutTab` 领域根；`lifecycle/model.types.ts` 保留模型生命周期契约，`Tab` 的父窗口类型和 `Outline` 的模型父级改用布局抽象，`IOutlinePanel` 改为引用 `LayoutTab`，并新增 `app/test/layout/LayoutDomain.contract.test.ts` 使用 `IsAssignable` 校验 `Wnd`、`Tab`、`Outline`。专项 Vitest `3/3`、`typecheck:protyle-contract` 通过，`git diff --check` 通过；全量 TypeScript 入口检查 124 秒超时，`pnpm lint:cycles` 当前仍报告 1113 条历史/并行循环，未宣称循环阶段完成。
- **2026-07-25**：补正兼容校验对象：生产实际入口为 `app/src/layout/dock/outline/Outline.ts`，已将该活动 `Outline` class 的应用/页签参数改为 `AppFacade`/`LayoutTab`，移除 `implements IOutlinePanel`，测试现在直接用 `IsAssignable<Outline, IOutlinePanel>` 校验活动类；旧版 `dock/Outline.ts` 同步复用布局抽象。专项契约测试仍为 `3/3` 通过。
- **2026-07-25**：完成活动 Outline 的具体类边切断后重新扫描：Madge 处理 `2175` 个文件，简单环 `1113 -> 1111`；项目循环检查仍失败于剩余应用级入口环，未将其误记为全局完成。
- **2026-07-25**：完成 AppFacade 全量生产依赖迁移：`boot`、`card`、`config`、`dialog/processSystem`、`editor`、`history`、`layout`、`menus`、`mobile`、`search`、`sync`、`window`、`util`、`export-preview` 和 `inNotePlugin` 的应用参数及网关全部改用 `AppFacade`；`app/src/types/index.d.ts` 与 `types/protyle.d.ts` 的全局声明同步收口。Vue 挂载链路的 `App` 保持不变，`index.ts`、`window/index.ts`、`mobile/index.ts` 仍是组合根。`pnpm run typecheck:protyle-contract` 通过，Node `140/140`、Agent/MAGI `67/67` 通过，新增静态契约测试确认具体 App 导入为零；`pnpm lint:cycles` 处理 `2175` 个文件并报告 `881` 条历史循环（相对上一记录 `1111` 净下降 `230`）。`pnpm lint:imports-gateway` 仍因仓库既有 `52` 个未使用网关导出失败，本批新增的 AppFacade 导出已清理。全量 `pnpm run typecheck` 在默认 4GB 堆上限 OOM，扩大堆后 300 秒仍未完成，均未记录为通过。
- **2026-07-25**：纠正 AppFacade 契约强度与上游类型定位。`siyuan@1.2.3` 明确固定为插件、事件和共享数据格式的长期生态兼容基线；本地实现仅可强化初始化后不变量，并须保持对官方类型可赋值。App 契约由四成员单向 `IsAssignable` 改为 `InstanceLooksLike<typeof App, AppFacade<...>>`，对带厂牌的完整公开实例表面执行双向严格校验，后续 App 新增或外观遗漏成员都会在契约测试的编译阶段暴露。
- **2026-07-25**：补充官方生态契约验证。测试层新增从完整 `siyuan.Plugin` 公共表面自动生成的运行时身份重绑定投影，官方 `App/EventBus/Tab/Custom/Files/Protyle` 仅在测试层绑定到本地完整领域根，不在生产代码创建平行插件接口。修正本地 EventBus 的官方事件名/载荷泛型签名、`addTopBar` 的 right/left 位置声明和显式错误、`addStatusBar` 的稳定返回值，并让 `addTab` 在移动端仍返回确定的模型工厂而不注册桌面页签。完整 App、Plugin 投影、EventBus 与 Plugin Dock 契约现已通过类型求值。
- **2026-07-25**：官方生态仍有两项明确未完成兼容迁移：官方 `ICommand.fileTreeCallback` 的 `Files` class 含名义私有身份，而本地 Files 已按领域拆分；需以官方完整公共表面校验并提供宿主调用边界。官方 `IProtyleOptions.mode` 支持 `preview`，本地提交 `093dc3921` 已将 preview 拆为独立 export-preview 页签；不得把旧模式字面量强塞回编辑器，后续需设计官方插件 preview 请求到新页签语义的显式适配。两项均不得静默忽略，但不继续占用当前 905 个循环的主线解耦批次。
- **2026-07-26**：资产导航加入完整 AppFacade 公共表面，桌面 App 复用唯一 `asset/open/openAsset` 实现，移动 App 使用既有原生链接打开语义；Editor、导出预览、Protyle 预览和菜单调用点均改为实例方法，没有创建捕获 App 的工厂闭包或菜单碎片 Port。`AssetOpenOptions` 是资产领域稳定数据类型，具体打开实现只在桌面组合根装配。源码唯一 SCC `702 -> 700`，`asset/open` 与 `platform/localPath` 均退出组件，枚举环 `723 -> 718`；AppFacade 双向契约 TypeScript 诊断 `0`，Node `157/157`、新增稳定子域 lint 和 `git diff --check` 通过。全量类型检查约 53 秒完成并继续报告仓库既存严格诊断，故不记为全量通过。
