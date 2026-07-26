# AV 定位状态与渲染生命周期拆分

## 最终目标

保持数据库条目排队、重试、本地数据复用、跨视图定位、虚拟窗口、选择、滚动和高亮行为不变，将 358 行 `locate.ts` 拆为单向定位领域，并解除定位状态对 AV 根渲染实现的动态反向依赖。

## 当前目标

- [x] 确认最短环 `render -> gallery/render -> locate -> render` 的返回边来自动态导入。
- [x] 将七类跨调用状态统一迁入 SForge `AVLocateRegistryState`。
- [x] 将根渲染能力以完整 `AVRenderer` 参数传入激活阶段。
- [x] 分离激活、窗口规划和完成呈现三个真实生命周期阶段。
- [x] 解除完成呈现经视图事务、`transaction.promise` 返回 AV 根渲染的间接回路。
- [ ] 解除完成呈现经 `scrollCenter -> layout/Wnd -> editor` 返回 AV 根渲染的既有布局回路。

## 下一步任务

1. 分析 `scrollCenter` 为何经 DOM helper 网关加载 Layout/Wnd，以及定位仅需的滚动语义属于哪个稳定 DOM 领域。
2. 复用或归位滚动唯一实现，不向 Presentation 注入调用点 callback Port。
3. 增加表格首行、普通居中与看板横向滚动行为测试，推动 Presentation 退出唯一 SCC。

## 不变量

- 不使用动态导入、事件、服务定位器、工厂闭包或兼容回退隐藏根渲染依赖。
- `AVRenderer` 覆盖缺省数据 fetch 与已解析数据复用的完整根渲染签名，不创建调用点碎片 Port。
- 排队超时、50ms 重试、30s 截止、激活 token、视图持久化事务和消息只显示一次语义保持。
- 定位渲染继续在微任务中启动；同步激活返回值和 `data-render` 移除顺序保持。
- 全部跨调用 Map/WeakMap 由单一 SForge 注册状态拥有，测试和 HMR 可显式重置。
- 每个 `imports.ts` 只登记所属阶段的外部依赖并直达真实所有者，禁止网关多跳。

## 现状基线

- `locate.ts` 358 行，混合排队/重试、渲染 token、本地数据缓存、虚拟窗口、高亮、选择和滚动。
- `activateAVLocate` 通过 `import("./render")` 反向加载根渲染器，形成当前三节点最短环。
- 七个 Map/WeakMap 为模块级跨调用状态，缺少统一生命周期重置入口。
- 阶段开始时生产图为 `2208` 节点、`391` 条代表环、唯一 SCC `649`。

## 目标架构

- `locate/state`：完整 `AVLocateRegistryState`、SForge 状态所有权、请求和渲染 token。
- `locate/activation`：本地数据解析、排队、激活和重试；依赖抽象 `AVRenderer` 参数。
- `locate/window`：目标虚拟窗口和 spacer 规划。
- `locate/presentation`：视图事务、选择、滚动和高亮完成阶段。
- 消费者直达真实阶段所有者；删除综合 `locate.ts`。

## 风险与验收标准

- 激活从动态 import 改为参数时不得提前执行根渲染同步段，测试必须锁定微任务边界。
- 本地数据仅在 view 匹配且目标存在时复用，否则仍由根发起 fetch。
- 注册表重置不得遗留 timeout 或高亮 class。
- 专项测试、BlockPanel 测试、完整 Node、两层类型检查、新子域 lint、网关门禁、循环图与 diff 检查通过。
- 三节点最短环和生产动态导入清零；不新增循环 SCC。

## 已归档/已完成区域

- **2026-07-27**：创建专项 TTT。确认已有 `AVViewRenderer` 只描述已解析数据后的视图分派，不能覆盖定位时可能触发 fetch 的根入口；新增完整 `AVRenderer` 函数类型并先以参数替代动态 import。定位专项已锁定微任务启动和本地数据复用，BlockPanel 既有测试暴露并推动完整渲染能力进入编辑初始化上下文。
- **2026-07-27**：删除 358 行综合 `locate.ts`，唯一实现分别归入 `locate/state`、`activation`、`window` 与 `presentation`；所有生产消费者直达真实阶段所有者，不保留 barrel。七类 Map/WeakMap 进入带精确 `AV_LOCATE_REGISTRY` Symbol 的完整注册状态，reset 同步清除排队 timer、高亮 timer 与 DOM class。激活阶段接收完整 `AVLocateActivationContext`，在原微任务边界调用抽象 `AVRenderer`，生产动态 import 清零。定位/BlockPanel 专项 `3/3`、Node `193/193`、Protyle 契约类型、新子域 lint、imports 多跳与 diff 检查通过。生产图 `2208 -> 2215` 节点、代表环 `391 -> 389`、唯一 SCC `649 -> 650`；原三节点环归零，State/Activation/Window 均在 SCC 外，Presentation 两节点替代旧综合节点留在 SCC，因此本专项继续进行。
- **2026-07-27**：根据 `setAttrViewBlockView` 已由 Presentation 同步应用且通用 Promise 无对应 DOM 分支的确定语义，改用严格的 Applied AV View Transaction；共享 undo 实现，保留 lite、队列、请求载荷和字数刷新，对非目标 action 显式失败。Presentation 到 `transaction.promise` 的路径归零，Applied/Undo 位于 SCC 外。专项 `9/9`、Node `193/193`、契约类型和 lint 通过；图为 `2219 / 431 / SCC 650`。代表环反升源自更短的 `scrollCenter -> Layout/Wnd -> editor` 既有返回路径，下一阶段按滚动领域所有权处理。

## 关联任务

- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
- [AV 渲染组合根与视图子域拆分](./AV渲染组合根与视图子域拆分.ttt.md)
- [AV 行渲染与虚拟滚动状态职责拆分](./AV行渲染与虚拟滚动状态职责拆分.ttt.md)
