/** 用途：调用 Agent 会话 API；使用范围：会话列表、持久化和任务目录绑定流程；解耦评估：网络请求必须经统一 fetchSyncPost，暂不适合通过事件替代。 */
import {fetchSyncPost} from "../../../util/network/fetch";
/** 用途：取得当前应用实例标识；使用范围：会话广播去重；解耦评估：常量依赖稳定且仅用于请求元数据，无需额外注入层。 */
import {Constants} from "../../../constants";
/** 用途：读取当前工作空间 API token；使用范围：仅在 Agent 请求发出前生成授权头；解耦评估：动态配置必须按请求读取，注入静态值会在工作空间切换后失效。 */
import {getSafeSiyuanConfig} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：约束 Agent 会话、上传及目录接口的数据边界；使用范围：仅 SessionStore 的请求和本地 revision 队列。 */
import type {
    AgentAPIResponse,
    AgentPromptSourceDocument,
    AgentPromptSourceState,
    AgentSession,
    AgentTaskDirectoryCapabilities,
    SessionSaveResult,
    SessionListResult,
    TaskDirectoryBinding,
} from "./SessionStore.types";

const API = "/api/ai/agent";
const sessionRevisions = new Map<string, number>();
const sessionRuntimeRevisions = new Map<string, number>();
const sessionSaveQueues = new Map<string, Promise<SessionSaveResult>>();

/** 对 Agent API 的统一成功包络做确定性校验，避免各调用点以不同默认值吞掉服务端故障。 */
function requireAgentAPIData<T>(response: AgentAPIResponse<T> | null | undefined, operation: string) {
    if (!response || response.code !== 0) {
        throw new Error(response?.msg || `${operation} failed`);
    }
    if (!Object.prototype.hasOwnProperty.call(response, "data") || typeof response.data === "undefined") {
        throw new Error(`${operation} returned no data`);
    }
    return response.data;
}

/** 校验无需响应数据的 Agent API 调用。 */
function requireAgentAPISuccess(response: AgentAPIResponse<unknown> | null | undefined, operation: string) {
    if (!response || response.code !== 0) {
        throw new Error(response?.msg || `${operation} failed`);
    }
}

/** 等待同会话已经排队的保存结束，避免读取、删除或后续写入越过旧 revision。 */
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

/** 在每次 Agent 请求前读取当前工作空间 API token，避免缓存工作空间切换前的值。 */
function workspaceAPIToken() {
    try {
        return String(getSafeSiyuanConfig()?.api?.token ?? "").trim();
    } catch {
        return "";
    }
}

