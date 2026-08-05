/** 用途：约束问题卡片流程读取的聊天状态；使用范围：本目录全部函数；解耦评估：类型网关隔离具体 AgentChat 门面。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时契约。 */
export type {AgentChatRuntime};

/** 用途：渲染问题卡片；使用范围：问题创建；解耦评估：复用唯一卡片渲染器避免 DOM 结构漂移。 */
import {renderQuestionCardHTML} from "../../../AgentMessageRenderer";
/** 导出问题卡片渲染函数。 */
export {renderQuestionCardHTML};

/** 用途：结束活动思考卡片；使用范围：问题创建；解耦评估：复用反馈领域命令避免复制状态机。 */
import {finishActiveThinking} from "../../ui/feedback/AgentChat.thinkingState";
/** 导出思考完成命令。 */
export {finishActiveThinking};
/** 用途：提交当前思考步骤；使用范围：问题创建；解耦评估：复用流式领域入口保持事件顺序。 */
import {flushThinkingStep} from "../../stream/thinking/AgentChat.thinkingStep";
/** 导出思考步骤提交命令。 */
export {flushThinkingStep};
/** 用途：将问题卡片插入助手占位前；使用范围：问题创建；解耦评估：复用消息布局命令避免复制 DOM 放置规则。 */
import {insertBeforeAI} from "../../ui/feedback/AgentChat.messagePlacement";
/** 导出消息插入命令。 */
export {insertBeforeAI};
/** 用途：问题卡片插入后维持贴底；使用范围：问题创建；解耦评估：复用滚动领域入口避免持有滚动策略。 */
import {scrollToBottom} from "../../ui/feedback/AgentChat.scrolling";
/** 导出消息贴底命令。 */
export {scrollToBottom};

/** 用途：持久化问题提交状态；使用范围：问题答案请求完成后；解耦评估：统一会话保存入口隔离仓储协议。 */
import {saveSession} from "../../session/persistence/AgentChat.save";
/** 导出会话保存命令。 */
export {saveSession};
/** 用途：通过既有控制请求设施提交问题答案；使用范围：问题答案请求；解耦评估：共享请求边界避免复制 HTTP 协议。 */
import {requestAgentInteraction} from "../AgentChat.interactionRequest";
/** 导出交互请求函数。 */
export {requestAgentInteraction};
/** 用途：把协议终态映射为卡片标签；使用范围：问题卡片结算；解耦评估：统一映射防止卡片自行推断状态。 */
import {resolveInteractionStatusLabel} from "../AgentChat.interactionStatus";
/** 导出交互终态标签函数。 */
export {resolveInteractionStatusLabel};
/** 用途：约束交互请求结果；使用范围：问题提交状态机；解耦评估：共享判别联合保持按钮状态与请求层一致。 */
import type {AgentInteractionRequestResult} from "../AgentChat.interactionRequest.types";
/** 导出交互请求结果类型。 */
export type {AgentInteractionRequestResult};
