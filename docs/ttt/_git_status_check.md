# Git 状态检查与合并追踪

## 当前状态

- **当前分支**: `multipleAI`
- **远程分支**: `leolee9086/multipleAI`
- **合并状态**: 合并进行中，存在未解决冲突
- **合并来源**: `origin/dev` (commit d6982f70e)
- **检查时间**: 2026-02-26

## 冲突文件清单

### 已解决 (3个)

| 序号 | 文件路径 | 冲突类型 | 处理状态 | 备注 |
|------|----------|----------|----------|------|
| 1 | [`app/package.json`](app/package.json) | both modified | ✅ | 用户决策：保留本地配置，version更新为3.5.8 |
| 2 | [`app/src/util/addClearButton.ts`](app/src/util/addClearButton.ts) | both modified | ✅ | 移植上游改进：padding恢复、margin-right支持 |
| 3 | [`app/src/util/assets.ts`](app/src/util/assets.ts) | both modified | ✅ | 采用本地版本（使用环境抽象层） |

### 待处理 (9个) - 每个需要单独子任务

| 序号 | 文件路径 | 冲突类型 | 处理状态 | 备注 |
|------|----------|----------|----------|------|
| 4 | [`app/src/menus/protyle.ts`](app/src/menus/protyle.ts) | both modified | ✅ | 本地已拆分，上游变更已移植：#17002表格标题提取、#17051批量插入行列 |
| 5 | [`app/src/mobile/index.ts`](app/src/mobile/index.ts) | both modified | ✅ | 已移植：setWebViewFocusable导入及blur事件监听 |
| 6 | [`app/src/mobile/util/keyboardToolbar.ts`](app/src/mobile/util/keyboardToolbar.ts) | both modified | ✅ | 已移植：keyboardLockUntil检查、callMobileAppShowKeyboard导入 |
| 7 | [`app/src/protyle/gutter/index.ts`](app/src/protyle/gutter/index.ts) | both modified | ✅ | 已移植：disabledRTL逻辑、RTL/LTR对齐改进(#17069) |
| 8 | [`app/src/protyle/render/av/action.ts`](app/src/protyle/render/av/action.ts) | both modified | ✅ | 已移植：av-search-icon增加marginRight |
| 9 | [`app/src/protyle/render/av/render.ts`](app/src/protyle/render/av/render.ts) | both modified | ✅ | 已移植：contenteditable="plaintext-only" |
| 10 | [`app/src/protyle/toolbar/index.ts`](app/src/protyle/toolbar/index.ts) | both modified | ✅ | 已移植：subElementCloseCB逻辑优化(#17082) |
| 11 | [`app/src/protyle/wysiwyg/index.ts`](app/src/protyle/wysiwyg/index.ts) | both modified | ✅ | 本地已拆分，上游变更已移植：#17092框选焦点修复、#17051表格标题处理、#17002标题编辑功能、#17098粘贴av-search判断优化 |
| 12 | [`app/src/protyle/wysiwyg/keydown.ts`](app/src/protyle/wysiwyg/keydown.ts) | both modified | ✅ | 已移植：event.key类型检查(#17084)、av-search判断优化(#17098) |

## 备份文件清单

| 原文件 | .backup版本 | .remote版本 | 状态 |
|--------|-------------|-------------|----------|
| app/package.json | ✅ | ✅ | 已清理 |
| app/src/config/repos.ts | ✅ | - | 已清理 |
| app/src/emoji/index.ts | ✅ | - | 已清理 |
| app/src/history/history.ts | ✅ | - | 已清理 |
| app/src/layout/Wnd.ts | ✅ | - | 已清理 |
| app/src/menus/protyle.ts | ✅ | ✅ | 已清理 |
| app/src/mobile/index.ts | ✅ | - | 已清理 |
| app/src/mobile/dock/MobileFiles.ts | ✅ | - | 已清理 |
| app/src/mobile/dock/MobileOutline.ts | ✅ | - | 已清理 |
| app/src/mobile/menu/search.ts | ✅ | - | 已清理 |
| app/src/mobile/util/keyboardToolbar.ts | ✅ | - | 已清理 |
| app/src/protyle/gutter/index.ts | ✅ | ✅ | 已清理 |
| app/src/protyle/hint/index.ts | ✅ | - | 已清理 |
| app/src/protyle/render/av/action.ts | ✅ | ✅ | 已清理 |
| app/src/protyle/render/av/cell.ts | ✅ | - | 已清理 |
| app/src/protyle/render/av/filter.ts | ✅ | - | 已清理 |
| app/src/protyle/render/av/openMenuPanel.ts | ✅ | - | 已清理 |
| app/src/protyle/render/av/render.ts | ✅ | ✅ | 已清理 |
| app/src/protyle/toolbar/index.ts | ✅ | ✅ | 已清理 |
| app/src/protyle/util/selection.ts | ✅ | - | 已清理 |
| app/src/protyle/wysiwyg/index.ts | ✅ | ✅ | 已清理 |
| app/src/protyle/wysiwyg/keydown.ts | ✅ | ✅ | 已清理 |
| app/src/protyle/wysiwyg/transaction.ts | ✅ | - | 已清理 |
| app/src/util/addClearButton.ts | ✅ | - | 已清理 |
| app/src/util/assets.ts | ✅ | - | 已清理 |

> **清理时间**: 2026-02-26
> **清理说明**: 全项目范围清理完成，共删除 29 个备份文件（17 个 `.backup` + 8 个 `.remote`）。排除 `node_modules/`、`.git/` 和 `trashed/` 目录。

## 已暂存的变更

- 多语言文件更新（15个json文件）
- AppxManifest文件更新
- 新增v3.5.8变更日志
- 其他文件更新（约30个已解决冲突）

## 子任务分配建议

根据规程要求和用户反馈，每个冲突文件应作为独立子任务分配：

### 高优先级（拆分模块，需规程处理）
- [ ] 子任务: `app/src/menus/protyle.ts` 冲突解决
- [ ] 子任务: `app/src/protyle/wysiwyg/index.ts` 冲突解决

### 中优先级（普通冲突）
- [ ] 子任务: `app/src/mobile/index.ts` 冲突解决
- [ ] 子任务: `app/src/mobile/util/keyboardToolbar.ts` 冲突解决
- [ ] 子任务: `app/src/protyle/gutter/index.ts` 冲突解决
- [ ] 子任务: `app/src/protyle/render/av/action.ts` 冲突解决
- [ ] 子任务: `app/src/protyle/render/av/render.ts` 冲突解决
- [ ] 子任务: `app/src/protyle/toolbar/index.ts` 冲突解决
- [ ] 子任务: `app/src/protyle/wysiwyg/keydown.ts` 冲突解决
- [ ] 子任务: `app/src/util/addClearButton.ts` 冲突解决
- [ ] 子任务: `app/src/util/assets.ts` 冲突解决

## 验证清单

- [x] 无未解决冲突（`git status` 确认: "All conflicts fixed"）
- [x] 无残留冲突标记（`app/src` 目录正则搜索 `[<]{7}` 返回 0 结果）
- [x] 12 个冲突文件已全部 `git add`（已暂存待提交）
- [ ] 项目可构建（用户手动执行）
- [ ] 上游改进完整性验证（通过代码审查）

## 记录

- 2026-02-26: package.json 已解决（用户决策）
- 2026-02-26: 发现当前子任务粒度不当，需要按文件拆分
- 2026-02-26: addClearButton.ts 已解决 - 移植上游改进：padding恢复、margin-right支持（用于数据库搜索）
- 2026-02-26: assets.ts 已解决 - 采用本地版本（使用环境抽象层），上游的 initAssets 内联逻辑在本地已通过 handlePrefersColorSchemeChange 函数封装
- 2026-02-26: mobile/index.ts 已解决 - 移植上游改进：setWebViewFocusable导入及blur事件监听
- 2026-02-26: mobile/util/keyboardToolbar.ts 已解决 - 移植上游改进：keyboardLockUntil检查、callMobileAppShowKeyboard导入
- 2026-02-26: protyle/render/av/action.ts 已解决 - 移植上游改进：av-search-icon增加marginRight="1em"
- 2026-02-26: protyle/render/av/render.ts 已解决 - 移植上游改进：contenteditable="plaintext-only"
- 2026-02-26: protyle/gutter/index.ts 已解决 - 本地已重构为模块化，上游#17069移植至buildGutterStyleMenu.ts：disabledRTL逻辑、RTL/LTR对齐改进（支持表格和HTML块）
- 2026-02-26: protyle/toolbar/index.ts 已解决 - 本地已重构为模块化，上游#17082移植至showRender.closeCB.ts：subElementCloseCB逻辑重构、优化变更检测
- 2026-02-26: protyle/wysiwyg/keydown.ts 已解决 - 本地已重构为中间件架构，上游#17084移植至keydown.wbr.ts/keydown.commonInput.ts（event.key类型检查），上游#17098移植至index.input.ts（av-search使用hasClosestByAttribute）
- 2026-02-26: menus/protyle.ts 已解决 - 本地已拆分，上游#17002移植：table标题设置逻辑提取至`updateTableTitle`函数；上游#17051移植：表格批量插入行列支持（修改input样式类名`b3-text-field--size`，click事件增加行数参数）
