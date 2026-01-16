# 思源笔记 Dialog (对话框系统) 模块

`app/src/dialog` 目录实现了思源笔记通用的弹性对话框、交互提示及系统层面的模态窗逻辑。

## 目录结构与功能说明

### 1. 核心框架
- **[index.ts](file:///d:/dev/siyuan-note/app/src/dialog/index.ts)**
  对话框的基类框架。负责管理 z-index 层级、遮罩（Mask）、居中定位及拖拽交互的初始化。通过 `new Dialog(options)` 实例化。
- **[dialog.types.ts](file:///d:/dev/siyuan-note/app/src/dialog/dialog.types.ts)**
  定义了对话框的配置接口 `IDialogOptions`（如标题、宽高、是否禁用遮罩关闭、销毁回调等）。
- **[dialog.guard.ts](file:///d:/dev/siyuan-note/app/src/dialog/dialog.guard.ts)**
  类型守卫函数。用于在处理对话框 DOM 元素时提供类型安全检查。

### 2. 交互组件
- **[message.ts](file:///d:/dev/siyuan-note/app/src/dialog/message.ts)**
  应用左下角的即时通知（Toast）系统。支持信息、警告、错误等不同状态的自动消失消息。
- **[confirmDialog.ts](file:///d:/dev/siyuan-note/app/src/dialog/confirmDialog.ts)**
  标准化的二次确认对话框。支持“普通确认”和“危险/删除操作确认”的视觉区分，提供简单的 Promise 或回调式调用。
- **[tooltip.ts](file:///d:/dev/siyuan-note/app/src/dialog/tooltip.ts)**
  管理鼠标悬停时的文字提示框。

### 3. 功能补全
- **[moveResize.ts](file:///d:/dev/siyuan-note/app/src/dialog/moveResize.ts)**
  实现对话框的拖拽移动及窗口尺寸调整逻辑。
- **[processSystem.ts](file:///d:/dev/siyuan-note/app/src/dialog/processSystem.ts)**
  系统级状态处理，包括内核错误提示、退出确认、同步进度显示等重型交互。

### 4. 基础公共逻辑 (Helpers)
- **[dialogHelpers.ts](file:///d:/dev/siyuan-note/app/src/dialog/dialogHelpers.ts)**
  对话框通用辅助函数。
- **[dialogHelpers.lifecycle.ts](file:///d:/dev/siyuan-note/app/src/dialog/dialogHelpers.lifecycle.ts)**
  管理对话框的生命周期，包括 DOM 的添加、动画控制及销毁清理。
- **[dialogHelpers.html.ts](file:///d:/dev/siyuan-note/app/src/dialog/dialogHelpers.html.ts)**
  负责生成对话框的标准化 HTML 结构。
- **[dialogHelpers.events.ts](file:///d:/dev/siyuan-note/app/src/dialog/dialogHelpers.events.ts)**
  封装对话框的事件监听逻辑（遮罩点击关闭、快捷键处理等）。

---

## 注意事项
- 对话框的创建推荐使用 `new Dialog({...})`。
- 修改 `dialogHelpers.ts` 时需确保在移动端环境下的自动全屏逻辑仍然有效。
