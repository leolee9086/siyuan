/** 用途：约束确认卡片效果；使用范围：持久化确认条目；解耦评估：经目录网关复用 SSE 类型，不加载实现。 */
import type {IToolEffects} from "./imports";
/** 用途：执行消息后处理；使用范围：助手正文渲染；解耦评估：复用唯一渲染后处理入口避免复制 DOM 规则。 */
import {postRender} from "./imports";
/** 用途：渲染问题卡片；使用范围：持久化问题条目；解耦评估：复用唯一问题卡结构保持实时和重建一致。 */
import {renderQuestionCardHTML} from "./imports";
/** 用途：渲染待办结果；使用范围：todo_write 持久化条目；解耦评估：复用消息渲染器避免复制清单协议。 */
import {renderTodoList} from "./imports";
/** 用途：渲染通用工具结果；使用范围：普通持久化工具调用；解耦评估：纯数据渲染器不读取会话状态。 */
import {renderToolCallResult} from "./imports";
/** 用途：收集网页搜索引用；使用范围：搜索结果投影；解耦评估：纯解析器集中维护引用协议。 */
import {collectWebSearchReferences} from "./imports";
/** 用途：规范化网页地址；使用范围：可信引用索引；解耦评估：纯 URL 规则集中维护。 */
import {normalizeWebURL} from "./imports";
/** 用途：隔离未验证链接；使用范围：助手正文后处理；解耦评估：安全策略由网页搜索领域统一实现。 */
import {protectUnverifiedWebLinks} from "./imports";
/** 用途：渲染网页搜索结果；使用范围：搜索工具卡片；解耦评估：复用唯一搜索结果渲染器。 */
import {renderWebSearchResult} from "./imports";
/** 用途：解析已映射引用；使用范围：助手 Markdown；解耦评估：引用替换规则由网页搜索领域统一维护。 */
import {resolveMappedWebReferences} from "./imports";
/** 用途：转义不可信 HTML；使用范围：工具参数与正文回退；解耦评估：纯函数是统一 HTML 安全边界。 */
import {escapeHtml} from "./imports";
/** 用途：约束持久化助手输入；使用范围：助手条目重建；解耦评估：独立类型文件固定投影边界。 */
import type {PersistedAssistantInput} from "./AgentChat.persisted.types";
/** 用途：约束持久化工具输入；使用范围：工具条目重建；解耦评估：独立类型文件固定投影边界。 */
import type {PersistedToolCallsInput} from "./AgentChat.persisted.types";
/** 用途：约束聊天运行时；使用范围：全部持久化投影；解耦评估：经目录网关隔离具体 AgentChat 门面。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束工具调用条目；使用范围：工具卡片重建；解耦评估：经目录网关复用消息领域类型。 */
import type {AgentToolCall} from "./imports";
/** 用途：渲染确认效果；使用范围：持久化确认卡片；解耦评估：调用方仅传效果数据，不复制展示规则。 */
import {renderConfirmEffects} from "./imports";
/** 用途：映射工具类别；使用范围：确认卡片描述；解耦评估：纯展示映射由反馈领域集中维护。 */
import {toolCategory} from "./imports";
/** 用途：附加复制按钮；使用范围：助手消息渲染；解耦评估：按钮行为通过运行时能力注入。 */
import {addCopyButton} from "./imports";
/** 用途：映射交互终态文案；使用范围：持久化确认和问题卡片；解耦评估：统一映射避免重建路径自行推断状态。 */
import {resolveInteractionStatusLabel} from "./imports";

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
    element.setAttribute("data-confirm-id", entry.confirmID);
    const description = (languages.agentConfirmDesc || "Agent: {category} operation")
        .replace("{category}", escapeHtml(toolCategory(entry.name)));
    const statusLabel = resolveInteractionStatusLabel("confirm", entry.status);
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
    const element = document.createElement("div");
    element.className = "agent-chat__msg agent-chat__msg--question agent-chat__msg--confirmed";
    if (entry.id) {
        element.setAttribute("data-message-id", entry.id);
    }
    element.setAttribute("data-question-id", entry.questionID);
    element.innerHTML = renderQuestionCardHTML(entry.questions, entry.questionID);
    const submit = element.querySelector<HTMLElement>(".agent-chat__question-submit");
    if (submit) {
        submit.innerHTML = '<span class="agent-chat__confirm-done">' +
            resolveInteractionStatusLabel("question", entry.status) + "</span>";
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
