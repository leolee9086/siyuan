# multipleAI 合并 origin/dev 执行跟踪 (TikTocTak)

> **目标**: 在 `multipleAI` 分支上完成 `origin/dev` (`MERGE_HEAD=ca38872f1`) 的合并；当前未解决冲突已清零，关键上游改进已按本地重构架构完成移植，并已完成锁文件重建、基础构建验证和 `.backup/.remote` 清理，可直接提交 merge commit。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

## 核心原则

1. 以本地重构架构为骨架，不回退本地模块拆分和抽象。
2. 对每个冲突文件先确认上游自 `merge-base=9914fd1d39` 以来的实质性改动，再决定保留、移植或判定已覆盖。
3. 包管理文件按“共有依赖取较高版本、双方独有依赖均保留”处理；`pnpm-lock.yaml` 删除后重生。
4. `deleted by us` 文件必须按“一对多文件映射”检查本地重构后的承接位置，不得直接恢复旧文件。
5. 每批次完成后都要回写文档，保持单一进行中任务。

### 验证检查清单

- [x] 无残留冲突标记（已排除 `kernel/vectordb/vamana/benchmark_4bit_optimized.txt` 的文本假阳性）
- [x] `git diff --name-only --diff-filter=U` 为空
- [x] 关键入口与配置文件可通过基础语法校验
- [x] 上游实质性改动已在解决后的代码中逐项确认
- [x] `.backup/.remote` 已在最终验证完成后统一清理

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，必须剪切粘贴到【已归档/已完成】列表，并打上 `[x]` 和日期。
2. **保持单线程**：同一时间只允许一个任务为 `[-]`，避免并行处理多组冲突导致遗漏。
3. **记录证据**：每完成一个批次，都补充对应文件、上游改动摘要和验证结果。
4. **因地制宜**：如果实际冲突范围变化，允许调整批次，但必须保留原始问题描述和处理结论。

## 🟢 近期计划

- 当前批次已全部完成，本文档将在本次 merge commit 后归档。

## 🟡 中期计划

- 无。当前有限任务已完成。

## 🏁 已归档/已完成

- [x] **Phase 4: 后端冲突与合并验证** [已完成 2026-04-11]
  - **背景**: `kernel/sql/block_ref_query.go`、`kernel/util/working.go` 影响后端行为；最终还需做全局验证、锁文件重建和备份清理。
  - **完成情况**: 已完成 `kernel/sql/block_ref_query.go` 与 `kernel/util/working.go` 的上游改进移植，补入 macOS 默认工作区路径、`AccessAuthCode` 清洗顺序、日志格式修复；按规程重建并强制纳入 `app/pnpm-lock.yaml`；执行 `pnpm build` 成功，执行 `go test ./util ./sql` 通过；已清理全仓库 119 个 `.backup/.remote` 文件；当前 `git diff --name-only --diff-filter=U` 为空，可直接提交 merge commit。
  - **成果文件**: `kernel/sql/block_ref_query.go`, `kernel/util/working.go`, `kernel/util/ocr.go`, `kernel/util/working_mobile.go`, `app/pnpm-lock.yaml`
  - **参考文档**: `docs/规程/版本管理/远程分支合并.procedure.md`

- [x] **Phase 3: Protyle 与移动端冲突处理** [已完成 2026-04-11]
  - **背景**: `protyle` 与 `mobile` 文件数量最多，且存在本地模块拆分，遗漏上游功能点的风险最高。
  - **完成情况**: 已完成 `MobileFiles`、`plugin/API`、`popover`、`openTitleMenu`、`gutter`、`Background`、`toolbar/Link`、`paste/processCode`、`wysiwyg`、`upload`、`AV` 渲染和多种 `render/*` 渲染器冲突处理；保留本地模块拆分架构，将上游有效修复映射到 `tooltip.ts`、`openTitleMenu.items.ts`、`background/image.ts`、`dnd/*`、`cell.*` 等子模块；额外完成 Mermaid 渲染升级与 SVG 安全清洗。该批次完成后，未解决冲突已清零。
  - **成果文件**: `app/src/mobile/dock/MobileFiles.ts`, `app/src/plugin/api/openWindow.ts`, `app/src/protyle/render/mermaidRender.ts`, `app/src/protyle/util/paste.ts`, `app/src/protyle/util/processCode.ts`
  - **参考文档**: `docs/规程/版本管理/远程分支合并.procedure.md`

- [x] **Phase 2: 前端导航、布局与配置模块冲突处理** [已完成 2026-04-11]
  - **背景**: `config`、`history`、`layout`、`menus` 相关冲突横跨多个局部重构模块，需要先恢复本地骨架，再补齐上游增量修复。
  - **完成情况**: 已解决并暂存 `card/viewCards.ts`、`config/*`、`editor/deleteFile.ts`、`history/*`、`layout/getAll.ts`、`layout/dock/{Backlink,Bookmark,Files,Graph,Tag}.ts`、`menus/{navigation,protyle,util}.ts`；`Outline.ts` 与 `commonMenuItem.ts` 保持删除状态；同步将 `repos.provider.ts` 升级为 `fetchSyncPost` 回写策略。剩余未解决冲突降至 31 个。
  - **成果文件**: `app/src/config/editor.ts`, `app/src/config/search.ts`, `app/src/history/history.ts`, `app/src/layout/dock/Backlink.ts`, `app/src/menus/util.ts`
  - **参考文档**: `docs/规程/版本管理/远程分支合并.procedure.md`

