/** 用途：约束错误与停止流程读取的聊天状态；使用范围：本目录全部函数。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时契约。 */
export type {AgentChatRuntime};

/** 用途：计算重新生成资格；使用范围：错误卡片操作。 */
import {canRetryLastUserTurn} from "../../../runtime/agentPanel.retryPolicy";
/** 导出重试策略。 */
export {canRetryLastUserTurn};
/** 用途：分派重新生成请求；使用范围：错误卡片操作。 */
import {dispatchAgentChatRegenerateRequest} from "../../message/actions/AgentChat.regenerateEvent";
/** 导出重新生成命令。 */
export {dispatchAgentChatRegenerateRequest};
/** 用途：计算目标能力；使用范围：重试入口可见性。 */
import {resolveTargetPolicy} from "../../ui/model/AgentChat.targetPolicy";
/** 导出目标策略。 */
export {resolveTargetPolicy};

/** 用途：渲染错误和重试卡片；使用范围：错误界面构建。 */
import {renderRetryCardHTML} from "../../../AgentMessageRenderer";
/** 导出重试卡片渲染函数。 */
export {renderRetryCardHTML};
import {escapeHtml} from "../../../../../../util/DOM/escape";
/** 导出 HTML 转义函数。 */
export {escapeHtml};

/** 用途：收敛思考、令牌和流状态；使用范围：错误与停止收尾。 */
import {flushTokenUpdate} from "../../message/user/AgentChat.tokenStream";
/** 导出令牌提交命令。 */
export {flushTokenUpdate};
import {flushThinkingStep} from "../../stream/thinking/AgentChat.thinkingStep";
/** 导出思考步骤提交命令。 */
export {flushThinkingStep};
import {clearThinking, finishActiveThinking} from "../../ui/feedback/AgentChat.thinkingState";
/** 导出思考清理命令。 */
export {clearThinking};
/** 导出思考完成命令。 */
export {finishActiveThinking};
import {setStreaming} from "../../ui/feedback/AgentChat.streamingState";
/** 导出流式状态命令。 */
export {setStreaming};

/** 用途：收敛助手响应；使用范围：停止生成。 */
import {
    appendCurrentAssistantEntry,
    finalizeResponseElement,
    resetStreamingResponseState,
} from "../../stream/response/AgentChat.response.helpers";
/** 导出助手条目提交命令。 */
export {appendCurrentAssistantEntry};
/** 导出响应元素完成命令。 */
export {finalizeResponseElement};
/** 导出响应状态重置命令。 */
export {resetStreamingResponseState};

/** 用途：恢复权威会话；使用范围：停止生成后的持久化同步。 */
import {recoverInterruptedTurn} from "../../session/persistence/AgentChat.recoverTurn";
/** 导出中断轮次恢复命令。 */
export {recoverInterruptedTurn};
import {reloadFromDisk} from "../../session/persistence/AgentChat.reload";
/** 导出会话重载命令。 */
export {reloadFromDisk};

/** 用途：同步错误卡片位置、导航和令牌展示；使用范围：本目录 DOM 更新。 */
import {insertBeforeAI} from "../../ui/feedback/AgentChat.messagePlacement";
/** 导出消息插入命令。 */
export {insertBeforeAI};
import {scrollToBottom} from "../../ui/feedback/AgentChat.scrolling";
/** 导出消息贴底命令。 */
export {scrollToBottom};
import {rebuildNavMarkers} from "../../ui/navigation/AgentChat.navigation";
/** 导出导航重建命令。 */
export {rebuildNavMarkers};
import {updateTokenDisplay} from "../metrics/AgentChat.metrics.methods";
/** 导出令牌展示命令。 */
export {updateTokenDisplay};
