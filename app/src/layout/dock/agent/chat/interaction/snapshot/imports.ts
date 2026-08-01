/** 用途：约束快照信息流程读写的聊天状态；使用范围：本目录全部流程。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时契约。 */
export type {AgentChatRuntime};


/** 用途：转义快照标识；使用范围：快照信息渲染。 */
import {escapeHtml} from "../../../../../../util/DOM/escape";
/** 导出 HTML 转义函数。 */
export {escapeHtml};

/** 用途：调用快照回滚接口；使用范围：回滚按钮。 */
import {fetchPost} from "../../../../../../util/network/fetch";
/** 导出请求函数。 */
export {fetchPost};

/** 用途：持久化快照条目；使用范围：快照事件。 */
import {saveSession} from "../../session/persistence/AgentChat.save";
/** 导出会话保存命令。 */
export {saveSession};

/** 用途：插入快照信息；使用范围：快照事件。 */
import {insertBeforeAI} from "../../ui/feedback/AgentChat.messagePlacement";
/** 导出消息插入命令。 */
export {insertBeforeAI};
/** 用途：维持快照信息可见；使用范围：快照事件。 */
import {scrollToBottom} from "../../ui/feedback/AgentChat.scrolling";
/** 导出消息滚动命令。 */
export {scrollToBottom};
