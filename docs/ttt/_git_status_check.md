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
| 4 | [`app/src/menus/protyle.ts`](app/src/menus/protyle.ts) | both modified | ⏳ | 本地已拆分，需按规程分析上游变更 |
| 5 | [`app/src/mobile/index.ts`](app/src/mobile/index.ts) | both modified | ✅ | 已移植：setWebViewFocusable导入及blur事件监听 |
| 6 | [`app/src/mobile/util/keyboardToolbar.ts`](app/src/mobile/util/keyboardToolbar.ts) | both modified | ✅ | 已移植：keyboardLockUntil检查、callMobileAppShowKeyboard导入 |
| 7 | [`app/src/protyle/gutter/index.ts`](app/src/protyle/gutter/index.ts) | both modified | ✅ | 已移植：disabledRTL逻辑、RTL/LTR对齐改进(#17069) |
| 8 | [`app/src/protyle/render/av/action.ts`](app/src/protyle/render/av/action.ts) | both modified | ✅ | 已移植：av-search-icon增加marginRight |
| 9 | [`app/src/protyle/render/av/render.ts`](app/src/protyle/render/av/render.ts) | both modified | ✅ | 已移植：contenteditable="plaintext-only" |
| 10 | [`app/src/protyle/toolbar/index.ts`](app/src/protyle/toolbar/index.ts) | both modified | ✅ | 已移植：subElementCloseCB逻辑优化(#17082) |
| 11 | [`app/src/protyle/wysiwyg/index.ts`](app/src/protyle/wysiwyg/index.ts) | both modified | ⏳ | 本地已拆分，需按规程分析上游变更 |
| 12 | [`app/src/protyle/wysiwyg/keydown.ts`](app/src/protyle/wysiwyg/keydown.ts) | both modified | ✅ | 已移植：event.key类型检查(#17084)、av-search判断优化(#17098) |

## 备份文件清单

| 原文件 | .backup版本 | .remote版本 | 创建状态 |
|--------|-------------|-------------|----------|
| app/src/menus/protyle.ts | ✅ | ✅ | 已创建 |
| app/src/protyle/wysiwyg/index.ts | ✅ | ✅ | 已创建 |
| app/src/mobile/index.ts | ✅ | ✅ | 已创建 |
| app/src/mobile/util/keyboardToolbar.ts | ✅ | ✅ | 已创建 |

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

- [ ] 无残留冲突标记（使用 `git diff --check` 验证）
- [ ] 项目可构建
- [ ] 上游改进完整性验证

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
