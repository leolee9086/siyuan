/** 用途：连接与运行时状态类型。使用范围：中央监控统计。解耦评估：经同目录网关隔离父级路径。 */
import type { ConnectionStatus } from "./imports";
/** 用途：MAGI 运行时状态类型。使用范围：状态、事实和焦点摘要。解耦评估：经同目录网关隔离父级路径。 */
import type { MagiRuntimeStatus } from "./imports";
/** 用途：监控消息视图。使用范围：统计和最新统合提取。解耦评估：经同目录网关隔离父级路径。 */
import type { MagiSeelPanelMessageView } from "./imports";
/** 用途：运行时事实视图。使用范围：中央监控事实列表。解耦评估：同目录稳定类型。 */
import type { MagiMonitorFact } from "./TrinityMonitorPanel.types";
/** 用途：摘要统计视图。使用范围：中央监控摘要网格。解耦评估：同目录稳定类型。 */
import type { MagiMonitorStat } from "./TrinityMonitorPanel.types";
/** 用途：监控色调类型。使用范围：连接和告警状态。解耦评估：同目录稳定类型。 */
import type { MagiMonitorTone } from "./TrinityMonitorPanel.types";
/** 用途：格式化监控时间。使用范围：事实更新时间。解耦评估：共享只读格式规则。 */
import { formatMonitorTimestamp } from "./TrinityMonitorPanel.shared";
/** 用途：读取原始事件类型。使用范围：最后事件与告警统计。解耦评估：共享只读协议解析。 */
import { getRawEventType } from "./TrinityMonitorPanel.shared";
/** 用途：读取原始事件轮次。使用范围：当前轮次回退。解耦评估：共享只读协议解析。 */
import { getRawEventRoundId } from "./TrinityMonitorPanel.shared";
/** 用途：读取原始事件序号。使用范围：摘要序号。解耦评估：共享只读协议解析。 */
import { getRawEventSeqText } from "./TrinityMonitorPanel.shared";
/** 用途：识别原始监控消息。使用范围：统计与统合过滤。解耦评估：共享只读协议解析。 */
import { isRawEventMonitorMessage } from "./TrinityMonitorPanel.shared";
/** 用途：读取原始事件载荷。使用范围：工具失败告警和色调。解耦评估：共享只读协议解析。 */
import { readRawEventPayload } from "./TrinityMonitorPanel.shared";
/** 用途：读取非空字符串。使用范围：工具阶段判断。解耦评估：共享边界收窄规则。 */
import { readNonEmptyString } from "./TrinityMonitorPanel.shared";
/** 用途：解析原始事件色调。使用范围：最后事件统计。解耦评估：事件展示规则由 stream 模块拥有。 */
import { resolveEventTone } from "./TrinityMonitorPanel.stream";

/** 返回最近一条后端原始事件。 */
function getLastRawEvent(messages: readonly MagiSeelPanelMessageView[]) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message && isRawEventMonitorMessage(message)) {
            return message;
        }
    }
    return null;
}

/** 判断原始事件是否应计入监控告警。 */
function isAlertMessage(message: MagiSeelPanelMessageView) {
    if (!isRawEventMonitorMessage(message)) {
        return false;
    }
    const eventType = getRawEventType(message);
    if (eventType === "ROUND_FAILED" || eventType === "SEEL_REPLY_FAILED") {
        return true;
    }
    return eventType === "SEEL_TOOL_ACTIVITY_UPDATED" &&
        readNonEmptyString(Reflect.get(readRawEventPayload(message), "phase")) === "failed";
}

/** 统计失败事件；工具失败与轮次失败使用同一告警口径。 */
function resolveAlertCount(messages: readonly MagiSeelPanelMessageView[]) {
    return messages.filter(isAlertMessage).length;
}

/** @同步豁免: UI构建 - Vue computed 必须同步获得运行态标签。 */
export function formatRuntimeState(status: MagiRuntimeStatus | null | undefined) {
    if (status?.state === "heartbeat") {
        return "HEARTBEAT";
    }
    if (status?.state === "external") {
        return "AWAKE";
    }
    return status?.state === "sleeping" ? "SLEEP" : "UNKNOWN";
}

