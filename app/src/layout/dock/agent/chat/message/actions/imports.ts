/** 用途：约束助手动作读写的聊天状态；使用范围：复制和重新生成入口。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时状态类型。 */
export type {AgentChatRuntime};
/** 用途：检查历史位置后的工具副作用；使用范围：重新生成资格。 */
import {hasAgentExecutedToolsAfter} from "../history/AgentHistory";
/** 导出工具历史检查函数。 */
export {hasAgentExecutedToolsAfter};
/** 用途：计算当前目标是否显示重新生成；使用范围：助手动作构建。 */
import {resolveTargetPolicy} from "../../ui/model/AgentChat.targetPolicy";
/** 导出目标策略函数。 */
export {resolveTargetPolicy};
/** 用途：格式化助手消息时间；使用范围：动作栏元信息。 */
import {formatMessageTime} from "../../ui/feedback/AgentChat.presentation";
/** 导出消息时间格式函数。 */
export {formatMessageTime};
