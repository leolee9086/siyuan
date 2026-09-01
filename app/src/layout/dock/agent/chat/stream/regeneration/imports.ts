/** 用途：约束重新生成流程读写状态；使用范围：本目录全部流程。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时契约。 */
export type {AgentChatRuntime};
/** 用途：约束被重新生成的用户条目；使用范围：历史裁剪。 */
import type {UserEntry} from "../../AgentChat.runtime.types";
/** 导出用户条目类型。 */
export type {UserEntry};
/** 用途：读取当前浏览器能力清单；使用范围：原生 Agent 重新生成请求。 */
import {listCapabilityManifests} from "../../../frontendCapabilities";
/** 导出浏览器能力清单读取函数。 */
export {listCapabilityManifests};

/** 用途：发起旧链路重新生成 SSE；使用范围：未注册执行 adapter 的原生 Agent；解耦评估：网关只转出既有请求入口，调用方不依赖请求目录结构。 */
import {fetchAgentSSE} from "../../../agentSSE";
/** 导出 SSE 请求函数。 */
export {fetchAgentSSE};
/** 用途：识别 Agent 会话互斥错误；使用范围：旧链路错误分派；解耦评估：纯错误守卫适合经网关复用，无需状态注入。 */
import {isAgentHTTPConflictError} from "../../../request/sse/agentSSE.error.guard";
/** 导出 Agent 会话互斥错误守卫。 */
export {isAgentHTTPConflictError};
/** 用途：核对请求仍属于当前面板；使用范围：旧链路异步响应提交；解耦评估：纯身份守卫集中既有比较规则。 */
import {isActiveAgentPanelRequest} from "../../../runtime/agentPanel.request.guard";
/** 导出活动请求守卫。 */
export {isActiveAgentPanelRequest};
/** 用途：过滤历史引用；使用范围：重新生成请求；解耦评估：纯历史函数经网关复用，不持有运行时。 */
import {filterAgentReferencesForContent} from "../../message/history/AgentHistory";
/** 导出引用过滤函数。 */
export {filterAgentReferencesForContent};
/** 用途：查找用户条目位置；使用范围：历史裁剪；解耦评估：纯查找规则经网关复用，避免索引逻辑复制。 */
import {findAgentUserEntryIndex} from "../../message/history/AgentHistory";
/** 导出用户条目查找函数。 */
export {findAgentUserEntryIndex};
/** 用途：核对重新生成状态；使用范围：异步响应提交；解耦评估：纯版本守卫经网关复用。 */
import {isAgentRegenerateStateCurrent} from "../../message/history/AgentHistory";
/** 导出重新生成状态守卫。 */
export {isAgentRegenerateStateCurrent};

/** 用途：读取已初始化配置；使用范围：旧链路请求语言；解耦评估：环境读取边界已集中，网关避免深层路径依赖。 */
import {requireSiyuanConfig} from "../../AgentChat.environment";
/** 导出配置读取函数。 */
export {requireSiyuanConfig};
/** 用途：计算当前目标策略；使用范围：重新生成能力检查；解耦评估：目标差异集中在纯策略边界。 */
import {resolveTargetPolicy} from "../../ui/model/AgentChat.targetPolicy";
/** 导出目标策略计算函数。 */
export {resolveTargetPolicy};
/** 用途：读取当前模型；使用范围：旧链路请求构造；解耦评估：模型选择规则继续由 UI 模块唯一维护。 */
import {getSelectedModel} from "../../ui/model/AgentChat.model.methods";
/** 导出模型读取函数。 */
export {getSelectedModel};

/** 用途：移除镜像占位；使用范围：重新生成开始；解耦评估：镜像 DOM 所有权保留在会话视图模块。 */
import {removeMirrorPlaceholder} from "../../session/view/AgentChat.mirror";
/** 导出镜像占位移除命令。 */
export {removeMirrorPlaceholder};
/** 用途：准备新轮次；使用范围：重新生成开始；解耦评估：恢复和提交屏障保留在会话持久化模块。 */
import {prepareForNewTurn} from "../../session/persistence/AgentChat.recoverTurn";
/** 导出新轮次准备命令。 */
export {prepareForNewTurn};

