# 条件编译阶段3扫描 - 代码块级与互斥分支级

扫描时间: 2026-02-20
扫描范围: app/src/
扫描目标: 模式B（代码块级）和模式C（互斥分支级），附带模式A（平台特定导入）

## 总体统计

| 指标 | 数量 |
|-----|------|
| 涉及文件总数 | ~75 |
| `/// #if` 总出现次数 | ~310 |
| 模式A（平台特定导入） | ~45 |
| 模式B（代码块级） | ~200 |
| 模式C（互斥分支级） | ~50 |
| 模式D（函数级，阶段2已覆盖） | ~15 |

### 条件标志分布

| 标志 | 出现次数 |
|-----|---------|
| `!MOBILE` | ~120 |
| `!BROWSER` | ~95 |
| `MOBILE` | ~55 |
| `BROWSER` | ~15 |
| `BROWSER && !MOBILE` | ~3 |

---

## 一、低耦合模块（优先清理）

### 1.1 util/ 模块

| 文件 | `/// #if` 次数 | 条件标志 | 模式 |
|-----|--------------|---------|------|
| util/functions.ts | 2 | `MOBILE`, `BROWSER` | C（互斥分支：getFrontend/isBrowser 两个版本） |
| util/pathName.ts | 2 | `!BROWSER` | A×1, B×1 |
| util/pathName/movePathTo.ts | 1 | `!MOBILE` | B |
| util/pathName/movePathTo.click.ts | 1 | `!MOBILE` | B |
| util/fetch.ts | 2 | `!BROWSER` | A×1, B×1 |
| util/assets.ts | 4 | `!MOBILE`, `BROWSER` | A×1, B×3 |
| util/newFile.ts | 7 | `!MOBILE` | A×2, B×5 |
| util/noRelyPCFunction.ts | 3 | `!MOBILE`, `MOBILE` | A×1, C×2 |
| util/mount.ts | 1 | `MOBILE` | B（C的一部分，与!MOBILE互斥） |
| util/iOSPurchase.ts | 1 | `MOBILE` | B |
| util/serviceWorker.ts | 1 | `BROWSER` | B |
| util/processMessage.ts | 2 | `!MOBILE`, `MOBILE` | A×1, B×1 |
| util/focusStack.ts | 1 | `!MOBILE` | A |

**小计**: 28次，13个文件

### 1.2 config/ 模块

| 文件 | `/// #if` 次数 | 条件标志 | 模式 |
|-----|--------------|---------|------|
| config/index.ts | 2 | `MOBILE`, `!MOBILE` | A×1, B×1（阶段2已记录模块级语句） |
| config/about.ts | 4 | `!BROWSER` | A×1, B×3 |
| config/about.remote.ts | 4 | `!BROWSER` | A×1, B×3 |
| config/appearance.ts | 2 | `!BROWSER` | A×1, B×1 |
| config/editor.ts | 5 | `!BROWSER` | A×1, B×4 |
| config/exportConfig.ts | 4 | `!BROWSER`, `BROWSER`, `MOBILE` | A×1, B×2, C×1 |
| config/keymap.ts | 6 | `!BROWSER` | A×1, B×5 |
| config/flashcard.ts | 1 | `MOBILE` | B |
| config/ai/ai.ts | 1 | `MOBILE` | B |
| config/image.ts | 10 | `!MOBILE`, `!BROWSER` | A×2, B×8 |
| config/bazzar/bazaarUIHandlers.ts | 2 | `!BROWSER` | A×1, B×1 |

**小计**: 41次，11个文件

### 1.3 dialog/ 模块

| 文件 | `/// #if` 次数 | 条件标志 | 模式 |
|-----|--------------|---------|------|
| dialog/processSystem.ts | 12 | `!MOBILE`, `!BROWSER`, `MOBILE`, `BROWSER` | A×2, B×8, C×2 |
| dialog/index.ts | 2 | `!MOBILE` | A×1, B×1 |

**小计**: 14次，2个文件

