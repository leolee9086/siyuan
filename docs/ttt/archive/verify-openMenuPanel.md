# openMenuPanel 拆分校验报告

## 校验范围
- 原始文件: `openMenuPanel.ts.backup` (1753行)
- 拆分后文件: 10个模块文件

## 一、Click 分支覆盖校验

### 原始文件 click type 分支清单 vs 拆分归属

| type值 | 原始行号 | 拆分文件 | 状态 |
|--------|---------|---------|------|
| close | 602 | openMenuPanel.ts (主文件内联) | ✅ |
| go-config | 619 | click.view.ts | ✅ |
| go-properties | 627 | click.view.ts | ✅ |
| go-layout | 636 | click.view.ts | ✅ |
| goSorts | 644 | click.sortsFilters.ts | ✅ |
| removeSorts | 652 | click.sortsFilters.ts | ✅ |
| addSort | 671 | click.sortsFilters.ts | ✅ |
| removeSort | 684 | click.sortsFilters.ts | ✅ |
| goFilters | 709 | click.sortsFilters.ts | ✅ |
| removeFilters | 716 | click.sortsFilters.ts | ✅ |
| addFilter | 735 | click.sortsFilters.ts | ✅ |
| removeFilter | 748 | click.sortsFilters.ts | ✅ |
| setFilter | 773 | click.sortsFilters.ts | ✅ |
| numberFormat | 790 | click.colEdit.ts | ✅ |
| newCol | 802 | click.colOps.ts | ✅ |
| update-view-icon | 814 | click.view.ts | ✅ |
| set-page-size | 839 | click.view.ts | ✅ |
| duplicate-view | 849 | click.view.ts | ✅ |
| delete-view | 867 | click.view.ts | ✅ |
| update-icon | 878 | click.colEdit.ts | ✅ |
| showAllCol | 910 | click.colOps.ts | ✅ |
| hideAllCol | 940 | click.colOps.ts | ✅ |
| editCol | 970 | click.colEdit.ts | ✅ |
| updateColType | 982 | click.colEdit.ts | ✅ |
| goUpdateColType | 1063 | click.colEdit.ts | ✅ |
| goSearchAV | 1073 | click.cell.ts | ✅ |
| goSearchRollupCol | 1078 | click.cell.ts | ✅ |
| goSearchRollupTarget | 1089 | click.cell.ts | ✅ |
| goSearchRollupCalc | 1100 | click.cell.ts | ✅ |
| updateRelation | 1109 | click.cell.ts | ✅ |
| goEditCol | 1120 | click.colEdit.ts | ✅ |
| hideCol | 1130 | click.colOps.ts | ✅ |
| showCol | 1162 | click.colOps.ts | ✅ |
| duplicateCol | 1194 | click.colOps.ts | ✅ |
| removeCol | 1205 | click.colOps.ts | ✅ |
| setColOption | 1294 | click.cell.ts | ✅ |
| setRelationCell | 1299 | click.cell.ts | ✅ |
| addColOptionOrCell | 1306 | click.cell.ts | ✅ |
| removeCellOption | 1318 | click.cell.ts | ✅ |
| addAssetLink | 1323 | click.cell.ts | ✅ |
| addAssetExist | 1328 | click.cell.ts | ✅ |
| openAssetItem | 1361 | click.cell.ts | ✅ |
| editAssetItem | 1388 | click.cell.ts | ✅ |
| clearDate | 1402 | click.cell.ts | ✅ |
| av-add | 1420 | click.view.ts | ✅ |
| av-view-switch | 1427 | click.view.ts | ✅ |
| av-view-edit | 1446 | click.view.ts | ✅ |
| set-gallery-cover | 1477 | click.view.ts | ✅ |
| set-gallery-size | 1487 | click.view.ts | ✅ |
| set-gallery-ratio | 1497 | click.view.ts | ✅ |
| set-layout | 1507 | click.view.ts | ✅ |
| goGroupsDate | 1518 | click.groups.ts | ✅ |
| goGroupsSort | 1530 | click.groups.ts | ✅ |
| setGroupMethod | 1542 | click.groups.ts | ✅ |
| goGroups | 1553 | click.groups.ts | ✅ |
| goGroupsMethod | 1573 | click.groups.ts | ✅ |
| getGroupsNumber | 1580 | click.groups.ts | ✅ |
| hideGroup | 1593 | click.groups.ts | ✅ |
| hideGroups | 1629 | click.groups.ts | ✅ |
| removeGroups | 1655 | click.groups.ts | ✅ |

**共计 58 个 click type 分支，全部已覆盖，无遗漏。**

## 二、Drag 事件处理器校验

### 原始文件 drag 事件 (行230-585)

