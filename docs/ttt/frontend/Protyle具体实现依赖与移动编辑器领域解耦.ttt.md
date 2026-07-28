# Protyle 具体实现依赖与移动编辑器领域解耦（TikTocTak）

> **最终目标**：使下层模块、全局运行时槽和跨领域调用仅依赖经双向校验的完整 `ProtyleDomain`；具体 `Protyle` class 只保留在桌面、移动和独立编辑器组合根，并拆分其构造、加载、事务推送与渲染初始化职责。
>
> **当前目标**：以完整类型检查输出建立具体 class 消费清单，区分真正需要公共能力的调用方和仅因历史类型声明携带 private 名义身份的调用方；同时厘清官方 `siyuan` 类型与 SForge 内部状态的边界。
>
> **下一步任务**：先完成官方 `IProtyleOptions`/`IProtyle` 与本地声明的字段级对照，再依次迁移 `window.siyuan.mobile.editor`、Card、Search、Toolbar、Hint 和编辑器工厂到完整 `ProtyleDomain`；每迁移一域同步运行 `PublicInstanceLooksLike`、专项测试和全量类型检查，不创建局部 Protyle 碎片接口。

---

## 不变量

- `ProtyleDomain` 必须描述 Protyle class 的完整公共实例表面，并继续由 `PublicInstanceLooksLike<typeof Protyle, ProtyleDomain>` 双向校验。
- private `onTransaction/getDoc/afterOnGet/init` 是实现细节，不得为了让外部类型兼容而提升为公共契约。
- 下层消费者不得依赖具体 class 的 private 名义身份；具体 class 仅允许出现在真实构造和契约校验边界。
- 不使用断言、`unknown`、动态导入或工厂闭包掩盖迁移缺口。
- 运行时行为、文档加载时序、插件回调、撤销镜像、WebSocket 与销毁生命周期保持不变。

## 现状基线

- `app/src/protyle/index.ts` 的 lint 实际代码超过 500 行，构造器和消息回调均超过单函数门禁，属于明确的上帝对象。
- `ProtyleDomain` 已覆盖公开字段和方法；2026-07-28 的全量类型实验将 `window.siyuan.mobile.editor` 改为该领域根后，Card、Search、Toolbar、Hint 等消费者暴露具体 `Protyle` 名义依赖。
- 编译诊断中的 `onTransaction/getDoc/afterOnGet/init` 均为 private 成员，证明问题是消费者依赖实现，而不是应把 private 成员加入公共接口。
- 移动编辑器仍在 `mobile/editor.ts` 直接构造具体 Protyle；完整 `AppFacade.createProtyle()` 已可作为最终组合入口。

## 官方类型边界

- `app/node_modules/siyuan` 必须跟随官方 `latest` dist-tag，是插件生态的官方类型来源，导出完整 `IProtyleOptions` 与 `IProtyle`；外部插件兼容检查应直接以安装包为基线。`pnpm run check:siyuan-types` 通过 npm registry、安装目录和 pnpm lockfile 三方校验，依赖更新使用 `pnpm run update:siyuan-types`。
- `app/src/types/protyle.d.ts` 当前保留了一份删改后的同名全局声明。与官方版本相比，已确认的本地差异包括：`IProtyleOptions.status`、`IPreviewAction` 的 `image`、`IProtyle.getInstance()` 返回 `ProtyleDomain`、`IProtyle.app` 使用 `AppFacade`、编辑器内部组件使用本地领域类型，以及 `loadingController`。
- 这些差异不是新的官方协议：前两项是 SForge 私有能力，后几项是为阻断具体实现依赖而形成的内部状态投影。迁移完成前不得删除本地声明；每一项都必须有实际消费者和兼容测试证据。
- `lite` 不是布局尺寸或视觉压缩开关。当前实现以它选择 `LocalUndo`，跳过内核事务提交与同步等待，改变 Hint 的本地填充、拖放中的引用/嵌入语义、上传载荷和插件工具栏筛选；`AgentComposer.protyle.ts` 是当前唯一生产调用点（`lite: true`）。官方字段名为 `lite`，内部文档必须保留上述行为含义，禁止把它泛化成无语义的“精简模式”。
- 官方 `IProtyleOptions` 与本地变体不是直接双向等价：`mode` 在内部收窄为 `wysiwyg`，`preview.actions` 增加 SForge 的 `image`，`status` 是本地状态栏宿主；`toolbar`/`hint` 的回调则通过既有 `RebindSiyuanRuntime` 进行运行时身份重绑定。插件入口必须使用该映射，不能把差异字段静默丢弃。

## 阶段计划

### Phase 1：消费者与构造边界清单

- [x] 记录所有 `import {Protyle}`、`import type {Protyle}` 和全局具体槽。
- [ ] 标记桌面 App、移动 App、独立 Protyle 为允许的构造边界。
- [ ] 为每个非构造消费者记录其实际使用的完整公共成员，不据此创建局部接口。
- [x] 将官方 `siyuan` 类型与本地内部状态投影逐字段对照；每个保留的本地差异登记必要性、消费者和契约测试。

