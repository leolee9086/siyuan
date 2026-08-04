/** 用途：约束会话目标；使用范围：adapter 注册表。 */
import type {AgentPanelConversationKind} from "../agentPanel.ports.types";
/** 用途：生成动态身份请求头；使用范围：控制请求与事件订阅。 */
import type {AgentRequestHeaders} from "../../request/AgentRequest.types";
/** 用途：访问 Agent 控制端点；使用范围：native adapter；解耦评估：adapter 是网络边界，集中转发避免 UI 直接依赖端点。 */
import {requestAgentConversationControl} from "../../request/control/AgentConversationControl.request";
/** 用途：订阅可重放会话事件；使用范围：native adapter；解耦评估：协议读取器由 adapter 隔离于共享 UI。 */
import {subscribeAgentConversationEvents} from "../../request/control/AgentConversationEvent.stream";
/** 用途：识别控制 API 冲突；使用范围：controller 重同步；解耦评估：纯守卫不持有网络或界面状态。 */
import {isAgentConversationControlError} from "../../request/control/AgentConversationControl.guard";

/** 导出会话目标协议。 */
export type {AgentPanelConversationKind};
/** 导出动态请求头协议。 */
export type {AgentRequestHeaders};
/** 导出控制请求入口。 */
export {requestAgentConversationControl};
/** 导出会话事件订阅入口。 */
export {subscribeAgentConversationEvents};
/** 导出控制错误守卫。 */
export {isAgentConversationControlError};
