/**
 * 用途：导入 MAGI 事件总线接口，用于调用事件发射方法。
 * 使用范围：在 dispatchMagiWebSocketMessage 函数中调用 emitWithMeta 方法。
 * 解耦评估：无法解耦，函数职责就是将消息投递到事件总线，必须依赖事件总线接口。
 */
import type { MagiEventBus } from "./magiEventBus.types";
/**
 * 用途：导入 WebSocket 消息规范化函数，用于解析原始消息。
 * 使用范围：在 dispatchMagiWebSocketMessage 函数开始时调用，解析原始消息为事件信封。
 * 解耦评估：可通过依赖注入解耦，但当前模块职责明确且单一，直接导入更简洁。
 */
import { normalizeMagiEventEnvelope } from "./magiWebSocketBridge";
/**
 * 用途：导入类型守卫函数，用于验证事件载荷结构的正确性。
 * 使用范围：在投递事件前验证载荷是否符合事件类型的结构要求。
 * 解耦评估：无法解耦，类型安全验证是此模块的核心职责之一。
 */
import { isValidMagiEventPayload } from "./dispatchMagiWebSocketMessage.guard";

/**
 * 将后端 WebSocket 消息投递到 MAGI 事件总线。
 *
 * 职责：
 * 1. 规范化原始消息为事件信封
 * 2. 验证事件载荷结构
 * 3. 投递到事件总线
 *
 * @returns true 表示已命中并尝试分发事件，false 表示消息无效或验证失败
 */
/** @同步豁免: 性能考虑 - 在 WebSocket onmessage 回调中同步执行以保证消息顺序和实时性 */
export function dispatchMagiWebSocketMessage(
    eventBus: MagiEventBus,
    rawMessage: unknown
) {
    const envelope = normalizeMagiEventEnvelope(rawMessage);
    if (!envelope) {
        return false;
    }

    // 验证事件载荷结构是否符合事件类型要求
    if (!isValidMagiEventPayload(envelope.eventType, envelope.payload)) {
        console.warn(`[magi-ws-bridge] invalid payload structure for event type ${envelope.eventType}`, envelope.payload);
        return false;
    }

    try {
        return eventBus.emitWithMeta(
            envelope.eventType,
            envelope.payload
        );
    } catch (error) {
        console.warn("[magi-ws-bridge] dispatch failed", error, envelope);
        return false;
    }
}
