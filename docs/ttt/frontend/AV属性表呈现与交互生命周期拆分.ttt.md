# AV 属性表呈现与交互生命周期拆分（TikTocTak）

> **最终目标**：保持自定义属性表的数据加载、HTML、编辑、拖拽、上传、数据库行打开、删除确认和 Dialog 生命周期不变，将 400 行级 `blockAttr.ts` 拆为单向依赖的完整 Attribute Table 子域。
>
> **当前目标**：完成属性表字段排序与复合行删除事务收口，使 `blockAttr.ts` 退出主 SCC。
>
> **下一步任务**：盘点数据加载、HTML 生成、事件绑定、拖拽、资源处理与删除恢复计划的真实职责，优先提取无宿主副作用的数据投影和完整交互命令。

## 不变量

- 字段排序继续同步移动现有 DOM，do/undo previousID 取值和拖拽样式清理顺序不变。
- 删除行的 undo 必须完整恢复主键、所有非 Rollup Cell、各 View 顺序及 Group 顺序。
- 删除成功前不移除 DOM；成功后依次移除条目、刷新属性面板，并在最后一项删除后关闭属性 Dialog。
- 内核失败保持可观察，成功回调不得提前执行。
- 桌面/移动数据库行导航继续由完整 AppFacade 承担，不反向加载具体 App/Editor。
- 不建立按钮级 Port、回调工厂状态或宽泛类型；跨调用状态进入统一注册表。
- 子域 `imports.ts` 逐项直达真实声明或唯一实现，禁止网关多跳。

## 现状基线

- `blockAttr.ts` 同时承担 API 数据读取、属性表 HTML、字段拖拽、Cell 编辑、文件上传、资源预览、数据库行打开、反链折叠和复合删除。
- 阶段开始时生产图 `2295` 节点、`299` 条代表环、唯一 SCC `579`；首环为 `onGet -> initUI -> dom -> attributePanel -> blockAttr -> transaction`。
- 字段排序 action 为 `sortAttrViewKey`；行删除 do 为 `removeAttrViewBlock`，undo 由 `insertAttrViewBlock/updateAttrViewCell/sortAttrViewRow` 组成。

## 目标架构

- `attributeTable/data`：API 响应到属性表稳定数据模型的唯一投影。
- `attributeTable/render`：HTML 与值呈现，不绑定宿主事件。
- `attributeTable/ordering`：字段顺序、DOM 移动与精确 do/undo。
- `attributeTable/removal`：完整删除/恢复计划和成功后的 UI 收尾。
- `attributeTable/interactions`：编辑、资源、数据库行和反链入口编排。
- `blockAttr.ts`：最终只保留属性面板装配入口。

## 近期计划

- [x] 建立 Attribute Table 封闭 action 命令。
- [x] Prepared Transaction 支持可选 undo 与成功回调，固定回调发生在响应和字数刷新之后。
- [x] 迁移字段排序与复合删除，清零 `blockAttr -> transaction`。
- [ ] 提取删除恢复计划并建立多 View/Group 行为测试。

## 中期计划

- [ ] 拆分数据加载、HTML 生成和事件绑定。
- [ ] 拆分资源上传/预览和 Cell 编辑编排。
- [ ] 将属性表生命周期状态归入可枚举注册表。

## 远期计划

- [ ] `blockAttr.ts` 满足规模门禁并成为薄装配入口。
- [ ] Attribute Table 全子域无循环，桌面/移动行为回归后归档。

## 风险与验收标准

- 不把普通 AV Row、Cell Update 和 Attribute Table 复合恢复的不同事务语义强行合并。
- Prepared 成功回调只响应内核成功；lite/空事务不得执行网络成功收尾。
- 专项、Node、Protyle 契约、全量目标类型、新源码 lint、imports 多跳、Tarjan SCC 与 diff 检查通过。
- 代表环只用于定位；目标返回边清零且 SCC 缩小才登记结构完成。

## 已完成记录

- **2026-07-27**：创建专项并完成第一阶段。新增 Attribute Table 子域和完整提交对象，封闭 `sortAttrViewKey/removeAttrViewBlock/insertAttrViewBlock/updateAttrViewCell/sortAttrViewRow`；Prepared 内核正式支持可选 undo 与成功回调，回调在响应字数刷新后执行。字段排序继续同步移动 DOM；删除继续在成功后移除 DOM、刷新面板和关闭空 Dialog。专项 `11/11`、Node `200/200`、Protyle 契约、新源码 lint、全量类型新目标诊断 `0` 和 imports 多跳通过；`blockAttr.ts` 的 `68` 条严格诊断为阶段前既存并由本专项后续分层处理。生产图 `2298 / 296 / SCC 576`，`blockAttr.ts`、命令与子域网关均退出循环组件。

## 关联任务

- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
- [前端上帝对象领域拆分](./前端上帝对象领域拆分.ttt.md)
- [AV 菜单面板与列添加呈现职责拆分](./AV菜单面板与列添加呈现职责拆分.ttt.md)
