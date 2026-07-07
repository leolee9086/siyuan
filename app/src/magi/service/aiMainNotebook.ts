/** 用途：访问统一的内核请求封装；使用范围：AI 主笔记本 service 的所有接口请求；解耦评估：service 层需要直接发起内核请求，当前通过同目录 imports.ts 做了一层依赖收口，已是本层最小耦合方案。 */
import { fetchSyncPost } from "./imports";
/** 用途：描述 AI 主笔记本列表项；使用范围：service 层归一化响应时使用；解耦评估：纯类型依赖，已与请求逻辑分离到独立 types 文件。 */
import type { WorkspaceAIMainNotebookInfo } from "./aiMainNotebook.types";
/** 用途：描述 AI 主笔记本完整状态；使用范围：service 层向 MagiRoot 返回工作空间准入状态；解耦评估：纯类型依赖，适合独立维护。 */
import type { WorkspaceAIMainNotebookState } from "./aiMainNotebook.types";
/** 用途：描述 AI 主笔记本状态字面量；使用范围：service 层归一化 status 字段时使用；解耦评估：纯类型依赖，独立于请求实现。 */
import type { WorkspaceAIMainNotebookStatus } from "./aiMainNotebook.types";

const WORKSPACE_AI_MAIN_NOTEBOOK_STATE_ENDPOINT = "/api/notebook/getWorkspaceAIMainNotebookState";
const WORKSPACE_AI_MAIN_NOTEBOOK_CREATE_ENDPOINT = "/api/notebook/createWorkspaceAIMainNotebook";
const WORKSPACE_AI_MAIN_NOTEBOOK_RESOLVE_ENDPOINT = "/api/notebook/resolveWorkspaceAIMainNotebookConflict";
const OPEN_NOTEBOOK_ENDPOINT = "/api/notebook/openNotebook";

const WORKSPACE_AI_MAIN_NOTEBOOK_STATUS_MAP: Record<string, WorkspaceAIMainNotebookStatus> = {
    ready: "ready",
    conflict: "conflict",
    inactive: "inactive",
};

/**
 * 归一化工作空间 AI 主笔记本状态值。
 *
 * 作用：把后端返回的任意 status 文本限制到前端已知枚举。
 * 意图：避免 UI 直接依赖未校验的响应字段。
 * 调用时机：解析工作空间 AI 主笔记本状态响应时调用。
 */
function normalizeWorkspaceAIMainNotebookStatus(raw: unknown) {
    const normalized = String(raw ?? "").trim();
    return WORKSPACE_AI_MAIN_NOTEBOOK_STATUS_MAP[normalized] ?? "missing";
}

/**
 * 归一化单个 AI 主笔记本信息。
 *
 * 作用：从内核响应中提取守卫界面需要的笔记本字段。
 * 意图：收敛后端字段漂移对 UI 的影响。
 * 调用时机：解析 notebooks/openNotebooks/activeNotebook 时调用。
 */
function normalizeWorkspaceAIMainNotebookInfo(raw: unknown) {
    if (!raw || typeof raw !== "object") {
        return null;
    }

    const id = String(Reflect.get(raw, "id") ?? "").trim();
    if (!id) {
        return null;
    }

    return {
        id,
        name: String(Reflect.get(raw, "name") ?? "").trim(),
        closed: Boolean(Reflect.get(raw, "closed")),
        icon: String(Reflect.get(raw, "icon") ?? "").trim(),
        sort: Number(Reflect.get(raw, "sort") ?? 0),
        sortMode: Number(Reflect.get(raw, "sortMode") ?? 0),
        aiMainNotebook: Boolean(Reflect.get(raw, "aiMainNotebook")),
    };
}

/**
 * 归一化 AI 主笔记本列表。
 *
 * 作用：批量转换后端列表数据并过滤非法项。
 * 意图：保证消费方始终拿到稳定的数组结构。
 * 调用时机：解析 notebooks/openNotebooks 列表时调用。
 */
