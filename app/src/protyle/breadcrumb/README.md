# Protyle Breadcrumb (面包屑) 模块

`app/src/protyle/breadcrumb` 目录负责编辑器顶部的面包屑导航条的渲染与交互。

## 目录结构与功能说明

- **[index.ts](file:///d:/dev/siyuan-note/app/src/protyle/breadcrumb/index.ts)**
  管理面包屑的完整生命周期。根据当前光标所在的块路径，动态计算并显示文档层级。
- 实现面包屑的点击跳转、右键菜单触发以及在窄屏模式下的自动收缩逻辑。

---

## 注意事项
- 面包屑的点击事件通常会触发编辑器的 `scroll` 或 `zoom` 动作。
