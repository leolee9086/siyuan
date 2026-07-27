# 插件 API 与笔记内插件领域根解耦

## 最终目标

- `plugin/API.ts` 不再作为加载 Protyle、布局、全局命令与插件实现的上帝对象进入主循环组件。
- 笔记内插件由唯一、完整、带厂牌的领域根管理状态与生命周期，依赖方不加载具体 Plugin/API 实现。
- 本地插件运行时持续以 npm `siyuan.Plugin`、`siyuan.ICommand` 与相关数据类型作为生态兼容基线。
- 不使用菜单碎片接口、宽泛 `unknown`、动态导入、闭包工厂或静默回退伪造解耦。

## 当前目标

- 完整笔记内插件管理器已装配并退出菜单循环链；继续处理 `plugin/API.ts` 的闭包 lazy binding 与上帝对象职责。
- 固定本地 Files 完整领域根与官方插件入口之间的显式适配边界，补齐 ICommand/Files 运行时回调证据。
- 为 `plugin/API.ts` 建立现有公共键、初始化顺序、延迟绑定和失败语义基线。

## 下一步任务

- [ ] 枚举本地 `Plugin` 与官方 `siyuan.Plugin` 的全部公共表面差异，不只处理当前首个诊断。
- [ ] 设计 Files 官方回调适配器，保证传给插件的运行时对象满足官方行为，不使用断言掩盖名义类型差异。
- [ ] 在 `app/test` 增加官方 ICommand/Files 入口的运行时和编译时契约测试。
- [ ] 将 `plugin/API.ts` 的可变绑定迁入唯一注册表；缺失绑定显式抛错。
- [ ] 按职责迁出全局命令、编辑器、布局和窗口 API，同时保持官方 API 出口身份。
- [x] 建立完整 `InNotePluginManagerDomain`，由实现与抽象执行双向兼容校验。
- [x] 由桌面/移动应用组合根向 AppFacade 装配完整管理器，删除菜单对具体笔记内插件实现的加载。

## 不变量

- 官方 `siyuan` 类型包是长期生态边界，不以本地玩具接口或 `object` 替代。
- class 抽象覆盖完整公共实例表面，并使用 `LooksLike.types.ts` 校验；不是按单个调用方裁剪接口。
- 笔记内插件状态仍由唯一管理器/注册表拥有，不复制 Map、初始化标记或 App 引用。
- API 未初始化、命令未注册和插件加载失败均保持可观察，禁止空操作和静默失败。
- 具体 Plugin、API、Files class 只在构造、适配和契约校验边界加载。
- `imports.ts` 保留；每个跨目录出口直达真实声明或唯一实现，禁止网关多跳。

## 现状基线

- `inNotePlugin/manager.ts` 的公开对象包含初始化、启用、禁用、重载、状态查询、启用查询和全部卸载。
- 管理器状态实例当前使用本地 `plugin/Plugin`；直接声明为官方 `siyuan.Plugin` 时，完整类型检查在 `commands.fileTreeCallback` 暴露 Files 名义类型不兼容。
- `inNotePlugin/imports.ts` 同时加载 Plugin、API、执行器和网络能力，任一消费者都会附带加载整个插件实现链。
- `plugin/API.ts` 约 292 行，通过 `registerLazyBindings()` 的 getter 闭包聚合 Protyle、布局、全局命令、设置与窗口能力。
- 当前首环经过 `openTitleMenu -> inNotePlugin -> plugin/API -> globalCommand -> layout/editor`。

## 目标架构

- `PluginDomain`：以官方 `siyuan.Plugin` 为兼容基线，本地实现只增强初始化后不变量。
- `Files` 适配边界：宿主将本地完整 Files 领域对象转换为官方插件回调可用的运行时表面，并由专项测试证明行为。
- `PluginApiRegistry`：统一登记 API 公共键及其实现身份，组合根负责装配，读取未登记键时显式失败。
- `InNotePluginManagerDomain`：覆盖管理器全部公开表面和状态类型，带独立 Symbol 厂牌；实现、抽象双向校验。
- AppFacade 仅聚合上述完整领域根，不增加 `isEnabled/reload` 等零散插件方法。

## 近期计划

