/** 用途：调用 Agent 会话 API；使用范围：会话列表、持久化和任务目录绑定流程；解耦评估：网络请求必须经统一 fetchSyncPost，暂不适合通过事件替代。 */
import {fetchSyncPost} from "../../../util/fetch";
/** 用途：取得当前应用实例标识；使用范围：会话广播去重；解耦评估：常量依赖稳定且仅用于请求元数据，无需额外注入层。 */
import {Constants} from "../../../constants";
import {getSafeSiyuanConfig} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";

const API = "/api/ai/agent";

// 标识发起者 app，后端 saveSession/removeSession 据此排除自身、向其他实例广播会话变更。
const APP_HEADER = {"X-SiYuan-App-ID": Constants.SIYUAN_APPID};

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
    async init() {
        const result = await SessionStore.list({page: 1, pageSize: 1});
        return result.sessions;
    },

    /** 按页读取会话，并根据 owner token 过滤受保护的外部目录会话。 */
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
        if (resp && resp.code === 0) {
 return resp.data; 
}
        return {sessions: [], total: 0, page: 1, pageSize: opts?.pageSize || 30};
    },

    /** 读取指定会话；后端拒绝无权访问的外部目录会话。 */
    async load(id: string) {
        const resp = await fetchSyncPost(API + "/getSession", {id}, agentOwnerHeaders());
        return (resp && resp.code === 0) ? resp.data : null;
    },

    /** 读取后端返回的目录 capability 摘要，路径和 owner 仍由后端隐藏。 */
    async listTaskDirectories(id: string) {
        const resp = await fetchSyncPost(API + "/lsTaskDirectories", {id}, agentOwnerHeaders());
        return (resp && resp.code === 0) ? resp.data : null;
    },

    /** 保存会话消息和元数据，同时附带当前应用实例标识。 */
    async save(session: AgentSession) {
        session.updatedAt = Date.now();
        await fetchSyncPost(API + "/saveSession", session, agentOwnerHeaders(APP_HEADER));
    },

    /** 删除会话及其服务端 capability 绑定。 */
    async remove(id: string) {
        await fetchSyncPost(API + "/removeSession", {id}, agentOwnerHeaders(APP_HEADER));
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
        const resp = await fetchSyncPost(API + "/bindTaskDirectory", {sessionID: id, path}, agentOwnerHeaders(APP_HEADER));
        return resp && resp.code === 0 ? resp.data : null;
    },

    /** 请求后端添加带权限的附加任务目录。 */
    async addTaskDirectory(id: string, path: string, permission: "read-only" | "read-write" | "command") {
        const resp = await fetchSyncPost(API + "/addTaskDirectory", {sessionID: id, path, permission}, agentOwnerHeaders(APP_HEADER));
        return resp && resp.code === 0 ? resp.data : null;
    },

    /** 请求后端解除指定会话的主目录或附加目录 capability。 */
    async unbindTaskDirectory(id: string, directoryID = "main") {
        await fetchSyncPost(API + "/unbindTaskDirectory", {sessionID: id, directoryID}, agentOwnerHeaders(APP_HEADER));
    },

    newSessionId,
};
