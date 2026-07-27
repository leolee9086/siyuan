# Dock 组合根与目录领域拆分（TikTocTak）

> **最终目标**：在保持桌面 Dock 初始化、显示隐藏、拖拽、缩放、模型装配和插件扩展行为不变的前提下，将 `layout/dock` 的上帝目录重组为单向领域子图；所有行为模块依赖完整 `DockDomain`，具体 `Dock` class 仅在初始化和契约校验边界出现。
>
> **当前目标**：继续让 `dock.init/model/resize` 从 Dock 工厂、Editor/Protyle 与配置形成的长运行时 SCC 中退出；当前布局初始化与纯可见性节点已退出。
>
> **下一步任务**：沿 `dock.init -> getAllModels/tabUtil` 与 `dock.model -> dock.factory` 的真实出边拆分活动编辑器查询和模型装配职责；同步将 resize/size/tab 迁入对应子目录。

## 不变量

- 保留 `imports.ts` 对跨域实现依赖的显式暴露，不以动态导入、全局注册或延迟加载隐藏循环。
- `DockDomain` 必须描述 Dock class 的完整公共表面；具体兼容性在 `app/test/layout/LayoutDomain.contract.test.ts` 使用 `PublicInstanceLooksLike` 严格双向校验。
- 不按事件或调用点创建局部 Host 接口，不使用 `unknown` 代替 Dock、Layout、Model 或 App 的领域身份。
- 具体 Dock class 只允许在构造、工厂、序列化恢复和契约测试边界导入。
- 目录移动必须按真实职责分组，并在每批 Madge 扫描中证明循环不增加。
- Madge 代表环枚举数可随节点拆分阶段性反升；以目标环退出、SCC 未新增和测试通过作为结构验收，禁止因总数波动反复撤回正确抽象。
- 显示隐藏阈值、DOM 更新顺序、持久化、模型生命周期和插件 Dock 行为保持不变。

## 现状基线

- **2026-07-26**：`layout/dock` 根目录有 46 个文件，超过目录门禁 10；`Dock` 组合根约 500 行，并同时导入事件、图、拖拽、缩放、布局、按钮、初始化和模型实现。
- 已有完整 `DockDomain` 位于 `dock.types.ts`，包含应用外观、布局、DOM、模型状态以及全部公开动作。
- `LayoutDomain.contract.test.ts` 已使用 `IsAssignable<Dock, DockDomain>` 从具体实现方向校验完整抽象。
- Madge `895` 基线中存在 `index.ts <-> dock.events.ts` 和 `index.ts <-> dock.graph.ts` 两节点直接环。

## 目标架构

```text
Dock 组合根
  -> events/
  -> visibility/
  -> resize/
  -> drag/
  -> model/
  -> graph/
  -> initialization/

行为子域 -> DockDomain + 显式 imports.ts 网关
契约测试 -> Dock class + DockDomain + IsAssignable
```

## 分阶段计划

### Phase 1：完整契约与直接环

- [x] 确认 `DockDomain` 覆盖 Dock 全部公共能力并由测试严格双向校验具体 class。
- [x] 鼠标离开事件改依赖 `DockDomain`，谓词归回事件所有者。
- [x] 解除 `index.ts <-> dock.graph.ts`，Graph 运行行为与完整抽象归入 `graph` 子域。
- [x] 复核 `dock.events/dock.visibility` 的死亡出口与真实调用者。

### Phase 2：目录领域化

- [x] 布局初始化迁入稳定 `dock/layout` 子域；纯可见性校验不再依赖 Dock 实例。
- [ ] 事件与其余可见性职责迁入稳定子域，保留窗口环境封装。
- [ ] 拖拽、缩放与尺寸状态按生命周期归组，不合并不同交互语义。
- [ ] 模型装配、按钮生成、插件 Dock 和图模型按所有权归组。
- [ ] 根目录降到门禁以内，所有子目录各自提供必要的 `imports.ts`。

### Phase 3：组合根瘦身

- [ ] Dock class 只保留实例状态、构造编排和公开动作转发。
- [ ] 具体 Layout、Model 和 Custom class 只在初始化或工厂边界绑定。
- [ ] 私有行为迁移后不通过碎片接口回流到组合根。

### Phase 4：验证与归档

- [-] 修复导入注释 lint 规则，确保 `import type` 仅要求用途与使用范围，不要求解耦评估。
- [ ] Dock 子图不再出现在 `pnpm lint:cycles` 报告中。
- [ ] `LayoutDomain.contract.test.ts`、Node、专项 DOM 行为测试通过。
- [ ] 新子域 lint、TypeScript、Madge 和 `git diff --check` 通过。

