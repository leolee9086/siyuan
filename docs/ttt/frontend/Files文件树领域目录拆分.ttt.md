# Files 文件树领域目录拆分（TikTocTak）

> **最终目标**：在保持文件树 DOM、拖拽、选择、菜单、WebSocket 更新和模型生命周期不变的前提下，将 `layout/dock/Files` 根目录重组为单向领域子图，根目录只保留完整领域声明与组合入口。
>
> **当前目标**：先迁移定位当前编辑器的 focus 命令，并持续把根目录 32 个文件按真实职责归入子域。
>
> **下一步任务**：依据 `pnpm lint:cycles` 首环，处理 `eventHandlers.actions -> layout/dock/util` 后剩余的 Files 事件与 Dock 返回边。

## 不变量

- `FilesDomain` 必须覆盖 Files class 完整公共表面，并继续由 `PublicInstanceLooksLike` 双向校验。
- 具体 Files、Tab、Editor class 只允许在构造与契约校验边界出现；行为模块依赖完整领域根和 Symbol 守卫。
- 保留 `imports.ts` 机制；子域网关只引入外部依赖，同域声明直达真实文件，禁止 imports 多跳。
- 不使用调用点碎片接口、动态导入、事件绕行、服务定位器、工厂闭包状态或宽泛 `unknown`。
- 用户的 `layout/dock-utils.ts` 修改始终不纳入本任务提交。

## 现状基线

- **2026-07-27**：Files 根目录有 32 个生产文件，超过目录门禁 10。
- 已存在事件、拖拽、WebSocket、树操作、HTML 生成、菜单和排序刷新等明确职责簇，但仍平铺在根目录。
- 权威循环基线为 `2324` 个生产节点、`149` 条代表环；首环经过 `Files/eventHandlers.actions -> layout/dock/util`。

## 目标架构

```text
Files 组合根 + FilesDomain
  -> focus/
  -> events/
  -> dnd/
  -> websocket/
  -> tree/
  -> rendering/
  -> menu/

子域行为 -> FilesDomain + 子域 imports.ts
契约测试 -> Files class + FilesDomain + PublicInstanceLooksLike
```

## 分阶段计划

### Phase 1：活动编辑器定位

- [x] 将 `selectOpenTab` 从综合 `layout/dock/util.ts` 迁入 `Files/focus`。
- [x] 使用完整 Files、LayoutTab、Editor 领域守卫替代具体 class 和断言。
- [x] 删除重复的结构式 `isFilesDomain`，统一使用 Symbol 厂牌守卫。
- [x] 完成类型、Node、网关、循环和 diff 验证并归档本阶段。

### Phase 2：事件与菜单

- [ ] 将 actions、closeElement、element click/mousedown 按同一事件生命周期归入 `events/`。
- [ ] 将 moreMenu 与 docActions 归入 `menu/`，保持桌面/移动差异独立。
- [ ] 删除迁移后零引用的旧聚合出口，不保留兼容 barrel。

### Phase 3：树、拖拽与 WebSocket

- [ ] 将 dnd 文件迁入 `dnd/` 并保持拖拽状态由领域实例或注册表持有。
- [ ] 将 treeNavigation/treeOperations 归入 `tree/`。
- [ ] 将 wsHandlers 系列归入 `websocket/`，保持消息顺序与 DOM 更新语义。
- [ ] 将 HTML/onLs/init 归入渲染与初始化子域。

### Phase 4：验收

- [ ] Files 根目录不超过门禁且不再出现在循环报告中。
- [ ] 双向完整契约、Node、专项 DOM 测试、类型检查与 imports 多跳门禁通过。
- [ ] 所有阶段实现、验证证据与提交号写入已完成记录。

## 风险与验收

- 文件树事件依赖真实 DOM 层级、焦点和菜单时序，迁移只调整所有权与依赖方向。
- WebSocket 与拖拽包含跨事件状态，必须使用 Files 实例或统一注册表，禁止通过模块闭包复制状态。
- 验收以目标边退出、SCC 性质、完整契约与行为测试为准，不以代表环数量短期反升回撤正确拆分。

## 已完成记录

- **2026-07-27**：创建专项 TTT。`selectOpenTab` 初步迁入 `Files/focus`，跨域依赖由专属网关直达完整 Editor/Layout/Dock 查询，Files 同域守卫直达真实声明；验证与提交待本阶段完成后补录。
- **2026-07-27**：Phase 1 完成。Files 工具栏与全局命令直达 `focus/selectOpenTab`；具体 Files、Tab、Editor class 和断言由完整领域根及 Symbol 守卫替代。删除 `eventHandlers.guard.ts` 中重复结构式 Files 守卫，Editor 依赖改为唯一厂牌守卫；actions 的 Dock 查询直达 Query，综合 `layout/dock/util` 与 `tabUtil` 返回边归零。目标类型诊断 `0`、focus lint、Node `202/202`、Protyle 契约、imports 多跳 `0` 与 diff 检查通过；生产图 `2326 / 171`，首环推进到 closeElement。
