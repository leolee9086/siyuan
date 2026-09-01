/**
 * S-Forge 墓碑文件（Tombstone）
 * 本文件在本地分支被有意删除：架构重构将单文件类 AgentSessionPanel 拆分为 layout/dock/agent/session-panel/ 模块（提交 684385d585），故删除原实现。
 * 本地替代/迁移到：
 *   - app/src/layout/dock/agent/session-panel/controller.ts（createAgentSessionPanelController，承接原类 toggle/close/refresh/渲染等职责）
 *   - app/src/layout/dock/agent/session-panel/types.ts（原 callbacks/options/state 类型）
 *   - app/src/layout/dock/agent/session-panel/view.ts（弹层 DOM 构建、挂载与事件绑定）
 *   - app/src/layout/dock/agent/session-panel/menu.actions.ts（会话更多菜单动作）
 *   - 挂载点：app/src/layout/dock/agent/chat/ui/lifecycle/AgentChat.init.helpers.ts
 * 上游 v3.8.0 对该文件的增量（经评审，:1→:3 共 52+/12−）：
 *   1. 回调新增可选 getStatus/getTitle/onClose，并引入 AgentSessionRunStatus 类型（来自 ./AgentSessionRuns）；列表项渲染运行状态徽章（文案 agentThinking / agentNotifyDone）。
 *   2. 构造函数新增 mobile = false 参数：移动端使用 agent-session-popup--mobile 样式与工具栏头部（返回/关闭按钮），不自动聚焦搜索框、不监听 resize 关闭、不做 setPosition 定位。
 *   3. 桌面端弹层由挂载 host 改为挂载 document.body，避免浮动 Dock 的变换坐标系与裁剪影响；新增 isOpen() 方法。
 *   4. close() 直接移除 this.popup；closeAllSubmenus() 的查询范围由 this.host 收窄为 this.popup（附带一处缩进修正）。
 * 增量去向：
 *   - onClose 回调与关闭时移除弹层：已由本地 session-panel/view.ts（bindAgentSessionPopupDismissal）与 controller.ts（popup.remove）等价覆盖。
 *   - getStatus/getTitle 运行状态徽章、mobile 模式、isOpen、document.body 挂载定位：本地 session-panel 未实现；TODO 若需对齐上游行为，移植至 session-panel/controller.ts、view.ts、types.ts。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
