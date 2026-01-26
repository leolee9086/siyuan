# 智能工具箱 MVP 阶段 2：工具面板实现方案

## 1. 目标概述
本阶段旨在构建智能工具箱的前端界面。核心要求是**紧凑的布局**和**流畅的滚动体验**。

## 2. 视觉规格
工具箱面板使用思源笔记原生 CSS 变量，确保与应用整体风格协调：
- **背景**：`var(--b3-theme-background)` / `var(--b3-theme-surface)`
- **文字**：`var(--b3-theme-on-background)` / `var(--b3-theme-on-surface-light)`
- **悬停**：`var(--b3-list-hover)`
- **边框**：`var(--b3-border-color)`
- **布局结构**：
    - **左侧页签栏**（可选）：宽度 ~32px，垂直排列图标
    - **主内容区**：垂直滚动列表，支持分组标题
    - **图标规格**：使用思源内置图标系统，16x16px 或 20x20px

## 3. 技术架构：基于 Dialog 模块

### 3.1 Dialog 系统集成
工具箱面板将复用思源现有的 Dialog 系统：
- **创建方式**：使用 `createVueDialog()` 工具函数创建对话框
- **Vue 组件**：在对话框内挂载 Vue 组件实现复杂交互
- **参考实现**：`AssetMasonryDialog.vue` (素材选择器)

### 3.2 虚拟滚动复用
我们将直接复用 `components/masonry` 目录下的核心算法：
- **容器**：使用 `VirtualMasonryGrid` 组件。
- **模式**：配置 `mode="list"` 以实现单列垂直列表。
- **高度管理**：由于工具行高度固定（约 28px-32px），可直接传入固定 `itemHeight` 优化初次渲染速度。
- **滚动条**：复用 `useVirtualScrollbar`，实现极简细长滚动条。

### 3.3 组件拆解
| 组件 | 位置 | 职责 |
|------|-----|------|
| `SmartToolboxPanel.vue` | `app/src/sforge/panel/` | 主控容器，监听上下文，获取可用工具 |
| `SmartToolboxPanel.ts` | `app/src/sforge/panel/` | Dialog 创建逻辑 |
| `ToolItem.vue` | `app/src/sforge/panel/` | 单个工具原子组件 |

### 3.4 打开方式
- **快捷键**：注册全局快捷键（待定，如 `Ctrl+Shift+T`）
- **菜单入口**：通过顶栏或右键菜单触发
- **编程接口**：导出 `打开智能工具箱()` 函数

## 4. 关键实现点

### 4.1 数据适配层
需要将 `TriggerRegistry` 中的扁平触发器列表转化为具备分类层级的数据结构：
```typescript
interface IToolGroup {
    category: string;
    triggers: ITriggerRegistration[];
}
```

### 4.2 工具分组展示
根据工具的 `category` 字段进行分组，每个分组有可折叠的标题。

## 5. 开发步骤
1. [x] **创建目录结构**：在 `app/src/sforge/panel/` 建立组件目录
2. [x] **Dialog 创建逻辑**：实现 `SmartToolboxPanel.ts`，使用 `createVueDialog()` 创建对话框
3. [x] **Vue 组件骨架**：实现 `SmartToolboxPanel.vue`，包含基本的面板结构
4. [x] **样式校准**：使用思源原生 CSS 变量定义面板样式
5. [x] **工具列表渲染**：实现 `ToolItem.vue`，从 `TriggerRegistry` 获取数据
6. [ ] **滚动优化**（可选）：引入 `VirtualMasonryGrid` 优化长列表性能

## 6. 当前进度

| 阶段 | 状态 | 备注 |
|------|------|------|
| 前置依赖（格式刷 MVP） | ✅ 已完成 | TriggerRegistry 基础设施已就绪 |
| Dialog 创建逻辑 | ✅ 已完成 | `SmartToolboxPanel.ts` |
| Vue 组件骨架 | ✅ 已完成 | `SmartToolboxPanel.vue` |
| 原生样式适配 | ✅ 已完成 | 使用 CSS 变量 |
| 工具列表渲染 | ✅ 已完成 | `ToolItem.vue` |
| 滚动优化 | 🔲 待开始 | 可选 |

---
*最后更新: 2026-01-17*

---
*关联设计方案: [[docs/智能工具箱设计方案.md]]*
