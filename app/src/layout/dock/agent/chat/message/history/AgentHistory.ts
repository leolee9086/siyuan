/** 用途：约束消息历史条目；使用范围：再生成资格与位置查找；解耦评估：同领域纯类型不加载渲染实现。 */
import type {AgentHistoryEntry} from "./AgentHistory.types";
/** 用途：约束消息引用；使用范围：编辑后引用过滤；解耦评估：同领域纯类型不加载渲染实现。 */
import type {AgentHistoryReference} from "./AgentHistory.types";
/** 用途：约束思考步骤；使用范围：历史呈现辅助函数。 */
import type {AgentHistoryThinkingStep} from "./AgentHistory.types";
/** 用途：约束富文本用户编辑；使用范围：编辑快照原子更新。 */
import type {AgentHistoryEditData, AgentHistoryUserEntry} from "./AgentHistory.types";
/** 重新导出按轮次构建历史呈现的纯函数。 */
export {buildAgentPresentationEntries} from "./AgentHistory.presentation";

/** 返回每个思考步骤中可见的工具名称。 */
export const getAgentThinkingToolGroups = (steps: AgentHistoryThinkingStep[]) => {
    return steps.map((step) => (step.toolNames || []).filter(Boolean));
};

/** 判断思考步骤是否含可展开的正文、推理或工具。 */
export const hasAgentThinkingStepDetails = (step: AgentHistoryThinkingStep) => {
    return !!step.content?.trim() || !!step.reasoningContent?.trim() ||
        !!step.toolNames?.some((toolName) => !!toolName.trim());
};

/** 将正数思考耗时归一化为至少一秒的整数显示值。 */
export const getAgentThinkingDisplaySeconds = (duration?: number) => {
    if (duration === undefined || !Number.isFinite(duration) || duration <= 0) {
        return undefined;
    }
    return Math.max(1, Math.round(duration));
};

/** 原子更新富文本用户消息的正文、块 HTML 和引用。 */
export const applyAgentUserEdit = (entry: AgentHistoryUserEntry, data: AgentHistoryEditData) => {
    entry.content = data.text;
    entry.blockHTML = data.blockHTML;
    if (data.references.length > 0) {
        entry.references = data.references.slice();
    } else {
        delete entry.references;
    }
};

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

/** 判断助手正文是否为当前用户 turn 的最后一段正文。 */
export const isAgentAssistantContentFinalInTurn = (entries: AgentHistoryEntry[], entryIndex: number) => {
    const entry = entries[entryIndex];
    if (entry?.type !== "assistant" || !entry.content?.trim()) {
        return false;
    }
    for (let index = entryIndex + 1; index < entries.length; index++) {
        const candidate = entries[index];
        if (candidate?.type === "user") {
            break;
        }
        if (candidate?.type === "assistant" && candidate.content?.trim()) {
            return false;
        }
    }
    return true;
};

/** 判断历史是否含供应商专用推理或工具上下文。 */
export const hasAgentModelSpecificContext = (entries: AgentHistoryEntry[]) => {
    return entries.some((entry) => {
        if (entry.type === "assistant") {
            return !!entry.reasoningContent?.trim() || !!entry.toolCalls?.length;
        }
        return entry.type === "thinking" && !!entry.steps?.some((step) => step.reasoningContent?.trim());
    });
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
export function isAgentRegenerateStateCurrent(
    request: Readonly<{sessionID: string; revision: number}>,
    current: Readonly<{sessionID: string; revision: number; isStreaming: boolean; mirrorLocked: boolean}>,
): boolean;
export function isAgentRegenerateStateCurrent(
    requestSessionID: string,
    currentSessionID: string,
    requestRevision: number,
    currentRevision: number,
    isStreaming: boolean,
    mirrorLocked: boolean,
): boolean;
export function isAgentRegenerateStateCurrent(
    requestOrSessionID: Readonly<{sessionID: string; revision: number}> | string,
    currentOrSessionID: Readonly<{
        sessionID: string;
        revision: number;
        isStreaming: boolean;
        mirrorLocked: boolean;
    }> | string,
    requestRevision?: number,
    currentRevision?: number,
    isStreaming?: boolean,
    mirrorLocked?: boolean,
) {
    const request = typeof requestOrSessionID === "string"
        ? {sessionID: requestOrSessionID, revision: requestRevision || 0}
        : requestOrSessionID;
    const current = typeof currentOrSessionID === "string"
        ? {sessionID: currentOrSessionID, revision: currentRevision || 0,
            isStreaming: !!isStreaming, mirrorLocked: !!mirrorLocked}
        : currentOrSessionID;
    return request.sessionID === current.sessionID && request.revision === current.revision &&
        !current.isStreaming && !current.mirrorLocked;
}

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
