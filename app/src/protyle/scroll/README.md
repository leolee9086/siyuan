# Protyle Scroll (滚动管理) 模块

`app/src/protyle/scroll` 目录负责管理编辑器的滚动行为、同步滚动以及滚动位置的标记与跳转。

## 目录结构与功能说明

- **[index.ts](file:///d:/dev/siyuan-note/app/src/protyle/scroll/index.ts)**
  管理核心滚动区域的事件监听与高度计算。支持多窗口/分屏模式下的同步滚动逻辑。

---

## 注意事项
- 由于 Protyle 采用虚拟渲染或大量 DOM 片段，滚动高度的精确计算对于光标定位至关重要。
