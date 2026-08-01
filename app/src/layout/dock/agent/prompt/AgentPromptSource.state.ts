/** 用途：约束异步结果对应的会话；使用范围：提示词加载与操作一致性判断。 */
import type {AgentPanelConversation} from "./imports";
/** 用途：约束可观察提示词状态；使用范围：状态创建、重置和操作编号。 */
import type {AgentPromptSourceControllerState} from "./AgentPromptSource.types";
/** 用途：读取提示词上下文；使用范围：会话和交互一致性判断。 */
import type {AgentPromptSourceDomain} from "./AgentPromptSource.types";

/** 创建不持有隐式 DOM 或异步任务的可观察初始状态。 */
/** @同步豁免: 生命周期 - 控制器装配前必须立即取得独立状态，才能绑定同一实例的 DOM 和异步编号。 */
export function createPromptSourceControllerState() {
    return {
        elements: null,
        sourceState: null,
        errorMessage: "",
        loadSerial: 0,
        operationSerial: 0,
        operationPending: false,
        destroyed: false,
    } satisfies AgentPromptSourceControllerState;
}

/** 使已发出的加载和操作结果失效，并清空当前会话投影。 */
/** @同步豁免: 生命周期 - 会话切换必须原子递增两个编号并清空投影，避免旧异步结果在间隙提交。 */
export function resetPromptSourceControllerState(state: AgentPromptSourceControllerState) {
    state.loadSerial++;
    state.operationSerial++;
    state.operationPending = false;
    state.sourceState = null;
    state.errorMessage = "";
}

/** 判断异步结果是否仍属于当前活动会话。 */
/** @同步豁免: 生命周期 - 异步完成点必须立即对比当前会话与销毁状态，再决定是否提交结果。 */
export function isCurrentPromptSourceConversation(
    context: AgentPromptSourceDomain,
    conversation: AgentPanelConversation,
) {
    const current = context.runtime.getConversation();
    return !context.state.destroyed && !context.runtime.isDestroyed() &&
        current.kind === conversation.kind && current.sessionId === conversation.sessionId;
}

/** 判断一次加载结果是否仍可提交到可观察状态。 */
/** @同步豁免: 生命周期 - 加载完成点必须对同一状态快照核对编号和会话归属。 */
export function isCurrentPromptSourceLoad(
    context: AgentPromptSourceDomain,
    loadID: number,
    conversation: AgentPanelConversation,
) {
    return loadID === context.state.loadSerial && isCurrentPromptSourceConversation(context, conversation);
}

/** 判断当前 UI 是否接受新的提示词来源操作。 */
/** @同步豁免: 生命周期 - 点击处理必须立即读取流式、销毁和操作状态后决定是否启动副作用。 */
export function canInteractWithPromptSource(context: AgentPromptSourceDomain) {
    return !context.state.destroyed && !context.runtime.isDestroyed() && !context.runtime.isStreaming() &&
        !context.state.operationPending && context.runtime.getTargetPolicy().promptSourceVisible;
}

/** 开始一次有稳定编号的异步操作。 */
/** @同步豁免: 生命周期 - 操作编号递增和 pending 置位必须原子完成，异步请求随后才能发出。 */
export function beginPromptSourceOperation(state: AgentPromptSourceControllerState) {
    const operationID = ++state.operationSerial;
    state.operationPending = true;
    return operationID;
}

/** 仅结束编号仍匹配的操作，避免旧请求解锁新请求。 */
/** @同步豁免: 生命周期 - 异步完成点必须立即核对编号并只解除自身持有的操作状态。 */
export function finishPromptSourceOperation(state: AgentPromptSourceControllerState, operationID: number) {
    if (operationID !== state.operationSerial) {
        return false;
    }
    state.operationPending = false;
    return true;
}

/** 判断一次操作是否仍属于当前活动会话。 */
/** @同步豁免: 生命周期 - 异步动作每次提交前必须从同一状态快照核对编号与会话归属。 */
export function isCurrentPromptSourceOperation(
    context: AgentPromptSourceDomain,
    operationID: number,
    conversation: AgentPanelConversation,
) {
    return operationID === context.state.operationSerial && isCurrentPromptSourceConversation(context, conversation);
}
