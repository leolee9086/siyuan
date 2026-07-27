# Backlink 领域上帝对象拆分（TikTocTak）

> **最终目标**：在保持 Backlink 运行时身份、WebSocket、DOM、菜单、编辑器和事务顺序不变的前提下，将 717 行 Backlink 上帝对象按完整领域职责拆分，并消除其参与的全部循环依赖。

> **当前目标**：为 Backlink 构造、排序菜单、条目切换和渲染建立行为基线，再按完整领域职责分阶段迁入 `layout/dock/backlink`；当前直接 Tab Util 环已消除，但 class 仍处于唯一 SCC。

> **下一步任务**：优先补最小化、树展开/关闭和渲染状态恢复测试；随后提取完整树交互或渲染职责，不直接整体搬移 717 行 class。

## 不变量

- 保留唯一 Backlink class、`instanceof` 身份、`backlinkModelBrand` 和现有对象引用。
- 外部依赖经 Backlink 专属 `imports.ts` 显式登记；每项直达真实声明或唯一实现，禁止网关多跳。
- 依赖方使用完整 `BacklinkDomain`；具体 class 只在构造、运行时判别与契约校验边界出现。
- 使用 `PublicInstanceLooksLike<typeof Backlink, BacklinkDomain<...>>` 保持实现和完整抽象双向兼容。
- 不创建按钮级 Port、服务定位器、动态导入、事件绕行、状态闭包或宽泛 `unknown`。
- 跨调用状态由既有模型或注册表持有；无状态查询使用唯一查询领域实现。
- 不改变网络请求、事件监听、DOM 写入、编辑器创建/销毁、菜单操作和错误传播顺序。

## 现状基线

- `Backlink.ts` 共 717 行，混合模型连接、双树交互、排序/搜索、渲染、菜单、Protyle 生命周期与 Dock 最小化。
- class 已有完整 `BacklinkDomain`、稳定厂牌和 `LayoutDomain.contract.test.ts` 双向兼容校验。
- 直接环来自 Backlink 为最小化动作经综合 `layout/tabUtil.ts` 获取已经独立存在的 `layout/query/dockByType.ts` 查询。
- 阶段前生产图：`2307` 节点、`239` 条代表环、唯一 SCC `395`。

## 目标架构

- `backlink/Backlink.ts`：唯一模型组合根与稳定运行时身份。
- `backlink/backlink.types.ts`：完整领域抽象、状态和渲染数据类型。
- `backlink/imports.ts`：本领域外部依赖网关，禁止转发其它网关。
- 后续仅在职责和测试边界清晰时提取树交互、查询/渲染、菜单或编辑器生命周期模块；不为减少行数机械拆分。

## 阶段计划

- [x] Phase 1：清理 Dock 根网关对综合 Tab Util 的无关返回边，保持所有网关出口直达真实声明或唯一实现。
- [ ] Phase 2：补足 Backlink 初始化、最小化和树交互行为测试，固定事件与 DOM 顺序。
- [ ] Phase 3：根据 SCC 出入边审计查询、渲染、菜单和编辑器生命周期职责，逐批提取完整行为。
- [ ] Phase 4：清除 Backlink 相关循环，执行完整类型、Node、浏览器和布局回归并归档。

## 风险与验收

- 迁移不得产生旧路径转发文件；静态搜索旧 `layout/dock/Backlink` 引用为零。
- `lint:imports-gateway-hops` 必须保持为零。
- Backlink class 与 `BacklinkDomain` 双向契约持续通过。
- 每批记录生产图节点、代表环、Tarjan SCC 和目标节点归属；代表环反升不单独判负。
- Node、Protyle 契约、相关 Vitest、`git diff --check` 和循环图均需留存证据。

## 已完成记录

- **2026-07-27**：创建本 TTT。审计确认 Backlink class 共 717 行，构造器、排序菜单、条目切换和渲染均超过 lint 职责门禁；其完整 `BacklinkDomain` 与双向契约已经存在。曾验证整体迁移会同时牵引大量既有严格诊断，因此未保留半迁移状态；先从根 Dock 网关的真实返回边开始解环，再以行为测试支撑上帝对象分阶段拆分。
- **2026-07-27**：完成 Phase 1。Dock 根网关删除无消费者 `resizeTabs`，`getDockByType` 改为直达唯一 Query 领域；Backlink 继续经本目录网关消费，原 `Backlink -> tabUtil -> Backlink` 直接环消失。Custom class 同时归入自身领域后，生产图从 `2307 / 239 / SCC 395` 推进为 `2308 / 230 / SCC 393`。Backlink 与 Tab Util 仍在唯一 SCC，未将直接环清除误记为整个上帝对象拆分完成。
- **2026-07-27**：Backlink class 的页签参数改为完整 `LayoutTab`，内嵌反链编辑器由 AppFacade `createProtyle()` 创建并持有既有 `ProtyleDomain`；具体 Tab/Protyle class 依赖归零。六个普通/右侧/底部打开动作通过扩展后的完整 `AppBlockNavigation.position` 委托 AppFacade，桌面继续透传给原 `openFileById`，移动保持原单编辑器导航语义。Backlink 与完整领域抽象的双向契约同步改用 `LayoutTab` 并通过；首环不再经过 `Backlink -> editor/utils.openFileById`，代表环总数保持 `175` 但首路径推进到 Dock 根网关。
