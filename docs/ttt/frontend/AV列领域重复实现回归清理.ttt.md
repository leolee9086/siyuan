# AV 列领域重复实现回归清理

## 最终目标

保持 Attribute View 列创建、编辑、菜单、名称和图标语义不变，以 `app/src/protyle/render/av/col/` 为唯一列领域实现，清除合并后重新引入的 `app/src/protyle/render/av/col.ts` 完整旧副本及其循环依赖。

## 当前目标

- [x] 核对新旧列实现的生产调用覆盖。
- [x] 将旧文件最后两个纯映射消费者迁到真实所有者。
- [x] 删除无生产消费者的旧列实现。
- [x] 验证完整 Node 回归并完成原子提交。

## 下一步任务

1. 为全部协议列类型固定名称和图标映射行为。
2. 复算 `row -> col -> relation -> row` 目标环与唯一 SCC。
3. 更新关联 TTT 并原子提交。

## 不变量

- 不复制、包装或重导出列行为；每项行为只有一个真实实现。
- Row 与 NewItemTemplate 只依赖列类型纯映射，不加载列编辑组合根。
- 不用动态导入、回调 Port、事件转发、工厂闭包、注册表或断言隐藏依赖。
- `imports.ts` 保留并直达真实声明或唯一实现，不经过其它网关。
- 列创建、编辑、菜单、Relation/Rollup、事务和动画执行顺序不变。

## 现状基线

- `app/src/protyle/render/av/col.ts` 为 1978 行旧实现；`app/src/protyle/render/av/col/` 已存在完整拆分实现并被其余生产调用使用。
- 版本合并 TTT 已记录旧 `col.ts` 应为 deleted-by-us，但后续合并重新引入该文件。
- 旧文件仅剩 `row.ts` 和 `newItemTemplate.ts` 两个生产消费者，二者只读取 `getColNameByType/getColIconByType`。
- `row.ts -> col.ts -> relation.ts -> row.ts` 是当前短环；阶段开始时源码节点 `2206`、代表环 `417`、唯一 SCC `672`。

## 目标架构

- `col/col.typeUtils.ts`：列协议收窄、名称、图标和默认列数据的唯一所有者。
- `col/col.ts`：列编辑与菜单编排入口。
- `col/*.ts`：列操作、编辑面板、菜单和动画职责实现。
- Row/NewItemTemplate：直达类型工具，不依赖列交互组合根。

## 近期计划

- [x] 完成旧副本删除并证明目标环消失。

## 中期计划

- [ ] 检查 AV 目录其它 `.backup.ts` 或合并遗留文件是否进入生产依赖图，按变更意图单独处理。

## 远期计划

- [ ] AV 列子域退出前端唯一 SCC，且不再发生旧文件复活或双实现漂移。

## 风险与验收标准

- 新旧名称映射都从当前 `window.siyuan.languages` 读取；测试必须覆盖全部列类型及 `_attrView.key`。
- 图标映射必须覆盖全部协议列类型，`updated/created` 继续共享时钟图标。
- 删除前确认全仓生产和测试引用为零；删除后 Node、目标类型、lint、网关和 diff 检查通过。
- 目标短环归零，SCC 不因本批新增节点扩大。

## 已归档/已完成区域

- **2026-07-27**：创建专项 TTT。确认旧根文件是合并后复活的完整重复实现，而非公共兼容入口；既有拆分 TTT 和合并 TTT 均证明 `col/` 子域才是预期唯一实现。
- **2026-07-27**：Row 与 NewItemTemplate 改为直达 `col/col.typeUtils.ts`，删除 1978 行旧 `col.ts`；类型工具恢复旧实现按需读取 `window.siyuan.languages` 的精确语义，避免 i18n 嵌套代理产生额外警告。新增全部 17 种协议列名称/图标映射测试，专项 `4/4`、Protyle 契约类型检查、目标文件 lint（仅余既有 col 目录 16 项超限）、imports 多跳与 diff 检查通过。源码节点 `2206 -> 2205`、代表环 `417 -> 412`、唯一 SCC `672 -> 671`，旧文件循环路径归零。
- **2026-07-27**：完整 Node 回归 `184/184`。全项目类型检查可正常执行完成，仍报告 Agent、Asset、Block、Menus 等既有严格诊断，本批三个生产文件和删除入口没有新增诊断；以通过的 Protyle 契约类型检查作为本批目标证据。阶段完成，等待原子提交。

## 关联任务

- [拆分 col 模块](../archive/拆分col模块.ttt.md)
- [AV 行渲染与虚拟滚动状态职责拆分](./AV行渲染与虚拟滚动状态职责拆分.ttt.md)
- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
