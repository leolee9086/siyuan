/** 用途：约束确认卡片的效果快照。使用范围：持久化确认条目渲染时读取效果描述；仅依赖类型，不加载 SSE 实现。解耦评估：效果渲染已由 renderConfirmEffects 收敛，此处仅透传类型。 */
import type {IToolEffects} from "./imports";
/** 用途：复用通用消息渲染器。使用范围：助手正文后处理、问题卡片与待办清单渲染。解耦评估：渲染函数均以数据为参数返回 HTML，可替换实现而不影响调用方。 */
import {postRender} from "./imports";
import {renderQuestionCardHTML} from "./imports";
import {renderTodoList} from "./imports";
/** 用途：渲染通用工具调用结果卡片。使用范围：非 todo_write / web_search 的持久化工具调用。解耦评估：仅传入名称、参数与结果字符串，与会话状态无耦合。 */
import {renderToolCallResult} from "./imports";
/** 用途：复用网页搜索渲染能力。使用范围：收集可信引用、规范化 URL、渲染搜索结果并隔离未验证链接。解耦评估：收集与渲染函数均以数据为参数，可独立替换实现。 */
import {collectWebSearchReferences} from "./imports";
import {normalizeWebURL} from "./imports";
import {protectUnverifiedWebLinks} from "./imports";
import {renderWebSearchResult} from "./imports";
import {resolveMappedWebReferences} from "./imports";
/** 用途：转义不可信 HTML 片段。使用范围：将工具参数与结果安全插入 DOM 前转义。解耦评估：纯工具函数，无状态依赖。 */
import {escapeHtml} from "./imports";
/** 用途：约束持久化助手消息与工具调用列表的输入结构。使用范围：会话投影还原持久化条目时使用；仅依赖类型，不加载实现。 */
import type {PersistedAssistantInput, PersistedToolCallsInput} from "./AgentChat.persisted.types";
/** 用途：约束运行时状态与工具调用条目。使用范围：投影渲染读取运行时容器与能力。仅依赖类型，不加载实现。 */
import type {AgentChatRuntime} from "./imports";
import type {AgentToolCall} from "./imports";
/** 用途：渲染确认操作的效果描述。使用范围：持久化确认卡片的效果部分。解耦评估：效果渲染收敛于此函数，调用方仅传数据。 */
import {renderConfirmEffects} from "./imports";
/** 用途：将工具名映射为本地化类别。使用范围：确认卡片描述文案。解耦评估：纯映射函数，无状态依赖。 */
import {toolCategory} from "./imports";
/** 用途：为消息卡片附加复制按钮。使用范围：助手消息渲染完成后。解耦评估：按钮行为由运行时注入，调用方只传入元素与配置。 */
import {addCopyButton} from "./imports";

/** 将可选工具调用标识写入持久化工具卡片。 */
function applyToolCallID(element: HTMLElement, toolCallID?: string) {
    if (toolCallID) {
        element.setAttribute("data-tool-call-id", toolCallID);
    }
}

/** 重置当前渲染批次的网页引用索引。 @同步豁免: 生命周期 */
export function resetWebReferenceIndex(runtime: AgentChatRuntime) {
    runtime.webReferenceMap = {};
    runtime.webReferenceURLs.clear();
}

/** 注册网页搜索返回的可信引用目标。 @同步豁免: 需要绝对同步的DOM访问 */
export function registerWebSearchReferences(runtime: AgentChatRuntime, raw: string) {
    const references = collectWebSearchReferences(raw);
    for (const [token, url] of Object.entries(references)) {
        if (runtime.webReferenceMap[token] === url) {
            continue;
        }
        const normalizedURL = normalizeWebURL(url);
        if (!normalizedURL) {
            continue;
        }
        runtime.webReferenceMap[token] = url;
        runtime.webReferenceURLs.add(normalizedURL);
    }
}

