# P2 文件拆分校验报告

## 校验时间
2026-02-24

## 1. render.ts

### 原始文件结构 (901行)
- 接口: `IIds`, `ITableOptions`
- 函数: `genTabHeaderHTML`(导出), `getTableHTMLs`(私有), `getGroupTitleHTML`(导出), `renderGroupTable`(私有), `afterRenderTable`(私有), `avRender`(导出), `updateSearch`(导出), `refreshTimeouts`(私有), `getAVElements`(私有), `getViewIDByAVElement`(私有), `refreshAV`(导出)

### 拆分覆盖情况
| 函数/接口 | 目标文件 | 状态 |
|-----------|----------|------|
| IIds | render.table.ts | ✅ |
| ITableOptions | render.table.ts | ✅ (改为导出) |
| genTabHeaderHTML | render.ts | ✅ |
| getTableHTMLs | render.table.ts | ✅ (改为导出) |
| getGroupTitleHTML | render.table.ts | ✅ (导出) |
| renderGroupTable | render.table.ts | ✅ (改为导出) |
| afterRenderTable | render.table.ts | ✅ (改为导出) |
| avRender | render.ts | ✅ |
| updateSearch | render.ts | ✅ |
| refreshTimeouts | render.refresh.ts | ✅ |
| getAVElements | render.refresh.ts | ✅ |
| getViewIDByAVElement | render.refresh.ts | ✅ |
| refreshAV | render.refresh.ts | ✅ |

### 条件编译迁移
- 原始 `/// #if MOBILE` + `activeBlur()` → 运行时检查 `if (isMobile)` (render.table.ts:366)
- `isMobile` 导入源从 `../../../util/functions` 改为 `../../../platform` ✅

### 发现的问题
- **BUG** render.table.ts:366 — `if (isMobile)` 缺少函数调用括号，应为 `if (isMobile())`。`isMobile` 是函数，不加括号永远为 truthy。对比 render.ts:106 正确写法 `if (isMobile() || isInMobileApp())`。

### 结论: ⚠️ 有问题（1个BUG）

---

## 2. filter.ts

### 原始文件结构 (891行)
- 函数: `getDefaultOperatorByType`(导出), `toggleEmpty`(私有), `filterSelect`(私有), `setFilter`(导出), `addFilter`(导出), `getFiltersHTML`(导出)

### 拆分覆盖情况
| 函数 | 目标文件 | 状态 |
|------|----------|------|
| getDefaultOperatorByType | filter.ts | ✅ |
| toggleEmpty | filter.operator.ts | ✅ (改为导出) |
| filterSelect | filter.operator.ts | ✅ (改为导出) |
| setFilter | filter.ts | ✅ |
| addFilter | filter.ts | ✅ |
| getFiltersHTML | filter.render.ts | ✅ |
| (新增) getOperatorSelectHTML | filter.operator.ts | ✅ 从 switch-case 提取 |
| (新增) getCheckboxSelectHTML | filter.operator.ts | ✅ 从 switch-case 提取 |
| (新增) resolveRollupFilterValue | filter.operator.ts | ✅ 从 setFilter 提取 |
| (新增) buildFilterMenuItems | filter.menu.ts | ✅ 从 setFilter 提取 |
| (新增) bindFilterMenuEvents | filter.menu.ts | ✅ 从 setFilter 提取 |

### 发现的问题
- **冗余** filter.menu.ts:233-262 — `bindFilterMenuEvents` 内部重新定义了 `toggleEmpty` 局部函数，与 filter.operator.ts 中导出的 `toggleEmpty` 逻辑完全重复。功能正确但代码冗余。

### 结论: ✅ 通过（有冗余但无功能问题）

---

## 3. selection.ts

