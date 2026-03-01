# 拆分 render/av/filter.ts

创建时间: 2026-02-24T14:58Z
状态: 待执行
相关规程: `docs/规程/代码质量/超长文件拆分.procedure.md`

## 现状

| 指标 | 数值 |
|------|------|
| 当前行数 | 892 |
| 限制行数 | 300 |
| 超标倍数 | 3.0x |
| 优先级 | P2 |

## 文件结构分析

### 导出函数

| 函数 | 行范围 | 行数 | 说明 |
|------|--------|------|------|
| `getDefaultOperatorByType` | 18-28 | 11 | 根据列类型返回默认操作符 |
| `setFilter` | 75-670 | 596 | 设置过滤器（核心大函数，含菜单构建+事件绑定） |
| `addFilter` | 672-723 | 52 | 添加过滤器菜单 |
| `getFiltersHTML` | 725-891 | 167 | 生成过滤器面板HTML |

### 内部函数

| 函数 | 行范围 | 行数 | 说明 |
|------|--------|------|------|
| `toggleEmpty` | 30-59 | 30 | 切换空值操作符时显隐输入框 |
| `filterSelect` | 61-73 | 13 | 过滤select选项列表 |

### 功能块划分

1. **工具函数**（18-73）：`getDefaultOperatorByType` + `toggleEmpty` + `filterSelect` — 约56行
2. **setFilter核心**（75-670）：整个过滤器设置逻辑 — 约596行
   - 菜单回调/事务提交（89-202）：约114行
   - rollup类型预处理（206-282）：约77行
   - 操作符select HTML生成（283-359）：约77行
   - 菜单项构建（360-585）：约226行
   - 事件绑定+打开菜单（586-670）：约85行
3. **addFilter**（672-723）：添加过滤器 — 约52行
4. **getFiltersHTML**（725-891）：过滤器面板HTML生成 — 约167行

### 关键观察

- `setFilter` 是一个596行的巨型函数，是文件超长的主要原因
- `setFilter` 内部逻辑可按阶段拆分：操作符HTML生成、菜单项构建、事件绑定
- `getFiltersHTML` 内部的 `genFilterItem` 闭包函数约135行，也较长

## 拆分方案

遵循"从内向外"原则：将 `setFilter` 内部逻辑提取为独立函数。

### 拆分文件清单

| # | 文件名 | 来源 | 内容 | 预估行数 |
|---|--------|------|------|---------|
| 1 | `filter.ts` | 主文件 | `getDefaultOperatorByType` + `setFilter`骨架 + `addFilter` + 导入 | ~200 |
| 2 | `filter.operator.ts` | 提取 | 操作符select HTML生成（switch-case）+ `toggleEmpty` + `filterSelect` | ~180 |
| 3 | `filter.menu.ts` | 提取 | setFilter中的菜单项构建逻辑（select/text/relation/number/date各类型） | ~250 |
| 4 | `filter.render.ts` | 提取 | `getFiltersHTML` + 内部 `genFilterItem` | ~180 |

### 拆分后目录结构

```
app/src/protyle/render/av/
├── filter.ts                 ← 主文件（入口+骨架）
├── filter.operator.ts        ← 操作符HTML+工具函数
├── filter.menu.ts            ← 菜单项构建
├── filter.render.ts          ← 过滤器面板HTML
├── ... (已有文件不变)
```

### 导出模式

```typescript
// filter.operator.ts
export function getOperatorSelectHTML(type: TAVCol, operator: string): string { ... }
export function toggleEmpty(...) { ... }
export function filterSelect(...) { ... }

// filter.menu.ts
export function buildFilterMenuItems(menu: Menu, filterValue: IAVCellValue, colData: IAVColumn, ...) { ... }

// filter.render.ts
export function getFiltersHTML(data: IAV): string { ... }

// filter.ts 中导入并使用
import { getOperatorSelectHTML, toggleEmpty } from "./filter.operator";
import { buildFilterMenuItems } from "./filter.menu";
export { getFiltersHTML } from "./filter.render";
```

### 拆分顺序建议

1. 先提取 `filter.render.ts`（`getFiltersHTML` 最独立，167行）
2. 再提取 `filter.operator.ts`（操作符HTML生成 + 工具函数）
3. 再提取 `filter.menu.ts`（菜单项构建逻辑）
4. 最后精简 `filter.ts`

### 约束

- 不改变原文件的公共导出接口（`getDefaultOperatorByType`, `setFilter`, `addFilter`, `getFiltersHTML`）
- 不改变运行时行为
- 拆分后每个文件不超过300行
- 不在拆分过程中修复其他lint错误
- 不产生循环依赖

## 近期任务

- [ ] 创建 `filter.render.ts`，提取 getFiltersHTML
- [ ] 创建 `filter.operator.ts`，提取操作符HTML生成 + toggleEmpty + filterSelect
- [ ] 创建 `filter.menu.ts`，提取菜单项构建逻辑
- [ ] 精简 `filter.ts` 为入口骨架
- [ ] 构建验证（pnpm build 无新增错误）

## 失败记录

（暂无）
