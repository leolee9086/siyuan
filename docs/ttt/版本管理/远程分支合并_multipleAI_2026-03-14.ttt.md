# 远程分支合并任务 - multipleAI分支

## 任务信息

- **开始时间**: 2026-03-14 11:28
- **分支**: multipleAI
- **合并来源**: leolee9086/multipleAI (远程)
- **规程**: docs/规程/版本管理/远程分支合并.procedure.md

## 冲突文件清单

### 1. 包管理/配置文件（优先级最高）

- [x] app/package.json (both modified) - 已完成：合并版本号，保留本地依赖
- [x] app/pnpm-lock.yaml (deleted by us) - 已删除，待重新生成
- [x] kernel/go.mod (both modified) - 已完成：合并上游版本，保留本地依赖

### 2. 核心入口文件

- [x] app/electron/main.js (both modified) - 已完成：应用上游改进（clipboard、Wayland IME等）
- [x] app/src/index.ts (both modified) - 已完成：应用上游改进（空标题支持、移动端检查）
- [x] app/src/window/init.ts (both modified) - 已完成：应用上游菜单位置重置改进

### 3. 前端功能代码

#### 启动和配置
- [x] app/src/boot/globalEvent/keydown.ts (both modified) - 已完成：采用本地重构，上游改进应用到拆分文件
- [x] app/src/boot/onGetConfig.ts (both modified) - 已完成：应用上游菜单位置重置和CSS类管理窗口状态改进

#### 布局系统
- [x] app/src/layout/Wnd.ts (both modified) - 已完成：应用上游空标题支持改进到重构后的文件
- [x] app/src/layout/util.ts (both modified) - 已完成：本地已重构，setPanelFocus移至独立文件并应用上游空标题支持
- [x] app/src/layout/dock/Files.ts (both modified) - 已完成：采用本地重构版本（已含发布访问控制），应用tooltip延迟改进
- [ ] app/src/layout/dock/Outline.ts (deleted by us)
- [ ] app/src/layout/dock/util.ts (both modified)

#### 菜单系统
- [ ] app/src/menus/Menu.ts (both modified)
- [ ] app/src/menus/dock.ts (both modified)
- [ ] app/src/menus/protyle.ts (both modified)
- [ ] app/src/menus/workspace.ts (both modified)

#### 移动端
- [ ] app/src/mobile/dock/MobileFiles.ts (both modified)
- [ ] app/src/mobile/menu/index.ts (both modified)
- [ ] app/src/mobile/util/setEmpty.ts (both modified)

#### 插件系统
- [ ] app/src/plugin/API.ts (both modified)
- [ ] app/src/plugin/loader.ts (both modified)

#### Protyle编辑器
- [ ] app/src/protyle/header/Title.ts (both modified)
- [ ] app/src/protyle/toolbar/index.ts (both modified)
- [ ] app/src/protyle/ui/initUI.ts (both modified)
- [ ] app/src/protyle/render/av/blockAttr.ts (both modified)
- [ ] app/src/protyle/render/av/openMenuPanel.ts (both modified)
- [ ] app/src/protyle/util/compatibility.ts (both modified)
- [ ] app/src/protyle/util/editorCommonEvent.ts (both modified)
- [ ] app/src/protyle/util/table.ts (both modified)
- [ ] app/src/protyle/wysiwyg/index.ts (both modified)
- [ ] app/src/protyle/wysiwyg/keydown.ts (both modified)
- [ ] app/src/protyle/wysiwyg/transaction.ts (both modified)

#### 其他前端
- [ ] app/src/dialog/processSystem.ts (both modified)
- [ ] app/src/emoji/index.ts (both modified)
- [ ] app/src/util/setPosition.ts (deleted by us)
- [ ] app/src/window/setHeader.ts (both modified)

### 4. 后端代码

- [ ] kernel/model/bazzar.go (deleted by them)
- [ ] kernel/util/working.go (both modified)

## 处理进度

### 已完成
无

### 进行中
无

### 待处理
全部38个文件

## 失败记录
无

## 注意事项

1. 本地分支有大规模重构（模块拆分、环境访问封装等）
2. 需要系统性提取上游bugfix和新功能
3. 对于deleted by us的文件，需确认本地重构已覆盖原功能
4. 每个文件处理前需备份.backup和.remote版本
5. 处理完成后需进行完整性验证