| 事件 | 原始行号 | 拆分文件 | 状态 |
|------|---------|---------|------|
| dragstart | 230 | drag.ts:16 | ✅ |
| drop - removeSort | 262 | drag.ts:48 | ✅ |
| drop - removeFilter | 298 | drag.ts:84 | ✅ |
| drop - av-view-edit | 333 | drag.ts:119 | ✅ |
| drop - editAssetItem | 356 | drag.ts:142 | ✅ |
| drop - setColOption | 380 | drag.ts:166 | ✅ |
| drop - setRelationCell | 428 | drag.ts:214 | ✅ |
| drop - editCol | 455 | drag.ts:241 | ✅ |
| drop - hideGroup | 493 | drag.ts:279 | ✅ |
| dragover | 539 | drag.ts:325 | ✅ |
| dragleave | 568 | drag.ts:354 | ✅ |
| dragenter | 576 | drag.ts:362 | ✅ |
| dragend | 580 | drag.ts:366 | ✅ |

**所有 drag 事件处理器完整迁移，无遗漏。**

## 三、共享变量同步逻辑校验

### IMenuPanelContext 接口 (openMenuPanel.types.ts)

原始文件中的闭包变量与 ctx 字段对应关系：

| 原始闭包变量 | ctx字段 | 可变性 | 同步方式 | 状态 |
|-------------|---------|--------|---------|------|
| data | ctx.data | 可变(let) | 对象引用共享 | ✅ |
| fields | ctx.fields | 可变(let) | 对象引用共享 | ✅ |
| tabRect | ctx.tabRect | 可变(let) | 对象引用共享 | ✅ |
| closeCB | ctx.closeCB | 可变(let) | 对象引用共享 | ✅ |
| avID | ctx.avID | 不变(const) | 值传递 | ✅ |
| blockID | ctx.blockID | 不变(const) | 值传递 | ✅ |
| isCustomAttr | ctx.isCustomAttr | 不变(const) | 值传递 | ✅ |
| menuElement | ctx.menuElement | 不变(const) | 引用传递 | ✅ |
| avPanelElement | ctx.avPanelElement | 不变(const) | 引用传递 | ✅ |
| options | ctx.options | 不变(const) | 引用传递 | ✅ |

关键同步点验证：
- `data` 在 `set-layout` 分支中被重新赋值 → click.view.ts 中 `ctx.data = await updateLayout(...)` ✅
- `fields` 在 `set-layout`/`goGroupsDate`/`goGroupsSort` 中被重新赋值 → 对应文件中 `ctx.fields = getFieldsByData(ctx.data)` ✅
- `tabRect` 在 `go-properties` 中被重新计算 → click.view.ts 中 `ctx.tabRect = viewsEl.getBoundingClientRect()` ✅
- `closeCB` 在 `goGroups` 中被清除、在 `getGroupsNumber` 中被赋值 → click.groups.ts 中 `delete ctx.closeCB` 和 `ctx.closeCB = bindGroupsNumber(...)` ✅
- `closeCB` 在 `close` 分支中被调用 → 主文件中 `closeCB?.()` ✅

**注意**: 主文件中 `closeCB` 是局部 `let` 变量，而 ctx 中是属性。主文件 close 分支直接使用局部 `closeCB` 变量而非 `ctx.closeCB`。这意味着如果子模块通过 `ctx.closeCB` 修改了回调，主文件的 close 分支不会感知到变化。

**⚠️ 发现问题 1: closeCB 同步断裂**

原始代码中 `closeCB` 是一个 `let` 变量，所有分支共享同一个闭包引用。拆分后：
- 主文件 close 分支使用的是局部 `closeCB` 变量（行224: `closeCB?.()`)
- click.groups.ts 中 `handleGoGroups` 通过 `ctx.closeCB` 操作
- click.groups.ts 中 `handleGetGroupsNumber` 通过 `ctx.closeCB` 赋值

但主文件构造 ctx 时（行196-199）将 `closeCB` 传入了 ctx，之后 close 分支使用的仍是局部变量 `closeCB`，而非 `ctx.closeCB`。当 groups 模块修改 `ctx.closeCB` 时，主文件的局部 `closeCB` 不会同步更新。

## 四、行为差异校验

### 4.1 isMobile 调用方式差异

- 原始文件 (行158): `isMobile()` — 函数调用
- 拆分主文件 (行12导入, 行124使用): `isMobile` — 属性访问（从 `../../../platform` 导入）

原始文件从 `../../../util/functions` 导入 `isMobile` 作为函数调用，拆分后从 `../../../platform` 导入作为属性。这可能是项目重构中的有意变更（platform模块导出的是getter属性而非函数），需确认两者行为一致。

**⚠️ 发现问题 2: isMobile 调用方式变更**

原始文件 `util/functions.ts` 中 `isMobile` 是函数（运行时DOM检查 `!!document.getElementById("sidebar")`），
`platform/index.ts` 中是布尔常量（构建时平台检测）。两者语义不同，但在此场景下可能是项目整体迁移的一部分，需确认。