function normalizeWorkspaceAIMainNotebookList(raw: unknown) {
    if (!Array.isArray(raw)) {
        return [];
    }

    const notebooks: WorkspaceAIMainNotebookInfo[] = [];
    for (const item of raw) {
        const normalized = normalizeWorkspaceAIMainNotebookInfo(item);
        if (normalized) {
            notebooks.push(normalized);
        }
    }
    return notebooks;
}

/**
 * 读取 fetchSyncPost 标准响应里的 data 字段。
 *
 * 作用：统一提取内核标准响应的 data 载荷。
 * 意图：避免每个 service 方法重复编写相同的防御逻辑。
 * 调用时机：所有工作空间 AI 主笔记本接口返回后调用。
 */
function readResponseData(response: unknown) {
    if (!response || typeof response !== "object") {
        return null;
    }
    return Reflect.get(response, "data");
}

/**
 * 归一化完整的工作空间 AI 主笔记本状态。
 *
 * 作用：把后端状态响应转换成前端守卫页面直接可用的结构。
 * 意图：让 MagiRoot 只面向稳定的领域模型，而不是原始响应。
 * 调用时机：所有工作空间 AI 主笔记本查询/变更接口完成后调用。
 */
function normalizeWorkspaceAIMainNotebookState(raw: unknown) {
    if (!raw || typeof raw !== "object") {
        return {
            status: "missing",
            notebooks: [],
            openNotebooks: [],
            activeNotebook: null,
        };
    }

    return {
        status: normalizeWorkspaceAIMainNotebookStatus(Reflect.get(raw, "status")),
        notebooks: normalizeWorkspaceAIMainNotebookList(Reflect.get(raw, "notebooks")),
        openNotebooks: normalizeWorkspaceAIMainNotebookList(Reflect.get(raw, "openNotebooks")),
        activeNotebook: normalizeWorkspaceAIMainNotebookInfo(Reflect.get(raw, "activeNotebook")),
    };
}

/** 用途：供 MagiRoot 在启动前读取工作空间 AI 主笔记本状态。 */
export async function fetchWorkspaceAIMainNotebookState() {
    const response = await fetchSyncPost(WORKSPACE_AI_MAIN_NOTEBOOK_STATE_ENDPOINT, {});
    const data = readResponseData(response);
    return normalizeWorkspaceAIMainNotebookState(
        data && typeof data === "object" ? Reflect.get(data, "state") : null,
    );
}

/** 用途：供缺失守卫页创建 AI 主笔记本，并返回最新状态。 */
export async function createWorkspaceAIMainNotebook(name?: string) {
    const trimmedName = String(name ?? "").trim();
    const response = await fetchSyncPost(
        WORKSPACE_AI_MAIN_NOTEBOOK_CREATE_ENDPOINT,
        trimmedName ? { name: trimmedName } : {},
    );
    const data = readResponseData(response);
    return normalizeWorkspaceAIMainNotebookState(
        data && typeof data === "object" ? Reflect.get(data, "state") : null,
    );
}

/** 用途：供冲突/未激活守卫页选择一个 AI 主笔记本继续，并返回最新状态。 */
export async function resolveWorkspaceAIMainNotebookConflict(keepNotebook: string){
    const response = await fetchSyncPost(WORKSPACE_AI_MAIN_NOTEBOOK_RESOLVE_ENDPOINT, {
        keepNotebook,
    });
    const data = readResponseData(response);
    return normalizeWorkspaceAIMainNotebookState(
        data && typeof data === "object" ? Reflect.get(data, "state") : null,
    );
}

/** 用途：在仅有一个 AI 主笔记本但它处于关闭状态时自动打开，保证 MAGI 查询范围可用。 */
export async function openWorkspaceAIMainNotebook(notebookID: string){
    await fetchSyncPost(OPEN_NOTEBOOK_ENDPOINT, {
        notebook: notebookID,
    });
}
