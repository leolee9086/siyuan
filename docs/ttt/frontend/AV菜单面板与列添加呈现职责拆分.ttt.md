# AV 菜单面板与列添加呈现职责拆分（TikTocTak）

> **最终目标**：保持 AV 菜单面板的数据加载、类型渲染、事件分发、拖拽、关闭、列添加 DOM 动画和添加后编辑导航行为不变，将 407 行 `openMenuPanel.ts` 与 332 行 `col.addAttrViewColAnimation.ts` 拆为无反向依赖的完整职责子图。
>
> **当前目标**：在列添加返回链已经解除后，继续拆分 Panel 内容渲染、挂载定位和事件分发，使具体组合入口逐步退出主 SCC。
>
> **下一步任务**：沿当前首环审计 `cell/edit -> openMenuPanel -> openMenuPanel.click.view -> gallery/util -> action/click/cell` 的职责所有权，继续拆分 Panel 内容分发与 Cell Action 组合路径。

## 不变量

- 新列 ID、类型、名称、位置、默认宽度、表头图标、普通行占位和 `updated` 时序保持。
- 已有编辑面板时原地更新 HTML、绑定事件并重新定位；缺失面板时继续打开完整可交互编辑面板。
- Properties 中“新建列”、表头前后插入、BlockAttr 新增和重复列使用同一列添加规则，不复制 16 类菜单项逻辑。
- Panel 的关闭、焦点、菜单清理、拖拽和点击分发顺序保持。
- Panel 上下文状态若跨事件存在，进入统一注册表并具备显式销毁；不放入工厂闭包。
- 不用动态导入、事件转发、服务定位器、单方法 Port、调用点 callback 或宽泛类型隐藏返回边。
- 若形成 Panel class，必须先定义完整领域根，并用 `PublicInstanceLooksLike` 双向校验具体实现，不创建按钮级接口。
- `imports.ts` 保留并直达真实声明或唯一实现，禁止网关多跳。

## 现状基线

- `openMenuPanel.ts` 407 行：混合 API 请求、11 类 Panel HTML、DOM 挂载、定位、类型事件绑定、拖拽、点击路由、关闭和焦点恢复。
- `col.addAttrViewColAnimation.ts` 332 行：混合 Table 列 DOM、自定义属性行、已有编辑面板刷新、字段数据查询、缺失面板打开和菜单清理。
- `col/imports.ts` 的 `openMenuPanel` 不是附带依赖；列动画缺失 Panel 时确实调用完整入口。
- 直接将打开行为变成 callback/Port 会把循环从静态图隐藏到运行时，违反主任务不变量。
- 阶段开始时生产图 `2268` 节点、`318` 条代表环、唯一 SCC `596`；首环为 `openMenuPanel -> openMenuPanel.click.colOps -> col/addCol -> col.addAttrViewColAnimation -> col/imports -> openMenuPanel`。

## 目标架构

- `panel/state`：可枚举的当前 AV Panel 实例、上下文与销毁生命周期注册表。
- `panel/render`：按 Panel 类型生成内容和初始数据需求，不绑定点击路由。
- `panel/mount`：唯一 DOM 挂载、定位和关闭生命周期。
- `panel/interactions`：完整点击/拖拽分发，依赖 Panel 领域根而非具体装配入口。
- `col/add/presentation`：Table 列与自定义属性行的唯一同步 DOM 呈现。
- `col/add/edit-navigation`：基于完整 Panel 领域根执行已有面板刷新或新面板打开。
- `openMenuPanel.ts`：最终只保留组合入口；无消费者的兼容转发删除。

## 近期计划

- [x] 建立四种列添加呈现与导航行为测试。
- [x] 登记 Panel 完整公开表面并建立带厂牌领域根及双向契约校验。
- [x] 将列 DOM 呈现从菜单工厂中分离，保持唯一实现。
- [ ] 每批复算目标路径、Tarjan SCC、类型和事件行为。

## 中期计划

- [ ] 拆分 Panel 内容渲染、挂载定位和事件分发。
- [ ] 将跨事件 Panel 状态归入统一注册表并验证销毁。
- [ ] 使列添加导航依赖完整 Panel 抽象，不依赖具体组合入口。

## 远期计划

- [ ] 两个上帝模块全部满足规模门禁。
- [ ] Panel、Column Ops、AddCol 和 Column Animation 子图无循环。
- [ ] 桌面、移动、Table、Gallery、自定义属性和关系列添加行为回归后归档。

## 风险与验收标准

- 不以“Panel 能显示”替代交互验收；新面板必须继续支持编辑、Properties 导航、类型切换、删除和关闭。
- 不复制列类型清单、DOM HTML 或编辑面板打开算法。
- 专项、完整 Node、Protyle 契约类型、目标类型、lint、imports 多跳、Madge/Tarjan 与 diff 通过。
- 代表环数量只记录；目标返回链归零且 SCC 缩小才算结构阶段完成。

