# AV 单元格值更新与批量编辑职责拆分（TikTocTak）

> **最终目标**：保持 AV 剪切、粘贴、上传、键盘清空、关系回填、日期、选择项、拖拽与属性面板批量更新行为不变，将 `updateCellsValue` 上帝函数拆为单向值更新领域并消除全部循环路径。
>
> **当前目标**：建立值变换、操作构造和提交行为基线；Cell Update 已使用严格命令并退出循环 SCC。
>
> **下一步任务**：覆盖 Asset 追加、Select 去重/颜色、Block 文本、日期格式、跨行目标恢复与只返回 operations 分支，再拆分目标、值和呈现阶段。

## 不变量

- 活动/选中单元格、整行选择和显式 cellElements 的目标优先级保持。
- Table/Gallery/属性面板中脱离当前 DOM 的单元格恢复选择器保持。
- 只读列、缺失 row、后台隐藏新增行和非法日期/关系值的中止行为保持。
- Asset 追加、HTML 链接提取、Select 去重与颜色、Block icon、日期 formattedContent 保持。
- `text/json` 剪贴板快照顺序、do/undo 操作顺序和 `doUpdateUpdated` 时间戳保持。
- `getOperations=true` 只返回操作且不提交；默认分支继续在本地呈现后提交。
- 功能相同只保留唯一实现；不使用 `unknown`、断言扩散、动态导入、回调 Port 或工厂闭包掩盖依赖。
- 若产生跨调用状态，必须进入 SForge 注册表；纯调用局部数据不提升为全局状态。

## 现状基线

- `cell.update.ts` 约 230 行，`updateCellsValue` 单函数约 218 行并承担整个更新生命周期。
- 该函数被剪切、HTML 插入、上传、BlockAttr、ContextMenu、Keydown、Relation、Date、Panel、Drag 和 Cell Edit 共用。
- 建立任务前它仅为 `mergeAddOption` 加载 700+ 行 `select.ts`，形成 `cell.update -> select -> relation/view -> transaction` 返回路径。
- 当前生产图为 `2237` 节点、`351` 条代表环、唯一 SCC `626`。

## 目标架构

1. `cell/update/targets`：目标单元格收集、跨视图恢复和顺序快照。
2. `cell/update/value`：按 TAVCol 生成新值，复用完整值领域定义。
3. `select/options`：选择项列配置同步及可逆操作构造。
4. `cell/update/operations`：单元格 do/undo 与 updated 操作规划。
5. `cell/update/presentation`：属性面板 HTML 与普通 AV Animation 呈现。
6. `cell/update/command`：封闭 action 校验与 Prepared Transaction 提交。

## 近期计划

- [x] 将 `mergeAddOption` 从 Select DOM/菜单根迁入无 UI 依赖的 `select/options.ts`。
- [x] 覆盖既有选项颜色复用、新选项顺序与可逆操作载荷。
- [x] 默认提交改用封闭 AV Cell Update Prepared 命令，拒绝四种 action 以外的请求。
- [ ] 建立 Asset、Select、Block 与日期值变换测试。
- [ ] 建立目标恢复、剪贴板快照和 getOperations 分支测试。

## 中期计划

- [ ] 分离目标收集、值变换、操作规划和呈现阶段。
- [ ] 默认提交改用封闭 AV Cell Update Prepared 命令。
- [ ] 上传默认结果只依赖稳定 Cell Update 命令，不加载 Select/Relation/View 交互根。
- [ ] 使每个阶段满足函数与文件规模门禁。

## 远期计划

- [ ] Cell Update 与全部子域退出循环 SCC，不保留兼容 barrel 或第二实现。
- [ ] AV 剪切、粘贴、上传、关系、日期、选择与拖拽多视图回归完成。
- [ ] 与 [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md) 一并完成全源码零循环验收。

## 风险与验收标准

- 测试必须观察输入对象原地变更、DOM 呈现、操作数组和事务调用，不以 import 搜索替代行为证据。
- 日期接口请求、异步 Animation 与同步操作规划的顺序不得改变。
- 新模块专项、完整 Node、Protyle 契约类型、新代码 lint、imports 多跳、Madge/Tarjan 和 diff 检查通过。
- 代表环数量只用于定位；以目标路径归零、SCC 缩小和无新增 SCC 为结构验收。

## 已归档/已完成区域

- **2026-07-27**：`mergeAddOption` 完整迁入 `select/options.ts`，Cell Update 不再加载 Select DOM、菜单、模块级 cellValues 和事务。测试固定既有颜色回填以及按输入顺序新增 options/do/undo 的原地变更语义；生产图 `2237 / 351 / SCC 626`，新 options 叶子位于 SCC 外。
- **2026-07-27**：Cell Update 提交改用严格 `prepared/av/avCellUpdate.ts`，封闭 `updateAttrViewCell/updateAttrViewColOptions/removeAttrViewColOption/doUpdateUpdated`，本地值变换、列配置和 DOM 呈现顺序不变。五类命令契约 `5/5`、Protyle 契约类型、新命令 lint和网关门禁通过；生产图 `2238 / 324 / SCC 624`，Cell Update 与命令退出 SCC。后续仍以行为测试驱动拆分函数内部阶段。
- **2026-07-27**：严格命令补齐同一选择项配置职责中的 `updateAttrViewColOption`，Select 的选项重命名、描述、颜色、删除、创建以及单元格增删全部复用现有提交生命周期，不创建 Select 专用同义命令。契约/Options 专项 `8/8`、Node `199/199`、命令类型诊断 `0`；生产图 `2266 / 317 / SCC 597`，Select 和 Cell Click 退出 SCC。

## 关联任务

- [Protyle 上传编排与资源写入职责拆分](./Protyle上传编排与资源写入职责拆分.ttt.md)
- [AV 属性面板与资源交互职责拆分](./AV属性面板与资源交互职责拆分.ttt.md)
- [事务提交与本地同步职责拆分](./事务提交与本地同步职责拆分.ttt.md)
- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
