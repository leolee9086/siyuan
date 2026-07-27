# Protyle 具体实现依赖与移动编辑器领域解耦（TikTocTak）

> **最终目标**：使下层模块、全局运行时槽和跨领域调用仅依赖经双向校验的完整 `ProtyleDomain`；具体 `Protyle` class 只保留在桌面、移动和独立编辑器组合根，并拆分其构造、加载、事务推送与渲染初始化职责。
>
> **当前目标**：以完整类型检查输出建立具体 class 消费清单，区分真正需要公共能力的调用方和仅因历史类型声明携带 private 名义身份的调用方。
>
> **下一步任务**：依次迁移 `window.siyuan.mobile.editor`、Card、Search、Toolbar、Hint 和编辑器工厂到完整 `ProtyleDomain`；每迁移一域同步运行 `PublicInstanceLooksLike`、专项测试和全量类型检查，不创建局部 Protyle 碎片接口。

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

## 阶段计划

### Phase 1：消费者与构造边界清单

- [ ] 记录所有 `import {Protyle}`、`import type {Protyle}` 和全局具体槽。
- [ ] 标记桌面 App、移动 App、独立 Protyle 为允许的构造边界。
- [ ] 为每个非构造消费者记录其实际使用的完整公共成员，不据此创建局部接口。

### Phase 2：全局移动编辑器槽

- [ ] 将 `window.siyuan.mobile.editor` 声明迁为完整 `ProtyleDomain`。
- [ ] 迁移 Search、Card、Toolbar、Hint 等被该槽传播的参数类型。
- [ ] 将 `mobile/editor.ts` 的具体构造改为 `AppFacade.createProtyle()`。
- [ ] 增加移动编辑器创建、切换、复用和销毁行为测试。

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
