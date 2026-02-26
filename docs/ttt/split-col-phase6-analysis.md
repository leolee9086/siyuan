# col.ts 当前状态分析（Phase 6 准备）

> 分析时间: 2026-02-25
> 文件: `app/src/protyle/render/av/col.ts`
> 总行数: **401**

## 1. Import 语句

- 行范围: L1–L20
- 占用行数: **20**

## 2. 各公共函数行范围与行数

| 函数名 | 起始行 | 结束行 | 行数 | 导出 |
|--------|--------|--------|------|------|
| `getColId` | 22 | 28 | 7 | ✅ export |
| `getEditHTML` | 31 | 120 | 90 | ✅ export |
| `bindEditEvent` | 122 | 167 | 46 | ✅ export |
| `showColMenu` | 170 | 399 | 230 | ✅ export |

- 空行/间隔: L29-30, L168-169, L400-401 共 **8** 行

## 3. 超过50行函数的内部复杂度评估

### `getEditHTML`（90行）

| 逻辑块 | 行范围 | 说明 |
|--------|--------|------|
| colData 查找 | L37–L43 | 从 data 中查找列数据 |
| 主面板 HTML | L44–L73 | 构建编辑面板第一屏（emoji、名称输入、描述、类型选择器） |
| 类型特定 HTML | L74 | 委托 `getTypeSpecificEditHTML` |
| 操作按钮 | L75–L91 | wrap 开关 + duplicate/delete 按钮 |
| 第二面板（类型列表） | L92–L119 | 列类型更新选项列表 |

可提取块:
- 第二面板类型列表（L92–L119）可独立为 `genTypeUpdatePanel()` 函数

### `showColMenu`（230行，最大函数）

| 逻辑块 | 行范围 | 行数 | 说明 |
|--------|--------|------|------|
| 变量提取 | L170–L178 | 9 | 从 DOM 提取 colId/avID/blockID 等 |
| Menu 创建 + 关闭回调 | L180–L182 | 3 | 创建 Menu 实例 |
| 表头标签 + 编辑项 | L183–L210 | 28 | header label 绑定 + edit 菜单项 |
| 筛选/排序项 | L211–L239 | 29 | filter/asc/desc（lineNumber 条件排除） |
| 固定列项 | L240–L261 | 22 | pin/unpin toggle |
| 隐藏列项 | L262–L283 | 22 | hide column（block 类型排除） |
| 同步列宽项 | L284–L295 | 12 | syncColWidth |
| 换行开关项 | L296–L322 | 27 | wrap toggle with event binding |
| 插入列项 | L323–L357 | 35 | insertColumnLeft / insertColumnRight |
| 复制/删除项 | L358–L387 | 30 | duplicate + delete（条件排除） |
| 打开菜单 + 聚焦 | L388–L398 | 11 | menu.open + input focus |

可提取块:
- 筛选/排序菜单项（L211–L239）→ `addFilterSortItems()`
- 固定/隐藏菜单项（L240–L283）→ `addVisibilityItems()`
- 换行开关项（L296–L322）→ `addWrapToggleItem()`
- 插入列项（L323–L357）→ `addInsertColumnItems()`
- 复制/删除项（L358–L387）→ `addDuplicateDeleteItems()`

## 4. 潜在问题

`showColMenu` 内部调用了 `addCol`（来自 `col.addCol.ts`）和 `duplicateCol`（来自 `col.operations.ts`），但 col.ts 的 import 区域（L1–L20）中**未找到对应的 import 语句**。这可能是遗漏或通过其他机制引入，需在 Phase 6 拆分前确认。

## 5. 拆分建议摘要

当前 col.ts 共 401 行，目标 ≤300 行。`showColMenu`（230行）是最大函数，占全文件 57%。

最小化拆分方案：将 `showColMenu` 中的菜单项构建逻辑提取到 `col.showColMenu.items.ts`（如果尚未存在相关拆分），或将 `showColMenu` 整体移至独立模块，col.ts 仅保留 `getColId` + `getEditHTML` + `bindEditEvent`（共 143 行 + 20 行 import ≈ 163 行）。
