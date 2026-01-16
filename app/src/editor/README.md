# 思源笔记 Editor (编辑器业务逻辑) 模块

`app/src/editor` 目录负责处理思源笔记编辑器层面的业务交互逻辑（非 Protyle 内核）。它连接了编辑器与文件树、侧边栏面板及其他核心系统。

## 目录结构与功能说明

### 1. 文件与资源操作
- **[rename.ts](file:///d:/dev/siyuan-note/app/src/editor/rename.ts)**
  处理文件/文档的重命名逻辑，包括同步更新数据库及 UI 状态。
- **[deleteFile.ts](file:///d:/dev/siyuan-note/app/src/editor/deleteFile.ts)**
  执行物理文件删除及内核条目清理。
- **[openLink.ts](file:///d:/dev/siyuan-note/app/src/editor/openLink.ts)**
  处理编辑器中各类链接（内部引用、外部 URL、资源文件）的点击跳转行为。

### 2. 编辑器生命周期与切换
- **[index.ts](file:///d:/dev/siyuan-note/app/src/editor/index.ts)**
  编辑器业务层的管理入口。
- **[util.switchEditor.ts](file:///d:/dev/siyuan-note/app/src/editor/util.switchEditor.ts)**
  处理在不同标签页/窗口之间切换编辑器实例时的上下文同步（如更新全局变量、焦点切换）。
- **[util.getUnInitTab.ts](file:///d:/dev/siyuan-note/app/src/editor/util.getUnInitTab.ts)**
  用于查找或初始化尚未完全加载的编辑器标签页。

### 3. 板块同步工具
- **[util.updateOutline.ts](file:///d:/dev/siyuan-note/app/src/editor/util.updateOutline.ts)**
  根据当前编辑器的内容实时刷新“大纲”面板。
- **[util.updateBacklinkGraph.ts](file:///d:/dev/siyuan-note/app/src/editor/util.updateBacklinkGraph.ts)**
  在文档切换或编辑后，触发“反链”或“关系图”面板的更新。
- **[util.updatePanelByEditor.ts](file:///d:/dev/siyuan-note/app/src/editor/util.updatePanelByEditor.ts)**
  通用的面板更新协调函数。

---

## 注意事项
- 本目录下的逻辑主要涉及 **Tab 标签页状态** 与 **Protyle 编辑器实例** 之间的映射关系。
- 绝大多数函数通过 `protyle.id` 或 `tab.id` 来定位目标操作对象。
