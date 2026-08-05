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

/** 用途：计算目标展示策略；使用范围：条目投影；解耦评估：该纯策略由模型展示领域统一维护，参数注入会扩大每个投影调用契约，本网关已隔离具体实现路径。 */
import {resolveTargetPolicy} from "../../ui/model/AgentChat.targetPolicy";
/** 导出目标策略计算函数。 */
export {resolveTargetPolicy};

/** 用途：追加用户消息；使用范围：历史会话投影；解耦评估：该命令接收运行时参数且不持有共享状态，事件转发会破坏同步投影顺序，本网关用于复用唯一用户消息构建入口。 */
import {appendUserMessage} from "../user/AgentChat.userMessage";
/** 导出用户消息追加命令。 */
export {appendUserMessage};

/** 用途：追加快照信息；使用范围：历史会话投影；解耦评估：快照 DOM 结构由交互领域统一维护，调用已显式传入运行时，继续通过网关复用可避免复制结构。 */
import {appendSnapshotInfo} from "../../interaction/snapshot/AgentChat.snapshot";
/** 导出快照追加命令。 */
export {appendSnapshotInfo};
/** 用途：追加回滚信息；使用范围：历史会话投影；解耦评估：回滚 DOM 结构由交互领域统一维护，事件发射会增加无必要的异步时序，本网关保持同步调用边界。 */
import {appendRollbackInfo} from "../../interaction/snapshot/AgentChat.snapshot";
/** 导出回滚追加命令。 */
export {appendRollbackInfo};
/** 用途：渲染合并思考卡片；使用范围：历史思考条目；解耦评估：指标领域拥有思考卡片的聚合规则，调用已依赖运行时契约，网关复用比新增渲染器注入项更窄。 */
import {renderMergedThinkingCard} from "../../interaction/metrics/AgentChat.metrics.methods";
/** 导出思考卡片渲染命令。 */
export {renderMergedThinkingCard};

/** 用途：附加助手复制按钮；使用范围：助手消息投影；解耦评估：按钮命令通过运行时能力执行宿主动作，网关只复用统一 DOM 装配规则，不直接绑定宿主实现。 */
import {addCopyButton} from "../actions/AgentChat.assistantActions";
/** 导出复制按钮命令。 */
export {addCopyButton};

/** 用途：维持助手消息可见；使用范围：助手正文更新；解耦评估：滚动命令只接收运行时并集中处理容器状态，事件转发会使渲染完成顺序不确定，保留同步网关调用。 */
import {scrollToBottom} from "../../ui/feedback/AgentChat.scrolling";
/** 导出消息滚动命令。 */
export {scrollToBottom};
/** 用途：格式化工具类别；使用范围：确认条目投影；解耦评估：该纯展示映射不读取会话状态，参数注入没有替换需求，本网关隔离反馈模块的物理路径。 */
import {toolCategory} from "../../ui/feedback/AgentChat.presentation";
/** 导出工具类别函数。 */
export {toolCategory};

/** 用途：约束确认副作用；使用范围：持久化确认条目。 */
import type {IToolEffects} from "../../../request/sse/agentSSE.types";
/** 导出工具副作用类型。 */
export type {IToolEffects};

/** 用途：执行通用消息后处理；使用范围：持久化消息投影；解耦评估：运行时 capabilities 已允许宿主注入 postRender，此导入仅提供既有消息渲染器的兼容回退。 */
import {postRender} from "../../../AgentMessageRenderer";
/** 导出消息后处理函数。 */
export {postRender};
/** 用途：渲染问题卡片；使用范围：持久化问题条目；解耦评估：实时与持久化路径必须共享同一问题结构，现阶段由既有渲染器唯一维护，本网关防止业务模块反向扩散依赖。 */
import {renderQuestionCardHTML} from "../../../AgentMessageRenderer";
/** 导出问题卡片渲染函数。 */
export {renderQuestionCardHTML};
/** 用途：渲染待办工具结果；使用范围：持久化工具条目；解耦评估：该纯渲染函数是实时与重建路径的共同协议，参数注入无运行时替换需求，本网关集中兼容依赖。 */
import {renderTodoList} from "../../../AgentMessageRenderer";
/** 导出待办列表渲染函数。 */
export {renderTodoList};

/** 用途：渲染通用工具结果；使用范围：持久化工具条目；解耦评估：工具调用领域拥有唯一结果格式且函数只接收数据，通过网关复用比在投影层复制或注入规则更稳定。 */
import {renderToolCallResult} from "../../interaction/tools/toolcall/renderer";
/** 导出工具结果渲染函数。 */
export {renderToolCallResult};

/** 用途：收集网页搜索引用；使用范围：搜索工具投影；解耦评估：该纯解析器定义网页引用协议且不读取 UI，参数传递只会转移依赖，本网关维持领域单一来源。 */
import {collectWebSearchReferences} from "../../interaction/tools/websearch/renderer";
/** 导出网页引用收集函数。 */
export {collectWebSearchReferences};
/** 用途：规范化网页地址；使用范围：搜索工具投影；解耦评估：该纯函数与引用验证规则共同演进，经网关复用可避免投影层形成第二套 URL 规则。 */
import {normalizeWebURL} from "../../interaction/tools/websearch/renderer";
/** 导出网页地址规范化函数。 */
export {normalizeWebURL};
/** 用途：隔离未验证网页链接；使用范围：搜索工具投影；解耦评估：链接保护需要统一操作已渲染 DOM，回调已注入打开确认行为，网关仅保留领域算法依赖。 */
import {protectUnverifiedWebLinks} from "../../interaction/tools/websearch/renderer";
/** 导出网页链接保护函数。 */
export {protectUnverifiedWebLinks};
/** 用途：渲染网页搜索结果；使用范围：搜索工具投影；解耦评估：该纯渲染器同时服务实时与持久化结果，注入会扩大运行时契约，本网关隔离其物理位置。 */
import {renderWebSearchResult} from "../../interaction/tools/websearch/renderer";
/** 导出网页搜索渲染函数。 */
export {renderWebSearchResult};
/** 用途：解析已映射网页引用；使用范围：助手正文投影；解耦评估：该纯解析器与引用收集器共享协议，保持同领域实现可防止 token 映射规则在投影层分叉。 */
import {resolveMappedWebReferences} from "../../interaction/tools/websearch/renderer";
/** 导出网页引用解析函数。 */
export {resolveMappedWebReferences};

/** 用途：转义工具输出；使用范围：持久化工具投影；解耦评估：通用转义函数构成统一 HTML 安全边界且无状态，注入或复制均会增加规则漂移风险。 */
import {escapeHtml} from "../../../../../../util/DOM/escape";
/** 导出 HTML 转义函数。 */
export {escapeHtml};

/** 用途：渲染确认效果；使用范围：持久化确认条目；解耦评估：该纯展示函数由反馈领域统一维护，调用方仅传入效果数据，网关已避免直接跨目录依赖。 */
import {renderConfirmEffects} from "../../ui/feedback/AgentChat.presentation";
/** 导出确认效果渲染函数。 */
export {renderConfirmEffects};
/** 用途：映射持久化交互终态；使用范围：确认和问题只读卡片；解耦评估：状态文案映射必须由实时与持久化卡片共享，纯函数无需能力注入，本网关维持单一语义来源。 */
import {resolveInteractionStatusLabel} from "../../interaction/AgentChat.interactionStatus";
/** 导出交互终态标签函数。 */
export {resolveInteractionStatusLabel};
