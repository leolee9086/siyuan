# 合并 origin/dev 到 multipleAI 分支

## 背景

- 当前分支: multipleAI
- 目标: 合并 origin/dev 的最新进展到本地分支
- 初始状态: 36个文件有冲突
- 当前状态: 剩余11个未合并文件
- 规程: docs/规程/版本管理/远程分支合并.procedure.md

## 原始冲突文件（36个，已完成25个）

### 原第1批：包管理/配置（3个文件）
- [ ] app/package.json
- [x] app/pnpm-lock.yaml
- [x] kernel/go.mod

### 原第2批：核心入口和常量（2个文件）
- [ ] app/src/index.ts
- [x] app/src/constants.ts

### 原第3批：配置UI模块（4个文件）
- [ ] app/src/config/about.ts
- [x] app/src/config/exportConfig.ts
- [x] app/src/config/image.ts
- [x] app/src/config/index.ts

### 原第4批：编辑器protyle模块（10个文件）
- [x] app/src/protyle/gutter/index.ts
- [x] app/src/protyle/render/av/action.ts
- [x] app/src/protyle/render/av/cell.ts
- [x] app/src/protyle/render/av/render.ts
- [x] app/src/protyle/toolbar/index.ts
- [x] app/src/protyle/ui/initUI.ts
- [x] app/src/protyle/upload/index.ts
- [x] app/src/protyle/util/compatibility.ts
- [x] app/src/protyle/util/editorCommonEvent.ts
- [ ] app/src/protyle/wysiwyg/keydown.ts

### 原第5批：移动端模块（4个文件）
- [ ] app/src/mobile/index.ts
- [ ] app/src/mobile/menu/index.ts
- [ ] app/src/mobile/settings/about.ts
- [x] app/src/mobile/util/keyboardToolbar.ts

### 原第6批：其他前端模块（12个文件）
- [x] app/src/block/Panel.ts
- [x] app/src/boot/globalEvent/command/global.ts
- [x] app/src/history/history.ts
- [x] app/src/layout/Wnd.ts
- [x] app/src/layout/util.ts
- [x] app/src/menus/protyle.ts
- [x] app/src/plugin/API.ts
- [x] app/src/plugin/index.ts
- [x] app/src/protyle/wysiwyg/remove.ts
- [x] app/src/search/util.ts
- [x] app/src/util/addClearButton.ts
- [x] app/src/util/fetch.ts

### 原第7批：后端Go（1个文件）
- [x] kernel/model/assets.go

## 剩余冲突处理计划（11个文件，重新分批）

### 批次1：包管理（1个文件）
- [ ] app/package.json

### 批次2：核心入口（1个文件）
- [ ] app/src/index.ts

### 批次3：配置UI和布局（2个文件）
- [ ] app/src/config/about.ts
- [ ] app/src/layout/topBar.ts

### 批次4：菜单（1个文件）
- [ ] app/src/menus/commonMenuItem.ts

### 批次5：移动端（3个文件）
- [ ] app/src/mobile/index.ts
- [ ] app/src/mobile/menu/index.ts
- [ ] app/src/mobile/settings/about.ts

### 批次6：编辑器（2个文件）
- [ ] app/src/protyle/export/index.ts
- [ ] app/src/protyle/wysiwyg/keydown.ts

### 批次7：工具（1个文件）
- [ ] app/src/util/assets.ts

## 进度记录

- 2026-02-13 11:43: 创建ttt文档，冲突文件已分类为7批
- 2026-02-14 16:58: 进度更新，36个冲突文件中已解决25个，剩余11个未合并。其中4个文件（topBar.ts, commonMenuItem.ts, protyle/export/index.ts, util/assets.ts）为合并过程中新发现的冲突，不在原始列表中。剩余文件重新分为7个批次。

## 失败记录

（暂无）