### 原始文件结构 (804行)
- 函数: `selectIsEditor`(私有), `fixTableRange`(导出), `selectAll`(导出), `getRangeByPoint`(导出), `getEditorRange`(导出), `getSelectionPosition`(导出), `getSelectionOffset`(导出), `setLastNodeRange`(导出), `setFirstNodeRange`(导出), `focusByOffset`(导出), `setInsertWbrHTML`(导出), `focusByWbr`(导出), `focusByRange`(导出), `focusToolbarRange`(导出), `focusBlock`(导出), `focusSideBlock`(导出)

### 拆分覆盖情况
| 函数 | 目标文件 | 状态 |
|------|----------|------|
| selectIsEditor | selection.ts | ✅ |
| fixTableRange | selection.ts | ✅ |
| selectAll | selection.ts | ✅ |
| getRangeByPoint | selection.ts | ✅ |
| getEditorRange | selection.ts | ✅ |
| getSelectionOffset | selection.ts | ✅ |
| getSelectionPosition | selection.position.ts | ✅ |
| setLastNodeRange | selection.range.ts | ✅ |
| setFirstNodeRange | selection.range.ts | ✅ |
| focusByOffset | selection.range.ts | ✅ |
| setInsertWbrHTML | selection.range.ts | ✅ |
| focusByWbr | selection.range.ts | ✅ |
| focusByRange | selection.focus.ts | ✅ |
| focusToolbarRange | selection.focus.ts | ✅ |
| focusBlock | selection.focus.ts | ✅ |
| focusSideBlock | selection.focus.ts | ✅ |

### 重导出检查
selection.ts:237-241 正确重导出了所有拆分出去的符号，保持了对外API兼容。

### 发现的问题
- **额外内容** selection.focus.ts:40 — 新增了 `聚焦工具栏范围` 别名导出（`focusToolbarRange` 的中文别名），原始文件中不存在。不影响功能。

### 结论: ✅ 通过

---

## 4. keyboardToolbar.ts

### 原始文件结构 (783行)
- 函数: `getSlashItem`(私有), `renderTextMenu`(导出), `renderSlashMenu`(私有), `showKeyboardToolbarUtil`(导出), `showKeyboardToolbar`(导出), `hideKeyboardToolbar`(导出), `activeBlur`(导出), `initKeyboardToolbar`(导出)
- 变量: `renderKeyboardToolbarTimeout`(私有), `showUtil`(私有)

### 拆分覆盖情况
| 函数/变量 | 目标文件 | 状态 |
|-----------|----------|------|
| getSlashItem | keyboardToolbar.menu.ts | ✅ |
| renderTextMenu | keyboardToolbar.menu.ts | ✅ |
| renderSlashMenu | keyboardToolbar.menu.ts | ✅ (改为导出) |
| KEYBOARD_TOOLBAR_HTML | keyboardToolbar.menu.ts | ✅ (从 initKeyboardToolbar 提取) |
| showKeyboardToolbarUtil | keyboardToolbar.ts | ✅ |
| showKeyboardToolbar | keyboardToolbar.ts | ✅ |
| hideKeyboardToolbar | keyboardToolbar.ts | ✅ |
| activeBlur | keyboardToolbar.ts | ✅ |
| initKeyboardToolbar | keyboardToolbar.ts | ✅ |
| handleToolbarClick | keyboardToolbar.action.ts | ✅ (从 initKeyboardToolbar 提取) |
| renderKeyboardToolbarTimeout | keyboardToolbar.ts | ✅ |
| showUtil | keyboardToolbar.ts | ✅ |

### 重导出检查
keyboardToolbar.ts:13 — `export {renderTextMenu} from "./keyboardToolbar.menu"` ✅

### 结论: ✅ 通过

---

## 总结

| 文件 | 结论 | 问题数 |
|------|------|--------|
| render.ts | ⚠️ 有问题 | 1 BUG |
| filter.ts | ✅ 通过 | 0 (1冗余) |
| selection.ts | ✅ 通过 | 0 |
| keyboardToolbar.ts | ✅ 通过 | 0 |

### 需修复
1. `render.table.ts:366` — `if (isMobile)` → `if (isMobile())`
