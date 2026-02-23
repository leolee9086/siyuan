# protyle/ 目录条件编译扫描结果

> **扫描时间**: 2026-02-20
> **扫描范围**: `app/src/protyle/`
> **总计**: 151 处 `/// #if` 使用点，分布在 38 个文件中，涉及 14 个子目录

---

## 按子目录分组统计

### 1. wysiwyg/ — 30 处（8 文件）

| 文件 | 次数 | 条件标志 | 模式A(electron导入) |
|------|------|---------|-------------------|
| index.ts | 16 | !BROWSER, !MOBILE, MOBILE, BROWSER&&!MOBILE | ✅ ipcRenderer |
| transaction.ts | 4 | !MOBILE, MOBILE | ❌ |
| keydown.ts | 3 | !MOBILE, !BROWSER | ❌ |
| keydown.openBy.ts | 2 | !BROWSER | ❌ |
| commonClick.ts | 2 | !MOBILE | ❌ |
| remove.ts | 1 | !MOBILE | ❌ |
| keydown.blockRef.ts | 1 | !MOBILE | ❌ |
| commonHotkey/commonHotkey.ts | 1 | !MOBILE | ❌ |

### 2. util/ — 27 处（10 文件）

| 文件 | 次数 | 条件标志 | 模式A(electron导入) |
|------|------|---------|-------------------|
| onGet.ts | 6 | !MOBILE, MOBILE | ❌ |
| compatibility.ts | 4 | !BROWSER, MOBILE | ✅ clipboard, ipcRenderer |
| resize.ts | 3 | !MOBILE | ❌ |
| dnd/onDrop.ts | 3 | !MOBILE, !BROWSER | ✅ webUtils |
| dnd/moveTo.helper.cleanup.ts | 3 | !MOBILE | ❌ |
| setEditMode.ts | 2 | !MOBILE | ❌ |
| paste.ts | 2 | !BROWSER | ❌ |
| reload.ts | 2 | MOBILE | ❌ |
| selection.ts | 1 | !MOBILE | ❌ |
| dnd/drag.ts | 1 | !MOBILE | ❌ |

### 3. header/ — 20 处（6 文件）

| 文件 | 次数 | 条件标志 | 模式A(electron导入) |
|------|------|---------|-------------------|
| openTitleMenu.ts | 7 | !MOBILE, MOBILE, !BROWSER | ❌ |
| Background.old.ts | 5 | !MOBILE, MOBILE | ❌ |
| Title.ts | 3 | !MOBILE, MOBILE | ❌ |
| background/tags.ts | 3 | !MOBILE, MOBILE | ❌ |
| background/render.ts | 1 | MOBILE | ❌ |
| background/image.ts | 1 | MOBILE | ❌ |

### 4. breadcrumb/ — 19 处（8 文件）

| 文件 | 次数 | 条件标志 | 模式A(electron导入) |
|------|------|---------|-------------------|
| action.ts | 5 | !MOBILE, MOBILE | ❌ |
| menuItems.ts | 3 | !MOBILE | ❌ |
| menuItems.upload.ts | 3 | !BROWSER, BROWSER | ✅ ipcRenderer |
| showBreadcrumbMenu.ts | 2 | !MOBILE, MOBILE | ❌ |
| index.ts | 2 | !MOBILE | ❌ |
| breadcrumb.events.ts | 2 | !MOBILE | ❌ |
| breadcrumb.helpers.ts | 1 | BROWSER&&!MOBILE | ❌ |
| menuItems.misc.ts | 1 | !MOBILE | ❌ |

### 5. render/av/ — 11 处（7 文件）

| 文件 | 次数 | 条件标志 | 模式A(electron导入) |
|------|------|---------|-------------------|
| asset.ts | 2 | !BROWSER, MOBILE | ❌ |
| render.ts | 2 | MOBILE | ❌ |
| openMenuPanel.ts | 2 | !MOBILE | ❌ |
| gallery/render.ts | 2 | MOBILE | ❌ |
| action.ts | 1 | !MOBILE | ❌ |
| cell.ts | 1 | MOBILE | ❌ |
| blockAttr.ts | 1 | !BROWSER | ✅ webUtils |

### 6. protyle 根目录 — 9 处（1 文件）

| 文件 | 次数 | 条件标志 | 模式A(electron导入) |
|------|------|---------|-------------------|
| index.ts | 9 | !MOBILE, MOBILE | ❌ |

### 7. gutter/ — 8 处（3 文件）

