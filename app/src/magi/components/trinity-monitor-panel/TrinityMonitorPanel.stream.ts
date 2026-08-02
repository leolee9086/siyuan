/** 用途：监控消息视图。使用范围：原始事件流构造。解耦评估：经目录网关隔离父级路径。 */
import type { MagiSeelPanelMessageView } from "./imports";
/** 用途：事件流条目类型。使用范围：返回视图列表。解耦评估：同目录稳定类型。 */
import type { MagiMonitorStreamItem } from "./TrinityMonitorPanel.types";
/** 用途：格式化事件时间。使用范围：流条目。解耦评估：共享只读格式规则。 */
import { formatMonitorTimestamp } from "./TrinityMonitorPanel.shared";
/** 用途：读取事件轮次。使用范围：流条目。解耦评估：共享协议解析。 */
import { getRawEventRoundId } from "./TrinityMonitorPanel.shared";
/** 用途：读取事件序号。使用范围：流条目。解耦评估：共享协议解析。 */
import { getRawEventSeqText } from "./TrinityMonitorPanel.shared";
/** 用途：读取事件类型。使用范围：流条目。解耦评估：共享协议解析。 */
import { getRawEventType } from "./TrinityMonitorPanel.shared";
/** 用途：过滤原始监控消息。使用范围：事件流。解耦评估：共享协议解析。 */
import { isRawEventMonitorMessage } from "./TrinityMonitorPanel.shared";
/** 用途：读取事件载荷。使用范围：摘要与详情。解耦评估：共享协议解析。 */
import { readRawEventPayload } from "./TrinityMonitorPanel.shared";
/** 用途：读取非空字段。使用范围：各事件摘要。解耦评估：共享边界收窄规则。 */
import { readNonEmptyString } from "./TrinityMonitorPanel.shared";
/** 用途：裁剪长摘要。使用范围：事件预览。解耦评估：共享展示规则。 */
import { truncateText } from "./TrinityMonitorPanel.shared";

const MAX_MONITOR_STREAM_ITEMS = 180;

/** 返回事件来源标签。 */
function resolveEventSourceLabel(payload: Record<string, unknown>) {
    return readNonEmptyString(Reflect.get(payload, "displayName"))
        ?? readNonEmptyString(Reflect.get(payload, "seelName"))
        ?? readNonEmptyString(Reflect.get(payload, "initiator"))
        ?? readNonEmptyString(Reflect.get(payload, "state"))
        ?? "MAGI CORE";
}

/** 构造运行态更新摘要。 */
function summarizeRuntimeStatus(payload: Record<string, unknown>) {
    const parts: string[] = [];
    const state = readNonEmptyString(Reflect.get(payload, "state"));
    const dominant = readNonEmptyString(Reflect.get(payload, "dominantSeel"));
    const stance = readNonEmptyString(Reflect.get(payload, "dominantStance"));
    const task = readNonEmptyString(Reflect.get(payload, "currentTask"));
    const reason = readNonEmptyString(Reflect.get(payload, "reason"));
    if (state) {
        parts.push(state);
    }
    if (dominant) {
        parts.push(dominant);
    }
    if (stance) {
        parts.push(stance);
    }
    if (task) {
        parts.push(task);
    }
    if (reason) {
        parts.push(reason);
    }
    return parts.join(" | ") || "Runtime status updated";
}

/** 构造 LLM 请求摘要。 */
function summarizeLlmRequest(payload: Record<string, unknown>) {
    const seel = readNonEmptyString(Reflect.get(payload, "displayName"))
        ?? readNonEmptyString(Reflect.get(payload, "seelName"))
        ?? "UNKNOWN";
    const model = readNonEmptyString(Reflect.get(payload, "model")) ?? "unknown-model";
    const toolCount = Reflect.get(payload, "toolCount");
    return `${seel} -> ${model}${typeof toolCount === "number" ? ` | tools ${toolCount}` : ""}`;
}

/** 构造投票更新摘要。 */
function summarizeVote(payload: Record<string, unknown>) {
    const parts: string[] = [];
    const progress = Reflect.get(payload, "progress");
    const decision = readNonEmptyString(Reflect.get(payload, "decision"));
    const motion = readNonEmptyString(Reflect.get(payload, "proposedAction"));
    const passed = Reflect.get(payload, "passed");
    const reason = readNonEmptyString(Reflect.get(payload, "decisionReason"))
        ?? readNonEmptyString(Reflect.get(payload, "reason"))
        ?? readNonEmptyString(Reflect.get(payload, "deliberationReason"));
    if (typeof progress === "number") {
        parts.push(`progress ${progress}%`);
    }
    if (motion) {
        parts.push(`motion ${truncateText(motion, 42)}`);
    }
    if (decision) {
        parts.push(`decision ${decision}`);
    }
    if (typeof passed === "boolean") {
        parts.push(passed ? "通过" : "未通过");
    }
    if (reason) {
        parts.push(truncateText(reason, 48));
    }
    return parts.join(" | ") || "Vote status updated";
}

/** 构造工具检测摘要。 */
function summarizeToolCall(payload: Record<string, unknown>) {
    const seel = readNonEmptyString(Reflect.get(payload, "displayName"))
        ?? readNonEmptyString(Reflect.get(payload, "seelName"))
        ?? "UNKNOWN";
    const toolName = readNonEmptyString(Reflect.get(payload, "toolName")) ?? "tool";
    const complete = Reflect.get(payload, "argumentsComplete") === true ? "complete" : "streaming";
    return `${seel} | ${toolName} | ${complete}`;
}

