# 拆分 cell.ts

创建时间: 2026-02-24T10:52Z
状态: 待执行
相关规程: `docs/规程/代码质量/超长文件拆分.procedure.md`

## 现状

| 指标 | 数值 |
|------|------|
| 当前行数 | 1255 |
| 限制行数 | 300 |
| 超标倍数 | 4.2x |
| 优先级 | P1 |

## 文件结构分析

### 导出函数

| 函数 | 行范围 | 行数 | 说明 |
|------|--------|------|------|
| `getCellText` | 47-68 | 22 | 获取单元格文本 |
| `genCellValueByElement` | 70-148 | 79 | 从DOM元素生成单元格值 |
| `genCellValue` | 248-396 | 149 | 从类型和值生成单元格值 |
| `cellScrollIntoView` | 399-477 | 79 | 单元格滚动到可见区域 |
| `getTypeByCellElement` | 479-488 | 10 | 获取单元格类型 |
| `popTextCell` | 490-667 | 178 | 弹出文本编辑单元格 |
| `updateCellsValue` | 722-926 | 205 | 更新单元格值（最大导出函数） |
| `renderCellAttr` | 928-945 | 18 | 渲染单元格属性 |
| `renderCell` | 947-1047 | 101 | 渲染单元格HTML |
| `updateHeaderCell` | 1092-1114 | 23 | 更新表头单元格 |
| `getPositionByCellElement` | 1116-1135 | 20 | 获取单元格位置 |
| `dragFillCellsValue` | 1137-1206 | 70 | 拖拽填充单元格值 |
| `addDragFill` | 1208-1220 | 13 | 添加拖拽填充标记 |
| `cellValueIsEmpty` | 1222-1254 | 33 | 判断单元格值是否为空 |

### 内部函数

| 函数 | 行范围 | 行数 | 说明 |
|------|--------|------|------|
| `renderCellURL` | 27-45 | 19 | 渲染URL单元格HTML |
| `getCellValueContent` | 150-172 | 23 | 获取单元格值的文本内容 |
| `transformCellValue` | 174-246 | 73 | 转换单元格值到目标类型 |
| `updateCellValueByInput` | 669-720 | 52 | 通过输入框更新单元格值 |

### 功能块划分

| 功能块 | 包含函数 | 总行数 |
|--------|----------|--------|
| 值生成与转换 | genCellValueByElement, genCellValue, getCellValueContent, transformCellValue, cellValueIsEmpty | ~290 |
| 渲染 | renderCellURL, renderCell, renderRollup, renderCellAttr, getCellText | ~240 |
| 编辑交互 | popTextCell, updateCellValueByInput | ~230 |
| 更新操作 | updateCellsValue | ~205 |
| 位置与拖拽 | cellScrollIntoView, getTypeByCellElement, getPositionByCellElement, dragFillCellsValue, addDragFill, updateHeaderCell | ~170 |

## 拆分方案

遵循"从内向外"原则：按功能块提取函数到独立文件，主文件保留所有公共导出并委托调用。

### 拆分文件清单

| # | 文件名 | 来源 | 预估行数 |
|---|--------|------|---------|
| 1 | `cell.ts` | 主文件骨架（保留所有导出签名，委托调用） | ~120 |
| 2 | `cell.render.ts` | renderCellURL, getCellText, renderCell, renderRollup, renderCellAttr | ~240 |
| 3 | `cell.value.ts` | genCellValueByElement, genCellValue, getCellValueContent, transformCellValue, cellValueIsEmpty | ~290 |
| 4 | `cell.edit.ts` | popTextCell, updateCellValueByInput | ~230 |
| 5 | `cell.update.ts` | updateCellsValue | ~220 |
| 6 | `cell.position.ts` | cellScrollIntoView, getTypeByCellElement, getPositionByCellElement, updateHeaderCell, dragFillCellsValue, addDragFill | ~170 |

### 拆分后目录结构

```
app/src/protyle/render/av/
├── cell.ts              ← 主文件（导出骨架+重导出）
├── cell.render.ts       ← 渲染相关
├── cell.value.ts        ← 值生成与转换
├── cell.edit.ts         ← 编辑交互
├── cell.update.ts       ← 更新操作
├── cell.position.ts     ← 位置与拖拽
├── ... (已有文件不变)
```

### 依赖关系

- `cell.render.ts` ← 被 cell.update.ts, cell.position.ts 使用（renderCell, renderCellAttr）
- `cell.value.ts` ← 被 cell.update.ts, cell.edit.ts, cell.position.ts 使用（genCellValue, genCellValueByElement 等）
- `cell.edit.ts` → 依赖 cell.value.ts（updateCellValueByInput 调用 updateCellsValue）
- `cell.update.ts` → 依赖 cell.value.ts, cell.render.ts
- `cell.position.ts` → 依赖 cell.render.ts, cell.value.ts
- 无循环依赖

### 拆分顺序建议

1. 第1批: `cell.render.ts`（纯渲染函数，无外部依赖）
2. 第2批: `cell.value.ts`（值处理函数，仅依赖外部库）
3. 第3批: `cell.position.ts`（位置和拖拽，依赖前两个）
4. 第4批: `cell.update.ts`（核心更新逻辑）
5. 第5批: `cell.edit.ts`（编辑交互，依赖 updateCellsValue）
6. 精简主文件为重导出骨架
7. 构建验证

### 约束

- 不改变原文件的14个公共导出接口
- 不改变运行时行为
- 拆分后每个文件不超过300行
- 不在拆分过程中修复其他lint错误
- 不产生循环依赖

## 近期任务

- [ ] 提取 `cell.render.ts`
- [ ] 提取 `cell.value.ts`
- [ ] 提取 `cell.position.ts`
- [ ] 提取 `cell.update.ts`
- [ ] 提取 `cell.edit.ts`
- [ ] 精简主文件为重导出骨架
- [ ] 构建验证（pnpm build 无新增错误）

## 失败记录

（暂无）
