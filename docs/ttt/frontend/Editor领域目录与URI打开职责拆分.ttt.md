# Editor 领域目录与 URI 打开职责拆分 (TikTocTak)

## 最终目标

在保持公开入口、运行时行为、事件顺序和 `imports.ts` 依赖可见性的前提下，将 `app/src/editor` 根目录按稳定领域职责组织到子域；所有 class 消费方依赖经 `PublicInstanceLooksLike` 校验的完整 `EditorDomain`，具体 `Editor` 只留在创建和确需运行时构造器身份的边界。

## 当前目标

- [x] 建立完整 `EditorDomain`、运行时厂牌和双向公共表面校验。
- [x] 修正 Editor 页签模型的 `layoutModel` 身份，并准确声明既有挂载流程写入的 `parent`。
- [x] 将 `getAll.ts`、查找/切换、Outline 展开和数据库行预览迁移到完整领域根。
- [x] 将 `openByMobile` 与 `initWindowOpenOverride` 从 Protyle 巨型兼容模块归回 Editor URI/链接职责。
- [ ] 将 URI、打开、查找/切换和文件操作分别迁入稳定子目录，消除 Editor 根目录 23 项门禁；打开编排入口已迁入 `editor/open`，协作算法仍待归入该子域。

## 下一步任务

1. 以 `pnpm lint:cycles` 的环成员和 Editor 根目录入/出边为依据划分子域，不按单函数制造接口。
2. 核对 `editor/processSiYuanUri.ts` 与 `util/uri.ts` 的分发语义差异，再将 URI/链接职责归入稳定子域；在确定语义前不强行合并。
3. 将 `utils.openFileById.ts`、`util.find.ts`、`util.switchEditor.ts` 继续归入已建立的 `editor/open` 子域。
4. 将重命名、删除和资源打开归入文件操作子域。
5. 每阶段运行完整 EditorDomain 契约、Node 回归、相关浏览器测试、类型检查过滤、lint 与循环图证据。

## 不变量

- 不使用动态导入、字符串模块路径、lint 忽略、全局注册或兼容回退隐藏依赖。
- 保留 `imports.ts`，并让每个子域通过自己的网关显式声明真实外部依赖。
- 不复制 `openByMobile`、布局查询、PDF 加载门禁或 URI 分发算法。
- 不用 `unknown`、`never` 或断言掩盖实现与领域根不一致。
- 不把 Agent 独立 Tab Port 与普通文档 `newTab` 语义强行合并。
- 测试只放在 `app/test`。

## 现状基线

- `src/editor` 根目录文件数：23，lint 上限：10。
- `EditorDomain` 相关完整类型诊断：0。
- `getAll.ts -> editor/index.ts`：无路径。
- `editor/imports.ts` 仍位于唯一应用级 SCC，但已退出首条代表环。
- 当前源码图为单一 SCC（`782` 个节点）；Editor imports 参与约 `32` 条代表环，首环已转移到 Protyle compatibility/Search/Layout Dock 链。

## 近期计划

- [ ] 完成 URI/链接子域目录迁移和行为测试。
- [ ] 完成打开/导航子域目录迁移；`openFile.ts` 与专属 `imports.ts` 已完成，协作文件待迁移。
- [ ] 清理根 imports 中已归位的布局和 Protyle 聚合出口。

## 中期计划

- [ ] 迁移剩余 `instanceof Editor` 到完整领域守卫；仅创建、工厂和明确要求构造器身份的边界保留具体 class。
- [ ] 将 Editor 根目录压到 lint 阈值以内。

## 远期计划

- [ ] 与 [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md) 一同完成零循环验收。
- [ ] 与 [前端上帝对象领域拆分](./前端上帝对象领域拆分.ttt.md) 复核 Editor、Layout、Protyle 的最终依赖方向。

## 风险与验收标准

