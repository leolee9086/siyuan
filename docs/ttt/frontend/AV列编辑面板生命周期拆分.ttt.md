# AV 列编辑面板生命周期拆分

## 最终目标

保持 Attribute View 列名称、描述、模板、时间显示、换行、选项和日期默认值的编辑行为不变，将 300 行 `col.editPanel.bind.ts` 的七组输入生命周期按完整职责分层，并使列编辑领域不再为已完成本地状态更新的 AV action 加载通用 Protyle DOM 事务分派。

## 当前目标

- [x] 登记七组列编辑生命周期与十类事务 action。
- [x] 建立封闭 AV Column Edit Prepared 命令并迁移全部提交点。
- [x] 验证字段编辑绑定模块的 SCC 变化。
- [ ] 按文本字段、布尔设置和选项编辑继续分层。

## 下一步任务

1. 为文本字段 blur/keydown/keyup 顺序补齐行为测试并迁入完整生命周期子域。
2. 为时间、换行和日期开关补齐状态更新行为测试并迁入布尔设置子域。
3. 为选项新增、去重、颜色分配和面板刷新补齐行为测试。
4. 每批复算生产图，保持实现唯一。

## 不变量

- 值未变化时继续跳过事务；Escape/Enter、输入法组合和焦点顺序不变。
- 名称表头动画、描述 aria、关系占位符、时间对象初始化、wrapField 与选项刷新语义不变。
- 严格命令只接受本模块真实提交的十类 action，非法 action 显式失败。
- 不创建调用点接口、回调 Port、事件绕行、动态导入、工厂闭包或服务定位器。
- 类与领域根继续使用现有完整抽象；本任务不新增碎片类型。

## 现状基线

- `col.editPanel.bind.ts` 300 行，公开七组绑定函数。
- 事务 action 为 `updateAttrViewCol`、`setAttrViewColDesc`、`updateAttrViewColTemplate`、`setAttrViewUpdatedIncludeTime`、`setAttrViewCreatedIncludeTime`、`setAttrViewColWrap`、`updateAttrViewColOptions`、`removeAttrViewColOption`、`setAttrViewColDateFillCreated`、`setAttrViewColDateFillSpecificTime`。
- 通用 `promiseTransaction` 不处理这些 AV action；调用域通过输入控件、`colData`、表头动画和面板刷新维护本地呈现。
- 阶段开始时生产图 `2259 / 319 / SCC 611`，首环经 `col.editPanel.bind -> transaction` 返回主链。

## 目标架构

- `transaction/prepared/av/avColumnEdit.ts`：封闭 action 校验并复用 Prepared Transaction 生命周期。
- `col.editPanel.bind.ts`：当前阶段保留七组 UI 生命周期，不加载通用 DOM 事务分派。
- 后续按文本字段、布尔设置和选项编辑建立子职责，不复制事件语义。

## 近期计划

- [x] 严格 Column Edit 命令、调用点迁移和 action 契约测试。
- [x] 完整 Node、目标 Vitest、类型、lint、网关、diff 和循环图验证。
- [ ] 七组 UI 生命周期职责分层。

## 中期计划

- [ ] 文本字段 blur/keydown 生命周期分层。
- [ ] 时间、换行和日期布尔设置生命周期分层。
- [ ] 选项新增与面板刷新生命周期分层。

## 远期计划

- [ ] Column Edit 子图退出唯一 SCC，综合绑定文件满足规模门禁。

## 风险与验收标准

- 每个 action 必须保留原 do/undo 对称关系，禁止补造额外操作。
- 十类合法 action 与非法 action 均有测试。
- 字段编辑绑定节点和严格命令的 SCC 身份通过 Tarjan 证明。
- 每阶段更新本 TTT、AV View 专项与总循环 TTT。

## 已归档/已完成区域

- **2026-07-27**：创建专项 TTT。确认十类 AV Column Edit action 均不进入通用事务普通块 DOM 分派，调用域拥有输入控件、`colData`、表头动画和面板刷新；登记 `2259 / 319 / SCC 611` 基线。
- **2026-07-27**：新增 `transaction/prepared/av/avColumnEdit.ts`，严格接受十类列编辑 action 并复用 Prepared undo、lite、同步指示、队列、请求和字数刷新；八个提交点保持原 do/undo、控件事件和本地 `colData` 更新顺序，非法 action 显式失败。专项 `11/11`、完整 Node `199/199`、Protyle 契约类型、新命令 lint、全量类型目标诊断 `0`、imports 多跳与 diff 检查通过；生产图 `2260 / 319 / SCC 610`。代表环总数不变，但 `col.editPanel.bind.ts` 和新命令均退出 SCC，首环转为 `col.editPanel.ts -> number.ts -> transaction`。事务阶段完成，七组 UI 生命周期继续由本专项追踪。
- **2026-07-27**：Column Edit 封闭集合补齐列编辑面板同域 `setAttrViewColIcon`；`openMenuPanel.click.colEdit.ts` 的图标与类型切换复用该命令，行号列排序和筛选分别使用独立 Sort/Filter 命令，不扩大 Column Edit 边界。专项三文件 `16/16`、Node `199/199`、契约类型和命令 lint通过；生产图 `2268 / 318 / SCC 596`，列编辑点击退出 SCC。

## 关联任务

- [AV 视图结构查询与菜单编排拆分](./AV视图结构查询与菜单编排拆分.ttt.md)
- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