## 已归档/已完成区域

- **2026-07-27**：完成依赖意图审计并建立专项。确认返回边来自真实“缺失 Panel 后打开完整编辑面板”语义，拒绝用 callback、事件或服务定位器隐藏；登记 `2268 / 318 / SCC 596` 基线。
- **2026-07-27**：先清除 Column Ops 中与 Panel/AddCol 返回链无关的列可见性事务：批量与单列 hidden 更新复用 Column Edit 严格命令，本地字段和菜单刷新顺序不变。该直接事务边归零，但首环与 SCC 保持基线，未将局部完成误记为 Panel 阶段完成。
- **2026-07-27**：建立带模块级 Symbol 厂牌的完整 `AVMenuPanelDomain`，覆盖既有 `openMenuPanel/openViewMenu` 全部公开表面；实际 `avMenuPanel` 由独立契约测试使用 `StrictEqual` 双向校验。列添加的 Table 单元格、自定义属性行、已有面板刷新和缺失面板导航迁入唯一 `col/add/presentation.ts`，通过完整 Panel 外观参数传递，不再反向导入具体组合入口；菜单实例只在 `menu.factory.ts` 创建，未保存闭包状态。
- **2026-07-27**：添加列的封闭 action 集合明确为 `addAttrViewCol/removeAttrViewCol/doUpdateUpdated`，新增严格 Column Structure 命令复用 Prepared undo、lite、同步指示、队列和请求生命周期，非法 action 同步抛错；菜单不再加载通用 transaction DOM 分派主图。必需 `data-av-id/data-node-id` 在菜单项创建前显式校验，缺失身份不再进入半初始化或无身份提交。严格命令、菜单身份和四场景呈现专项 `11/11`、Panel 契约 `1/1`、完整 Node `200/200`、新增源码 lint、Protyle 契约类型、全量类型目标诊断 `0` 和 imports 多跳门禁通过。生产图 `2268 / 318 / SCC 596 -> 2270 / 306 / SCC 594`，Add Menu、Presentation 和命令均退出唯一 SCC，原 Panel/AddCol 返回链归零；新的首环转为 `openMenuPanel -> col.operations -> action/click -> col menu`，继续按真实列操作职责推进。
- **2026-07-27**：按 [AV 列结构变更生命周期拆分](./AV列结构变更生命周期拆分.ttt.md) 将添加、复制和两类删除统一到 Column Structure 严格命令，删除呈现从 Action 聚合迁回列结构子域；所有迁移节点退出 SCC。专项 `15/15`、源码 lint、Protyle 类型与网关门禁通过；代表环重排为 `312`，唯一 SCC `594 -> 591`，Panel 首环推进到 Groups 点击事务。
- **2026-07-27**：按 [AV 分组领域与面板交互拆分](./AV分组领域与面板交互拆分.ttt.md) 建立 Groups 六 action 严格命令，Panel 点击迁入独立子域，拖拽排序和折叠提交复用同一命令。专项 `10/10`、新子域 lint、目标类型和网关门禁通过；代表环保持 `312`，唯一 SCC `591 -> 590`，Panel 首环推进到 Sort/Filter 点击事务。
- **2026-07-27**：Sort 唯一实现从 AV 根迁入 `sorting/`，添加、字段切换、方向切换、清空、单项删除、拖拽和列菜单提交全部复用既有 `prepared/av/view/avSort.ts`，旧通用 transaction Sort 调用归零且不新增同义命令。无状态菜单实例化归入 `menu.factory.ts`，绑定生命周期使用完整 `SortPanelBinding` 输入；字段/方向变更继续原地修改原 sorts 数组并保留修改前深快照，非法 DOM 目标、方向和缺失排序身份显式失败。子域 `imports.ts` 逐项直达 Menu、列元数据、严格命令、定位、Emoji、视图 metadata、常量与 i18n 的真实声明，不经其它网关。行为/命令专项 `5/5`、完整 Node `200/200`、Protyle 契约、新子域 lint、全量类型检查 Sort 目标诊断 `0`、imports 多跳 `0` 与 diff 检查通过；生产图 `2280 / 304 / SCC 588`，相对前批 `312 / 590` 减少 `8` 条代表环和 `2` 个 SCC 成员，四个 Sorting 节点均为非循环单节点组件。Panel 整体仍在主 SCC，首环转到 Cell/Edit 与 View/Gallery/Action 路径，继续滚动拆分。

## 关联任务

- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
- [AV 列编辑面板生命周期拆分](./AV列编辑面板生命周期拆分.ttt.md)
- [AV 选择字段与选项菜单职责拆分](./AV选择字段与选项菜单职责拆分.ttt.md)
- [前端上帝对象领域拆分](./前端上帝对象领域拆分.ttt.md)