- URI、移动原生桥接、`window.open` 覆盖和外链行为与迁移前一致。
- 文档、资源、搜索、自定义、卡片和数据库行页签创建行为一致。
- `PublicInstanceLooksLike<typeof Editor, EditorDomain<...>>` 持续通过。
- `pnpm run test:node`、相关 Vitest、`typecheck:protyle-contract` 和 `git diff --check` 通过。
- 环数量只记录趋势；以目标边、环成员、依赖方向和 SCC 性质作为判断依据。

## 已完成记录

- **2026-07-25**：创建专项 TTT。Editor 完整领域根已建立；`getAll.ts` 的具体 Editor 路径归零；URI/移动打开职责从 `protyle/util/compatibility.ts` 迁回 Editor，兼容模块不再反向加载 `processSiYuanUri`。
- **2026-07-25**：EditorDomain 双向契约对齐真实公共表面：显式声明 `layoutModel/parent`，并保留 Protyle 初始化早期文档根尚未就绪的类型状态；布局查询、PDF 加载门禁和 Dock 查找分别迁出 Editor 反向依赖。`openByMobile/initWindowOpenOverride` 保持唯一实现，移动 App 组合根补齐同一个完整 `AppFacade`，未创建调用点碎片接口。源码图为 `2134` 节点、`863` 条代表环、唯一 SCC `782`；下一阶段处理 URI/链接子目录与首环中的 compatibility 平台边。
- **2026-07-25**：本批目标文件 TypeScript 诊断 `0`，Node `149/149`、Layout 查询 `3/3`、Editor/AppFacade 契约和 `git diff --check` 通过；Editor 根目录数量门禁继续作为下一阶段目录职责迁移的显式待办。
- **2026-07-25**：后续首环审计将 Search defaults 与存储写入从综合网关剥离，compatibility/Search 链不再成为首环；唯一 SCC `782 -> 748`。Editor URI 目录任务继续保留，但下一轮循环治理先按新的 Emoji/Files 首环判断真实职责方向。
- **2026-07-26**：清理 Editor 根 `imports.ts` 中 `newTab`、`zoomOut`、移动打开、Protyle class、fullscreen、setPadding、onGet、resize、DOM 定位、导航栈和 checkFold 的无消费者或单消费者高扇出转发；真实消费者直达唯一职责所有者。`openFile.ts` 迁入 `editor/open` 并建立子域 `imports.ts`，所有五个调用点已更新；`newTab` 缺失由显式创建门禁抛错，不再以可能为空的值继续执行。Editor 根总网关退出唯一 SCC，组件从 `708` 减至 `701`；源码 `2151` 节点、`719` 条枚举环。新子域 lint、目标 TypeScript 诊断、Node `157/157` 与 diff 校验通过。
- **2026-07-26**：本地路径打开迁入 `platform/localPath`，资产打开迁入 `asset/open`，旧 Editor 文件删除且调用点直达真实职责所有者。资产导航进一步作为完整 AppFacade 实例方法由桌面/移动组合根分别实现，不用工厂闭包保存宿主或状态；全部下层调用点不再反向加载资产打开实现。源码唯一 SCC `702 -> 700`，两个新子域均退出组件，枚举环 `723 -> 718`；下一步按首环核对两套 URI 实现语义并建立测试矩阵。
- **2026-07-26**：Editor 版本 URI 实现迁入 `editor/uri` 并建立专属 `imports.ts`；blocks/plugins 的既有语义不与 `util/uri` 的 Bazaar、AV 定位和插件模型校验强行合并。完整 AppFacade 同步接管 URI，桌面/移动 App 分别实现块导航，移除移动实现动态导入；下层不再加载 URI 具体实现。新增专项测试 `2/2`，目标 TypeScript 诊断 `0`、Node `157/157`、新目录 lint 和 diff 校验通过。唯一 SCC `700 -> 695`，URI 子域、`openLink` 与 Editor 总网关退出组件；下一步为 `util/uri` 补齐同强度行为矩阵后再判断权威实现或语义分层。