### 1.4 sync/ 模块

| 文件 | `/// #if` 次数 | 条件标志 | 模式 |
|-----|--------------|---------|------|
| sync/syncGuide.ts | 3 | `!MOBILE`, `MOBILE` | A×1, C×2 |

**小计**: 3次，1个文件

### 1.5 emoji/ 模块

| 文件 | `/// #if` 次数 | 条件标志 | 模式 |
|-----|--------------|---------|------|
| emoji/index.ts | 3 | `!MOBILE`, `MOBILE` | A×1, C×2 |

**小计**: 3次，1个文件

### 1.6 history/ 模块

| 文件 | `/// #if` 次数 | 条件标志 | 模式 |
|-----|--------------|---------|------|
| history/history.ts | 2 | `MOBILE` | C×2 |

**小计**: 2次，1个文件

### 1.7 card/ 模块

| 文件 | `/// #if` 次数 | 条件标志 | 模式 |
|-----|--------------|---------|------|
| card/openCard.ts | 8 | `!MOBILE`, `MOBILE`, `!BROWSER` | A×2, B×3, C×3 |
| card/util.ts | 1 | `MOBILE` | B |

**小计**: 9次，2个文件

### 1.8 window/ 模块

| 文件 | `/// #if` 次数 | 条件标志 | 模式 |
|-----|--------------|---------|------|
| window/openNewWindow.ts | 4 | `!BROWSER` | A×1, B×3 |
| window/init.ts | 2 | `!BROWSER` | A×1, B×1 |

**小计**: 6次，2个文件

---

## 二、中等耦合模块

### 2.1 editor/ 模块

| 文件 | `/// #if` 次数 | 条件标志 | 模式 |
|-----|--------------|---------|------|
| editor/openLink.ts | 8 | `!BROWSER`, `!MOBILE`, `MOBILE` | A×2, B×4, C×2 |
| editor/util.ts | 3 | `!MOBILE`, `!BROWSER` | A×2, B×1 |
| editor/index.ts | 2 | `!BROWSER` | A×1, B×1 |
| editor/util.updatePanelByEditor.ts | 2 | `!MOBILE` | A×1, B×1 |
| editor/rename.ts | 2 | `!MOBILE` | A×1, B×1 |
| editor/utils.openBy.ts | 1 | `!BROWSER` | B（阶段2已记录为函数级） |
| editor/util.getUnInitTab.ts | 1 | `!MOBILE` | A |

**小计**: 19次，7个文件

### 2.2 search/ 模块

| 文件 | `/// #if` 次数 | 条件标志 | 模式 |
|-----|--------------|---------|------|
| search/util.ts | 1 | `!BROWSER` | A |
| search/toggleHistory.ts | 2 | `MOBILE` | A×1, B×1 |
| search/unRef.ts | 2 | `!MOBILE`, `MOBILE` | B×1, C×1 |
| search/menu.ts | 2 | `MOBILE` | C×2 |
| search/assets.ts | 3 | `MOBILE`, `!MOBILE` | B×1, C×2 |
| search/assets.openSearchAsset.ts | 2 | `!MOBILE`, `!BROWSER` | B×2 |
| search/utils/genSearch.old.ts | 2 | `BROWSER`, `!BROWSER` | B×2 |
| search/utils/genSearch/handlers/handleListItemClick.ts | 2 | `BROWSER`, `!BROWSER` | B×2 |

**小计**: 16次，8个文件

### 2.3 boot/ 模块

