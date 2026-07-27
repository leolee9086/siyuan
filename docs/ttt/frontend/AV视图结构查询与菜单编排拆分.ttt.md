# AV 视图结构查询与菜单编排拆分

## 最终目标

保持 Attribute View 的视图菜单、配置、切换、字段读取和图标展示行为不变，将纯视图结构元数据与 `view.ts` 菜单交互组合根分离，使 OpenMenuPanel、Header 和其它 AV 子域不因读取字段或图标反向加载视图菜单编排。

## 当前目标

- [x] 登记 `view.ts <-> openMenuPanel.ts` 双向边和全部元数据消费者。
- [x] 提取视图结构元数据唯一实现并迁移消费者。
- [x] 建立字段身份与完整图标映射测试。
- [x] 验证元数据节点、SCC、类型、lint 和完整回归。
- [x] 设计并解除 View 菜单与配置面板的真实双向导航环。

## 下一步任务

1. 普通 View 事务阶段已完成；继续将 Panel 数据加载、HTML 分派、挂载与事件绑定从控制器分层。
2. 审计 `openMenuPanel.drag -> transaction` 的列选项与列排序职责，不将其并入 View 命令。
3. 继续缩短 View/OpenMenuPanel 经 AV 主图返回的间接路径。

## 不变量

- 字段查询必须返回原数组身份，不复制、不排序、不修改数据。
- Table 读取 `columns`，Gallery/Kanban 读取 `fields`，未知视图图标保持 `undefined`。
- 不创建调用点 Port、回调、事件、动态导入、工厂闭包或注册状态。
- `imports.ts` 保留且直达元数据真实所有者。
- 视图菜单事务、DOM、i18n 和面板开关顺序不变。

## 现状基线

- `view.ts` 约 456 行，同时承担菜单、编辑、切换、添加、拖拽以及三个纯查询。
- OpenMenuPanel 和十余个 AV 模块只为 `getFieldsByData` 反向加载完整 View 组合根。
- `view/imports.ts` 为 Header 反向转发 `getFieldsByData/getViewIcon`，扩大组合根扇出。
- 阶段开始时权威生产图为 `2198` 节点、`412` 条代表环、唯一 SCC `671`。

## 目标架构

- `view/metadata.ts`：字段集合和内置图标映射唯一实现，无运行时外部依赖。
- `view/name/resolve.ts`：内置视图名称映射唯一实现；经专属 `imports.ts` 直达 i18n，不加载 View 菜单事务。
- `view.ts`：视图菜单、编辑、添加、切换和拖拽编排。
- `view/imports.ts`：Header 外部依赖与同域元数据直达网关。
- 消费者：按职责直达 metadata 或 View 菜单组合根。

## 近期计划

- [x] 完成元数据叶子拆分，使结构查询节点退出 SCC。
- [x] 在不使用回调 Port 或事件隐藏依赖的前提下拆分双向导航状态。

## 中期计划

- [ ] 继续拆分 View 菜单 HTML、事件绑定、添加事务和拖拽职责。

## 远期计划

- [ ] View 与 OpenMenuPanel 子图退出唯一 SCC，View 组合文件满足规模门禁。

## 风险与验收标准

- 结构判断只能沿用现有 `table ? columns : fields` 语义，不新增未知类型回退策略。
- 所有旧导入必须清零，避免保留第二实现或兼容 barrel。
- 元数据专项、完整 Node、Protyle 契约类型、目标 lint、网关和 diff 检查通过。
- 目标直接环归零，最大 SCC 不新增成员。

## 已归档/已完成区域