- [x] **Phase 1: 包管理与核心入口冲突处理** [已完成 2026-04-11]
  - **背景**: `package.json`、`go.mod`、Electron 入口、应用初始化和锁文件策略需要优先恢复，才能继续安全推进大批量前端冲突。
  - **完成情况**: 已解决并暂存 `README.md`、`app/electron/main.js`、`app/package.json`、`app/src/boot/globalEvent/keydown.ts`、`app/src/boot/onGetConfig.ts`、`app/src/index.ts`、`app/src/window/openNewWindow.ts`、`kernel/go.mod`；`app/pnpm-lock.yaml` 已按规程删除，待最终统一重生；剩余未解决冲突已降至 50 个。
  - **成果文件**: `README.md`, `app/electron/main.js`, `app/package.json`, `app/src/index.ts`, `app/src/window/openNewWindow.ts`, `kernel/go.mod`
  - **参考文档**: `docs/规程/版本管理/远程分支合并.procedure.md`

- [x] **Phase 0: 合并盘点与规程确认** [已完成 2026-04-11]
  - **背景**: 先确认当前 merge 状态、冲突数量和应遵循的规程，避免在错误清单上投入时间。
  - **完成情况**: 已确认当前分支为 `multipleAI`，合并来源为 `origin/dev`；识别 58 个未解决冲突；确认本任务属于有限任务，使用 `.ttt.md` 跟踪；已读取版本管理规程、TTT 规程和 infinity-ttt 子规程。
  - **成果文件**: `docs/ttt/版本管理/远程分支合并_multipleAI_2026-03-14.ttt.md`
  - **参考文档**: `docs/规程/版本管理/远程分支合并.procedure.md`

## 冲突批次清单

### 批次 A: 包管理与入口

- `README.md`
- `app/electron/main.js`
- `app/package.json`
- `app/pnpm-lock.yaml`
- `app/src/index.ts`
- `app/src/boot/globalEvent/keydown.ts`
- `app/src/boot/onGetConfig.ts`
- `app/src/window/openNewWindow.ts`
- `kernel/go.mod`

### 批次 B: 前端配置、导航与布局

- `app/src/card/viewCards.ts`
- `app/src/config/editor.ts`
- `app/src/config/publish.ts`
- `app/src/config/repos.ts`
- `app/src/config/search.ts`
- `app/src/editor/deleteFile.ts`
- `app/src/history/diff.ts`
- `app/src/history/history.ts`
- `app/src/layout/dock/Backlink.ts`
- `app/src/layout/dock/Bookmark.ts`
- `app/src/layout/dock/Files.ts`
- `app/src/layout/dock/Graph.ts`
- `app/src/layout/dock/Outline.ts`
- `app/src/layout/dock/Tag.ts`
- `app/src/layout/getAll.ts`
- `app/src/menus/commonMenuItem.ts`
- `app/src/menus/navigation.ts`
- `app/src/menus/protyle.ts`
- `app/src/menus/util.ts`

### 批次 C: Protyle、移动端与插件

- `app/src/block/popover.ts`
- `app/src/mobile/dock/MobileFiles.ts`
- `app/src/plugin/API.ts`
- `app/src/plugin/uninstall.ts`
- `app/src/protyle/gutter/index.ts`
- `app/src/protyle/header/Background.ts`
- `app/src/protyle/header/openTitleMenu.ts`
- `app/src/protyle/index.ts`
- `app/src/protyle/preview/image.ts`
- `app/src/protyle/render/abcRender.ts`
- `app/src/protyle/render/av/asset.ts`
- `app/src/protyle/render/av/blockAttr.ts`
- `app/src/protyle/render/av/cell.ts`
- `app/src/protyle/render/av/openMenuPanel.ts`
- `app/src/protyle/render/blockRender.ts`
- `app/src/protyle/render/chartRender.ts`
- `app/src/protyle/render/graphvizRender.ts`
- `app/src/protyle/render/htmlRender.ts`
- `app/src/protyle/render/mathRender.ts`
- `app/src/protyle/render/mermaidRender.ts`
- `app/src/protyle/toolbar/Link.ts`
- `app/src/protyle/toolbar/index.ts`
- `app/src/protyle/upload/index.ts`
- `app/src/protyle/util/editorCommonEvent.ts`
- `app/src/protyle/util/paste.ts`
- `app/src/protyle/util/processCode.ts`
- `app/src/protyle/wysiwyg/index.ts`
- `app/src/protyle/wysiwyg/transaction.ts`

### 批次 D: 其他与后端

- `app/src/util/escape.ts`
- `kernel/sql/block_ref_query.go`
- `kernel/util/working.go`

## 执行记录

### 2026-04-11

- 已确认 `MERGE_HEAD=ca38872f1`，`merge-base=9914fd1d39`
- 已重新统计当前未解决冲突为 58 个文件
- 已发现历史合并跟踪文档与当前冲突清单不一致，现已按规程改写为标准 TTT 结构
- 已完成批次 A：入口、包管理、锁文件处理策略与 `openNewWindow` 相关冲突已解决并暂存
- 当前剩余未解决冲突 50 个，下一步进入批次 B（配置、布局、导航与历史模块）
- 已完成批次 B：配置、历史、布局与菜单冲突已解决并暂存，`Outline.ts`/`commonMenuItem.ts` 维持删除状态
- 当前剩余未解决冲突 31 个，进入批次 C（Protyle、移动端、插件）与批次 D（后端）
- 已完成批次 C：Protyle、移动端与插件冲突已全部解决，上游有效修复已迁移到本地拆分模块；当前未解决冲突已清零
- 已完成批次 D：后端冲突、锁文件重建、构建验证和备份清理均已完成，当前可直接提交 merge commit
