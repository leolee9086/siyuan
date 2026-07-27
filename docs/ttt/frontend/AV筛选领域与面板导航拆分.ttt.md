# AV 筛选领域与面板导航拆分（TikTocTak）

> **最终目标**：保持 Attribute View 筛选菜单、筛选树、内联编辑、事务与 Rollup 配置行为不变，将筛选领域能力从巨型 `filter.ts` 分层，并使筛选子域不再反向依赖 Panel 组合根。
>
> **当前目标**：Filter 根已退出唯一 SCC；继续将 1227 行综合模块的树操作、HTML、内联编辑和值菜单按完整职责分层。
>
> **下一步任务**：先为筛选树路径、根组合、分组转换和最大深度建立行为测试，再迁入完整树操作子域。

---

## 不变量

- 保留全部生产 `imports.ts`，网关必须直达真实声明或唯一实现，禁止 imports 网关多跳。
- 不通过动态导入、事件转发、回调 Port、服务定位器或工厂闭包隐藏依赖。
- `setFilter` 的 Menu 创建、Rollup 解析、提示、旧 Panel 清理、字段编辑 Panel 打开顺序保持不变。
- 筛选树增删改、事务 do/undo 数据、HTML、内联输入与菜单定位行为保持不变。
- 不为单一调用点创建接口；函数返回类型优先由真实实现推导。
- 相同筛选能力只保留唯一实现，不增加兼容包装或第二条执行路径。

## 现状基线

- `filter.ts` 约 1301 行，混合筛选值弹层、筛选树变换、HTML、Rollup 字段解析、内联编辑、DOM 事件和事务提交。
- `openMenuPanel.ts` 依赖 Filter 的 HTML、字段预处理和内联事件。
- `filter.ts` 仅在 Rollup 缺少目标配置时反向调用 `openMenuPanel({type: "edit"})`。
- `setFilter` 的生产调用方唯一位于 `col/col.showColMenu.ts`，该列菜单已通过本域网关拥有 Panel 导航入口。
- 阶段开始时生产图为 `2203` 节点、`424` 条代表环、唯一 SCC `668`；最短环为 `filter.ts <-> openMenuPanel.ts`。

## 目标架构

- Filter：解析并编辑筛选状态；Rollup 配置不足时完成提示和旧 Panel 清理，返回需要编辑的列 ID。
- Column Menu：等待筛选弹层结果；收到列 ID 后调用既有 Panel 入口打开字段编辑。
- Panel：继续拥有 Panel 创建、数据加载、渲染与导航，不被 Filter 领域反向加载。
- 后续子域：树操作、HTML、内联编辑与筛选值菜单分别按完整职责迁移，不建立调用点碎片契约。

## 近期计划

- [x] `setFilter` 返回缺少 Rollup 配置的列 ID，不再导入 Panel。
- [x] 唯一调用方等待结果并保持原顺序打开字段编辑 Panel。
- [x] 增加运行时专项测试，覆盖返回 ID、提示与旧 Panel 清理。
- [x] 验证目标两节点环、类型、Node、网关和 diff；Filter 规模 lint 转入中期拆分。
- [x] 全仓 `setAttrViewFilters` 提交统一进入严格 Filter Prepared 命令，Filter 根退出 SCC。
- [x] Filter 严格命令归入 `prepared/av/view` 视图条件子域，与 Sort 并列且网关直达 Prepared 内核。

## 中期计划

- [ ] 提取筛选树查询与变换完整子域，锁定根组、路径和最大深度语义。
- [ ] 提取筛选 HTML 与内联值编辑完整子域，保留字段数组身份与 DOM 数据属性协议。
- [ ] 将筛选值 Menu 和事务编排从纯树/HTML 能力中分离。

## 远期计划

- [ ] Filter 子域退出唯一 SCC，全部文件满足规模门禁。
- [ ] AV Panel、Column、Filter 依赖方向稳定为组合根到领域实现。

## 风险与验收标准

- 异步回调必须等待 `setFilter` 结果，禁止丢失 Promise 或静默忽略导航请求。
- Rollup 已正确配置时不得打开字段编辑 Panel。
- Menu 已打开、字段不存在等既有早退继续返回空结果。
- 专项测试、完整 Node、Protyle 契约类型、新代码 lint、imports 多跳和 diff 检查通过。
- `filter.ts <-> openMenuPanel.ts` 两节点环为 `0`，不新增循环 SCC；代表环数量只记录，不作单调门禁。

## 已归档/已完成区域

- **2026-07-27**：创建专项 TTT。依据当前 `lint:cycles` 确认唯一两节点环由 Filter 的 Rollup 缺失配置导航反向边造成；1301 行 Filter 登记为上帝对象，后续按完整职责阶段化拆分。
- **2026-07-27**：`setFilter` 在 Rollup 配置不足时完成原有提示与旧 Panel 清理后返回列 ID，删除 Filter 对 Panel 的运行时导入；唯一列菜单调用方等待结果并经既有 `col/imports.ts` 直达 Panel 唯一实现。列菜单同时将具体 `Dialog` class 依赖替换为既有完整 `IProtyleDialog/IProtyleDialogPort`，未新增碎片接口。真实运行时专项 `1/1`、Node `190/190`、Protyle 契约类型、imports 多跳和 diff 检查通过；生产图保持 `2203` 节点，代表环 `424 -> 421`、最大 SCC 保持 `668`，Filter/Panel 直接环和全部共环归零。完整 Vitest 第一批 `44/44`、第二批可执行测试 `32/32`，但 `keydown.list/router` 与 `dialogHotkey` 两个套件仍在导入期触发既有 Calibur `有交集()` 的 `undefined.filter` 回归，因此不登记为全量通过。Filter 的 10 项规模 lint 和列菜单既有导入注释门禁继续在中期拆分中治理，不添加豁免。
- **2026-07-27**：核定 Filter、Panel 点击、列类型切换和拖拽编排中的九个 `setAttrViewFilters` 提交点均在调用域完成筛选树变换和 DOM 重渲染，通用事务无对应本地分支；新增严格 `prepared/av/avFilter.ts`，全仓该 action 统一直达唯一命令，Sort/列/视图等不同 action 不强行合并。命令与导航专项 `3/3`、完整 Node `199/199`、Protyle 契约类型、新命令 lint、全量类型目标诊断 `0`、imports 多跳与 diff 检查通过。生产图 `2263 / 320 / SCC 604`，Filter 根与新命令退出 SCC；代表环 `318 -> 320` 是首路径转向 Cell/Asset/Hint 后的重新枚举。1227 行 Filter 上帝模块仍按中期计划拆分，不提前归档整体任务。
- **2026-07-27**：为保持 Prepared 根目录规模门禁并按真实视图条件领域组织命令，Filter 唯一实现迁入 `prepared/av/view/avFilter.ts`，与新 Sort 严格命令并列；子域 `imports.ts` 直达 `prepared/submit.ts`，旧路径和兼容转发清零。所有 Filter 消费者同步直达新所有者，Filter 契约测试继续通过。

## 关联任务

- [AV 视图结构查询与菜单编排拆分](./AV视图结构查询与菜单编排拆分.ttt.md)
- [AV 渲染组合根与视图子域拆分](./AV渲染组合根与视图子域拆分.ttt.md)
- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
- [前端上帝对象领域拆分](./前端上帝对象领域拆分.ttt.md)
