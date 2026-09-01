/**
 * S-Forge 墓碑文件（Tombstone）
 * 本文件在本地分支被有意删除：refactor/move —— util 目录按领域拆分批次迁移（提交 5d9719aa24），Tree 类迁入 util/file/tree 并拆分为渲染/事件/类型模块。
 * 本地替代/迁移到：app/src/util/file/tree/Tree.ts（class Tree），配套 app/src/util/file/tree/tree.render.ts、tree.events.ts、tree.render.types.ts、treeBlock.guard.ts、tree.types.ts。
 * 上游 v3.8.0 对该文件的增量（经评审）：
 * 1. 新增大纲标题编号徽标 genOutlineNumberHTML()（含 b3-list-item__number--no-spacing 间距类与 escapeHtml 转义），依赖上游新增模块 protyle/util/headingNumberCore 的 headingNumberNeedsSpacing；
 * 2. 构造项新增 titleTooltipPosition（默认 "parentE"），用于列表项文本 span 的 data-position；
 * 3. 新增公开方法 createTopLevelItem(data: IBlockTree)：经 template + mathRender 渲染单个顶层节点并返回元素；
 * 4. 块条目模板渲染顺序调整：blockExtHTML 移至 countHTML 之前。
 * 增量去向：未移植。本地 v3.7.3 基线不存在 headingNumberCore，编号徽标无法直接落地；新 Tree 公共表面亦无 titleTooltipPosition / createTopLevelItem（已 grep 核实）。TODO：如需编号徽标须先移植 protyle/util/headingNumberCore 再按 tree.render.ts 模式补入；titleTooltipPosition、createTopLevelItem 可按 tree.render.ts / tree.events.ts 现有模式增补；escapeHtml 本地等价实现位于 app/src/util/DOM/escape.ts。
 * 引用核查：app/src 内无任何 import 指向本路径（merge 仓与本地主仓均确认）；同目录遗留未跟踪的 Tree.ts.remote / Tree.ts.backup 为先前手工合并残件，与本墓碑无关。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
