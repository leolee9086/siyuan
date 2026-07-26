# AV 单元格位置与装饰职责拆分（TikTocTak）

## 最终目标

将 `app/src/protyle/render/av/cell/position.ts` 中混合的滚动定位、坐标解析、表头装饰、拖拽手柄和拖拽填充事务归入各自稳定职责，使只需叶子行为的 AV action 不加载事务与完整 cell/action 链；保留 `cell.ts` 对外 API、DOM 顺序、事务内容和同步交互语义。

## 当前目标

- [x] 建立现有六个导出函数的调用点、依赖和行为测试基线。
- [x] 提取无事务的表头装饰与拖拽手柄唯一实现。
- [x] 解除 `action/animation -> cell/position -> transaction -> ... -> action` 长返回路径。

## 下一步任务

1. 核对 `cellScrollIntoView/getPositionByCellElement` 的滚动与坐标职责是否可共同保留。
2. 为 `dragFillCellsValue` 建立 do/undo 数据与调用顺序测试。
3. 将拖拽填充事务编排与位置查询分离，保持操作数组和焦点顺序不变。

## 不变量

- 不创建按调用点裁剪的 Port 或碎片接口；本任务处理的是函数职责所有权，不伪造 class 契约。
- 不复制 `updateHeaderCell/addDragFill` 实现，不用回调参数或动态导入隐藏依赖。
- `cell.ts` 继续作为现有公开聚合入口；内部网关直达真实所有者。
- 所有新子域通过同层 `imports.ts` 访问父级依赖，网关不得串联其它 `imports.ts`。
- 表头 DOM 写入顺序、拖拽手柄排除类型、拖拽事务 do/undo 数据和焦点时序保持不变。

## 现状基线

- `position.ts` 同时导出 `cellScrollIntoView`、`getTypeByCellElement`、`updateHeaderCell`、`getPositionByCellElement`、`dragFillCellsValue`、`addDragFill`。
- action animation 只需要 `updateHeaderCell/addDragFill`，却因此加载 `transaction`、选择、cell render/value 与移动端滚动依赖。
- 修正 action 对 `../cell` 聚合入口依赖后，原 5 节点短环归零，但经 `cell/position.ts` 的长返回路径仍存在。
- 当前源码图：`2173` 个节点，`547` 条枚举环，唯一 SCC `681`。

## 近期计划

- [x] 装饰叶子实现与测试完成，目标 action 长环缩短或归零。
- [x] 新文件 lint、目标 TypeScript、Node 与 imports 多跳门禁通过。

## 中期计划

- [ ] 滚动/坐标职责与拖拽填充事务职责边界清晰，`position.ts` 不再是多领域聚合点。
- [ ] 全部旧调用方仍通过原 API 或真实职责入口获得同一函数身份。

## 远期计划

- [ ] 与 [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md) 一并归档，继续将 AV 相关节点移出应用级 SCC。

## 风险与验收标准

- Happy DOM 专项测试证明表头和拖拽手柄结构行为不变。
- 拖拽填充事务需覆盖 do/undo 数据、跳过只读列和焦点后提交顺序。
- `pnpm lint:cycles` 中目标返回路径按依赖性质消失；枚举总数不作为单调门禁。
- `pnpm test:node`、目标 lint/类型诊断、`lint:imports-gateway-hops` 和 `git diff --check` 通过。

## 已完成记录

- **2026-07-26**：创建专项 TTT。已先将 action 网关的 cell 依赖从 `../cell` 聚合入口改为三个真实所有者，原 5 节点短环归零；确认下一层阻塞来自 `cell/position.ts` 的多职责聚合，未用临时接口或参数回调绕开。
- **2026-07-26**：`updateHeaderCell/addDragFill` 完整迁入 `cell/decoration` 子域，专属 `imports.ts` 直达 Emoji、i18n 和 col 类型工具，未继续加载 cell 根网关中的资源与平台依赖。新增无断言的 `toTAVCol` 穷举收窄，现有 `cell.ts` 出口保持不变；action 与 `cell/position.ts` 不再共同出现在循环路径，decoration 子域位于 SCC 外。专项 `3/3` 覆盖默认图标、名称、固定标记幂等、拖拽排除和未知列类型默认值；新增文件 lint/目标类型诊断为 `0`，Node `171/171`、imports 多跳门禁与 diff 校验通过；图为 `2175` 节点、`547` 枚举环。
