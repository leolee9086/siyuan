/** 用途：约束运行时契约；使用范围：恢复轮次状态读写；解耦评估：通过目录网关导入，隔离父级依赖。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束会话类型；使用范围：恢复轮次负载读取；解耦评估：通过目录网关导入，隔离父级依赖。 */
import type {AgentSession} from "./imports";
/** 用途：从磁盘重载当前会话；使用范围：提交恢复轮次前；解耦评估：重载属于会话职责，集中调用避免重复实现。 */
import {reloadFromDisk} from "./AgentChat.reload";
/** 用途：保存会话；使用范围：提交恢复轮次后；解耦评估：保存属于会话职责，集中调用避免重复实现。 */
import {saveSession} from "./AgentChat.save";

/** 在内核已结束且没有恢复记录时解除本地恢复锁。 */
function settleCompletedAgentRecovery(runtime: AgentChatRuntime, input: {
    sessionID: string;
    turnID: string;
    session: AgentSession | null;
}) {
    const {sessionID, turnID, session} = input;
    if (!session || session.agentRunning) {
        return false;
    }
    runtime.pendingRecoverySessionIDs.delete(sessionID);
    // 未指定轮次或当前轮次仍与恢复轮次一致时，一并清除本地轮次标记。
    if (!turnID || runtime.currentTurnID === turnID) {
        runtime.currentTurnID = "";
    }
    return true;
}

/** 重载并提交一个可恢复轮次。 */
async function commitRecoveredAgentTurn(runtime: AgentChatRuntime, sessionID: string, session: AgentSession) {
    await reloadFromDisk(runtime, true);
    if (runtime.sessionId !== sessionID) {
        return "stopped" as const;
    }
    if (runtime.recoveryCommitTurnIDs.get(sessionID) !== session.recoveryTurnID) {
        return "retry" as const;
    }
    runtime.currentTurnID = "";
    await saveSession(runtime);
    runtime.pendingRecoverySessionIDs.delete(sessionID);
    return "committed" as const;
}

/** 读取并提交被中断轮次的权威恢复记录；后续尝试由会话更新信号再次触发。 */
export async function recoverInterruptedTurn(runtime: AgentChatRuntime, sessionID: string, turnID = "") {
    runtime.pendingRecoverySessionIDs.add(sessionID);
    if (runtime.recoveryInFlightSessionIDs.has(sessionID)) {
        return;
    }
    runtime.recoveryInFlightSessionIDs.add(sessionID);
    try {
        if (runtime.sessionId !== sessionID || runtime.isStreaming) {
            return;
        }
        let session: AgentSession | null;
        try {
            session = await runtime.sessionPorts.repository.load(sessionID);
        } catch (error) {
            console.error("recover interrupted agent turn failed:", error);
            return;
        }
        const recoveryCompleted = !session?.recoveryTurnID;
        const settled = recoveryCompleted && settleCompletedAgentRecovery(runtime, {sessionID, turnID, session});
        if (settled || recoveryCompleted || !session || (turnID && session.recoveryTurnID !== turnID)) {
            return;
        }
        try {
            await commitRecoveredAgentTurn(runtime, sessionID, session);
        } catch (error) {
            console.error("commit recovered agent turn failed:", error);
        }
    } finally {
        runtime.recoveryInFlightSessionIDs.delete(sessionID);
    }
}

/** 在发送新轮次前提交或恢复上一轮。 */
export async function prepareForNewTurn(runtime: AgentChatRuntime) {
    const sessionID = runtime.sessionId;
    // 会话正处于恢复中且尚未提交时，先触发恢复并提示繁忙，避免新轮次覆盖恢复状态。
    if (runtime.pendingRecoverySessionIDs.has(sessionID) && !runtime.recoveryCommitTurnIDs.has(sessionID)) {
        void recoverInterruptedTurn(runtime, sessionID, runtime.currentTurnID);
        const languages = window.siyuan.languages;
        runtime.capabilities.showMessage?.(languages.agentChatBusy || "This session is busy in another instance", 3000);
        return false;
    }
    if (!runtime.recoveryCommitTurnIDs.has(sessionID)) {
        return true;
    }
    try {
        await saveSession(runtime);
        return runtime.sessionId === sessionID;
    } catch (error) {
        await reloadFromDisk(runtime, true);
        return false;
    }
}
