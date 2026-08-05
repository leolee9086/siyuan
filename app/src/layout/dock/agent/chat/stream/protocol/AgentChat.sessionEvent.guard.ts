/** 用途：约束会话事件；使用范围：统一事件字段守卫；解耦评估：协议类型经本目录网关保持单一来源。 */
import type {AgentConversationSessionEvent} from "./imports";
/** 用途：约束既有流式事件；使用范围：工具进度和效果字段；解耦评估：判别联合是现有消息投影的事实协议。 */
import type {ISSEResult} from "./imports";

/**
 * 判断未知字段是否为普通对象。
 * @同步豁免: 类型守卫
 * @显式返回类型原因 TypeScript 必须获得类型谓词，调用方才能在 JSON 边界后安全读取字段。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 收窄会话事件中的字符串数组，未知元素会被整体忽略。 @同步豁免: 类型守卫 */
export function readSessionEventStringArray(candidate: unknown) {
    if (!Array.isArray(candidate)) {
        return undefined;
    }
    const values: string[] = [];
    for (const item of candidate) {
        if (typeof item !== "string") {
            return undefined;
        }
        values.push(item);
    }
    return values;
}

/** 读取受支持的交互终态，未知扩展状态按 error 前向兼容。 @同步豁免: 类型守卫 */
export function readSessionEventInteractionStatus(
    event: AgentConversationSessionEvent,
): Extract<ISSEResult, {type: "confirm_resolved"}>["status"] | null {
    const value = event.status;
    if (typeof value !== "string") {
        return null;
    }
    if (value === "approved" || value === "always" || value === "rejected" || value === "submitted" ||
        value === "completed" || value === "expired" || value === "cancelled" || value === "error") {
        return value;
    }
    return "error";
}

/** 读取字符串字段。 @同步豁免: 类型守卫 */
export function readSessionEventString(event: AgentConversationSessionEvent, key: string) {
    const value = event[key];
    return typeof value === "string" ? value : null;
}

/** 读取数值字段。 @同步豁免: 类型守卫 */
export function readSessionEventNumber(event: AgentConversationSessionEvent, key: string) {
    const value = event[key];
    return typeof value === "number" ? value : null;
}

/** 读取普通对象字段。 @同步豁免: 类型守卫 */
export function readSessionEventRecord(event: AgentConversationSessionEvent, key: string) {
    const value = event[key];
    return isRecord(value) ? value : null;
}

/**
 * 读取并校验用户消息的块引用数组，保持上游 Entry 引用字段的形状。
 * @同步豁免: 类型守卫 - 该函数只在 JSON 边界收窄字段，不执行异步工作。
 */
export function readSessionEventReferences(event: AgentConversationSessionEvent) {
    const value = event.references;
    if (!Array.isArray(value)) {
        return undefined;
    }
    const references: Array<{id: string; title: string}> = [];
    for (const item of value) {
        if (!isRecord(item) || typeof item.id !== "string" || typeof item.title !== "string") {
            return undefined;
        }
        references.push({id: item.id, title: item.title});
    }
    return references;
}

/**
 * 读取并校验编辑器上下文，未知字段被忽略以保持协议前向兼容。
 * @同步豁免: 类型守卫 - 该函数只在 JSON 边界收窄字段，不执行异步工作。
 */
export function readSessionEventEditorContext(event: AgentConversationSessionEvent) {
    const value = readSessionEventRecord(event, "editorContext");
    if (!value) {
        return undefined;
    }
    const selectedBlockIDs = readSessionEventStringArray(value.selectedBlockIDs);
    const visibleBlockIDs = readSessionEventStringArray(value.visibleBlockIDs);
    return {
        ...(typeof value.activeDocID === "string" ? {activeDocID: value.activeDocID} : {}),
        ...(typeof value.activeDocTitle === "string" ? {activeDocTitle: value.activeDocTitle} : {}),
        ...(typeof value.notebookID === "string" ? {notebookID: value.notebookID} : {}),
        ...(typeof value.focusedBlockID === "string" ? {focusedBlockID: value.focusedBlockID} : {}),
        ...(selectedBlockIDs ? {selectedBlockIDs} : {}),
        ...(visibleBlockIDs ? {visibleBlockIDs} : {}),
    };
}

/** 将数值对象收窄为 token breakdown。 @同步豁免: 类型守卫 */
export function readSessionEventTokenBreakdown(event: AgentConversationSessionEvent) {
    const value = readSessionEventRecord(event, "tokenBreakdown");
    if (!value) {
        return null;
    }
    const result: Record<string, number> = {};
    for (const [key, item] of Object.entries(value)) {
        if (typeof item !== "number") {
            return null;
        }
        result[key] = item;
    }
    return result;
}

/** 读取工具进度对象并保留已知可选字段。 @同步豁免: 类型守卫 */
export function readSessionEventToolProgress(event: AgentConversationSessionEvent) {
    const value = readSessionEventRecord(event, "progress");
    if (!value || typeof value.phase !== "string" || typeof value.done !== "number" ||
        typeof value.total !== "number") {
        return null;
    }
    return {
        phase: value.phase,
        done: value.done,
        total: value.total,
        ...(typeof value.current === "string" ? {current: value.current} : {}),
        ...(typeof value.partialCount === "number" ? {partialCount: value.partialCount} : {}),
    } satisfies Extract<ISSEResult, {type: "tool_progress"}>["progress"];
}

/** 读取确认事件的资源影响布尔字段。 @同步豁免: 类型守卫 */
export function readSessionEventToolEffects(event: AgentConversationSessionEvent) {
    const value = readSessionEventRecord(event, "effects");
    if (!value) {
        return undefined;
    }
    return {
        ...(typeof value.localRead === "boolean" ? {localRead: value.localRead} : {}),
        ...(typeof value.localWrite === "boolean" ? {localWrite: value.localWrite} : {}),
        ...(typeof value.dataEgress === "boolean" ? {dataEgress: value.dataEgress} : {}),
        ...(typeof value.externalCost === "boolean" ? {externalCost: value.externalCost} : {}),
    };
}
