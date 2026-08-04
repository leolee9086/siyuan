/** 用途：约束会话管理可写状态；使用范围：创建与删除入口；解耦评估：通过本目录网关依赖公开运行时接口。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：准备新会话；使用范围：创建命令；解耦评估：同目录生命周期职责直接导入可保持停止与重置顺序。 */
import {prepareAgentChatSessionCreation} from "./AgentChat.manage.helpers";
/** 用途：重置新会话；使用范围：创建命令；解耦评估：同目录生命周期职责直接导入可保持状态与视图原子更新。 */
import {resetAgentChatSession} from "./AgentChat.manage.helpers";
/** 用途：约束删除后的替换候选；使用范围：当前会话删除；解耦评估：纯会话索引类型。 */
import type {SessionIndexItem} from "./imports";
/** 用途：切换到替换会话；使用范围：当前会话删除；解耦评估：切换子域经网关暴露。 */
import {switchSession} from "./imports";

/** 停止旧轮次并创建空白会话。 */
export async function createSession(runtime: AgentChatRuntime) {
    await prepareAgentChatSessionCreation(runtime);
    await resetAgentChatSession(runtime, runtime.sessionPorts.repository.newSessionId());
}

/** 删除会话，并在删除当前会话时选择或创建替代会话。 */
export async function deleteSession(runtime: AgentChatRuntime, id: string) {
	// 当前会话仍在执行或恢复时拒绝删除，避免移除执行器正在提交的持久化目标。
	if (id === runtime.sessionId && (runtime.isStreaming || !!runtime.currentTurnID ||
		runtime.pendingRecoverySessionIDs.has(id))) {
        const L = window.siyuan.languages;
        runtime.capabilities.showMessage?.(L.agentChatBusy || "This session is busy in another instance", 3000);
        return;
    }
    runtime.scrollBottomBySession.delete(id);
    const wasCurrent = id === runtime.sessionId;
    const result = wasCurrent
        ? await runtime.sessionPorts.repository.list({
            page: 1,
            pageSize: 2,
            targetKind: runtime.conversationKind,
        })
        : null;
    const replacement = result?.sessions.find((session: SessionIndexItem) => session.id !== id);
	if (replacement) {
		await switchSession(runtime, replacement.id);
	}
	// 删除的是当前会话且没有候选时，先建立新的空白会话以保持面板可用。
	if (wasCurrent && !replacement) {
        runtime.entries = [];
        await createSession(runtime);
    }
    await runtime.sessionPorts.repository.remove(id);
    runtime.pendingRecoverySessionIDs.delete(id);
    runtime.recoveryCommitTurnIDs.delete(id);
}
