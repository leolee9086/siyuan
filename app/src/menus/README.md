# 思源笔记 Menus (菜单系统) 模块

`app/src/menus` 目录负责管理思源笔记中所有的弹出菜单（Context Menu）。它提供了一套高度可定制的菜单构建框架，支持复杂的层级嵌套、图标绑定及条件过滤。

## 目录结构与功能说明

### 1. 核心框架
- **[Menu.ts](file:///d:/dev/siyuan-note/app/src/menus/Menu.ts)**
  菜单系统的核心类。负责创建菜单容器、计算显示位置、处理层级堆叠（遮罩逻辑）及其生命周期。
- **[Menu.Item.ts](file:///d:/dev/siyuan-note/app/src/menus/Menu.Item.ts)**
  定义菜单中的单个条目（Item），支持标签、图标、子菜单关联、及其点击事件响应。

### 2. 业务菜单
- **[protyle.ts](file:///d:/dev/siyuan-note/app/src/menus/protyle.ts)**
  编辑器核心菜单的聚合层。它根据当前选中的块类型、段落属性等，动态组装出针对 Protyle 的操作菜单。
- **[protyleMenus/](file:///d:/dev/siyuan-note/app/src/menus/protyleMenus/)**
  包含 Protyle 专用的子菜单实现（如：块转换、字体设置、表格操作等）。
- **[workspace.ts](file:///d:/dev/siyuan-note/app/src/menus/workspace.ts)**
  工作空间/文件树相关的右键菜单实现。

### 3. 通用条目
- **[commonMenuItem.ts](file:///d:/dev/siyuan-note/app/src/menus/commonMenuItem.ts)**
  存放跨场景复用的菜单项（如：复制链接、打开属性、微信提醒等）。

---

## 使用指南

创建一个基础菜单：
```typescript
const menu = new Menu("my-unique-id");
menu.addItem({
    icon: "iconCopy",
    label: "复制",
    click: () => { /* 逻辑 */ }
});
menu.open({ x, y });
```

## 注意事项
- 菜单展示位置通常使用鼠标点击事件的 `clientX/Y`。
- 子菜单（SubMenu）的展开依赖于 `Menu.subMenu.ts` 的计时器控制，以防止鼠标滑过时的剧烈跳变。
- 在移动端，菜单会自动转换成全屏层模式（Fullscreen Layer）。
