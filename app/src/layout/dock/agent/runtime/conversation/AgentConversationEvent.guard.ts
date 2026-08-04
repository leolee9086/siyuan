/** 用途：约束队列快照；使用范围：会话事件边界收窄。 */
import type {AgentConversationQueueInput} from "./agentConversation.types";
/** 用途：约束队列项；使用范围：会话事件边界收窄。 */
import type {AgentConversationQueueItem} from "./agentConversation.types";
/** 用途：约束队列快照；使用范围：会话事件和 HTTP 响应边界。 */
import type {AgentConversationQueueSnapshot} from "./agentConversation.types";
/** 用途：约束会话事件；使用范围：事件字段读取。 */
import type {AgentConversationSessionEvent} from "./agentConversation.types";

/** 判断未知值是否为可读取字段的普通对象。 @同步豁免: 类型守卫 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 将未知 queue input 收窄为 Kernel 对外稳定字段。 @同步豁免: 类型守卫 */
function readQueueInput(value: unknown): AgentConversationQueueInput | null {
    // queue item 缺少稳定 id 或会话标识时不能进入 UI 投影。
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.sessionId !== "string" ||
        typeof value.semantics !== "string") {
        return null;
    }
    return {
        id: value.id,
        sessionId: value.sessionId,
        semantics: value.semantics,
        ...(typeof value.content === "string" ? {content: value.content} : {}),
        ...(typeof value.payload !== "undefined" ? {payload: value.payload} : {}),
        ...(typeof value.payloadVersion === "number" ? {payloadVersion: value.payloadVersion} : {}),
        ...(typeof value.expectedTurnId === "string" ? {expectedTurnId: value.expectedTurnId} : {}),
        ...(typeof value.createdAt === "number" ? {createdAt: value.createdAt} : {}),
    };
}

/** 将未知 queue item 收窄为带状态和排序字段的界面投影。 @同步豁免: 类型守卫 */
function readQueueItem(value: unknown): AgentConversationQueueItem | null {
    // 只有完整 input、状态和序号才能参与 queue dock 排序。
    if (!isRecord(value) || typeof value.state !== "string" || typeof value.seq !== "number" ||
        typeof value.queuePos !== "number") {
        return null;
    }
    const input = readQueueInput(value.input);
    if (!input) {
        return null;
    }
    return {
        input,
        state: value.state,
        seq: value.seq,
        queuePos: value.queuePos,
    };
}

/** 读取 Kernel queue snapshot，丢弃不完整的跨版本字段。 @同步豁免: 类型守卫 */
export function readAgentConversationQueueSnapshot(value: unknown): AgentConversationQueueSnapshot | null {
    // queueVersion 和 items 是版本仲裁的最小必要字段。
    if (!isRecord(value) || typeof value.queueVersion !== "number" || !Array.isArray(value.items)) {
        return null;
    }
    const items = value.items.map(readQueueItem).filter((item): item is AgentConversationQueueItem => item !== null);
    return {
        queueVersion: value.queueVersion,
        ...(typeof value.nextSeq === "number" ? {nextSeq: value.nextSeq} : {}),
        items,
    };
}

/** 读取事件中的可选字符串字段。 @同步豁免: 类型守卫 */
export function readAgentEventString(event: AgentConversationSessionEvent, key: string) {
    const value = event[key];
    return typeof value === "string" ? value : null;
}

/** 读取事件中的可选布尔字段。 @同步豁免: 类型守卫 */
export function readAgentEventBoolean(event: AgentConversationSessionEvent, key: string) {
    const value = event[key];
    return typeof value === "boolean" ? value : null;
}
