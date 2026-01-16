# 思源笔记 Window (多窗口管理) 模块

`app/src/window` 目录负责思源笔记在桌面平台（Electron）下的多窗口模型及窗口间通讯。

## 目录结构与功能说明

### 1. 窗口生命周期
- **[openNewWindow.ts](file:///d:/dev/siyuan-note/app/src/window/openNewWindow.ts)**
  创建并初始化新的 Electron 窗口，支持传递特定的路由参数（如在新窗口打开特定的文档或搜索页）。
- **[init.ts](file:///d:/dev/siyuan-note/app/src/window/init.ts)**
  子窗口的初始化脚本，负责在窗口启动时拉起必要的基础设施（i18n, Theme, Config）。
- **[closeWin.ts](file:///d:/dev/siyuan-note/app/src/window/closeWin.ts)**
  处理窗口关闭时的清理逻辑，确保数据同步及资源释放。

### 2. 交互与配置
- **[onWindowsMsg.ts](file:///d:/dev/siyuan-note/app/src/window/onWindowsMsg.ts)**
  监听并处理窗口间的 IPC 消息通讯，实现跨窗口的状态同步（如一个窗口修改了设置，其他窗口同步生效）。
- **[setHeader.ts](file:///d:/dev/siyuan-note/app/src/window/setHeader.ts)**
  动态管理窗口的标题栏（Titlebar）样式，根据是否为原生边框或沉浸式模式进行适配。

---

## 技术细节
- **IPC**: 依赖 Electron 的 `ipcRenderer` 与主进程（Main Process）及其他渲染进程协同工作。
- **子窗口初始化**: 由于子窗口是独立的上下文，必须重新执行一套简化的 `boot` 流程。

## 注意事项
- 修改多窗口通讯逻辑时，需特别注意死循环风险（例如 A 窗口同步到 B，B 又触发了同步回 A）。
- 新开窗口会显著增加系统内存消耗，除非业务必要，否则建议优先使用页签（Tab）模型。
