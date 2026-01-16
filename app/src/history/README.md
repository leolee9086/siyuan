# 思源笔记 History (历史版本) 模块

`app/src/history` 目录实现了思源笔记的文档历史版本管理、差异对比（Diff）及快照恢复功能。

## 目录结构与功能说明

### 1. 核心视图
- **[history.ts](file:///d:/dev/siyuan-note/app/src/history/history.ts)**
  历史版本管理界面的主逻辑。负责展示版本列表、时间轴分段预览。
- **[doc.ts](file:///d:/dev/siyuan-note/app/src/history/doc.ts)**
  管理历史文档内容的渲染与切换逻辑。

### 2. 对比与技术
- **[diff.ts](file:///d:/dev/siyuan-note/app/src/history/diff.ts)**
  文档差异对比算法的实现。支持对 Markdown 内容进行高亮对比，标识出新增、删除与修改的部分。

---

## 注意事项
- 历史记录是通过内核（Kernel）的快照机制获取的，前端主要负责 JSON/Markdown 数据的 Diff 渲染。
- 由于历史版本内容可能较大，渲染时应注意内存占用，避免同时加载过多的大型版本预览。
