/** 用途：约束控制器公开协议；使用范围：工厂返回值。 */
import type {AgentConversationController} from "./agentConversation.types";
/** 用途：约束 controller 工厂参数；使用范围：实例组合。 */
import type {AgentConversationControllerOptions} from "./agentConversation.types";
/** 用途：约束 controller 共享依赖；使用范围：职责函数绑定。 */
import type {AgentConversationControllerRuntime} from "./agentConversation.types";
/** 用途：约束 controller 状态；使用范围：实例初始化。 */
import type {AgentConversationState} from "./agentConversation.types";
/** 用途：创建实例级默认 reducer 注册表；使用范围：协议状态事件；解耦评估：调用方可通过 options 覆盖或追加。 */
import {createDefaultAgentConversationStateReducers} from "./AgentConversationController.state";
/** 用途：激活会话；使用范围：公开 controller 命令；解耦评估：顶级函数通过 bind 获取实例状态。 */
import {activateAgentConversation} from "./AgentConversationController.operations";
/** 用途：取消 queue 项；使用范围：公开 controller 命令；解耦评估：顶级函数通过 bind 获取实例状态。 */
import {cancelAgentConversationQueue} from "./AgentConversationController.operations";
/** 用途：释放 controller；使用范围：公开生命周期；解耦评估：顶级函数通过 bind 获取实例状态。 */
import {disposeAgentConversationController} from "./AgentConversationController.operations";
/** 用途：中断 turn；使用范围：公开 controller 命令；解耦评估：顶级函数通过 bind 获取实例状态。 */
import {interruptAgentConversation} from "./AgentConversationController.operations";
/** 用途：提升 queue 项；使用范围：公开 controller 命令；解耦评估：顶级函数通过 bind 获取实例状态。 */
import {promoteAgentConversationQueue} from "./AgentConversationController.operations";
/** 用途：设置 delivery；使用范围：公开 controller 命令；解耦评估：顶级函数通过 bind 获取实例状态。 */
import {setAgentConversationDelivery} from "./AgentConversationController.operations";
/** 用途：提交输入；使用范围：公开 controller 命令；解耦评估：顶级函数通过 bind 获取实例状态。 */
import {submitAgentConversation} from "./AgentConversationController.operations";
/** 用途：编辑 queue 项；使用范围：公开 controller 命令；解耦评估：顶级函数通过 bind 获取实例状态。 */
import {updateAgentConversationQueue} from "./AgentConversationController.operations";
/** 用途：建立事件订阅；使用范围：公开 controller 命令；解耦评估：订阅模块独立拥有资源。 */
import {connectAgentConversationController} from "./AgentConversationSubscription.factory";
/** 用途：刷新权威 queue；使用范围：公开 controller 命令；解耦评估：订阅模块集中网络恢复。 */
import {refreshAgentConversationController} from "./AgentConversationSubscription.factory";

const defaultReconnectDelayMs = 1000;

/**
 * 创建绑定到一个 AgentChat 实例的控制器。
 * @同步豁免: 生命周期 - 工厂只创建内存状态并绑定顶级职责函数，网络副作用由 activate/connect 显式触发。
 */
export function createAgentConversationController(options: AgentConversationControllerOptions) {
    const state: AgentConversationState = {
        adapter: options.adapters.resolve(options.initialKind), sessionID: "", activation: 0, eventSeq: 0,
        queueVersion: 0, queueItems: [], turnID: "", phase: "idle", steerable: false,
        selectedDelivery: "queue", subscriptionController: null, reconnectTimer: 0,
        submittingInputIDs: new Set<string>(), connected: false, disposed: false,
    };
    const runtime: AgentConversationControllerRuntime = {
        state,
        adapters: options.adapters,
        hooks: options.hooks,
        reconnectDelayMs: options.reconnectDelayMs ?? defaultReconnectDelayMs,
        stateReducers: {...createDefaultAgentConversationStateReducers(), ...options.stateReducers},
    };
    return {
        state,
        activate: activateAgentConversation.bind(null, runtime),
        connect: connectAgentConversationController.bind(null, runtime),
        refresh: refreshAgentConversationController.bind(null, runtime),
        dispose: disposeAgentConversationController.bind(null, runtime),
        submit: submitAgentConversation.bind(null, runtime),
        updateQueue: updateAgentConversationQueue.bind(null, runtime),
        cancelQueue: cancelAgentConversationQueue.bind(null, runtime),
        promoteQueue: promoteAgentConversationQueue.bind(null, runtime),
        interrupt: interruptAgentConversation.bind(null, runtime),
        setDelivery: setAgentConversationDelivery.bind(null, runtime),
    } satisfies AgentConversationController;
}
