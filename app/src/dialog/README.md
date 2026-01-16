# 思源笔记 Dialog (对话框系统) 模块

`app/src/dialog` 目录实现了思源笔记通用的弹性对话框、交互提示及系统层面的模态窗逻辑。

## 目录结构与功能说明

### 1. 核心框架
- **[index.ts](file:///d:/dev/siyuan-note/app/src/dialog/index.ts)**
  对话框的基类框架。负责管理 z-index 层级、遮罩（Mask）、居中定位及拖拽交互。
- **[dialog.types.ts](file:///d:/dev/siyuan-note/app/src/dialog/dialog.types.ts)**
  定义了对话框的配置接口（如标题、宽高、是否可拖拽、销毁回调等）。

### 2. 交互组件
- **[message.ts](file:///d:/dev/siyuan-note/app/src/dialog/message.ts)**
  应用左下角的即时通知（Toast）系统。支持信息、警告、错误等不同状态的自动消失消息。
- **[confirmDialog.ts](file:///d:/dev/siyuan-note/app/src/dialog/confirmDialog.ts)**
  标准化的二次确认对话框。
- **[tooltip.ts](file:///d:/dev/siyuan-note/app/src/dialog/tooltip.ts)**
  管理鼠标悬停时的文字提示框。

### 3. 功能补全
- **[moveResize.ts](file:///d:/dev/siyuan-note/app/src/dialog/moveResize.ts)**
  实现对话框的拖拽移动及窗口尺寸调整逻辑。
- **[processSystem.ts](file:///d:/dev/siyuan-note/app/src/dialog/processSystem.ts)**
  可能用于处理耗时任务的进度展示对话框。

---

## 注意事项
- 对话框的创建推荐使用 `new Dialog({...})`。
- 修改 `dialogHelpers.ts` 时需确保在移动端环境下的自动全屏逻辑仍然有效。
