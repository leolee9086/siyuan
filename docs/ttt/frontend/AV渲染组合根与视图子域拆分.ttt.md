# AV 渲染组合根与视图子域拆分（TikTocTak）

> **最终目标**：在保持 Attribute View 表格、画廊、看板运行语义和 `imports.ts` 可见性的前提下，将 AV 渲染组合根拆为单向领域子图，消除该子系统全部循环依赖，并使各具体实现满足项目类型与函数规模门禁。
>
> **当前目标**：完成视图 Header 与跨视图调度边界，继续拆分 `avRender` 的数据获取、状态快照和 table 渲染编排。
>
> **下一步任务**：提取三类视图共享的请求/定位状态采集与数据获取流程；为 table、gallery、kanban 建立运行行为测试，再处理卡片视图共同后处理。

## 不变量

- 不绕过或删除 `imports.ts` 网关；新子目录通过自己的网关显式登记跨域实现依赖。
- 不以动态导入、全局注册表或延迟加载隐藏静态循环。
- 跨视图切换必须复用当前服务端响应，不得重复请求、丢弃 locate 参数或改变过期渲染隔离语义。
- Header、搜索、虚拟滚动、选择恢复、编辑状态、分页、回调和 `finishAVLocate` 的顺序保持不变。
- 不为单个调用点制造能力碎片；共享参数必须代表完整的视图渲染请求或稳定领域状态。
- class 进入该子图时先抽取完整公共领域接口，并在 `app/test` 使用 `LooksLike.types.ts` 校验具体实现。
- 每批执行 Protyle 类型门禁、相关行为测试、专项 lint、Madge 和 `git diff --check`，完成文件及时暂存。

## 关联任务

- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
- [前端上帝对象领域拆分](./前端上帝对象领域拆分.ttt.md)
- [抽象碎片清理与领域根归并](./抽象碎片清理与领域根归并.ttt.md)

## 现状基线

- **2026-07-25**：主循环扫描为 `2185` 文件、`902` 条循环；AV 直接环包含 `render -> gallery -> kanban`、`render -> gallery`、`render -> render.table`、`render -> render.refresh` 等。
- `avRender` 同时承担元素枚举、状态快照、服务端请求、过期响应隔离、跨视图分派、table DOM 组装与后处理。
- `renderGallery`/`renderKanban` 各自重复请求与状态采集，并在响应视图变化时直接导入兄弟实现或根调度器。
- `genTabHeaderHTML` 位于根 `render.ts`，导致所有子视图为复用纯 Header 反向依赖组合根。
- lint 基线：`avRender` 约 204 行，`renderGallery` 约 156 行，`renderKanban` 约 164 行；`render.table.ts` 与 gallery 文件同时超过文件/函数规模门禁。

## 目标架构

```text
AV 根调度器
  -> 数据获取与定位状态
  -> table renderer
  -> gallery renderer
  -> kanban renderer

子视图 -> AVViewRenderer（参数） -> 根调度器
子视图 -> view/header
子视图 -> 自有状态采集与后处理子域
```

## 分阶段计划

### Phase 1：稳定视图公共边界

- [x] 将 Header 唯一实现迁入 `av/view/header.ts`，按过滤、页签、动作和最终组装拆分纯函数。
- [x] 建立完整 `AVViewRenderRequest`/`AVViewRenderer`，由根注入 gallery/kanban。
- [x] 搜索刷新由根以回调注入 table/gallery/kanban，子视图不再导入根实现。
- [x] 异步响应切换视图时复用同一 `IAV` 数据并回到根调度，不直接调用兄弟渲染器。

### Phase 2：根调度器瘦身

- [ ] 提取 table 状态快照，覆盖选中单元格、行、拖拽填充、active 状态、虚拟窗口和滚动偏移。
- [ ] 提取统一 AV 请求构造与 fetch，保持 history/snapshot/locate/createIfNotExist 差异。
- [ ] 根只保留元素枚举、过期 token 校验和视图分派。

### Phase 3：具体视图拆分

- [ ] table 拆分 Header/Body HTML、分组编排、状态恢复与搜索/虚拟滚动后处理。
- [ ] gallery/kanban 共享卡片状态快照与后处理，保留两种布局和分组差异。
- [ ] 移除 Kanban 对 Gallery 实现文件的单向依赖，改依赖卡片视图领域模块。
  - 约束：卡片后处理当前同时依赖内容渲染注册表、选择区、定位、行头、搜索与虚拟滚动；在这些依赖完成单向化前，禁止仅搬迁函数或用 Host 回调改换依赖落点。
- [x] 将分页 DOM 快照归入 `view/pagination.ts`，Row 与 Gallery 插入逻辑同向复用。
- [x] 建立 `value` 属性值渲染子域和显式依赖网关，Asset、Cell、Select、BlockAttr 不再经交互控制器复用纯渲染。

### Phase 4：验证与归档

- [ ] 为根分派、跨视图响应、过期 token、Header 和三类状态恢复增加行为测试。
- [ ] AV 子图不再出现在 `pnpm lint:cycles` 报告中。
- [ ] 新增文件 lint 清零，既有 AV 大函数完成拆分并通过规模门禁。
- [ ] TypeScript、Protyle 契约测试、Vitest、Madge 和 `git diff --check` 通过。

## 风险与验收

