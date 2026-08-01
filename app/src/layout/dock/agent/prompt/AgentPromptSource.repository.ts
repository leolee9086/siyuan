/** 用途：发送提示词与文件树请求；使用范围：提示词仓储；解耦评估：具体网络入口只由提示词网关暴露。 */
import {fetchSyncPost} from "./imports";
/** 用途：接收动态身份请求头能力；使用范围：全部提示词请求。 */
import type {AgentRequestHeaders} from "./imports";
/** 用途：校验提示词响应数据；使用范围：全部仓储响应；解耦评估：共享协议校验只由提示词网关暴露。 */
import {requireAgentAPIData} from "./imports";
/** 用途：约束文件树搜索结果；使用范围：候选转换。 */
import type {SearchResultItem} from "./imports";
/** 用途：提交服务端提示词修订；使用范围：来源读取与变更。 */
import type {AgentSessionRevisionState} from "./imports";
/** 用途：约束已解析文档；使用范围：绑定与创建响应。 */
import type {AgentPromptSourceDocument} from "./AgentPromptSource.types";
/** 用途：约束可选择文档；使用范围：搜索与路径解析。 */
import type {AgentPromptSourceDocumentCandidate} from "./AgentPromptSource.types";
/** 用途：约束来源状态；使用范围：提示词仓储响应。 */
import type {AgentPromptSourceState} from "./AgentPromptSource.types";

/** 判断 Kernel 返回的来源状态是否属于已发布协议。 */
function isKnownPromptSourceState(state: string) {
    return state === "eligible" || state === "bound" || state === "locked" || state === "source-changed";
}

/** 将文件树条目过滤并转换为可选择的提示词文档候选。 */
function toPromptSourceDocumentCandidate(document: Pick<SearchResultItem, "box" | "path" | "hPath">) {
    const notebookId = typeof document.box === "string" ? document.box.trim() : "";
    const path = typeof document.path === "string" ? document.path.trim() : "";
    const hPath = typeof document.hPath === "string" ? document.hPath.trim() : "";
    if (!notebookId || !path || path === "/" || !hPath) {
        return [];
    }
    const title = hPath.split("/").filter(Boolean).at(-1)?.trim();
    if (!title) {
        return [];
    }
    return [{notebookId, path, hPath, title}] satisfies AgentPromptSourceDocumentCandidate[];
}

/** 读取 Kernel 对指定会话给出的提示词来源资格和脱敏元数据。 */
export async function getAgentPromptSource(
    revisionState: AgentSessionRevisionState,
    requestHeaders: AgentRequestHeaders,
    id: string,
) {
    const response = await fetchSyncPost(
        "/api/ai/agent/getPromptSource",
        {sessionID: id},
        requestHeaders(),
    );
    const state = requireAgentAPIData<AgentPromptSourceState>(response, "Read agent prompt source");
    if (!state || !state.source || typeof state.revision !== "number" ||
        !isKnownPromptSourceState(state.state)) {
        throw new Error("Read agent prompt source returned invalid data");
    }
    revisionState.revisions.set(id, state.revision);
    return state;
}

/** 复用文件树搜索，筛选可绑定的真实文档候选。 */
export async function searchAgentPromptSourceDocuments(
    requestHeaders: AgentRequestHeaders,
    keyword: string,
) {
    const response = await fetchSyncPost(
        "/api/filetree/searchDocs",
        {k: keyword.trim(), flashcard: false, excludeIDs: []},
        requestHeaders(),
    );
    const documents = requireAgentAPIData<Array<Pick<SearchResultItem, "box" | "path" | "hPath">>>(
        response,
        "Search prompt source documents",
    );
    if (!Array.isArray(documents)) {
        throw new Error("Search prompt source documents returned invalid data");
    }
    return documents.flatMap(toPromptSourceDocumentCandidate);
}