| 文件 | `/// #if` 次数 | 条件标志 | 模式 |
|-----|--------------|---------|------|
| boot/onGetConfig.ts | 6 | `!BROWSER` | A×1, B×5 |
| boot/globalEvent/keydown.ts | 4 | `!BROWSER` | A×1, B×3 |
| boot/globalEvent/commonHotkey.ts | 12 | `!BROWSER` | A×1, B×11 |
| boot/globalEvent/searchKeydown.ts | 2 | `!BROWSER` | A×1, B×1 |
| boot/globalEvent/touch.ts | 2 | `!MOBILE` | A×1, B×1 |
| boot/globalEvent/command/panel.ts | 10 | `MOBILE`, `!MOBILE`, `!BROWSER` | A×1, B×5, C×4 |
| boot/globalEvent/command/global.ts | 4 | `MOBILE`, `!BROWSER` | A×2, B×2 |
| boot/globalEvent/command/protyle.ts | 2 | `!MOBILE` | A×1, B×1 |
| boot/globalEvent/click.ts | 2 | `!MOBILE` | D（阶段2已覆盖） |

**小计**: 44次，9个文件

### 2.4 plugin/ 模块

| 文件 | `/// #if` 次数 | 条件标志 | 模式 |
|-----|--------------|---------|------|
| plugin/index.ts | 5 | `!MOBILE`, `MOBILE` | A×1, B×2, C×2（含类型定义中的条件编译） |
| plugin/API.ts | 3 | `!MOBILE`, `MOBILE` | A×1, C×2 |
| plugin/loader.ts | 4 | `!MOBILE` | A×1, B×3 |
| plugin/uninstall.ts | 3 | `!MOBILE` | A×1, B×2 |
| plugin/openTopBarMenu.ts | 2 | `!MOBILE` | A×1, B×1 |
| plugin/api/openTab.ts | 2 | `!MOBILE`, `MOBILE` | A×1, B×1 |
| plugin/api/openWindow.ts | 2 | `!MOBILE`, `MOBILE` | D（阶段2已覆盖） |
| plugin/api/getModelByDockType.ts | 2 | `!MOBILE`, `MOBILE` | A×1, C×1 |

**小计**: 23次，8个文件

---

## 三、高耦合模块（谨慎清理）

### 3.1 menus/ 模块

| 文件 | `/// #if` 次数 | 条件标志 | 模式 |
|-----|--------------|---------|------|
| menus/index.ts | 5 | `!MOBILE`, `!BROWSER` | A×2, B×3 |
| menus/commonMenuItem.ts | 7 | `!BROWSER`, `!MOBILE` | A×3, B×4 |
| menus/commonMenuItem.openMenu.ts | 4 | `!BROWSER`, `!MOBILE`, `MOBILE` | A×2, B×1, C×1 |
| menus/navigation.ts | 12 | `!BROWSER`, `!MOBILE`, `MOBILE` | A×2, B×4, C×6 |
| menus/util.ts | 5 | `!BROWSER`, `!MOBILE`, `BROWSER` | A×1, B×3, C×1 |
| menus/workspace.ts | 5 | `!BROWSER` | A×1, B×4 |
| menus/tab.ts | 2 | `!BROWSER` | A×1, B×1 |
| menus/protyle.ts | 1 | `!BROWSER` | B |
| menus/protyle.refMenu.ts | 3 | `!MOBILE`, `!BROWSER`, `MOBILE` | B×2, C×1 |
| menus/protyle.tagMenu.ts | 2 | `!MOBILE`, `MOBILE` | B×1, C×1 |
| menus/protyle.zoomOut.ts | 1 | `!MOBILE` | B |
| menus/tag.ts | 1 | `MOBILE` | B |
| menus/protyleMenus/protyle.asset.ts | 2 | `MOBILE` | B×1, C×1 |
| menus/protyleMenus/protyle.contentMenu.ts | 1 | `MOBILE` | B |
| menus/protyleMenus/protyle.enterBack.ts | 1 | `MOBILE` | B（C的一部分） |
| menus/protyleMenus/protyle.linkMenu.items.ts | 1 | `!BROWSER` | B |
| menus/protyleMenus/protyle.linkMenu.ts | 1 | `MOBILE` | B |
| menus/protyleMenus/protyle.imgMenu.ts | 2 | `!BROWSER`, `MOBILE` | B×2 |
| menus/protyleMenus/protyle.fileAnnotationRefMenu.ts | 1 | `MOBILE` | B |

