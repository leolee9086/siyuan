/** 用途：约束会话快照读写的公开状态；使用范围：本文件全部快照函数；解耦评估：经本目录网关依赖抽象运行时契约。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束权威会话结构；使用范围：快照输入与输出；解耦评估：纯类型依赖，不加载存储实现。 */
import type {AgentSession} from "./imports";

/** 将当前内存条目复制为可独立持久化的会话快照。 */
export function createAgentChatSessionSnapshot(
    runtime: AgentChatRuntime,
    input: Readonly<{sessionID: string; turnID: string | undefined}>,
) {
    const serializedEntries: NonNullable<AgentSession["entries"]> = JSON.parse(
        JSON.stringify(runtime.entries.concat(runtime.pendingConfirms))
    );
    const session: AgentSession = {
        id: input.sessionID,
        title: runtime.sessionTitle,
        targetKind: runtime.conversationKind,
        titled: runtime.hasTitled,
        entries: serializedEntries,
        contextTokens: runtime.contextTokens,
        contextTokenBreakdown: runtime.contextTokenBreakdown,
        contextCachedTokens: runtime.contextCachedTokens,
        contextLimit: runtime.contextLimit,
        createdAt: runtime.sessionCreatedAt,
        updatedAt: Date.now(),
        messageHistory: runtime.composer?.getHistory() || [],
        model: runtime.sessionPorts.presentation.getSelectedModel(runtime),
        permissionMode: runtime.permissionMode,
    };
    if (input.turnID) {
        session.commitTurnID = input.turnID;
    }
    return session;
}

/** 应用一次保存对恢复标记、标题和当前轮次产生的状态变化。 */
export async function applyAgentChatSessionSave(
    runtime: AgentChatRuntime,
    input: Readonly<{
        sessionID: string;
        turnID: string | undefined;
        pendingTitle: string | null;
        session: AgentSession;
        savedSession: AgentSession | null;
    }>,
) {
    // 条件 input.turnID && runtime.recoveryCommitTurnIDs.get(input... 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (input.turnID && runtime.recoveryCommitTurnIDs.get(input.sessionID) === input.turnID) {
        runtime.recoveryCommitTurnIDs.delete(input.sessionID);
    }
    if (input.turnID) {
        runtime.pendingRecoverySessionIDs.delete(input.sessionID);
    }
    if (runtime.sessionId !== input.sessionID) {
        return input.savedSession;
    }
    // 条件 input.pendingTitle !== null && input.pendingTitle === i... 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (input.pendingTitle !== null && input.pendingTitle === input.session.title &&
        runtime.pendingSessionTitle === input.pendingTitle) {
        runtime.pendingSessionTitle = null;
    }
    // 条件 input.turnID && runtime.currentTurnID === input.turnID 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (input.turnID && runtime.currentTurnID === input.turnID) {
        runtime.currentTurnID = "";
    }
    void runtime.promptSourceController.refresh();
    return input.savedSession;
}
