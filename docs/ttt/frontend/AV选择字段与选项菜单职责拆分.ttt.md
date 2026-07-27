# AV 选择字段与选项菜单职责拆分（TikTocTak）

> **最终目标**：保持单选/多选字段的搜索、创建、选中、移除、重命名、描述、颜色、删除、键盘导航、菜单定位和事务语义不变，将 701 行 `select.ts` 拆为单向职责子图并使其全部退出前端循环 SCC。
>
> **当前目标**：Select 已退出唯一 SCC；继续以行为测试固定批量选择值和字段元数据菜单，再拆分值操作、菜单和纯 HTML。
>
> **下一步任务**：为 add/remove 的首单元格变换、后续单元格复制、Table/Gallery 元素恢复和 Chip/Menu 定位建立行为测试。

## 不变量

- 单选和多选的选项顺序、颜色继承、新选项配色、重名规则和批量单元格复制语义保持。
- 选项重命名、描述、颜色与删除后，字段配置、已选值、Chip、滚动位置和菜单定位顺序保持。
- Enter、Backspace、输入法组合和上下键行为保持同步，不转成异步事件绕行。
- `cellValues` 当前跨 `getSelectHTML`、事件绑定和增删操作的状态生命周期必须先有行为测试，再决定是否进入统一注册表；不放入工厂闭包。
- 不通过动态导入、回调 Port、服务定位器、宽泛类型或 imports 多跳隐藏依赖。
- 相同事务生命周期复用既有严格命令，不创建同义 Select 命令。
- 若后续涉及 Menu class 抽象，必须依赖完整菜单领域根并做双向兼容校验，不创建按钮级接口。

## 现状基线

- `select.ts` 701 行，混合过滤 HTML、模块级单元格值状态、选项值变换、字段元数据编辑、Menu 构建、键盘事件、DOM 重绘、定位和事务。
- `openMenuPanel.click.cell.ts` 只为 `setColOption`、`addColOptionOrCell`、`removeCellOption` 加载完整 Select。
- 五处通用事务的 action 封闭集合为 `updateAttrViewCell`、`updateAttrViewColOptions`、`updateAttrViewColOption`、`removeAttrViewColOption`、`doUpdateUpdated`。
- 既有 `submitAVCellUpdateTransaction` 已覆盖除 `updateAttrViewColOption` 外的完整集合；调用域在提交前后拥有全部本地值、配置和 DOM 呈现决策。
- 阶段开始时生产图为 `2266` 节点、`317` 条代表环、唯一 SCC `599`；首环经 `openMenuPanel.click.cell -> select -> transaction` 返回。

## 目标架构

- `select/options.ts`：已有选择项配置合并和值颜色规范化算法。
- 后续 `select/value`：单元格选择值克隆、增删和可逆操作构造。
- 后续 `select/menu`：字段选项元数据编辑、菜单 DOM 和定位生命周期。
- 后续 `select/render`：过滤列表、Chip 与选择面板 HTML。
- `prepared/av/avCellUpdate.ts`：选择值和选择项配置的严格提交生命周期。
- `select.ts`：阶段完成后只保留组合入口，最终删除无职责转发。

## 近期计划

- [x] 将 `updateAttrViewColOption` 纳入 AV Cell Update 封闭 action 契约并增加接受/拒绝测试。
- [x] 迁移 Select 六处通用事务提交，不改变 do/undo 数组和本地更新顺序。
- [x] 运行 Select/Prepared 专项、完整 Node、契约类型、目标类型、lint、网关和 Madge/Tarjan。

## 中期计划

- [ ] 为 add/remove 的批量单元格值克隆及 DOM 呈现建立专项测试。
- [ ] 分离选项元数据 Menu、选择值操作和纯 HTML。
- [ ] 将 `cellValues` 生命周期纳入可枚举状态所有者，禁止以工厂闭包隐藏。

## 远期计划

- [ ] `select.ts` 及全部子职责退出唯一 SCC。
- [ ] 全部文件满足规模、参数和事件处理 lint 门禁。
- [ ] 桌面、移动、Table、Gallery 与自定义属性选择字段行为回归后归档。

## 风险与验收标准

- 必须验证新建选项同时提交列配置与单元格值，undo 仍按原顺序移除新选项。
- 必须验证既有选项只更新单元格值，不产生列配置操作。
- 非 Select action 必须在进入 Prepared 内核前显式失败。
- 以目标返回边归零和 Tarjan SCC 缩小为结构证据，不以代表环数量单调变化判断。
- 完整 Vitest 的既有 `fileTreeConfig.panel.vue` 缺失导入与 CaliburRouter 集合覆盖失败继续显式记录，不掩盖为通过。

## 已归档/已完成区域

- **2026-07-27**：`submitAVCellUpdateTransaction` 的封闭集合补齐 `updateAttrViewColOption`，与既有 cell/options/remove/updated action 共同覆盖 Select 的选择值和选项配置职责；Select 六个通用提交点原样迁移，do/undo 数组及本地更新时序未改变。专项 `8/8`、Node `199/199`、Protyle 契约类型、命令 lint、全量类型命令诊断 `0`、imports 多跳通过；生产图 `2266 / 317 / SCC 597`，相对阶段基线 SCC `599` 减少 2，Select、Options、Cell Click 与命令均在 SCC 外。Select 仍有 162 条既有严格类型诊断；lint 的 11 项均为已登记的 680 实际行文件规模及 10 个函数规模问题，继续以行为测试分层，不加豁免且不归档整体任务。

## 关联任务

- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
- [AV 单元格值更新与批量编辑职责拆分](./AV单元格值更新与批量编辑职责拆分.ttt.md)
- [AV 属性面板与资源交互职责拆分](./AV属性面板与资源交互职责拆分.ttt.md)
- [前端上帝对象领域拆分](./前端上帝对象领域拆分.ttt.md)
