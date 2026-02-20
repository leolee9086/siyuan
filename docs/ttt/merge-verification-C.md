# 合并验证批次C

## 冲突标记检查
- 搜索范围: `app/src/**/*.ts`
- 搜索模式: `[<]{7}`
- 结果: 0处残留，✅全部清除

## 1. hideElements.ts
- 远程改进项:
  - `isIPhone` 导入及在 `gutterOnly` 分支中的守卫检查（远程第29-31行）
- 验证结果: ✅已包含（当前文件第2行导入，第67行使用）

## 2. fileTree.ts
- 远程改进项:
  - 新增 `noSplitScreenWhenOpenTab` 配置项（HTML模板 + `_send` 提交字段）
  - 新增 `recentDocsMaxListCount` 配置项
- 验证结果: ✅已包含（当前文件第49-54行HTML模板，第165行_send字段含注释标记）

## 3. init.ts
- 远程改进项:
  - 新增 `initNativeDialogOverride` 导入和调用（条件编译 `#if !BROWSER`）
- 验证结果: ✅已包含（当前文件第20-22行导入，第118-120行调用）

## 4. protyle.ts（本地拆分到 protyleMenus/ 子目录）
- 远程改进项:
  - `copyAsset` 功能：导入及在 imgMenu/linkMenu 中使用
  - `base64ToURL`：在 imgMenu 的 removeCB 中处理 base64 图片源转换为 URL
  - `img3115`：在图片尺寸调整时调用
  - `scrollCenter`：在内容菜单中使用
  - `hideTooltip`：在 linkMenu 中使用
- 验证结果:
  - `copyAsset`: ✅已包含（protyle.imgMenu.actions.ts 第8行、protyle.linkMenu.items.ts 第18行）
  - `base64ToURL`: ❌缺失 — 远程 imgMenu removeCB 中有 base64 图片源自动转换逻辑（远程第1452-1459行），当前 protyle.imgMenu.ts 的 removeCB（第135-148行）缺少此处理
  - `img3115`: ✅已包含（protyle.imgMenu.size.ts 第2行导入，多处使用）
  - `scrollCenter`: ✅已包含（protyle.zoomOut.ts 第11行、protyle.ts 第24行）
  - `hideTooltip`: ✅已包含（protyle.linkMenu.ts 第10行）

## 5. gutter/index.ts（本地拆分到同目录子模块）
- 远程改进项:
  - `processClonePHElement`：拖拽时克隆元素处理
  - `clearSelect`：菜单打开前清除选择
  - `addEditorToDatabase`：添加到数据库功能
  - `chartRender`：echarts 图表 resize 后重新渲染
- 验证结果:
  - `processClonePHElement`: ✅已包含（bindEvent.ts 第25行导入，第127行使用）
  - `clearSelect`: ✅已包含（bindEvent.ts 第32行导入，第155/395行使用）
  - `addEditorToDatabase`: ✅已包含（buildMultipleEditMenu.ts 第10行、buildGutterEditMenu.ts 第10行）
  - `chartRender`: ❌缺失 — 远程 updateNodeElements 中 echarts resize 后调用 chartRender（远程第2304-2309行），本地 buildGutterStyleMenu.ts 的 updateNodeElements（第11-33行）缺少此处理

## 6. asset.ts
- 远程改进项:
  - `copyAsset` 导入及在资源菜单中使用（仅 Windows/macOS，条件编译 `#if !BROWSER`）
  - `confirmDialog` + `filesize`：上传大文件确认对话框
  - `base64ToURL`：base64 图片转 URL
- 验证结果: ✅已包含
  - `copyAsset`: 当前文件第10行导入，第376行使用
  - `confirmDialog` + `filesize`: 当前文件第26-27行导入，第446-453行使用
  - `base64ToURL`: 当前文件第24行导入，第212行使用

## 缺失汇总

| # | 文件 | 缺失内容 | 严重程度 |
|---|------|----------|----------|
| 1 | protyleMenus/protyle.imgMenu.ts | removeCB 中缺少 base64ToURL 图片源转换逻辑 | 中 — 影响粘贴 base64 图片后的自动上传转换 |
| 2 | gutter/buildGutterStyleMenu.ts | updateNodeElements 中缺少 echarts chartRender 调用 | 低 — 影响 echarts 图表宽高调整后的重新渲染 |