| 文件 | 次数 | 条件标志 | 模式A(electron导入) |
|------|------|---------|-------------------|
| buildGutterCommonMenu.ts | 4 | !MOBILE, MOBILE | ❌ |
| bindEvent.ts | 3 | !MOBILE, MOBILE | ❌ |
| buildMultipleAppearanceMenu.ts | 1 | MOBILE | ❌ |

### 8. toolbar/ — 8 处（7 文件）

| 文件 | 次数 | 条件标志 | 模式A(electron导入) |
|------|------|---------|-------------------|
| showTpl/showTpl.handlers.ts | 2 | !BROWSER | ❌ |
| showTpl/showTpl.template.ts | 1 | !BROWSER | ❌ |
| showWidget.ts | 1 | !MOBILE | ❌ |
| showTpl.ts | 1 | !MOBILE | ❌ |
| showCodeLanguage.ts | 1 | !MOBILE | ❌ |
| index.ts | 1 | MOBILE | ❌ |
| Font.ts | 1 | !MOBILE | ❌ |

### 9. hint/ — 6 处（1 文件）

| 文件 | 次数 | 条件标志 | 模式A(electron导入) |
|------|------|---------|-------------------|
| index.ts | 6 | !MOBILE, MOBILE | ❌ |

### 10. export/ — 6 处（2 文件）

| 文件 | 次数 | 条件标志 | 模式A(electron导入) |
|------|------|---------|-------------------|
| util.ts | 3 | !BROWSER, MOBILE | ❌ |
| index.ts | 3 | !BROWSER, BROWSER | ✅ ipcRenderer |

### 11. preview/ — 5 处（1 文件）

| 文件 | 次数 | 条件标志 | 模式A(electron导入) |
|------|------|---------|-------------------|
| index.ts | 5 | !BROWSER, !MOBILE | ✅ shell |

### 12. ui/ — 3 处（2 文件）

| 文件 | 次数 | 条件标志 | 模式A(electron导入) |
|------|------|---------|-------------------|
| dom.ts | 2 | !MOBILE | ❌ |
| event.ts | 1 | !MOBILE | ❌ |

### 13. scroll/ — 1 处（1 文件）

| 文件 | 次数 | 条件标志 | 模式A(electron导入) |
|------|------|---------|-------------------|
| index.ts | 1 | BROWSER | ❌ |

### 14. undo/ — 1 处（1 文件）

| 文件 | 次数 | 条件标志 | 模式A(electron导入) |
|------|------|---------|-------------------|
| index.ts | 1 | !BROWSER | ❌ |

---

## 条件标志使用分布

| 标志 | 大致占比 |
|------|---------|
| !MOBILE | ~55% |
| MOBILE | ~25% |
| !BROWSER | ~15% |
| BROWSER / BROWSER&&!MOBILE | ~5% |

---

## 涉及 electron 导入的文件（模式A，高风险）

共 7 个文件：
1. `wysiwyg/index.ts` — ipcRenderer
2. `util/compatibility.ts` — clipboard, ipcRenderer
3. `util/dnd/onDrop.ts` — webUtils
4. `render/av/blockAttr.ts` — webUtils
5. `breadcrumb/menuItems.upload.ts` — ipcRenderer
6. `export/index.ts` — ipcRenderer
7. `preview/index.ts` — shell

---

## 建议拆分方案

按子目录拆分为独立子任务，按复杂度从低到高排序：

| 批次 | 子目录 | 使用点数 | 文件数 | 含模式A | 建议优先级 |
|------|--------|---------|--------|---------|-----------|
| 1 | scroll/, undo/ | 2 | 2 | ❌ | 最低风险，先行验证 |
| 2 | ui/ | 3 | 2 | ❌ | 低风险 |
| 3 | toolbar/ | 8 | 7 | ❌ | 低风险，文件多但每文件改动少 |
| 4 | hint/ | 6 | 1 | ❌ | 中风险，单文件集中 |
| 5 | gutter/ | 8 | 3 | ❌ | 中风险 |
| 6 | render/av/ | 11 | 7 | ✅ blockAttr.ts | 中风险 |
| 7 | header/ | 20 | 6 | ❌ | 中高风险，改动量大 |
| 8 | breadcrumb/ | 19 | 8 | ✅ menuItems.upload.ts | 中高风险 |
| 9 | export/, preview/ | 11 | 3 | ✅ 两文件 | 高风险，electron依赖多 |
| 10 | protyle/index.ts | 9 | 1 | ❌ | 高风险，核心入口文件 |
| 11 | util/ | 27 | 10 | ✅ 三文件 | 高风险，基础工具层 |
| 12 | wysiwyg/ | 30 | 8 | ✅ index.ts | 最高风险，核心编辑器 |

总计 12 个批次，建议每批次作为一个独立子任务。
