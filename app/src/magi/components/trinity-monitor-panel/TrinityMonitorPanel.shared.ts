/** 用途：监控消息视图。使用范围：原始事件字段读取。解耦评估：经目录网关隔离父级路径。 */
import type { MagiSeelPanelMessageView } from "./imports";
/** 用途：创建日期对象。使用范围：监控时间格式化。解耦评估：对象创建集中到 factory。 */
import { createMonitorDate } from "./TrinityMonitorPanel.factory";

/** @同步豁免: 类型守卫 - 未知元数据必须在当前解析调用内同步收窄。 */
export function asRecord(value: unknown) {
    return typeof value === "object" && value !== null
        ? Object.fromEntries(Object.entries(value))
        : null;
}

/** @同步豁免: UI构建 - 字段文本必须同步用于当前监控摘要。 */
export function readNonEmptyString(value: unknown) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/** @同步豁免: UI构建 - 长载荷摘要必须同步限制显示长度。 */
export function truncateText(value: string, maxLength: number) {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

/** @同步豁免: UI构建 - 元数据必须同步提供给同一事件的摘要计算。 */
export function readRawEventMeta(message: MagiSeelPanelMessageView) {
    return asRecord(message.meta) ?? {};
}

/** @同步豁免: UI构建 - 载荷必须同步提供给同一事件的摘要计算。 */
export function readRawEventPayload(message: MagiSeelPanelMessageView) {
    return asRecord(Reflect.get(readRawEventMeta(message), "eventPayload")) ?? {};
}

/** @同步豁免: UI构建 - 事件类型必须同步用于模板条目。 */
export function getRawEventType(message: MagiSeelPanelMessageView) {
    return readNonEmptyString(Reflect.get(readRawEventMeta(message), "eventType")) ?? "UNKNOWN_EVENT";
}

/** @同步豁免: UI构建 - 轮次必须同步用于模板条目。 */
export function getRawEventRoundId(message: MagiSeelPanelMessageView) {
    return readNonEmptyString(Reflect.get(readRawEventMeta(message), "roundId")) ?? "-";
}

/** @同步豁免: UI构建 - 序号必须同步用于模板条目。 */
export function getRawEventSeqText(message: MagiSeelPanelMessageView) {
    const seq = Reflect.get(readRawEventMeta(message), "seq");
    return typeof seq === "number" ? `#${seq}` : "#-";
}

/** @同步豁免: UI构建 - 时间文本必须同步用于当前模板渲染。 */
export function formatMonitorTimestamp(timestamp: unknown) {
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp <= 0) {
        return "--:--:--";
    }
    const date = createMonitorDate(timestamp);
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

/** @同步豁免: UI构建 - 贤人别名必须同步归一化以聚合同轮事件。 */
export function normalizeSeelIdentity(value: unknown) {
    const raw = readNonEmptyString(value);
    if (!raw) {
        return "";
    }
    const normalized = raw.toUpperCase();
    if (normalized.includes("MELCHIOR")) {
        return "MELCHIOR";
    }
    if (normalized.includes("BALTHASAR") || normalized.includes("BALTHAZAR")) {
        return "BALTHASAR";
    }
    if (normalized.includes("CASPER")) {
        return "CASPER";
    }
    return normalized.replace(/[^A-Z0-9]/g, "");
}

/** @同步豁免: 类型守卫 - 模板过滤需要同步判定原始事件消息。 */
export function isRawEventMonitorMessage(message: MagiSeelPanelMessageView) {
    const meta = asRecord(message.meta);
    return message.type === "event" && meta?.type === "raw-event";
}
