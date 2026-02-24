# 拆分方案：MobileOutline.ts (975行)

> 文件路径：`app/src/mobile/dock/MobileOutline.ts`
> 相关规程：`docs/规程/代码质量/超长文件拆分.procedure.md`

## 文件结构分析

| 行范围 | 方法 | 行数 | 可见性 | 职责 |
|--------|------|------|--------|------|
| 1-22 | imports | 22 | - | 导入 |
| 24-30 | 类属性 | 7 | public/private | 状态字段 |
| 31-205 | constructor | 175 | - | 初始化UI、事件绑定、Tree创建 |
| 207-238 | setCurrent() | 32 | public | 设置当前高亮标题 |
| 240-255 | setCurrentByPreview() | 16 | public | 预览模式设置当前标题 |
| 257-280 | setCurrentById() | 24 | private | 按ID设置当前标题 |
| 282-312 | update() | 31 | public | 更新大纲数据 |
| 314-327 | saveExpendIds() | 14 | public | 保存展开状态 |
| 332-404 | setFilter() | 73 | private | 筛选大纲 |
| 411-413 | getHeadingLevel() | 3 | private | 获取标题级别 |
| 419-442 | expandToLevel() | 24 | private | 展开到指定级别 |
| 447-460 | showExpandLevelMenu() | 14 | private | 展开层级菜单 |
| 465-491 | collapseSameLevel() | 27 | private | 折叠同级标题 |
| 493-514 | collapseChildren() | 22 | private | 折叠子标题 |
| 516-562 | onTransaction() | 47 | private | 处理WebSocket事务 |
| 567-920 | showContextMenu() | 354 | private | 右键菜单（极长，主要瓶颈） |
| 922-934 | getProtyleAndBlockElement() | 13 | private | 获取protyle和block元素 |
| 939-973 | genHeadingTransform() | 35 | private | 生成标题转换菜单项 |

## 核心问题

- `showContextMenu()` 占354行，是文件超长的主因
- `constructor` 175行，包含UI模板和多个事件绑定
- 类方法总数多，但多数方法较短

## 拆分方案

### 目标文件结构

```
app/src/mobile/dock/
├── MobileOutline.ts              ← 主文件：类定义、核心方法 (~300行)
├── MobileOutline.contextMenu.ts  ← showContextMenu + genHeadingTransform (~250行)
├── MobileOutline.filter.ts       ← setFilter + expandToLevel + showExpandLevelMenu (~120行)
└── MobileOutline.collapse.ts     ← collapseSameLevel + collapseChildren (~60行，可合并到filter)
```

考虑到collapse文件过小，合并方案：

```
app/src/mobile/dock/
├── MobileOutline.ts              ← 主文件 (~300行)
├── MobileOutline.contextMenu.ts  ← 右键菜单相关 (~280行)
└── MobileOutline.expand.ts       ← 筛选+展开+折叠 (~180行)
```

### 拆分细节

1. `MobileOutline.contextMenu.ts` (~280行)
   - showContextMenu() 提取为独立函数，接收必要的类实例引用
   - genHeadingTransform() 
   - getProtyleAndBlockElement()

2. `MobileOutline.expand.ts` (~180行)
   - setFilter()
   - getHeadingLevel()
   - expandToLevel()
   - showExpandLevelMenu()
   - collapseSameLevel()
   - collapseChildren()

3. `MobileOutline.ts` (~300行)
   - 类定义、属性
   - constructor（从拆分文件导入方法并绑定）
   - setCurrent(), setCurrentByPreview(), setCurrentById()
   - update(), saveExpendIds()
   - onTransaction()

### 拆分顺序

1. 先提取contextMenu相关到 `MobileOutline.contextMenu.ts`（最大块）
2. 再提取expand/filter相关到 `MobileOutline.expand.ts`
3. 最后调整主文件

## 注意事项

- 桌面端已有 `Outline.contextMenu.edit.ts` 等拆分先例，可参考命名
- 提取的函数需要接收 `this` 相关参数（tree、element、blockId等）

## 完成标志

- 三个文件均不超过300行
- `MobileOutline` 类导出签名不变
- 构建通过
