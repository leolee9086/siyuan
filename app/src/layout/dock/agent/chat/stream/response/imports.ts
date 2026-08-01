/** 用途：约束响应收尾状态；使用范围：本目录全部流程。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时契约。 */
export type {AgentChatRuntime};
/** 用途：约束会话条目；使用范围：响应提交。 */
import type {SessionEntry} from "../../AgentChat.runtime.types";
/** 导出会话条目类型。 */
export type {SessionEntry};
/** 用途：约束持久化会话；使用范围：权威状态协调。 */
import type {AgentSession} from "../../../session/AgentSession.types";
/** 导出持久化会话类型。 */
export type {AgentSession};

/** 用途：读取已初始化配置；使用范围：标题生成语言。 */
import {requireSiyuanConfig} from "../../AgentChat.environment";
/** 导出配置读取函数。 */
export {requireSiyuanConfig};
/** 用途：转义错误消息；使用范围：错误卡片。 */
import {escapeHtml} from "../../../../../../util/DOM/escape";
/** 导出 HTML 转义函数。 */
export {escapeHtml};

/** 用途：渲染完整会话；使用范围：权威状态协调。 */
import {renderLoadedSession} from "../../message/projection/AgentChat.sessionRender.methods";
/** 导出会话渲染命令。 */
export {renderLoadedSession};
/** 用途：完成流式助手正文；使用范围：响应收尾。 */
import {finalizeStreamingBody} from "../../message/projection/AgentChat.assistantBody";
/** 导出助手正文完成命令。 */
export {finalizeStreamingBody};
/** 用途：渲染助手 Markdown；使用范围：响应收尾。 */
import {renderAssistantMarkdown} from "../../message/projection/AgentChat.persisted.methods";
/** 导出助手 Markdown 渲染函数。 */
export {renderAssistantMarkdown};
/** 用途：执行助手后处理；使用范围：响应收尾。 */
import {postRenderAssistant} from "../../message/projection/AgentChat.persisted.methods";
/** 导出助手后处理函数。 */
export {postRenderAssistant};
/** 用途：压缩工具调用；使用范围：助手条目持久化。 */
import {slimToolCallsForPersistence} from "../../message/projection/AgentChat.toolPersistence";
/** 导出工具调用压缩函数。 */
export {slimToolCallsForPersistence};
/** 用途：附加复制按钮；使用范围：响应收尾。 */
import {addCopyButton} from "../../message/actions/AgentChat.assistantActions";
/** 导出复制按钮命令。 */
export {addCopyButton};
/** 用途：恢复待编辑草稿；使用范围：错误回滚。 */
import {restorePendingEditDraft} from "../../message/user/AgentChat.userActions";
/** 导出编辑草稿恢复命令。 */
export {restorePendingEditDraft};
/** 用途：提交待处理令牌；使用范围：响应收尾。 */
import {flushTokenUpdate} from "../../message/user/AgentChat.tokenStream";
/** 导出令牌提交命令。 */
export {flushTokenUpdate};

/** 用途：判断消息视图是否贴底；使用范围：权威状态协调。 */
import {isScrolledToBottom} from "../../session/persistence/AgentChat.reload";
/** 导出贴底状态函数。 */
export {isScrolledToBottom};
/** 用途：重载权威会话；使用范围：冲突与错误恢复。 */
import {reloadFromDisk} from "../../session/persistence/AgentChat.reload";
/** 导出会话重载命令。 */
export {reloadFromDisk};
/** 用途：同步会话元数据；使用范围：权威状态协调。 */
import {updateMetaFromSession} from "../../session/persistence/AgentChat.reload";
/** 导出元数据同步命令。 */
export {updateMetaFromSession};
/** 用途：恢复中断轮次；使用范围：错误处理。 */
import {recoverInterruptedTurn} from "../../session/persistence/AgentChat.recoverTurn";
/** 导出中断轮次恢复命令。 */
export {recoverInterruptedTurn};
/** 用途：保存响应结果；使用范围：响应收尾与错误回滚。 */
import {saveSession} from "../../session/persistence/AgentChat.save";
/** 导出会话保存命令。 */
export {saveSession};

/** 用途：滚动到思考卡片下方；使用范围：响应正文开始。 */
import {scrollToThinkingCardBelow} from "../../ui/feedback/AgentChat.scrolling";
/** 导出思考卡片滚动命令。 */
export {scrollToThinkingCardBelow};
/** 用途：滚动到消息底部；使用范围：响应收尾。 */
import {scrollToBottom} from "../../ui/feedback/AgentChat.scrolling";
/** 导出消息滚动命令。 */
export {scrollToBottom};
/** 用途：观察流式正文；使用范围：响应元素。 */
import {observeStickTarget} from "../../ui/feedback/AgentChat.scrolling";
/** 导出贴底观察命令。 */
export {observeStickTarget};
/** 用途：完成活动思考；使用范围：响应收尾。 */
import {finishActiveThinking} from "../../ui/feedback/AgentChat.thinkingState";
/** 导出思考完成命令。 */
export {finishActiveThinking};
/** 用途：清理思考界面；使用范围：错误回滚。 */
import {clearThinking} from "../../ui/feedback/AgentChat.thinkingState";
/** 导出思考清理命令。 */
export {clearThinking};
/** 用途：切换流式状态；使用范围：响应收尾与错误恢复。 */
import {setStreaming} from "../../ui/feedback/AgentChat.streamingState";
/** 导出流式状态命令。 */
export {setStreaming};

/** 用途：读取当前模型；使用范围：会话元数据保存。 */
import {getSelectedModel} from "../../ui/model/AgentChat.model.methods";
/** 导出模型读取函数。 */
export {getSelectedModel};
/** 用途：刷新令牌展示；使用范围：响应收尾。 */
import {updateTokenDisplay} from "../../interaction/metrics/AgentChat.metrics.methods";
/** 导出令牌展示命令。 */
export {updateTokenDisplay};
/** 用途：重建消息导航；使用范围：响应收尾与错误恢复。 */
import {rebuildNavMarkers} from "../../ui/navigation/AgentChat.navigation";
/** 导出导航重建命令。 */
export {rebuildNavMarkers};
/** 用途：提交思考步骤；使用范围：响应收尾与错误处理。 */
import {flushThinkingStep} from "../thinking/AgentChat.thinkingStep";
/** 导出思考步骤提交命令。 */
export {flushThinkingStep};
