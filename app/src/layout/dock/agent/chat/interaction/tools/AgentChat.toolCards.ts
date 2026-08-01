/** 用途：约束工具卡片读写的聊天状态；使用范围：本文件所有函数。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束权威工具流事件；使用范围：工具卡片统一领域入口。 */
import type {ISSEResult} from "./imports";
/** 用途：生成回退工具条目标识；使用范围：待办结果缺少原卡片时。 */
/** 用途：插入新工具卡片；使用范围：开始和结果回退。 */
import {insertBeforeAI} from "./imports";
/** 用途：登记搜索引用；使用范围：搜索完成。 */
import {registerWebSearchReferences} from "./imports";
/** 用途：渲染待办工具结果；使用范围：todo_write 完成。 */
import {renderTodoList} from "./imports";
/** 用途：渲染通用工具进度；使用范围：进度事件；解耦评估：同一工具聚合内直接调用纯 HTML 渲染器。 */
import {renderToolCallProgress} from "./toolcall/renderer";
/** 用途：渲染通用工具结果；使用范围：完成事件；解耦评估：同一工具聚合内直接调用纯 HTML 渲染器。 */
import {renderToolCallResult} from "./toolcall/renderer";
/** 用途：渲染通用工具开始状态；使用范围：调用事件；解耦评估：同一工具聚合内直接调用纯 HTML 渲染器。 */
import {renderToolCallStart} from "./toolcall/renderer";
/** 用途：渲染网页搜索进度；使用范围：开始和进度事件；解耦评估：同一工具聚合内直接调用纯 HTML 渲染器。 */
import {renderWebSearchProgress} from "./websearch/renderer";
/** 用途：渲染网页搜索结果；使用范围：完成事件；解耦评估：同一工具聚合内直接调用纯 HTML 渲染器。 */
import {renderWebSearchResult} from "./websearch/renderer";
/** 用途：工具卡片变化后维持贴底；使用范围：所有 DOM 更新。 */
import {scrollToBottom} from "./imports";
/** 用途：查找工具记录；使用范围：进度和结果渲染。 */
import {findCurrentToolCall} from "./AgentChat.toolState";
/** 用途：查找工具卡片；使用范围：进度和结果更新。 */
import {findToolCallCard} from "./AgentChat.toolState";
/** 用途：读取搜索查询词；使用范围：搜索进度和结果。 */
import {webSearchQuery} from "./AgentChat.toolState";

/** 投影工具开始事件，并排除由独立交互领域处理的工具。 */
function applyToolCallEvent(runtime: AgentChatRuntime, event: Extract<ISSEResult, {type: "tool_call"}>) {
    // 网页搜索拥有独立的进度卡片与引用索引，先交给专用投影。
    if (event.name === "web_search") {
        appendWebSearchCall(runtime, event);
        return;
    }
    // 问题和前端工具由各自交互流程渲染，不创建通用工具卡片。
    if (event.name === "question" || event.name === "frontend") {
        return;
    }
    appendToolCall(runtime, event);
}

/** 投影工具进度事件，网页搜索和通用工具分别更新各自卡片。 */
function applyToolProgressEvent(runtime: AgentChatRuntime, event: Extract<ISSEResult, {type: "tool_progress"}>) {
    // 网页搜索进度包含查询与结果预览，不能使用通用工具进度模板。
    if (event.name === "web_search") {
        updateWebSearchProgress(runtime, event);
        return;
    }
    updateToolCallProgress(runtime, event);
}

/** 投影工具完成事件，并排除由独立交互领域处理的工具。 */
function applyToolResultEvent(runtime: AgentChatRuntime, event: Extract<ISSEResult, {type: "tool_result"}>) {
    // 网页搜索完成时还要登记可信引用，因此使用专用完成流程。
    if (event.name === "web_search") {
        completeWebSearch(runtime, event);
        return;
    }
    // 问题和前端工具的结果由其原卡片消费，不创建通用完成卡片。
    if (event.name === "question" || event.name === "frontend") {
        return;
    }
    completeToolCall(runtime, event);
}

/** 将一个工具领域事件投影到对应卡片。 @同步豁免: UI构建 */
export function applyToolCardEvent(
    runtime: AgentChatRuntime,
    event: Extract<ISSEResult, {type: "tool_call" | "tool_progress" | "tool_result"}>,
) {
    // 开始事件只负责建立卡片，完成后不再进入进度或结果分支。
    if (event.type === "tool_call") {
        applyToolCallEvent(runtime, event);
        return;
    }
    // 进度事件只更新已建立的卡片，完成后不再进入结果分支。
    if (event.type === "tool_progress") {
        applyToolProgressEvent(runtime, event);
        return;
    }
    applyToolResultEvent(runtime, event);
}

