/** 用途：约束 SSE 事件处理状态；使用范围：本目录全部协议流程。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时契约。 */
export type {AgentChatRuntime};
/** 用途：约束 SSE 事件载荷；使用范围：协议分派。 */
import type {ISSEResult} from "../../../request/sse/agentSSE.types";
/** 导出 SSE 结果协议。 */
export type {ISSEResult};
/** 用途：约束长生命周期会话事件；使用范围：session event 投影。 */
import type {AgentConversationSessionEvent} from "../../../runtime/conversation/agentConversation.types";
/** 导出会话事件协议。 */
export type {AgentConversationSessionEvent};

/** 用途：追加问题卡片；使用范围：问题事件；解耦评估：协议投影必须复用唯一问题卡生命周期，参数复制会分裂交互状态。 */
import {appendQuestion} from "../../interaction/question/AgentChat.question.methods";
/** 导出问题追加命令。 */
export {appendQuestion};
/** 用途：结算问题卡片；使用范围：question_resolved 事件；解耦评估：复用问题领域唯一终态命令，避免协议层复制 DOM 状态机。 */
import {resolveQuestion} from "../../interaction/question/AgentChat.question.resolution";
/** 导出问题终态命令。 */
export {resolveQuestion};
/** 用途：追加令牌用量；使用范围：用量事件；解耦评估：指标状态由现有命令集中维护，事件层只转交已校验载荷。 */
import {appendUsage} from "../../interaction/metrics/AgentChat.metrics.methods";
/** 导出用量追加命令。 */
export {appendUsage};
/** 用途：追加确认卡片；使用范围：确认事件；解耦评估：确认响应与 DOM 状态归既有领域所有，协议层不复制该状态机。 */
import {appendConfirm} from "../../interaction/confirm/AgentChat.confirm.methods";
/** 导出确认追加命令。 */
export {appendConfirm};
/** 用途：结算确认卡片；使用范围：confirm_resolved 事件；解耦评估：复用确认领域唯一终态命令，避免协议层复制 DOM 状态机。 */
import {resolveConfirm} from "../../interaction/confirm/AgentChat.confirm.methods";
/** 导出确认终态命令。 */
export {resolveConfirm};
/** 用途：执行浏览器能力；使用范围：browser_capability_call 事件；解耦评估：注册表查询与回传由交互命令集中处理。 */
import {handleBrowserCapabilityCall} from "../../interaction/confirm/AgentChat.confirm.methods";
/** 导出浏览器能力处理命令。 */
export {handleBrowserCapabilityCall};
/** 用途：执行前端工具；使用范围：前端工具事件；解耦评估：工具注册和回传由现有命令统一处理，事件发射会增加无序中间层。 */
import {handleFrontendToolCall} from "../../interaction/confirm/AgentChat.confirm.methods";
/** 导出前端工具处理命令。 */
export {handleFrontendToolCall};
/** 用途：追加错误卡片；使用范围：错误事件；解耦评估：错误视图由既有唯一入口维护，协议转换不持有其 DOM。 */
import {appendError} from "../../interaction/errors/AgentChat.errorCards";
/** 导出错误追加命令。 */
export {appendError};
/** 用途：追加重试状态；使用范围：重试事件；解耦评估：重试卡和计数属于既有反馈领域，直接命令可保持事件顺序。 */
import {appendRetry} from "../../interaction/errors/AgentChat.errors.methods";
/** 导出重试追加命令。 */
export {appendRetry};

/** 用途：恢复权威会话；使用范围：冲突事件；解耦评估：磁盘重载已封装仓储边界，额外注入会重复 AgentChat 生命周期端口。 */
import {reloadFromDisk} from "../../session/persistence/AgentChat.reload";
/** 导出会话重载命令。 */
export {reloadFromDisk};
/** 用途：恢复中断轮次；使用范围：提交事件；解耦评估：恢复锁和提交屏障由现有会话命令集中维护，协议层只触发入口。 */
import {recoverInterruptedTurn} from "../../session/persistence/AgentChat.recoverTurn";
/** 导出中断轮次恢复命令。 */
export {recoverInterruptedTurn};

/** 用途：观察输入晋升后的 canonical 修订；使用范围：session-event 保存屏障；解耦评估：复用仓储修订水位避免协议层持有第二事实源。 */
import {observeAgentSessionRevision} from "../../../session/AgentSession.revisions";
/** 导出会话修订观察命令。 */
export {observeAgentSessionRevision};

