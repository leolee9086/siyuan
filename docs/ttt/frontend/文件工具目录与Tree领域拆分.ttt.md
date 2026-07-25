# 文件工具目录与 Tree 领域拆分（TikTocTak）

> **最终目标**：在保持文件、笔记本、路径、移动和 Tree 行为不变的前提下，将 `app/src/util/file` 重组为职责清晰、目录门禁合格的单向领域结构。
>
> **当前目标**：建立 Tree 完整公共领域根并登记根目录 19 个源码条目的体量问题。
>
> **下一步任务**：以 `movePathTo`、Tree、通用文件动作和 notebook/path 现有子域为边界制定迁移表，再按真实导入关系分批移动。

## 不变量

- 不删除或绕过 `imports.ts`，不通过动态导入、字符串路径或 lint 豁免隐藏依赖。
- 不改变 Tree DOM、点击、展开折叠、拖拽和数学渲染顺序。
- Tree class 的外部依赖必须指向完整 `TreeDomain`，具体 class 仅在初始化和严格契约测试边界出现。
- 文件移动只改变模块所有权和导入路径，不复制实现。
- Madge 枚举数允许阶段性反升，以目标路径、SCC 和行为测试验收。

## 现状基线

- **2026-07-26**：`app/src/util/file` 被 lint 报告为 19 个源码文件，超过目录上限 10；`movePathTo.*` 是最大同域文件组。
- `Tree.ts` 约 330 行，公共表面为 `element/click` 与六个树动作。
- 已有 `notebook/`、`path/` 子域，后续迁移应复用而非建立平行实现。

## 分阶段计划

- [x] 新增完整 `TreeOptions` 与 `TreeDomain`，并以 `PublicInstanceLooksLike<typeof Tree, TreeDomain>` 严格校验。
- [x] CustomLists 仅依赖 `TreeDomain`，具体 Tree 构造移至 Dock 工厂。
- [ ] 将 `movePathTo.*` 归入单一子域并保留唯一入口转发。
- [ ] 复核 `newFile/fileHtmlGenerator/getSavePath/pathName` 的领域归属和跨域出口。
- [ ] 根目录与各子目录通过条目门禁，Tree 相关循环路径保持为零。

## 验收标准

- `util/file` 根目录不超过门禁，子域命名反映真实职责。
- Tree 完整契约持续严格成立，生产依赖不导入具体 Tree class。
- Node、相关浏览器行为、TypeScript、Madge 与 `git diff --check` 通过。

## 已完成记录

- **2026-07-26**：创建专项 TTT。新增 `tree.types.ts`，Tree 构造参数和完整公共实例表面均由稳定类型描述；CustomLists 通过构造参数接收 Tree 工厂。`TreeDomain` 循环路径为 `0`，CustomLists 目标路径归零，Node `140/140`；目录条目门禁保留给后续物理领域拆分，不添加豁免。
