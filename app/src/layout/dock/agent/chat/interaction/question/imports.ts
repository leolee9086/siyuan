/** 用途：约束问题卡片流程读取的聊天状态；使用范围：本目录全部函数。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时契约。 */
export type {AgentChatRuntime};

/** 用途：渲染问题卡片；使用范围：问题创建。 */
import {renderQuestionCardHTML} from "../../../AgentMessageRenderer";
/** 导出问题卡片渲染函数。 */
export {renderQuestionCardHTML};

/** 用途：收敛思考状态并插入问题卡片；使用范围：问题创建。 */
import {finishActiveThinking} from "../../ui/feedback/AgentChat.thinkingState";
/** 导出思考完成命令。 */
export {finishActiveThinking};
import {flushThinkingStep} from "../../stream/thinking/AgentChat.thinkingStep";
/** 导出思考步骤提交命令。 */
export {flushThinkingStep};
import {insertBeforeAI} from "../../ui/feedback/AgentChat.messagePlacement";
/** 导出消息插入命令。 */
export {insertBeforeAI};
import {scrollToBottom} from "../../ui/feedback/AgentChat.scrolling";
/** 导出消息贴底命令。 */
export {scrollToBottom};

/** 用途：持久化问题提交状态；使用范围：问题答案请求完成后。 */
import {saveSession} from "../../session/persistence/AgentChat.save";
/** 导出会话保存命令。 */
export {saveSession};
/** 用途：读取问题 API 返回；使用范围：问题答案提交。 */
import {readAPIResult} from "../AgentChat.api.guard";
/** 导出 API 结果守卫。 */
export {readAPIResult};
