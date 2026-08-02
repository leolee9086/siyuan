/**
 * MAGI 工具活动投影。
 *
 * 用途：解析包装器工具、隐藏表达控制工具，并维护单条工具生命周期活动。
 * 使用范围：三贤人卡片与 Trinity 原始监控流。
 */

/** 用途：审慎信号事件。使用范围：审慎活动投影。解耦评估：经网关只依赖事件契约。 */
import type { MagiDeliberationSignalRaisedEvent } from "./imports";
/** 用途：投影运行态。使用范围：工具事件处理器。解耦评估：经网关只依赖状态契约。 */
import type { MagiProjectorRuntimeState } from "./imports";
/** 用途：工具生命周期事件。使用范围：运行/完成/失败更新。解耦评估：经网关只依赖事件契约。 */
import type { MagiSeelToolActivityUpdatedEvent } from "./imports";
/** 用途：工具检测事件。使用范围：包装器解析和等待执行活动。解耦评估：经网关只依赖事件契约。 */
import type { MagiToolCallDetectedEvent } from "./imports";
/** 用途：审慎消息稳定 ID。使用范围：工具信号活动。解耦评估：共享 ID 规则避免冲突。 */
import { buildProjectedMessageId } from "./magiProjector.shared";
/** 用途：查找目标贤者。使用范围：工具和审慎活动。解耦评估：共享别名规则避免模块漂移。 */
import { findSeelByName } from "./magiProjector.shared";
/** 用途：保留完整原始事件。使用范围：每个工具事件。解耦评估：共享模块确保只写 Trinity。 */
import { projectRawEventToMonitor } from "./magiProjector.shared";
/** 用途：收窄审慎开关。使用范围：工具参数展示。解耦评估：共享边界读取规则。 */
import { readBoolean } from "./magiProjector.shared";
/** 用途：读取非空扩展字段。使用范围：工具名和理由。解耦评估：共享边界读取规则。 */
import { readNonEmptyString } from "./magiProjector.shared";
/** 用途：读取工具参数对象。使用范围：包装器解析。解耦评估：共享边界读取规则。 */
import { readRecord } from "./magiProjector.shared";
/** 用途：事件幂等登记。使用范围：全部工具处理器。解耦评估：必须共享同一幂等集合。 */
import { shouldProcessEvent } from "./magiProjector.shared";
/** 用途：原位更新工具消息。使用范围：工具生命周期。解耦评估：共享排序规则保持线性流稳定。 */
import { upsertMessage } from "./magiProjector.shared";

/** 将单工具包装器还原为用户可读的真实工具名和参数。 */
function resolveToolCallPresentation(
    event: Pick<MagiToolCallDetectedEvent, "toolName" | "rawArguments" | "arguments">,
) {
    let payload = event.arguments;
    // 生命周期事件没有 argumentsComplete 字段；闭合 JSON 可在检测和执行阶段统一恢复。
    if (!payload) {
        try {
            payload = readRecord(JSON.parse(event.rawArguments));
        } catch {
            payload = undefined;
        }
    }
    const wrapper = readRecord(payload);
    const nestedName = readNonEmptyString(wrapper?.tool_name)
        ?? readNonEmptyString(wrapper?.toolName)
        ?? readNonEmptyString(wrapper?.name);
    const nestedArguments = readRecord(wrapper?.arguments)
        ?? readRecord(wrapper?.args)
        ?? readRecord(wrapper?.parameters);
    const isWrapper = event.toolName === "tool_call" || event.toolName === "magi_tool";
    return {
        name: nestedName ?? event.toolName,
        argumentsPayload: nestedArguments ?? payload ?? {},
        resolved: !isWrapper || !!nestedName,
    };
}

/** 控制回复输出的内部工具不应进入活动卡片。 */
function isInternalReplyTool(toolName: string) {
    return toolName === "wanna_speak_start"
        || toolName === "wanna_speak_continue"
        || toolName === "wanna_speak_stop";
}

/** 为工具调用构造跨参数片段稳定的消息 ID。 */
function buildToolActivityMessageId(
    event: MagiToolCallDetectedEvent | MagiSeelToolActivityUpdatedEvent,
) {
    return `${event.roundId}-${event.seelName}-tool-${event.toolCallId || event.toolCallIndex}`;
}

/** 从工具参数中提取审慎信号的理由与开关。 */
function extractDeliberationSignalMeta(argumentsPayload: Record<string, unknown>) {
    const reason = readNonEmptyString(Reflect.get(argumentsPayload, "reason"));
    const requiresDeliberation = readBoolean(Reflect.get(argumentsPayload, "requires_deliberation"))
        ?? readBoolean(Reflect.get(argumentsPayload, "requiresDeliberation"));
    return {
        ...(reason ? { reason } : {}),
        ...(requiresDeliberation !== undefined ? { requiresDeliberation } : {}),
    };
}

