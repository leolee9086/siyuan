/** 用途：约束 AgentChat 实例状态；使用范围：会话控制器组合根。 */
import type {AgentChatRuntime} from "../AgentChat.runtime.types";
/** 导出 AgentChat 运行时协议。 */
export type {AgentChatRuntime};
/** 用途：约束 controller 状态；使用范围：执行状态同步。 */
import type {AgentConversationState} from "../../runtime/conversation/agentConversation.types";
/** 导出 controller 状态协议。 */
export type {AgentConversationState};
/** 用途：约束会话事件；使用范围：消息投影 hook。 */
import type {AgentConversationSessionEvent} from "../../runtime/conversation/agentConversation.types";
/** 导出会话事件协议。 */
export type {AgentConversationSessionEvent};
/** 用途：创建实例级执行控制器；使用范围：AgentChat 组合根；解耦评估：控制器通过 runtime 参数绑定实例，组合根只负责装配，继续下沉为事件端口会增加间接层而不减少耦合。 */
import {createAgentConversationController} from "../../runtime/conversation/AgentConversationController.factory";
/** 导出 controller 工厂。 */
export {createAgentConversationController};
/** 用途：投影会话消息事件；使用范围：controller onEvent hook；解耦评估：投影函数通过 hook 接收 runtime，不读取全局目标状态，保留该网关可避免协议实现向组合根泄漏。 */
import {handleAgentConversationSessionEvent} from "../stream/protocol/AgentChat.sessionEvent";
/** 导出会话事件投影入口。 */
export {handleAgentConversationSessionEvent};
/** 用途：重载 canonical session；使用范围：replay resync；解耦评估：重载由既有仓储端口完成，controller 只通过组合根回调触发，直接注入仓储会破坏 AgentChat 现有生命周期边界。 */
import {reloadFromDisk} from "../session/persistence/AgentChat.reload";
/** 导出会话重载入口。 */
export {reloadFromDisk};
/** 用途：同步生成状态；使用范围：controller 状态投影；解耦评估：状态命令已经是 AgentChat 的唯一 UI 入口，通过 runtime 参数传递目标，拆分为事件总线会使状态更新失去顺序保证。 */
import {setStreaming} from "../ui/feedback/AgentChat.streamingState";
/** 导出生成状态命令。 */
export {setStreaming};
/** 用途：渲染统一投递与 queue 控件；使用范围：controller 状态 hook；解耦评估：控件渲染依赖统一能力协议而非具体 adapter，保留网关即可隔离 DOM，额外依赖注入不会减少共享面板耦合。 */
import {renderAgentConversationControls} from "../ui/queue/AgentChat.queueDock";
/** 导出会话控件投影。 */
export {renderAgentConversationControls};
/** 用途：清除未接管目标的投递与 queue 控件；使用范围：adapter 目标切换；解耦评估：DOM 所有权保留在 queue 模块，组合根只调用公开清理入口。 */
import {clearAgentConversationControls} from "../ui/queue/AgentChat.queueDock";
/** 导出会话控件清理入口。 */
export {clearAgentConversationControls};
