# 拆分 openMenuPanel.ts

创建时间: 2026-02-23T13:03Z
状态: 待执行
相关规程: `docs/规程/代码质量/超长文件拆分.procedure.md`

## 现状

| 指标 | 数值 |
|------|------|
| 当前行数 | 1743 |
| 限制行数 | 300 |
| 超标倍数 | 5.8x |
| 优先级 | P0 |

## 文件结构分析

### 导出函数

| 函数 | 行范围 | 行数 | 说明 |
|------|--------|------|------|
| `openMenuPanel` | 64-1673 | 1610 | 主函数，属性视图菜单面板 |
| `getPropertiesHTML` | 1675-1741 | 67 | 属性列表HTML生成 |

### openMenuPanel 内部结构

| 逻辑块 | 行范围 | 行数 | 说明 |
|--------|--------|------|------|
| 初始化+fetchPost | 77-100 | 24 | 检查面板、获取数据 |
| HTML生成(type分支) | 101-153 | 53 | 根据type生成不同HTML |
| DOM插入+定位+绑定 | 155-225 | 71 | 面板插入DOM、定位、绑定类型事件 |
| 拖放事件 | 229-584 | 356 | dragstart/drop/dragover/dragleave/dragenter/dragend |
| mousedown事件 | 585-589 | 5 | 中键关闭面板 |
| **click事件** | **590-1671** | **1082** | **巨型if-else分发，核心拆分目标** |

### click事件handler分类 (590-1671)

#### 面板控制+导航 (~42行)
close, go-config, go-properties, go-layout

#### 排序 (~65行)
goSorts, removeSorts, addSort, removeSort

#### 过滤 (~81行)
goFilters, removeFilters, addFilter, removeFilter, setFilter

#### 列编辑 (~150行)
numberFormat, editCol, updateColType, goUpdateColType, goEditCol, update-icon

#### 列可见性 (~124行)
hideCol, showCol, showAllCol, hideAllCol

#### 列操作 (~112行)
newCol, duplicateCol, removeCol

#### 视图操作 (~106行)
update-view-icon, set-page-size, duplicate-view, delete-view, av-add, av-view-switch, av-view-edit

#### 单元格操作 (~146行)
setColOption, setRelationCell, addColOptionOrCell, removeCellOption, addAssetLink, addAssetExist, openAssetItem, editAssetItem, clearDate, updateRelation, goSearchAV, goSearchRollupCol, goSearchRollupTarget, goSearchRollupCalc

#### 分组 (~156行)
goGroupsDate, goGroupsSort, setGroupMethod, goGroups, goGroupsMethod, getGroupsNumber, hideGroup, hideGroups, removeGroups

#### 画廊/布局 (~41行)
set-gallery-cover, set-gallery-size, set-gallery-ratio, set-layout

### click handler闭包共享变量

所有click分支共享以下闭包变量，拆分时需作为参数传入：

- `options` (protyle, blockElement, type, colId, cellElements等)
- `data` (IAV, 可变)
- `fields` (IAVColumn[], 可变)
- `avID`, `blockID`, `isCustomAttr`
- `menuElement`, `avPanelElement`, `tabRect` (可变)
- `closeCB` (可变)

### drop handler内部分支 (234-536)

| 分支判断 | 行范围 | 行数 |
|----------|--------|------|
| removeSort拖拽排序 | 261-295 | 35 |
| removeFilter拖拽排序 | 297-331 | 35 |
| av-view-edit拖拽排序 | 332-354 | 23 |
| editAssetItem拖拽排序 | 355-378 | 24 |
| setColOption拖拽排序 | 379-426 | 48 |
| setRelationCell拖拽排序 | 427-453 | 27 |
| editCol拖拽排序 | 454-491 | 38 |
| hideGroup拖拽排序 | 492-535 | 44 |

## 拆分方案

遵循"从内向外"原则：提取click/drop handler内部逻辑为独立函数，主文件保留函数骨架和事件绑定。

### 共享上下文类型

定义 `IMenuPanelContext` 接口传递闭包变量：

```typescript
interface IMenuPanelContext {
    options: { protyle: IProtyle; blockElement: Element; ... };
    data: IAV;
    fields: IAVColumn[];
    avID: string;
    blockID: string;
    isCustomAttr: boolean;
    menuElement: HTMLElement;
    avPanelElement: Element;
    tabRect: DOMRect;
    closeCB?: () => void;
}
```

由于 `data`、`fields`、`tabRect`、`closeCB` 是可变的，context对象属性需可写。

### 拆分文件清单