### Phase 2：全局移动编辑器槽

- [ ] 将 `window.siyuan.mobile.editor` 声明迁为完整 `ProtyleDomain`。
- [ ] 迁移 Search、Card、Toolbar、Hint 等被该槽传播的参数类型。
- [ ] 将 `mobile/editor.ts` 的具体构造改为 `AppFacade.createProtyle()`。
- [ ] 增加移动编辑器创建、切换、复用和销毁行为测试。
- [ ] `lite` 语义由内部创建选项明确记录，并由 Agent Composer/事务/上传/Hints 专项测试固定。

### Phase 3：Protyle 上帝对象职责拆分

- [ ] 将构造选项合并与组件装配迁入明确组合工厂。
- [ ] 将文档初次加载及 after-on-get 编排迁入加载生命周期领域。
- [ ] 将 WebSocket 事务推送处理迁入事务同步领域。
- [ ] 保持 Protyle class 作为完整公共门面，并由独立契约文件校验。

### Phase 4：回归与归档

- [ ] 非组合根的具体 Protyle 导入归零。
- [ ] `pnpm typecheck` 中 ProtyleDomain/Protyle 名义不兼容诊断归零。
- [ ] `pnpm lint:cycles` 对应具体实现返回边归零。
- [ ] Node、Protyle 契约、移动端专项、完整 Vitest、开发启动和生产构建通过。

## 风险

- IProtyle 是编辑器内部状态，ProtyleDomain 是编辑器对象公共门面，两者不得混用。
- 把 private 方法加入契约会反转封装方向并扩大实现耦合。
- 移动全局槽高扇出，必须分域迁移并持续运行全量类型检查，禁止一次性断言替换。

## 验收标准

- `PublicInstanceLooksLike<typeof Protyle, ProtyleDomain>` 保持为 `true`。
- 具体 Protyle class 只存在于批准的组合根和契约校验文件。
- 全量 TypeScript、相关测试、开发启动及生产构建通过。
- 相关循环依赖归零，imports 网关仍在真实扫描图中。

## 已完成记录

- **2026-07-28**：在移动编辑器全局槽迁移实验中，以完整类型检查确定 Card、Search、Toolbar、Hint、布局工厂等仍依赖具体 Protyle 名义身份；确认 private 方法缺失诊断不应通过扩张公共契约解决。实验性全局类型改动未纳入生产提交，建立本专项按领域滚动迁移。
- **2026-07-28**：核对 `siyuan@1.2.3` 官方 `types/protyle.d.ts` 与本地 `app/src/types/protyle.d.ts`，确认本地文件是删改复制体而非纯补充；`ProtyleDomain` 是独立的完整 class 公共门面，不能与内部 `IProtyle` 状态或官方插件 `IProtyle` 混名替代。确认 `lite` 的实际行为覆盖 LocalUndo、内核事务/同步、Hint、拖放、上传和插件工具栏，当前生产调用点为 Agent Composer；后续以字段级证据决定保留、迁移或删除每个本地差异。
- **2026-07-28**：新增 `app/test/compatibility/ProtyleEcosystem.contract.test.ts`。固定测试以官方 `siyuan` latest 安装包为基线：稳定选项字段逐项双向可赋值；官方 `IProtyleOptions` 与 `IProtyle` 状态经生产 `RebindSiyuanRuntime` 映射可进入本地类型；显式锁定 `wysiwyg`/`preview` 模式边界、`image` 预览动作、`status` 扩展和 `lite` 字段兼容。`pnpm exec tsx --test test/compatibility/ProtyleEcosystem.contract.test.ts` `1/1` 通过；完整 `pnpm exec tsc -p tsconfig.typecheck.json --pretty false --incremental false` 本次新增文件无诊断，仍报告仓库既有严格类型诊断，未宣称全量类型检查通过。
- **2026-07-28**：将 `siyuan` 依赖声明改为官方 `latest` dist-tag，并新增 `scripts/check-siyuan-types.mjs` 三方校验安装版本、pnpm lockfile 和 npm latest；更新入口为 `pnpm run update:siyuan-types`，校验入口为 `pnpm run check:siyuan-types`。当前 registry latest、安装包和锁文件均为 `1.2.3`，不产生无意义的版本变更。
- **2026-07-28**：Protyle 点击导航的移动分支改用编辑器已持有的完整 `AppFacade.openBlock()`，移除对 `mobile/editor` 的反向运行时导入；保持块引用、虚拟引用、嵌入块和浮窗的既有 action 与焦点时序。Node 回归 `209/209`、`typecheck:protyle-contract`、Protyle 生态契约 `1/1` 和 `git diff --check` 通过；源码循环扫描当前为 `13` 条，剩余环位于配置/插件/全局命令链，不将本批误记为循环完成。