- [ ] 完成官方 Plugin/ICommand/Files 差异清单和失败测试。
- [ ] 完成 Files 适配边界并让本地 Plugin 对官方插件契约可赋值。
- [ ] 为 Plugin API 当前键集合和 getter 身份建立行为测试。

## 中期计划

- [ ] 迁移 API 可变绑定到统一注册表，移除闭包数组。
- [ ] 拆分 API 上帝对象的命令、布局、编辑器、窗口职责。
- [x] 建立并装配完整笔记内插件管理器领域根。

## 远期计划

- [ ] 删除菜单、Protyle 和导航对具体笔记内插件/API 实现的运行时依赖。
- [ ] 确认相关节点退出 Tarjan SCC，并回归插件加载、命令、Files 回调和卸载生命周期。
- [ ] 更新主循环 TTT 并归档本任务。

## 风险与控制

- **名义类型伪兼容**：官方 Files 含私有身份，结构相似不代表行为等价；必须由显式适配和运行时测试证明。
- **API 初始化顺序漂移**：注册表装配需固定在插件加载前，读取缺失项必须抛出含键名的错误。
- **状态复制**：管理器和 API 注册状态均只有一个所有者；不得在菜单或 AppFacade 维护镜像状态。
- **移动端差异**：桌面与移动组合根分别装配其能力，不通过全局断点合并平台行为。

## 验收标准

- 本地 Plugin 对官方插件兼容契约通过，ICommand/Files 回调具备编译时及运行时证据。
- `plugin/API.ts` 不再直接加载全局命令、具体 Protyle、布局和窗口上帝对象。
- 笔记内插件完整领域根双向契约通过，菜单只依赖 AppFacade 中的完整领域根。
- imports 网关多跳保持 `0`，相关节点退出主 SCC。
- Node、插件专项、完整类型检查目标诊断、循环检查和 `git diff --check` 通过。

## 已完成记录

- **2026-07-27**：创建任务。尝试把完整管理器直接装配到 AppFacade 时，完整类型检查确定性复现本地 `Plugin.commands.fileTreeCallback` 与官方 `siyuan.ICommand` 的 Files 名义类型不兼容；未用断言、`unknown` 或缩窄接口掩盖，半迁移已撤回。登记 `plugin/API.ts` 闭包 lazy binding 与 `inNotePlugin/imports.ts` 广域加载为同一插件边界子任务。
- **2026-07-27**：将官方完整 Plugin 表面重绑定证明从测试移入唯一兼容边界，`adaptSiyuanPlugin` 先要求完整 `SiyuanPluginRuntimeContract`，再通过本地 Plugin 原型守卫消除 npm 类型包中 App/Files/Tab 私有身份造成的名义差异；没有使用 `as`、宽泛对象或缩窄插件协议，适配保持原实例身份，公开状态统一使用官方 `siyuan.Plugin`。
- **2026-07-27**：模块级 App、初始化标志和插件 Map 迁入唯一 `InNotePluginManager` 实例。完整 `InNotePluginManagerDomain` 覆盖初始化、启用、禁用、重载、全量/单项查询、启用判定、文档标记和全部卸载，并以 Symbol 厂牌及 `PublicInstanceLooksLike` 双向校验；存储、标题查询和恢复编排为模块级可测函数，class 只持有状态与公开命令。桌面与移动 App 组合根分别创建并初始化实例，AppFacade 双端严格等价契约通过；文件树与标题菜单改用完整管理器，不再动态加载 `inNotePlugin/index.ts`。
- **2026-07-27**：管理器专项 Vitest `3/3` 覆盖实例隔离、持久化恢复、缺失文档移除、启停/重载和文档标记委托；AppFacade/管理器 Node 契约及完整 Node `204/204`、Protyle 契约、新领域 lint、imports 多跳 `0` 与 diff 检查通过。完整 Vitest 实际剩余两项既有失败：缺失 `transaction.refreshSbs`，以及 Calibur Router navigation 状态覆盖证明异常。生产图为 `2339 / 171`；代表环因路径重排反升，但 `navigation/openTitleMenu -> inNotePlugin -> plugin/API` 链已归零，首环推进到 `navigation -> commonMenuItem`。
