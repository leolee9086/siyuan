
import {escapeHtml} from "../../../util/DOM/escape";
import {processSiYuanUri} from "../../../editor/processSiYuanUri";
import {highlightRender} from "../../../protyle/render/highlightRender";
import {mathRender} from "../../../protyle/render/mathRender";
import {mermaidRender} from "../../../protyle/render/mermaidRender";
import {flowchartRender} from "../../../protyle/render/flowchartRender";
import {graphvizRender} from "../../../protyle/render/graphvizRender";
import {chartRender} from "../../../protyle/render/chartRender";
import {mindmapRender} from "../../../protyle/render/mindmapRender";
import {abcRender} from "../../../protyle/render/abcRender";
import {plantumlRender} from "../../../protyle/render/plantumlRender";
import {htmlRender} from "../../../protyle/render/htmlRender";
import {showMessage} from "../../../dialog/message";

import type {App} from "../../../index";

export const renderTodoList = (result: string): string => {
    const L = window.siyuan.languages ?? {};
    const lines = result.split("\n");
    let html = '<div class="agent-chat__tool-card agent-chat__tool-card--todo">' +
    '<div class="agent-chat__todo-header">' +
        '<svg class="agent-chat__tool-icon"><use xlink:href="#iconList"></use></svg>' +
        '<span class="agent-chat__tool-title">' + (L.agentTodoList || "Todo List") + "</span>" +
    "</div>" +
    '<div class="agent-chat__todo-items">';
    for (const line of lines) {
        if (line.startsWith("- [x]")) {
            html += '<div class="agent-chat__todo-item agent-chat__todo-item--completed"><svg class="agent-chat__todo-status"><use xlink:href="#iconCheck"></use></svg>' + escapeHtml(line.substring(5).trim()) + "</div>";
            continue;
        }
        if (line.startsWith("- [/]")) {
            html += '<div class="agent-chat__todo-item agent-chat__todo-item--in-progress"><svg class="agent-chat__todo-status"><use xlink:href="#iconRefresh"></use></svg>' + escapeHtml(line.substring(5).trim()) + "</div>";
            continue;
        }
        if (line.startsWith("- [-]")) {
            html += '<div class="agent-chat__todo-item agent-chat__todo-item--cancelled"><svg class="agent-chat__todo-status"><use xlink:href="#iconCloseRound"></use></svg>' + escapeHtml(line.substring(5).trim()) + "</div>";
            continue;
        }
        if (line.startsWith("- [ ]")) {
            html += '<div class="agent-chat__todo-item agent-chat__todo-item--pending"><svg class="agent-chat__todo-status"><use xlink:href="#iconUncheck"></use></svg>' + escapeHtml(line.substring(5).trim()) + "</div>";
        }
    }
    html += "</div></div>";
    return html;
};

export type AgentWebSearchProgress = {
    phase: string;
    done: number;
    total: number;
    current?: string;
    partialCount?: number;
    latestResults?: Array<{title: string; url: string; engine: string}>;
};

type AgentWebSearchResponse = {
    query?: string;
    provider?: string;
    results?: Array<{
        title?: string;
        url?: string;
        snippet?: string;
        engines?: string[];
    }>;
    usedEngines?: string[];
    errors?: Array<{engine?: string; message?: string}>;
    noResults?: boolean;
};

const safeWebURL = (value: string): string => {
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return "";
        }
        return parsed.href;
    } catch (e) {
        return "";
    }
};

const webSearchStatusText = (progress: AgentWebSearchProgress): string => {
    if (progress.phase === "done") {
        return "Search complete";
    }
    if (progress.phase === "start") {
        return "Starting search";
    }
    return "Searching";
};

