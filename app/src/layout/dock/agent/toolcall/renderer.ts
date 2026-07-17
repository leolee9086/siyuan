/** Native Agent tool-call cards. Tool payloads are untrusted and must be escaped before insertion. */
/** 用途：转义工具参数和结果。使用范围：工具卡片 HTML 边界，防止不可信工具输出进入 DOM。解耦评估：渲染函数接收字符串即可替换该工具，不与 Agent 会话状态耦合。 */
import {escapeHtml} from "./imports";
/** 用途：复用搜索进度字段结构。使用范围：统一工具卡片消费 kernel 的进度快照；仅依赖类型，不引入搜索执行逻辑。解耦评估：可由独立通用进度类型替换，不影响渲染入口。 */
import type {AgentWebSearchProgress} from "../websearch/types";
/** 用途：约束工具卡片状态。使用范围：开始态和完成态渲染；类型依赖不携带运行时耦合。 */
import type {ToolCallState} from "./renderer.types";

/** Convert untrusted tool data to readable JSON without allowing serialization errors to break the card. */
const formatJSON = (value: unknown) => {
    try {
        const formatted = JSON.stringify(value, null, 2);
        return formatted === undefined ? String(value ?? "") : formatted;
    } catch {
        return String(value ?? "");
    }
};

/** Render the shared header used by running and completed native tool cards. */
const renderToolHeader = (name: string, state: ToolCallState) => {
    const status = state === "running" ? "Running" : "Complete";
    return '<div class="agent-chat__tool-call-header">' +
        '<svg class="agent-chat__tool-icon"><use xlink:href="#iconCode"></use></svg>' +
        '<span class="agent-chat__tool-title">' + escapeHtml(name || "Tool call") + "</span>" +
        '<span class="agent-chat__tool-call-status agent-chat__tool-call-status--' + state + '">' + status + "</span>" +
        "</div>";
};

/** Render expandable tool arguments so users can inspect the exact call payload. */
const renderArguments = (args: Record<string, unknown>) => {
    const value = formatJSON(args);
    return '<details class="agent-chat__tool-call-details">' +
        "<summary>Arguments</summary><pre>" + escapeHtml(value) + "</pre></details>";
};

/** Render generic progress fields supplied by a native tool progress callback. */
const renderProgress = (progress: AgentWebSearchProgress) => {
    const total = Math.max(0, progress.total || 0);
    const done = Math.max(0, Math.min(progress.done || 0, total || progress.done || 0));
    const current = progress.current ? "<span>" + escapeHtml(progress.current) + "</span>" : "";
    const count = progress.partialCount === undefined ? "" : progress.partialCount + " results";
    const progressText = total > 0 ? done + "/" + total : "Working";
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return '<div class="agent-chat__tool-call-progress">' +
        '<div class="agent-chat__tool-call-progress-label">' + current +
        "<span>" + progressText + (count ? " · " + escapeHtml(count) : "") + "</span></div>" +
        '<div class="agent-chat__web-search-progress-track"><div class="agent-chat__web-search-progress-bar" style="width:' + percent + '%"></div></div>' +
        "</div>";
};

/** Render the initial card immediately after the backend emits tool_call. */
/**
 * @同步豁免: UI构建
 * 调用方必须在 tool_call 事件处理期间立即生成卡片，异步化会让后续进度事件找不到稳定 DOM 容器。
 */
export const renderToolCallStart = (name: string, args: Record<string, unknown>) => {
    return '<div class="agent-chat__tool-card agent-chat__tool-card--call">' +
        renderToolHeader(name, "running") + renderArguments(args) +
        '<div class="agent-chat__tool-call-body">Waiting for tool output...</div></div>';
};

/** Replace a running card when a backend tool_progress event arrives. */
/**
 * @同步豁免: UI构建
 * 进度事件按 SSE 顺序同步替换当前卡片，避免用户看到过期状态。
 */
export const renderToolCallProgress = (
    name: string,
    args: Record<string, unknown>,
    progress: AgentWebSearchProgress,
) => {
    return '<div class="agent-chat__tool-card agent-chat__tool-card--call">' +
        renderToolHeader(name, "running") + renderArguments(args) +
        renderProgress(progress) +
        '<div class="agent-chat__tool-call-body">' + escapeHtml(progress.phase || "Working") + "</div></div>";
};

/** Render the complete display payload after a native tool_result event arrives. */
/**
 * @同步豁免: UI构建
 * 完整结果必须在 tool_result 到达时同步写入可滚动卡片，不能等待异步渲染导致结果错位。
 */
export const renderToolCallResult = (
    name: string,
    args: Record<string, unknown>,
    result: string,
) => {
    return '<div class="agent-chat__tool-card agent-chat__tool-card--call">' +
        renderToolHeader(name, "complete") + renderArguments(args) +
        '<pre class="agent-chat__tool-call-result">' + escapeHtml(result || "") + "</pre></div>";
};
