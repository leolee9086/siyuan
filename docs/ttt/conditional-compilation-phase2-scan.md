# 条件编译阶段2扫描 - 函数级条件编译调查

扫描时间: 2026-02-20
扫描范围: app/src/

## 一、函数级条件编译使用点（模式D）

以下是整个函数/导出被 `/// #if` / `/// #endif` 包裹的情况。

### 1. app/src/protyle/util/compatibility.ts

| 行号范围 | 条件标志 | 函数名/导出名 |
|---------|---------|-------------|
| 132-151 | `!BROWSER` | `export const getLocalFiles` |
| 592-627 | `!BROWSER` | `export const initNativeDialogOverride` |

### 2. app/src/protyle/export/index.ts

| 行号范围 | 条件标志 | 函数名/导出名 |
|---------|---------|-------------|
| 139-691 | `!BROWSER` | `const renderPDF`（大型函数） |
| 693-753 | `!BROWSER` | `const getExportPath`（同一 `#if` 块内） |

注：L139-753 整体被同一个 `/// #if !BROWSER` ... `/// #endif` 包裹，包含两个函数。

### 3. app/src/plugin/api/openWindow.ts

| 行号范围 | 条件标志 | 函数名/导出名 |
|---------|---------|-------------|
| 16-19 | `MOBILE` | `export const openWindow`（空实现） |
| 21-30 | `#else`（即 `!MOBILE`） | `export const openWindow`（完整实现） |

注：使用 `/// #if MOBILE` / `/// #else` / `/// #endif` 模式，同一函数有两个条件分支版本。

### 4. app/src/protyle/breadcrumb/action.ts

| 行号范围 | 条件标志 | 函数名/导出名 |
|---------|---------|-------------|
| 59-67 | `!MOBILE` | `const updateLayoutDragRegion` |
| 69-86 | `!MOBILE` | `const updateWindowControlsZIndex` |

注：L59-87 整体被同一个 `/// #if !MOBILE` ... `/// #endif` 包裹，包含两个函数。

### 5. app/src/layout/layout-deserialization.layout.ts

| 行号范围 | 条件标志 | 函数名/导出名 |
|---------|---------|-------------|
| 32-50 | `!MOBILE` | `export const removeUnpinnedTabsOnStart` |

### 6. app/src/layout/getAll.ts

| 行号范围 | 条件标志 | 函数名/导出名 |
|---------|---------|-------------|
| 85-322 | `!MOBILE` | 多个函数（大型块） |

包含的函数：
- `const pushModel`（L93）
- `const getTabsForModels`（L152）
- `export const getAllModels`（L185）
- `export const getAllWnds`（L226）
- `const getTabsForTabs`（L245）
- `export const getAllTabs`（L271）
- `export const getAllDocks`（L289）

注：这是最大的函数级条件编译块，包含7个函数，约237行代码。

### 7. app/src/boot/globalEvent/click.ts

| 行号范围 | 条件标志 | 函数名/导出名 |
|---------|---------|-------------|
| 71-86 | `!MOBILE` | `const handleDockClick` |
| 88-120 | `!MOBILE` | `const handlePDFClick` |

注：L71-120 整体被同一个 `/// #if !MOBILE` ... `/// #endif` 包裹，包含两个函数。

### 8. app/src/index.ts

| 行号范围 | 条件标志 | 函数名/导出名 |
|---------|---------|-------------|
| 263-268 | `BROWSER` | 模块级赋值：`window.showKeyboardToolbar` 和 `window.processIOSPurchaseResponse` |

注：严格来说是模块级语句块而非函数定义，但整个块被条件编译包裹。

### 9. app/src/config/index.ts

| 行号范围 | 条件标志 | 函数名/导出名 |
|---------|---------|-------------|
| 199-211 | `!MOBILE` | 模块级语句：`tabRegistry.register(...)` |

注：模块级执行语句块，非函数定义。

## 二、统计

### 函数级条件编译统计

| 指标 | 数量 |
|-----|------|
| 涉及文件数 | 9 |
| 函数级条件编译块数 | 9 |
| 被包裹的函数/导出总数 | 约16个 |
| 使用 `!MOBILE` 条件的 | 5处 |
| 使用 `!BROWSER` 条件的 | 2处 |
| 使用 `MOBILE` 条件的 | 1处 |
| 使用 `BROWSER` 条件的 | 1处 |

### 各文件条件编译总体使用情况

以下统计每个文件中 `/// #if` 的总出现次数和使用的标志：

| 文件路径 | `/// #if` 次数 | 使用的标志 |
|---------|--------------|----------|
| app/src/protyle/wysiwyg/index.ts | ~20 | `!BROWSER`, `!MOBILE`, `BROWSER && !MOBILE`, `MOBILE` |
| app/src/protyle/util/onGet.ts | ~6 | `!MOBILE`, `MOBILE` |
| app/src/protyle/util/compatibility.ts | ~5 | `!BROWSER`, `MOBILE` |
| app/src/menus/navigation.ts | ~12 | `!BROWSER`, `!MOBILE`, `MOBILE` |
| app/src/menus/commonMenuItem.ts | ~7 | `!BROWSER`, `!MOBILE` |
| app/src/protyle/export/index.ts | ~4 | `!BROWSER`, `BROWSER` |
| app/src/layout/getAll.ts | ~2 | `!MOBILE` |
| app/src/plugin/index.ts | ~5 | `!MOBILE`, `MOBILE` |
| app/src/editor/openLink.ts | ~8 | `!BROWSER`, `!MOBILE`, `MOBILE` |
| app/src/util/newFile.ts | ~5 | `!MOBILE` |
| app/src/protyle/index.ts | ~7 | `!MOBILE`, `MOBILE` |
| app/src/protyle/hint/index.ts | ~6 | `!MOBILE`, `MOBILE` |
| app/src/layout/status.ts | ~4 | `!MOBILE`, `!BROWSER` |
| app/src/layout/Wnd.ts | ~8 | `!BROWSER`, `!MOBILE` |
| app/src/protyle/header/openTitleMenu.ts | ~6 | `!MOBILE`, `!BROWSER`, `MOBILE` |
| app/src/boot/globalEvent/click.ts | ~2 | `!MOBILE` |
| app/src/boot/globalEvent/command/global.ts | ~3 | `MOBILE`, `!BROWSER` |
| app/src/config/index.ts | ~3 | `MOBILE`, `!MOBILE` |
| app/src/index.ts | ~3 | `BROWSER`, `BROWSER && !MOBILE` |
| app/src/plugin/api/openWindow.ts | ~2 | `!MOBILE`, `MOBILE` |
| app/src/protyle/breadcrumb/action.ts | ~4 | `!MOBILE` |
| app/src/layout/layout-deserialization.layout.ts | ~2 | `!MOBILE`, `BROWSER` |
| 其他文件（约60个） | 各1-3处 | `!MOBILE`, `!BROWSER`, `MOBILE`, `BROWSER` |

### 条件标志使用频率（全局）

| 标志 | 大致出现次数 |
|-----|-----------|
| `!MOBILE` | ~100+ |
| `!BROWSER` | ~50+ |
| `MOBILE` | ~30+ |
| `BROWSER` | ~10+ |
| `BROWSER && !MOBILE` | ~3 |
