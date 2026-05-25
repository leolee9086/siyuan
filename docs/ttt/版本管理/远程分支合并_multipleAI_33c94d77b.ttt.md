# multipleAI 合并 origin/dev 执行跟踪 — 第二轮 (TikTocTak)

> **目标**: 在 `multipleAI` 分支上完成 `origin/dev` (`MERGE_HEAD=33c94d77b`) 的第二轮合并。本轮 merge-base 即上一轮 MERGE_HEAD (`ce05a916`)——增量变更。
> 27 个冲突文件逐项审查上游 commit、逐项移植变更、逐项验证。
>
> **流程**: 滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 按规程逐文件审查上游 commit、移植变更、git add。
> 3. 将其移动到"已完成"列表。
> 4. 将下一批次补充到"近期计划"。

## 核心原则

1. 以本地重构架构为骨架，不回退本地模块拆分和抽象。
2. 对每个冲突文件先 `git log merge-base..MERGE_HEAD -- <file>` 确认上游 commit 列表，再逐个查看实质性改动，判定"已存在于本地 / 需移植 / 在子模块处理"。
3. 包管理文件按"共有依赖取较高版本、双方独有依赖均保留"处理。
4. `deleted by us` 文件必须按"一对多文件映射"检查本地重构后的承接位置，不得直接恢复旧文件。
5. 每完成一个文件就记录，不得批量处理、不得跳过审查。

### 验证检查清单

- [ ] 无残留冲突标记
- [ ] `git diff --name-only --diff-filter=U` 为空
- [ ] 每个文件的上游 commit 已逐个审查
- [ ] 上游实质性改动已在解决后的代码中逐项确认
- [ ] `.backup` / `.remote` 已清理

## 合并范围

- **merge-base**: `ce05a916`（上一轮 MERGE_HEAD）
- **HEAD**: `efda9280c`（`multipleAI` 分支）
- **MERGE_HEAD**: `33c94d77b`（新上游）

### 冲突概况

| 类型 | 数量 | 文件列表 |
|------|:---:|------|
| UU（both modified） | 27 | 见下方清单 |
| DU（deleted by us） | 2 | `protyle/wysiwyg/commonHotkey.ts`, `util/fetch.ts` |
| A（upstream 新增） | 6 | `protyle/util/blockFold.ts`, `kernel/cli/cmd/database.go`, `kernel/cli/cmd/history.go`, `kernel/model/md2html.go`, `kernel/sql/stmt_validate.go`, `kernel/sql/stmt_validate_test.go` |

## 🟢 Phase 0: 初始化

- [-] **Phase 0: 合并盘点** [进行中 2026-05-22]
  - 确认 merge-base / MERGE_HEAD
  - 创建 TTT 文档
  - 列出全部冲突文件

## 冲突文件清单 — 27+2+6 个文件

### 根目录 (1)
| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 1 | `README.md` | [ ] 待处理 | |

### 包管理与安装器 (1)
| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 2 | `app/nsis/installer.nsh` | [ ] 待处理 | |

### 核心入口与常量 (3)
| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 3 | `app/src/asset/index.ts` | [x] 已完成 | 上游仅iconFilesRoot→iconPaintBucket,HEAD已有。冲突来自HEAD将PDF查看器抽出为Vue组件+render重构。移除上游代码块保留HEAD。 |
| 4 | `app/src/constants.ts` | [x] 已完成 | 上游新增foldRecursive快捷键(⌥⌘↑)移植到HEAD keymap中,保留fork特有的pasteAsPlainText/pasteEscaped |
| 5 | `app/src/emoji/index.ts` | [x] 已完成 | 上游3处iconFilesRoot→iconNewNoteBook。冲突来自HEAD将内嵌事件处理重构为子模块(bindEmojiPanelEvents/bindDynamicEvents)。取HEAD重构版,子模块中iconFilesRoot→iconNewNoteBook同步修复(emoji.panel.keyboard.ts+emoji.panel.ts) |

