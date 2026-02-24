# 拆分方案：MobileFiles.ts (768行)

> 文件路径：`app/src/mobile/dock/MobileFiles.ts`
> 相关规程：`docs/规程/代码质量/超长文件拆分.procedure.md`
> 状态：✅ 已完成 (2026-02-24)

## 文件结构分析

| 行范围 | 方法 | 行数 | 可见性 | 职责 |
|--------|------|------|--------|------|
| 1-16 | imports | 16 | - | 导入 |
| 18-22 | 类属性 | 5 | public/private | 状态字段 |
| 23-244 | constructor | 222 | - | 初始化UI+事件绑定（极长） |
| 246-267 | genSort() | 22 | private | 排序菜单 |
| 269-298 | updateItemArrow() | 30 | private | 更新箭头状态 |
| 300-329 | genNotebook() | 30 | private | 生成笔记本HTML |
| 331-370 | init() | 40 | public | 初始化文件树 |
| 372-417 | onMove() | 46 | private | 处理移动事件 |
| 419-480 | onRemove() | 62 | private | 处理删除事件 |
| 482-489 | onRename() | 8 | public | 处理重命名 |
| 491-531 | onMount() | 41 | private | 处理挂载事件 |
| 533-574 | onLsHTML() | 42 | private | 渲染文件列表HTML |
| 576-619 | onLsSelect() | 44 | private | 选择文件列表 |
| 621-634 | setCurrent() | 14 | public | 设置当前选中 |
| 636-662 | getLeaf() | 27 | public | 获取子节点 |
| 664-709 | selectItem() | 46 | public | 选择文件项 |
| 711-744 | getOpenPaths() | 34 | private | 获取展开路径 |
| 746-767 | genFileHTML() | 22 | private | 生成文件HTML |

## 核心问题

- `constructor` 占222行，是文件超长的主因，包含HTML模板和大量click事件委托
- WebSocket消息处理（msgCallback）在constructor内定义，包含多个case分支
- 方法数量多但单个方法较短，除constructor外无超长方法

## 拆分方案

### 目标文件结构

```
app/src/mobile/dock/
├── MobileFiles.ts              ← 主文件：类定义、核心方法 (~300行)
├── MobileFiles.event.ts        ← constructor中的click事件处理 (~200行)
└── MobileFiles.ws.ts           ← WebSocket消息处理：onMove, onRemove, onMount等 (~270行)
```

### 拆分细节

1. `MobileFiles.ws.ts` (~270行)
   - onMove()
   - onRemove()
   - onMount()
   - onRename()
   - updateItemArrow()
   - genNotebook()（被ws处理和init共用）

2. `MobileFiles.event.ts` (~200行)
   - constructor中click事件委托的各分支处理逻辑
   - genSort()

3. `MobileFiles.ts` (~300行)
   - 类定义、属性
   - constructor（精简后，从拆分文件导入事件处理和ws处理）
   - init()
   - onLsHTML(), onLsSelect()
   - setCurrent(), getLeaf(), selectItem()
   - getOpenPaths(), genFileHTML()

### 拆分顺序

1. 先提取ws消息处理到 `MobileFiles.ws.ts`（最独立）
2. 再提取click事件到 `MobileFiles.event.ts`
3. 最后精简constructor

## 完成标志

- 三个文件均不超过300行
- `MobileFiles` 类导出签名不变
- 构建通过

## 实际结果

| 文件 | 行数 |
|------|------|
| `MobileFiles.ts` | 277 |
| `MobileFiles.ws.ts` | 271 |
| `MobileFiles.event.ts` | 189 |
| `MobileFiles.render.ts` | 130 |

- 比原方案多拆出 `MobileFiles.render.ts`（含 `onLsHTML`, `onLsSelect`, `genFileHTML`），因两个文件拆分后主文件仍有 385 行
- `closeElement` 从 `private` 改为 `public` 以供拆分文件访问
- `pnpm build` exit code 0，四个 webpack target 均编译成功
