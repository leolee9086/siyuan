# AV 视图结构查询与菜单编排拆分

## 最终目标

保持 Attribute View 的视图菜单、配置、切换、字段读取和图标展示行为不变，将纯视图结构元数据与 `view.ts` 菜单交互组合根分离，使 OpenMenuPanel、Header 和其它 AV 子域不因读取字段或图标反向加载视图菜单编排。

## 当前目标

- [x] 登记 `view.ts <-> openMenuPanel.ts` 双向边和全部元数据消费者。
- [x] 提取视图结构元数据唯一实现并迁移消费者。
- [x] 建立字段身份与完整图标映射测试。
- [x] 验证元数据节点、SCC、类型、lint 和完整回归。
- [ ] 设计并解除 View 菜单与配置面板的真实双向导航环。

## 下一步任务

1. 清除 `getFieldsByData/getViewIcon` 在 `view.ts` 的旧实现。
2. 使 `view/imports.ts` 直达元数据所有者，不反向转发组合根。
3. 复算 `view.ts <-> openMenuPanel.ts` 和最大 SCC。

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
- [ ] 在不使用回调 Port 或事件隐藏依赖的前提下拆分双向导航状态。

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

## 关联任务

- [AV 渲染组合根与视图子域拆分](./AV渲染组合根与视图子域拆分.ttt.md)
- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
