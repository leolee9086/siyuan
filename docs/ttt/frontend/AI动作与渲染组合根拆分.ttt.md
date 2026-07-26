# AI 动作与渲染组合根拆分 (TikTocTak)

## 最终目标

在保留 `imports.ts` 依赖可见性和 AI 现有运行语义的前提下，将 `app/src/ai` 根目录的动作、对话、流式状态、图像生成与渲染职责拆入稳定子域；AI 网关只暴露 AI 领域能力，不再充当网络、选区、存储、常量或 Protyle 渲染的通用出口。

## 当前目标

- [x] 清除所有非 AI 模块对 `ai/imports.ts` 中通用基础能力的反向依赖。
- [ ] 将 `actions.*` 归入动作子域，并为内容填充建立专属渲染网关。
- [ ] 保持聊天流、对话框和图像生成现有请求、DOM 与错误传播顺序。

## 下一步任务

1. 将 `actions.*` 迁入动作子域，并从 AI 总网关移除仅内容填充需要的 Protyle 渲染出口。
2. 为 `actions.fillContent` 的插入、块渲染、注册表渲染和高亮顺序增加行为测试。
3. 按聊天流、对话框和图像生成职责继续建立子目录及各自网关。

## 不变量

- 不删除、跳过或动态替换 `imports.ts`；每个子域保留可扫描的静态网关。
- 通用基础能力只有一个实现，AI 不复制网络、选区、存储或渲染函数。
- 不用工厂闭包保存跨调用状态；长期状态统一进入现有 Symbol 注册表。
- 不为单个调用点创建 class 碎片接口；涉及 class 时使用完整领域根和 `LooksLike.types.ts` 双向校验。
- 不用 `unknown`、断言、可选空能力或兼容回退掩盖类型和行为差异。
- 测试统一位于 `app/test`。

## 现状基线

- `app/src/ai` 根目录有 22 个文件，混合动作、对话框、流式请求、图像生成、常量、类型、备份与总网关。
- `ai/imports.ts` 同时导出 Dialog、Vue 组件、存储、网络、Protyle 渲染、选区、菜单和 ModelScope API。
- 31 个非 AI 源文件通过该网关获取 `fetchPost`、`focusByRange`、`setStorageVal`、`blockRender`、`getContenteditableElement` 或 `Constants`。
- 当前源码图 `2155` 个节点，唯一 SCC `695`；枚举环会随路径重排变化，仅记录趋势。

## 近期计划

- [x] 完成通用能力外部调用点清理。
- [ ] 建立 `ai/actions` 子域并迁移动作实现。
- [ ] 建立内容填充行为测试。

## 中期计划

- [ ] 拆分 chat stream 状态、请求编排和 UI 对话框装配。
- [ ] 将 ModelScope 图像生成迁入独立适配器子域。
- [ ] 将根目录压到 lint 条目上限以内。

## 远期计划

- [ ] `ai/imports.ts` 退出应用主 SCC。
- [ ] 与 [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md) 和 [前端上帝对象领域拆分](./前端上帝对象领域拆分.ttt.md) 完成零循环验收。

## 风险与验收标准

- AI 菜单动作、内容插入、流式对话、图像生成和 Dialog 行为保持一致。
- 非 AI 源码对 `ai/imports.ts` 的运行时引用归零。
- 每批以目标边、SCC 成员、测试、lint、类型诊断与 `git diff --check` 共同验收。
- Node、相关 Vitest、最终全量类型检查与 `pnpm lint:cycles` 通过后归档。

## 已完成记录

- **2026-07-26**：创建专项 TTT。确认 AI 根目录 22 个文件与总网关混合至少五类职责；登记 31 个非 AI 错误入口和唯一 SCC `695` 基线。首批已将 Card、Editor 菜单与 Asset 菜单的通用网络/选区/存储依赖改回真实所有者，保持函数实现唯一；继续滚动清理其余入口。
- **2026-07-26**：完成 31 个非 AI 错误入口清理，`rg 'ai/imports' app/src` 只允许 AI 子域内部引用，当前外部引用为 `0`。所有调用点经所在目录 `imports.ts` 直达网络、选区、存储、常量和渲染真实所有者；FileTree Schema、goEnd、Search path handlers 与 movePath 同步进入职责子目录，movePath 的 Dialog 数据上下文依赖经 `PublicInstanceLooksLike` 校验的完整 `IDialog`，未保留具体 Dialog 类型。唯一 SCC `695 -> 691`，枚举环因路径重排 `723 -> 734`；目标类型诊断 `0`、Node `157/157`、URI 专项 `2/2` 和 diff 校验通过。迁入目录暴露的旧函数参数/注释 lint 债务继续在本任务中滚动处理，不以豁免或工厂闭包掩盖。
