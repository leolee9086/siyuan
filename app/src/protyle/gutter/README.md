# Protyle Gutter (块标记栏) 模块

`app/src/protyle/gutter` 目录负责编辑器左侧的块标记栏（Gutter）显示，包括块拖拽柄、状态图标及快捷菜单。

## 目录结构与功能说明

- **[index.ts](file:///d:/dev/siyuan-note/app/src/protyle/gutter/index.ts)**
  管理 Gutter 的渲染位置计算。它会根据鼠标移动实时定位到当前所在的块左侧。
- 处理块的拖拽排序起点定义。

---

## 注意事项
- Gutter 的性能敏感度较高，因为它会随鼠标频繁移动。
