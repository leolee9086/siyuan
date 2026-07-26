# AV 关系字段与关系单元格职责拆分

## 最终目标

保持 Attribute View 关系列配置、数据库搜索、双向关系、关系单元格选择、复制与新建行行为不变，将 574 行综合 `relation.ts` 按完整领域职责分层，使关系领域不再因提交已完成本地呈现的事务而加载通用 Protyle DOM 事务分派主链。

## 当前目标

- [x] 登记 Relation 的事务 action 与调用域本地呈现基线。
- [x] 建立封闭 AV Relation Prepared 命令并迁移全部直接事务提交。
- [x] 验证 Relation 事务返回边、代表环和 SCC 变化。
- [ ] 按行为基线继续拆分搜索、关系列配置和关系单元格交互。

## 下一步任务

1. 为关系数据库搜索请求、展开和结果呈现建立行为测试。
2. 为关系列配置与双向关系的 DOM 输入、undo 和焦点顺序建立行为测试。
3. 为关系单元格选择、新建行和复制建立行为测试。
4. 按完整职责迁移实现并持续复算生产图。

## 不变量

- 不改变关系搜索、筛选、拖拽、双向关系和单元格 DOM 更新顺序。
- 调用域已完成的本地表头、单元格和菜单更新不得在事务层重复实现。
- 严格命令只接受 Relation 真实提交的四类 action，非法 action 显式抛错。
- 不使用回调 Port、事件、动态导入、工厂闭包、服务定位器或宽泛类型隐藏依赖。
- 新子域 `imports.ts` 直达真实声明或唯一实现，不经过其它网关。

## 现状基线

- `relation.ts` 为 574 行，公开 `openSearchAV/updateRelation/toggleUpdateRelationBtn/bindRelationEvent/getRelationHTML/setRelationCell` 六项综合能力。
- `updateRelation` 提交 `updateAttrViewColRelation + doUpdateUpdated`，保留关系列配置 undo。
- `setRelationCell` 新建关系行时提交 `insertAttrViewBlock + doUpdateUpdated + updateAttrViewCell`，现有调用没有 undo。
- 通用 `promiseTransaction` 的本地 DOM 分支只处理普通块 `update/delete/append/move/insert/setAttrs`，不处理上述 AV Relation action。
- 阶段开始时生产图为 `2258` 节点、`321` 条代表环、唯一 SCC `613`；首环经 `relation -> transaction` 返回 Protyle 主链。

## 目标架构

- `transaction/prepared/avRelation.ts`：封闭 action 校验并复用 Prepared Transaction 的 undo、lite、同步指示、队列、请求和字数刷新生命周期。
- `relation.ts`：当前阶段继续拥有关系 UI 编排，但不加载通用 DOM 事务分派。
- 后续子域：关系列配置、数据库搜索、关系单元格交互分别依据行为基线拆分，不复制共享算法。

## 近期计划

- [x] 严格 Relation Prepared 命令与调用点迁移。
- [x] action 契约、完整回归、类型、lint、网关和循环图验证。
- [ ] 搜索、关系列配置与关系单元格交互职责拆分。

## 中期计划

- [ ] 提取关系数据库搜索与结果呈现职责。
- [ ] 提取关系列配置与双向关系职责。
- [ ] 提取关系单元格选择、新建行和复制职责。

## 远期计划

- [ ] Relation 子域退出唯一 SCC，综合文件满足规模门禁，依赖方向稳定。

## 风险与验收标准

- Prepared 命令不得新增 undo 或改变 lite 模式行为。
- 新建关系行必须保持先更新本地 Cell、再插入菜单项、后提交组合操作的原顺序。
- 四类合法 action 和非法 action 均有测试；完整 Node、目标 Vitest、两层类型检查、新代码 lint、网关、diff 与循环图通过。
- 只按真实 SCC 变化登记成果，不以文件迁移或代表环数量替代结构证据。

## 已归档/已完成区域

- **2026-07-27**：创建专项 TTT。确认 Relation 四类 AV action 均不进入通用事务的普通块 DOM 分派；调用域已完成表头、单元格与菜单本地呈现。登记 `2258 / 321 / SCC 613` 基线，先以严格 Prepared 命令移除真实 `relation -> transaction` 返回边。
- **2026-07-27**：新增 `transaction/prepared/avRelation.ts`，严格接受 `updateAttrViewColRelation/insertAttrViewBlock/updateAttrViewCell/doUpdateUpdated`，复用 Prepared undo、lite、同步指示、队列、请求和字数刷新生命周期；`updateRelation` 保留原 undo，`setRelationCell` 新建行保留空 undo，调用域 DOM 顺序不变，非法 action 显式失败。Relation 直接通用事务导入清零。命令专项 `6/6`、完整 Node `199/199`、Protyle 契约类型、新命令 lint、全量类型目标诊断 `0`、imports 多跳与 diff 检查通过；生产图 `2259 / 319 / SCC 611`，Relation、`col.editPanel.bind.relation.ts` 和新命令均在 SCC 外，首环推进到 `col.editPanel.bind -> transaction`。近期事务阶段完成，574 行领域职责拆分继续执行，不提前归档整体任务。

## 关联任务

- [AV 视图结构查询与菜单编排拆分](./AV视图结构查询与菜单编排拆分.ttt.md)
- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
