/** 用途：发送提示词来源和文件树请求；使用范围：提示词仓储实现；解耦评估：网络实现只在领域网关暴露，动态身份由组合根端口注入。 */
import {fetchSyncPost} from "../../../../util/network/fetch";
/** 用途：约束文件树搜索结果；使用范围：提示词候选过滤。 */
import type {SearchResultItem} from "../../../../util/file/movePath/model/movePathTo.types";
/** 用途：约束组合根提供的动态请求头；使用范围：全部提示词来源请求。 */
import type {AgentRequestHeaders} from "../request/AgentRequest.types";
/** 用途：校验提示词来源响应包络；使用范围：提示词仓储实现；解耦评估：复用请求领域的纯包络校验，避免提示词领域复制协议。 */
import {requireAgentAPIData} from "../request/AgentRequest.response";
/** 用途：记录提示词操作观察到的会话修订；使用范围：提示词仓储实现。 */
import type {AgentSessionRevisionState} from "../session/AgentSession.types";
/** 用途：约束面板能力；使用范围：提示词菜单和错误出口；解耦评估：纯端口类型。 */
import type {AgentPanelCapabilities} from "../runtime/agentPanel.ports.types";
/** 用途：约束当前会话；使用范围：提示词持久化；解耦评估：纯端口类型。 */
import type {AgentPanelConversation} from "../runtime/agentPanel.ports.types";
/** 用途：约束菜单项；使用范围：提示词动作菜单；解耦评估：纯端口类型。 */
import type {PanelMenuItem} from "../runtime/agentPanel.ports.types";
/** 用途：约束目标策略；使用范围：提示词交互门禁；解耦评估：纯策略类型。 */
import type {AgentPanelResolvedTargetPolicy} from "../runtime/agentPanel.targetPolicy.types";

/** 导出统一网络入口。 */
export {fetchSyncPost};
/** 导出文件树结果类型。 */
export type {SearchResultItem};
/** 导出请求头能力类型。 */
export type {AgentRequestHeaders};
/** 导出 Agent API 数据校验。 */
export {requireAgentAPIData};
/** 导出可观察会话修订状态。 */
export type {AgentSessionRevisionState};
/** 导出面板能力类型。 */
export type {AgentPanelCapabilities};
/** 导出面板会话类型。 */
export type {AgentPanelConversation};
/** 导出面板菜单项。 */
export type {PanelMenuItem};
/** 导出目标策略类型。 */
export type {AgentPanelResolvedTargetPolicy};
