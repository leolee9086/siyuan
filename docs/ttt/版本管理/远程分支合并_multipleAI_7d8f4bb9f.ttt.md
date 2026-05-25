# multipleAI 合并 origin/dev 执行跟踪 (TikTocTak) — 第2轮

> **目标**: 在 `multipleAI` 分支上完成 `origin/dev` (`MERGE_HEAD=7d8f4bb9f`) 的第2轮合并。本轮 29 个冲突文件 + 上游 `dock.element` → `dock.elements[]` API 变更导致的 s-forge 重构模块错误修复。逐项审查上游 commit、逐项移植变更、逐项验证。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 按规程逐文件审查上游 commit、移植变更、git add。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将下一批次补充到"近期计划"。

## 工作守则 — 必须遵守

1. **逐个确认**：每个冲突文件的分析和合并方案，必须先展示给用户确认，得到回复后方可执行 git add。
2. **禁止批量**：同一时间只处理一个文件，不可同时对多个文件执行操作。
3. **逐 commit 审查**：每次先展示上游 commits 列表，再展示每个 commit 的实际改动，最后给出合并方案。
4. **用户确认**：得到用户确认后，执行 git add 并更新 TTT。

## 核心原则

1. 以本地重构架构为骨架，不回退本地模块拆分和抽象。
2. 对每个冲突文件先 `git log base..MERGE_HEAD -- <file>` 确认上游 commit 列表，再 `git show <hash>` 逐个查看实质性改动，最后判定"已存在于本地 / 需移植 / 在子模块处理"。
3. 包管理文件按"共有依赖取较高版本、双方独有依赖均保留"处理；`pnpm-lock.yaml` 删除后重生。
4. `deleted by us` 文件必须按"一对多文件映射"检查本地重构后的承接位置，不得直接恢复旧文件。
5. **s-forge 特有**：上游将 `dock.element` 重构为 `dock.elements[]`，s-forge 的 5 个拆分模块未同步更新，需将上游 API 变更移植到这些模块。

### 验证检查清单

- [ ] 无残留冲突标记（`git grep "[<]\{7\}"`）
- [ ] `git diff --name-only --diff-filter=U` 为空
- [ ] 每个文件的上游 commit 已逐个审查
- [ ] 上游实质性改动已在解决后的代码中逐项确认
- [ ] s-forge 拆分模块（dock.relation.ts, dock.toggle.ts, dock.visibility.ts, dock.resize.ts, dock.layout.ts）中的 `dock.element` 已改为 `dock.elements[]`
- [ ] 应用能正常构建
- [ ] `.backup/.remote` 已在最终验证完成后统一清理

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，必须剪切粘贴到【已归档/已完成】列表，并打上 `[x]` 和日期。
2. **保持单线程**：同一时间只允许一个任务为 `[-]`。
3. **记录证据**：每完成一个文件，记录对应的处理方式、上游 commit 列表和移植内容。
4. **不得批量**：不得对多个文件同时执行相同的操作而不逐一审查。

## 🟢 近期计划

- [x] **Phase 0: 创建 TTT 文档 & 冲突盘点 (P0)** [已完成 2026-05-22]
  - **背景**: 确认合并范围、冲突清单，按规程启动 TTT 跟踪。
  - **验收标准**: 29 个冲突文件全部列在下方批次清单中，merge-base 和 MERGE_HEAD 已确认。
  - **参考文档**: `docs/规程/版本管理/远程分支合并.procedure.md`

- [-] **Phase 1: 包管理/配置文件** — `README.md`, `README_zh_CN.original.md`, `app/nsis/installer.nsh` (package.json/pnpm-lock.yaml 已自动合并), `kernel/go.mod`, `kernel/go.sum`
- [ ] **Phase 2: 核心入口 & 常量** — `app/src/asset/index.ts`, `app/src/constants.ts`, `app/src/emoji/index.ts`, `app/src/layout/util.ts`, `app/src/util/fetch.ts`
- [ ] **Phase 3: 布局/窗口模块** — `app/src/layout/Wnd.ts`
- [ ] **Phase 4: Dock 子模块** — `app/src/layout/dock/Files.ts`
- [ ] **Phase 5: 状态/热点更新** — `app/src/layout/status.ts`, `app/src/menus/navigation.ts`, `app/src/menus/protyle.ts`
- [ ] **Phase 6: 移动端** — `app/src/mobile/dock/MobileFiles.ts`, `app/src/mobile/menu/index.ts`, `app/src/mobile/util/setEmpty.ts`
- [ ] **Phase 7: Protyle 核心** — `app/src/protyle/gutter/index.ts`, `app/src/protyle/hint/index.ts`, `app/src/protyle/util/compatibility.ts`, `app/src/protyle/util/editorCommonEvent.ts`, `app/src/protyle/wysiwyg/commonHotkey.ts`, `app/src/protyle/wysiwyg/index.ts`, `app/src/protyle/wysiwyg/keydown.ts`, `app/src/protyle/wysiwyg/list.ts`, `app/src/protyle/wysiwyg/remove.ts`, `app/src/protyle/wysiwyg/transaction.ts`
- [ ] **Phase 8: s-forge dock.element 移植** — `dock.relation.ts`, `dock.toggle.ts`, `dock.visibility.ts`, `dock.resize.ts`, `dock.layout.ts`
- [ ] **Phase 9: 最终验证 & 清理**

## 🟡 中期计划

- [ ] **Phase 10: 后端 kernel** — `kernel/sql/queue.go`

## 🏁 已归档/已完成

- (暂无)
