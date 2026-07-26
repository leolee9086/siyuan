# Protyle 领域根构造与消息生命周期拆分 (TikTocTak)

## 最终目标

将 `app/src/protyle/index.ts` 的构造装配、WebSocket 消息处理、文档加载和公共领域行为拆入职责明确的子域；`Protyle` class 保留完整公共领域根与必要生命周期状态，并继续由 `PublicInstanceLooksLike` 对具体 class 和 `ProtyleDomain` 执行双向兼容校验。

## 当前目标

- [x] 将退出聚焦行为纳入完整 `ProtyleDomain`，清除下层 Protyle 模块对菜单具体实现的运行时依赖。
- [ ] 拆分 224 行构造器的纯配置、DOM 初始化和运行时组件装配。
- [ ] 拆分 120 行消息回调与 63 行事务处理，保持消息顺序和同步状态变更。

## 下一步任务

1. 为构造阶段建立初始化顺序和可选组件矩阵测试。
2. 提取只依赖完整初始化上下文的 UI 组件装配，不创建调用点碎片接口。
3. 将 WebSocket 命令分发按消息领域拆分，具体 Protyle class 只在组合根绑定。
4. 为文档加载、退出聚焦和销毁路径补齐行为测试。

## 不变量

- `ProtyleDomain` 描述 class 的完整公共表面，并由 `PublicInstanceLooksLike` 双向校验；不以多个局部接口替代领域根。
- `IProtyle.getInstance()` 返回完整 `ProtyleDomain`，下层模块不加载具体 class。
- 工厂只负责装配，不通过闭包保存跨调用状态；此类状态统一进入可枚举、可替换、可重置的 Symbol 注册表。
- 保留 `imports.ts` 暴露真实依赖，不用动态导入、事件绕行或注册行为隐藏静态耦合。
- 初始化、消息、事务、插件事件和销毁顺序保持不变；所有失败保持显式。
- 测试位于 `app/test`。

## 现状基线

- `app/src/protyle/index.ts` lint 报告 504 行。
- constructor 为 224 行，`msgCallback` 为 120 行，`onTransaction` 为 63 行。
- 完整 `ProtyleDomain` 已存在于 `protyle/protyle.types.ts`，契约测试位于 `app/test/layout/LayoutDomain.contract.test.ts`。
- 本任务启动时源码图为唯一 SCC `690`，Madge 枚举环 `702`。

## 近期计划

- [ ] 固定构造和消息行为测试基线。
- [ ] 构造器降至 50 行以内。
- [ ] 消息回调与事务处理分别降至 50 行以内。

## 中期计划

- [ ] Protyle 子模块仅通过完整领域根调用跨子域公开行为。
- [ ] 具体 class 只在创建、组合和契约校验边界出现。

## 远期计划

- [ ] 与 [前端循环依赖类型解耦](./前端循环依赖类型解耦.ttt.md) 联动完成 Protyle 子图零循环。
- [ ] 与 [前端上帝对象领域拆分](./前端上帝对象领域拆分.ttt.md) 一并归档。

## 风险与验收标准

- Protyle 初始化后的组件存在性、消息处理顺序、退出聚焦和销毁行为与基线一致。
- `PublicInstanceLooksLike<typeof Protyle, ProtyleDomain>` 持续通过。
- Protyle 子域对 `menus/protyleMenus/editorMenu/protyle.zoomOut` 的运行时导入只允许组合根保留。
- 目标类型诊断、契约测试、Node/Vitest 回归、lint 与 `git diff --check` 通过。

## 已完成记录

- **2026-07-26**：创建专项 TTT。新增完整 `ProtyleZoomOutOptions` 公共数据契约和 `ProtyleDomain.zoomOut()`；`IProtyle.getInstance()` 从具体 class 改为完整领域根。transaction、breadcrumb、hint、gutter、wysiwyg 与 DnD 共 11 个模块改由领域根实例调用，具体 `zoomOut` 运行时导入仅留在 Protyle 组合根。`typecheck:protyle-contract` 通过；唯一 SCC 暂仍为 `690`，枚举环 `702 -> 700`，说明其它返回路径仍需继续处理。
- **2026-07-27**：`IProtyle.wysiwyg` 从具体 WYSIWYG class 改为经独立双向契约验证的完整 `WYSIWYGDomain`，BlockPanel 测试夹具同步满足完整 WYSIWYG 与既有 `ProtyleDomain.zoomOut()` 表面。具体编辑区类型不再沿全局 Protyle 数据结构传播；目标类型诊断 `0`，Node `181/181`，唯一 SCC `676 -> 675`。
- **2026-07-27**：默认上传结果投影和本地路径上传成为完整 `ProtyleDomain` 正式行为，传输层通过 `IProtyle.getInstance()` 依赖领域根，不加载具体 Protyle 或默认 `insertHTML` 实现；具体 class 在组合根复用两个唯一实现。`IProtyle.upload` 从具体 Upload class 改为完整 `UploadDomain`，新增独立 `PublicInstanceLooksLike<typeof Upload, UploadDomain>` 双向契约。Node `194/194` 与 Protyle 契约类型通过；上传传输和 AV Asset 退出 SCC，唯一组件 `618 -> 615`。