- **2026-07-27**：创建专项 TTT。确认直接环来自纯结构查询错置于菜单组合根，不需要新增抽象接口或宿主参数。
- **2026-07-27**：新增 `view/metadata.ts` 与结构守卫，完整承接字段集合和内置图标映射；全部生产消费者及 `view/imports.ts` 直达唯一所有者，旧实现和旧导入归零。字段数组身份和三种图标专项 `2/2`、Node `188/188`、Protyle 契约类型、新文件 lint、imports 多跳和 diff 检查通过。生产节点 `2198 -> 2200`，代表环因路径重排 `412 -> 427`，但唯一 SCC `671 -> 668`，两个元数据节点均在 SCC 外且三个既有节点真实退出。`view.ts <-> openMenuPanel.ts` 仍因双向菜单导航存在，下一阶段按交互状态意图处理，不用回调或事件机械隐藏。
- **2026-07-27**：Panel 控制器成为双向导航唯一所有者：`openViewMenu` 原实现迁入 Panel，View 只保留复制/删除自身事务；View Click 返回 `handled/unhandled/open-view-menu` 判别命令，Panel 按原顺序打开菜单后阻止事件。命令类型和构造器位于无运行时依赖的 `view/navigation` 叶子，外部调用点直达 Panel，不用回调 Port、事件或动态导入。导航专项 `1/1`、Node `189/189`、Protyle 契约类型、新导航文件 lint、imports 多跳和 diff 检查通过。生产节点 `2200 -> 2202`、代表环 `427 -> 423`、最大 SCC保持 `668`；`view.ts <-> openMenuPanel.ts` 两节点环和导航叶子循环均为 `0`。Panel 控制器仍有 399 行、`renderData` 271 行及 `_propertiesHTMLDeps` 延迟状态，继续由本专项拆分。
- **2026-07-27**：普通 View 的八类 action（新增、删除、复制、排序、名称、描述、图标、布局类型）由严格 `submitAVViewTransaction` 封闭；名称/描述 blur、Switcher Enter、菜单移除及焦点恢复行为均由专项固定。该命令仅承载依赖服务端广播投影的普通 View 事务，未与调用域已同步应用 DOM 的 `submitAppliedAVViewTransaction` 强行合并。专项 `13/13`、Node `200/200`、目标类型诊断 `0`、imports 多跳 `0` 通过；生产图 `2290 / 309 / SCC 585`，`view.ts` 与 `openMenuPanel.click.view.ts` 退出循环组件。
- **2026-07-27**：删除 `_propertiesHTMLDeps` 模块级缓存和柯里化标记。该对象只承载只读渲染依赖，不是跨调用状态；`getPropertiesHTML` 现在在调用时构造参数并立即交给纯渲染器，继续避开模块初始化期 TDZ，不建立工厂闭包或注册表。新增调用局部依赖与字段不变性专项 `1/1`，Node `190/190`、Protyle 契约类型、网关和 diff 检查通过；生产图保持 `2202 / 423 / SCC 668`，不登记为解环成果。
- **2026-07-27**：进一步删除 Panel 中只服务 Properties 的包装实现和依赖参数，字段管理渲染归入 `col/properties` 唯一实现；Emoji、DOM 转义、i18n 和列图标由该子域 `imports.ts` 直达真实所有者，禁止经另一 imports 网关中转。Panel、Drag 与列操作均直达该实现，不保留兼容导出或零碎公共类型。真实实现专项 `1/1`、Node `190/190`、Protyle 契约类型、新子域 lint、imports 多跳和 diff 检查通过。生产图 `2203 / 424 / SCC 668`，新增子域处于 SCC 外；`Panel <-> Drag` 两节点环、Properties 所在环以及 `col.operations` 与 Panel 共环均为 `0`。代表环 `423 -> 424` 是叶子路径重排，唯一循环 SCC 数仍为 `1`。
- **2026-07-27**：按 [AV 筛选领域与面板导航拆分](./AV筛选领域与面板导航拆分.ttt.md) 将 Rollup 配置不足的编辑导航交回唯一列菜单调用方；Filter 返回列 ID，不再反向导入 Panel。运行时专项 `1/1`、Node `190/190` 与契约类型通过；代表环 `424 -> 421`、SCC 保持 `668`，Filter/Panel 全部共环归零。
- **2026-07-27**：综合 `col/col.ts` 的列身份、编辑生命周期和菜单编排拆为三个真实职责子域，所有消费者直达唯一所有者，旧文件及旧导入清零。原 `col.ts <-> openMenuPanel.ts` 两节点环与 Identity 子域循环归零；生产图 `2208 / 391 / SCC 649`，唯一 SCC 数仍为 `1`。新增职责节点进入既有 SCC 表明 Menu/Edit 仍经 Panel 主图返回，下一阶段依据实际最短路径继续拆分，不以代表环数量或节点搬迁冒充完成。
- **2026-07-27**：补齐此前仍错置于 390 行 View 事务菜单根的第三项结构展示元数据 `getViewName`。唯一名称映射迁入 `view/name/resolve.ts`，Relation 搜索结果与 View 配置 HTML 直达该实现，旧根删除导出；子域网关直达 i18n，未知类型继续返回 `undefined`，每次调用仍读取当前语言。首次采用 `view/metadata` 同名目录的布局被 Node/tsx 模块解析测试立即否定并清除，最终目录不存在文件/目录遮蔽。元数据专项 `3/3`、完整 Node `199/199`、Protyle 契约类型、新子域 lint、全量类型目标诊断 `0`、imports 多跳与 diff 检查通过。生产图 `2258 / 321 / SCC 613`，名称实现和网关位于 SCC 外；总量保持是因为 Relation 与 View 各自仍直接提交事务，但首环已从 `relation -> view -> transaction` 缩短为真实的 `relation -> transaction`，下一阶段据此审计关系事务所有权。
- **2026-07-27**：按 [AV 关系字段与关系单元格职责拆分](./AV关系字段与关系单元格职责拆分.ttt.md) 核定 Relation 四类 AV action 均不进入通用事务的普通块 DOM 分派，新增严格 Prepared 命令并保留关系列配置 undo 与新建关系行空 undo 语义。命令专项 `6/6`、完整 Node `199/199`、两层类型目标诊断 `0`、新命令 lint和网关门禁通过；生产图 `2259 / 319 / SCC 611`，Relation 与关系编辑绑定叶子退出 SCC。新的首环绕过 Relation，转为 `col.editPanel.bind -> transaction`，下一阶段直接审计该字段编辑生命周期。
- **2026-07-27**：建立 [AV 列编辑面板生命周期拆分](./AV列编辑面板生命周期拆分.ttt.md)。十类 Column Edit action 经严格 Prepared 命令提交，八个调用点保留原 do/undo 和本地输入/列数据更新；专项 `11/11`、完整 Node `199/199`、两层类型目标诊断 `0`、新命令 lint和网关门禁通过。生产图 `2260 / 319 / SCC 610`，字段编辑绑定叶子退出 SCC；代表环总数保持但首环推进到 `col.editPanel -> number -> transaction`，下一阶段审计数值格式领域。
- **2026-07-27**：Number Format 只提交 `updateAttrViewColNumberFormat`，菜单点击已拥有格式选择与面板关闭呈现，通用事务无本地分支；新增严格 `prepared/av/avNumberFormat.ts` 并保持 22 项菜单、标签和 do/undo 原样。同时按目录门禁将八个 AV Prepared 命令归入 `prepared/av`，子域网关直达内核，所有消费者直达新声明。八套专项 `39/39`、完整 Node `199/199`、两层类型目标诊断 `0`、子域 lint 与网关门禁通过；生产图 `2262 / 319 / SCC 609`，Number 与 Prepared AV 子域在 SCC 外，首环转为 `col.editPanel -> rollup -> transaction`。
- **2026-07-27**：Rollup 唯一 `updateAttrViewColRollup` action 直接复用已有 Calc 严格命令，未重复实现事务校验；选择关系列/目标列后的本地数据和菜单更新、原 do/undo 顺序不变。Calc 专项 `3/3`、完整 Node `199/199`、契约类型和网关门禁通过；全量类型检查中 Rollup 既有 50 条严格空值诊断如实保留。生产图 `2262 / 318 / SCC 605`，Rollup 及三条关联绑定路径退出 SCC，首环推进到 `openMenuPanel -> filter -> transaction`，后续回到已有 Filter 专项继续处理。
- **2026-07-27**：按 [AV 筛选领域与面板导航拆分](./AV筛选领域与面板导航拆分.ttt.md) 将全仓九个 `setAttrViewFilters` 提交点统一到严格 Filter 命令，Filter 树变换和面板 DOM 呈现仍由调用域拥有。命令/导航专项 `3/3`、完整 Node `199/199`、两层类型目标诊断 `0`、新命令 lint和网关门禁通过；生产图 `2263 / 320 / SCC 604`，Filter 根退出 SCC。代表环反升来自首环转向 `openMenuPanel.click.cell -> asset menu -> Hint/insertHTML`，下一阶段按该真实跨域路径处理。
- **2026-07-27**：Sort 字段读取继续直达本专项的 `view/metadata.ts`，排序 UI 唯一实现迁入 `sorting/` 并以专属网关逐项直达真实声明，未给 metadata 增加反向菜单依赖。添加/字段/方向与严格命令专项 `5/5`、Node `200/200`、Protyle 类型、新子域 lint和网关门禁通过；生产图 `2280 / 304 / SCC 588`，Sorting 四节点全部在循环 SCC 外。当前首环已绕过 Sort，转为 View Click 经 Gallery/Action 返回 Cell/Edit，继续按 View 与 Panel 真实编排职责拆分。
- **2026-07-27**：Gallery 的 Cover/Size/Ratio 设置从混合条目 Action 的 Util 迁入完整 Settings 子域，字段图标继续直达列元数据，四类 action 进入严格 Prepared 命令；旧设置实现和通用事务调用清零。专项 `9/9`、Node `200/200`、两层类型目标诊断 `0`、lint和网关门禁通过。生产图 `2288 / 311 / SCC 588`，Settings 与命令全部退出循环 SCC，View Click 不再经 Gallery Util/Action 返回；下一条真实路径转为 View Layout 的通用 transaction，按其本地呈现语义继续审计。
- **2026-07-27**：核定 Layout 六类 toggle 均由调用域更新当前 View/Fields，对多实例 DOM 的既有同步来自内核事务广播后的 `refreshAV`，通用 `promiseTransaction` 无额外 action 分支；新增严格 Layout Prepared 命令并保留同一内核请求和广播路径。common/gallery/kanban 绑定与命令专项 `10/10`、Node `200/200`、两层类型目标诊断 `0`、命令 lint和网关门禁通过。生产图 `2289 / 311 / SCC 587`，Layout 实现和命令退出循环组件，唯一 SCC 减少 `1`；当前首环转为 View Click 经综合 `view.ts` 进入通用事务，下一阶段逐 action 审计 View 元数据生命周期。

## 关联任务

- [AV 渲染组合根与视图子域拆分](./AV渲染组合根与视图子域拆分.ttt.md)
- [AV 关系字段与关系单元格职责拆分](./AV关系字段与关系单元格职责拆分.ttt.md)
- [AV 列编辑面板生命周期拆分](./AV列编辑面板生命周期拆分.ttt.md)
- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
