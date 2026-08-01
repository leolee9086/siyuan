/** 用途：约束思考流程读写状态；使用范围：本目录全部流程。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时契约。 */
export type {AgentChatRuntime};
/** 用途：约束会话条目；使用范围：思考步骤提交。 */
import type {SessionEntry} from "../../AgentChat.runtime.types";
/** 导出会话条目类型。 */
export type {SessionEntry};
/** 用途：约束思考步骤；使用范围：思考步骤渲染。 */
import type {ThinkingStep} from "../../AgentChat.runtime.types";
/** 导出思考步骤类型。 */
export type {ThinkingStep};

/** 用途：转义思考文本；使用范围：活动思考卡片。 */
import {escapeHtml} from "../../../../../../util/DOM/escape";
/** 导出 HTML 转义函数。 */
export {escapeHtml};
/** 用途：绑定思考卡片折叠；使用范围：思考卡片渲染。 */
import {bindThinkingCardToggle} from "../../../AgentMessageRenderer";
/** 导出思考卡片绑定函数。 */
export {bindThinkingCardToggle};
/** 用途：渲染工具名称行；使用范围：思考步骤。 */
import {renderToolsLineHTML} from "../../../AgentMessageRenderer";
/** 导出工具名称渲染函数。 */
export {renderToolsLineHTML};

/** 用途：压缩工具调用；使用范围：思考步骤持久化。 */
import {slimToolCallsForPersistence} from "../../message/projection/AgentChat.toolPersistence";
/** 导出工具调用压缩函数。 */
export {slimToolCallsForPersistence};

/** 用途：维持思考卡片可见；使用范围：思考正文更新。 */
import {scrollToBottom} from "../../ui/feedback/AgentChat.scrolling";
/** 导出消息滚动命令。 */
export {scrollToBottom};
/** 用途：观察流式思考卡片；使用范围：新卡片。 */
import {observeStickTarget} from "../../ui/feedback/AgentChat.scrolling";
/** 导出贴底观察命令。 */
export {observeStickTarget};
/** 用途：启动思考耗时刷新；使用范围：活动思考卡片。 */
import {startThinkingUpdates} from "../../ui/feedback/AgentChat.thinkingState";
/** 导出思考刷新命令。 */
export {startThinkingUpdates};
/** 用途：插入思考卡片；使用范围：新步骤。 */
import {insertBeforeAI} from "../../ui/feedback/AgentChat.messagePlacement";
/** 导出消息插入命令。 */
export {insertBeforeAI};
