/** 用途：约束发送流程读写的聊天状态；使用范围：本目录全部流程。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时契约。 */
export type {AgentChatRuntime};

/** 用途：约束发送时冻结的会话快照；使用范围：SSE 请求。 */
import type {AgentPanelConversation} from "../../../runtime/agentPanel.ports.types";
/** 导出面板会话协议。 */
export type {AgentPanelConversation};

/** 用途：读取当前浏览器能力清单；使用范围：原生 Agent 请求快照。 */
import {listCapabilityManifests} from "../../../frontendCapabilities";
/** 导出浏览器能力清单读取函数。 */
export {listCapabilityManifests};

/** 用途：发起 Agent SSE 请求；使用范围：原生 Agent 消息分派。 */
import {fetchAgentSSE} from "../../../agentSSE";
/** 导出 SSE 请求函数。 */
export {fetchAgentSSE};
/** 用途：识别 Agent 会话互斥错误；使用范围：请求错误分派；解耦评估：纯错误守卫不加载请求实现。 */
import {isAgentHTTPConflictError} from "../../../request/sse/agentSSE.error.guard";
/** 导出 Agent 会话互斥错误守卫。 */
export {isAgentHTTPConflictError};
/** 用途：约束 SSE 请求结果；使用范围：请求完成处理。 */
import type {ISSEResult} from "../../../request/sse/agentSSE.types";
/** 导出 SSE 结果类型。 */
export type {ISSEResult};


/** 用途：核对请求仍属于当前面板；使用范围：异步响应提交。 */
import {isActiveAgentPanelRequest} from "../../../runtime/agentPanel.request.guard";
/** 导出活动请求守卫。 */
export {isActiveAgentPanelRequest};

/** 用途：读取已初始化配置；使用范围：请求语言。 */
import {requireSiyuanConfig} from "../../AgentChat.environment";
/** 导出配置读取函数。 */
export {requireSiyuanConfig};

/** 用途：计算当前目标策略；使用范围：发送前能力检查。 */
import {resolveTargetPolicy} from "../../ui/model/AgentChat.targetPolicy";
/** 导出目标策略计算函数。 */
export {resolveTargetPolicy};
/** 用途：读取当前模型；使用范围：请求构造。 */
import {getSelectedModel} from "../../ui/model/AgentChat.model.methods";
/** 导出模型读取函数。 */
export {getSelectedModel};

/** 用途：保存新轮次；使用范围：请求发出前。 */
import {saveSession} from "../../session/persistence/AgentChat.save";
/** 导出会话保存命令。 */
export {saveSession};
/** 用途：恢复保存冲突；使用范围：请求准备失败。 */
import {reloadFromDisk} from "../../session/persistence/AgentChat.reload";
/** 导出会话重载命令。 */
export {reloadFromDisk};
/** 用途：恢复中断轮次；使用范围：发送前状态校验。 */
import {prepareForNewTurn} from "../../session/persistence/AgentChat.recoverTurn";
/** 导出新轮次准备命令。 */
export {prepareForNewTurn};

/** 用途：切换流式状态；使用范围：轮次开始和失败。 */
import {setStreaming} from "../../ui/feedback/AgentChat.streamingState";
/** 导出流式状态命令。 */
export {setStreaming};
/** 用途：清理思考界面；使用范围：新轮次开始。 */
import {clearThinking} from "../../ui/feedback/AgentChat.thinkingState";
/** 导出思考清理命令。 */
export {clearThinking};

/** 用途：追加用户消息；使用范围：新轮次开始。 */
import {appendUserMessage} from "../user/AgentChat.userMessage";
/** 导出用户消息追加命令。 */
export {appendUserMessage};
/** 用途：恢复待编辑草稿；使用范围：保存冲突。 */
import {restorePendingEditDraft} from "../user/AgentChat.userActions";
/** 导出编辑草稿恢复命令。 */
export {restorePendingEditDraft};

/** 用途：重建消息导航；使用范围：新轮次开始。 */
import {rebuildNavMarkers} from "../../ui/navigation/AgentChat.navigation";
/** 导出导航重建命令。 */
export {rebuildNavMarkers};

/** 用途：生成会话标题；使用范围：新轮次开始。 */
import {tryGenerateTitle} from "../../stream/response/AgentChat.finish.methods";
/** 导出标题生成命令。 */
export {tryGenerateTitle};
/** 用途：回滚用户条目；使用范围：请求失败。 */
import {rollbackUserEntry} from "../../stream/response/AgentChat.errorHandling";
/** 导出用户条目回滚命令。 */
export {rollbackUserEntry};
/** 用途：处理配置错误；使用范围：请求失败。 */
import {handleConfigError} from "../../stream/response/AgentChat.errorHandling";
/** 导出配置错误处理命令。 */
export {handleConfigError};
/** 用途：处理 MAGI 请求错误；使用范围：MAGI 流式分派。 */
import {handleError} from "../../stream/response/AgentChat.errorHandling";
/** 导出请求错误处理命令。 */
export {handleError};

/** 用途：处理 SSE 事件；使用范围：原生与 MAGI 流。 */
import {handleSSEEvent} from "../../stream/protocol/AgentChat.sse.methods";
/** 导出 SSE 事件处理命令。 */
export {handleSSEEvent};

/** 用途：创建 MAGI 标准模型适配器；使用范围：MAGI 消息分派。 */
import {createMagiStandardLLMAdapter} from "../../../../../../magi/adapters/magiStandardLLMAdapter";
/** 导出 MAGI 模型适配器工厂。 */
export {createMagiStandardLLMAdapter};
/** 用途：构建主界面身份；使用范围：MAGI 消息分派。 */
import {buildRuntimeMainInterfaceIdentity} from "../../../../../../magi/adapters/magiStandardLLMAdapter.backend";
/** 导出 MAGI 主界面身份构造函数。 */
export {buildRuntimeMainInterfaceIdentity};
/** 用途：约束 MAGI 界面身份；使用范围：适配器请求。 */
import type {MagiInterfaceIdentity} from "../../../../../../magi/adapters/magiStandardLLMAdapter.types";
/** 导出 MAGI 界面身份类型。 */
export type {MagiInterfaceIdentity};
/** 用途：约束 MAGI 流式片段；使用范围：流事件映射。 */
import type {StandardLLMStreamChunk} from "../../../../../../magi/types/llmAdapter.types";
/** 导出标准模型流式片段类型。 */
export type {StandardLLMStreamChunk};

/** 用途：约束统一 adapter 输入；使用范围：会话发送命令；解耦评估：纯类型经网关传递，发送编排不依赖具体 adapter 实现。 */
import type {AgentConversationSubmitInput} from "../../../runtime/conversation/agentConversation.types";
/** 导出统一提交输入。 */
export type {AgentConversationSubmitInput};
/** 用途：约束 adapter 观察器；使用范围：请求内流式目标；解耦评估：观察器只作为协议参数传入，事件投影不反向依赖传输模块。 */
import type {AgentConversationObserver} from "../../../runtime/conversation/agentConversation.types";
/** 导出 adapter 观察器协议。 */
export type {AgentConversationObserver};
/** 用途：识别结构化控制错误；使用范围：提交冲突自愈；解耦评估：复用控制层唯一错误守卫，不复制协议字段判断。 */
import {isAgentConversationControlError} from "../../../request/control/AgentConversationControl.guard";
/** 导出结构化控制错误守卫。 */
export {isAgentConversationControlError};
