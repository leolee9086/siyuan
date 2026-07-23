/** 用途：调用 Agent 会话 API；使用范围：会话列表、持久化和任务目录绑定流程；解耦评估：网络请求必须经统一 fetchSyncPost，暂不适合通过事件替代。 */
import {fetchSyncPost} from "../../../util/fetch";
/** 用途：取得当前应用实例标识；使用范围：会话广播去重；解耦评估：常量依赖稳定且仅用于请求元数据，无需额外注入层。 */
import {Constants} from "../../../constants";
import {getSafeSiyuanConfig} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type {AgentSession, SessionIndexItem, SessionListResult} from "./SessionStore.types";

const API = "/api/ai/agent";
const sessionRevisions = new Map<string, number>();
const sessionRuntimeRevisions = new Map<string, number>();
const sessionSaveQueues = new Map<string, Promise<SessionSaveResult>>();

interface SessionSaveResult {
    revision: number;
    session?: AgentSession;
}

async function waitForPendingSave(id: string) {
    const pending = sessionSaveQueues.get(id);
    if (pending) {
        await pending;
    }
}

// 标识发起者 app，后端据此排除自身广播。
const APP_HEADERS = {
    "X-SiYuan-App-ID": Constants.SIYUAN_APPID,
};

// 会话写入和删除额外启用确定性修订校验。
const CHECKPOINT_HEADERS = {
    "Content-Type": "application/json",
    ...APP_HEADERS,
    "X-SiYuan-Agent-Checkpoint": "2",
};

/** 保存当前 MAGI guardian armor token 的动态提供器，所有 Agent 请求发送前读取最新会话状态。 */
let ownerTokenProvider: () => string = () => "";

/** @同步豁免: 生命周期 */
/** 设置 Agent 请求使用的 owner token 提供器，由 AgentChat 在初始化时注入。 */
export function setAgentOwnerTokenProvider(provider: () => string) {
    ownerTokenProvider = provider;
}

function workspaceAPIToken(): string {
    try {
        return String(getSafeSiyuanConfig()?.api?.token ?? "").trim();
    } catch {
        return "";
    }
}

/** @同步豁免: 生命周期 */
/** 合并普通请求头和当前 owner token，供受保护的 Agent API 请求使用。 */
export function agentOwnerHeaders(extra?: Record<string, string>) {
    const headers = {...(extra || {})};
    const apiToken = workspaceAPIToken();
    if (apiToken && !headers.Authorization) {
        headers.Authorization = `Bearer ${apiToken}`;
    }
    const token = ownerTokenProvider();
    if (token) {
        headers["X-SiYuan-Agent-Owner-Token"] = token;
    }
    return headers;
}

/** 生成与 Lute 节点格式一致的新会话 ID；测试或未加载 Lute 时回退到时间值。 */
function newSessionId() {
    return typeof Lute !== "undefined" ? Lute.NewNodeID() : Date.now().toString(36);
}

