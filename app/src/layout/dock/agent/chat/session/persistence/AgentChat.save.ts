/** 用途：约束保存流程可读写的公开状态；使用范围：本文件保存入口；解耦评估：经本目录网关依赖运行时接口。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：应用保存结果并合并提交状态；使用范围：本文件保存步骤；解耦评估：同目录职责直接静态导入，调用关系可追踪。 */
import {applyAgentChatSessionSave} from "./AgentChat.bootstrap.helpers";
/** 用途：构建保存快照；使用范围：本文件保存步骤；解耦评估：同目录职责直接静态导入，调用关系可追踪。 */
import {createAgentChatSessionSnapshot} from "./AgentChat.bootstrap.helpers";

/** 保存当前原生 Agent 会话并合并提交结果。 */
export async function saveSession(runtime: AgentChatRuntime, commitTurnID?: string,
                                  allowEmpty = false) {
    if (runtime.conversationKind === "magi" || (!allowEmpty && runtime.entries.length === 0)) {
        return null;
    }
    const sessionID = runtime.sessionId;
    const recoveryTurnID = runtime.recoveryCommitTurnIDs.get(sessionID);
    const turnID = commitTurnID || recoveryTurnID;
    const pendingTitle = runtime.pendingSessionTitle;
    const session = createAgentChatSessionSnapshot(runtime, {sessionID, turnID});
    const result = await runtime.sessionPorts.repository.save(session);
    const savedSession = await applyAgentChatSessionSave(runtime, {
        sessionID,
        turnID,
        pendingTitle,
        session,
        savedSession: result.session ?? null,
    });
    if (runtime.pendingSessionTitle !== null && !runtime.isStreaming && !runtime.currentTurnID) {
        return saveSession(runtime, undefined, allowEmpty);
    }
    return savedSession;
}
