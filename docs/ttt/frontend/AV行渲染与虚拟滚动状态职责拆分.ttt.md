# AV 行渲染与虚拟滚动状态职责拆分

## 最终目标

在保持 AV 表格、画廊和看板的行 HTML、选择语义、虚拟裁剪、滚动位置与回填行为不变的前提下，拆分 853 行 Row 组合根和 499 行 VirtualScroll 组合模块，使行渲染、选择状态和虚拟滚动引擎形成单向依赖图。

## 当前目标

- [x] 登记 Row 与 VirtualScroll 的状态和互递边。
- [x] 将虚拟滚动跨调用状态迁入 SForge 统一注册表。
- [x] 将选择计数与表头同步迁入独立选择子域。
- [x] 清除 `row <-> virtualScroll` 与 `clearSelect <-> row` 两条直接环。

## 下一步任务

1. 增加注册表共享、选择快照与生命周期重置测试。
2. 增加表格全选、部分选择、清空与卡片计数 DOM 行为测试。
3. 修改全部生产调用方直达状态或选择真实所有者并复算 SCC。

## 不变量

- `getRowHTML` 保持唯一实现，虚拟滚动回填继续调用同一函数。
- 虚拟状态由 SForge 注册表统一拥有，不留工厂闭包或第二份模块状态。
- 选择快照、loadedCount、DOM 回退统计和表头图标语义保持不变。
- 不使用回调 Port、事件转发、动态导入、`unknown` 或断言隐藏依赖。
- `imports.ts` 保留，且直接指向状态或选择实现的真实所有者。

## 现状基线

- `row.ts` 853 行，同时包含行 HTML、选择、插入删除、分页和表头同步。
- `virtualScroll.ts` 499 行，同时拥有四类模块状态、选择快照和依赖 Row 的裁剪渲染。
- `row.ts <-> virtualScroll.ts` 与 `clearSelect.ts <-> row.ts` 为两条最短直接环。
- 阶段开始时源码节点 `2201`、代表环 `420`、唯一 SCC `675`。

## 目标架构

- `virtualScroll/virtualScroll.types.ts`：完整注册状态类型。
- `virtualScroll/state.ts`：SForge 状态所有权、数据源和选择快照。
- `virtualScroll.ts`：依赖 Row 与状态的裁剪引擎。
- `selection/header.ts`：依赖状态的选择计数与表头同步。
- `row.ts`：依赖状态和选择子域的行行为组合根。

## 近期计划

- [x] 完成状态与选择首批拆分并通过行为验证。
- [x] 两条目标直接环归零。

## 中期计划

- 行 HTML、行事务、分页与选择操作继续按真实职责拆分。
- 虚拟裁剪算法拆分测量、窗口计算、DOM 回填和选择恢复。

## 远期计划

- Row 与 VirtualScroll 均满足文件和函数规模门禁。
- AV 行与虚拟滚动子图退出主 SCC。

## 风险与验收标准

- 快速滚动、Ctrl+Home、分组、ghost 行和多列 Gallery 不得改变渲染窗口。
- 选择快照必须在 trim 移除和回填后保持准确。
- 注册表测试、选择 DOM 测试、Node/Vitest、目标类型、lint、网关与依赖图验证通过。

## 已归档/已完成区域

- **2026-07-27**：创建专项 TTT 并完成首批拆分。`AVVirtualScrollRegistryState` 完整覆盖数据源、body 窗口、trim pending 与滚动方向状态，通过独立 SForge Symbol 精确登记；选择快照和 view 数据访问归入 `virtualScroll/state.ts`，裁剪引擎只依赖 Row 与状态。`updateHeader` 唯一实现迁入 `selection/header.ts`，全部生产消费者直达状态或选择所有者，不保留 Row 转发。注册表/选择 DOM 专项 `2/2`、Node `183/183`、新子域 lint、目标类型诊断、imports 多跳与 diff 校验通过。`row.ts` 由 `853` 降至 `813` 行，`virtualScroll.ts` 由 `499` 降至 `429` 行；源码节点 `2206`，代表环 `420 -> 417`，唯一 SCC `675 -> 672`，两条目标直接环归零且新状态节点未形成独立 SCC。
