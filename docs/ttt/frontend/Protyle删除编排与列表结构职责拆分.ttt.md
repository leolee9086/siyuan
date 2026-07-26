# Protyle 删除编排与列表结构职责拆分 (TikTocTak)

## 最终目标

在保持删除、退格、列表提升、嵌入块边界和事务语义不变的前提下，拆分 `remove.ts` 与 `remove.removeLi.ts` 混合的删除编排、块层级解析、选区迁移和列表结构变换职责，消除该子域内部及其返回主 SCC 的循环依赖。

## 当前目标

- [x] 建立删除子域基线和行为测试。
- [x] 将块事务父级解析归入块层级查询领域。
- [x] 将删除前选区迁移归入带直达网关的独立删除焦点职责。
- [ ] 继续按实际控制流拆分删除编排与列表结构变换。

## 下一步任务

1. 复算 `remove.ts`、`remove.removeLi.ts`、`list.ts` 的 SCC 路径。
2. 拆分 464 行 `listOutdent` 的顶层缩出、嵌套缩出、后续块归并和事务提交职责。
3. 为下一项迁移补充等价 DOM 和事务操作测试后再移动实现。

## 不变量

- 不改变 Delete、Backspace 与显式 remove 的分支顺序和异步时机。
- 不使用回调注入、动态导入、事件或注册表隐藏删除行为依赖。
- 不复制算法；旧公开导出只能静态转发同一函数身份。
- 生产模块直达真实职责所有者，`imports.ts` 继续遵守零多跳门禁。
- 测试位于 `app/test`，不进入生产源码目录。

## 现状基线

- `remove.ts` 约 736 行，负责多块删除、普通块合并、嵌入块边界、图片删除、选区迁移和列表删除调度。
- `remove.removeLi.ts` 约 395 行，负责列表首项拆出、列表项合并、超级块合并和事务构造。
- 直接环为 `remove.ts -> remove.removeLi.ts -> remove.ts`；反向边来自 `getOperationParentID` 与 `moveToPrevious`。
- 全源码基线：`2186` 个节点、`529` 条代表环、唯一 SCC `682`。
- 首批迁移后：`2188` 个节点、`528` 条代表环、唯一 SCC `682`；新增 `remove/focus.ts`、`remove/imports.ts` 与既有 `getBlock.ts` 均在 SCC 外。

## 近期计划

- [x] 使用现有块层级查询作为 `getOperationParentID` 的唯一所有者。
- [x] 建立删除焦点职责并由 remove、removeLi、list 直接复用。
- [ ] 让 `remove.removeLi.ts` 退出与 `remove.ts` 的直接循环及更长返回路径。
- [x] 清除 `remove.removeLi.ts -> remove.ts` 直接反向边。
- [ ] 清除 `remove.removeLi.ts -> list.ts -> remove.ts` 返回路径。

## 中期计划

- [ ] 将列表结构变换与事务操作构造从 DOM 事件编排中分离并分别测试。
- [ ] 缩减删除根编排器的依赖扇出和主 SCC 返回边。

## 远期计划

- [ ] 与 [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md) 一并完成全源码零循环验收。

## 风险与验收标准

- 普通块、列表、超级块和允许子块操作的嵌入块父级标识保持一致。
- 删除前焦点仍优先使用前块 `wbr`，否则落到前块最后一个可编辑节点。
- 原公开函数身份可继续从 `remove.ts` 获取，内部依赖不再借根编排器转发。
- 专项 Vitest、Node、目标 TypeScript、lint、imports 多跳、循环图和 `git diff --check` 通过。

## 已完成记录

- **2026-07-26**：创建专项 TTT。`getOperationParentID` 迁入既有 `getBlock.ts`，`moveToPrevious` 迁入 `remove/focus.ts`；其专属 `remove/imports.ts` 直接指向选区与块查询唯一实现，不经过其它网关。`remove.removeLi.ts` 与 `list.ts` 直接引用真实所有者，`remove.ts` 保留静态同身份导出。新增专项测试覆盖普通/嵌入/顶层父级解析、非 Delete 保持选区以及 Delete 聚焦前一可编辑块。
- **2026-07-26**：依赖图复核确认 `remove.ts <-> remove.removeLi.ts` 两节点直接环归零，新增焦点子域与 `getBlock.ts` 位于主 SCC 外；代表环 `529 -> 528`，唯一 SCC 保持 `682`。剩余最短返回路径为 `remove.ts -> remove.removeLi.ts -> list.ts -> remove.ts`，实际反向能力是 464 行 `listOutdent`，继续按本 TTT 拆分而不以本批直接环消失宣告子域完成。专项 Vitest `3/3`、Node `175/175`、新子域 lint、imports 多跳和 diff 校验通过；完整类型检查可在约 44 秒结束，新子域无诊断，既有巨型删除/列表/块查询文件仍有存量严格空值诊断。完整 Vitest 首批 `44/44` 通过，第二批仍被既有 CaliburRouter `有交集()` 的 `undefined.filter` 阻断，失败 suite 仍为 `keydown.list/router` 与 `windowKeyDown/dialogHotkey`。