/** 将用户选择的文件树候选解析为唯一根块文档。 */
export async function resolveAgentPromptSourceDocument(
    requestHeaders: AgentRequestHeaders,
    candidate: AgentPromptSourceDocumentCandidate,
) {
    const hPathResponse = await fetchSyncPost("/api/filetree/getHPathByPath", {
        notebook: candidate.notebookId,
        path: candidate.path,
    }, requestHeaders());
    const hPath = requireAgentAPIData<string>(hPathResponse, "Resolve prompt source document path");
    if (typeof hPath !== "string" || !hPath.trim()) {
        throw new Error("Resolve prompt source document path returned invalid data");
    }
    const idsResponse = await fetchSyncPost("/api/filetree/getIDsByHPath", {
        notebook: candidate.notebookId,
        path: hPath,
    }, requestHeaders());
    const ids = requireAgentAPIData<string[]>(idsResponse, "Resolve prompt source document ID");
    const id = ids[0];
    if (!Array.isArray(ids) || ids.length !== 1 || typeof id !== "string" || !id.trim()) {
        throw new Error("Selected prompt source document no longer resolves to exactly one document");
    }
    return {
        id,
        notebookId: candidate.notebookId,
        title: candidate.title,
        hPath: candidate.hPath,
    } satisfies AgentPromptSourceDocument;
}

/** 绑定由 Kernel 再次读取和快照的文档。 */
export async function bindAgentPromptSourceDocument(
    revisionState: AgentSessionRevisionState,
    requestHeaders: AgentRequestHeaders,
    input: Readonly<{id: string; document: AgentPromptSourceDocument; expectedRevision: number}>,
) {
    const response = await fetchSyncPost("/api/ai/agent/bindPromptSourceDocument", {
        sessionID: input.id,
        expectedRevision: input.expectedRevision,
        documentID: input.document.id,
        notebookID: input.document.notebookId,
    }, requestHeaders({scope: "checkpoint"}));
    const state = requireAgentAPIData<AgentPromptSourceState>(response, "Bind agent prompt source document");
    revisionState.revisions.set(input.id, state.revision);
    return state;
}

/** 刷新已绑定文档的权威快照。 */
export async function refreshAgentPromptSourceDocument(
    revisionState: AgentSessionRevisionState,
    requestHeaders: AgentRequestHeaders,
    input: Readonly<{id: string; expectedRevision: number}>,
) {
    const response = await fetchSyncPost("/api/ai/agent/refreshPromptSourceDocument", {
        sessionID: input.id,
        expectedRevision: input.expectedRevision,
    }, requestHeaders({scope: "checkpoint"}));
    const state = requireAgentAPIData<AgentPromptSourceState>(response, "Refresh agent prompt source document");
    revisionState.revisions.set(input.id, state.revision);
    return state;
}

/** 保持当前快照并确认已检测到的文档版本。 */
export async function keepAgentPromptSourceDocument(
    revisionState: AgentSessionRevisionState,
    requestHeaders: AgentRequestHeaders,
    input: Readonly<{id: string; expectedRevision: number}>,
) {
    const response = await fetchSyncPost("/api/ai/agent/keepPromptSourceDocument", {
        sessionID: input.id,
        expectedRevision: input.expectedRevision,
    }, requestHeaders({scope: "checkpoint"}));
    const state = requireAgentAPIData<AgentPromptSourceState>(response, "Keep agent prompt source document snapshot");
    revisionState.revisions.set(input.id, state.revision);
    return state;
}

/** 在 AI 主笔记本创建当前提示词快照的独立文档。 */
export async function createAgentPromptSourceDocument(
    requestHeaders: AgentRequestHeaders,
    id: string,
) {
    const response = await fetchSyncPost(
        "/api/ai/agent/createPromptSourceDocument",
        {sessionID: id},
        requestHeaders({scope: "checkpoint"}),
    );
    return requireAgentAPIData<AgentPromptSourceDocument>(response, "Create agent prompt source document");
}