/** @同步豁免: 生命周期 */
/** 合并普通请求头和当前 owner token，供受保护的 Agent API 请求使用。 */
export function agentOwnerHeaders(extra?: Record<string, string>) {
    const headers: Record<string, string> = {...(extra || {})};
    const apiToken = workspaceAPIToken();
    // 调用方没有显式提供授权时才补入工作空间 token，保留专用请求覆盖能力。
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
    async init() {
        const result = await SessionStore.list({page: 1, pageSize: 1});
        return result.sessions;
    },

    /** 按页读取会话，并根据目标及 owner token 过滤受保护的外部目录会话。 */
    async list(opts?: {
        page?: number,
        pageSize?: number,
        keyword?: string,
        targetKind?: "native-agent" | "magi",
    }) {
        const resp = await fetchSyncPost(API + "/lsSessions", {
            page: opts?.page || 1,
            pageSize: opts?.pageSize || 30,
            keyword: opts?.keyword || "",
            targetKind: opts?.targetKind || "native-agent",
        }, agentOwnerHeaders());
        return requireAgentAPIData<SessionListResult>(resp, "List agent sessions");
    },

    /** 读取指定会话，并拒绝用旧 revision 覆盖当前实例已经观察到的状态。 */
    async load(id: string) {
        for (let attempt = 0; attempt < 3; attempt++) {
            await waitForPendingSave(id);
            const resp = await fetchSyncPost(API + "/getSession", {id}, agentOwnerHeaders());
            if (!resp || resp.code !== 0) {
                return null;
            }
            const session = requireAgentAPIData<AgentSession>(resp, "Load agent session");
            const revision = session.revision ?? 0;
            const runtimeRevision = session.recoveryRevision ?? 0;
            const knownRevision = sessionRevisions.get(id) ?? 0;
            const knownRuntimeRevision = sessionRuntimeRevisions.get(id) ?? 0;
            if (revision < knownRevision ||
                (revision === knownRevision && runtimeRevision < knownRuntimeRevision)) {
                continue;
            }
            sessionRevisions.set(id, revision);
            sessionRuntimeRevisions.set(id, runtimeRevision);
            return session;
        }
        // 连续写入期间若三次读取都落后于本地已知版本，则不返回旧数据覆盖界面。
        return null;
    },

    /** 读取后端返回的目录 capability 摘要，路径和 owner 仍由后端隐藏。 */
    async listTaskDirectories(id: string) {
        const resp = await fetchSyncPost(API + "/lsTaskDirectories", {id}, agentOwnerHeaders());
        return requireAgentAPIData<TaskDirectoryBinding | null>(resp, "List agent task directories");
    },

    /** 由 Kernel 验证当前 guardian 身份是否可新增或更换任务目录绑定。 */
    async getTaskDirectoryCapabilities() {
        const resp = await fetchSyncPost(API + "/taskDirectoryCapabilities", {}, agentOwnerHeaders());
        const capabilities = requireAgentAPIData<AgentTaskDirectoryCapabilities>(
            resp,
            "Read agent task-directory capabilities",
        );
        if (typeof capabilities?.canBindTaskDirectories !== "boolean") {
            throw new Error("Read agent task-directory capabilities returned invalid data");
        }
        return capabilities;
    },

    /** 读取 Kernel 对当前会话给出的提示词来源资格和脱敏元数据。 */
    async getPromptSource(id: string) {
        const resp = await fetchSyncPost(API + "/getPromptSource", {sessionID: id}, agentOwnerHeaders());
        const state = requireAgentAPIData<AgentPromptSourceState>(resp, "Read agent prompt source");
        if (!state || !state.source || typeof state.revision !== "number" ||
            !["eligible", "bound", "locked", "source-changed"].includes(state.state)) {
            throw new Error("Read agent prompt source returned invalid data");
        }
        sessionRevisions.set(id, state.revision);
        return state;
    },

    /** 搜索可以绑定为系统提示词的文档；结果的正文仍只由 Kernel 在绑定时读取。 */
    async searchPromptSourceDocuments(keyword: string) {
        const resp = await fetchSyncPost(
            API + "/searchPromptSourceDocuments",
            {keyword: keyword.trim()},
            agentOwnerHeaders(),
        );
        const documents = requireAgentAPIData<AgentPromptSourceDocument[]>(resp, "Search prompt source documents");
        if (!Array.isArray(documents) || documents.some((document) =>
            !document || !document.id || !document.notebookId || !document.title)) {
            throw new Error("Search prompt source documents returned invalid data");
        }
        return documents;
    },

    /** 绑定由 Kernel 再次读取和快照的文档；前端不提交任何系统提示词正文。 */
    async bindPromptSourceDocument(id: string, document: AgentPromptSourceDocument, expectedRevision = SessionStore.getRevision(id)) {
        const resp = await fetchSyncPost(API + "/bindPromptSourceDocument", {
            sessionID: id,
            expectedRevision,
            documentID: document.id,
            notebookID: document.notebookId,
        }, agentOwnerHeaders(CHECKPOINT_HEADERS));
        const state = requireAgentAPIData<AgentPromptSourceState>(resp, "Bind agent prompt source document");
        sessionRevisions.set(id, state.revision);
        return state;
    },

    /** 显式刷新已绑定文档的快照；服务端使用原文档 ID 与权威版本。 */
    async refreshPromptSourceDocument(id: string, expectedRevision = SessionStore.getRevision(id)) {
        const resp = await fetchSyncPost(API + "/refreshPromptSourceDocument", {
            sessionID: id,
            expectedRevision,
        }, agentOwnerHeaders(CHECKPOINT_HEADERS));
        const state = requireAgentAPIData<AgentPromptSourceState>(resp, "Refresh agent prompt source document");
        sessionRevisions.set(id, state.revision);
        return state;
    },

    /** 显式保持当前快照并确认当前检测到的文档版本。 */
    async keepPromptSourceDocument(id: string, expectedRevision = SessionStore.getRevision(id)) {
        const resp = await fetchSyncPost(API + "/keepPromptSourceDocument", {
            sessionID: id,
            expectedRevision,
        }, agentOwnerHeaders(CHECKPOINT_HEADERS));
        const state = requireAgentAPIData<AgentPromptSourceState>(resp, "Keep agent prompt source document snapshot");
        sessionRevisions.set(id, state.revision);
        return state;
    },

    /** 在 AI 主笔记本创建当前已绑定提示词快照的独立副本，不自动重新绑定会话。 */
    async createPromptSourceDocument(id: string) {
        const resp = await fetchSyncPost(API + "/createPromptSourceDocument", {sessionID: id}, agentOwnerHeaders(CHECKPOINT_HEADERS));
        return requireAgentAPIData<AgentPromptSourceDocument>(resp, "Create agent prompt source document");
    },

    /** 将浏览器选择的文件内容上传到 Kernel 解析出的 AI 主笔记本附件目录。 */
    async uploadFiles(files: File[]) {
        const formData = new FormData();
        for (const file of files) {
            formData.append("file[]", file);
        }
        const resp = await fetchSyncPost(API + "/uploadFiles", formData, agentOwnerHeaders(APP_HEADERS));
        const result = requireAgentAPIData<{succMap?: Record<string, string>; errFiles?: string[]}>(
            resp,
            "Upload agent files",
        );
        const uploaded = Object.entries(result.succMap || {}).map(([name, path]) => ({name, path}));
        const failed = result.errFiles || [];
        if (uploaded.length === 0 && failed.length === 0) {
            throw new Error(resp.msg || "Upload agent files returned no file result");
        }
        return {uploaded, failed, message: resp.msg || ""};
    },

    /** 按会话串行保存深拷贝快照，使用服务端 revision 作为下一次写入前置条件。 */
    async save(session: AgentSession) {
        const snapshot: AgentSession = JSON.parse(JSON.stringify(session));
        snapshot.updatedAt = Date.now();
        const baseRevision = snapshot.expectedRevision ?? sessionRevisions.get(snapshot.id) ?? snapshot.revision ?? 0;
        const previous = sessionSaveQueues.get(snapshot.id);
        /** 使用前序保存返回的 revision 提交当前深拷贝快照。 */
        // @柯里化：需要捕获当前不可变快照，并由同会话保存队列注入前序 revision。
        const persist = async (expectedRevision: number) => {
            snapshot.expectedRevision = expectedRevision;
            const resp = await fetchSyncPost(
                API + "/saveSession",
                snapshot,
                agentOwnerHeaders(CHECKPOINT_HEADERS),
            );
            const data = requireAgentAPIData<{revision?: number; session?: AgentSession}>(resp, "Save agent session");
            const revision = data.revision ?? expectedRevision;
            sessionRevisions.set(snapshot.id, revision);
            // 提交或恢复操作会清空临时运行态，后续读取从服务端重新建立 recovery revision。
            if (snapshot.commitTurnID || snapshot.recoveryTurnID) {
                sessionRuntimeRevisions.set(snapshot.id, 0);
            }
            const savedSession = data.session;
            return savedSession ? {revision, session: savedSession} : {revision};
        };
        const save = previous ? previous.then((result) => persist(result.revision)) : persist(baseRevision);
        sessionSaveQueues.set(snapshot.id, save);
        try {
            return await save;
        } finally {
            // 仅由当前保存释放自身队列项，避免晚完成的旧请求删除新请求。
            if (sessionSaveQueues.get(snapshot.id) === save) {
                sessionSaveQueues.delete(snapshot.id);
            }
        }
    },

    /** 等待同会话保存完成后删除；保存失败会直接阻断删除并向调用方传播。 */
    async remove(id: string) {
        await waitForPendingSave(id);
        const resp = await fetchSyncPost(
            API + "/removeSession",
            {id},
            agentOwnerHeaders(CHECKPOINT_HEADERS),
        );
        requireAgentAPISuccess(resp, "Remove agent session");
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
        return requireAgentAPIData<TaskDirectoryBinding>(resp, "Bind agent task directory");
    },

    /** 请求后端添加带权限的附加任务目录。 */
    async addTaskDirectory(id: string, path: string, permission: "read-only" | "read-write" | "command") {
        const resp = await fetchSyncPost(API + "/addTaskDirectory", {sessionID: id, path, permission}, agentOwnerHeaders(APP_HEADERS));
        return requireAgentAPIData<TaskDirectoryBinding>(resp, "Add agent task directory");
    },

    /** 请求后端解除指定会话的主目录或附加目录 capability。 */
    async unbindTaskDirectory(id: string, directoryID = "main") {
        const resp = await fetchSyncPost(API + "/unbindTaskDirectory", {sessionID: id, directoryID}, agentOwnerHeaders(APP_HEADERS));
        requireAgentAPISuccess(resp, "Unbind agent task directory");
    },

    /** 返回当前前端实例已确认的会话 revision，供首次目录绑定前判断是否需要落盘。 */
    getRevision(id: string) {
        return sessionRevisions.get(id) ?? 0;
    },

    newSessionId,
};
