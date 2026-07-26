# AV 属性面板与资源交互职责拆分（TikTocTak）

> **最终目标**：保持块属性面板、数据库反链、资源单元格编辑、预览、上传、复制、导出与打开菜单行为不变，将 657 行 `blockAttr.ts` 和 488 行 `asset.ts` 拆为单向领域子图，消除其全部循环路径并满足规模门禁。
>
> **当前目标**：建立 BlockAttr/Asset 交互基线，解除属性面板渲染经资源菜单工具、Editor 返回 Protyle 初始化的首环。
>
> **下一步任务**：为 Asset 值更新事务与批量复制建立行为基线，核定 `menus/util` 中复制、导出职责的真实所有权；不以只移动 `dragUpload` 文件但仍反向加载 Asset 根的方式制造伪拆分。

## 不变量

- 块属性面板的字段顺序、只读状态、图标、反链展开状态和事件传播保持。
- Asset 图片/文件 HTML、拖拽、批量单元格更新、压缩 URL、base64 写入、重命名、预览和上传顺序保持。
- 打开、复制 PNG、复制文件、导出、系统应用与子菜单的宿主差异不强行合并。
- 功能相同只保留唯一实现；菜单宿主语义不同时允许独立实现，不用上下文参数堆叠条件。
- 不通过动态导入、事件转发、服务定位器、工厂闭包或调用点 callback Port 隐藏返回边。
- 跨调用状态若出现必须进入 SForge 注册表；当前 DOM 事件闭包不提升为伪全局状态。
- 子域 `imports.ts` 直达真实声明或唯一实现，禁止网关多跳。
- 若涉及 class，先抽取完整领域根并通过 `PublicInstanceLooksLike` 双向校验，不创建只服务某按钮的碎片接口。

## 现状基线

- `blockAttr.ts` 657 行，混合数据请求、HTML 生成、键盘/鼠标事件、反链、字段编辑、资源委托和 Panel 导航。
- `asset.ts` 488 行，混合资源 HTML、单元格事务、编辑菜单、打开子菜单、复制/导出、拖拽与本地文件导入。
- `attributePanel.ts` 直接依赖完整 BlockAttr；BlockAttr 为两个 Asset 动作加载完整 Asset；Asset 再经 `menus/commonMenuItem/openMenu.ts`、`menus/util.ts` 返回 Window/Editor/Layout。
- 建立任务时生产图为 `2230` 节点、`353` 条代表环、唯一 SCC `632`，首环为 `onGet -> initUI -> attributePanel -> blockAttr -> asset -> menus/openWindow -> saveScroll`。

## 目标架构

1. `customAttr/identity`：无运行时依赖的自定义属性单元格身份。
2. `customAttr/render`：属性字段与反链纯呈现。
3. `customAttr/events`：属性面板键盘、鼠标和焦点生命周期。
4. `asset/value`：资源值读取、更新操作构造和单元格呈现。
5. `asset/editor`：资源编辑菜单和上传/拖拽生命周期。
6. `asset/actions`：打开、复制、导出和预览命令，按真实宿主边界复用现有菜单能力。

## 近期计划

- [x] 将 `data-av-id` 真值身份从 BlockAttr 归入无依赖叶子并迁移全部消费者。
- [ ] 为 BlockAttr HTML、反链和事件分支建立行为测试。
- [ ] 为 Asset 值更新的 do/undo 操作及批量复制语义建立测试。
- [ ] 分离 BlockAttr 对 Asset 编辑动作的依赖边。

## 中期计划

- [ ] 拆分属性字段渲染、反链呈现和事件绑定。
- [ ] 拆分 Asset 值更新、编辑菜单和宿主动作。
- [ ] 检查 `openMenu` 与 `menus/util` 的 AppFacade/Editor 依赖，复用完整现有抽象而非局部 Port。
- [ ] 使 BlockAttr 与 Asset 根文件满足函数/文件规模门禁。

## 远期计划

- [ ] AttributePanel、BlockAttr、Asset 子图全部退出循环 SCC。
- [ ] 删除旧综合实现和无消费者出口，不保留兼容 barrel。
- [ ] 完成桌面、Web 与移动端资源菜单交互回归后归档。

## 风险与验收标准

- 必须以真实 DOM 和事务载荷测试证明行为，不以 import 搜索替代运行验证。
- 资源菜单打开行为依赖 AppFacade 完整能力时直接使用既有完整抽象，不新建 `IAssetMenuHost` 一类碎片。
- 新子域专项、完整 Node、Protyle 契约类型、新代码 lint、网关多跳、Madge/Tarjan 与 diff 检查通过。
- 代表环数量只用于定位；以目标路径归零、SCC 缩小和无新增 SCC 为结构验收。

## 已归档/已完成区域

- **2026-07-27**：确认 Row 与 Select 只需 `data-av-id` 真值判定，唯一实现迁入 `customAttr/identity.ts`；缺失、空字符串和值三种 DOM 测试固定原语义。此叶子位于 SCC 外，Row 不再因身份判断加载 BlockAttr/Asset。后续 Row 事务进一步解环后生产图为 `2228 / 354 / SCC 638`，BlockAttr 仍参与 `200` 条代表环，因此建立本专项继续治理而不把身份叶子迁移视为整体完成。
- **2026-07-27**：确认资源上传与编辑不能仅靠移动函数解除首环，因为 `dragUpload` 仍需 Asset 值更新，`editAssetItem` 仍拥有真实菜单宿主语义；未创建回调 Port 或无效薄文件。先拆除窗口根网关附带加载的无关职责：`openNewWindow.ts` 改经 `window/open/imports.ts` 直达窗口创建依赖，不再加载窗口消息和锁屏。Asset/OpenMenu/Window/LockScreen 返回路径归零，`openNewWindow.ts` 与新网关退出 SCC；生产图 `2231 / 353 / SCC 627`。下一条真实返回路径为 `asset.ts -> menus/util.ts -> editor`，继续先建立资源值/菜单行为基线。

## 关联任务

- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
- [AV 渲染组合根与视图子域拆分](./AV渲染组合根与视图子域拆分.ttt.md)
- [AV 行渲染与虚拟滚动状态职责拆分](./AV行渲染与虚拟滚动状态职责拆分.ttt.md)
- [前端上帝对象领域拆分](./前端上帝对象领域拆分.ttt.md)
