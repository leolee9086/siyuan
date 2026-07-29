# Protyle 删除编排与列表结构职责拆分 (TikTocTak)

## 最终目标

在保持删除、退格、列表提升、嵌入块边界和事务语义不变的前提下，拆分 `remove.ts` 与 `remove.removeLi.ts` 混合的删除编排、块层级解析、选区迁移和列表结构变换职责，消除该子域内部及其返回主 SCC 的循环依赖。

## 当前目标

- [x] 建立删除子域基线和行为测试。
- [x] 将块事务父级解析归入块层级查询领域。
- [x] 将删除前选区迁移归入带直达网关的独立删除焦点职责。
- [x] 统一 `addSubList` 生产入口，补齐列表动作、Alt+Enter 和事务身份回归。
- [ ] 按实际控制流拆分 `list.ts`，并清零各列表领域的 TypeScript 诊断。

## 下一步任务

1. 以现有 11 项行为测试为门禁，先提取列表结构解析和必需事务身份，不改变 DOM 变更与操作顺序。
2. 按 `listIndent`、`breakList`、`listOutdent` 三个完整领域动作拆分顶层缩出、嵌套缩出、后续块归并和事务提交职责，不创建调用点碎片接口。
3. 每完成一个领域动作，运行专项测试与完整 TypeScript 检查并记录诊断变化；类型错误归零前不处理 lint。

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
- 2026-07-29 当前依赖图为 `2413` 个 `app/src` 文件、`0` 个循环；结构门禁已达成。全量 TypeScript 检查共有 `12,215` 条诊断，`list.ts` 仍约 `950` 行并以 `234` 条成为最高单文件。新增直接测试已覆盖六个公开动作并通过 `6/6`，但测试自身尚有两条类型错误，且 `addSubList` 测到的是 `list.ts` 实现，Alt+Enter 生产入口仍调用行为不同的 `list.addSubList.ts`，当前证据不足以机械合并。

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
- 当前执行顺序为先清零 TypeScript 诊断、后处理 lint；lint 不在类型归零前驱动实现重写。

## 已完成记录

- **2026-07-26**：创建专项 TTT。`getOperationParentID` 迁入既有 `getBlock.ts`，`moveToPrevious` 迁入 `remove/focus.ts`；其专属 `remove/imports.ts` 直接指向选区与块查询唯一实现，不经过其它网关。`remove.removeLi.ts` 与 `list.ts` 直接引用真实所有者，`remove.ts` 保留静态同身份导出。新增专项测试覆盖普通/嵌入/顶层父级解析、非 Delete 保持选区以及 Delete 聚焦前一可编辑块。
- **2026-07-26**：依赖图复核确认 `remove.ts <-> remove.removeLi.ts` 两节点直接环归零，新增焦点子域与 `getBlock.ts` 位于主 SCC 外；代表环 `529 -> 528`，唯一 SCC 保持 `682`。剩余最短返回路径为 `remove.ts -> remove.removeLi.ts -> list.ts -> remove.ts`，实际反向能力是 464 行 `listOutdent`，继续按本 TTT 拆分而不以本批直接环消失宣告子域完成。专项 Vitest `3/3`、Node `175/175`、新子域 lint、imports 多跳和 diff 校验通过；完整类型检查可在约 44 秒结束，新子域无诊断，既有巨型删除/列表/块查询文件仍有存量严格空值诊断。完整 Vitest 首批 `44/44` 通过，第二批仍被既有 CaliburRouter `有交集()` 的 `undefined.filter` 阻断，失败 suite 仍为 `keydown.list/router` 与 `windowKeyDown/dialogHotkey`。
- **2026-07-29**：`keydown.list` 的 Zod 路由迁移已通过 `41/41` 行为回归；迁移后暴露的 `transformSubRouter` 声明不可移植问题已在 [CaliburRouter 类型性能与多 Schema 后端评估](./CaliburRouter类型性能与多Schema后端评估.ttt.md) Phase 6 从公共类型根修复。应用侧未增加遮盖性注解，列表主线继续以补齐公开动作行为测试和清理 `list.ts` 严格类型诊断为下一步。
- **2026-07-29 类型收敛新基线**：重新执行 `pnpm lint:cycles`，处理 `2413` 个 `app/src` 文件且无循环；完整 `pnpm typecheck --pretty false` 在约 52 秒内结束并报告 `12,215` 条诊断。`list.ts` 的 `234` 条仍为最高单文件，集中于未编码的非空列表选择、DOM 父子/属性节点、必需事务 ID、配置阶段状态与事务返回类型。本阶段只使用 cycle 结果确认结构门禁，不在类型归零前处理其它 lint。
- **2026-07-29 列表生产入口与事务门禁闭合**：生产侧 Alt+Enter 改为直达 `list.ts` 的唯一 `addSubList`；行为不同的 `list.addSubList.ts` 删除实现并保留无导出墓碑，不设兼容转发。`listItemActions.test.ts` 扩展至 11 项，覆盖新建/追加子列表、非列表输入、真实 Alt+Enter 中间件、任务切换，以及缩进、中断、缩出的操作 ID、顺序和 do/undo 对称性；测试文件自身 TypeScript 诊断归零。传统顶层缩出测试先稳定复现循环已移动完后续项却额外产生 `id: ""` 的尾部 `move`，随后删除该无 DOM 对应物的合并残留；专项 Vitest 由 `10/11` 恢复为 `11/11`。
