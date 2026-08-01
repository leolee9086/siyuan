/**
 * 用途：约束工具流程读写的聊天状态和调用记录。
 * 使用范围：仅限本目录工具状态、徽标和卡片函数。
 * 解耦评估：类型导入在编译后消失，不增加运行时依赖。
 */
import type {AgentChatRuntime, AgentToolCall} from "../../AgentChat.runtime.types";
/** 导出聊天运行时状态类型。 */
export type {AgentChatRuntime};
/** 导出工具调用记录类型。 */
export type {AgentToolCall};

/**
 * 用途：约束工具卡片消费的权威流事件。
 * 使用范围：工具开始、进度和结果的统一领域入口。
 * 解耦评估：类型导入在编译后消失，工具卡片不复制流协议字段。
 */
import type {ISSEResult} from "../../../request/sse/agentSSE.types";
/** 导出流事件类型。 */
export type {ISSEResult};

/**
 * 用途：创建持久化条目标识并渲染工具徽标与待办结果。
 * 使用范围：工具卡片创建和思考卡片徽标。
 * 解耦评估：这些是现有消息渲染边界，本目录只组合返回的 HTML。
 */
import {renderTodoList, renderToolsLineHTML} from "../../../AgentMessageRenderer";
/** 导出待办结果渲染函数。 */
export {renderTodoList};
/** 导出工具徽标行渲染函数。 */
export {renderToolsLineHTML};

/** 用途：维持工具状态更新后的消息贴底；使用范围：本目录所有 DOM 更新。 */
import {scrollToBottom} from "../../ui/feedback/AgentChat.scrolling";
/** 导出消息贴底函数。 */
export {scrollToBottom};
/** 用途：插入新工具卡片；使用范围：工具开始和缺失卡片的结果回退。 */
import {insertBeforeAI} from "../../ui/feedback/AgentChat.messagePlacement";
/** 导出消息插入函数。 */
export {insertBeforeAI};
/** 用途：登记网页搜索引用；使用范围：网页搜索完成事件。 */
import {registerWebSearchReferences} from "../../message/projection/AgentChat.persisted.methods";
/** 导出网页引用登记函数。 */
export {registerWebSearchReferences};
