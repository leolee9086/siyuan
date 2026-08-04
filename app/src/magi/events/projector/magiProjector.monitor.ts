/**
 * MAGI Trinity 原始监控投影。
 *
 * 高频事件使用稳定语义 ID；超大载荷只保留有界摘要，避免诊断视图复制完整模型上下文。
 */

/** 用途：原始事件公共字段。使用范围：监控投影。解耦评估：通过目录网关访问事件契约。 */
import type { MagiEventBase } from "./imports";
/** 用途：投影运行态。使用范围：查找 Trinity 宿主。解耦评估：通过目录网关访问投影契约。 */
import type { MagiProjectorRuntimeState } from "./imports";
/** 用途：构造稳定消息 ID。使用范围：高频原始事件压缩。解耦评估：共享 ID 规则保持一致。 */
import { buildProjectedMessageId } from "./magiProjector.shared";
/** 用途：规范化贤者身份。使用范围：定位 Trinity 宿主。解耦评估：共享别名规则保持一致。 */
import { normalizeSeelIdentity } from "./magiProjector.shared";
/** 用途：限制消息窗口。使用范围：Trinity 原始流。解耦评估：共享窗口规则避免重复实现。 */
import { trimProjectedMessageCount } from "./magiProjector.shared";
/** 用途：原位更新消息。使用范围：高频原始事件。解耦评估：共享序号防倒退规则保持一致。 */
import { upsertMessage } from "./magiProjector.shared";

const MAX_MONITOR_MESSAGE_COUNT = 1000;
const MAX_MONITOR_PAYLOAD_LENGTH = 16 * 1024;
const MAX_MONITOR_STRING_PREVIEW_LENGTH = 4096;
const MONITOR_MESSAGE_STRING_KEYS = ["id", "type", "content", "status"] as const;

function findMonitorHostSeel(state: MagiProjectorRuntimeState) {
    return state.target.seels.find((seel) => normalizeSeelIdentity(seel.config.name) === "TRINITY") ?? null;
}

function truncateMonitorString(value: string) {
    return value.length <= MAX_MONITOR_STRING_PREVIEW_LENGTH
        ? value
        : `${value.slice(0, MAX_MONITOR_STRING_PREVIEW_LENGTH)}...`;
}

function buildTruncatedMonitorMessage(value: object) {
    const result: Record<string, unknown> = {};
    // 消息元数据可能携带完整诊断对象；超大事件只复制监控展示需要的固定字段，确保嵌套数据也受预算约束。
    for (const key of MONITOR_MESSAGE_STRING_KEYS) {
        const field = Reflect.get(value, key);
        if (typeof field === "string") {
            result[key] = truncateMonitorString(field);
        }
    }
    const timestamp = Reflect.get(value, "timestamp");
    if (typeof timestamp === "number") {
        result.timestamp = timestamp;
    }
    return result;
}

function buildTruncatedMonitorPayload(event: MagiEventBase, payloadLength: number) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(event)) {
        if (typeof value === "string") {
            result[key] = truncateMonitorString(value);
            continue;
        }
        if (typeof value === "number" || typeof value === "boolean" || value === null) {
            result[key] = value;
            continue;
        }
        if ((key === "message" || key === "streamMessage") && typeof value === "object" && value !== null) {
            result[key] = buildTruncatedMonitorMessage(value);
        }
    }
    result.monitorPayloadTruncated = true;
    result.monitorPayloadLength = payloadLength;
    return result;
}

function cloneEventPayloadForMeta(event: MagiEventBase) {
    try {
        const serialized = JSON.stringify(event);
        if (serialized.length > MAX_MONITOR_PAYLOAD_LENGTH) {
            return buildTruncatedMonitorPayload(event, serialized.length);
        }
        const cloned = JSON.parse(serialized);
        if (typeof cloned === "object" && cloned !== null) {
            return Object.fromEntries(Object.entries(cloned));
        }
    } catch (error) {
        console.warn("[magi-projector] clone event payload failed", error);
    }
    return {};
}

function readMonitorIdentityPart(event: MagiEventBase, key: string) {
    const value = Reflect.get(event, key);
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function buildMonitorEventIdentity(eventType: string, event: MagiEventBase) {
    if (eventType === "RUNTIME_STATUS_UPDATED") {
        return eventType;
    }
    const roundId = event.roundId;
    const seelName = readMonitorIdentityPart(event, "seelName");
    if (eventType === "SEEL_REPLY_CHUNK") {
        return `${eventType}:${roundId}:${seelName}`;
    }
    if (eventType === "TOOL_CALL_DETECTED" || eventType === "SEEL_TOOL_ACTIVITY_UPDATED") {
        const toolCallId = readMonitorIdentityPart(event, "toolCallId");
        const toolCallIndex = readMonitorIdentityPart(event, "toolCallIndex");
        return `${eventType}:${roundId}:${seelName}:${toolCallId}:${toolCallIndex}`;
    }
    return event.eventId;
}

/** 将原始事件保留到 Trinity 诊断流；贤人卡片只接收语义活动。 */
/** @同步豁免: 生命周期 - 原始诊断事件与语义活动必须在同一事件总线分发周期内按序落盘。 */
export function projectRawEventToMonitor(
    state: MagiProjectorRuntimeState,
    eventType: string,
    event: MagiEventBase,
) {
    const monitorHost = findMonitorHostSeel(state);
    if (!monitorHost) {
        return;
    }
    upsertMessage(monitorHost.messages, {
        id: buildProjectedMessageId(buildMonitorEventIdentity(eventType, event), `event-${eventType}-MONITOR`),
        type: "event",
        content: eventType,
        status: "success",
        timestamp: event.timestamp,
        meta: {
            type: "raw-event",
            eventType,
            eventPayload: cloneEventPayloadForMeta(event),
            eventId: event.eventId,
            seq: event.seq,
            roundId: event.roundId,
            targetSeel: monitorHost.config.name,
            monitorScope: "magi-monitor",
        },
    });
    trimProjectedMessageCount(monitorHost.messages, MAX_MONITOR_MESSAGE_COUNT);
}
