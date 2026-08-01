/** 用途：约束消息投影读写的聊天状态；使用范围：本目录全部投影。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时契约。 */
export type {AgentChatRuntime};
/** 用途：约束工具调用条目；使用范围：工具卡片投影。 */
import type {AgentToolCall} from "../../AgentChat.runtime.types";
/** 导出工具调用类型。 */
export type {AgentToolCall};
/** 用途：约束会话条目；使用范围：条目反序列化。 */
import type {SessionEntry} from "../../AgentChat.runtime.types";
/** 导出会话条目类型。 */
export type {SessionEntry};
/** 用途：约束思考步骤；使用范围：思考条目投影。 */
import type {ThinkingStep} from "../../AgentChat.runtime.types";
/** 导出思考步骤类型。 */
export type {ThinkingStep};

/** 用途：约束持久化会话；使用范围：会话投影。 */
import type {AgentSession} from "../../../session/AgentSession.types";
/** 导出持久化会话类型。 */
export type {AgentSession};

/** 用途：计算目标展示策略；使用范围：条目投影。 */
import {resolveTargetPolicy} from "../../ui/model/AgentChat.targetPolicy";
/** 导出目标策略计算函数。 */
export {resolveTargetPolicy};

/** 用途：追加用户消息；使用范围：历史会话投影。 */
import {appendUserMessage} from "../user/AgentChat.userMessage";
/** 导出用户消息追加命令。 */
export {appendUserMessage};

/** 用途：追加快照信息；使用范围：历史会话投影。 */
import {appendSnapshotInfo} from "../../interaction/snapshot/AgentChat.snapshot";
/** 导出快照追加命令。 */
export {appendSnapshotInfo};
/** 用途：追加回滚信息；使用范围：历史会话投影。 */
import {appendRollbackInfo} from "../../interaction/snapshot/AgentChat.snapshot";
/** 导出回滚追加命令。 */
export {appendRollbackInfo};
/** 用途：渲染合并思考卡片；使用范围：历史思考条目。 */
import {renderMergedThinkingCard} from "../../interaction/metrics/AgentChat.metrics.methods";
/** 导出思考卡片渲染命令。 */
export {renderMergedThinkingCard};

/** 用途：附加助手复制按钮；使用范围：助手消息投影。 */
import {addCopyButton} from "../actions/AgentChat.assistantActions";
/** 导出复制按钮命令。 */
export {addCopyButton};

/** 用途：维持助手消息可见；使用范围：助手正文更新。 */
import {scrollToBottom} from "../../ui/feedback/AgentChat.scrolling";
/** 导出消息滚动命令。 */
export {scrollToBottom};
/** 用途：格式化工具类别；使用范围：确认条目投影。 */
import {toolCategory} from "../../ui/feedback/AgentChat.presentation";
/** 导出工具类别函数。 */
export {toolCategory};

/** 用途：约束确认副作用；使用范围：持久化确认条目。 */
import type {IToolEffects} from "../../../request/sse/agentSSE.types";
/** 导出工具副作用类型。 */
export type {IToolEffects};

/** 用途：执行通用消息后处理；使用范围：持久化消息投影。 */
import {postRender} from "../../../AgentMessageRenderer";
/** 导出消息后处理函数。 */
export {postRender};
/** 用途：渲染问题卡片；使用范围：持久化问题条目。 */
import {renderQuestionCardHTML} from "../../../AgentMessageRenderer";
/** 导出问题卡片渲染函数。 */
export {renderQuestionCardHTML};
/** 用途：渲染待办工具结果；使用范围：持久化工具条目。 */
import {renderTodoList} from "../../../AgentMessageRenderer";
/** 导出待办列表渲染函数。 */
export {renderTodoList};

/** 用途：渲染通用工具结果；使用范围：持久化工具条目。 */
import {renderToolCallResult} from "../../interaction/tools/toolcall/renderer";
/** 导出工具结果渲染函数。 */
export {renderToolCallResult};

/** 用途：收集网页搜索引用；使用范围：搜索工具投影。 */
import {collectWebSearchReferences} from "../../interaction/tools/websearch/renderer";
/** 导出网页引用收集函数。 */
export {collectWebSearchReferences};
/** 用途：规范化网页地址；使用范围：搜索工具投影。 */
import {normalizeWebURL} from "../../interaction/tools/websearch/renderer";
/** 导出网页地址规范化函数。 */
export {normalizeWebURL};
/** 用途：隔离未验证网页链接；使用范围：搜索工具投影。 */
import {protectUnverifiedWebLinks} from "../../interaction/tools/websearch/renderer";
/** 导出网页链接保护函数。 */
export {protectUnverifiedWebLinks};
/** 用途：渲染网页搜索结果；使用范围：搜索工具投影。 */
import {renderWebSearchResult} from "../../interaction/tools/websearch/renderer";
/** 导出网页搜索渲染函数。 */
export {renderWebSearchResult};
/** 用途：解析已映射网页引用；使用范围：助手正文投影。 */
import {resolveMappedWebReferences} from "../../interaction/tools/websearch/renderer";
/** 导出网页引用解析函数。 */
export {resolveMappedWebReferences};

/** 用途：转义工具输出；使用范围：持久化工具投影。 */
import {escapeHtml} from "../../../../../../util/DOM/escape";
/** 导出 HTML 转义函数。 */
export {escapeHtml};

/** 用途：渲染确认效果；使用范围：持久化确认条目。 */
import {renderConfirmEffects} from "../../ui/feedback/AgentChat.presentation";
/** 导出确认效果渲染函数。 */
export {renderConfirmEffects};
