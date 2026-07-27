# AV 列结构变更生命周期拆分（TikTocTak）

> **最终目标**：保持 AV 列添加、复制、删除、双向关系目标删除、更新时间和本地 DOM/Panel 呈现语义不变，将列结构变更收口为唯一严格事务生命周期，使 Column Operations、Column Menu 与通用 Action/Transaction 主图解除反向依赖。
>
> **当前目标**：在结构命令与删除呈现均退出 SCC 后，继续拆分复制数据变换、Panel 删除和 Panel 刷新编排，降低 `operations.ts` 的聚合职责。
>
> **下一步任务**：先为重复列字段数组身份、名称/ID 生成和添加后编辑导航建立行为测试，再判断复制与删除是否应分成结构子域内的独立编排文件。

## 不变量

- 添加继续提交 `addAttrViewCol + doUpdateUpdated`，undo 为 `removeAttrViewCol + doUpdateUpdated`。
- 复制继续提交 `duplicateAttrViewKey + doUpdateUpdated`，undo 为 `removeAttrViewCol + doUpdateUpdated`。
- 删除继续提交 `removeAttrViewCol + doUpdateUpdated`，undo 为携带原名称、类型、位置的 `addAttrViewCol + doUpdateUpdated`。
- 双向关系删除的 `removeDest` 保持调用场景原值，不在结构命令中重新决策。
- 所有本地列单元格移除、字段数组变更、Panel HTML/定位和 `updated` 回写顺序保持。
- 结构命令仅接受完整封闭 action 集合，任何其它 action 同步抛错，不静默忽略。
- 删除 DOM 呈现只有一个真实实现；不保留 Action 聚合兼容出口或复制选择器逻辑。
- 不使用动态导入、事件转发、单方法 Port、调用点 callback、工厂闭包或宽泛类型隐藏依赖。
- `imports.ts` 保留并直达真实声明或唯一实现，禁止网关多跳。

## 现状基线

- 添加列已由严格 `avColumnAdd.ts` 提交并退出唯一 SCC。
- `col.operations.ts` 同时拥有复制、Panel 删除、字段数组变更和 Panel 呈现，仍直接加载通用 transaction。
- `col.removeColByMenu.ts` 拥有菜单删除事务和 `updated` 回写，仍直接加载通用 transaction。
- 唯一 `removeAttrViewColAnimation` 实现位于 `action/animation.ts`，并由 `action/index.ts` 聚合导出；两个列删除调用点因此加载点击、右键和列菜单主图。
- 阶段开始时生产图 `2270` 节点、`306` 条代表环、唯一 SCC `594`；首环经 `openMenuPanel -> col.operations -> action/index -> action/click -> col menu` 返回。

## 目标架构

- `prepared/av/avColumnStructure.ts`：添加、复制、删除与更新时间的唯一严格提交命令。
- `col/remove/presentation.ts`：按列 ID 移除当前 AV DOM 单元格的唯一同步呈现。
- `col/add/*`：添加菜单和添加后 DOM/编辑导航，不持有通用事务主图。
- `col.operations.ts`：暂保留复制与 Panel 删除编排，全部通过结构命令和列呈现子域执行。
- `col.removeColByMenu.ts`：暂保留列菜单删除编排，全部通过同一结构命令和呈现子域执行。

## 近期计划

- [x] 建立四种结构 action 的严格命令测试和非法 action 测试。
- [x] 建立删除呈现的目标列、多行、无匹配行为测试。
- [x] 迁移添加、复制、Panel 删除和菜单删除提交点。
- [x] 删除 `action/index.ts` 的列删除呈现出口，确认消费者归零。
- [x] 复算代表环、Tarjan SCC 和目标节点成员身份。

## 中期计划

- [ ] 按职责拆分 `col.operations.ts` 中复制数据变换、Panel 删除和 Panel 刷新编排。
- [ ] 固定重复列名称、ID、字段数组身份和添加后编辑导航行为。
- [ ] 固定普通列、关系列和双向关系目标删除的交互路径。

## 远期计划

- [ ] Column Operations、Column Menu、Column Structure 命令和删除呈现全部退出应用主 SCC。
- [ ] 列结构子域满足文件、函数和目录规模门禁。
- [ ] 与 AV Panel、列菜单和列领域重复实现专项共同归档。

## 风险与验收标准

- 不因 action 集合相似把筛选、排序、值更新或字段配置并入 Column Structure。
- 不把 DOM 呈现移入事务命令；命令只负责校验和提交完整操作集。
- 不因代表环阶段性增减判断成败；以目标边归零、SCC 成员退出和行为测试为准。
- 专项、完整 Node、Protyle 契约类型、全量类型目标诊断、源码 lint、imports 多跳、循环图和 diff 检查均需登记。

## 已归档/已完成区域

- **2026-07-27**：创建专项。确认添加、复制、Panel 删除和菜单删除属于同一个 Column Structure 事务领域；删除 DOM 呈现错置于通用 Action 聚合入口，是当前首环的真实返回边。登记 `2270 / 306 / SCC 594` 基线，不以单行直导暂时掩盖结构事务仍加载通用主图。
- **2026-07-27**：`avColumnAdd` 原子升级为唯一 `avColumnStructure`，封闭接受 `addAttrViewCol/removeAttrViewCol/duplicateAttrViewKey/doUpdateUpdated` 并显式拒绝其它 action；添加、复制、Panel 删除和列菜单删除全部复用该命令，不保留旧名转发。唯一列删除 DOM 实现迁入 `col/structure/presentation.ts`，Action 聚合出口和生产引用归零；复制与两种删除编排迁入结构子域并经自己的 `imports.ts` 直达真实所有者。专项 `15/15`、新增源码 lint、Protyle 契约类型和 imports 多跳门禁通过。代表环因首路径重排 `306 -> 312`，但唯一 SCC `594 -> 591`，Operations、RemoveByMenu、Presentation、网关与严格命令全部退出；新首环转为 `openMenuPanel.click.groups -> transaction`，结构阶段完成，文件职责拆分继续滚动。

## 关联任务

- [AV 菜单面板与列添加呈现职责拆分](./AV菜单面板与列添加呈现职责拆分.ttt.md)
- [AV 列领域重复实现回归清理](./AV列领域重复实现回归清理.ttt.md)
- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