**小计**: 57次，19个文件

### 3.2 layout/ 模块

| 文件 | `/// #if` 次数 | 条件标志 | 模式 |
|-----|--------------|---------|------|
| layout/Wnd.ts | 8 | `!BROWSER`, `!MOBILE` | A×2, B×6 |
| layout/status.ts | 4 | `!MOBILE`, `!BROWSER` | A×2, B×2（含阶段2函数级） |
| layout/topBar.ts | 2 | `!BROWSER` | A×1, B×1 |
| layout/Tab.ts | 2 | `!BROWSER` | A×1, B×1 |
| layout/Model.ts | 2 | `!MOBILE` | A×1, B×1（类型定义） |
| layout/index.ts | 1 | `MOBILE` | B（运行时检查） |
| layout/tabUtil.ts | 1 | `!MOBILE` | A |
| layout/window-utils.ts | 4 | `!BROWSER`, `!MOBILE` | A×2, B×2 |
| layout/layout-serialization.ts | 2 | `!MOBILE` | A×1, B×1 |
| layout/layout-deserialization.layout.ts | 2 | `!MOBILE`, `BROWSER` | A×1, B×1（含阶段2函数级） |
| layout/getAll.ts | 2 | `!MOBILE`, `MOBILE` | D（阶段2已覆盖）, C×1 |
| layout/utils/addResize.ts | 1 | `!MOBILE` | A |
| layout/dock/util.ts | 2 | `!MOBILE` | A×1, B×1 |
| layout/dock/Inbox.ts | 4 | `!MOBILE`, `MOBILE` | A×1, B×1, C×2 |
| layout/dock/dock.init.ts | 1 | `!MOBILE` | A |
| layout/dock/dock.focus.ts | 2 | `!MOBILE` | A×1, B×1 |
| layout/dock/outline/Outline.sort.ts | 2 | `!MOBILE` | A×1, B×1 |
| layout/dock/outline/Outline.header.expand.ts | 2 | `!MOBILE` | A×1, B×1 |
| layout/dock/outline/Outline.contextMenu.edit.ts | 1 | `!MOBILE` | A |
| layout/dock/Files/dnd.onDragEnd.ts | 2 | `!BROWSER` | A×1, B×1 |

**小计**: 46次，20个文件

### 3.3 protyle/ 模块

