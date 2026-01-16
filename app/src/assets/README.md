# 思源笔记 静态资源与样式模板

`app/src/assets` 目录存放应用程序所需的静态媒体文件、全局样式定义（SCSS）及基础模板。

## 目录结构与功能说明

### 1. 媒体资源
- **图标文件**: 包含各平台通用的图标（`icon.png`, `icon.svg`）及各机型特有的适配图标（`icon-mac.png`, `icon.icns`）。
- **加载动画**: `loading-pure.svg` 等全局共用的视觉反馈组件。

### 2. 样式系统
- **[scss/](file:///d:/dev/siyuan-note/app/src/assets/scss/)**
  包含思源笔记所有的样式源文件。
  - 定义了主题变量、基础组件样式及布局约束。

### 3. 模板
- **[template/](file:///d:/dev/siyuan-note/app/src/assets/template/)**
  存放一些静态的内容模板，可能用于新文档初始化或特定的导出场景。

---

## 注意事项
- 本目录下的 `.scss` 文件在编译阶段会被处理并输出到最终的 CSS 包中，修改变量后需确保持久化样式的一致性。
- 所有的 SVG 图标建议通过 `dom.ts` 中的符号链接（Symbol）方式进行引用，以减少重复载入。