/** 由完整工具参数构造等待执行的首个语义活动。 */
function buildPendingToolMessage(
    event: MagiToolCallDetectedEvent,
    presentation: ReturnType<typeof resolveToolCallPresentation>,
) {
    const deliberationMeta = extractDeliberationSignalMeta(presentation.argumentsPayload);
    const contentParts = [`调用工具: ${presentation.name}`, "等待执行"];
    if (deliberationMeta.reason) {
        contentParts.push(`理由: ${deliberationMeta.reason}`);
    }
    // 工具明确给出审慎开关时才显示，缺省值不做推断。
    if (deliberationMeta.requiresDeliberation !== undefined) {
        contentParts.push(`需要审慎: ${deliberationMeta.requiresDeliberation ? "是" : "否"}`);
    }
    return {
        id: buildToolActivityMessageId(event),
        type: "system",
        content: contentParts.join(" | "),
        status: "pending",
        timestamp: event.timestamp,
        meta: {
            type: "tool-call",
            roundId: event.roundId,
            toolName: presentation.name,
            transportToolName: event.toolName,
            toolCallIndex: event.toolCallIndex,
            toolCallId: event.toolCallId,
            rawArguments: event.rawArguments,
            argumentsComplete: event.argumentsComplete,
            arguments: presentation.argumentsPayload,
            ...(deliberationMeta.reason ? { reason: deliberationMeta.reason } : {}),
            ...(deliberationMeta.requiresDeliberation !== undefined
                ? { requiresDeliberation: deliberationMeta.requiresDeliberation }
                : {}),
        },
    };
}

/** 投影审慎决策信号到投票状态。 */
/** @同步豁免: 生命周期 - 事件分发期需要原子更新主流与贤人流，避免两处状态跨微任务错位。 */
export function projectDeliberationSignal(
    state: MagiProjectorRuntimeState,
    event: MagiDeliberationSignalRaisedEvent,
) {
    if (!shouldProcessEvent(state, event.eventId)) {
        return;
    }
    projectRawEventToMonitor(state, "DELIBERATION_SIGNAL_RAISED", event);
    const initiator = readNonEmptyString(event.initiator);
    const reason = readNonEmptyString(event.reason);
    const signalContent = [
        "🔔 审慎信号已发起",
        ...(initiator ? [`发起者: ${initiator}`] : []),
        ...(reason ? [`理由: ${reason}`] : []),
    ].join(" | ");
    upsertMessage(state.target.consensusMessages, {
        id: buildProjectedMessageId(event.eventId, "deliberation-signal-consensus"),
        type: "system",
        content: signalContent,
        status: "success",
        timestamp: event.timestamp,
        meta: {
            type: "deliberation-signal",
            roundId: event.roundId,
            ...(initiator ? { initiator } : {}),
            ...(reason ? { reason } : {}),
            requiresDeliberation: event.requiresDeliberation,
        },
    });
    const seel = findSeelByName(state.target.seels, event.initiator, event.displayName);
    if (!seel) {
        return;
    }
    upsertMessage(seel.messages, {
        id: buildProjectedMessageId(event.eventId, "deliberation-signal-seel"),
        type: "system",
        content: signalContent,
        status: "success",
        timestamp: event.timestamp,
        meta: {
            type: "deliberation-signal",
            ...(initiator ? { initiator } : {}),
            ...(reason ? { reason } : {}),
            requiresDeliberation: event.requiresDeliberation,
        },
    });
}

/** 投影工具调用到贤者面板（完整参数后建立稳定活动）。 */
/** @同步豁免: 生命周期 - 参数闭合判定与首条工具活动必须在同一事件分发周期完成。 */
export function projectToolCall(state: MagiProjectorRuntimeState, event: MagiToolCallDetectedEvent) {
    if (!shouldProcessEvent(state, event.eventId)) {
        return;
    }
    projectRawEventToMonitor(state, "TOOL_CALL_DETECTED", event);
    const seel = findSeelByName(state.target.seels, event.seelName, event.displayName);
    if (!seel) {
        return;
    }
    const presentation = resolveToolCallPresentation(event);
    if (!event.argumentsComplete || !presentation.resolved || isInternalReplyTool(presentation.name)) {
        return;
    }
    upsertMessage(seel.messages, buildPendingToolMessage(event, presentation));
}

/** 将后端工具执行生命周期投影为单条可更新活动。 */
/** @同步豁免: 生命周期 - 运行阶段必须同步覆盖同一稳定消息，保持线性活动顺序。 */
export function projectSeelToolActivity(
    state: MagiProjectorRuntimeState,
    event: MagiSeelToolActivityUpdatedEvent,
) {
    if (!shouldProcessEvent(state, event.eventId)) {
        return;
    }
    projectRawEventToMonitor(state, "SEEL_TOOL_ACTIVITY_UPDATED", event);
    const seel = findSeelByName(state.target.seels, event.seelName, event.displayName);
    const presentation = resolveToolCallPresentation(event);
    // 包装器内部的表达控制工具也必须隐藏，否则执行阶段会把它重新暴露到卡片。
    if (!seel || isInternalReplyTool(presentation.name)) {
        return;
    }
    const phaseLabel = event.phase === "completed"
        ? "执行完成"
        : event.phase === "failed"
            ? "执行失败"
            : "执行中";
    const messageStatus = event.phase === "completed"
        ? "success"
        : event.phase === "failed"
            ? "error"
            : "pending";
    upsertMessage(seel.messages, {
        id: buildToolActivityMessageId(event),
        type: "system",
        content: `调用工具: ${presentation.name} | ${phaseLabel}`,
        status: messageStatus,
        timestamp: event.timestamp,
        meta: {
            type: "tool-activity",
            roundId: event.roundId,
            toolName: presentation.name,
            transportToolName: event.toolName,
            toolCallIndex: event.toolCallIndex,
            toolCallId: event.toolCallId,
            rawArguments: event.rawArguments,
            arguments: presentation.argumentsPayload,
            argumentsComplete: true,
            phase: event.phase,
            ...(event.result ? { result: event.result } : {}),
            ...(event.error ? { error: event.error } : {}),
        },
    });
}
