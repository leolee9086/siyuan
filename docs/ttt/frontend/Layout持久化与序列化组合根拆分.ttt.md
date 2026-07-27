# Layout 持久化与序列化组合根拆分 (TikTocTak)

## 最终目标

将 `app/src/layout/layout-serialization.ts` 从同时依赖具体布局 class、全部面板 class、Dock 构造、Protyle 滚动和全局保存环境的上帝模块，拆分为单向依赖的布局序列化、布局保存和布局导出职责；所有模型分类依赖完整领域根、Symbol 厂牌或既有自描述序列化协议。

## 当前目标

- [x] Layout/Wnd/Tab 序列化改用完整领域根与现有守卫。
- [x] 已建立领域根的面板模型不再由序列化器导入具体 class。
- [x] AgentChat 使用既有 `ILayoutSerializableModel` 自描述协议，不新增局部接口。
- [x] Dock DOM 序列化从 Dock 恢复构造模块迁入 persistence 子域并依赖完整 `DockDomain`。
- [x] 分离纯递归序列化、保存编排和导出编排，使 `saveLayout` 不加载 Protyle 滚动/导出链。
- [x] 保存重试状态归入 SForge 统一状态注册表；保存函数不以工厂闭包或模块变量持有状态。

## 下一步任务

1. [x] 完成 Node 全量回归、目标文件诊断和 diff 校验。
2. [x] 本阶段已进入原子提交，随后按新的 Emoji/Tab/Asset 首环推进主任务。

## 不变量

- 不改变布局 JSON 字段、遍历顺序、未初始化 Editor 重试、窗口 sessionStorage 和主窗口后端写入语义。
- 不使用动态导入、全局注册、断言、`unknown/never` 或 lint 豁免隐藏依赖。
- 不为单个序列化调用点创建碎片模型接口；复用完整领域根和 `ILayoutSerializableModel`。
- 生命周期状态由统一注册表拥有；禁止以工厂闭包、保存函数闭包或模块级可变容器保留重试次数。
- `imports.ts` 继续参与依赖图，调用方直接依赖真实职责所有者。
- 测试只放在 `app/test`。

## 现状基线

- 建立文档前源码图：`2137` 节点、`770` 条代表环、唯一 SCC `739`。
- 当前首环：`asset/index.ts -> layout/utils/setPanelFocus.ts -> layout/layout-serialization.ts -> protyle/scroll/saveScroll.ts -> ... -> emoji/index.ts -> layout/tabUtil.ts`。
- 代表环数量在近期批次多次反升，但 SCC 从 `746 -> 740 -> 739`，以 SCC 成员和依赖方向为判断依据。

## 近期计划

- [x] 完成三个持久化子域及调用点迁移。
- [x] 删除 `layout-serialization.ts` 中不再拥有的实现和转发。
- [x] 让 `setPanelFocus -> saveLayout` 路径不进入 Protyle 导出链。
- [x] 以全局注册表保存 retry state，并提供共享、清零及 HMR/测试销毁入口。

## 中期计划

- [ ] 将剩余反序列化 `instanceof Layout/Wnd/Tab` 按完整领域身份与真实构造边界分类处理。
- [ ] 为仍需具体构造器身份的恢复分支保留明确组合根。

## 风险与验收标准

- 相同布局输入生成逐字段相同的 JSON。
- Dock 上下分区空数组索引语义保持不变。
- AgentChat 会话 ID 在保存和恢复后保持一致。
- `PublicInstanceLooksLike` 布局/模型契约、Node 回归、目标类型检查和 `git diff --check` 通过。
- 阶段成效以 SCC 缩小、具体 class 边归零和职责方向为准，不以代表环数量单独判断。

## 已完成记录

- **2026-07-25**：创建专项 TTT。已将布局容器和既有模型序列化分派迁到完整领域守卫；AgentChat 改用自描述布局协议；Dock 序列化建立依赖完整 `DockDomain` 的唯一实现。唯一 SCC 当前为 `739`，继续拆分保存与导出链。
- **2026-07-26**：纯序列化、布局快照、保存编排与导出编排已迁入独立职责目录，全部调用点直达真实所有者，旧 `layout-serialization.ts` 已删除。根据评审纠正，移除保存工厂闭包，重试状态由 `LAYOUT_PERSISTENCE_REGISTRY` 对应的 SForge 统一注册表唯一持有；专项共享/重置测试 `2/2`、Symbol lint 规则测试 `4/4`、Node 全量回归 `154/154`、`git diff --check` 通过。本批 persistence/export/modelHash 文件无 TypeScript 诊断；全项目检查仍被既有 AgentChat 等严格类型错误阻塞。源码图为 `2146` 个节点、`819` 条枚举环、唯一 SCC `738`，相比上一阶段 `746` 有 8 个成员实质退出；首环转为 `emoji/index.ts -> layout/tabUtil.ts -> asset/renderAssets.ts -> util/file/pathName.ts`。本阶段满足归档条件，后续回到主任务处理新首环。
- **2026-07-26**：反序列化辅助模块的 `getInstanceById` 改为直达 `layout/query/layoutInstance.ts`，不再通过重新导出 `JSONToLayout` 的 `layout/util.ts` 取回查询函数；由此解除 `util -> layout-deserialization -> layout-deserialization.layout -> util` 三节点环。相关四个消费网关同步直达唯一查询实现，代表环 `454 -> 421`，唯一 SCC 保持 `676`；剩余反序列化运行时职责继续按中期计划处理。
- **2026-07-28**：布局重排防抖从 `tabUtil.ts` 迁入 `layout/resize/resizeTabs.ts`，状态使用 `LAYOUT_RESIZE_REGISTRY` 统一注册表，避免布局调用方各自持有计时器；原有重排和保存顺序保持。`resizeTabs` 专项行为测试 `2/2`、子域 lint、imports 多跳和新增文件类型诊断通过。该批为反序列化首环的前置边界清理，当前下一步仍是 `Wnd -> Wnd.tab -> layout/util -> layout-deserialization` 的完整 Layout 领域审计。
