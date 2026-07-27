# AV Gallery 布局设置与条目交互拆分（TikTocTak）

> **最终目标**：保持 Gallery/Kanban 封面来源、卡片尺寸、宽高比、条目编辑和右键菜单行为不变，将混合设置事务与条目 Action 的 `gallery/util.ts` 拆为单向职责子图，并使布局设置与条目交互分别退出前端循环 SCC。
>
> **当前目标**：Gallery Settings 已全部退出循环 SCC；继续拆分仍处于主 SCC 的条目编辑与右键菜单职责，使 `gallery/util.ts` 最终退出。
>
> **下一步任务**：审计条目编辑和右键菜单消费者，确认 `gallery/util -> action` 的保留边能否按完整 Item Interaction 领域进一步单向化。

## 不变量

- 封面来源菜单顺序保持“无、内容块、内容图片、资源字段”，只在首个资源字段前加入分隔线。
- 每次点击继续以点击时的 `view` 旧值构造 undo，提交后原地更新同一 `IAVGallery` 对象和当前菜单标签。
- 卡片尺寸继续使用 `0/1/2`，宽高比继续使用 `0..6` 与既有 `16:9` 至 `1:1` 映射。
- `setAttrViewCardSize/setAttrViewCardAspectRatio` 的多实例 DOM 刷新继续由内核事务广播进入 `render.refresh.ts`，不得因提交入口变化丢失。
- Gallery 条目编辑和右键菜单继续复用唯一 `avContextmenu`，不复制 Action 行为。
- 不用事件绕行、动态导入、服务定位器、状态工厂闭包、按钮级 Port 或宽泛类型隐藏依赖。
- `imports.ts` 保留且每项直达真实声明或唯一实现，禁止网关经网关转发。

## 现状基线

- `gallery/util.ts` 288 行，同时拥有三套布局菜单、宽高比映射、条目字段显隐和条目右键菜单。
- `openMenuPanel.click.view.ts` 仅消费布局设置，却因同文件的 `avContextmenu` 导入加载完整 Action/Cell/Edit 主图。
- 四类设置 action 为 `setAttrViewCoverFrom/setAttrViewCoverFromAssetKeyID/setAttrViewCardSize/setAttrViewCardAspectRatio`，生产提交点只存在于本模块。
- 通用 `promiseTransaction` 没有四类 action 的本地分派；Card Size/Ratio 的 DOM 更新由事务广播后的 `transaction.onTransaction -> render.refresh` 完成。
- 阶段开始时权威生产图为 `2280` 节点、`304` 条代表环、唯一循环 SCC `588`；首环经 View Click、Gallery Util、Action Cell 返回 Cell Edit/Panel。

## 目标架构

- `gallery/settings`：完整拥有 Cover、Size、Ratio 菜单和宽高比映射，不依赖 Action 根。
- `prepared/av/view/avGallery.ts`：严格接受四类 Gallery 设置 action，复用 Prepared 提交生命周期。
- `gallery/util.ts`：只保留条目编辑与右键菜单，依赖条目 Action 所有者。
- `openMenuPanel.click.view.ts` 与 `layout.ts`：直达 Gallery Settings 唯一实现。

## 近期计划

- [x] 为四类 action 建立严格命令契约测试。
- [x] 为封面菜单、尺寸菜单、比例菜单建立行为测试，固定 do/undo、对象更新、标签和菜单定位。
- [x] 将 Gallery Settings 唯一实现迁出 `gallery/util.ts`，旧导出和旧引用清零。
- [x] 运行专项、Node、Protyle 类型、目标类型、lint、网关、Madge/Tarjan 和 diff 检查。

## 中期计划

- [ ] 审计 Gallery 条目编辑与右键菜单是否需要继续分层，避免 util 再次聚合设置职责。
- [ ] 将 Gallery 相关跨调用状态统一纳入既有注册表，若无状态则保持无注册表实现。

## 远期计划

- [ ] Gallery Settings 与 Item Interaction 全部退出唯一循环 SCC。
- [ ] Gallery/Kanban 桌面、移动和多实例事务广播行为回归后归档。

## 风险与验收标准

- Prepared 命令只在确认通用事务无额外本地分派后使用；远端 `render.refresh` 路径必须保留。
- 不把 Cover、Size、Ratio 拆成调用方临时接口；它们共同构成 Gallery 布局设置领域。
- 旧 `gallery/util.ts` 设置实现、兼容转发和通用 transaction 设置提交必须归零。
- 代表环只记录；以目标返回边归零、目标节点退出 SCC和行为测试通过作为结构证据。

## 已归档/已完成区域

- **2026-07-27**：创建专项并完成依赖意图审计。确认首环并非 Panel 必须依赖 Item Action，而是三套 Gallery 设置与条目菜单错置于同一 util；登记 `2280 / 304 / SCC 588` 基线和四类 action 的事务广播刷新不变量。
- **2026-07-27**：Gallery Settings 按 Cover、Size、Ratio 三个完整行为模块归入同一子域，共享唯一 `GallerySettingOptions/GallerySettingContext`，没有按按钮创建 Port；菜单实例只在无状态 `.factory.ts` 同步构造。新增严格 `prepared/av/view/avGallery.ts`，封闭接受四类设置 action 并复用 Prepared 内核，内核广播后的既有 `transaction.onTransaction -> render.refresh` 路径未改动。旧 `gallery/util.ts` 设置实现、兼容出口和通用 transaction 设置提交归零，只保留条目编辑/右键菜单。封面顺序、资源分隔、点击时 undo、尺寸、比例、标签、定位和身份失败行为与命令专项 `9/9`，完整 Node `200/200`、Protyle 契约、新子域 lint、全量类型目标诊断 `0`、imports 多跳 `0` 与 diff 检查通过。生产图 `2288 / 311 / SCC 588`；七个 Settings 节点及严格命令全部为非循环单节点，目标 `View Click -> Gallery Util -> Action` 路径归零；唯一 SCC 未缩小，代表环反升为下一条 `View Click -> layout -> transaction` 的重新枚举，条目 Util 仍因真实 Action 依赖留在 SCC。

## 关联任务

- [AV 菜单面板与列添加呈现职责拆分](./AV菜单面板与列添加呈现职责拆分.ttt.md)
- [AV 视图结构查询与菜单编排拆分](./AV视图结构查询与菜单编排拆分.ttt.md)
- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
