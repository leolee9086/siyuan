# 合并 origin/dev 到 multipleAI 分支

## 背景

- 当前分支: multipleAI
- 目标: 合并 origin/dev 的最新进展到本地分支
- 状态: 已处于合并冲突状态，36个文件有冲突
- 规程: docs/规程/版本管理/远程分支合并.procedure.md

## 冲突文件分类

### 第1批：包管理/配置（3个文件）
- [ ] app/package.json
- [ ] app/pnpm-lock.yaml
- [ ] kernel/go.mod

### 第2批：核心入口和常量（2个文件）
- [ ] app/src/index.ts
- [ ] app/src/constants.ts

### 第3批：配置UI模块（4个文件）
- [ ] app/src/config/about.ts
- [ ] app/src/config/exportConfig.ts
- [ ] app/src/config/image.ts
- [ ] app/src/config/index.ts

### 第4批：编辑器protyle模块（10个文件）
- [ ] app/src/protyle/gutter/index.ts
- [ ] app/src/protyle/render/av/action.ts
- [ ] app/src/protyle/render/av/cell.ts
- [ ] app/src/protyle/render/av/render.ts
- [ ] app/src/protyle/toolbar/index.ts
- [ ] app/src/protyle/ui/initUI.ts
- [ ] app/src/protyle/upload/index.ts
- [ ] app/src/protyle/util/compatibility.ts
- [ ] app/src/protyle/util/editorCommonEvent.ts
- [ ] app/src/protyle/wysiwyg/keydown.ts

### 第5批：移动端模块（4个文件）
- [ ] app/src/mobile/index.ts
- [ ] app/src/mobile/menu/index.ts
- [ ] app/src/mobile/settings/about.ts
- [ ] app/src/mobile/util/keyboardToolbar.ts

### 第6批：其他前端模块（11个文件）
- [ ] app/src/block/Panel.ts
- [ ] app/src/boot/globalEvent/command/global.ts
- [ ] app/src/history/history.ts
- [ ] app/src/layout/Wnd.ts
- [ ] app/src/layout/util.ts
- [ ] app/src/menus/protyle.ts
- [ ] app/src/plugin/API.ts
- [ ] app/src/plugin/index.ts
- [ ] app/src/protyle/wysiwyg/remove.ts
- [ ] app/src/search/util.ts
- [ ] app/src/util/addClearButton.ts
- [ ] app/src/util/fetch.ts

### 第7批：后端Go（1个文件）
- [ ] kernel/model/assets.go

## 进度记录

- 2026-02-13 11:43: 创建ttt文档，冲突文件已分类为7批
- 待开始: 逐批解决冲突

## 失败记录

（暂无）
