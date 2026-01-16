# 思源笔记 Util (通用工具) 模块

`app/src/util` 目录是思源笔记最底层的工具库，提供了网络请求、DOM 操作、数据处理、环境适配以及各种算法支持。

## 目录结构与功能说明

### 1. 通讯与网络
- **[fetch.ts](file:///d:/dev/siyuan-note/app/src/util/fetch.ts)** & **[fetchStream.ts](file:///d:/dev/siyuan-note/app/src/util/fetchStream.ts)**
  封装了标准的 HTTP 请求及流式请求逻辑，处理 CSRF、身份认证及全局错误提示。
- **[processMessage.ts](file:///d:/dev/siyuan-note/app/src/util/processMessage.ts)**
  负责处理与内核（Kernel）之间的 WebSocket 消息同步。

### 2. UI 与 DOM 辅助
- **[DOM/](file:///d:/dev/siyuan-note/app/src/util/DOM/)**
  包含对 DOM 元素的深度操作，如光标处理（Selection/Range）、高度计算、动画效果等。
- **[setPosition.ts](file:///d:/dev/siyuan-note/app/src/util/setPosition.ts)**
  智能弹出层定位算法，确保菜单或浮窗不会超出屏幕边界。
- **[vue/](file:///d:/dev/siyuan-note/app/src/util/vue/)**
  Vue 3 的集成抽象层，支持在传统类代码中挂载 Vue 组件。

### 3. 环境与适配
- **[siyuanEnvironments/](file:///d:/dev/siyuan-note/app/src/util/siyuanEnvironments/)**
  差异化环境适配。封装了 Desktop、Mobile、Browser 等不同环境下的路径处理、剪贴板访问及系统 API 调用。
- **[pinyin.ts](file:///d:/dev/siyuan-note/app/src/util/pinyin.ts)**
  汉字转拼音工具，用于搜索增强及列表排序。

### 4. 数据结构与算法
- **[Tree.ts](file:///d:/dev/siyuan-note/app/src/util/Tree.ts)**: 树形结构数据处理逻辑。
- **[pathName.ts](file:///d:/dev/siyuan-note/app/src/util/pathName.ts)**: 实现思源特有的路径字符串（`/folder/doc`）解析与合并。
- **[genID.ts](file:///d:/dev/siyuan-note/app/src/util/genID.ts)**: 核心的 ID 生成算法（符合思源 ID 规范）。

---

## 注意事项
- 本目录下的代码被整个应用广泛引用，修改时必须保证 **向下兼容性** 且不应引入过重的外部依赖。
- 所有的副作用操作（如直接操作 DOM）应尽可能在 `DOM/` 子目录中进行封装。