/** 创建网页搜索进度卡片。 @同步豁免: UI构建 */
function appendWebSearchCall(runtime: AgentChatRuntime, event: Extract<ISSEResult, {type: "tool_call"}>) {
    const element = createToolCard(event.callID);
    const query = typeof event.arguments.query === "string" ? event.arguments.query : "";
    element.innerHTML = renderWebSearchProgress(query, {
        phase: "start",
        done: 0,
        total: 0,
        partialCount: 0,
        latestResults: [],
    });
    insertNewToolCard(runtime, element);
}

/** 更新现有网页搜索卡片。 @同步豁免: UI构建 */
function updateWebSearchProgress(runtime: AgentChatRuntime, event: Extract<ISSEResult, {type: "tool_progress"}>) {
    const card = findToolCallCard(runtime, event.callID);
    if (!card) {
        return;
    }
    card.innerHTML = renderWebSearchProgress(webSearchQuery(runtime, event.callID), event.progress);
    scrollToBottom(runtime);
}

/** 完成网页搜索卡片并登记引用。 @同步豁免: UI构建 */
function completeWebSearch(runtime: AgentChatRuntime, event: Extract<ISSEResult, {type: "tool_result"}>) {
    registerWebSearchReferences(runtime, event.result);
    const card = findToolCallCard(runtime, event.callID);
    const html = renderWebSearchResult(webSearchQuery(runtime, event.callID), event.result);
    if (card) {
        card.innerHTML = html;
        scrollToBottom(runtime);
        return;
    }
    const fallback = createToolCard(event.callID);
    fallback.innerHTML = html;
    insertNewToolCard(runtime, fallback);
}

/** 创建通用工具开始卡片。 @同步豁免: UI构建 */
function appendToolCall(runtime: AgentChatRuntime, event: Extract<ISSEResult, {type: "tool_call"}>) {
    const element = createToolCard(event.callID);
    element.innerHTML = renderToolCallStart(event.name, event.arguments);
    insertNewToolCard(runtime, element);
}

/** 更新通用工具进度卡片。 @同步豁免: UI构建 */
function updateToolCallProgress(runtime: AgentChatRuntime, event: Extract<ISSEResult, {type: "tool_progress"}>) {
    const card = findToolCallCard(runtime, event.callID);
    const call = findCurrentToolCall(runtime, event.callID, event.name);
    if (!card || !call) {
        return;
    }
    card.innerHTML = renderToolCallProgress(event.name, call.arguments, event.progress);
    scrollToBottom(runtime);
}

/** 完成通用工具卡片，必要时为待办结果创建回退卡片。 @同步豁免: UI构建 */
function completeToolCall(runtime: AgentChatRuntime, event: Extract<ISSEResult, {type: "tool_result"}>) {
    const card = findToolCallCard(runtime, event.callID);
    const call = findCurrentToolCall(runtime, event.callID, event.name);
    // 原卡片与工具调用记录均存在时，原地更新卡片内容：
    // 渲染通用工具结果依赖 call.arguments 重建参数上下文，仅存在卡片而缺失记录时无法渲染，故两者必须同时成立。
    if (card && call) {
        card.innerHTML = event.name === "todo_write"
            ? renderTodoList(event.result)
            : renderToolCallResult(event.name, call.arguments, event.result);
        scrollToBottom(runtime);
        return;
    }
    // 原卡片缺失时仅对待办工具创建回退卡片：
    // todo_write 的结果独立展示为待办清单，可在新卡片中渲染；其他工具缺少原卡片的参数上下文，无法重建，故静默跳过。
    if (event.name === "todo_write") {
        appendTodoFallback(runtime, event.result);
    }
}

/** 创建带可选调用 ID 的工具消息元素。 */
function createToolCard(callID: string) {
    const element = document.createElement("div");
    element.className = "agent-chat__msg agent-chat__msg--tool";
    if (callID) {
        element.setAttribute("data-tool-call-id", callID);
    }
    return element;
}

/** 插入新工具卡片并更新稳定界面状态。 */
function insertNewToolCard(runtime: AgentChatRuntime, element: HTMLElement) {
    insertBeforeAI(runtime, element);
    runtime.hasInterveningCard = true;
    scrollToBottom(runtime, true);
}

/** 在缺少原调用卡片时展示待办结果。 */
function appendTodoFallback(runtime: AgentChatRuntime, result: string) {
    const element = createToolCard("");
    element.setAttribute("data-message-id", runtime.sessionPorts.repository.newSessionId());
    element.innerHTML = renderTodoList(result);
    insertNewToolCard(runtime, element);
}
