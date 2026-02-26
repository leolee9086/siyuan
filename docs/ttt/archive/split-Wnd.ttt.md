# 拆分 Wnd.ts

创建时间: 2026-02-24T10:57Z
状态: 待执行
相关规程: `docs/规程/代码质量/超长文件拆分.procedure.md`

## 现状

| 指标 | 数值 |
|------|------|
| 当前行数 | 1089 |
| 限制行数 | 300 |
| 超标倍数 | 3.6x |
| 优先级 | P1 |

## 文件结构分析

### 类: Wnd (60-1089)

| 成员 | 行范围 | 行数 | 可见性 | 说明 |
|------|--------|------|--------|------|
| 属性定义 | 61-67 | 7 | mixed | app, id, parent, element, headersElement, children, resize |
| **constructor** | **69-424** | **356** | **public** | **DOM创建+大量事件绑定（核心拆分目标）** |
| isPointWithinLines | 426-433 | 8 | private | 几何辅助函数 |
| updateDragElement | 435-463 | 29 | private | 拖拽位置计算 |
| showHeading | 465-475 | 11 | public | 滚动到当前标签 |
| switchTab | 477-582 | 106 | public | 切换标签页 |
| addTab | 584-658 | 75 | public | 添加标签页 |
| renderTabList | 662-720 | 59 | private | 渲染标签列表菜单 |
| removeOverCounter | 722-748 | 27 | private | 移除超出数量的标签 |
| destroyModel | 751-779 | 29 | private | 销毁模型 |
| removeTabAction | 782-893 | 112 | private | 移除标签核心逻辑（箭头函数） |
| removeTab | 895-911 | 17 | public | 移除标签入口 |
| moveTab | 913-988 | 76 | public | 移动标签到当前窗口 |
| split | 990-1042 | 53 | public | 分割窗口 |
| remove | 1044-1087 | 44 | private | 移除窗口 |

### constructor 内部事件绑定 (69-424)

| 事件 | 行范围 | 行数 | 说明 |
|------|--------|------|------|
| DOM创建 | 69-96 | 28 | 创建元素、设置innerHTML |
| mousedown(headers) | 97-132 | 36 | 中键关闭标签 |
| mousewheel(headers) | 133-135 | 3 | 横向滚动 |
| click(headers parent) | 137-160 | 24 | 新建/更多/切换标签 |
| dblclick(headers parent) | 161-170 | 10 | 双击取消临时标签 |
| **dragover(headers parent)** | **171-243** | **73** | **标签拖拽排序** |
| **drop(headers parent)** | **244-318** | **75** | **标签拖拽放置** |
| dragenter(element) | 320-333 | 14 | 面板拖入 |
| dragleave(element) | 335-341 | 7 | 面板拖离 |
| dragover(dragElement) | 342-351 | 10 | 拖拽指示器更新 |
| dragleave(dragElement) | 353-356 | 4 | 拖拽指示器隐藏 |
| **drop(dragElement)** | **358-423** | **66** | **面板拖拽分割/移动** |

## 拆分方案

遵循"从内向外"原则：提取constructor中的事件处理器和类方法到独立文件，主文件保留类定义和方法骨架。

### 拆分文件清单

| # | 文件名 | 来源 | 预估行数 |
|---|--------|------|---------|
| 1 | `Wnd.ts` | 主文件（类定义+constructor骨架+showHeading+split+remove） | ~250 |
| 2 | `Wnd.drag.ts` | constructor中所有拖拽事件+isPointWithinLines+updateDragElement | ~290 |
| 3 | `Wnd.tab.ts` | switchTab+addTab+renderTabList+removeOverCounter | ~270 |
| 4 | `Wnd.tabAction.ts` | destroyModel+removeTabAction+removeTab+moveTab | ~250 |

### 拆分后目录结构

```
app/src/layout/
├── Wnd.ts              ← 主文件（类定义+骨架）
├── Wnd.drag.ts         ← 拖拽事件处理
├── Wnd.tab.ts          ← 标签页切换/添加/列表
├── Wnd.tabAction.ts    ← 标签页移除/移动/销毁
├── ... (已有文件不变)
```

### 导出模式

拆分文件导出独立函数，接收Wnd实例或必要参数：

```typescript
// Wnd.drag.ts
export function bindHeaderDragEvents(wnd: Wnd, app: App): void { ... }
export function bindPanelDragEvents(wnd: Wnd, app: App, dragElement: HTMLElement): void { ... }

// Wnd.tab.ts
export function switchTab(wnd: Wnd, target: HTMLElement, ...): void { ... }
export function addTab(wnd: Wnd, tab: Tab, ...): void { ... }

// Wnd.ts constructor中
constructor(app: App, ...) {
    // DOM创建 + 小事件
    bindHeaderDragEvents(this, app);
    bindPanelDragEvents(this, app, dragElement);
}
```

### 依赖关系

- `Wnd.drag.ts` → 依赖 Wnd 类型（仅类型引用，不产生循环）
- `Wnd.tab.ts` → 依赖 Wnd 类型
- `Wnd.tabAction.ts` → 依赖 Wnd 类型、Wnd.tab.ts（switchTab）
- 无循环依赖（拆分文件仅通过参数接收Wnd实例）

### 拆分顺序建议

1. 第1批: `Wnd.drag.ts`（constructor中最大的独立块，拖拽事件）
2. 第2批: `Wnd.tab.ts`（标签页管理方法）
3. 第3批: `Wnd.tabAction.ts`（标签页生命周期方法）
4. 精简主文件为骨架
5. 构建验证

### 约束

- 不改变 Wnd 类的公共接口
- 不改变运行时行为
- 拆分后每个文件不超过300行
- 不在拆分过程中修复其他lint错误
- 不产生循环依赖

## 近期任务

- [ ] 提取 `Wnd.drag.ts`
- [ ] 提取 `Wnd.tab.ts`
- [ ] 提取 `Wnd.tabAction.ts`
- [ ] 精简主文件为骨架
- [ ] 构建验证（pnpm build 无新增错误）

## 失败记录

（暂无）
