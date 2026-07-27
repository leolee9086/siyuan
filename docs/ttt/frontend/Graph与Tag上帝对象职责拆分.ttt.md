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
- [ ] 提取 Tag 树数据投影和内嵌编辑器生命周期，保持 `TagDomain` 为唯一外部领域根。
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
