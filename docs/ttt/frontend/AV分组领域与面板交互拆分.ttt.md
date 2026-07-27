# AV 分组领域与面板交互拆分（TikTocTak）

> **最终目标**：保持 AV 分组字段设置、日期/数值范围、排序、折叠、显示隐藏、清除和 Panel 导航行为不变，将 Groups 数据规则、严格事务、Panel 交互与拖拽呈现拆为方向稳定的完整子域。
>
> **当前目标**：在 Panel 交互和严格命令退出 SCC 后，继续拆分拖拽排序与延迟折叠的其它职责，使两个综合宿主最终退出主 SCC。
>
> **下一步任务**：将分组拖拽的数据变换与 DOM 呈现从 425 行 `openMenuPanel.drag.ts` 中提取到 `group/drag`，保持列/筛选/排序拖拽分支独立。

## 不变量

- 单组隐藏继续原地更新 `groupHidden`、图标、隐藏 class 和全部切换按钮后提交精确 undo。
- 全部隐藏/显示继续更新所有 group 数据和 DOM 后提交反向布尔 undo。
- 清除分组继续先提交 `removeAttrViewGroup`，undo 使用原 `view.group`，再清理本地 group 数据并刷新 Panel。
- 分组拖拽继续提交原 previousID/undoPreviousID，随后更新 order、数组顺序和 DOM 顺序。
- 分组折叠继续在既有延迟窗口内提交，缺失 AV、Block 或 Group 身份时保持显式无事务结果。
- 日期、数值范围、字段和排序方法的 API 请求、错误可观察性和菜单时序保持。
- Groups 严格命令只接受 `set/remove/hide/hideAll/sort/fold` 六类 action，任何其它 action 同步抛错。
- 不用动态导入、事件转发、碎片 Port、工厂闭包或宽泛类型隐藏依赖。
- `imports.ts` 保留并直达真实声明或唯一实现，禁止网关多跳。

## 现状基线

- `groups.ts` 近 400 行，混合 API、HTML、事件绑定、日期/数值范围和排序规则。
- `openMenuPanel.click.groups.ts` 约 230 行，混合九类 Panel 动作和三组通用事务。
- `openMenuPanel.drag.ts` 内含分组排序事务及数组/DOM 重排。
- `action/click/dataType.advanced.ts` 内含延迟分组折叠事务。
- 阶段开始时生产图 `2272` 节点、`312` 条代表环、唯一 SCC `591`；首环经 Groups Panel 点击进入通用 transaction。

## 目标架构

- `prepared/av/avGroup.ts`：Groups 六类 action 的唯一严格提交命令。
- `group/panel/imports.ts`：Panel 交互所需依赖直达网关。
- `group/panel/interactions.ts`：分组 Panel 点击状态机与本地呈现。
- `group/drag`：后续承接分组排序数据和 DOM 重排。
- `group/range`：后续承接日期与数值范围规则。
- `groups.ts`：逐步降为兼容组合入口，最终删除无消费者出口。

## 近期计划

- [x] 建立 Groups 六类 action 与非法 action 的严格命令测试。
- [x] 建立单组隐藏、全部隐藏和清除分组的 Panel 行为测试。
- [x] 迁移 Panel 点击、拖拽排序和延迟折叠提交点。
- [x] 验证旧通用 transaction Groups action 生产调用归零。
- [x] 复算代表环、Tarjan SCC 和目标节点成员身份。

## 中期计划

- [ ] 拆分日期/数值范围、分组方法和排序规则。
- [ ] 拆分拖拽排序的数据变换与 DOM 呈现。
- [ ] 将跨交互延迟状态迁入统一注册表并提供重置，不保留模块级 timer。

## 远期计划

- [ ] Groups 全部子域退出应用主 SCC。
- [ ] `groups.ts`、Panel interactions 与拖拽文件满足规模门禁。
- [ ] 与 AV Panel 和主循环解耦任务共同归档。

## 风险与验收标准

- 不把 Column Sort、Filter 或 View 配置 action 混入 Groups 命令。
- 不改变 `groupHidden` 的 `0/2` 语义或 `isShow` 布尔方向。
- 不将本地 DOM/数组变换移入事务命令；命令只校验并提交完整操作集。
- 专项、完整 Node、Protyle 类型、全量目标诊断、源码 lint、网关多跳、循环图和 diff 检查均需登记。

## 已归档/已完成区域

- **2026-07-27**：创建专项。核定 Groups 事务完整集合为 `setAttrViewGroup/removeAttrViewGroup/hideAttrViewGroup/hideAttrViewAllGroups/sortAttrViewGroup/foldAttrViewGroup`；三个调用域均拥有对应数据与 DOM 呈现，通用 transaction 不提供额外 Groups 专属决策。登记 `2272 / 312 / SCC 591` 基线。
- **2026-07-27**：新增 `prepared/av/group/avGroup.ts`，封闭接受六类 Groups action 并显式拒绝其它 action；Panel 隐藏/显示/清除、拖拽排序和延迟折叠均复用该唯一命令，Groups action 的通用 transaction 调用归零。Panel 点击整体迁入 `group/panel/interactions.ts`，通过完整 `GroupPanelInteraction` 消息接收既有 `IMenuPanelContext`，不创建宿主 Port；imports 网关逐项直达当前 Groups 实现和基础能力。命令与三类 Panel 行为专项 `10/10`、完整 Node `200/200`、新子域 lint、Protyle 类型、全量类型目标诊断 `0`、imports 多跳和 diff 检查通过。生产图 `2277 / 312 / SCC 590`，代表环保持是首路径转向 Sort；Panel interactions 与全部新网关/命令退出 SCC，drag 和 advanced 因其它职责仍在 SCC，中期拆分继续。

## 关联任务

- [AV 菜单面板与列添加呈现职责拆分](./AV菜单面板与列添加呈现职责拆分.ttt.md)
- [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md)
- [前端上帝对象领域拆分](./前端上帝对象领域拆分.ttt.md)
