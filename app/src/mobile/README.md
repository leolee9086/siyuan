# 思源笔记 Mobile (移动端适配) 模块

`app/src/mobile` 目录专门负责思源笔记在移动端（Android/iOS）环境下的 UI 适配与特有交互逻辑。

## 目录结构 with 功能说明

### 1. 核心布局
- **[index.ts](file:///d:/dev/siyuan-note/app/src/mobile/index.ts)**
  移动端排版与初始化的主入口。处理针对小屏幕的底部导航栏、侧滑菜单（Drawer）的初始化。
- **[dock/](file:///d:/dev/siyuan-note/app/src/mobile/dock/)**
  移动端特有的停靠面板（Dock）实现，通常表现为弹出式工作区或全屏托盘。

### 2. 交互逻辑
- **[editor.ts](file:///d:/dev/siyuan-note/app/src/mobile/editor.ts)**
  针对触摸屏优化的编辑器行为控制。
- **[menu/](file:///d:/dev/siyuan-note/app/src/mobile/menu/)**
  移动端专用的操作菜单（如长按选择、底部弹出菜单）。

### 3. 设置与配置
- **[settings/](file:///d:/dev/siyuan-note/app/src/mobile/settings/)**
  移动端设置界面的专用实现，采用了更符合移动端习惯的列表与开关布局。

---

## 注意事项
- 移动端逻辑与桌面端代码通过 `Constants.MOBILE` 条件编译进行隔离，但在本目录下是完全独立的实现。
- 请注意触摸事件（Touch Events）与鼠标事件（Mouse Events）的兼容性处理。