/** 提供 Agent 会话的查询、持久化、删除、改名和任务目录绑定 API。 */
export const SessionStore = {
    /** 初始化会话面板时读取最新列表。 */
    async init(): Promise<SessionIndexItem[]> {
        const result = await SessionStore.list({page: 1, pageSize: 1});
        return result.sessions;
    },

    /** 按页读取会话，并根据目标及 owner token 过滤受保护的外部目录会话。 */
    async list(opts?: {
        page?: number,
        pageSize?: number,
        keyword?: string,
        targetKind?: "native-agent" | "magi",
    }): Promise<SessionListResult> {
        const resp = await fetchSyncPost(API + "/lsSessions", {
            page: opts?.page || 1,
            pageSize: opts?.pageSize || 30,
            keyword: opts?.keyword || "",
            targetKind: opts?.targetKind || "native-agent",
        }, agentOwnerHeaders()) as {code: number; data: SessionListResult};
        if (resp && resp.code === 0) {
            return resp.data;
        }
        return {sessions: [], total: 0, page: 1, pageSize: opts?.pageSize || 30};
    },

    /** 读取指定会话，并拒绝用旧 revision 覆盖当前实例已经观察到的状态。 */
    async load(id: string): Promise<AgentSession | null> {
        for (let attempt = 0; attempt < 3; attempt++) {
            await waitForPendingSave(id);
            const resp = await fetchSyncPost(API + "/getSession", {id}, agentOwnerHeaders()) as {
                code: number;
                data: AgentSession;
            };
            if (!resp || resp.code !== 0) {
                return null;
            }
            const revision = resp.data.revision ?? 0;
            const runtimeRevision = resp.data.recoveryRevision ?? 0;
            const knownRevision = sessionRevisions.get(id) ?? 0;
            const knownRuntimeRevision = sessionRuntimeRevisions.get(id) ?? 0;
            if (revision < knownRevision ||
                (revision === knownRevision && runtimeRevision < knownRuntimeRevision)) {
                continue;
            }
            sessionRevisions.set(id, revision);
            sessionRuntimeRevisions.set(id, runtimeRevision);
            return resp.data;
        }
        // 连续写入期间若三次读取都落后于本地已知版本，则不返回旧数据覆盖界面。
        return null;
    },

    /** 读取后端返回的目录 capability 摘要，路径和 owner 仍由后端隐藏。 */
    async listTaskDirectories(id: string) {
        const resp = await fetchSyncPost(API + "/lsTaskDirectories", {id}, agentOwnerHeaders());
        return (resp && resp.code === 0) ? resp.data : null;
    },

    /** 按会话串行保存深拷贝快照，使用服务端 revision 作为下一次写入前置条件。 */
    async save(session: AgentSession): Promise<SessionSaveResult> {
        const snapshot = JSON.parse(JSON.stringify(session)) as AgentSession;
        snapshot.updatedAt = Date.now();
        const baseRevision = snapshot.expectedRevision ?? sessionRevisions.get(snapshot.id) ?? snapshot.revision ?? 0;
        const previous = sessionSaveQueues.get(snapshot.id);
        const persist = async (expectedRevision: number) => {
            snapshot.expectedRevision = expectedRevision;
            const resp = await fetchSyncPost(
                API + "/saveSession",
                snapshot,
                agentOwnerHeaders(CHECKPOINT_HEADERS),
            ) as {
                code: number;
                msg?: string;
                data?: {revision?: number; session?: AgentSession};
            };
            if (!resp || resp.code !== 0) {
                throw new Error(resp?.msg || "Failed to save agent session");
            }
            const revision = resp.data?.revision ?? expectedRevision;
            sessionRevisions.set(snapshot.id, revision);
            if (snapshot.commitTurnID || snapshot.recoveryTurnID) {
                sessionRuntimeRevisions.set(snapshot.id, 0);
            }
            return {revision, session: resp.data?.session};
        };
        const save = previous ? previous.then((result) => persist(result.revision)) : persist(baseRevision);
        sessionSaveQueues.set(snapshot.id, save);
        try {
            return await save;
        } finally {
            if (sessionSaveQueues.get(snapshot.id) === save) {
                sessionSaveQueues.delete(snapshot.id);
            }
        }
    },

    /** 等待同会话保存完成后删除；保存失败会直接阻断删除并向调用方传播。 */
    async remove(id: string): Promise<void> {
        await waitForPendingSave(id);
        const resp = await fetchSyncPost(
            API + "/removeSession",
            {id},
            agentOwnerHeaders(CHECKPOINT_HEADERS),
        ) as {code: number; msg?: string};
        if (!resp || resp.code !== 0) {
            throw new Error(resp?.msg || "Failed to remove agent session");
        }
        sessionRevisions.delete(id);
        sessionRuntimeRevisions.delete(id);
    },

    /** 读取会话后更新标题，保持后端的访问控制链路。 */
    async rename(id: string, newTitle: string) {
        const session = await SessionStore.load(id);
        if (!session) {
            return;
        }
        session.title = newTitle;
        await SessionStore.save(session);
    },

    /** 请求后端将 owner 选择的外部主目录绑定到指定会话。 */
    async bindTaskDirectory(id: string, path: string) {
        const resp = await fetchSyncPost(API + "/bindTaskDirectory", {sessionID: id, path}, agentOwnerHeaders(APP_HEADERS));
        return resp && resp.code === 0 ? resp.data : null;
    },

    /** 请求后端添加带权限的附加任务目录。 */
    async addTaskDirectory(id: string, path: string, permission: "read-only" | "read-write" | "command") {
        const resp = await fetchSyncPost(API + "/addTaskDirectory", {sessionID: id, path, permission}, agentOwnerHeaders(APP_HEADERS));
        return resp && resp.code === 0 ? resp.data : null;
    },

    /** 请求后端解除指定会话的主目录或附加目录 capability。 */
    async unbindTaskDirectory(id: string, directoryID = "main") {
        await fetchSyncPost(API + "/unbindTaskDirectory", {sessionID: id, directoryID}, agentOwnerHeaders(APP_HEADERS));
    },

    getRevision(id: string): number {
        return sessionRevisions.get(id) ?? 0;
    },

    newSessionId,
};
