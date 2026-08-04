/** 用途：约束 AgentChat 状态；使用范围：queue dock 渲染和交互。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时协议。 */
export type {AgentChatRuntime};
/** 用途：约束 controller 状态；使用范围：投递模式与队列快照渲染。 */
import type {AgentConversationState} from "../../../runtime/conversation/agentConversation.types";
/** 导出 controller 状态协议。 */
export type {AgentConversationState};
/** 用途：约束 queue item；使用范围：单项渲染。 */
import type {AgentConversationQueueItem} from "../../../runtime/conversation/agentConversation.types";
/** 导出 queue item 协议。 */
export type {AgentConversationQueueItem};
/** 用途：读取当前语言；使用范围：控件标签和 tooltip；解耦评估：语言环境是现有组合根的只读入口，作为参数逐层传递会扩大所有队列命令签名。 */
import {getAgentChatLanguages} from "../../AgentChat.environment";
/** 导出语言读取器。 */
export {getAgentChatLanguages};
/** 用途：转义 queue 内容；使用范围：HTML 模板边界；解耦评估：统一转义函数是纯函数，直接复用可避免本目录复制安全规则。 */
import {escapeHtml} from "../../../../../../util/DOM/escape";
/** 导出 HTML 转义函数。 */
export {escapeHtml};
