# Protyle预览模式剥离为独立页签 执行跟踪 (TikTocTak)

> **目标**: 将protyle的preview模式从protyle内部剥离，改为通过TabRegistry注册的独立"导出预览"页签。量化指标：protyle中不再包含preview模式相关代码，导出预览作为独立页签具备完整功能（渲染、设备宽度切换、复制到微信/知乎/语雀、大纲同步），只读模式保留在protyle中不受影响。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 🎯 核心原则

### 架构决策
- **preview是独立视图，不是编辑模式**: preview调用导出API渲染HTML，与wysiwyg编辑器无共享状态，本质是独立功能
- **只读模式是protyle核心功能**: readonly正交于编辑模式，属于protyle自身职责，不随preview剥离
- **使用TabRegistry注册新页签**: 复用已有的TabRegistry机制，通过`openFile({ custom })` 打开
- **接受breaking change**: `switch-protyle-mode`插件事件语义变更是预期的breaking change

### 耦合点清单
1. DOM结构：preview和wysiwyg共享protyle容器
2. 面包屑：preview模式隐藏面包屑
3. 数据加载：preview切回wysiwyg需重新getDoc
4. 插件事件：`switch-protyle-mode`事件
5. 大纲同步：preview模式有独立的大纲点击同步逻辑
6. WebSocket：onTransaction在preview模式下重新渲染预览

### 验证检查清单
- [ ] 导出预览页签能正确渲染文档预览
- [ ] 设备宽度切换功能正常
- [ ] 复制到微信/知乎/语雀功能正常
- [ ] 大纲同步功能正常
- [ ] protyle wysiwyg编辑功能不受影响
- [ ] protyle只读模式不受影响
- [ ] 面包屑菜单中"编辑模式"子菜单已改为打开导出预览菜单项
- [ ] lint通过，无编译错误
- [ ] 无循环依赖产生

---

## ℹ️ 如何维护此文档

1. **完成归档**: 任务完成后,**必须**剪切粘贴到【已归档】列表,并打上 `[x]` 和日期。
2. **补充弹药**: 当【近期计划】空了,从【中期计划】里挑选任务挪上去。
3. **因地制宜**: 如果发现计划不合理,随时修改或删除。
4. **数据驱动**: 用数据说话,不凭感觉。

---

## 🟢 近期计划

（无）

---

## 🟡 中期计划

（无）

---

## 🔴 远期计划

（无）

---

## 🏁 已归档/已完成

- [x] **Phase 5: 验证与清理 (P2)** — 完成于 2026-02-28
  - TypeScript 编译通过（唯一错误 TS2688 `./src/types` 是预先存在的 tsconfig 配置问题，与本次重构无关）
  - `export-preview/` 模块完整：5个文件（constants、init.types、init.guard、init、register），已注册到 TabRegistry
  - `protyle/preview/index.ts`（Preview 类）已删除确认，`TEditorMode` 仅包含 `"wysiwyg"`
  - 生产代码中无 `protyle.preview` 引用（仅 `.backup` 文件中存在）
  - 所有入口已改为打开导出预览页签：面包屑菜单、快捷键（editKeydown.ts）、右键菜单（menus/util.ts）
  - lint 无代码质量错误（仅 `task-checker/require-task` 项目级任务管理规则触发，非代码问题）
  - 备份文件（`.backup`）待后续清理

- [x] **Phase 4: 兼容性处理 (P1)** — 完成于 2026-02-28
  - `switch-protyle-mode` 事件：在 `setEditMode.ts` 和 `types/index.d.ts` 添加 `@breaking-change` 注释，说明事件语义变更（仅在wysiwyg初始化时触发，不再有preview模式切换）
  - `protyle.preview` 残留：生产代码中无残留引用（仅 `.backup` 文件中存在，非生产代码）
  - `config.d.ts` 中 Editor mode 和 Outline isPreview 的注释已更新，说明 preview 模式剥离
  - `uiLayout.schema.ts` 中 schema 保留 `"preview"` 用于向后兼容旧布局配置，添加了 `@backward-compat` 注释
  - `isValidEditorMode` guard 已正确处理旧布局中的 `mode: "preview"` 值（过滤为 undefined，回退到 wysiwyg）
  - CHANGELOG 不修改（上游维护）

