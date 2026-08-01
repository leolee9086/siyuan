/** 用途：约束会话修订状态；使用范围：组合根状态与仓储队列。 */
import type {AgentSessionRevisionState} from "./AgentSession.types";
/** 用途：约束排队保存结果；使用范围：会话保存队列。 */
import type {SessionSaveResult} from "./AgentSession.types";

/** 创建一个由 AgentChat 组合根持有的会话修订状态。 */
/** @同步豁免: 生命周期 - AgentChat 组合根必须在装配仓储端口前立即取得独立修订状态。 */
export function createAgentSessionRevisionState() {
    return {
        revisions: new Map<string, number>(),
        runtimeRevisions: new Map<string, number>(),
        pendingSaves: new Map<string, Promise<SessionSaveResult>>(),
    } satisfies AgentSessionRevisionState;
}

/** 返回当前组合根已经观察到的会话修订。 */
/** @同步豁免: 生命周期 - 发送请求前必须从同一状态快照立即读取会话修订，避免异步间隙改变版本。 */
export function getAgentSessionRevision(state: AgentSessionRevisionState, id: string) {
    return state.revisions.get(id) ?? 0;
}

/** 等待指定会话的排队保存完成。 */
export async function waitForAgentSessionSave(state: AgentSessionRevisionState, id: string) {
    const pending = state.pendingSaves.get(id);
    if (pending) {
        await pending;
    }
}
