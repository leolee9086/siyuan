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
- **滚动条**：复用 `useVirtualScrollbar`，实现 CAD 风格的极简细长滚动条。

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

### 4.2 侧边垂直布局自适应
使用 `writing-mode: vertical-lr` 或 `transform: rotate(-90deg)` 实现 CAD 风格的页签文字排列。

## 5. 开发步骤
1. [ ] **创建目录结构**：在 `app/src/sforge/panel/` 建立组件目录
2. [ ] **Dialog 创建逻辑**：实现 `SmartToolboxPanel.ts`，使用 `createVueDialog()` 创建对话框
3. [ ] **Vue 组件骨架**：实现 `SmartToolboxPanel.vue`，包含基本的面板结构
4. [ ] **样式校准**：编写 SCSS 定义 CAD 深色皮肤
5. [ ] **工具列表渲染**：实现 `ToolItem.vue`，从 `TriggerRegistry` 获取数据
6. [ ] **滚动优化**（可选）：引入 `VirtualMasonryGrid` 优化长列表性能
7. [ ] **快捷键注册**：注册全局快捷键打开工具箱

## 6. 当前进度

| 阶段 | 状态 | 备注 |
|------|------|------|
| 前置依赖（格式刷 MVP） | ✅ 已完成 | TriggerRegistry 基础设施已就绪 |
| Dialog 创建逻辑 | 🔲 待开始 | 下一步工作 |
| Vue 组件骨架 | 🔲 待开始 | - |
| CAD 风格样式 | 🔲 待开始 | - |
| 工具列表渲染 | 🔲 待开始 | - |
| 滚动优化 | 🔲 待开始 | 可选 |

---
*最后更新: 2026-01-17*

---
*关联设计方案: [[docs/智能工具箱设计方案.md]]*
