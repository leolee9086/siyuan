# 思源笔记 Plugin (插件系统) 模块

`app/src/plugin` 目录实现了思源笔记的插件化架构。它定义了内核与插件之间的通讯协议，并提供了丰富的基础 API 供开发者扩展功能。

## 目录结构与功能说明

### 1. 插件生命周期管理
- **[index.ts](file:///d:/dev/siyuan-note/app/src/plugin/index.ts)**
  插件管理器的核心。负责本地与云端插件的发现、开关控制以及加载状态维护。
- **[loader.ts](file:///d:/dev/siyuan-note/app/src/plugin/loader.ts)**
  插件动态加载器。负责解析插件清单（`plugin.json`）、注入样式（`index.css`）并安全启动 JavaScript 入口。
- **[uninstall.ts](file:///d:/dev/siyuan-note/app/src/plugin/uninstall.ts)**
  处理插件卸载时的资源回收（注销命令、清理 DOM、移除事件监听）。

### 2. 插件基础设施 (SDK)
- **[API.ts](file:///d:/dev/siyuan-note/app/src/plugin/API.ts)**
  插件可用的 API 集合。封装了对内核数据的读写、编辑器的底层操作及 UI 元素的注入接口。
- **[EventBus.ts](file:///d:/dev/siyuan-note/app/src/plugin/EventBus.ts)**
  插件专用的事件总线。允许插件订阅系统事件（如点击块、打开窗口、同步完成）。
- **[Setting.ts](file:///d:/dev/siyuan-note/app/src/plugin/Setting.ts)**
  为插件提供统一的设置页面构建工具。

### 3. UI 扩展
- **[Menu.ts](file:///d:/dev/siyuan-note/app/src/plugin/Menu.ts)**: 提供在系统菜单中插入自定义项的能力。
- **[openTopBarMenu.ts](file:///d:/dev/siyuan-note/app/src/plugin/openTopBarMenu.ts)**: 支持插件在顶栏（TopBar）挂载自定义图标。

---

## 开发规范
- 插件应当遵循最小权限原则，尽可能通过 `EventBus` 监听而非拦截全局事件。
- 所有的插件注入元素都应带有 `data-plugin-id` 标记，以便在卸载时能被系统自动清理。