/** 用途：追加运行中工具徽标；使用范围：工具开始事件；解耦评估：工具调用身份和 DOM 映射由工具状态模块唯一持有。 */
import {appendRunningToolBadge} from "../../interaction/tools/AgentChat.toolState";
/** 导出工具徽标命令。 */
export {appendRunningToolBadge};
/** 用途：查找当前工具调用；使用范围：工具状态事件；解耦评估：查找必须读取工具模块的权威索引，复制索引会产生漂移。 */
import {findCurrentToolCall} from "../../interaction/tools/AgentChat.toolState";
/** 导出工具调用查找函数。 */
export {findCurrentToolCall};
/** 用途：完成工具状态；使用范围：工具结束事件；解耦评估：完成动作与既有工具卡生命周期原子绑定，不经通用事件总线转发。 */
import {finishToolCall} from "../../interaction/tools/AgentChat.toolState";
/** 导出工具完成命令。 */
export {finishToolCall};
/** 用途：标记工具运行中；使用范围：工具开始事件；解耦评估：运行态由工具领域集中维护，协议层仅按顺序调用命令。 */
import {setToolCallRunning} from "../../interaction/tools/AgentChat.toolState";
/** 导出工具运行命令。 */
export {setToolCallRunning};

/** 用途：投影工具卡片事件；使用范围：工具开始、进度和结果事件；解耦评估：统一投影器避免三类事件各自复制工具 DOM 规则。 */
import {applyToolCardEvent} from "../../interaction/tools/AgentChat.toolCards";
/** 导出工具卡片领域命令。 */
export {applyToolCardEvent};

/** 用途：追加快照信息；使用范围：快照事件；解耦评估：快照卡渲染由既有命令拥有，协议层无需再抽象展示端口。 */
import {appendSnapshotInfo} from "../../interaction/snapshot/AgentChat.snapshot";
/** 导出快照追加命令。 */
export {appendSnapshotInfo};

/** 用途：提交待处理令牌；使用范围：事件边界；解耦评估：令牌缓冲属于消息流模块，边界提交必须调用其唯一刷新入口。 */
import {flushTokenUpdate} from "../../message/user/AgentChat.tokenStream";
/** 导出令牌提交命令。 */
export {flushTokenUpdate};
/** 用途：追加流式令牌；使用范围：内容事件；解耦评估：增量缓冲和渲染节流由现有模块维护，协议层不复制缓冲。 */
import {appendToken} from "../../message/user/AgentChat.tokenStream";
/** 导出令牌追加命令。 */
export {appendToken};
/** 用途：追加晋升或注入的用户消息；使用范围：session input 事件；解耦评估：复用唯一用户消息 DOM 入口可保持稳定 EntryID 去重。 */
import {appendUserMessage} from "../../message/user/AgentChat.userMessage";
/** 导出用户消息追加命令。 */
export {appendUserMessage};

/** 用途：处理错误事件；使用范围：协议分派；解耦评估：错误结算涉及流状态和会话恢复，继续由既有集中命令处理。 */
import {handleError} from "../response/AgentChat.errorHandling";
/** 导出错误处理命令。 */
export {handleError};
/** 用途：完成响应；使用范围：结束事件；解耦评估：响应提交、保存和控件释放必须保持既有原子顺序。 */
import {finishResponse} from "../response/AgentChat.finish.methods";
/** 导出响应完成命令。 */
export {finishResponse};
/** 用途：结算 steer 前的 assistant 段；使用范围：同 turn 分段；解耦评估：分段命令集中处理条目、DOM 和临时状态，协议层只确定边界。 */
import {finishAssistantSegment} from "../response/AgentChat.segment.methods";
/** 导出 assistant 分段命令。 */
export {finishAssistantSegment};
/** 用途：追加思考正文；使用范围：思考事件；解耦评估：思考卡缓冲和展示状态由既有模块唯一维护。 */
import {appendThinking} from "../thinking/AgentChat.thinking.methods";
/** 导出思考追加命令。 */
export {appendThinking};
/** 用途：追加推理正文；使用范围：推理事件；解耦评估：推理投影与思考卡生命周期耦合，复用命令避免重复状态。 */
import {appendReasoning} from "../thinking/AgentChat.thinking.methods";
/** 导出推理追加命令。 */
export {appendReasoning};

/** 用途：切换流式状态；使用范围：协议恢复；解耦评估：共享控件锁由既有状态命令集中维护，协议层不直接操作 DOM。 */
import {setStreaming} from "../../ui/feedback/AgentChat.streamingState";
/** 导出流式状态命令。 */
export {setStreaming};
/** 用途：重建用户消息导航；使用范围：session input 事件；解耦评估：导航索引由现有模块权威计算，事件层仅在条目落地后触发。 */
import {rebuildNavMarkers} from "../../ui/navigation/AgentChat.navigation";
/** 导出导航重建命令。 */
export {rebuildNavMarkers};
