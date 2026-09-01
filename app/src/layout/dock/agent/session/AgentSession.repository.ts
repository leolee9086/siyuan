/** 用途：发送会话 API 请求；使用范围：会话仓储；解耦评估：具体网络入口只由会话网关暴露。 */
import {fetchSyncPost} from "./imports";
/** 用途：接收动态身份请求头能力；使用范围：全部会话请求。 */
import type {AgentRequestHeaders} from "./imports";
/** 用途：校验带数据响应；使用范围：会话读取和写入；解耦评估：共享协议校验只由会话网关暴露。 */
import {requireAgentAPIData} from "./imports";
/** 用途：校验命令响应；使用范围：会话删除；解耦评估：共享协议校验只由会话网关暴露。 */
import {requireAgentAPISuccess} from "./imports";
/** 用途：等待同会话保存队列；使用范围：会话读取和删除；解耦评估：这是同领域修订状态的一部分。 */
import {waitForAgentSessionSave} from "./AgentSession.revisions";
/** 用途：约束会话快照；使用范围：会话仓储。 */
import type {AgentSession} from "./AgentSession.types";
/** 用途：约束修订状态所有权；使用范围：会话仓储。 */
import type {AgentSessionRevisionState} from "./AgentSession.types";
/** 用途：约束会话目标过滤；使用范围：会话列表。 */
import type {AgentSessionTargetKind} from "./AgentSession.types";
/** 用途：约束会话权限切换；使用范围：权限 API。 */
import type {AgentPermissionMode} from "./AgentSession.types";
/** 用途：约束会话列表响应；使用范围：会话列表。 */
import type {SessionListResult} from "./AgentSession.types";

/** 按页读取会话，并由 Kernel 根据目标和 owner 身份过滤结果。 */
export async function listAgentSessions(
    requestHeaders: AgentRequestHeaders,
    options?: {
        page?: number;
        pageSize?: number;
        keyword?: string;
        targetKind?: AgentSessionTargetKind;
    },
) {
    const response = await fetchSyncPost("/api/ai/agent/lsSessions", {
        page: options?.page || 1,
        pageSize: options?.pageSize || 30,
        keyword: options?.keyword || "",
        targetKind: options?.targetKind || "native-agent",
    }, requestHeaders());
    return requireAgentAPIData<SessionListResult>(response, "List agent sessions");
}

/** 读取指定会话，并拒绝应用低于当前组合根已观察修订的结果。 */
export async function loadAgentSession(
    revisionState: AgentSessionRevisionState,
    requestHeaders: AgentRequestHeaders,
    id: string,
) {
    for (let attempt = 0; attempt < 3; attempt++) {
        await waitForAgentSessionSave(revisionState, id);
        const response = await fetchSyncPost("/api/ai/agent/getSession", {id}, requestHeaders());
        if (!response || response.code !== 0) {
            return null;
        }
        const session = requireAgentAPIData<AgentSession>(response, "Load agent session");
        const revision = session.revision ?? 0;
        const runtimeRevision = session.recoveryRevision ?? 0;
        const knownRevision = revisionState.revisions.get(id) ?? 0;
        const knownRuntimeRevision = revisionState.runtimeRevisions.get(id) ?? 0;
        if (revision < knownRevision || (revision === knownRevision && runtimeRevision < knownRuntimeRevision)) {
            continue;
        }
        revisionState.revisions.set(id, revision);
        revisionState.runtimeRevisions.set(id, runtimeRevision);
        return session;
    }
    return null;
}

/** 持久化一个不可变会话快照，并按会话串行提交修订。 */
export async function saveAgentSession(
    revisionState: AgentSessionRevisionState,
    requestHeaders: AgentRequestHeaders,
    session: AgentSession,
) {
    const snapshot: AgentSession = JSON.parse(JSON.stringify(session));
    snapshot.updatedAt = Date.now();
    const observedRevision = revisionState.revisions.get(snapshot.id);
    const baseRevision = snapshot.expectedRevision ?? observedRevision ?? snapshot.revision ?? 0;
    const previous = revisionState.pendingSaves.get(snapshot.id);
    // @柯里化：当前不可变快照需要接收同会话前序保存提交的修订。
    const persist = async (expectedRevision: number, retried = false) => {
        snapshot.expectedRevision = expectedRevision;
        const response = await fetchSyncPost(
            "/api/ai/agent/saveSession",
            snapshot,
            requestHeaders({scope: "checkpoint"}),
        );
        // 多面板展示同一会话时会话事件会驱动多个面板并发保存同一快照，CAS 冲突是预期行为：
        // 用服务端权威修订刷新本地水位并以新修订重试一次，避免确认/完成状态保存永久失败。
        const conflictRevision = response && response.code !== 0 && !retried &&
            typeof response.data === "object" && response.data !== null &&
            "revision" in response.data && typeof response.data.revision === "number"
            ? response.data.revision
            : null;
        if (conflictRevision !== null) {
            revisionState.revisions.set(snapshot.id, conflictRevision);
            return persist(conflictRevision, true);
        }
        const data = requireAgentAPIData<{revision?: number; session?: AgentSession}>(
            response,
            "Save agent session",
        );
        const revision = data.revision ?? expectedRevision;
        revisionState.revisions.set(snapshot.id, revision);
        // 提交或恢复一个运行中回合后，Kernel 已接管恢复修订，清除本地临时观察值。
        if (snapshot.commitTurnID || snapshot.recoveryTurnID) {
            revisionState.runtimeRevisions.set(snapshot.id, 0);
        }
        return data.session ? {revision, session: data.session} : {revision};
    };
    const save = previous ? previous.then((result) => persist(result.revision)) : persist(baseRevision);
    revisionState.pendingSaves.set(snapshot.id, save);
    try {
        return await save;
    } finally {
        // 仅由当前队列尾清理自身，避免较早完成的保存删除后来排入的 Promise。
        if (revisionState.pendingSaves.get(snapshot.id) === save) {
            revisionState.pendingSaves.delete(snapshot.id);
        }
    }
}

/** 等待排队保存后删除指定会话和本地修订记录。 */
export async function removeAgentSession(
    revisionState: AgentSessionRevisionState,
    requestHeaders: AgentRequestHeaders,
    id: string,
) {
    await waitForAgentSessionSave(revisionState, id);
    const response = await fetchSyncPost(
        "/api/ai/agent/removeSession",
        {id},
        requestHeaders({scope: "checkpoint"}),
    );
    requireAgentAPISuccess(response, "Remove agent session");
    revisionState.revisions.delete(id);
    revisionState.runtimeRevisions.delete(id);
}

/** 更新会话中后续能力调用的确认策略。 */
export async function setAgentSessionPermission(
    requestHeaders: AgentRequestHeaders,
    id: string,
    permissionMode: AgentPermissionMode,
) {
    const response = await fetchSyncPost(
        "/api/ai/agent/setPermission",
        {sessionID: id, permissionMode},
        requestHeaders(),
    );
    const data = requireAgentAPIData<{permissionMode: AgentPermissionMode}>(
        response,
        "Set agent session permission",
    );
    return data.permissionMode;
}

/** 读取会话后通过同一修订队列更新标题。 */
export async function renameAgentSession(
    revisionState: AgentSessionRevisionState,
    requestHeaders: AgentRequestHeaders,
    input: Readonly<{id: string; title: string}>,
) {
    const session = await loadAgentSession(revisionState, requestHeaders, input.id);
    if (!session) {
        return;
    }
    session.title = input.title;
    await saveAgentSession(revisionState, requestHeaders, session);
}
