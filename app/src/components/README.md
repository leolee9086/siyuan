# 思源笔记 通用 UI 组件模块

`app/src/components` 目录包含了思源笔记中使用的 Vue 3 组件，涵盖了业务专用组件（如 AI 聊天界面、PDF 查看器）以及可复用的基础 UI 单元。

## 目录结构与功能说明

### 1. 业务组件
- **[StreamChat.panel.vue](file:///d:/dev/siyuan-note/app/src/components/StreamChat.panel.vue)** & **[AIResponseDisplay.vue](file:///d:/dev/siyuan-note/app/src/components/AIResponseDisplay.vue)**
  AI 聊天功能的 UI 实现。支持 Markdown 渲染、代码高亮、打字机动画效果及停止/重试等交互。
- **[PDFviewer.vue](file:///d:/dev/siyuan-note/app/src/components/PDFviewer.vue)**
  内置的 PDF 文件查看器组件。
- **[ParameterControl.vue](file:///d:/dev/siyuan-note/app/src/components/ParameterControl.vue)**
  提供参数调节（如滑块、开关等）的通用逻辑，常用于 AI 模型的参数配置。

### 2. 基础与组合
- **[common/](file:///d:/dev/siyuan-note/app/src/components/common/)**
  存放跨模块复用的原子级组件。
- **[composables/](file:///d:/dev/siyuan-note/app/src/components/composables/)**
  包含模块化的 Vue 组合式函数（Composables），用于处理跨组件的共享逻辑（如窗口尺寸监听、权限校验）。
- **[masonry/](file:///d:/dev/siyuan-note/app/src/components/masonry/)**
  瀑布流布局组件库，常用于资产管理器或卡片视图。
- **[panels/](file:///d:/dev/siyuan-note/app/src/components/panels/)**
  定义了标准化的侧边栏或浮动面板容器。

---

## 技术规范
- **框架**: 使用 Vue 3 (Composition API)。
- **样式**: 以 Scoped CSS 为主，部分依赖全局 `index.css` 中定义的 Design Tokens。
- **TypeScript**: 所有的组件均应导定义接口（`.types.ts`），并尽可能使用 `defineProps` 宏的类型定义。

## 注意事项
- 在 Non-Vue 环境下（如 Protyle 核心逻辑）调用这些组件时，应使用包装器（Wrapper）或 `createVueDialog` 等工具函数。
