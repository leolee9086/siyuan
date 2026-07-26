# AV 视图结构查询与菜单编排拆分

## 最终目标

保持 Attribute View 的视图菜单、配置、切换、字段读取和图标展示行为不变，将纯视图结构元数据与 `view.ts` 菜单交互组合根分离，使 OpenMenuPanel、Header 和其它 AV 子域不因读取字段或图标反向加载视图菜单编排。

## 当前目标

- [x] 登记 `view.ts <-> openMenuPanel.ts` 双向边和全部元数据消费者。
- [x] 提取视图结构元数据唯一实现并迁移消费者。
- [x] 建立字段身份与完整图标映射测试。
- [x] 验证元数据节点、SCC、类型、lint 和完整回归。
- [x] 设计并解除 View 菜单与配置面板的真实双向导航环。

## 下一步任务

1. 将 Panel 数据加载、HTML 分派、挂载与事件绑定从 399 行控制器分层。
2. 处理 `_propertiesHTMLDeps` 延迟依赖状态，不保留工厂闭包或模块级可变状态。
3. 继续缩短 View/OpenMenuPanel 经 AV 主图返回的间接路径。

## 不变量

- 字段查询必须返回原数组身份，不复制、不排序、不修改数据。
- Table 读取 `columns`，Gallery/Kanban 读取 `fields`，未知视图图标保持 `undefined`。
- 不创建调用点 Port、回调、事件、动态导入、工厂闭包或注册状态。
- `imports.ts` 保留且直达元数据真实所有者。
- 视图菜单事务、DOM、i18n 和面板开关顺序不变。

## 现状基线

- `view.ts` 约 456 行，同时承担菜单、编辑、切换、添加、拖拽以及三个纯查询。
- OpenMenuPanel 和十余个 AV 模块只为 `getFieldsByData` 反向加载完整 View 组合根。
- `view/imports.ts` 为 Header 反向转发 `getFieldsByData/getViewIcon`，扩大组合根扇出。
- 阶段开始时权威生产图为 `2198` 节点、`412` 条代表环、唯一 SCC `671`。

## 目标架构

- `view/metadata.ts`：字段集合和内置图标映射唯一实现，无运行时外部依赖。
- `view.ts`：视图菜单、编辑、添加、切换和拖拽编排。
- `view/imports.ts`：Header 外部依赖与同域元数据直达网关。
- 消费者：按职责直达 metadata 或 View 菜单组合根。

## 近期计划

- [x] 完成元数据叶子拆分，使结构查询节点退出 SCC。
- [x] 在不使用回调 Port 或事件隐藏依赖的前提下拆分双向导航状态。

## 中期计划

- [ ] 继续拆分 View 菜单 HTML、事件绑定、添加事务和拖拽职责。

## 远期计划

- [ ] View 与 OpenMenuPanel 子图退出唯一 SCC，View 组合文件满足规模门禁。

## 风险与验收标准

- 结构判断只能沿用现有 `table ? columns : fields` 语义，不新增未知类型回退策略。
- 所有旧导入必须清零，避免保留第二实现或兼容 barrel。
- 元数据专项、完整 Node、Protyle 契约类型、目标 lint、网关和 diff 检查通过。
- 目标直接环归零，最大 SCC 不新增成员。

## 已归档/已完成区域

- **2026-07-27**：创建专项 TTT。确认直接环来自纯结构查询错置于菜单组合根，不需要新增抽象接口或宿主参数。
- **2026-07-27**：新增 `view/metadata.ts` 与结构守卫，完整承接字段集合和内置图标映射；全部生产消费者及 `view/imports.ts` 直达唯一所有者，旧实现和旧导入归零。字段数组身份和三种图标专项 `2/2`、Node `188/188`、Protyle 契约类型、新文件 lint、imports 多跳和 diff 检查通过。生产节点 `2198 -> 2200`，代表环因路径重排 `412 -> 427`，但唯一 SCC `671 -> 668`，两个元数据节点均在 SCC 外且三个既有节点真实退出。`view.ts <-> openMenuPanel.ts` 仍因双向菜单导航存在，下一阶段按交互状态意图处理，不用回调或事件机械隐藏。
- **2026-07-27**：Panel 控制器成为双向导航唯一所有者：`openViewMenu` 原实现迁入 Panel，View 只保留复制/删除自身事务；View Click 返回 `handled/unhandled/open-view-menu` 判别命令，Panel 按原顺序打开菜单后阻止事件。命令类型和构造器位于无运行时依赖的 `view/navigation` 叶子，外部调用点直达 Panel，不用回调 Port、事件或动态导入。导航专项 `1/1`、Node `189/189`、Protyle 契约类型、新导航文件 lint、imports 多跳和 diff 检查通过。生产节点 `2200 -> 2202`、代表环 `427 -> 423`、最大 SCC保持 `668`；`view.ts <-> openMenuPanel.ts` 两节点环和导航叶子循环均为 `0`。Panel 控制器仍有 399 行、`renderData` 271 行及 `_propertiesHTMLDeps` 延迟状态，继续由本专项拆分。
- **2026-07-27**：删除 `_propertiesHTMLDeps` 模块级缓存和柯里化标记。该对象只承载只读渲染依赖，不是跨调用状态；`getPropertiesHTML` 现在在调用时构造参数并立即交给纯渲染器，继续避开模块初始化期 TDZ，不建立工厂闭包或注册表。新增调用局部依赖与字段不变性专项 `1/1`，Node `190/190`、Protyle 契约类型、网关和 diff 检查通过；生产图保持 `2202 / 423 / SCC 668`，不登记为解环成果。

## 关联任务

- [AV 渲染组合根与视图子域拆分](./AV渲染组合根与视图子域拆分.ttt.md)
- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
