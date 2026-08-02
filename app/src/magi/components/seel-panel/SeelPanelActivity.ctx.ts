/**
 * SeelPanel 活动流展示辅助。
 *
 * 将原始监控状态排除在贤人卡片之外，并把工具生命周期转换为可读内容。
 */

/** 用途：活动流消息契约。使用范围：过滤和内容格式化。解耦评估：仅依赖同目录类型。 */
import type { SeelMessageListItem } from "./SeelPanel.types";
/** 用途：虚拟列表联合项。使用范围：高度估算。解耦评估：仅依赖同目录类型。 */
import type { SeelVirtualListItem } from "./SeelPanel.types";

/** 将未知元数据收窄为只读展示记录。 */
function asRecord(value: unknown) {
    return typeof value === "object" && value !== null
        ? Object.fromEntries(Object.entries(value))
        : null;
}

/** 判断消息是否只是监控或徽标内部状态，不应占用活动流条目。 */
function hiddenActivityStateMessage(message: SeelMessageListItem["message"]) {
    const meta = asRecord(message.meta);
    const rawEvent = message.type === "event" && meta?.type === "raw-event";
    return rawEvent || meta?.type === "vote-state";
}

/**
 * 构造活动流虚拟列表。
 *
 * 作用：过滤原子监控状态，并在等待内容时追加一个稳定加载项。
 * 意图：卡片保持线性流式展示，但不把内部事件逐条暴露给用户。
 * 调用时机：消息或加载状态变化时由 computed 重新计算。
 */
/** @同步豁免: UI构建 - 虚拟列表渲染必须在当前 Vue 计算周期内同步得到条目。 */
export function buildSeelVirtualItems(
    messages: readonly SeelMessageListItem["message"][],
    loading: boolean,
    seelName: string,
) {
    const items: SeelVirtualListItem[] = messages
        .filter((message) => !hiddenActivityStateMessage(message))
        .map((message) => ({
            kind: "message",
            virtualId: message.id,
            message,
        }));
    if (loading) {
        items.push({
            kind: "loading",
            virtualId: `${seelName}-loading`,
        });
    }
    return items;
}

/**
 * 解析最新可见活动 token。
 *
 * 作用：用消息身份、状态和语义类型检测真实活动变化。
 * 意图：工具原地更新和流式回复也能触发卡片脉冲，内部快照不会触发。
 * 调用时机：SeelPanel watcher 每次消息集合变化时调用。
 */
/** @同步豁免: UI构建 - watcher 数据源需要同步返回稳定 token。 */
export function resolveLatestActivityToken(messages: readonly SeelMessageListItem["message"][]) {
    let latestTimestamp = -1;
    let latestToken = "";
    for (const message of messages) {
        if (hiddenActivityStateMessage(message)) {
            continue;
        }
        const meta = asRecord(message.meta);
        const timestamp = typeof message.timestamp === "number" ? message.timestamp : 0;
        if (timestamp < latestTimestamp) {
            continue;
        }
        latestTimestamp = timestamp;
        const activityType = typeof meta?.type === "string" ? meta.type : message.type;
        latestToken = `${message.id}:${message.status}:${activityType}:${timestamp}:${message.content.length}`;
    }
    return latestToken;
}

/**
 * 估算单条活动高度。
 *
 * 作用：为虚拟瀑布流提供不同语义内容的初始高度。
 * 意图：减少工具结果展开和流式消息进入时的滚动跳变。
 * 调用时机：VirtualMasonryGrid 布局每个条目时调用。
 */
/** @同步豁免: UI构建 - 虚拟列表布局要求同步数值。 */
export function estimateSeelMessageHeight(item: SeelVirtualListItem) {
    if (item.kind === "loading") {
        return 16;
    }
    const message = item.message;
    const meta = asRecord(message.meta);
    if (meta?.type === "tool-call" || meta?.type === "tool-activity") {
        return Reflect.get(meta, "result") || Reflect.get(meta, "error") ? 196 : 132;
    }
    if (message.type === "vote") {
        return 96;
    }
    if (message.type === "sse_stream") {
        return 120;
    }
    return 88;
}

/** 判断消息是否为可读工具生命周期活动。 */
/** @同步豁免: UI构建 - 模板分支必须同步判断消息类型。 */
export function isToolActivity(message: SeelMessageListItem["message"]) {
    const meta = asRecord(message.meta);
    return meta?.type === "tool-call" || meta?.type === "tool-activity";
}

/** 返回工具显示名称。 */
/** @同步豁免: UI构建 - 模板文本必须同步生成。 */
export function getToolName(meta: Record<string, unknown>) {
    const toolName = Reflect.get(meta, "toolName");
    return typeof toolName === "string" && toolName.trim() ? toolName : "工具调用";
}

/** 返回工具生命周期阶段。 */
/** @同步豁免: UI构建 - 模板样式必须同步生成。 */
export function getToolPhase(meta: Record<string, unknown>) {
    const phase = Reflect.get(meta, "phase");
    return phase === "running" || phase === "completed" || phase === "failed"
        ? phase
        : "ready";
}

/** 返回本地化工具阶段标签。 */
/** @同步豁免: UI构建 - 模板文本必须同步生成。 */
export function getToolPhaseLabel(meta: Record<string, unknown>) {
    const phase = getToolPhase(meta);
    if (phase === "running") {
        return "执行中";
    }
    if (phase === "completed") {
        return "已完成";
    }
    return phase === "failed" ? "失败" : "等待执行";
}

/** 格式化工具结果或错误，JSON 内容使用缩进展示。 */
/** @同步豁免: UI构建 - 模板内容必须同步生成。 */
export function getToolOutput(meta: Record<string, unknown>) {
    const output = getToolPhase(meta) === "failed"
        ? Reflect.get(meta, "error") ?? Reflect.get(meta, "result")
        : Reflect.get(meta, "result");
    if (typeof output !== "string" || !output.trim()) {
        return "";
    }
    try {
        return JSON.stringify(JSON.parse(output), null, 2);
    } catch {
        return output;
    }
}

/** 格式化完整或仍在构建的工具参数。 */
/** @同步豁免: UI构建 - 模板内容必须同步生成。 */
export function formatToolCallArgs(meta: Record<string, unknown>) {
    // 后端确认 JSON 已闭合并解析后优先展示结构化参数，否则保留当前原始片段。
    if (meta.argumentsComplete && meta.arguments) {
        try {
            return JSON.stringify(meta.arguments, null, 2);
        } catch {
            return String(meta.rawArguments || "");
        }
    }
    return String(meta.rawArguments || "");
}
