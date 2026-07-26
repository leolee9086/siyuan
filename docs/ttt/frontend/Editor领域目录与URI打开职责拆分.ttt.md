# Editor 领域目录与 URI 打开职责拆分 (TikTocTak)

## 最终目标

在保持公开入口、运行时行为、事件顺序和 `imports.ts` 依赖可见性的前提下，将 `app/src/editor` 根目录按稳定领域职责组织到子域；所有 class 消费方依赖经 `PublicInstanceLooksLike` 校验的完整 `EditorDomain`，具体 `Editor` 只留在创建和确需运行时构造器身份的边界。

## 当前目标

- [x] 建立完整 `EditorDomain`、运行时厂牌和双向公共表面校验。
- [x] 修正 Editor 页签模型的 `layoutModel` 身份，并准确声明既有挂载流程写入的 `parent`。
- [x] 将 `getAll.ts`、查找/切换、Outline 展开和数据库行预览迁移到完整领域根。
- [x] 将 `openByMobile` 与 `initWindowOpenOverride` 从 Protyle 巨型兼容模块归回 Editor URI/链接职责。
- [ ] 将 URI、打开、查找/切换和文件操作分别迁入稳定子目录，消除 Editor 根目录 23 项门禁。

## 下一步任务

1. 以 `pnpm lint:cycles` 的环成员和 Editor 根目录入/出边为依据划分子域，不按单函数制造接口。
2. 将 `processSiYuanUri.ts`、`openLink.ts` 及其环境依赖归入 URI/链接子域，保持现有公开导入点的调用方直接指向实现所有者。
3. 将 `openFile.ts`、`utils.openFileById.ts`、`util.find.ts`、`util.switchEditor.ts` 归入打开与导航子域。
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
- [ ] 完成打开/导航子域目录迁移。
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