| # | 文件名 | 来源 | 预估行数 |
|---|--------|------|---------|
| 1 | `openMenuPanel.ts` | 主文件骨架+getPropertiesHTML+context类型 | ~200 |
| 2 | `openMenuPanel.drag.ts` | 拖放事件(dragstart/drop/dragover/dragleave/dragenter/dragend) | ~290 |
| 3 | `openMenuPanel.click.sortsFilters.ts` | 排序+过滤click处理 | ~150 |
| 4 | `openMenuPanel.click.colEdit.ts` | 列编辑click处理 | ~155 |
| 5 | `openMenuPanel.click.colOps.ts` | 列操作+列可见性click处理 | ~240 |
| 6 | `openMenuPanel.click.view.ts` | 面板控制+导航+视图操作+画廊/布局 | ~195 |
| 7 | `openMenuPanel.click.cell.ts` | 单元格操作(选择/关联/资源/日期/汇总) | ~200 |
| 8 | `openMenuPanel.click.groups.ts` | 分组操作 | ~160 |

### 拆分后目录结构

```
app/src/protyle/render/av/
├── openMenuPanel.ts                      ← 主文件（骨架+getPropertiesHTML）
├── openMenuPanel.drag.ts                 ← 拖放事件
├── openMenuPanel.click.sortsFilters.ts   ← 排序+过滤
├── openMenuPanel.click.colEdit.ts        ← 列编辑
├── openMenuPanel.click.colOps.ts         ← 列操作+可见性
├── openMenuPanel.click.view.ts           ← 视图+画廊+面板控制
├── openMenuPanel.click.cell.ts           ← 单元格操作
├── openMenuPanel.click.groups.ts         ← 分组
├── ... (已有文件不变)
```

### 导出模式

每个拆分文件导出一个handler函数，接收context和event参数，返回boolean表示是否已处理：

```typescript
// openMenuPanel.click.sortsFilters.ts
export function handleSortsFiltersClick(
    ctx: IMenuPanelContext,
    type: string,
    target: HTMLElement,
    event: MouseEvent
): boolean { ... }

// openMenuPanel.ts 中click handler
avPanelElement.addEventListener("click", async (event) => {
    // ... 解析type/target
    while (...) {
        if (handleSortsFiltersClick(ctx, type, target, event)) break;
        if (handleColEditClick(ctx, type, target, event)) break;
        // ...
    }
});
```

### 拆分顺序建议

1. 先创建context类型定义（在主文件中）
2. 按独立性从高到低提取：
   - 第1批: `openMenuPanel.drag.ts`（完全独立的事件块）
   - 第2批: `openMenuPanel.click.groups.ts`（分组逻辑自成体系）
   - 第3批: `openMenuPanel.click.cell.ts`（单元格操作较独立）
   - 第4批: `openMenuPanel.click.sortsFilters.ts` + `openMenuPanel.click.view.ts`
   - 第5批: `openMenuPanel.click.colEdit.ts` + `openMenuPanel.click.colOps.ts`
3. 每批完成后构建验证

### 约束

- 不改变 `openMenuPanel` 和 `getPropertiesHTML` 的公共导出接口
- 不改变运行时行为
- 拆分后每个文件不超过300行
- 不在拆分过程中修复其他lint错误
- 不产生循环依赖

## 近期任务

- [x] 创建context类型（openMenuPanel.types.ts），提取 `openMenuPanel.drag.ts`
- [x] 提取 `openMenuPanel.click.sortsFilters.ts`
- [x] 修改主文件委托调用（drag事件块→bindDragEvents(ctx)，sorts/filters click→handleSortsFiltersClick委托）
- [ ] 提取 `openMenuPanel.click.groups.ts`
- [ ] 提取 `openMenuPanel.click.cell.ts`
- [ ] 提取 `openMenuPanel.click.view.ts`
- [ ] 提取 `openMenuPanel.click.colEdit.ts`
- [ ] 提取 `openMenuPanel.click.colOps.ts`
- [ ] 精简主文件为骨架
- [ ] 构建验证（pnpm build 无新增错误）

## 失败记录

### 子任务1（2026-02-23）— 文件创建完成，主文件修改未完成

**中止原因**：上下文占用过高（>50%），避免上下文污染导致工具调用失败

### 子任务2（2026-02-23）— 主文件委托调用替换完成

**完成内容**：
- 构造 `IMenuPanelContext` ctx 对象（233行）
- drag事件块（原233-588行，356行）→ `bindDragEvents(ctx)` 单行调用
- sorts/filters click分支（原9个else-if分支，146行）→ `handleSortsFiltersClick(ctx, type, target, event)` 委托
- 移除未使用import：`addFilter`, `setFilter`, `addSort`, `hasClosestByAttribute`
- 在 tabRect/closeCB/data/fields 重新赋值处同步到 ctx（5处）
- 主文件行数：1747→1255（减少492行）
- 构建验证通过（pnpm build exit code 0）

**无失败**
