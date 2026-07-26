# Editor 重命名与资源操作职责拆分 (TikTocTak)

## 最终目标

将 `app/src/editor/rename.ts` 中混合的文档/笔记本重命名、资产重命名和选区建文职责归入各自领域，使 AV、媒体菜单和资产模型不再为资产操作加载 Editor 综合网关；所有运行逻辑保持唯一实现。

## 当前目标

- [x] 将资产重命名对话框、请求、已打开资产模型更新和编辑器刷新完整迁入 Asset 子域。
- [x] 迁移所有资产重命名调用方，删除 Editor 中对应实现和专属依赖。
- [x] 保持文档/笔记本重命名与选区建文行为不变。

## 下一步任务

1. [x] 建立 Asset rename 子域及其 `imports.ts`，直接依赖稳定领域所有者。
2. [x] 迁移 AV、图片、视频和链接菜单调用方。
3. [x] 运行专项 lint、Node 回归、目标类型诊断、循环图和 SCC 归约。
4. [ ] 评估剩余 `editor/rename.ts` 的文档/笔记本重命名与选区建文归属。

## 不变量

- 资产重命名 API、对话框文案、按钮顺序、移动端宽度、模型路径更新、编辑器刷新顺序和销毁时机不变。
- 不复制 DOM 查询、对话框或资产更新逻辑；完全相同的实现保持唯一。
- 不引入调用点碎片 Port，不使用 `unknown/never`、断言、动态导入或 imports 扫描豁免隐藏依赖。
- 具体 Dialog class 仅出现在创建对话框的 UI 组合边界；行为依赖完整 Asset/Editor 领域集合。
- 测试位于 `app/test`，`imports.ts` 保持参与依赖图。

## 现状基线

- `editor/rename.ts` 共 307 行，拥有三组不同领域职责。
- 资产重命名唯一实现被 AV Asset、图片菜单、视频菜单和链接菜单使用。
- 当前源码图 `2147` 个节点、`719` 条枚举环、唯一 SCC `708`。
- 当前首环经 `protyle/render/av/asset.ts -> editor/rename.ts` 回到 Editor。

## 近期计划

- [x] 完成 Asset rename 子域迁移并解除 AV -> Editor rename 运行时边。
- [x] 删除 Editor imports 中仅服务资产重命名的依赖转发。
- [x] 更新主循环依赖与上帝对象 TTT。

## 中期计划

- [ ] 评估文档/笔记本重命名是否归入 filetree/notebook 领域。
- [ ] 评估选区建文是否归入 Editor selection command 领域。

## 风险与验收标准

- 原四类入口继续调用同一资产重命名实现。
- 重命名成功后先更新已打开 Asset 模型，再刷新全部 Editor，最后销毁 Dialog。
- 移动端保持不更新桌面 Asset 模型的既有语义。
- Node 回归、目标文件 lint、目标类型诊断和 `git diff --check` 通过。
- 阶段有效性以目标具体值边归零及 SCC 缩小为准，不以枚举环数量单独判断。

## 已完成记录

- **2026-07-26**：建立专项 TTT，登记 `editor/rename.ts` 的三领域混合基线及资产重命名首阶段。
- **2026-07-26**：资产重命名完整生命周期迁入 `asset/rename`，AV、图片、视频和链接菜单全部直达唯一实现；Editor 删除资产专属代码和依赖。文档与资产 Dialog 共同复用 `queryFormElements` 的唯一类型收窄实现，真实 DOM 测试 `1/1`、Node `157/157`、新文件 lint、目标 TypeScript 诊断和 diff 校验通过。目标 `AV asset -> editor/rename` 运行时边归零；枚举环仍为 `719`、唯一 SCC 仍为 `708`，说明同组件存在其他菜单回路，本阶段不据此虚报 SCC 收益，专项 TTT 继续追踪剩余两类职责。
