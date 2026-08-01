/** 用途：约束事件处理读写的聊天状态；使用范围：本目录事件绑定。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时契约。 */
export type {AgentChatRuntime};

/** 用途：约束会话目标值；使用范围：目标选择事件守卫。 */
import type {AgentPanelConversationKind} from "../../../runtime/agentPanel.ports.types";
/** 导出会话目标类型。 */
export type {AgentPanelConversationKind};

/** 用途：收窄事件目标；使用范围：事件代理。 */
import {isHTMLElement} from "../AgentChat.dom.guard";
/** 导出 HTMLElement 守卫。 */
export {isHTMLElement};

/** 用途：创建新会话；使用范围：新会话按钮。 */
import {createSession} from "../../session/lifecycle/AgentChat.manage.methods";
/** 导出会话创建命令。 */
export {createSession};

/** 用途：切换公开会话；使用范围：目标选择事件。 */
import {openConversation} from "../lifecycle/AgentChat.facade";
/** 导出公开会话切换命令。 */
export {openConversation};

/** 用途：识别用户编辑提交事件；使用范围：消息区事件代理。 */
import {agentChatUserEditSubmitEvent} from "../../message/user/AgentChat.userEditEvent.factory";
/** 导出用户编辑事件名。 */
export {agentChatUserEditSubmitEvent};
/** 用途：重新生成助手回复；使用范围：消息区事件代理。 */
import {regenerateResponse} from "../../stream/regeneration/AgentChat.regenerate.methods";
/** 导出重新生成命令。 */
export {regenerateResponse};

/** 用途：识别重新生成事件；使用范围：消息区事件代理。 */
import {agentChatRegenerateRequestEvent} from "../../message/actions/AgentChat.regenerateEvent";
/** 导出重新生成事件名。 */
export {agentChatRegenerateRequestEvent};

/** 用途：显示令牌明细；使用范围：令牌入口事件。 */
import {showTokenBreakdownPopup} from "../../interaction/metrics/AgentChat.metrics.methods";
/** 导出令牌明细显示命令。 */
export {showTokenBreakdownPopup};
/** 用途：关闭令牌明细；使用范围：令牌入口事件。 */
import {closeTokenBreakdownPopup} from "../../interaction/metrics/AgentChat.metrics.methods";
/** 导出令牌明细关闭命令。 */
export {closeTokenBreakdownPopup};

/** 用途：发送当前草稿；使用范围：输入区事件。 */
import {sendMessage} from "../../message/sending/AgentChat.send.methods";
/** 导出消息发送命令。 */
export {sendMessage};

/** 用途：打开会话文件菜单；使用范围：文件按钮事件。 */
import {openSessionFilesMenu} from "../../session/files/AgentChat.files";
/** 导出会话文件菜单命令。 */
export {openSessionFilesMenu};
/** 用途：上传会话文件；使用范围：文件输入事件。 */
import {uploadSessionFiles} from "../../session/files/AgentChat.files";
/** 导出会话文件上传命令。 */
export {uploadSessionFiles};
/** 用途：显示会话文件错误；使用范围：文件输入事件。 */
import {reportSessionFileError} from "../../session/files/AgentChat.fileOperation";
/** 导出会话文件错误命令。 */
export {reportSessionFileError};

/** 用途：停止当前生成；使用范围：停止按钮事件。 */
import {stopGeneration} from "../../interaction/errors/AgentChat.errors.methods";
/** 导出停止生成命令。 */
export {stopGeneration};

/** 用途：滚动到消息底部；使用范围：滚动按钮事件。 */
import {scrollToBottom} from "../feedback/AgentChat.scrolling";
/** 导出消息滚动命令。 */
export {scrollToBottom};