/** 构造工具生命周期摘要。 */
function summarizeToolActivity(payload: Record<string, unknown>) {
    const seel = readNonEmptyString(Reflect.get(payload, "displayName"))
        ?? readNonEmptyString(Reflect.get(payload, "seelName"))
        ?? "UNKNOWN";
    const toolName = readNonEmptyString(Reflect.get(payload, "toolName")) ?? "tool";
    const phase = readNonEmptyString(Reflect.get(payload, "phase")) ?? "running";
    const output = readNonEmptyString(Reflect.get(payload, "error"))
        ?? readNonEmptyString(Reflect.get(payload, "result"));
    return `${seel} | ${toolName} | ${phase}${output ? ` | ${truncateText(output, 56)}` : ""}`;
}

/** 构造上下文整理摘要。 */
function summarizeContextTrim(payload: Record<string, unknown>) {
    const before = Reflect.get(payload, "beforeCount");
    const after = Reflect.get(payload, "afterCount");
    const dropped = Reflect.get(payload, "droppedCount");
    return `context ${before ?? "?"} -> ${after ?? "?"} | dropped ${dropped ?? "?"}`;
}

/** 按事件语义生成单行预览。 */
function buildPayloadSummary(eventType: string, payload: Record<string, unknown>) {
    if (eventType === "RUNTIME_STATUS_UPDATED") {
        return summarizeRuntimeStatus(payload);
    }
    if (eventType === "LLM_REQUEST_SENT") {
        return summarizeLlmRequest(payload);
    }
    // 回复启动事件优先展示触发本轮回复的用户输入。
    if (eventType === "SEEL_REPLY_STARTED") {
        const userInput = readNonEmptyString(Reflect.get(payload, "userInput")) ?? "Seel reply started";
        return truncateText(userInput, 120);
    }
    if (eventType === "SEEL_VOTE_UPDATED") {
        return summarizeVote(payload);
    }
    // 贤人回复与最终统合都以生成内容作为完成摘要。
    if (eventType === "SEEL_REPLY_COMPLETED" || eventType === "DOMINANT_SYNTHESIS_COMPLETED") {
        const content = readNonEmptyString(Reflect.get(payload, "content")) ?? "Reply completed";
        return truncateText(content, 120);
    }
    // 贤人回复失败与整轮失败都以错误字段作为告警摘要。
    if (eventType === "SEEL_REPLY_FAILED" || eventType === "ROUND_FAILED") {
        const error = readNonEmptyString(Reflect.get(payload, "error")) ?? "Failure detected";
        return truncateText(error, 120);
    }
    if (eventType === "TOOL_CALL_DETECTED") {
        return summarizeToolCall(payload);
    }
    if (eventType === "SEEL_TOOL_ACTIVITY_UPDATED") {
        return summarizeToolActivity(payload);
    }
    if (eventType === "CONTEXT_HISTORY_TRIMMED") {
        return summarizeContextTrim(payload);
    }
    return truncateText(
        readNonEmptyString(Reflect.get(payload, "reason"))
        ?? readNonEmptyString(Reflect.get(payload, "content"))
        ?? readNonEmptyString(Reflect.get(payload, "error"))
        ?? "Backend event payload available",
        120,
    );
}

/** 返回运行态事件的专用色调，其他状态交给通用规则。 */
function resolveRuntimeEventTone(payload: Record<string, unknown>) {
    const state = readNonEmptyString(Reflect.get(payload, "state"));
    if (state === "heartbeat" || state === "external") {
        return "good";
    }
    return state === "sleeping" ? "muted" : null;
}

/** @同步豁免: UI构建 - 事件色调必须同步提供给摘要与模板。 */
export function resolveEventTone(eventType: string, payload: Record<string, unknown>) {
    const toolPhase = readNonEmptyString(Reflect.get(payload, "phase"));
    if (eventType === "ROUND_FAILED" || eventType === "SEEL_REPLY_FAILED" ||
        (eventType === "SEEL_TOOL_ACTIVITY_UPDATED" && toolPhase === "failed")) {
        return "danger";
    }
    if (eventType === "TOOL_CALL_DETECTED" || eventType === "DELIBERATION_SIGNAL_RAISED" ||
        (eventType === "SEEL_TOOL_ACTIVITY_UPDATED" && toolPhase === "running")) {
        return "warn";
    }
    const runtimeTone = eventType === "RUNTIME_STATUS_UPDATED" ? resolveRuntimeEventTone(payload) : null;
    if (runtimeTone) {
        return runtimeTone;
    }
    if (eventType === "DOMINANT_SYNTHESIS_COMPLETED" || eventType === "CONSENSUS_EMITTED" ||
        eventType.endsWith("_COMPLETED")) {
        return "good";
    }
    return "accent";
}

/** 把单条原始事件转换为中央监控流条目。 */
function buildMonitorStreamItem(message: MagiSeelPanelMessageView) {
    const payload = readRawEventPayload(message);
    const eventType = getRawEventType(message);
    return {
        id: message.id,
        eventType,
        tone: resolveEventTone(eventType, payload),
        timestampText: formatMonitorTimestamp(message.timestamp),
        seqText: getRawEventSeqText(message),
        roundId: getRawEventRoundId(message),
        sourceLabel: resolveEventSourceLabel(payload),
        summary: buildPayloadSummary(eventType, payload),
        payloadText: JSON.stringify(payload, null, 2),
    };
}

/** @同步豁免: UI构建 - 虚拟事件流必须在当前 computed 周期同步构造。 */
export function buildMonitorStream(messages: readonly MagiSeelPanelMessageView[]) {
    const items: MagiMonitorStreamItem[] = messages
        .filter(isRawEventMonitorMessage)
        .map(buildMonitorStreamItem);
    return items.length <= MAX_MONITOR_STREAM_ITEMS
        ? items
        : items.slice(items.length - MAX_MONITOR_STREAM_ITEMS);
}