### 布局模块 (4)
| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 6 | `app/src/layout/Wnd.ts` | [x] 已完成 | 上游仅改removeTabAction(clearCounter移入find+传rootID)。HEAD已拆到Wnd.tabAction.ts但clearCounter()未更新——修复submodule:清除无参调用,移入find内传rootID |
| 7 | `app/src/layout/dock/Files.ts` | [x] 已完成 | 上游仅2处变更: 拖拽classList.remove统一清理(HEAD的dnd.onDragOver.ts已实现) + initMoreMenu中iconFilesRoot→iconNewNoteBook(修复submodule moreMenu.ts) |
| 8 | `app/src/layout/status.ts` | [x] 已完成 | 上游重写countSelectWord/countBlockWord(scheduleStatusStat+AbortController)。采纳上游新版,HEAD旧版替换。已含clearCounter+renderStatusbarCounter |
| 9 | `app/src/layout/util.ts` | [x] 已完成 | 上游仅addResize加layout__center 148px最小宽度守卫。HEAD已拆到utils/addResize.ts——移植守卫到子模块 |

### 菜单模块 (2)
| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 10 | `app/src/menus/navigation.ts` | [x] 已完成 | sortMenu从icon指标改为checked+iconHTML模式(15项),保留HEAD的siyuanI18n |
| 11 | `app/src/menus/protyle.ts` | [ ] 待处理 | |

### 移动端模块 (3)
| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 12 | `app/src/mobile/dock/MobileFiles.ts` | [ ] 待处理 | |
| 13 | `app/src/mobile/menu/index.ts` | [ ] 待处理 | |
| 14 | `app/src/mobile/util/setEmpty.ts` | [ ] 待处理 | |

### Protyle 模块 (10)
| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 15 | `app/src/protyle/gutter/index.ts` | [ ] 待处理 | |
| 16 | `app/src/protyle/hint/index.ts` | [ ] 待处理 | |
| 17 | `app/src/protyle/util/compatibility.ts` | [ ] 待处理 | |
| 18 | `app/src/protyle/util/editorCommonEvent.ts` | [ ] 待处理 | |
| 19 | `app/src/protyle/wysiwyg/commonHotkey.ts` | [ ] 待处理 | deleted by us |
| 20 | `app/src/protyle/wysiwyg/index.ts` | [ ] 待处理 | |
| 21 | `app/src/protyle/wysiwyg/keydown.ts` | [ ] 待处理 | |
| 22 | `app/src/protyle/wysiwyg/list.ts` | [ ] 待处理 | |
| 23 | `app/src/protyle/wysiwyg/remove.ts` | [ ] 待处理 | |
| 24 | `app/src/protyle/wysiwyg/transaction.ts` | [ ] 待处理 | |

### 工具模块 (1)
| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 25 | `app/src/util/fetch.ts` | [ ] 待处理 | deleted by us |

### 内核后端 (3)
| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| 26 | `kernel/go.mod` | [ ] 待处理 | |
| 27 | `kernel/go.sum` | [ ] 待处理 | |
| 28 | `kernel/sql/queue.go` | [ ] 待处理 | |

### 上游新增文件 (6)
| # | 文件 | 状态 | 处理方式 |
|---|------|------|----------|
| N1 | `app/src/protyle/util/blockFold.ts` | [ ] 待处理 | 新增 |
| N2 | `kernel/cli/cmd/database.go` | [ ] 待处理 | 新增 |
| N3 | `kernel/cli/cmd/history.go` | [ ] 待处理 | 新增 |
| N4 | `kernel/model/md2html.go` | [ ] 待处理 | 新增 |
| N5 | `kernel/sql/stmt_validate.go` | [ ] 待处理 | 新增 |
| N6 | `kernel/sql/stmt_validate_test.go` | [ ] 待处理 | 新增 |

## 🔴 当前任务

- [ ] 开始逐个处理冲突文件：先获取每个文件的上游 commit 列表 + diff，判定变更是否已在 HEAD 或需移植。

## 执行记录

### 2026-05-22 — 第二轮合并启动

- merge-base: `ce05a916`, MERGE_HEAD: `33c94d77b`
- 27 个 UU + 2 个 DU + 6 个新增 = 35 个待处理文件
