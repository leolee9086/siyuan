# AV 计算菜单与事务职责拆分（TikTocTak）

> **最终目标**：保持 AV Footer 与 Rollup 计算菜单、模板计算、数值能力判断、事务撤销和结果渲染行为不变，将 632 行 `calc.ts` 拆为单向职责子域，并使全部实现满足函数与文件规模门禁。
>
> **当前目标**：完成 Calc 元数据事务与通用块 DOM 同步器的解耦，建立后续菜单拆分的行为基线。
>
> **下一步任务**：锁定两种入口上下文、完整 operator 集合、Rollup 数值能力查询、模板 Dialog 与结果 HTML；再按真实所有权逐阶段迁出，不用调用点碎片接口或工厂闭包。

## 不变量

- Footer 和 Panel 两种入口的列 ID、AV ID、block ID、旧 operator 与菜单定位语义保持。
- `setAttrViewColCalc` 与 `updateAttrViewColRollup` 的 do/undo 载荷、提交顺序及 Rollup 本地数据更新保持。
- 移动端事务同步指示器继续遵守 provider、付费/订阅、仓库密钥和 enabled 条件；桌面端在读取账号能力前短路。
- Template 空白恢复“无”、旧模板撤销、Dialog 输入绑定及确认/取消生命周期保持。
- operator 显示名称、列类型集合、Rollup 数值推导和计算结果 HTML 不减少分支。
- 子域 `imports.ts` 直达真实声明或唯一实现，禁止 imports 网关多跳。
- 不以动态导入、事件转发、服务定位器、泛型 callback Port 或第二份实现隐藏循环。
- 若引入 class，必须抽取完整领域根并用 `PublicInstanceLooksLike` 双向校验；本任务不创建菜单调用点碎片接口。

## 现状基线

- `calc.ts` lint 实际代码 632 行；`openCalcMenu` 414 行、`calcItem` 77 行、内部 click 59 行、`getCalcValue` 79 行、`getNameByOperator` 53 行。
- 文件同时拥有入口解析、菜单项命令、operator 策略、两次网络查询、Template Dialog、事务构造、结果渲染和 i18n 映射。
- 阶段开始时生产图为 `2221` 节点、`391` 条代表环、唯一 SCC `648`；首环经 `calc.ts -> transaction.promise -> AV render` 返回根渲染。
- 通用 `promiseTransaction` 对 Calc 的两个 action 没有本地 DOM 分支，但事务开始前仍拥有移动端同步指示器副作用。

## 目标架构

1. `transaction/lifecycle`：事务同步指示器唯一实现，通用和 Prepared 两条提交路径共同调用。
2. `transaction/prepared`：只承接已由封闭领域命令完成 action 校验和本地呈现决策的 undo/队列/内核提交。
3. Calc 严格命令：只接受 `setAttrViewColCalc` 与 `updateAttrViewColRollup`，其它 action 显式失败。
4. `calc/context`：Footer/Panel 两种入口解析和关闭恢复。
5. `calc/operators`：完整 operator 策略、类型能力和名称映射。
6. `calc/template`：模板状态读取、Dialog 与事务构造。
7. `calc/result`：计算结果的纯 HTML 呈现。

## 近期计划

- [x] 确认通用事务对两个 Calc action 没有本地 DOM 同步分支。
- [x] 提取共享移动端同步指示器并保持桌面短路顺序。
- [x] 建立 Prepared Transaction 内核与严格 Calc/View 命令。
- [x] 将 Calc 三个提交点改为严格命令，推动 `calc.ts` 退出 SCC。
- [ ] 为完整 operator 集合和结果 HTML 建立表驱动测试。
- [ ] 为 Footer、Panel 和 Template 三条交互路径建立行为测试。

## 中期计划

- [ ] 提取并测试两种入口上下文解析。
- [ ] 提取 Rollup 数值能力查询，保持服务端请求次数和顺序。
- [ ] 提取 operator 菜单编排，消除重复 `calcItem` 调用块但不合并不同能力分支。
- [ ] 提取 Template Dialog 生命周期与结果呈现。
- [ ] 使全部新子域和剩余根文件满足规模门禁。

## 远期计划

- [ ] Calc 子域保持在循环 SCC 外。
- [ ] 删除旧综合实现和无消费者导出，不保留兼容 barrel。
- [ ] 完整 AV 视觉与交互回归后归档本任务。

## 风险与验收标准

- Prepared Transaction 不是业务公开的任意 action 入口；每个调用域必须先经过严格 action 命令。
- 事务前置生命周期不得遗漏移动端同步指示器，也不得在桌面端额外读取订阅状态。
- 测试覆盖 undo 先于同步标记和队列、lite 短路、空事务、请求载荷、字数刷新及非法 action 显式失败。
- 运行专项 Vitest、完整 Node、Protyle 契约类型、新模块 lint、网关多跳、Madge/Tarjan 与 diff 检查。
- `calc.ts` 退出 SCC 只是近期结构验收，不代表 632 行上帝模块已经完成拆分。

## 已归档/已完成区域

- **2026-07-27**：通用事务的移动端同步指示器归入 `transaction/lifecycle/syncIndicator.ts`，保持 `isMobile` 首条件短路、provider/付费/订阅、repo key 和 enabled 判断；满足显示条件却缺少 `#toolbarSync` 时显式失败。Prepared 内核统一拥有 undo、lite、同步标记、队列、请求和字数刷新，View 与 Calc 命令分别严格校验自身 action。Calc 三个调用点不再加载 `transaction.promise`。事务专项 `17/17`、Node `193/193`、Protyle 契约类型、新模块 lint、网关多跳与 diff 检查通过；生产图 `2226 / 394 / SCC 647`，仍为唯一 SCC，Calc、Prepared 与 SyncIndicator 均在 SCC 外。代表环 `+3` 是其余返回路径重新枚举，不撤回正确职责方向。

## 关联任务

- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
- [AV 渲染组合根与视图子域拆分](./AV渲染组合根与视图子域拆分.ttt.md)
- [前端上帝对象领域拆分](./前端上帝对象领域拆分.ttt.md)