### 4.2 update-icon 分支行为差异

**⚠️ 发现问题 3: update-icon 中 target.dataset.icon 赋值遗漏**

原始代码（行878-906）：
```js
(unicode) => {
    // ... transaction ...
    target.innerHTML = ...;
    if (isCustomAttr) {
        // ... update iconElement ...
    } else {
        updateAttrViewCellAnimation(..., undefined, { icon: unicode });
    }
    target.dataset.icon = unicode;  // ← 始终执行
}
```

拆分后 `applyColIcon`（click.colEdit.ts 行45-67）：
```js
if (ctx.isCustomAttr) {
    applyCustomAttrIcon(blockElement, colId, unicode);
    return;  // ← 提前返回，跳过了 target.dataset.icon = unicode
}
// ...
target.dataset.icon = unicode;  // ← 仅在非 isCustomAttr 时执行
```

**影响**: 当 `isCustomAttr` 为 true 时，`target.dataset.icon` 不会被更新，导致后续再次点击图标时 undo 数据不正确。

**⚠️ 发现问题 4: updateAttrViewCellAnimation 第二参数变更**

- 原始代码（行903）: `updateAttrViewCellAnimation(..., undefined, { icon: unicode })`
- 拆分后（click.colEdit.ts 行64）: `updateAttrViewCellAnimation(cellEl, { type: "text" }, { icon: unicode })`

第二参数从 `undefined` 变为 `{ type: "text" }`，可能影响动画行为。

### 4.3 openAssetItem 条件编译变更

原始代码使用 `/// #if !MOBILE` 条件编译：
```js
/// #if !MOBILE
openAsset(...)
/// #endif
```

拆分后使用运行时 `isMobile` 检查：
```js
if (!isMobile && isLocalPath(assetLink) && ...) {
    openAsset(...)
}
```

这是条件编译到运行时检查的迁移，可能是项目整体重构的一部分。但需注意 `openAsset` 在移动端构建中可能不存在（tree-shaking），而运行时检查会保留该导入。

### 4.4 window.siyuan.menus.menu.remove() 替换

多处原始代码中的 `window.siyuan.menus.menu.remove()` 被替换为 `removeSiyuanMenu()`。
经确认 `removeSiyuanMenu` 实现为 `window.siyuan?.menus?.menu?.remove()`，增加了可选链保护，行为兼容。✅

### 4.5 openAssetItem 移动端分支合并

原始代码中移动端和桌面端有独立的 `/// #if !MOBILE` / `/// #else` / `/// #endif` 分支，两者对 `image` 类型的处理相同（都调用 `previewAttrViewImages`），对非图片类型桌面端有 `openAsset` 逻辑而移动端直接 `window.open`。

拆分后合并为统一的运行时逻辑：先处理 image，再用 `!isMobile` 判断是否走 `openAsset`，最后 fallback 到 `openInNewWindow`。逻辑等价，但依赖运行时 `isMobile` 而非编译时条件。

## 五、getPropertiesHTML 校验

原始文件（行1685-1751）的 `getPropertiesHTML` 函数已完整迁移到 `openMenuPanel.properties.ts`。

对比结果：
- 列项HTML结构一致 ✅
- 隐藏列区域HTML一致 ✅
- 整体面板结构一致 ✅
- 使用 `for...of` 替代 `forEach`，行为等价 ✅

## 六、结论

### 校验通过的部分
1. **所有58个 click type 分支** 均已在拆分文件中找到对应实现
2. **所有13个 drag 事件处理器** 完整迁移
3. **getPropertiesHTML** 函数完整迁移
4. **IMenuPanelContext 接口** 正确封装了所有共享变量
5. **主文件初始化逻辑**（fetchPost回调、HTML构建、bind事件）与原始一致
6. **click 事件分发链** 的 while 循环结构和 break 语义正确保留

### 需要修复的问题

| # | 严重度 | 问题 | 影响 |
|---|--------|------|------|
| 1 | **高** | closeCB 同步断裂：主文件 close 分支使用局部 `closeCB` 变量，而 groups 模块通过 `ctx.closeCB` 修改，两者不同步 | 关闭面板时可能不执行 groups 模块设置的 closeCB |
| 2 | **低** | isMobile 从函数调用变为布尔常量（不同模块导入） | 可能是项目整体迁移，需确认 |
| 3 | **中** | update-icon 中 isCustomAttr 为 true 时提前 return，跳过了 `target.dataset.icon = unicode` | 自定义属性视图中重复修改图标时 undo 数据错误 |
| 4 | **中** | updateAttrViewCellAnimation 第二参数从 `undefined` 变为 `{ type: "text" }` | 可能影响动画行为 |

### 最终判定：**需要修复**

问题1（closeCB同步）和问题3（icon赋值遗漏）是确定的逻辑错误，需要修复。
问题2和问题4需要进一步确认是否为有意变更。