/** 解析可信网页引用并渲染助手 Markdown。 @同步豁免: UI构建 */
export function renderAssistantMarkdown(runtime: AgentChatRuntime, content: string) {
    const resolved = resolveMappedWebReferences(content, runtime.webReferenceMap);
    return runtime.lute.ProtylePreviewStr("", resolved) || escapeHtml(resolved);
}

/** 请求宿主确认后打开一个未被搜索结果验证的网页地址。 */
function confirmUnverifiedWebLink(runtime: AgentChatRuntime, url: string) {
    runtime.capabilities.confirm?.(
        "Unverified web link",
        "This URL was not returned by the web search tool. It may have been invented by the model. Open it anyway?",
        () => window.open(url, "_blank", "noopener,noreferrer"),
    );
}

/** 完成助手富文本渲染并隔离未经搜索结果验证的链接。 @同步豁免: UI构建 */
export function postRenderAssistant(runtime: AgentChatRuntime, container: HTMLElement) {
    const render = runtime.capabilities.postRender ?? postRender;
    render(container);
    protectUnverifiedWebLinks(container, runtime.webReferenceURLs, (url) => confirmUnverifiedWebLink(runtime, url));
}

/** 追加已持久化的助手消息。 @同步豁免: UI构建 */
export function appendPersistedAssistant(runtime: AgentChatRuntime, input: PersistedAssistantInput) {
    const {content, timestamp, entryId, allowRegenerate = true} = input;
    if (!content.trim()) {
        return;
    }
    const element = document.createElement("div");
    element.className = "agent-chat__msg agent-chat__msg--ai";
    if (entryId) {
        element.setAttribute("data-message-id", entryId);
    }
    element.innerHTML = '<div class="agent-chat__body b3-typography">' +
        renderAssistantMarkdown(runtime, content) + "</div>";
    runtime.messagesContainer.appendChild(element);
    postRenderAssistant(runtime, element);
    addCopyButton(runtime, element, {
        contentOverride: content,
        ...(timestamp !== undefined ? {timestamp} : {}),
        allowRegenerate,
    });
}

/** 渲染一个持久化工具调用，并返回是否产生了可见卡片。 */
function appendPersistedToolCall(runtime: AgentChatRuntime, toolCall: AgentToolCall) {
    if (!toolCall.result || toolCall.name === "question" || toolCall.name === "frontend") {
        return false;
    }
    const element = document.createElement("div");
    element.className = "agent-chat__msg agent-chat__msg--tool";
    // todo_write 工具调用以原生清单卡片形式渲染，不附加调用 ID 与参数面板
    if (toolCall.name === "todo_write") {
        element.innerHTML = renderTodoList(toolCall.result);
        runtime.messagesContainer.appendChild(element);
        return true;
    }
    // web_search 工具调用需先注册可信引用，再按搜索查询渲染结果卡片
    if (toolCall.name === "web_search") {
        registerWebSearchReferences(runtime, toolCall.result);
        applyToolCallID(element, toolCall.id);
        const query = typeof toolCall.arguments?.query === "string" ? toolCall.arguments.query : "";
        element.innerHTML = renderWebSearchResult(query, toolCall.result);
        runtime.messagesContainer.appendChild(element);
        return true;
    }
    applyToolCallID(element, toolCall.id);
    element.innerHTML = renderToolCallResult(toolCall.name, toolCall.arguments || {}, toolCall.result);
    runtime.messagesContainer.appendChild(element);
    return true;
}

/** 追加已持久化的工具调用和可选助手正文。 @同步豁免: UI构建 */
export function appendPersistedToolCalls(runtime: AgentChatRuntime, input: PersistedToolCallsInput) {
    let hasRendered = false;
    for (const toolCall of input.toolCalls) {
        hasRendered = appendPersistedToolCall(runtime, toolCall) || hasRendered;
    }
    // 存在助手正文时追加助手消息，即使工具调用均未产生可见卡片也标记为已渲染
    if (input.content.trim()) {
        appendPersistedAssistant(runtime, {
            content: input.content,
            ...(input.timestamp !== undefined ? {timestamp: input.timestamp} : {}),
            ...(input.entryId !== undefined ? {entryId: input.entryId} : {}),
            allowRegenerate: false,
        });
        hasRendered = true;
    }
}