/** @同步豁免: UI构建 - Vue computed 必须同步获得连接标签。 */
export function formatConnectionStatus(status: ConnectionStatus) {
    if (status === "connected") {
        return "LINK OK";
    }
    if (status === "connecting") {
        return "LINKING";
    }
    return status === "error" ? "LINK ERROR" : "OFFLINE";
}

/** @同步豁免: UI构建 - Vue computed 必须同步获得状态色调。 */
/** @显式返回类型原因: 公开色调函数必须固定为 MagiMonitorTone，防止字符串字面量在分支合并后扩宽。 */
export function resolveRuntimeTone(
    status: MagiRuntimeStatus | null | undefined,
    connectionStatus: ConnectionStatus,
): MagiMonitorTone {
    if (connectionStatus === "disconnected" || connectionStatus === "error") {
        return "danger";
    }
    if (connectionStatus === "connecting") {
        return "warn";
    }
    if (status?.state === "heartbeat" || status?.state === "external") {
        return "good";
    }
    return status?.state === "sleeping" ? "muted" : "accent";
}

/** @同步豁免: UI构建 - Vue computed 必须同步取得最新可读统合。 */
export function extractLatestMonitorSynthesis(messages: readonly MagiSeelPanelMessageView[]) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!message || isRawEventMonitorMessage(message) || message.type === "user") {
            continue;
        }
        if (String(message.content ?? "").trim()) {
            return message;
        }
    }
    return null;
}

/** @同步豁免: UI构建 - 摘要网格必须在当前 computed 周期同步构造。 */
export function buildMonitorStats(
    messages: readonly MagiSeelPanelMessageView[],
    connectionStatus: ConnectionStatus,
    runtimeStatus: MagiRuntimeStatus | null | undefined,
) {
    const lastEvent = getLastRawEvent(messages);
    const rawType = lastEvent ? getRawEventType(lastEvent) : "";
    const runtimeTone = resolveRuntimeTone(runtimeStatus, connectionStatus);
    const alertCount = resolveAlertCount(messages);
    const stats: MagiMonitorStat[] = [];
    stats.push({ label: "STATE", value: formatRuntimeState(runtimeStatus), tone: runtimeTone });
    stats.push({ label: "LINK", value: formatConnectionStatus(connectionStatus), tone: runtimeTone });
    stats.push({
        label: "ROUND",
        value: runtimeStatus?.currentRoundId ?? (lastEvent ? getRawEventRoundId(lastEvent) : null) ?? "IDLE",
        tone: "accent",
    });
    stats.push({
        label: "LAST",
        value: lastEvent ? rawType : "IDLE",
        tone: lastEvent ? resolveEventTone(rawType, readRawEventPayload(lastEvent)) : "muted",
    });
    stats.push({ label: "SEQ", value: lastEvent ? getRawEventSeqText(lastEvent) : "#-", tone: "accent" });
    stats.push({ label: "ALERTS", value: String(alertCount), tone: alertCount > 0 ? "danger" : "muted" });
    return stats;
}

/** @同步豁免: UI构建 - 事实列表必须在当前 computed 周期同步构造。 */
export function buildMonitorFacts(runtimeStatus: MagiRuntimeStatus | null | undefined) {
    const facts: MagiMonitorFact[] = [];
    facts.push({ label: "TASK", value: runtimeStatus?.currentTask?.trim() || "Awaiting backend task dispatch" });
    facts.push({
        label: "REASON",
        value: runtimeStatus?.reason?.trim() || runtimeStatus?.lastSleepSummary?.trim() || "No runtime annotation",
    });
    facts.push({ label: "WAKE SOURCE", value: runtimeStatus?.wakeSource?.trim() || "-" });
    facts.push({
        label: "DOMINANT",
        value: runtimeStatus?.dominantStance?.trim() || runtimeStatus?.dominantSeel?.trim() || "-",
    });
    facts.push({
        label: "UPDATED",
        value: formatMonitorTimestamp(
            runtimeStatus?.dominantUpdatedAt ?? runtimeStatus?.updatedAt ?? runtimeStatus?.lastHeartbeatAt
            ?? runtimeStatus?.lastWakeAt ?? runtimeStatus?.lastSleepAt,
        ),
    });
    return facts;
}
