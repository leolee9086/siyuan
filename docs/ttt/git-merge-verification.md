# Git 合并验证报告 - 第1组：包管理/配置+核心文件

验证时间: 2026-02-13T18:54 UTC

## 验证结果汇总

| 文件名 | 远程改进项 | 是否已包含 | 备注 |
|--------|-----------|-----------|------|
| app/package.json | electron 39.5.1, sass ^1.89.2, 其他依赖版本更新 | ✅ 是 | 合并版本包含所有远程依赖，并额外添加了本地 fork 的依赖 |
| kernel/go.mod | go 1.25.4, 所有依赖版本更新 | ✅ 是 | 两个文件完全相同，无差异 |
| app/src/index.ts | showMessage, isChromeBrowser 导入和使用 | ✅ 是 | 合并版本包含远程功能，并额外添加了 EventBus、inNotePlugin 等本地功能 |
| app/src/constants.ts | LOCAL_CLOSED_TABS 常量 | ✅ 是 | 合并版本在第173行包含此常量 |

## 详细分析

### 1. app/package.json

**远程版本改进项:**
- electron: 39.5.1
- sass: ^1.89.2
- electron-builder: 26.0.12
- 其他开发依赖版本更新

**验证结果:** ✅ 已包含

合并后的文件包含所有远程依赖版本，并额外添加了本地 fork 的功能依赖：
- @huggingface/transformers, vitest, vue 相关依赖
- 本地 link 依赖 (@leolee9086/*, calibur-router 等)
- 额外的 scripts (test, lint:report, genI18nTypes 等)

### 2. kernel/go.mod

**远程版本改进项:**
- go 1.25.4
- 所有依赖版本更新 (lute, gulu, dejavu 等)

**验证结果:** ✅ 已包含

两个文件完全相同，逐行对比无任何差异。所有依赖版本、replace 指令均一致。

### 3. app/src/index.ts

**远程版本改进项:**
- 导入 `showMessage` 从 `./dialog/message`
- 导入 `isChromeBrowser` 从 `./protyle/util/compatibility`
- 浏览器检查逻辑: `if (!isChromeBrowser()) { showMessage(...) }`

**验证结果:** ✅ 已包含

合并版本第26行和第28行包含相同的导入，第232-234行包含相同的浏览器检查逻辑。
合并版本额外添加了本地功能：EventBus、siyuanI18n、embeddingText、inNotePluginManager、initSForge 等。

### 4. app/src/constants.ts

**远程版本改进项:**
- `LOCAL_CLOSED_TABS = "local-closed-tabs"` (远程版本第171行)

**验证结果:** ✅ 已包含

合并版本第173行包含此常量。合并版本还额外添加了 `LOCAL_SEMANTIC_SEARCH` 常量 (第172行)。

## 结论

第1组所有文件的远程改进均已正确合并到当前版本中。合并后的文件不仅包含了远程版本的所有改进，还保留了本地 fork 的额外功能。

---

# Git 合并验证报告 - 第2组：配置UI + Protyle前半

验证时间: 2026-02-13T19:02 UTC

## 验证结果汇总

| 文件名 | 远程改进项 | 是否已包含 | 备注 |
|--------|-----------|-----------|------|
| app/src/config/about.ts | autoLaunch、networkServe、TLS证书管理、数据仓库密钥、网络代理 | ✅ 是 | 本地使用 siyuanI18n 统一访问层，并智能选择访问URL |
| app/src/config/exportConfig.ts | 导出配置选项、pandoc配置、水印设置 | ✅ 是 | 本地使用 siyuanI18n 统一访问层 |
| app/src/config/image.ts | 未引用资源、未引用AV、缺失资源管理 | ✅ 是 | 本地额外添加了 Plugin 系统支持 |
| app/src/config/index.ts | 配置面板入口、各配置项切换 | ✅ 是 | 本地添加了 Vue 组件支持和 tabRegistry |
| app/src/protyle/gutter/index.ts | 拖拽、右键菜单、折叠/展开、AV操作 | ✅ 是 | 本地采用模块化架构，功能分散在子模块中 |
| app/src/protyle/render/av/action.ts | AV点击处理、上下文菜单、复制删除 | ✅ 是 | 本地使用重构后的导入路径 |
| app/src/protyle/render/av/cell.ts | 单元格渲染、编辑、URL处理 | ✅ 是 | 本地使用重构后的导入路径 |
| app/src/protyle/render/av/render.ts | AV视图渲染（表格、看板、画廊） | ✅ 是 | 本地使用重构后的导入路径 |
| app/src/protyle/toolbar/index.ts | 工具栏渲染、内联标记、模板选择 | ✅ 是 | 本地采用模块化架构，功能分散在子模块中 |

## 详细分析

### 配置UI文件

#### 1. app/src/config/about.ts

**远程版本改进项:**
- autoLaunch 自动启动配置（三种模式）
- networkServe 网络服务开关
- networkServeTLS TLS证书管理（导出CA证书、导出/导入CA Bundle）
- 数据仓库密钥管理（导入、生成、复制、重置）
- 网络代理配置（SOCKS5/HTTPS/HTTP）
- 各种系统维护功能（清理临时文件、重建索引等）

**验证结果:** ✅ 已包含

本地版本包含远程所有功能，并使用 siyuanI18n 统一访问层替代 window.siyuan.languages。
本地额外改进：根据 networkServe 状态智能选择访问URL（第149行）。

#### 2. app/src/config/exportConfig.ts

**远程版本改进项:**
- 导出配置选项（段落首行空格、添加标题、YFM等）
- 块引用/嵌入块导出模式
- PDF/图片水印设置
- Pandoc配置
- 数据导入导出

**验证结果:** ✅ 已包含

本地版本包含远程所有功能，使用 siyuanI18n 统一访问层。

#### 3. app/src/config/image.ts

**远程版本改进项:**
- 未引用资源管理（列表、删除、预览）
- 未引用AV管理
- 缺失资源管理
- Protyle 预览编辑器

**验证结果:** ✅ 已包含

本地版本包含远程所有功能，并额外添加了：
- Plugin 系统支持（第439-493行）
- 独立资源页签类型注册（internal-image、internal-image-remove、internal-image-missing）
- 独立页签的事件绑定函数 bindAssetTabEvent

#### 4. app/src/config/index.ts

**远程版本改进项:**
- genItemPanel 配置面板生成
- openSetting 设置对话框
- 各配置项切换逻辑

**验证结果:** ✅ 已包含

本地版本包含远程所有功能，并额外添加了：
- siyuanI18n 统一访问层
- Vue 组件支持（fileTreeConfigPanel）
- tabRegistry 注册机制
- Dialog 额外选项（transparent、disableScrimClose、scrimPointerEvents）

### Protyle前半文件

#### 5. app/src/protyle/gutter/index.ts

**远程版本改进项:**
- 2694行的大型文件，包含：
  - 拖拽事件处理（dragstart、dragover、drop）
  - 右键菜单构建（单块、多块）
  - 折叠/展开逻辑
  - AV行操作
  - 各种块类型的特定菜单

**验证结果:** ✅ 已包含（模块化架构）

本地版本采用模块化重构，主文件仅129行，功能分散在子模块中：
- `bindEvent.ts` - 事件绑定
- `buildGutterMenu.ts` - 单块菜单构建
- `buildGutterMultipleMenu.ts` - 多块菜单构建
- `renderGutter.ts` - Gutter渲染
- `buildGutterAvMenu.ts` - AV菜单
- `buildGutterCodeBlockMenu.ts` - 代码块菜单
- 等20+个子模块

#### 6. app/src/protyle/render/av/action.ts

**远程版本改进项:**
- avClick 点击事件处理
- avContextmenu 上下文菜单
- duplicateCompletely 完整复制
- updateAttrViewCellAnimation 单元格动画

**验证结果:** ✅ 已包含

本地版本包含远程所有功能，使用重构后的导入路径：
- `hintRef` 从 `../../hint/extend.hintRef` 导入
- `openFileAttr` 从 `../../../menus/commonMenuItem.openFileAttr` 导入
- `clearSelect` 从 `../../util/clearSelect` 导入

#### 7. app/src/protyle/render/av/cell.ts

**远程版本改进项:**
- renderCellURL URL单元格渲染
- getCellText 获取单元格文本
- genCellValueByElement 从元素生成单元格值
- popTextCell 弹出文本编辑
- renderCell 单元格渲染

**验证结果:** ✅ 已包含

本地版本包含远程所有功能，使用重构后的导入路径和 siyuanI18n。

#### 8. app/src/protyle/render/av/render.ts

**远程版本改进项:**
- genTabHeaderHTML 生成标签头HTML
- avRender AV渲染入口
- 表格/看板/画廊视图渲染
- 搜索、过滤、排序UI

**验证结果:** ✅ 已包含

本地版本包含远程所有功能，使用重构后的导入路径：
- `clearSelect` 从 `../../util/clearSelect` 导入
- 添加了 siyuanI18n 统一访问层

#### 9. app/src/protyle/toolbar/index.ts

**远程版本改进项:**
- 1874行的大型文件，包含：
  - Toolbar 类构造和更新
  - 内联标记处理（粗体、斜体、链接等）
  - 代码语言选择
  - 模板/挂件选择
  - 渲染面板

**验证结果:** ✅ 已包含（模块化架构）

本地版本采用模块化重构，主文件仅248行，功能分散在子模块中：
- `setInlineMark.ts` - 内联标记设置
- `renderPanel.ts` - 渲染面板
- `renderToolbar.ts` - 工具栏渲染
- `showCodeLanguage.ts` - 代码语言选择
- `showTpl.ts` - 模板选择
- `showWidget.ts` - 挂件选择
- `showContent.ts` - 内容操作
- `inlineMark/` - 内联标记子模块目录
- `showRender/` - 渲染相关子模块目录
- `showTpl/` - 模板相关子模块目录

## 结论

第2组所有文件的远程改进均已正确合并到当前版本中。

特别说明：
1. 配置UI文件（about.ts、exportConfig.ts、image.ts、index.ts）保持了与远程相似的结构，主要差异是使用了 siyuanI18n 统一访问层和一些本地增强功能。
2. Protyle文件中，gutter/index.ts 和 toolbar/index.ts 采用了模块化重构架构，远程的大型单文件被拆分为多个专注的子模块，但所有功能都已保留。
3. AV相关文件（action.ts、cell.ts、render.ts）保持了与远程相似的结构，主要差异是导入路径的重构和 siyuanI18n 的使用。

---

# Git 合并验证报告 - 第3组：Protyle后半 + 移动端

验证时间: 2026-02-13T19:10 UTC

## 验证结果汇总

| 文件名 | 远程改进项 | 是否已包含 | 备注 |
|--------|-----------|-----------|------|
| app/src/protyle/ui/initUI.ts | DOM初始化、滚轮缩放、底部点击、悬停高亮 | ⚠️ 部分 | 模块化架构，触摸设备事件监听差异 |
| app/src/protyle/upload/index.ts | 文件上传、AV资源处理、大文件确认 | ✅ 是 | 本地重构为更清晰的函数结构 |
| app/src/protyle/util/compatibility.ts | 剪贴板、平台检测、本地存储 | ✅ 是 | 本地添加 LOCAL_SEMANTIC_SEARCH |
| app/src/protyle/util/editorCommonEvent.ts | 拖拽事件处理（dragstart/drop/dragover等） | ✅ 是 | 本地采用模块化架构，拆分到 dnd/ 子目录 |
| app/src/protyle/wysiwyg/keydown.ts | 键盘事件处理（快捷键、导航、编辑） | ✅ 是 | 本地采用中间件架构，拆分为40+子模块 |
| app/src/mobile/index.ts | App初始化、事件监听、全局函数 | ✅ 是 | 本地添加 S-Forge 初始化和 Forge i18n |
| app/src/mobile/menu/index.ts | 右侧菜单初始化、菜单项事件 | ✅ 是 | 本地使用 siyuanI18n 统一访问层 |
| app/src/mobile/settings/about.ts | 关于页面、网络设置、数据仓库密钥 | ✅ 是 | 本地使用 siyuanI18n 统一访问层 |
| app/src/mobile/util/keyboardToolbar.ts | 键盘工具栏、文本菜单、斜杠菜单 | ✅ 是 | 本地使用 siyuanI18n 统一访问层 |

## 详细分析

### Protyle后半文件

#### 1. app/src/protyle/ui/initUI.ts

**远程版本改进项:**
- DOM结构初始化（contentElement、wysiwyg、toolbar等）
- 滚轮缩放事件（Ctrl/Cmd + 滚轮调整字体大小）
- 底部点击创建空块逻辑
- 悬停高亮（attr、gutter、面包屑）
- addLoading/removeLoading 加载动画
- setPadding/getPadding 边距计算

**验证结果:** ⚠️ 部分包含

本地版本采用模块化架构，主文件仅25行，功能分散在子模块中：
- `dom.ts` - DOM结构初始化
- `event.ts` - 滚轮缩放、底部点击、悬停事件
- `loading.ts` - 加载动画（使用 AbortController 改进）
- `padding.ts` - 边距计算

**差异说明:**
- 远程版本在悬停事件中使用 `isTouchDevice()` 判断，触摸设备使用 `touchend` 事件，非触摸设备使用 `mouseover`
- 本地版本 `event.ts` 仅使用 `mouseover` 事件，未处理触摸设备的 `touchend` 事件
- 此差异可能影响移动端/触摸设备的悬停高亮行为

#### 2. app/src/protyle/upload/index.ts

**远程版本改进项:**
- Upload 类定义
- validateFile 文件验证
- genUploadedLabel 上传结果处理
- uploadLocalFiles 本地文件上传
- uploadFiles 文件上传主函数
- AV资源单元格处理
- 大文件上传确认对话框

**验证结果:** ✅ 已包含

本地版本包含远程所有功能，并进行了代码重构：
- 拆分 checkFile 和 handleUploadResult 辅助函数
- 拆分 handleLegacyUpload、processFiles、handleXHRStateChange、performXHRUpload 函数
- uploadLocalFiles 支持 string[] 和 ILocalFiles[] 两种参数类型
- 使用 siyuanI18n 统一访问层

#### 3. app/src/protyle/util/compatibility.ts

**远程版本改进项:**
- isPhablet、isIPhone、isIPad、isMac 等平台检测
- encodeBase64、getTextSiyuanFromTextHTML 编码处理
- openByMobile、exportByMobile 移动端打开/导出
- readText、writeText、copyPlainText 剪贴板操作
- readClipboard 剪贴板读取（支持 Android/Harmony/iOS）
- getLocalFiles 本地文件获取
- getLocalStorage、setStorageVal 本地存储
- isChromeBrowser Chrome浏览器检测
- initFocusFix Windows焦点修复

**验证结果:** ✅ 已包含

本地版本包含远程所有功能，并额外添加：
- LOCAL_SEMANTIC_SEARCH 本地语义搜索存储配置
- siyuanI18n 统一访问层（用于 clipboardPermissionDenied 等提示）

#### 4. app/src/protyle/util/editorCommonEvent.ts

**远程版本改进项:**
- dropEvent 拖拽事件处理函数（1625行大文件）
- moveTo 块移动逻辑
- dragstart/drop/dragover/dragleave/dragenter/dragend 事件处理
- AV行拖拽、画廊项拖拽、列拖拽
- 超级块拖拽创建
- 列表项拖拽

**验证结果:** ✅ 已包含（模块化架构）

本地版本采用模块化重构，主文件仅47行，功能分散在 `dnd/` 子目录：
- `onDragStart.ts` - 拖拽开始处理
- `onDrop.ts` - 放置处理
- `onDragOver.ts` - 拖拽悬停处理
- `onDragLeave.ts` - 拖拽离开处理
- `moveTo.ts` - 块移动逻辑
- `moveTo.helper.*.ts` - 移动辅助函数
- `util.ts` - 工具函数

#### 5. app/src/protyle/wysiwyg/keydown.ts

**远程版本改进项:**
- keydown 键盘事件处理函数（大型单文件）
- getContentByInlineHTML 内联HTML内容获取
- 各种快捷键处理（删除、回车、Tab、方向键等）
- 工具栏快捷键
- 列表操作快捷键
- AI功能快捷键

**验证结果:** ✅ 已包含（中间件架构）

本地版本采用中间件架构重构，主文件560行，功能分散在40+子模块：
- `keydown.guards.ts` - 守卫函数
- `keydown.middlewares.ts` - 中间件函数
- `keydown.select.ts` - 选择相关
- `keydown.arrow.*.ts` - 方向键处理
- `keydown.enter.ts` - 回车处理
- `keydown.delete.ts` - 删除处理
- `keydown.tab.ts` - Tab处理
- `keydown.list/` - 列表操作
- `keydown.ai.ts` - AI功能
- 等等

### 移动端文件

#### 6. app/src/mobile/index.ts

**远程版本改进项:**
- App 类定义和初始化
- window.siyuan 全局对象初始化
- isChromeBrowser viewport 设置
- 点击事件处理（菜单关闭、复制、键盘显示）
- 触摸事件处理
- 键盘事件处理（删除键）
- 全局函数导出（reconnectWebSocket、goBack、showMessage等）

**验证结果:** ✅ 已包含

本地版本包含远程所有功能，并额外添加：
- S-Forge 初始化（loadForgeI18n、initSForge）
- showKeyboardToolbar 支持 height 参数

#### 7. app/src/mobile/menu/index.ts

**远程版本改进项:**
- popMenu 弹出菜单
- initRightMenu 右侧菜单初始化
- 菜单项HTML生成（账户、搜索、同步、设置等）
- 菜单项点击事件处理

**验证结果:** ✅ 已包含

本地版本包含远程所有功能，主要差异是使用 siyuanI18n 统一访问层替代 window.siyuan.languages。

#### 8. app/src/mobile/settings/about.ts

**远程版本改进项:**
- initAbout 关于页面初始化
- 网络服务设置（networkServe、networkServeTLS）
- CA证书导出
- 数据仓库密钥管理
- 访问授权码设置
- 系统维护功能

**验证结果:** ✅ 已包含

本地版本包含远程所有功能，主要差异是使用 siyuanI18n 统一访问层。

#### 9. app/src/mobile/util/keyboardToolbar.ts

**远程版本改进项:**
- renderTextMenu 文本菜单渲染
- getSlashItem 斜杠菜单项生成
- 颜色选择器
- 字体样式选择
- 键盘工具栏显示/隐藏

**验证结果:** ✅ 已包含

本地版本包含远程所有功能，主要差异是使用 siyuanI18n 统一访问层。

## 结论

第3组9个文件中，8个文件的远程改进已完全包含，1个文件（initUI.ts）存在部分差异。

**需要关注的问题:**
- `initUI.ts` 的悬停事件处理未包含触摸设备的 `touchend` 事件监听，可能影响移动端/触摸设备的悬停高亮行为。建议后续检查移动端实际表现，如有问题需补充触摸事件支持。

**本地增强功能:**
1. 多个文件采用模块化/中间件架构重构，提高代码可维护性
2. 统一使用 siyuanI18n 访问层，便于国际化管理
3. upload/index.ts 重构为更清晰的函数结构
4. loading.ts 使用 AbortController 改进加载状态管理
5. mobile/index.ts 添加 S-Forge 扩展功能初始化

---

# Git 合并验证报告 - 第4组深入验证（第一批）

验证时间: 2026-02-13T19:29 UTC

## 验证范围

本次深入验证针对3个模块化拆分文件，确认远程单文件中的功能是否已被本地子模块完整包含。

## 验证结果汇总

| 文件名 | 远程行数 | 本地主文件行数 | 子模块数量 | 是否完整包含 | 备注 |
|--------|---------|---------------|-----------|-------------|------|
| app/src/block/Panel.ts | 352 | 256 | 4 | ✅ 是 | 功能完整，额外添加统一访问层 |
| app/src/layout/util.ts | 1046 | 194 | 8+ | ✅ 是 | 功能完整，模块化架构清晰 |
| app/src/plugin/API.ts | 344 | 148 | 4 | ✅ 是 | 功能完整，额外添加统一访问层 |

## 详细分析

### 1. app/src/block/Panel.ts

**远程版本功能清单 (352行单文件):**

| 功能点 | 行号范围 | 描述 |
|--------|---------|------|
| BlockPanel 类定义 | 21-352 | 面板主类 |
| 构造函数 | 36-154 | 初始化层级、清理同级浮窗、事件绑定、moveResize |
| initProtyle | 156-207 | 初始化 Protyle 编辑器 |
| destroy | 209-236 | 销毁面板、清理观察器、移除菜单 |
| render | 238-351 | 渲染HTML、设置观察器、初始化编辑器、设置位置 |

**本地子模块对应关系:**

| 远程功能 | 本地子模块 | 状态 |
|---------|-----------|------|
| BlockPanel 类框架 | `Panel.ts` (256行) | ✅ 已包含 |
| 构建面板HTML | `Panel.render.ts` → `构建面板HTML()` | ✅ 已包含 |
| 设置面板位置 | `Panel.render.ts` → `设置面板位置()` | ✅ 已包含 |
| 切换固定状态 | `Panel.actions.ts` → `切换固定状态()` | ✅ 已包含 |
| 执行图标操作 | `Panel.actions.ts` → `执行图标操作()` | ✅ 已包含 |
| 设置观察器 | `Panel.observer.ts` → `设置观察器()` | ✅ 已包含 |
| 绑定滚动事件 | `Panel.observer.ts` → `绑定滚动事件()` | ✅ 已包含 |
| 初始化Protyle编辑器 | `Panel.editor.ts` → `初始化Protyle编辑器()` | ✅ 已包含 |

**验证结果:** ✅ 已完整包含

**本地额外改进:**
- 使用 `siyuanI18n` 统一访问层替代 `window.siyuan.languages`
- 使用 `getSiyuanBlockPanels()` 等封装函数替代直接访问 `window.siyuan`
- 类型定义独立到 `Panel.types.ts`、`Panel.render.types.ts` 等文件

---

### 2. app/src/layout/util.ts

**远程版本功能清单 (1046行单文件):**

| 功能点 | 行号范围 | 描述 |
|--------|---------|------|
| setPanelFocus | 37-68 | 设置面板焦点状态 |
| switchWnd | 70-119 | 切换两个窗口位置 |
| getWndByLayout | 121-129 | 根据布局获取最活跃窗口 |
| dockToJSON | 131-164 | Dock 序列化为 JSON |
| resetLayout | 166-178 | 重置布局配置 |
| saveLayout | 180-221 | 保存当前布局 |
| exportLayout | 223-262 | 导出布局（带回调） |
| getAllLayout | 264-274 | 获取完整布局数据 |
| initInternalDock | 276-287 | 初始化内部 Dock 配置 |
| JSONToDock | 289-303 | 从 JSON 恢复 Dock |
| JSONToCenter | 307-439 | 从 JSON 恢复中心布局 |
| JSONToLayout | 441-525 | 从 JSON 恢复完整布局 |
| layoutToJSON | 527-659 | 布局转 JSON |
| resizeTopBar | 661-721 | 调整顶部工具栏 |
| newModelByInitData | 724-763 | 根据初始数据创建模型 |
| pdfIsLoading | 765-771 | PDF 加载检查 |
| getInstanceById | 773-790 | 根据 ID 获取实例 |
| addResize | 792-976 | 添加调整大小功能 |
| adjustLayout | 979-1009 | 调整布局尺寸 |
| fixWndFlex1 | 1011-1045 | 修复 Flex 布局 |

**本地子模块对应关系:**

| 远程功能 | 本地子模块 | 状态 |
|---------|-----------|------|
| setPanelFocus | `utils/setPanelFocus.ts` | ✅ 已包含 |
| switchWnd | `window-utils.ts` → `switchWnd()` | ✅ 已包含 |
| getWndByLayout | `window-utils.ts` → `getWndByLayout()` | ✅ 已包含 |
| dockToJSON | `dock-utils.ts` → `dockToJSON()` | ✅ 已包含 |
| resetLayout | `util.ts` → `resetLayout()` | ✅ 已包含 |
| saveLayout | `layout-serialization.ts` → `saveLayout()` | ✅ 已包含 |
| exportLayout | `layout-serialization.ts` → `exportLayout()` | ✅ 已包含 |
| getAllLayout | `layout-serialization.ts` → `getAllLayout()` | ✅ 已包含 |
| initInternalDock | `dock-utils.ts` → `initInternalDock()` | ✅ 已包含 |
| JSONToDock | `dock-utils.ts` → `JSONToDock()` | ✅ 已包含 |
| JSONToCenter | `layout-deserialization.ts` → `JSONToCenter()` | ✅ 已包含 |
| JSONToLayout | `layout-deserialization.ts` → `JSONToLayout()` | ✅ 已包含 |
| layoutToJSON | `layout-serialization.ts` → `layoutToJSON()` | ✅ 已包含 |
| resizeTopBar | `ui-utils.ts` → `resizeTopBar()` | ✅ 已包含 |
| newModelByInitData | `util.ts` → `newModelByInitData()` | ✅ 已包含 |
| pdfIsLoading | `util.ts` → `pdfIsLoading()` | ✅ 已包含 |
| getInstanceById | `util.ts` → `getInstanceById()` | ✅ 已包含 |
| addResize | `utils/addResize.ts` → `addResize()` | ✅ 已包含 |
| adjustLayout | `ui-utils.ts` → `adjustLayout()` | ✅ 已包含 |
| fixWndFlex1 | `ui-utils.ts` → `fixWndFlex1()` | ✅ 已包含 |

**验证结果:** ✅ 已完整包含

**本地模块化架构:**
```
layout/
├── util.ts (194行，入口文件，重导出子模块)
├── dock-utils.ts (Dock 序列化/反序列化)
├── layout-serialization.ts (布局序列化)
├── layout-deserialization.ts (布局反序列化)
├── window-utils.ts (窗口操作)
├── ui-utils.ts (UI 工具函数)
└── utils/
    ├── addResize.ts (调整大小功能)
    └── setPanelFocus.ts (面板焦点)
```

**本地额外改进:**
- 使用类型守卫函数（如 `isLayoutValue`、`isWndValue`）增强类型安全
- 使用环境访问函数（如 `getCenterLayout()`）封装全局状态访问
- 添加详细的 JSDoc 注释说明函数作用、意图和调用时机

---

### 3. app/src/plugin/API.ts

**远程版本功能清单 (344行单文件):**

| 功能点 | 行号范围 | 描述 |
|--------|---------|------|
| openWindow | 46-63 | 打开新窗口（支持 doc/tab 参数） |
| openTab | 65-180 | 打开 Tab 页签（支持 doc/pdf/asset/search/card/custom） |
| getModelByDockType | 183-189 | 根据 Dock 类型获取模型 |
| openAttributePanel | 191-202 | 打开属性面板 |
| saveLayout | 204-217 | 保存布局（移动端/桌面端） |
| getActiveEditor | 219-266 | 获取当前活跃编辑器 |
| expandDocTree | 268-306 | 展开文档树到指定节点 |
| API 对象 | 308-343 | 导出所有 API 方法 |

**本地子模块对应关系:**

| 远程功能 | 本地子模块 | 状态 |
|---------|-----------|------|
| openWindow | `api/openWindow.ts` → `openWindow()` | ✅ 已包含 |
| openTab | `api/openTab.ts` → `openTab()` | ✅ 已包含 |
| getModelByDockType | `api/getModelByDockType.ts` → `getModelByDockType()` | ✅ 已包含 |
| openAttributePanel | `API.ts` → `openAttributePanel()` | ✅ 已包含 |
| saveLayout | `API.ts` → `saveLayout()` | ✅ 已包含 |
| getActiveEditor | `API.ts` → `getActiveEditor()` | ✅ 已包含 |
| expandDocTree | `api/expandDocTree.ts` → `expandDocTree()` | ✅ 已包含 |
| API 对象 | `API.ts` → `API` | ✅ 已包含 |

**验证结果:** ✅ 已完整包含

**本地模块化架构:**
```
plugin/
├── API.ts (148行，主文件)
└── api/
    ├── openTab.ts (打开 Tab 页签)
    ├── openWindow.ts (打开新窗口)
    ├── getModelByDockType.ts (获取 Dock 模型)
    └── expandDocTree.ts (展开文档树)
```

**本地额外改进:**
- 使用 `siyuanI18n` 统一访问层
- `openTab.ts` 拆分为多个处理函数（`处理文档打开`、`处理资源打开`、`处理PDF打开`、`处理搜索打开`、`处理闪卡打开`）
- 添加 TypeScript 接口定义（`IOpenTabOptions`、`IOpenWindowOptions`）
- `getActiveEditor` 使用 for...of 循环替代 forEach，提高可读性

---

## 结论

第4组深入验证（第一批）的3个模块化拆分文件，其远程版本的所有功能均已被本地子模块完整包含。

**验证统计:**
- Panel.ts: 5个核心功能点 → 4个子模块 → ✅ 100% 覆盖
- layout/util.ts: 20个核心功能点 → 8+个子模块 → ✅ 100% 覆盖
- plugin/API.ts: 8个核心功能点 → 4个子模块 → ✅ 100% 覆盖

**本地版本优势:**
1. 模块化架构提高代码可维护性和可测试性
2. 统一的国际化访问层（siyuanI18n）
3. 封装的全局状态访问函数，减少对 window.siyuan 的直接依赖
4. 增强的类型安全（类型守卫、接口定义）
5. 详细的 JSDoc 注释

---

# Git 合并验证报告 - 第4组深入验证（第二批）

验证时间: 2026-02-13T19:35 UTC

## 验证范围

本次深入验证针对3个模块化拆分文件，确认远程.remote文件中的功能改进是否已被本地子模块完整包含。

**特别说明:** menus/protyle.ts 是用户手动合并的文件，需要最仔细的验证。

## 验证结果汇总

| 文件名 | 远程行数 | 本地主文件行数 | 子模块数量 | 是否完整包含 | 备注 |
|--------|---------|---------------|-----------|-------------|------|
| app/src/menus/protyle.ts | 2555 | 693 | 18+ | ✅ 是 | 用户手动合并，功能完整 |
| app/src/search/util.ts | 1501 | 432 | 10+ | ✅ 是 | 模块化架构，功能完整 |
| app/src/util/fetch.ts | 147 | 349 | 0 (重构) | ✅ 是 | 重构增强，功能完整 |

## 详细分析

### 1. app/src/menus/protyle.ts（用户手动合并，重点验证）

**远程版本功能清单 (2555行单文件):**

| 功能点 | 行号范围 | 描述 |
|--------|---------|------|
| renderAssetList | 68-96 | 渲染资源列表 |
| assetMenu | 98-207 | 资源菜单（搜索、预览、选择） |
| fileAnnotationRefMenu | 209-341 | 文件注释引用菜单 |
| refMenu | 343-707 | 块引用菜单（打开、反链、图谱、转换） |
| contentMenu | 709-917 | 内容菜单（复制、粘贴、表格操作） |
| enterBack | 919-936 | 返回上一级 |
| zoomOut | 938-1076 | 缩放退出聚焦 |
| imgMenu | 1078-1468 | 图片菜单（URL、标题、OCR、宽高、对齐） |
| linkMenu | 1470-1757 | 链接菜单（编辑、复制、转换） |
| tagMenu | 1759-1916 | 标签菜单（搜索、重命名、转换） |
| inlineMathMenu | 1918-1969 | 行内公式菜单 |
| genImageWidthMenu | 1971-1985 | 图片宽度菜单生成 |
| genImageHeightMenu | 1987-2001 | 图片高度菜单生成 |
| iframeMenu | 2003-2072 | iframe菜单（Bilibili特殊处理） |
| videoMenu | 2074-2119 | 视频/音频菜单 |
| tableMenu | 2121-2452 | 表格菜单（插入/删除/移动行列、对齐、合并） |
| setFoldById | 2454-2468 | 根据ID设置折叠 |
| setFold | 2470-2555 | 设置折叠状态 |

**本地子模块对应关系:**

| 远程功能 | 本地子模块 | 状态 |
|---------|-----------|------|
| renderAssetList | `protyleMenus/protyle.asset.ts` → `renderAssetList()` | ✅ 已包含 |
| assetMenu | `protyleMenus/protyle.asset.ts` → `assetMenu()` | ✅ 已包含 |
| fileAnnotationRefMenu | `protyleMenus/protyle.fileAnnotationRefMenu.ts` | ✅ 已包含 |
| refMenu | `protyle.refMenu.ts` (394行) | ✅ 已包含 |
| contentMenu | `protyleMenus/protyle.contentMenu.ts` (327行) | ✅ 已包含 |
| enterBack | `protyleMenus/protyle.enterBack.ts` (47行) | ✅ 已包含 |
| zoomOut | `protyle.zoomOut.ts` (154行) | ✅ 已包含 |
| imgMenu | `protyleMenus/protyle.imgMenu.ts` + 子模块 | ✅ 已包含 |
| linkMenu | `protyleMenus/protyle.linkMenu.ts` (261行) | ✅ 已包含 |
| tagMenu | `protyle.tagMenu.ts` | ✅ 已包含 |
| inlineMathMenu | `protyle.inlineMathMenu.ts` | ✅ 已包含 |
| genImageWidthMenu | `protyle.genImageWidthMenu.ts` | ✅ 已包含 |
| genImageHeightMenu | `protyle.genImageHeightMenu.ts` | ✅ 已包含 |
| iframeMenu | `protyle.iframeMenu.ts` (147行) | ✅ 已包含 |
| videoMenu | `protyle.ts` → `videoMenu()` (62-126行) | ✅ 已包含 |
| tableMenu | `protyle.ts` → `tableMenu()` (140-551行) | ✅ 已包含 |
| setFoldById | `protyle.ts` → `setFoldById()` (562-580行) | ✅ 已包含 |
| setFold | `protyle.ts` → `setFold()` (596-692行) | ✅ 已包含 |

**验证结果:** ✅ 已完整包含

**本地模块化架构:**
```
menus/
├── protyle.ts (693行，主文件 + videoMenu/tableMenu/setFold)
├── protyle.refMenu.ts (块引用菜单)
├── protyle.tagMenu.ts (标签菜单)
├── protyle.inlineMathMenu.ts (行内公式菜单)
├── protyle.genImageWidthMenu.ts (图片宽度菜单)
├── protyle.genImageHeightMenu.ts (图片高度菜单)
├── protyle.iframeMenu.ts (iframe菜单)
├── protyle.zoomOut.ts (缩放退出)
└── protyleMenus/
    ├── protyle.asset.ts (538行，资源菜单)
    ├── protyle.contentMenu.ts (327行，内容菜单)
    ├── protyle.enterBack.ts (47行，返回上一级)
    ├── protyle.fileAnnotationRefMenu.ts (163行，文件注释引用)
    ├── protyle.imgMenu.ts (144行，图片菜单入口)
    ├── protyle.imgMenu.actions.ts (图片操作)
    ├── protyle.imgMenu.items.ts (图片菜单项)
    ├── protyle.imgMenu.size.ts (图片尺寸)
    ├── protyle.imgMenu.rating.ts (图片评分)
    ├── protyle.linkMenu.ts (261行，链接菜单)
    ├── protyle.linkMenu.items.ts (链接菜单项)
    ├── protyle.linkMenu.utils.ts (链接工具函数)
    └── protyle.types.ts (类型定义)
```

**本地额外改进:**
- 使用 `siyuanI18n` 统一访问层替代 `window.siyuan.languages`
- 使用 `getSiyuanGlobalMenusMenu()` 等封装函数替代直接访问 `window.siyuan.menus`
- 图片菜单添加了评分功能 (`protyle.imgMenu.rating.ts`)
- 资源菜单添加了元数据预览功能（调色板、尺寸、大小、评分）
- 详细的 JSDoc 注释说明函数作用、意图和调用时机

---

### 2. app/src/search/util.ts

**远程版本功能清单 (1501行单文件):**

| 功能点 | 行号范围 | 描述 |
|--------|---------|------|
| openGlobalSearch | 52-81 | 打开全局搜索 |
| genSearch | 84-925 | 生成搜索面板（大型函数） |
| openSearchEditor | 927-973 | 打开搜索编辑器 |
| genQueryHTML | 975-999 | 生成查询方法HTML |
| updateConfig | 1001-1064 | 更新搜索配置 |
| scrollToCurrent | 1066-1079 | 滚动到当前位置 |
| renderNextSearchMark | 1081-1128 | 渲染下一个搜索标记 |
| getArticle | 1132-1224 | 获取文章内容 |
| replace | 1226-1290 | 替换功能 |
| inputEvent | 1292-1371 | 输入事件处理 |
| getAttr | 1373-1385 | 获取块属性HTML |
| onSearch | 1387-1500 | 搜索结果处理 |

**本地子模块对应关系:**

| 远程功能 | 本地子模块 | 状态 |
|---------|-----------|------|
| openGlobalSearch | `util.ts` → `openGlobalSearch()` (33-62行) | ✅ 已包含 |
| genSearch | `utils/genSearch.ts` + 子模块 | ✅ 已包含 |
| openSearchEditor | `util.ts` → `openSearchEditor()` (64-110行) | ✅ 已包含 |
| genQueryHTML | `util.ts` → `genQueryHTML()` (112-140行) | ✅ 已包含 |
| updateConfig | `util.ts` → `updateConfig()` (143-205行) | ✅ 已包含 |
| scrollToCurrent | `utils/utils.scrollToCurrent.ts` | ✅ 已包含 |
| renderNextSearchMark | `util.ts` → `renderNextSearchMark()` (208-255行) | ✅ 已包含 |
| getArticle | `util.ts` → `getArticle()` (259-346行) | ✅ 已包含 |
| replace | `util.ts` → `replace()` (348-412行) | ✅ 已包含 |
| inputEvent | `inputEvent.ts` (151行) | ✅ 已包含 |
| getAttr | `util.ts` → `getAttr()` (417-429行) | ✅ 已包含 |
| onSearch | `utils/onSearch.ts` (268行) | ✅ 已包含 |

**验证结果:** ✅ 已完整包含

**本地模块化架构:**
```
search/
├── util.ts (432行，主文件)
├── inputEvent.ts (151行，输入事件处理)
├── menu.ts (搜索菜单)
├── toggleHistory.ts (历史记录切换)
├── assets.ts (资源搜索)
├── unRef.ts (未引用块搜索)
├── getDefault.ts (默认配置)
└── utils/
    ├── genSearch.ts (107行，生成搜索面板入口)
    ├── onSearch.ts (268行，搜索结果处理)
    ├── utils.scrollToCurrent.ts (33行，滚动定位)
    └── genSearch/
        ├── index.ts
        ├── genSearchHTML.ts (HTML生成)
        ├── initSearchEditors.ts (编辑器初始化)
        ├── setupClickHandler.ts (点击事件)
        ├── setupDragHandler.ts (拖拽事件)
        ├── setupInputHandlers.ts (输入事件)
        └── handlers/ (各类事件处理器)
```

**本地额外改进:**
- 使用 `siyuanI18n` 统一访问层
- genSearch 拆分为多个专注的子模块，提高可维护性
- inputEvent 支持语义搜索（method=4）
- genQueryHTML 添加语义搜索图标支持
- 详细的 JSDoc 注释

---

### 3. app/src/util/fetch.ts

**远程版本功能清单 (147行单文件):**

| 功能点 | 行号范围 | 描述 |
|--------|---------|------|
| fetchPost | 8-117 | POST请求（竞态控制、错误处理） |
| fetchSyncPost | 119-134 | 同步POST请求 |
| fetchGet | 136-146 | GET请求 |

**远程版本关键特性:**
- 请求竞态控制（reqId机制）
- HTTP状态码处理（401/403/404）
- 401时3秒后自动刷新页面
- /api/file/getFile 的202状态特殊处理
- 事务API的网络错误处理（kernelError）
- Electron退出逻辑

**本地版本对应关系:**

| 远程功能 | 本地实现 | 状态 |
|---------|---------|------|
| fetchPost | `fetchPost()` (236-270行) | ✅ 已包含 |
| fetchSyncPost | `fetchSyncPost()` (290-303行) | ✅ 已包含 |
| fetchGet | `fetchGet()` (342-348行) | ✅ 已包含 |
| 竞态控制 | `需要竞态控制的API列表` + `setupRequestData()` | ✅ 已包含 |
| HTTP状态处理 | `handleFetchResponse()` (139-169行) | ✅ 已包含 |
| 错误处理 | `handleFetchError()` (98-125行) | ✅ 已包含 |
| 响应处理 | `createPostResponseHandler()` (185-212行) | ✅ 已包含 |

**验证结果:** ✅ 已完整包含

**本地重构改进:**

1. **代码结构优化:**
   - 拆分为多个专注的辅助函数
   - `setupRequestData()` - 请求数据准备
   - `handleFetchError()` - 错误处理
   - `handleFetchResponse()` - 响应处理
   - `createPostResponseHandler()` - 响应处理器工厂

2. **类型安全增强:**
   - 添加 `TFetchRequestData` 类型定义
   - 添加 `isWebSocketData()` 类型守卫
   - fetchSyncPost 验证响应格式

3. **新增功能:**
   - `fetchSyncPostRaw()` - 获取原始响应（用于非标准API）
   - 详细的 JSDoc 注释说明每个函数的作用和使用场景

4. **环境抽象:**
   - 使用 `getSiyuanReqId()` / `setSiyuanReqId()` 封装全局状态访问
   - 使用 `reloadLocation()` 封装页面刷新

**远程 vs 本地对比:**

| 特性 | 远程版本 | 本地版本 |
|------|---------|---------|
| 行数 | 147 | 349 |
| 竞态控制 | ✅ | ✅ |
| HTTP错误处理 | ✅ | ✅ |
| 401自动刷新 | ✅ | ✅ |
| 202特殊处理 | ✅ | ✅ |
| kernelError | ✅ | ✅ |
| Electron退出 | ✅ | ✅ |
| 类型守卫 | ❌ | ✅ |
| fetchSyncPostRaw | ❌ | ✅ |
| JSDoc注释 | 少量 | 详细 |
| async/await | .then链 | async/await |

---

## 结论

第4组深入验证（第二批）的3个文件，其远程版本的所有功能均已被本地版本完整包含。

**验证统计:**
- menus/protyle.ts: 18个核心功能点 → 18+个子模块 → ✅ 100% 覆盖
- search/util.ts: 12个核心功能点 → 10+个子模块 → ✅ 100% 覆盖
- util/fetch.ts: 3个核心函数 + 6个关键特性 → 重构增强 → ✅ 100% 覆盖

**特别说明（menus/protyle.ts 用户手动合并）:**
用户手动合并的 menus/protyle.ts 文件验证结果良好。远程版本的所有菜单功能（引用菜单、图片菜单、链接菜单、内容菜单、标签菜单、表格菜单等）均已在本地子模块中完整保留。本地版本采用了更清晰的模块化架构，将2555行的大文件拆分为18+个专注的子模块，同时添加了一些增强功能（如图片评分、资源元数据预览等）。

**本地版本优势:**
1. 模块化架构提高代码可维护性和可测试性
2. 统一的国际化访问层（siyuanI18n）
3. 封装的全局状态访问函数，减少对 window.siyuan 的直接依赖
4. 增强的类型安全（类型守卫、接口定义）
5. 详细的 JSDoc 注释
6. 部分功能增强（图片评分、语义搜索、fetchSyncPostRaw等）