export const renderWebSearchProgress = (query: string, progress: AgentWebSearchProgress): string => {
    const total = Math.max(0, progress.total || 0);
    const done = Math.max(0, Math.min(progress.done || 0, total || progress.done || 0));
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    const results = Array.isArray(progress.latestResults) ? progress.latestResults : [];
    let resultHTML = "";
    for (const result of results) {
        const url = safeWebURL(result.url || "");
        const title = escapeHtml(result.title || result.url || "Untitled result");
        const label = "<span class=\"agent-chat__web-search-result-title\">" + title + "</span>";
        resultHTML += '<div class="agent-chat__web-search-result">' +
            (url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noreferrer noopener">' + label + "</a>" : label) +
            (result.engine ? '<span class="agent-chat__web-search-result-engine">' + escapeHtml(result.engine) + "</span>" : "") +
            "</div>";
    }
    return '<div class="agent-chat__tool-card agent-chat__tool-card--web-search agent-chat__tool-card--web-search-progress">' +
        '<div class="agent-chat__web-search-header">' +
        '<svg class="agent-chat__tool-icon"><use xlink:href="#iconSearch"></use></svg>' +
        '<span class="agent-chat__tool-title">' + escapeHtml(webSearchStatusText(progress)) + "</span>" +
        '<span class="agent-chat__web-search-query">' + escapeHtml(query || "") + "</span>" +
        "</div>" +
        '<div class="agent-chat__web-search-progress">' +
        '<div class="agent-chat__web-search-progress-label"><span>' +
        escapeHtml(progress.current || "") + "</span><span>" + done + "/" + total + " · " +
        (progress.partialCount || 0) + " results</span></div>" +
        '<div class="agent-chat__web-search-progress-track"><div class="agent-chat__web-search-progress-bar" style="width:' + percent + '%"></div></div>' +
        "</div>" +
        (resultHTML ? '<div class="agent-chat__web-search-results">' + resultHTML + "</div>" : "") +
        "</div>";
};

const parseWebSearchResponse = (raw: string): AgentWebSearchResponse | null => {
    const wrapped = raw.match(/^\s*\[tool_output\]\s*([\s\S]*?)\s*\[\/tool_output\]\s*$/);
    const payload = wrapped ? wrapped[1] : raw;
    try {
        const parsed = JSON.parse(payload);
        return parsed && typeof parsed === "object" ? parsed as AgentWebSearchResponse : null;
    } catch (e) {
        return null;
    }
};

export const renderWebSearchResult = (query: string, raw: string): string => {
    const response = parseWebSearchResponse(raw);
    if (!response) {
        return '<div class="agent-chat__tool-card agent-chat__tool-card--web-search agent-chat__tool-card--web-search-error">' +
            '<div class="agent-chat__web-search-header"><svg class="agent-chat__tool-icon"><use xlink:href="#iconSearch"></use></svg><span class="agent-chat__tool-title">Web search</span></div>' +
            '<pre class="agent-chat__web-search-error-text">' + escapeHtml(raw || "Search returned no readable response") + "</pre></div>";
    }
    const results = Array.isArray(response.results) ? response.results : [];
    const engines = Array.isArray(response.usedEngines) ? response.usedEngines : [];
    const errors = Array.isArray(response.errors) ? response.errors : [];
    let resultHTML = "";
    for (const result of results) {
        const url = safeWebURL(result.url || "");
        const title = escapeHtml(result.title || result.url || "Untitled result");
        const snippet = escapeHtml(result.snippet || "");
        const engineNames = Array.isArray(result.engines) ? result.engines.filter(Boolean).join(", ") : "";
        resultHTML += '<article class="agent-chat__web-search-result">' +
            (url ? '<a class="agent-chat__web-search-result-title" href="' + escapeHtml(url) + '" target="_blank" rel="noreferrer noopener">' + title + "</a>" : '<span class="agent-chat__web-search-result-title">' + title + "</span>") +
            (snippet ? '<div class="agent-chat__web-search-result-snippet">' + snippet + "</div>" : "") +
            (engineNames ? '<div class="agent-chat__web-search-result-engine">' + escapeHtml(engineNames) + "</div>" : "") +
            "</article>";
    }
    let errorHTML = "";
    for (const error of errors) {
        const label = [error.engine, error.message].filter(Boolean).join(": ");
        if (label) {
            errorHTML += '<div class="agent-chat__web-search-error-item">' + escapeHtml(label) + "</div>";
        }
    }
    const countText = results.length + " result" + (results.length === 1 ? "" : "s");
    const statusText = response.noResults && results.length === 0 ? "No results" : countText;
    return '<div class="agent-chat__tool-card agent-chat__tool-card--web-search agent-chat__tool-card--web-search-complete">' +
        '<div class="agent-chat__web-search-header">' +
        '<svg class="agent-chat__tool-icon"><use xlink:href="#iconSearch"></use></svg>' +
        '<span class="agent-chat__tool-title">Web search</span>' +
        '<span class="agent-chat__web-search-query">' + escapeHtml(query || response.query || "") + "</span>" +
        "</div>" +
        '<div class="agent-chat__web-search-summary"><span>' + escapeHtml(statusText) + "</span>" +
        (response.provider ? '<span>' + escapeHtml(response.provider) + "</span>" : "") +
        (engines.length ? '<span>' + escapeHtml(engines.join(", ")) + "</span>" : "") +
        "</div>" +
        (resultHTML ? '<div class="agent-chat__web-search-results">' + resultHTML + "</div>" : "") +
        (errorHTML ? '<div class="agent-chat__web-search-errors">' + errorHTML + "</div>" : "") +
        "</div>";
};

// hasModel=false 时渲染"未配置模型"提示块替代示例，避免用户点击示例后卡死。
export const renderWelcomeHTML = (hasModel = true): string => {
    const L = window.siyuan.languages ?? {};
    if (!hasModel) {
        return '<div class="agent-welcome">' +
            '<div class="agent-welcome__greeting">' + (L.agentWelcomeGreeting || "Hello, I am SiYuan Agent") + "</div>" +
            '<div class="agent-welcome__no-model">' +
                '<div class="agent-welcome__no-model-title">' + (L.agentNoModel || "No model configured") + "</div>" +
                '<div class="agent-welcome__no-model-tip">' + (L.agentNoModelTip || "Please configure a provider and model in Settings - AI first.") + "</div>" +
                '<button class="b3-button agent-welcome__go-setting" data-type="go-ai-setting">' + (L.agentGoToSetting || "Go to Settings") + "</button>" +
            "</div>" +
        "</div>";
    }
    return '<div class="agent-welcome">' +
        '<div class="agent-welcome__greeting">' + (L.agentWelcomeGreeting || "Hello, I am SiYuan Agent") + "</div>" +
        '<div class="agent-welcome__examples">' +
            '<div class="agent-welcome__example" data-text="' + escapeHtml(L.agentExample1 || "") + '">' + (L.agentExample1 || "") + "</div>" +
            '<div class="agent-welcome__example" data-text="' + escapeHtml(L.agentExample2 || "") + '">' + (L.agentExample2 || "") + "</div>" +
            '<div class="agent-welcome__example" data-text="' + escapeHtml(L.agentExample3 || "") + '">' + (L.agentExample3 || "") + "</div>" +
        "</div>" +
    "</div>";
};

export const renderQuestionCardHTML = (rawQuestions: Array<Record<string, unknown>>, questionID: string): string => {
    const L = window.siyuan.languages ?? {};
    let html = '<div class="agent-chat__question-card">';
    if (!rawQuestions || !rawQuestions.length) {
        return html + "</div>";
    }
    for (const [qi, q] of rawQuestions.entries()) {
        const header = String(q.header ?? "");
        const question = String(q.question ?? "");
        const options = Array.isArray(q.options) ? q.options : [];
        const multiple = Boolean(q.multiple);
        const custom = q.custom !== false;

        html += '<div class="agent-chat__question-item">';
        if (header) {
            html += '<div class="agent-chat__question-header">' + escapeHtml(header) + "</div>";
        }
        if (question) {
            html += '<div class="agent-chat__question-text">' + escapeHtml(question) + "</div>";
        }
        html += '<div class="agent-chat__question-options" data-qi="' + qi + '">';
        const inputType = multiple ? "checkbox" : "radio";
        const inputName = "q_" + questionID + "_" + qi;
        for (const opt of options) {
            const label = String(opt.label ?? "");
            const desc = String(opt.description ?? "");
            html += '<label class="agent-chat__question-option">' +
                '<input type="' + inputType + '" name="' + inputName + '" value="' + escapeHtml(label) + '">' +
                '<span class="agent-chat__question-option-label">' + escapeHtml(label) + "</span>";
            if (desc) {
                html += '<span class="agent-chat__question-option-desc">' + escapeHtml(desc) + "</span>";
            }
            html += "</label>";
        }
        if (custom) {
            html += '<input class="agent-chat__question-custom" placeholder="' + (L.agentQuestionCustom || "Type your own answer...") + '" data-qi="' + qi + '">';
        }
        html += "</div></div>";
    }
    html += '<div class="agent-chat__question-submit">' +
        '<button class="b3-button b3-button--text agent-chat__question-submit-btn">' +
        (L.agentQuestionSubmit || "Submit") + "</button>" +
    "</div></div>";
    return html;
};

export const renderRetryCardHTML = (attempt: number, maxRetries: number): string => {
    return '<div class="agent-chat__thinking-card">' +
    '<div class="agent-chat__thinking-header">' +
        '<span class="agent-chat__thinking-text">' + escapeHtml("Retrying (" + attempt + "/" + maxRetries + ")...") + "</span>" +
    "</div>" +
"</div>";
};

export const renderToolsLineHTML = (newTools: Array<{name: string}>): string => {
    let detailLines = "<div class=\"agent-chat__thinking-tools-line\"><span class=\"agent-chat__thinking-summary\">Tool calls:</span>";
    for (const tool of newTools) {
        detailLines += '<span class="agent-chat__thinking-tool">' + escapeHtml(tool.name) + "</span>";
    }
    detailLines += "</div>";
    return detailLines;
};

// createThinkingCardElement 用于流式过程中的单个思考卡片。
// 工具调用只接收名字列表（arguments/result 在 assistant entry 存一份）；
// 标题文本由调用方传入（已通过 i18n 从 duration 生成）。
export const createThinkingCardElement = (step: {reasoning: string; text: string; toolNames?: string[]; reasoningContent: string}): HTMLElement => {
    let detail = "";
    if (step.toolNames && step.toolNames.length > 0) {
        detail += '<div class="agent-chat__thinking-tools-line"><span class="agent-chat__thinking-summary">Tool calls:</span>';
        for (const name of step.toolNames) {
            detail += '<span class="agent-chat__thinking-tool">' + escapeHtml(name) + "</span>";
        }
        detail += "</div>";
    }
    if (step.reasoningContent) {
        detail += "<div>" + escapeHtml(step.reasoningContent) + "</div>";
    }

    const el = document.createElement("div");
    el.className = "agent-chat__msg agent-chat__msg--thinking agent-chat__msg--thinking-done";
    el.innerHTML = '<div class="agent-chat__thinking-card">' +
    '<div class="agent-chat__thinking-header">' +
        '<span class="agent-chat__thinking-arrow">' +
            '<svg class="agent-chat__thinking-arrow--expand"><use xlink:href="#iconExpand"></use></svg>' +
            '<svg class="agent-chat__thinking-arrow--contract fn__none"><use xlink:href="#iconContract"></use></svg>' +
        "</span>" +
        '<span class="agent-chat__thinking-text">' + escapeHtml(step.text) + "</span>" +
    "</div>" +
    '<div class="agent-chat__thinking-body">' +
        detail +
    "</div>" +
"</div>";
    return el;
};

export const bindThinkingCardToggle = (el: HTMLElement): void => {
    const header = el.querySelector<HTMLElement>(".agent-chat__thinking-header");
    const body = el.querySelector<HTMLElement>(".agent-chat__thinking-body");
    const expandIcon = el.querySelector<HTMLElement>(".agent-chat__thinking-arrow--expand");
    const contractIcon = el.querySelector<HTMLElement>(".agent-chat__thinking-arrow--contract");
    if (!header || !body || !expandIcon || !contractIcon) {
        return;
    }
    header.addEventListener("click", () => {
        el.setAttribute("data-user-interacted", "true");
        const isExpanded = body.classList.contains("agent-chat__thinking-body--expanded");
        const isDone = el.classList.contains("agent-chat__msg--thinking-done");
        if (isDone && isExpanded) {
            body.classList.remove("agent-chat__thinking-body--expanded");
            expandIcon.classList.remove("fn__none");
            contractIcon.classList.add("fn__none");
            return;
        }
        if (isDone) {
            body.classList.remove("agent-chat__thinking-body--preview");
            body.classList.add("agent-chat__thinking-body--expanded");
            expandIcon.classList.add("fn__none");
            contractIcon.classList.remove("fn__none");
            return;
        }
        const isPreview = body.classList.contains("agent-chat__thinking-body--preview");
        if (isExpanded) {
            body.classList.remove("agent-chat__thinking-body--expanded");
            expandIcon.classList.remove("fn__none");
            contractIcon.classList.add("fn__none");
            return;
        }
        if (isPreview) {
            body.classList.remove("agent-chat__thinking-body--preview");
            body.classList.add("agent-chat__thinking-body--expanded");
            expandIcon.classList.add("fn__none");
            contractIcon.classList.remove("fn__none");
            return;
        }
        body.classList.add("agent-chat__thinking-body--preview");
    });
};

// 为容器内所有代码块（pre）和公式块（div[data-subtype=math]）注入复制按钮。
export const addCopyButtons = (container: HTMLElement): void => {
    const targets: Array<{ selector: string; getText: (el: HTMLElement) => string }> = [
        {selector: "pre", getText: (el) => (el.querySelector("code")?.textContent || "").trimEnd().replace(/\n$/, "")},
        {selector: '[data-subtype="math"]', getText: (el) => el.getAttribute("data-content") || ""}
    ];
    for (const {selector, getText} of targets) {
        for (const block of container.querySelectorAll<HTMLElement>(selector)) {
            if (block.querySelector(".protyle-icon")) {
                continue;
            }
            const wrap = document.createElement("div");
            wrap.className = "protyle-icons";
            wrap.appendChild(createCopyButton(() => getText(block)));
            block.appendChild(wrap);
        }
    }
};

// 构建单个复制按钮，getText 返回要复制的文本。
const createCopyButton = (getText: () => string): HTMLElement => {
    const L = window.siyuan.languages ?? {};
    const btn = document.createElement("span");
    btn.className = "protyle-icon protyle-icon--only ariaLabel";
    btn.innerHTML = '<svg><use xlink:href="#iconCopy"></use></svg>';
    btn.setAttribute("aria-label", L.copy);
    btn.setAttribute("data-position", "4north");
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = getText();
        navigator.clipboard.writeText(text).then(() => {
            showMessage(L.copied, 2000);
        }).catch(() => {
            showMessage(L.copied, 2000);
        });
    });
    return btn;
};

