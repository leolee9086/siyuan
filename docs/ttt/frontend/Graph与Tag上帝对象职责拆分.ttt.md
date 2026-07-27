# Graph 与 Tag 上帝对象职责拆分（TikTocTak）

> **最终目标**：在保持 Graph、Tag 公开行为、DOM 结构、事件顺序、WebSocket 与请求语义不变的前提下，将两个巨型模型内部职责拆成可独立验证的单向模块；外部依赖始终面向已通过双向兼容校验的完整 `GraphDomain`、`TagDomain`。
>
> **当前目标**：建立真实职责基线与测试保护，处理 Graph 773 行、Tag 420 行及 Graph 多个超长生命周期函数；不以删除注释、lint 豁免或调用点碎片接口降低规模。
>
> **下一步任务**：为 Graph 的 DOM 构建、交互事件、网络数据投影和 vis 网络渲染建立行为清单与专项测试，确定第一条只依赖完整领域根或显式数据参数的单向提取边界。

---

## 不变量

- `GraphDomain`、`TagDomain` 必须覆盖各自 class 的完整公共实例表面，并继续由 `PublicInstanceLooksLike` 双向校验证明兼容。
- 具体 `Graph`、`Tag` class 只允许出现在初始化、反序列化、复制和契约校验边界；业务消费者依赖完整领域抽象。
- 不为单个 helper 创建只含一两个方法的碎片接口，不使用 `unknown` 能力槽代替领域类型。
- 跨调用状态由模型实例或统一 SForge 注册表拥有，不进入模块变量、工厂闭包或函数静态属性。
- Graph/Tag 查询 Dock 必须直达 `layout/query/dockByType.ts` 唯一实现，不经 `tabUtil.ts` 兼容出口形成反向边。
- 不改变 Graph 配置、搜索、重置、全屏、节点交互、块检查、标题更新和 vis 生命周期语义。
- 不改变 Tag 排序、筛选、展开状态、内嵌 Protyle 创建/销毁、更新合并和菜单行为。
- 新增测试位于 `app/test`，生产源码目录不放测试。

## 现状基线

- **2026-07-28**：`Graph.ts` 实际代码 773 行；constructor 303 行，`searchGraph` 80 行，`onGraph` 260 行，另有 60/199 行匿名处理器。
- **2026-07-28**：`Tag.ts` 实际代码 420 行，树状态、筛选状态、内嵌编辑器生命周期、请求更新和 DOM 事件集中在同一 class。
- 两个 class 已分别存在完整 `GraphDomain`、`TagDomain`、模块级 Symbol 厂牌与 `LayoutDomain.contract.test.ts` 双向兼容校验，不再创建平行抽象。
- `Graph/Tag -> tabUtil` 仅为 Dock 查询历史兼容路径；唯一查询实现已经位于 `layout/query/dockByType.ts`。

## 近期计划

- [ ] 固化 Graph 构造后 DOM、配置控件与事件绑定行为。
- [ ] 提取 Graph 静态 DOM/配置呈现，输入为明确配置和语言数据，输出为 DOM/HTML 数据，不反向导入 class。
- [ ] 提取 Graph 交互分发与请求响应投影，模型实例通过完整 `GraphDomain` 或显式数据参数进入。
- [ ] 固化 Tag 筛选、展开恢复、更新串行化和编辑器销毁行为。
- [ ] 固化标签重命名 Dialog、候选提示、键盘与桌面/移动刷新行为，将 82 行 `renameTag` 从平台杂项容器迁入标签业务领域后再按职责拆分。
- [ ] 提取 Tag 树数据投影和内嵌编辑器生命周期，保持 `TagDomain` 为唯一外部领域根。
- [x] 内嵌编辑器创建统一调用完整 `AppFacade.createProtyle()`，具体 Protyle class 只留在应用装配边界。
- [ ] 将两个 class 的单函数和单文件实际代码降至 lint 门限内，并执行完整契约、专项、Node、类型与循环图验证。

## 风险

- Graph 的 vis 回调同时读取配置、DOM、模型状态和应用导航，错误拆分可能改变 `this`、事件时序或节点选择语义。
- Tag 的异步刷新通过 `updating/pendingUpdate/filterLoadPending` 合并请求，拆分时必须保持确定性的状态转换。
- DOM listener 与内嵌 Protyle 需要对称销毁；仅移动代码而遗漏释放会形成生命周期泄漏。

## 验收标准

- Graph、Tag 的完整领域契约双向校验通过，具体 class 无新增非初始化消费者。
- Graph/Tag 专项覆盖主要 DOM、事件、异步状态和销毁路径。
- 两文件及拆出模块 lint 通过，不使用豁免压制规模诊断。
- Node、相关 Vitest、imports 网关多跳、类型检查和源码循环图完成验证。
- TTT 逐批记录实现文件、测试证据、循环路径变化和原子提交。

## 已完成

- **2026-07-28**：创建专项 TTT；确认现有完整领域根和兼容校验可继续复用，不另建抽象。Graph、Tag 的 Dock 查询改为直达唯一无状态查询实现，作为后续内部拆分前的依赖方向基线。
- **2026-07-28**：Dock 查询直达改造通过 Node `208/208`、imports 多跳 `0` 与 diff 检查；生产循环代表路径从 `114` 降至 `101`，两个模型到 `tabUtil` 的反向查询边归零。完整文件 lint 基线确认 Graph 773 行、Tag 420 行及 Graph constructor/searchGraph/onGraph 等超限职责，作为后续拆分的硬验收基线而非本批豁免项。
- **2026-07-28**：Graph 的布局实例查询改为直达 `layout/query/layoutInstance.ts` 唯一实现，移除到高层 `layout/util.ts` 的转发边；Graph 随之退出当前代表环。Node `208/208`、imports 多跳 `0` 与 diff 检查通过；代表环 `101 -> 109` 属于剩余 SCC 路径重排，新首环已转向 Tag 菜单依赖，不改变本专项对 Graph 内部职责拆分的后续计划。
- **2026-07-28**：标签重命名流程的 Dock 查询直达稳定所有者，菜单返回环退出，代表环 `109 -> 108`。完整 lint 确认 `renameTag` 实际代码 82 行且同时承担 Dialog 构建、候选查询、键盘、点击和刷新分派；已登记为本专项近期任务，先补行为测试再迁移，禁止仅为行数门禁拆成无领域意义的小函数。
- **2026-07-28**：完成全部 `getDockByType` 历史转发消费者归一，Tag 周边不再通过 `tabUtil` 查询 Dock；代表环 `108 -> 101`。当前 Tag 返回链来自内嵌编辑器直接构造具体 Protyle，下一批复用已存在的完整 AppFacade 创建能力，保持 `TagDomain` 与契约校验不变。
- **2026-07-28**：Tag 内嵌编辑器创建迁入完整 AppFacade 创建边界，删除具体 Protyle 运行时导入；`TagDomain.editors` 继续使用完整 `ProtyleDomain[]`，双向契约 `3/3`、Node `208/208`、imports 多跳 `0` 与 diff 检查通过。代表环 `101 -> 98`，Tag 退出当前 SCC；其筛选、异步更新和重命名职责拆分仍按本 TTT 继续治理。
