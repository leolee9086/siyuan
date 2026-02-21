# 条件编译最终清理 TTT

## 状态: ✅ 已完成
## 创建时间: 2026-02-21
## 完成时间: 2026-02-21
## 关联规程: docs/规程/代码质量/前端条件编译清理.procedure.md
## 前置任务: docs/ttt/conditional-compilation-cleanup.ttt.md (已完成)

---

## 调查结论

### 1. 源码 `/// #if` 指令状态

源码清理已基本完成。仅剩：
- `app/src/config/about.remote.ts` 含4处 `/// #if !BROWSER` 指令（前次清理有意排除）
- `app/src/platform/` 模块中的 JSDoc 注释引用旧指令（文档性质，非实际指令）

### 2. ifdef-loader 依赖链

| 文件 | 状态 |
|------|------|
| `app/package.json:88` | `ifdef-loader: ^2.3.2` 仍存在 |
| `app/webpack.config.js` | 1处 ifdef-loader 规则 |
| `app/webpack.mobile.js` | 2处 ifdef-loader 规则 |
| `app/webpack.desktop.js` | 2处 ifdef-loader 规则 |
| `app/webpack.export.js` | 2处 ifdef-loader 规则 |

### 3. 残留的 .backup 和 .remote 文件

这些是 git merge 和重构过程中产生的备份/远程版本文件，其中多数包含旧的条件编译代码。

#### .remote 文件（上游原始版本）
- `app/src/window/init.ts.remote`
- `app/src/util/assets.ts.remote`
- `app/src/search/util.ts.remote`
- `app/src/protyle/wysiwyg/remove.ts.remote`
- `app/src/protyle/wysiwyg/keydown.ts.remote`
- `app/src/protyle/ui/initUI.ts.remote`
- `app/src/protyle/ui/hideElements.ts.remote`
- `app/src/protyle/toolbar/index.ts.remote`
- `app/src/protyle/render/av/asset.ts.remote`
- `app/src/protyle/gutter/index.ts.remote`
- `app/src/protyle/export/index.ts.remote`
- `app/src/mobile/settings/about.ts.remote`
- `app/src/mobile/index.ts.remote`
- `app/src/mobile/menu/index.ts.remote`
- `app/src/menus/protyle.ts.remote`
- `app/src/menus/commonMenuItem.ts.remote`
- `app/src/menus/util.ts.remote`
- `app/src/index.ts.remote`
- `app/src/layout/topBar.ts.remote`
- `app/src/layout/dock/Bookmark.ts.remote`
- `app/src/layout/dock/Files.ts.remote`
- `app/src/layout/dock/Tag.ts.remote`
- `app/src/config/about.ts.remote`
- `app/src/config/about.remote.ts`（特殊：这是实际源文件，非备份）
- `app/src/config/fileTree.ts.remote`
- `app/src/card/openCard.ts.remote`
- `app/package.json.remote`

#### .backup 文件（本地重构前备份）
- `app/src/window/init.ts.backup`
- `app/src/util/assets.ts.backup`
- `app/src/search/util.ts.backup`
- `app/src/protyle/wysiwyg/remove.ts.backup`
- `app/src/protyle/wysiwyg/keydown.ts.backup`
- `app/src/protyle/ui/initUI.ts.backup`
- `app/src/protyle/ui/hideElements.ts.backup`
- `app/src/protyle/toolbar/index.ts.backup`
- `app/src/protyle/render/av/asset.ts.backup`
- `app/src/protyle/gutter/index.ts.backup`
- `app/src/protyle/export/index.ts.backup`
- `app/src/mobile/settings/about.ts.backup`
- `app/src/mobile/index.ts.backup`
- `app/src/mobile/menu/index.ts.backup`
- `app/src/menus/protyle.ts.backup`
- `app/src/menus/commonMenuItem.ts.backup`
- `app/src/menus/util.ts.backup`
- `app/src/index.ts.backup`
- `app/src/layout/topBar.ts.backup`
- `app/src/layout/dock/Bookmark.ts.backup`
- `app/src/layout/dock/Files.ts.backup`
- `app/src/layout/dock/Tag.ts.backup`
- `app/src/config/about.ts.backup`
- `app/src/config/fileTree.ts.backup`
- `app/src/card/openCard.ts.backup`
- `app/package.json.backup`

### 4. 构建产物

`app/stage/build/mobile/` 中有 230+ 处 ifdef-loader 引用，属于正常 webpack 构建产物，重新构建后自动更新。

---

## 执行记录

实际执行顺序与原计划有所调整，先删除残留文件再处理其余阶段。

### 阶段0：删除残留的 .backup 和 .remote 文件 ✅

- 删除52个 `.backup` / `.remote` 文件
- `about.remote.ts` 作为 `.remote` 后缀文件一并删除

### 阶段1：清理 about.remote.ts 中的条件编译指令 ✅（无需操作）

- 该文件已在阶段0中作为 `.remote` 文件被删除，无需单独处理

### 阶段2：移除 ifdef-loader 依赖 ✅

- 修改5个文件：4个 webpack 配置（config/desktop/mobile/export）+ `package.json`
- `ifdef-loader` 在源码中零引用

### 阶段3：构建验证 ✅

全部4个构建目标通过：

| 构建目标 | 耗时 | 结果 |
|----------|------|------|
| electron desktop | 23.8s | 通过，无警告 |
| browser desktop | 19.2s | 通过，2个资源大小警告（非错误） |
| browser mobile | 19.0s | 通过，2个资源大小警告（非错误） |
| export | 15.1s | 通过，2个资源大小警告（非错误） |

---

## 进度记录

| 日期 | 事项 |
|------|------|
| 2026-02-21 | 完成调查，制定清理计划 |
| 2026-02-21 | 全部阶段执行完毕，任务完成 |

## 失败记录

（无）
