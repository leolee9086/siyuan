/** 用途：约束消息历史条目；使用范围：再生成资格与位置查找；解耦评估：同领域纯类型不加载渲染实现。 */
import type {AgentHistoryEntry} from "./AgentHistory.types";
/** 用途：约束消息引用；使用范围：编辑后引用过滤；解耦评估：同领域纯类型不加载渲染实现。 */
import type {AgentHistoryReference} from "./AgentHistory.types";

/** 从指定用户条目或历史末尾定位重新生成的起点。 */
export const findAgentUserEntryIndex = (entries: AgentHistoryEntry[], userEntryID?: string) => {
    for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry?.type === "user" && (!userEntryID || entry.id === userEntryID)) {
            return i;
        }
    }
    return -1;
};

/** 判断目标用户消息之后是否存在已经产生副作用的工具记录。 */
export const hasAgentExecutedToolsAfter = (entries: AgentHistoryEntry[], entryIndex: number) => {
    return entries.slice(entryIndex + 1).some(hasAgentHistorySideEffect);
};

/** 判断单个历史条目是否已经产生快照、确认或工具执行副作用。 */
function hasAgentHistorySideEffect(entry: AgentHistoryEntry) {
    if (entry.type === "snapshot") {
        return true;
    }
    if (entry.type === "confirm") {
        return entry.status === "approved" || entry.status === "always";
    }
    return entry.type === "assistant" && !!entry.toolCalls?.some((call) =>
        call.state === "executing" || call.state === "completed" || call.result !== undefined);
}

/** 核对准备阶段保存的请求快照是否仍对应可重新生成的当前会话。 */
export const isAgentRegenerateStateCurrent = (
    request: Readonly<{sessionID: string; revision: number}>,
    current: Readonly<{sessionID: string; revision: number; isStreaming: boolean; mirrorLocked: boolean}>,
) => {
    return request.sessionID === current.sessionID && request.revision === current.revision &&
        !current.isStreaming && !current.mirrorLocked;
};

/** 编辑用户正文后只保留标题仍出现在正文中的块引用。 */
export const filterAgentReferencesForContent = (references: AgentHistoryReference[], content: string) => {
    const filtered: AgentHistoryReference[] = [];
    for (const reference of references) {
        if (content.includes(reference.title)) {
            filtered.push(reference);
        }
    }
    return filtered;
};
