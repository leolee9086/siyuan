# 智能工具箱 MVP 阶段 2：CAD 风格工具面板实现方案

## 1. 目标概述
本阶段旨在基于 AutoCAD 工具选项板（Tools Palette）的视觉风格，构建智能工具箱的前端界面。核心要求是**极致的紧凑性**和**支撑超长列表的虚拟滚动能力**。

## 2. 视觉规格 (CAD-Inspired Aesthetics)
- **配色方案**：
    - 背景色：`#2D3139` (深灰色工业风)
    - 页签背景：`#21252B`
    - 强调色（鼠标悬停）：`#3E4451`
    - 文字颜色：`#D7DAE0` (次要文字使用 `#9DA5B4`)
- **布局结构**：
    - **左侧页签栏**：宽度 ~32px，垂直排列文字或图标。
    - **主内容区**：垂直滚动列表，支持分组标题。
    - **图标规格**：16x16px 或 24x24px 矢量图标。

## 3. 技术架构：复用与集成

### 3.1 虚拟滚动复用
我们将直接复用 `components/masonry` 目录下的核心算法：
- **容器**：使用 `VirtualMasonryGrid` 组件。
- **模式**：配置 `mode="list"` 以实现单列垂直列表。
- **高度管理**：由于工具行高度固定（约 28px-32px），可直接传入固定 `itemHeight` 优化初次渲染速度。
- **滚动条**：复用 `useVirtualScrollbar`，实现 CAD 风格的极简细长滚动条。

### 3.2 组件拆解
- `SmartToolboxPanel.vue`: 主控容器，负责监听全局上下文并从 `TriggerRegistry` 获取可用工具。
- `VerticalTabs.vue`: 左侧垂直导航，实现分类切换逻辑。
- `ToolListView.vue`: 封装 `VirtualMasonryGrid`，处理工具的分层渲染。
- `ToolItem.vue`: 单个工具原子组件。

## 4. 关键实现点

### 4.1 数据适配层
需要将 `TriggerRegistry` 中的扁平触发器列表转化为具备分类层级的数据结构：
```typescript
interface IToolGroup {
    category: string;
    triggers: ITriggerRegistration[];
}
```

### 4.2 侧边垂直布局自适应
使用 `writing-mode: vertical-lr` 或 `transform: rotate(-90deg)` 实现 CAD 风格的页签文字排列。

## 5. 开发步骤
1. [ ] **基础框架**：在 `app/src/protyle/ui/smartToolbox/` 建立 Vue 组件骨架。
2. [ ] **样式校准**：编写 CSS 定义 CAD 深色皮肤。
3. [ ] **滚动集成**：引入 `VirtualMasonryGrid` 并配置 list 模式。
4. [ ] **数据对接**：连接 `TriggerRegistry.matchTriggers()`，实现随上下文动态刷新列表。

---
*关联设计方案: [[docs/智能工具箱设计方案.md]]*