- 跨视图响应分派若重新 fetch，会导致闪烁、请求竞态和 locate 丢失，必须以测试锁定复用数据。
- Gallery/Kanban 的共同后处理包含 DOM 选择恢复和虚拟滚动，抽取时不得把布局特有选择器强行统一。
- 验收要求：运行行为与当前一致；AV 直接/间接循环归零；根与具体视图职责单向；测试与门禁全部通过。

## 已完成记录

- **2026-07-25**：创建本 TTT。完成 Phase 1：新增 `av/view/render.types.ts` 的完整根调度契约；Header 迁入 `av/view/header.ts` 并由子域 `imports.ts` 显式组织依赖；gallery/kanban 通过参数请求根分派已解析数据，table/gallery/kanban 的搜索刷新由根注入。`typecheck:protyle-contract` 通过，新 view 子域 lint 清零，Madge 从 `902` 降至 `900`（`2189` 文件），`git diff --check` 通过。完整 Vitest 本轮 `75` 项通过，但 `keydown.list/router` 与 `dialogHotkey` 两个套件在 Calibur `有交集()` 中因 `undefined.filter` 失败，堆栈未进入 AV 文件，因此不记为完整回归通过。旧 AV 大函数规模门禁作为 Phase 2/3 的拆分依据，不记为本批新增问题。
- **2026-07-25**：卡片后处理共享模块与根 Host 注入实验因 Madge 代表环枚举从 `900` 变为 `965` 被撤回。**2026-07-26 纠正**：节点拆分可使代表环枚举阶段性反升，该数值不能单独作为撤回依据；此实验需要按目标直接环是否消失、SCC 是否新增和行为测试重新评估，列回 Phase 3，不再以总数单调下降约束正确的领域拆分。
- **2026-07-25**：解除 `render.ts <-> render.refresh.ts` 两节点直接环。`refreshAV` 的唯一调用方改为直达刷新实现，根不再反向聚合导出；刷新实现继续调用同一 `avRender`，运行顺序未变。`typecheck:protyle-contract` 与 `git diff --check` 通过，Madge `900 -> 899`（`2189` 文件）。
- **2026-07-25**：URL 单元格纯渲染唯一实现从综合 `cell/render.ts` 归位到 `cell/renderURL.ts`，普通单元格与 Rollup 同向复用，解除 `cell/render.ts <-> cell/renderRollup.ts` 两节点直接环。`typecheck:protyle-contract` 与 `git diff --check` 通过，Madge `899 -> 898`（`2190` 文件）；新增模块专项 lint 清零后暂存。
- **2026-07-26**：`setPage` 唯一实现归位到 `view/pagination.ts` 并命名为 `syncAVPageSize`，Row 与 Gallery Item 同向复用，解除两节点直接环。新增专项测试覆盖表格排除 Header、卡片不收缩和无分页状态，`3/3` 通过；Madge `898 -> 897`。
- **2026-07-26**：`getAVTemplateHTML/genAVValueHTML` 从 `blockAttr.ts` 归入 `value` 属性值渲染子域，日期、转义、Emoji、资源和 i18n 通过 `value/imports.ts` 逐项登记。Asset、Cell Update、Select、BlockAttr 与 Template Cell 直达唯一实现，解除 `blockAttr <-> asset` 及模板单元格经控制器返回的路径；内部按 TAVCol 策略表分派，没有调用点碎片接口。属性值/分页专项测试 `7/7`、新子域 lint、`typecheck:protyle-contract`、`git diff --check` 通过，Madge `897 -> 895`。
- **2026-07-27**：按 [AV 行渲染与虚拟滚动状态职责拆分](./AV行渲染与虚拟滚动状态职责拆分.ttt.md) 将虚拟滚动的跨调用状态迁入 SForge 注册表，选择计数与表头同步迁入选择子域。Row、裁剪引擎与选择状态形成单向依赖，`row <-> virtualScroll` 和 `clearSelect <-> row` 两条直接环归零；专项 `2/2`、Node `183/183`，唯一 SCC `675 -> 672`。Row 与裁剪文件仍超过规模门禁，继续由专项中期计划拆分。
- **2026-07-27**：建立 [AV 列领域重复实现回归清理](./AV列领域重复实现回归清理.ttt.md)，确认合并后复活的 1978 行 `av/col.ts` 是拆分前旧副本。最后两个消费者直达 `col/col.typeUtils.ts` 后删除旧文件，完整列映射专项 `4/4`、Node `184/184`、Protyle 契约类型与网关门禁通过；代表环 `417 -> 412`，唯一 SCC `672 -> 671`。
- **2026-07-27**：建立 [AV 视图结构查询与菜单编排拆分](./AV视图结构查询与菜单编排拆分.ttt.md)。字段集合与视图图标迁入无外部依赖的 metadata 叶子，全部消费者和 Header 网关直达唯一实现；专项 `2/2`、Node `188/188`、契约类型和目标 lint 通过。代表环路径重排 `412 -> 427`，唯一 SCC `671 -> 668`；真实双向菜单导航环保留在下一阶段分析，不以回调 Port 隐藏。
- **2026-07-27**：View 菜单与配置 Panel 的双向导航由 Panel 控制器统一拥有，View Click 通过显式判别命令交回已收窄 DOM 元素；外部菜单入口全部直达 Panel，View 根不再导入 Panel。导航专项 `1/1`、Node `189/189`、契约类型和导航 lint 通过；代表环 `427 -> 423`、最大 SCC保持 `668`，目标两节点环与导航叶子循环归零。
