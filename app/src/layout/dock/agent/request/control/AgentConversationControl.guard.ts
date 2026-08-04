/** 用途：约束控制响应包络；使用范围：JSON 边界类型收窄。 */
import type {AgentConversationControlEnvelope} from "./AgentConversationControl.types";
/** 用途：约束会话事件；使用范围：SSE JSON 边界类型收窄。 */
import type {AgentConversationSessionEvent} from "../../runtime/conversation/agentConversation.types";
/** 用途：约束结构化控制错误；使用范围：冲突重同步判断。 */
import type {AgentConversationControlError} from "./AgentConversationControl.types";

/** 判断未知值是否为可读取字段的普通对象。 @同步豁免: 类型守卫 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 读取思源标准响应包络；数据载荷由调用方的端点契约约束。
 * @同步豁免: 类型守卫
 * @显式返回类型原因 泛型端点需要固定 null 失败分支，调用方据此阻止未校验值进入业务层。
 */
export function readAgentConversationControlEnvelope<T>(value: unknown): AgentConversationControlEnvelope<T> | null {
    // 只有普通对象才能作为思源响应包络继续读取。
    if (!isRecord(value)) {
        return null;
    }
    return value as AgentConversationControlEnvelope<T>;
}

/**
 * 将未知 SSE JSON 收窄为带服务端公共元数据的会话事件。
 * @同步豁免: 类型守卫
 * @显式返回类型原因 解析器必须用 null 明确表示协议字段缺失，避免部分事件进入序号仲裁。
 */
export function readAgentConversationSessionEvent(
    value: unknown,
    eventType: string,
    fallbackEventSeq: number,
): AgentConversationSessionEvent | null {
    // 事件必须是对象，并具有稳定会话标识和可用序号。
    if (!isRecord(value) || typeof value.sessionID !== "string" || !eventType || !Number.isFinite(fallbackEventSeq)) {
        return null;
    }
    const eventSeq = typeof value.eventSeq === "number" ? value.eventSeq : fallbackEventSeq;
    // 服务端显式序号同样必须是有限数值。
    if (!Number.isFinite(eventSeq)) {
        return null;
    }
    const timestamp = typeof value.timestamp === "number" ? value.timestamp : Date.now();
    return {...value, type: eventType, eventSeq, timestamp} as AgentConversationSessionEvent;
}

/** 判断未知错误是否携带控制 API 的版本化恢复元数据。 @同步豁免: 类型守卫 */
export function isAgentConversationControlError(value: unknown): value is AgentConversationControlError {
    return isRecord(value) && value instanceof Error && typeof value.reason === "string" &&
        typeof value.queueVersion === "number" && typeof value.status === "number";
}