const normalizeMathElements = (container: HTMLElement): void => {
    for (const el of container.querySelectorAll(".language-math")) {
        if (el.hasAttribute("data-subtype")) {
            continue;
        }
        const content = el.textContent || "";
        const preParent = el.closest("pre");
        if (preParent) {
            const div = document.createElement("div");
            div.appendChild(document.createElement("span"));
            div.setAttribute("data-subtype", "math");
            div.setAttribute("data-content", content);
            preParent.replaceWith(div);
            continue;
        }
        el.setAttribute("data-subtype", "math");
        el.setAttribute("data-content", content);
        if (el.tagName === "DIV" && !el.firstElementChild) {
            el.textContent = "";
            el.appendChild(document.createElement("span"));
        }
    }
};

const labelCodeLanguages = (container: HTMLElement): void => {
    for (const code of container.querySelectorAll("pre > code[class*='language-']")) {
        const match = code.className.match(/language-(\S+)/);
        if (match) {
            code.parentElement?.setAttribute("data-language", match[1] ?? "");
        }
    }
};

export const postRender = (container: HTMLElement, app?: App): void => {
    normalizeMathElements(container);
    labelCodeLanguages(container);
    // Agent 内容由 ProtylePreview 生成，结构与官方 preview 一致，复用 highlightRender 渲染高亮。
    // 容器自身可能是 b3-typography（流式更新），也可能外层包裹含 b3-typography 的后代，两种情况都需覆盖。
    const typographyElements = container.classList.contains("b3-typography")
        ? [container]
        : Array.from(container.querySelectorAll<HTMLElement>(".b3-typography"));
    for (const item of typographyElements) {
        highlightRender(item);
    }
    mathRender(container);
    mermaidRender(container);
    flowchartRender(container);
    graphvizRender(container);
    chartRender(container);
    mindmapRender(container);
    abcRender(container);
    plantumlRender(container);
    htmlRender(container);
    addCopyButtons(container);
    if (!app) {
        return;
    }
    // MarkdownStr 渲染出的 siyuan:// 块链接只是普通 <a href>，需补全 data-type/data-href
    // 才能接入全局 popover 浮窗系统；dock 内无 protyle 点击链路，需自行绑定点击打开块。
    for (const a of container.querySelectorAll<HTMLAnchorElement>('a[href^="siyuan://"]')) {
        const href = a.getAttribute("href") || "";
        a.setAttribute("data-type", "a");
        a.setAttribute("data-href", href);
        a.addEventListener("click", (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            void processSiYuanUri(app, href);
        });
    }
};
