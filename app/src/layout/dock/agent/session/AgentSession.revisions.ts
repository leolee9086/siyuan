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

/** 合并 Kernel 事件携带的 canonical 修订，避免后续提交使用晋升前的旧版本。 */
/** @同步豁免: 生命周期 - 会话事件与后续保存之间必须同步提升同一组合根的修订水位。 */
export function observeAgentSessionRevision(state: AgentSessionRevisionState, id: string, revision: number) {
    if (!Number.isSafeInteger(revision) || revision < 0) {
        return;
    }
    const current = state.revisions.get(id) ?? 0;
    // 只接受单调递增的 canonical 修订，乱序重放事件不得把后续保存降回旧版本。
    if (revision > current) {
        state.revisions.set(id, revision);
    }
}

/** 等待指定会话的排队保存完成。 */
export async function waitForAgentSessionSave(state: AgentSessionRevisionState, id: string) {
    const pending = state.pendingSaves.get(id);
    if (pending) {
        await pending;
    }
}