| 文件 | `/// #if` 次数 | 条件标志 | 模式 |
|-----|--------------|---------|------|
| protyle/wysiwyg/index.ts | 18 | `!BROWSER`, `!MOBILE`, `BROWSER && !MOBILE`, `MOBILE` | A×2, B×14, C×2 |
| protyle/wysiwyg/transaction.ts | 4 | `!MOBILE`, `MOBILE` | A×1, B×2, C×1 |
| protyle/wysiwyg/keydown.ts | 3 | `!MOBILE`, `!BROWSER` | B×3 |
| protyle/wysiwyg/keydown.openBy.ts | 2 | `!BROWSER` | A×1, B×1 |
| protyle/wysiwyg/keydown.blockRef.ts | 1 | `!MOBILE` | B |
| protyle/wysiwyg/remove.ts | 1 | `!MOBILE` | B |
| protyle/wysiwyg/commonClick.ts | 2 | `!MOBILE` | A×1, B×1 |
| protyle/wysiwyg/commonHotkey/commonHotkey.ts | 1 | `!MOBILE` | B |
| protyle/util/compatibility.ts | 4 | `!BROWSER`, `MOBILE` | A×2, B×2（含阶段2函数级） |
| protyle/util/onGet.ts | 6 | `!MOBILE`, `MOBILE` | A×1, B×3, C×2 |
| protyle/util/paste.ts | 2 | `!BROWSER` | B×2 |
| protyle/util/resize.ts | 3 | `!MOBILE` | A×1, B×2 |
| protyle/util/reload.ts | 2 | `MOBILE` | A×1, B×1 |
| protyle/util/setEditMode.ts | 2 | `!MOBILE` | B×2 |
| protyle/util/selection.ts | 1 | `!MOBILE` | B |
| protyle/util/dnd/drag.ts | 1 | `!MOBILE` | A |
| protyle/util/dnd/onDrop.ts | 3 | `!MOBILE`, `!BROWSER` | A×2, B×1 |
| protyle/util/dnd/moveTo.helper.cleanup.ts | 3 | `!MOBILE` | A×1, B×2 |
| protyle/ui/dom.ts | 2 | `!MOBILE` | A×1, B×1 |
| protyle/ui/event.ts | 1 | `!MOBILE` | B |
| protyle/index.ts | 12 | `!MOBILE`, `MOBILE` | A×2, B×8, C×2 |
| protyle/header/Title.ts | 3 | `!MOBILE`, `MOBILE` | A×1, B×1, C×1 |
| protyle/header/openTitleMenu.ts | 7 | `!MOBILE`, `!BROWSER`, `MOBILE` | A×1, B×4, C×2 |
| protyle/header/Background.old.ts | 5 | `!MOBILE`, `MOBILE` | A×1, B×2, C×2 |
| protyle/header/background/image.ts | 1 | `MOBILE` | B |
| protyle/header/background/render.ts | 1 | `MOBILE` | B |
| protyle/header/background/tags.ts | 3 | `!MOBILE`, `MOBILE` | A×1, B×1, C×1 |
| protyle/hint/index.ts | 7 | `!MOBILE`, `MOBILE` | A×1, B×5, C×1 |
| protyle/toolbar/index.ts | 1 | `MOBILE` | B |
| protyle/toolbar/Font.ts | 1 | `!MOBILE` | B |
| protyle/toolbar/showWidget.ts | 1 | `!MOBILE` | B |
| protyle/toolbar/showTpl.ts | 1 | `!MOBILE` | B |
| protyle/toolbar/showTpl/showTpl.template.ts | 1 | `!BROWSER` | B |
| protyle/toolbar/showTpl/showTpl.handlers.ts | 2 | `!BROWSER` | A×1, B×1 |
| protyle/toolbar/showCodeLanguage.ts | 1 | `!MOBILE` | B |
| protyle/scroll/index.ts | 1 | `BROWSER` | B |
| protyle/preview/index.ts | 5 | `!BROWSER`, `!MOBILE` | A×2, B×3 |
| protyle/undo/index.ts | 1 | `!BROWSER` | B |
| protyle/render/av/openMenuPanel.ts | 2 | `!MOBILE` | A×1, B×1 |
| protyle/render/av/render.ts | 2 | `MOBILE` | A×1, B×1 |
| protyle/render/av/gallery/render.ts | 2 | `MOBILE` | A×1, B×1 |
| protyle/render/av/cell.ts | 1 | `MOBILE` | B |
| protyle/render/av/blockAttr.ts | 1 | `!BROWSER` | A |
| protyle/render/av/asset.ts | 2 | `!BROWSER`, `MOBILE` | B×2 |
| protyle/render/av/action.ts | 1 | `!MOBILE` | B |
| protyle/export/index.ts | 4 | `!BROWSER`, `BROWSER` | A×1, B×2, C×1（含阶段2函数级） |
| protyle/export/util.ts | 3 | `!BROWSER`, `MOBILE` | A×1, B×2 |
| protyle/gutter/buildGutterCommonMenu.ts | 4 | `!MOBILE`, `MOBILE` | A×1, B×2, C×1 |
| protyle/gutter/buildMultipleAppearanceMenu.ts | 1 | `MOBILE` | B |
| protyle/gutter/bindEvent.ts | 3 | `!MOBILE`, `MOBILE` | A×1, B×2 |
| protyle/breadcrumb/index.ts | 2 | `!MOBILE` | B×2 |
| protyle/breadcrumb/action.ts | 5 | `!MOBILE`, `MOBILE` | A×1, B×3, C×1（含阶段2函数级） |
| protyle/breadcrumb/breadcrumb.helpers.ts | 1 | `BROWSER && !MOBILE` | B |
| protyle/breadcrumb/breadcrumb.events.ts | 2 | `!MOBILE` | A×1, B×1 |
| protyle/breadcrumb/showBreadcrumbMenu.ts | 2 | `!MOBILE`, `MOBILE` | B×1, C×1 |
| protyle/breadcrumb/menuItems.ts | 3 | `!MOBILE` | A×1, B×2 |
| protyle/breadcrumb/menuItems.upload.ts | 3 | `!BROWSER`, `BROWSER` | A×1, B×1, C×1 |
| protyle/breadcrumb/menuItems.misc.ts | 1 | `!MOBILE` | B |

