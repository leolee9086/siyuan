# AV 单元格位置与装饰职责拆分（TikTocTak）

## 最终目标

将 `app/src/protyle/render/av/cell/position.ts` 中混合的滚动定位、坐标解析、表头装饰、拖拽手柄和拖拽填充事务归入各自稳定职责，使只需叶子行为的 AV action 不加载事务与完整 cell/action 链；保留 `cell.ts` 对外 API、DOM 顺序、事务内容和同步交互语义。

## 当前目标

- [x] 建立现有六个导出函数的调用点、依赖和行为测试基线。
- [x] 提取无事务的表头装饰与拖拽手柄唯一实现。
- [x] 解除 `action/animation -> cell/position -> transaction -> ... -> action` 长返回路径。
- [x] 将拖拽填充事务编排迁入独立子域，并提取可单测的单步操作生成器。

## 下一步任务

1. 继续由 `position.ts` 持有相互关联的单元格滚动、类型与坐标查询，不再混入装饰或事务职责。
2. 在主循环依赖任务中处理 `mousedown -> transaction -> render -> mousedown` 运行时回路，使 dragFill 编排最终退出 SCC。
3. 单独核定 `renderCell` 的异步返回协议后再调整 DOM 回写；本批保持旧同步强制转换语义。

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

- [x] 滚动/坐标职责与拖拽填充事务职责边界清晰，`position.ts` 不再是多领域聚合点。
- [x] 全部旧调用方仍通过 `cell.ts` 原公开 API 或真实职责入口获得唯一实现。

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
- **2026-07-26**：`dragFillCellsValue` 从位置模块完整迁入 `cell/dragFill` 子域，调用点改用完整 `DragFillRequest`，旧 `cell.ts` 公开出口保持。单步数据克隆与 do/undo 生成提取为同步纯步骤，使用 `satisfies DragFillStep` 保持事务字面量和完整结果契约；只读目标仍在来源读取前跳过，block detached 规则、DOM 回写、焦点和事务顺序保持。新增 `4/4` 测试覆盖深克隆、操作身份、四类只读列、非 detached 阻断与 block ID 清除；Node `175/175`、新子域 lint和目标类型诊断 `0`、imports 多跳门禁与 diff 校验通过。源码图为 `2179` 节点、`547` 枚举环；`position.ts` 已退出唯一 SCC，dragFill 的入口和网关仍属于既有 `mousedown -> transaction -> render -> mousedown` 回路，职责拆分使唯一 SCC 阶段性 `681 -> 682`，后续按该真实运行时依赖继续处理。
- **2026-07-26**：清除全仓 31 个生产文件对 `cell.ts` 聚合入口的运行时依赖，所有调用点与两个子域 `imports.ts` 直达 value、update、decoration、edit、position、render 和 dragFill 的唯一实现；`cell.ts` 保留原公开出口但退出 SCC。枚举环 `548 -> 539`，唯一 SCC `682 -> 679`；dragFill 的最短返回路径现已转到 `transaction.ts` 综合出口附带加载 turns/block/Protyle 主运行时，后续由事务领域拆分处理。
