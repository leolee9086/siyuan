/** 用途：约束 AgentChat 实例状态；使用范围：会话执行控制器组合根。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束 controller 可观察状态；使用范围：实例状态同步。 */
import type {AgentConversationState} from "./imports";
/** 用途：约束会话事件；使用范围：消息投影 hook。 */
import type {AgentConversationSessionEvent} from "./imports";
/** 用途：创建实例级执行控制器；使用范围：AgentChat 构造阶段；解耦评估：网络副作用仍由显式 activate 触发。 */
import {createAgentConversationController} from "./imports";
/** 用途：投影统一会话事件；使用范围：controller 消息 hook；解耦评估：协议转换集中在流式协议模块。 */
import {handleAgentConversationSessionEvent} from "./imports";
/** 用途：重载上游兼容会话；使用范围：事件游标过旧后的 resync；解耦评估：controller 已通过 hook 注入，本组合根只登记既有会话端口。 */
import {reloadFromDisk} from "./imports";
/** 用途：同步生成状态与输入控件；使用范围：controller 状态 hook；解耦评估：状态同步集中在组合根，避免 adapter 直接访问 DOM。 */
import {setStreaming} from "./imports";
/** 用途：投影投递模式和 queue dock；使用范围：controller 状态 hook；解耦评估：控制器组合根只调用共享 UI 端口，不读取具体 adapter 目标。 */
import {renderAgentConversationControls} from "./imports";
/** 用途：清除未注册目标的控制器投影；使用范围：目标切换；解耦评估：DOM 清理由 queue 控件模块集中实现，组合根只在 adapter 注册状态变化时调用。 */
import {clearAgentConversationControls} from "./imports";

/** 把执行器状态同步到既有 AgentChat 公开字段，不复制 adapter 的目标判断。 */
function applyAgentConversationState(runtime: AgentChatRuntime, state: AgentConversationState) {
    if (state.turnID) {
        runtime.currentTurnID = state.turnID;
    }
    const active = Boolean(state.turnID) && state.phase !== "idle" && state.phase !== "awaiting_commit";
    // 执行器阶段与当前界面锁不一致时才更新 DOM，避免每个 queue_state 事件重复切换控件。
    if (active !== runtime.isStreaming) {
        setStreaming(runtime, active);
    }
    renderAgentConversationControls(runtime, state);
}

/** 只为仍活动的同一会话执行权威重载。 */
async function resyncAgentConversation(runtime: AgentChatRuntime, sessionID: string) {
    if (runtime.agentDestroyed || runtime.sessionId !== sessionID) {
        return;
    }
    await reloadFromDisk(runtime, true);
}

/**
 * 为单个 AgentChat 实例装配可插拔会话执行控制器。
 * @同步豁免: 生命周期 - 构造函数在会话初始化前必须同步取得唯一控制器，网络连接由后续 activate 建立。
 */
// controller hooks 捕获当前 AgentChat 实例，使异步事件只回写所属视图。
// @柯里化
export function createAgentChatConversationController(runtime: AgentChatRuntime) {
    const adapters = runtime.conversationAdapters;
    if (!adapters.find(runtime.conversationKind)) {
        return null;
    }
    return createAgentConversationController({
        adapters,
        initialKind: runtime.conversationKind,
        hooks: {
            requestHeaders: runtime.sessionPorts.requestHeaders,
            /** provider 和输入事件统一进入 AgentChat 消息投影。 */
            onEvent: (event: AgentConversationSessionEvent) => handleAgentConversationSessionEvent(runtime, event),
            /** controller 状态只通过这一处写回既有公开运行时。 */
            onStateChange: (state: AgentConversationState) => applyAgentConversationState(runtime, state),
            /** replay 游标失效时重载 canonical session，queue 已由 controller 自行刷新。 */
            onResync: (sessionID: string) => resyncAgentConversation(runtime, sessionID),
        },
    });
}

/**
 * 在目标切换后按注册表重建执行控制器；未注册目标不进入这套生命周期。
 * @同步豁免: 生命周期 - 目标字段写入后必须在同一调用栈内撤销旧订阅并确定新控制器所有权，异步窗口会让旧目标继续接收事件。
 */
export function syncAgentChatConversationController(runtime: AgentChatRuntime) {
    const registered = runtime.conversationAdapters.find(runtime.conversationKind);
    const current = runtime.conversationController;
    if (!registered) {
        current?.dispose();
        runtime.conversationController = null;
        clearAgentConversationControls(runtime);
        return null;
    }
    if (current?.state.adapter.kind === registered.kind) {
        return current;
    }
    current?.dispose();
    const controller = createAgentChatConversationController(runtime);
    runtime.conversationController = controller;
    return controller;
}
