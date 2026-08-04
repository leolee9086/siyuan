/** 用途：约束 admission；使用范围：乐观项对账。 */
import type {AgentConversationAdmission} from "./agentConversation.types";
/** 用途：约束 controller 共享依赖；使用范围：状态通知。 */
import type {AgentConversationControllerRuntime} from "./agentConversation.types";
/** 用途：约束 queue item；使用范围：乐观投影。 */
import type {AgentConversationQueueItem} from "./agentConversation.types";
/** 用途：约束 queue snapshot；使用范围：版本仲裁。 */
import type {AgentConversationQueueSnapshot} from "./agentConversation.types";
/** 用途：约束会话事件；使用范围：状态 reducer。 */
import type {AgentConversationSessionEvent} from "./agentConversation.types";
/** 用途：约束 reducer 注册表；使用范围：默认协议事件。 */
import type {AgentConversationStateReducer} from "./agentConversation.types";
/** 用途：约束统一输入；使用范围：乐观 queue item。 */
import type {AgentConversationSubmitInput} from "./agentConversation.types";
/** 用途：读取事件布尔字段；使用范围：session_state；解耦评估：纯守卫避免业务层类型断言。 */
import {readAgentEventBoolean} from "./AgentConversationEvent.guard";
/** 用途：读取事件字符串字段；使用范围：turn 状态；解耦评估：纯守卫避免业务层类型断言。 */
import {readAgentEventString} from "./AgentConversationEvent.guard";
/** 用途：校验嵌套 queue snapshot；使用范围：queue/session 事件；解耦评估：纯守卫集中 JSON 边界。 */
import {readAgentConversationQueueSnapshot} from "./AgentConversationEvent.guard";

/**
 * 根据输入构建一个仅用于 UI 乐观显示的 queue item。
 * @同步豁免: 生命周期 - admission 发出前必须在同一调用栈内建立占位项，确保先到达的权威事件能按 inputID 对账。
 */
export function createOptimisticQueueItem(input: AgentConversationSubmitInput) {
    return {
        input: {
            id: input.inputID,
            sessionId: input.sessionID,
            semantics: input.delivery === "steer" ? "steer" : "queue",
            content: input.message,
            ...(input.expectedTurnID ? {expectedTurnId: input.expectedTurnID} : {}),
            createdAt: Date.now(),
        },
        state: "pending",
        seq: Number.MAX_SAFE_INTEGER,
        queuePos: 0,
        optimistic: true,
    } satisfies AgentConversationQueueItem;
}

/**
 * 根据 admission 更新单个 optimistic 项，同时尊重已到达的权威快照。
 * @同步豁免: 生命周期 - HTTP admission 与 SSE 事件共享同一实例状态，版本和占位项必须原子地按到达顺序结算。
 */
export function applyAgentConversationAdmission(
    runtime: AgentConversationControllerRuntime,
    admission: AgentConversationAdmission,
) {
    // admission 的较高版本可以推进本地游标，但不会构造缺失的权威项。
    if (typeof admission.queueVersion === "number" && admission.queueVersion > runtime.state.queueVersion) {
        runtime.state.queueVersion = admission.queueVersion;
	}
	const item = runtime.state.queueItems.find((candidate) => candidate.input.id === admission.inputID);
	// SSE 已替换的权威项没有 optimistic 标记，迟到 admission 只能结算仍在等待确认的本地占位项。
	if (!item?.optimistic) {
		runtime.hooks.onStateChange(runtime.state);
		return;
	}
    // 服务端返回稳定序号时替换乐观占位序号。
    if (typeof admission.admittedSeq === "number") {
        item.seq = admission.admittedSeq;
    }
    item.optimistic = false;
    runtime.hooks.onStateChange(runtime.state);
}

/**
 * 把不落后的服务端 queue snapshot 覆盖到 controller 状态。
 * @同步豁免: 生命周期 - 版本比较与快照替换必须在同一事件处理栈内完成，防止旧 HTTP 响应覆盖新 SSE 状态。
 */