/** 把持久化确认状态映射为本地化只读标签。 */
function resolveConfirmStatusLabel(status?: string) {
    const languages = window.siyuan.languages;
    if (status === "approved") {
        return languages.agentConfirmApprove || "Approved";
    }
    if (status === "rejected") {
        return languages.agentConfirmReject || "Rejected";
    }
    if (status === "always") {
        return languages.agentConfirmAlways || "Session Allow";
    }
    return languages.agentConfirmPending || "Pending";
}

/** 追加已持久化的确认卡片。 @同步豁免: UI构建 */
export function appendPersistedConfirm(runtime: AgentChatRuntime, entry: {
    id?: string;
    name: string;
    args: Record<string, unknown>;
    confirmID: string;
    effects?: IToolEffects;
    status?: string;
}) {
    const languages = window.siyuan.languages;
    const element = document.createElement("div");
    element.className = "agent-chat__msg agent-chat__msg--confirm agent-chat__msg--confirmed";
    if (entry.id) {
        element.setAttribute("data-message-id", entry.id);
    }
    const description = (languages.agentConfirmDesc || "Agent: {category} operation")
        .replace("{category}", escapeHtml(toolCategory(entry.name)));
    const statusLabel = resolveConfirmStatusLabel(entry.status);
    element.innerHTML = '<div class="agent-chat__confirm-card">' +
        '<div class="agent-chat__confirm-header"><svg class="agent-chat__confirm-icon"><use xlink:href="#iconInfo"></use></svg> ' +
        description + "</div>" + renderConfirmEffects(entry.effects) +
        '<pre class="agent-chat__confirm-args">' + escapeHtml(JSON.stringify(entry.args, null, 2)) + "</pre>" +
        '<div class="agent-chat__confirm-actions"><span class="agent-chat__confirm-done">' + statusLabel + "</span></div>" +
        "</div>";
    runtime.messagesContainer.appendChild(element);
}

/** 追加已持久化且不可再次提交的问题卡片。 @同步豁免: UI构建 */
export function appendPersistedQuestion(runtime: AgentChatRuntime, entry: {
    id?: string;
    questionID: string;
    questions: Array<Record<string, unknown>>;
    status?: string;
    answers?: string[];
}) {
    const languages = window.siyuan.languages;
    const element = document.createElement("div");
    element.className = "agent-chat__msg agent-chat__msg--question agent-chat__msg--confirmed";
    if (entry.id) {
        element.setAttribute("data-message-id", entry.id);
    }
    element.innerHTML = renderQuestionCardHTML(entry.questions, entry.questionID);
    const submit = element.querySelector<HTMLElement>(".agent-chat__question-submit");
    if (submit) {
        const submitted = entry.status === "submitted";
        submit.innerHTML = '<span class="agent-chat__confirm-done">' +
            (submitted ? languages.agentQuestionSubmitted || "Submitted" : languages.agentQuestionPending || "Awaiting answer") +
            "</span>";
    }
    for (const input of element.querySelectorAll<HTMLInputElement>("input")) {
        input.disabled = true;
    }
    const answers = entry.answers || [];
    for (const input of element.querySelectorAll<HTMLInputElement>("input[type=radio], input[type=checkbox]")) {
        input.checked = answers.includes(input.value);
    }
    const customInput = element.querySelector<HTMLInputElement>(".agent-chat__question-custom");
    const customAnswer = answers.find((answer) => element.querySelector('input[value="' + answer + '"]') === null);
    // 仅当存在自定义输入框且答案不在预置选项中时，将自定义答案回填到输入框
    if (customInput && customAnswer) {
        customInput.value = customAnswer;
    }
    runtime.messagesContainer.appendChild(element);
}