## 风险与验收

- Dock 的事件阈值、浮动状态和 DOM 尺寸高度耦合，迁移时必须以行为测试锁定。
- `dock.visibility.ts` 存在仅历史模块引用的函数及旧 `dock.element` 表面，清理前先确认运行调用，禁止顺手改写行为。
- 验收要求：具体 class 仅在允许边界出现；完整抽象校验持续成立；目录和组合根规模通过门禁；Dock 相关循环归零。

## 已完成记录

- **2026-07-26**：创建专项 TTT。鼠标离开谓词从综合 visibility 模块归回事件模块，`dock.events.ts` 参数由具体 `Dock` 改为已有完整 `DockDomain`；`Dock -> DockDomain` 的 `IsAssignable` 契约包含在 Node `140/140` 回归中。`typecheck:protyle-contract` 通过，Madge `895 -> 894`。事件文件新增代码 lint 已清零，剩余根目录 46 项门禁由本 TTT Phase 2 追踪。
- **2026-07-26**：Graph 建立完整泛型 `GraphDomain`，覆盖 Model 继承表面、公开状态、连接、检索、销毁和渲染动作；新增 `PublicInstanceLooksLike` 从具体 class 的完整公共表面做严格双向比较，契约测试绑定真实 `AppFacade/Tab`。Dock Graph 运行时改用结构守卫并迁入 `graph/runtime.ts`，不再导入具体 `Dock/Graph` class。目标 Graph 子域循环路径为 `0`，Node `140/140`、新子域 lint、`git diff --check` 通过；Madge 代表环枚举因节点拆分变为 `915`，按规程记录但不作为撤回依据。
- **2026-07-26**：CustomLists 改用完整 `LayoutTab`、`DockDomain`、`TreeDomain` 与 `ProtyleDomain`，Dock 查找、存储、Tree/Protyle 构造及菜单只在 `dock.factory.ts` 装配；没有新增调用点 Host 接口。`CustomListsDomain` 删除 `object` 泛型占位，具体 CustomLists/Tree/Protyle 均由 `PublicInstanceLooksLike` 严格校验。CustomLists 从 5 条目标路径降为 `0`，Node `140/140`，全量类型检查对上述契约文件无诊断；Madge 枚举为 `923`，仅作记录。
- **2026-07-26**：Dock 活动 helper 的 `init/focus/model/size/resize/relation/toggle` 统一改用完整 `DockDomain`，窗口参数统一改用完整 `LayoutWindow`；resize 通过既有 `CustomDomain` 厂牌守卫调用可选生命周期，不再加载具体 Custom class。跨模块实际使用的 `resetDockPosition()` 从伪私有提升为正式公共领域行为并纳入 `PublicInstanceLooksLike` 双向校验。删除 `dock.toggle.ts` 六个无调用的重复执行器、`dock.layout.ts` 三个无调用且引用不存在 `dock.element` 的死导出，以及 `dock.visibility.ts` 八个无调用的 Dock 死副本；唯一有效的 `hasValidDockType()` 保持纯数据实现。布局初始化迁入 `dock/layout`，专属 `imports.ts` 直达 `layout.types`、统一守卫和 `dock.types`，没有串联根综合网关；同时修正 `dock.model` 对已迁移 Graph 唯一实现的失效路径。布局与 visibility 节点退出 SCC，代表环 `513 -> 500`、最大 SCC `682 -> 680`。Node `177/177`、新布局子域 lint、目标类型诊断、imports 多跳和 diff 校验通过；`init/model/resize` 的长运行时返回路径继续由本 TTT 追踪。
- **2026-07-27**：Dock 根网关不再经综合 `layout/util.ts` 获取 `adjustLayout`，改为直达 `layout/ui-utils.ts`；`layout/util.ts` 删除零消费者的 `initInternalDock/JSONToDock` 重导出，真实反序列化调用继续直达 `dock-utils.ts`，且未修改用户工作树中的 `dock-utils.ts`。随后 `ui-utils` 的具体 Layout/Wnd 类型与 `instanceof Layout` 改用已有完整 `LayoutDomain/LayoutWindow` 和统一守卫，具体 class 返回边归零。CustomLists 删除 `createProtyle` 碎片工厂参数，直接通过完整 AppFacade 创建内嵌编辑器；Dock 根网关随之删除具体 Protyle 构造出口。代表环经历职责重排 `175 -> 181 -> 183 -> 160 -> 172`，最终首环转到 Bookmark；Node `200/200`、Protyle/Layout 契约、imports 多跳 `0` 与 diff 检查通过。
