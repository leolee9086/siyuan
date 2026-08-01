/** 用途：约束 SSE 事件处理状态；使用范围：本目录全部协议流程。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时契约。 */
export type {AgentChatRuntime};
/** 用途：约束 SSE 事件载荷；使用范围：协议分派。 */
import type {ISSEResult} from "../../../request/sse/agentSSE.types";
/** 导出 SSE 结果协议。 */
export type {ISSEResult};

/** 用途：追加问题卡片；使用范围：问题事件。 */
import {appendQuestion} from "../../interaction/question/AgentChat.question.methods";
/** 导出问题追加命令。 */
export {appendQuestion};
/** 用途：追加令牌用量；使用范围：用量事件。 */
import {appendUsage} from "../../interaction/metrics/AgentChat.metrics.methods";
/** 导出用量追加命令。 */
export {appendUsage};
/** 用途：追加确认卡片；使用范围：确认事件。 */
import {appendConfirm} from "../../interaction/confirm/AgentChat.confirm.methods";
/** 导出确认追加命令。 */
export {appendConfirm};
/** 用途：执行前端工具；使用范围：前端工具事件。 */
import {handleFrontendToolCall} from "../../interaction/confirm/AgentChat.confirm.methods";
/** 导出前端工具处理命令。 */
export {handleFrontendToolCall};
/** 用途：追加错误卡片；使用范围：错误事件。 */
import {appendError} from "../../interaction/errors/AgentChat.errorCards";
/** 导出错误追加命令。 */
export {appendError};
/** 用途：追加重试状态；使用范围：重试事件。 */
import {appendRetry} from "../../interaction/errors/AgentChat.errors.methods";
/** 导出重试追加命令。 */
export {appendRetry};

/** 用途：恢复权威会话；使用范围：冲突事件。 */
import {reloadFromDisk} from "../../session/persistence/AgentChat.reload";
/** 导出会话重载命令。 */
export {reloadFromDisk};
/** 用途：恢复中断轮次；使用范围：提交事件。 */
import {recoverInterruptedTurn} from "../../session/persistence/AgentChat.recoverTurn";
/** 导出中断轮次恢复命令。 */
export {recoverInterruptedTurn};

/** 用途：追加运行中工具徽标；使用范围：工具开始事件。 */
import {appendRunningToolBadge} from "../../interaction/tools/AgentChat.toolState";
/** 导出工具徽标命令。 */
export {appendRunningToolBadge};
/** 用途：查找当前工具调用；使用范围：工具状态事件。 */
import {findCurrentToolCall} from "../../interaction/tools/AgentChat.toolState";
/** 导出工具调用查找函数。 */
export {findCurrentToolCall};
/** 用途：完成工具状态；使用范围：工具结束事件。 */
import {finishToolCall} from "../../interaction/tools/AgentChat.toolState";
/** 导出工具完成命令。 */
export {finishToolCall};
/** 用途：标记工具运行中；使用范围：工具开始事件。 */
import {setToolCallRunning} from "../../interaction/tools/AgentChat.toolState";
/** 导出工具运行命令。 */
export {setToolCallRunning};

/** 用途：投影工具卡片事件；使用范围：工具开始、进度和结果事件。 */
import {applyToolCardEvent} from "../../interaction/tools/AgentChat.toolCards";
/** 导出工具卡片领域命令。 */
export {applyToolCardEvent};

/** 用途：追加快照信息；使用范围：快照事件。 */
import {appendSnapshotInfo} from "../../interaction/snapshot/AgentChat.snapshot";
/** 导出快照追加命令。 */
export {appendSnapshotInfo};

/** 用途：提交待处理令牌；使用范围：事件边界。 */
import {flushTokenUpdate} from "../../message/user/AgentChat.tokenStream";
/** 导出令牌提交命令。 */
export {flushTokenUpdate};
/** 用途：追加流式令牌；使用范围：内容事件。 */
import {appendToken} from "../../message/user/AgentChat.tokenStream";
/** 导出令牌追加命令。 */
export {appendToken};

/** 用途：处理错误事件；使用范围：协议分派。 */
import {handleError} from "../response/AgentChat.errorHandling";
/** 导出错误处理命令。 */
export {handleError};
/** 用途：完成响应；使用范围：结束事件。 */
import {finishResponse} from "../response/AgentChat.finish.methods";
/** 导出响应完成命令。 */
export {finishResponse};
/** 用途：追加思考正文；使用范围：思考事件。 */
import {appendThinking} from "../thinking/AgentChat.thinking.methods";
/** 导出思考追加命令。 */
export {appendThinking};
/** 用途：追加推理正文；使用范围：推理事件。 */
import {appendReasoning} from "../thinking/AgentChat.thinking.methods";
/** 导出推理追加命令。 */
export {appendReasoning};

/** 用途：切换流式状态；使用范围：协议恢复。 */
import {setStreaming} from "../../ui/feedback/AgentChat.streamingState";
/** 导出流式状态命令。 */
export {setStreaming};