export function applyAgentConversationQueueSnapshot(
    runtime: AgentConversationControllerRuntime,
    snapshot: AgentConversationQueueSnapshot,
) {
    if (snapshot.queueVersion < runtime.state.queueVersion) {
        return false;
    }
    runtime.state.queueVersion = snapshot.queueVersion;
    runtime.state.queueItems = snapshot.items;
    return true;
}

/** 从 queue_state 应用权威队列。 */
function reduceQueueState(state: Parameters<AgentConversationStateReducer>[0], event: AgentConversationSessionEvent) {
    const snapshot = readAgentConversationQueueSnapshot(event.queue);
    if (!snapshot) {
        return true;
    }
    // 只接受相同或更高版本，避免迟到的 queue_state 回滚已呈现的权威队列。
    if (snapshot.queueVersion >= state.queueVersion) {
        state.queueVersion = snapshot.queueVersion;
        state.queueItems = snapshot.items;
    }
    return true;
}

/** 从 session_state 同步 turn、阶段、steer capability 和内嵌队列。 */
function reduceSessionState(state: Parameters<AgentConversationStateReducer>[0], event: AgentConversationSessionEvent) {
    const turnID = readAgentEventString(event, "turnID");
    const phase = readAgentEventString(event, "phase");
    const steerable = readAgentEventBoolean(event, "steerable");
    state.turnID = turnID ?? state.turnID;
    state.phase = phase ?? state.phase;
    state.steerable = steerable ?? state.steerable;
    return reduceQueueState(state, event);
}

/** 从 turn_phase 推导当前引导输入是否可被接受。 */
function reduceTurnPhase(state: Parameters<AgentConversationStateReducer>[0], event: AgentConversationSessionEvent) {
    const phase = readAgentEventString(event, "phase");
    const turnID = readAgentEventString(event, "turnID");
    state.phase = phase ?? state.phase;
    state.turnID = turnID ?? state.turnID;
    state.steerable = phase === "boundary" || phase === "provider_stream" || phase === "tool_running";
    return true;
}

/** commit barrier 结束后清空匹配的活动 turn。 */
function reduceTurnCommitted(state: Parameters<AgentConversationStateReducer>[0], event: AgentConversationSessionEvent) {
    const turnID = readAgentEventString(event, "turnID");
    if (turnID !== null && state.turnID !== turnID) {
        return true;
    }
    state.turnID = "";
    state.phase = "idle";
    state.steerable = false;
    return true;
}

/** 中断通知封闭当前 turn 的 steer admission。 */
function reduceInterrupted(state: Parameters<AgentConversationStateReducer>[0], event: AgentConversationSessionEvent) {
    const turnID = readAgentEventString(event, "turnID");
    if (turnID !== null && state.turnID !== turnID) {
        return true;
    }
    state.phase = "sealing";
    state.steerable = false;
    return true;
}

/**
 * 为每个 controller 创建独立 reducer 注册表；调用方可按事件 type 覆盖或追加实现。
 * @同步豁免: 生命周期 - controller 构造必须同步取得全新的注册表，避免测试、HMR 和实例间共享可变对象。
 */
export function createDefaultAgentConversationStateReducers() {
    return {
        queue_state: reduceQueueState,
        session_state: reduceSessionState,
        turn_phase: reduceTurnPhase,
        turn_committed: reduceTurnCommitted,
        interrupted: reduceInterrupted,
    };
}

/**
 * 尝试由注册 reducer 消费事件，并同步通知界面。
 * @同步豁免: 生命周期 - reducer 与界面通知属于单个 eventSeq 的原子投影，异步拆分会允许后续事件越过当前状态。
 */
export function reduceAgentConversationState(
    runtime: AgentConversationControllerRuntime,
    event: AgentConversationSessionEvent,
) {
    const reducer = runtime.stateReducers[event.type];
    if (!reducer) {
        return false;
    }
    const consumed = reducer(runtime.state, event);
    runtime.hooks.onStateChange(runtime.state);
    return consumed;
}