**小计**: ~140次，57个文件

### 3.4 index.ts（入口）

| 文件 | `/// #if` 次数 | 条件标志 | 模式 |
|-----|--------------|---------|------|
| index.ts | 3 | `BROWSER`, `BROWSER && !MOBILE` | A×1, B×2（含阶段2模块级语句） |

---

## 四、建议分批清理策略

### 批次1：低耦合工具模块（~37次，约16文件）
- **范围**: util/、sync/、emoji/、history/、card/、window/
- **风险**: 低
- **特点**: 多为简单的 `!MOBILE` / `MOBILE` 分支，改为 `if (isMobile)` 即可
- **预计工作量**: 1-2个子任务

### 批次2：配置与对话框模块（~55次，约13文件）
- **范围**: config/、dialog/
- **风险**: 低-中
- **特点**: `!BROWSER` 条件较多（Electron API 调用），需要使用适配层
- **预计工作量**: 2-3个子任务

### 批次3：编辑器与搜索模块（~35次，约15文件）
- **范围**: editor/、search/
- **风险**: 中
- **特点**: 涉及文件打开、搜索等核心交互
- **预计工作量**: 1-2个子任务

### 批次4：启动与插件模块（~67次，约17文件）
- **范围**: boot/、plugin/
- **风险**: 中
- **特点**: boot/globalEvent/commonHotkey.ts 单文件12处，集中处理效率高
- **预计工作量**: 2-3个子任务

### 批次5：菜单模块（~57次，约19文件）
- **范围**: menus/
- **风险**: 中-高
- **特点**: 文件数多但每个文件改动小，多为 `menu.fullscreen()` 等移动端适配
- **预计工作量**: 2-3个子任务

### 批次6：布局模块（~46次，约20文件）
- **范围**: layout/
- **风险**: 高
- **特点**: 大量 `getAllModels()` 调用依赖 `!MOBILE` 条件，需要确保移动端不触发桌面端布局逻辑
- **预计工作量**: 3-4个子任务

### 批次7：编辑器核心模块（~140次，约57文件）
- **范围**: protyle/
- **风险**: 最高
- **特点**: 文件最多、使用最密集，涉及编辑器核心交互。建议按子目录进一步拆分：
  - protyle/wysiwyg/ (~30次)
  - protyle/util/ (~25次)
  - protyle/header/ + protyle/breadcrumb/ (~25次)
  - protyle/hint/ + protyle/toolbar/ (~15次)
  - protyle/render/av/ (~10次)
  - protyle/export/ + protyle/gutter/ + protyle/其他 (~35次)
- **预计工作量**: 6-8个子任务

---

## 五、注意事项

1. **模式A（平台特定导入）属于阶段4范围**，本扫描仅记录位置，不在阶段3清理
2. **阶段2已覆盖的函数级（模式D）** 在本扫描中标注但不重复处理
3. **`plugin/index.ts` 中的类型定义条件编译**（模式E）需要特殊处理，参见规程 4.1.6
4. **`boot/globalEvent/commonHotkey.ts`** 单文件含12处 `!BROWSER` 条件，全部为 `ipcRenderer.send` 调用，适合使用适配层批量替换
5. **`protyle/wysiwyg/index.ts`** 是使用最密集的单文件（18处），需要特别谨慎