/** 用途：校验历史可重新生成；使用范围：历史裁剪；解耦评估：消息动作领域拥有唯一资格规则。 */
import {canRegenerateHistoryFrom} from "../../message/actions/AgentChat.assistantActions";
/** 导出历史重新生成守卫。 */
export {canRegenerateHistoryFrom};
/** 用途：恢复待编辑草稿；使用范围：失败恢复；解耦评估：用户编辑状态保留在唯一动作模块。 */
import {restorePendingEditDraft} from "../../message/user/AgentChat.userActions";
/** 导出编辑草稿恢复命令。 */
export {restorePendingEditDraft};
/** 用途：创建用户消息元素；使用范围：历史重绘；解耦评估：用户 DOM 结构由唯一消息工厂维护。 */
import {createUserMessage} from "../../message/user/AgentChat.userMessage";
/** 导出用户消息创建函数。 */
export {createUserMessage};
/** 用途：渲染用户消息；使用范围：历史重绘；解耦评估：块内容渲染由唯一用户消息入口维护。 */
import {renderUserMessage} from "../../message/user/AgentChat.userMessage";
/** 导出用户消息渲染命令。 */
export {renderUserMessage};
/** 用途：通过活动 adapter 重新生成；使用范围：历史裁剪完成后；解耦评估：目标差异集中在 conversation adapter，共享历史流程不再分支。 */
import {submitAgentChatRegeneration} from "../../message/sending/AgentChat.conversationSend";
/** 导出统一重新生成提交命令。 */
export {submitAgentChatRegeneration};
/** 用途：发送 MAGI 消息；使用范围：未注册本轮 controller 的 MAGI 重新生成；解耦评估：网关只转出既有入口，不让 native adapter 依赖 MAGI 传输。 */
import {sendMagiMessage} from "../../message/sending/AgentChat.magiSend";
/** 导出 MAGI 发送命令。 */
export {sendMagiMessage};
/** 用途：处理旧链路保存冲突；使用范围：请求失败；解耦评估：冲突恢复由发送领域集中维护。 */
import {handleConflictReject} from "../../message/sending/AgentChat.conflict";
/** 导出冲突处理命令。 */
export {handleConflictReject};

/** 用途：观察重新生成消息；使用范围：历史重绘；解耦评估：滚动资源所有权保留在反馈领域。 */
import {observeStickTarget} from "../../ui/feedback/AgentChat.scrolling";
/** 导出贴底观察命令。 */
export {observeStickTarget};
/** 用途：重建消息导航；使用范围：历史重绘；解耦评估：导航索引由唯一导航模块维护。 */
import {rebuildNavMarkers} from "../../ui/navigation/AgentChat.navigation";
/** 导出导航重建命令。 */
export {rebuildNavMarkers};
/** 用途：切换流式状态；使用范围：重新生成生命周期；解耦评估：控件投影由统一反馈状态函数维护。 */
import {setStreaming} from "../../ui/feedback/AgentChat.streamingState";
/** 导出流式状态命令。 */
export {setStreaming};

/** 用途：处理旧链路 SSE 事件；使用范围：原生重新生成；解耦评估：协议投影保持唯一实现，避免在重新生成模块复制。 */
import {handleSSEEvent} from "../protocol/AgentChat.sse.methods";
/** 导出 SSE 事件处理命令。 */
export {handleSSEEvent};
/** 用途：处理旧链路配置错误；使用范围：请求失败；解耦评估：错误呈现与恢复由响应领域集中维护。 */
import {handleConfigError} from "../response/AgentChat.errorHandling";
/** 导出配置错误处理命令。 */
export {handleConfigError};