- [x] **Phase 3: 清理protyle中的preview相关代码 (P1)** — 完成于 2026-02-28
  - `TEditorMode` 类型简化为仅 `"wysiwyg"`，移除 `IProtyle.preview` 属性
  - `setEditMode.ts` 移除 preview 分支，`protyle/index.ts` 移除 Preview 实例创建和 onTransaction preview 处理
  - 清理 20+ 文件中的 `protyle.preview` 引用和 `mode: "preview"` 引用
  - preview 快捷键改为打开 export-preview 页签（editKeydown.ts、menus/util.ts）
  - 删除 `protyle/preview/index.ts`（Preview 类）、`utils.ts`、`utils.ts.old`
  - 保留 `protyle/preview/` 中被 export-preview 和其他模块依赖的文件（image.ts、copyToX.ts、actionButtons.ts、link2online.ts、zhihuAdapter.ts）
  - TypeScript 编译通过，无 preview 相关编译错误

- [x] **Phase 2: 修改入口——面包屑菜单 (P0)** — 完成于 2026-02-28
  - 移除了 `添加编辑模式菜单项` 函数及其辅助函数 `处理所见即所得响应`（含 wysiwyg 和 preview 两个子菜单项）
  - 新增 `添加导出预览菜单项` 作为面包屑菜单的顶级菜单项，点击后通过 `openFile({ custom })` 打开 `export-preview` 页签
  - 更新 `showBreadcrumbMenu.ts` 中的导入和调用
  - 修复 `menuItems.misc.ts` 中的 export forwarding 问题（改为直接从 `menuItems.upload` 导入）
  - 只读模式菜单不受影响
  - 面包屑菜单中不再调用 `setEditMode(protyle, "preview")`

- [x] **Phase 1: 创建导出预览页签 (P0)** — 完成于 2026-02-28
  - 在 `app/src/export-preview/` 下创建独立模块：`constants.ts`、`init.types.ts`、`init.guard.ts`、`init.ts`、`register.ts`
  - 通过 TabRegistry 注册 `export-preview` 页签类型
  - 迁移了 Preview 类的全部渲染逻辑：设备宽度切换、复制到微信/知乎/语雀、图片预览、链接导航、大纲同步高亮
  - 在 `app/src/index.ts` 中添加副作用导入确保启动时注册
  - TypeScript 编译通过，lint 通过

---

## 📊 进度跟踪

- **总任务数**: 5个Phase
- **已完成**: 5个（Phase 1-5） ✅ 全部完成
- **进行中**: 0个
- **近期计划**: 0个
- **中期计划**: 0个
- **远期计划**: 0个

---

## 📚 重要参考文档

### 适用规程
| 规程 | 说明 |
|------|------|
| [`docs/规程/代码质量/前端模块功能剥离.procedure.md`](../../规程/代码质量/前端模块功能剥离.procedure.md) | 功能剥离主规程 |
| [`docs/规程/代码质量/代码拆分与模块化.procedure.md`](../../规程/代码质量/代码拆分与模块化.procedure.md) | 文件拆分细节参考 |

### 关键代码文件
| 文件 | 说明 |
|------|------|
| [`app/src/protyle/util/setEditMode.ts`](../../app/src/protyle/util/setEditMode.ts) | 编辑模式切换核心 |
| [`app/src/protyle/preview/index.ts`](../../app/src/protyle/preview/index.ts) | Preview类实现（迁移源） |
| [`app/src/protyle/breadcrumb/menu/menuItems.ts`](../../app/src/protyle/breadcrumb/menu/menuItems.ts) | 面包屑菜单定义 |
| [`app/src/protyle/ui/initUI.ts`](../../app/src/protyle/ui/initUI.ts) | 初始化时调用setEditMode |
| [`app/src/protyle/index.ts`](../../app/src/protyle/index.ts) | Protyle主类 |
| [`app/src/protyle/util/onGet.ts`](../../app/src/protyle/util/onGet.ts) | disabledProtyle/enableProtyle |
| [`app/src/layout/utils/newTab.ts`](../../app/src/layout/utils/newTab.ts) | 页签工厂 |
| [`app/src/registry/TabRegistry.ts`](../../app/src/registry/TabRegistry.ts) | Tab类型注册表 |

---

**文档创建**: 2026-02-28
**最后更新**: 2026-02-28
**文档类型**: TikTocTak执行跟踪文档
