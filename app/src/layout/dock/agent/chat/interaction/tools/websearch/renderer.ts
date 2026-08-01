/** 用途：网页搜索工具卡片 HTML 渲染。使用范围：原生 Agent 运行中和完成态。解耦评估：只接收结构化数据，不依赖会话状态。 */
import {escapeHtml} from "./imports";
/** 用途：搜索进度类型。使用范围：原生 Agent 的运行中进度卡片。解耦评估：纯类型依赖，无运行时耦合。 */
import type {AgentWebSearchProgress} from "./types";
/** 用途：验证不可信工具载荷。使用范围：JSON 解析边界。解耦评估：类型守卫取代渲染模块内的断言。 */
import {isAgentWebSearchResponse} from "./renderer.guard";

/**
 * Normalize source URLs once before adding them to the exact URL index.
 * @同步豁免: 性能考虑 - 每个搜索结果和正文链接都在同步渲染路径中校验，返回值不涉及异步资源。
 */
export const normalizeWebURL = (value: string) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
    } catch {
        return "";
    }
};

/** Normalize trusted targets exactly as browser URL parsing normalizes anchors. */
const normalizeVerifiedURLs = (urls: Set<string>) => {
    const normalized = new Set<string>();
    for (const url of urls) {
        const safeURL = normalizeWebURL(url);
        if (safeURL) {
            normalized.add(safeURL);
        }
    }
    return normalized;
};

/** Resolve an opaque search reference only through the map returned by web_search. */
const resolveWebURL = (value: string, linkMap: Record<string, string> | undefined) => {
    if (!value.startsWith("ref:")) {
        return value;
    }
    return linkMap?.[value] || "";
};

/** Convert a backend phase into a compact running-card heading. */
const webSearchStatusText = (progress: AgentWebSearchProgress) => {
    if (progress.phase === "done") {
        return "Search complete";
    }
    if (progress.phase === "start") {
        return "Starting search";
    }
    return "Searching";
};

/** Render the recent result rows shown while one or more engines are running. */
const renderPreviewRows = (results: Array<{title: string; url: string; engine: string}>) => {
    let html = "";
    for (const result of results) {
        const url = normalizeWebURL(result.url || "");
        const title = escapeHtml(result.title || result.url || "Untitled result");
        const label = "<span class=\"agent-chat__web-search-result-title\">" + title + "</span>";
        html += '<div class="agent-chat__web-search-result">' +
            (url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noreferrer noopener">' + label + "</a>" : label) +
            (result.engine ? '<span class="agent-chat__web-search-result-engine">' + escapeHtml(result.engine) + "</span>" : "") +
            "</div>";
    }
    return html;
};

/**
 * Render the live progress card for a native Agent web_search call.
 * @同步豁免: UI构建
 * AgentChat replaces this HTML synchronously for each ordered SSE progress event.
 */
export const renderWebSearchProgress = (query: string, progress: AgentWebSearchProgress) => {
    const total = Math.max(0, progress.total || 0);
    const done = Math.max(0, Math.min(progress.done || 0, total || progress.done || 0));
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    const rows = renderPreviewRows(Array.isArray(progress.latestResults) ? progress.latestResults : []);
    return '<div class="agent-chat__tool-card agent-chat__tool-card--web-search agent-chat__tool-card--web-search-progress">' +
        '<div class="agent-chat__web-search-header">' +
        '<svg class="agent-chat__tool-icon"><use xlink:href="#iconSearch"></use></svg>' +
        '<span class="agent-chat__tool-title">' + escapeHtml(webSearchStatusText(progress)) + "</span>" +
        '<span class="agent-chat__web-search-query">' + escapeHtml(query || "") + "</span>" +
        "</div>" +
        '<div class="agent-chat__web-search-progress">' +
        '<div class="agent-chat__web-search-progress-label"><span>' + escapeHtml(progress.current || "") +
        "</span><span>" + done + "/" + total + " · " + (progress.partialCount || 0) + " results</span></div>" +
        '<div class="agent-chat__web-search-progress-track"><div class="agent-chat__web-search-progress-bar" style="width:' + percent + '%"></div></div>' +
        "</div>" +
        (rows ? '<div class="agent-chat__web-search-results">' + rows + "</div>" : "") +
        "</div>";
};

/** Parse the native Agent tool output envelope without trusting its contents. */
const parseWebSearchResponse = (raw: string) => {
    const wrapped = raw.match(/^\s*\[tool_output\]\s*([\s\S]*?)\s*\[\/tool_output\]\s*$/);
    const payload = wrapped?.[1] ?? raw;
    try {
        const parsed: unknown = JSON.parse(payload);
        return isAgentWebSearchResponse(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

/**
 * Render completed results and retain per-engine errors instead of hiding partial failures.
 * @同步豁免: UI构建
 * AgentChat inserts the completed card synchronously in the closing SSE event.
 */
export const renderWebSearchResult = (query: string, raw: string) => {
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
        const url = normalizeWebURL(resolveWebURL(result.url || "", response.linkMap));
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
    const statusText = response.noResults && results.length === 0
        ? "No results"
        : results.length + " result" + (results.length === 1 ? "" : "s");
    return '<div class="agent-chat__tool-card agent-chat__tool-card--web-search agent-chat__tool-card--web-search-complete">' +
        '<div class="agent-chat__web-search-header">' +
        '<svg class="agent-chat__tool-icon"><use xlink:href="#iconSearch"></use></svg>' +
        '<span class="agent-chat__tool-title">Web search</span>' +
        '<span class="agent-chat__web-search-query">' + escapeHtml(query || response.query || "") + "</span>" +
        "</div>" +
        '<div class="agent-chat__web-search-summary"><span>' + escapeHtml(statusText) + "</span>" +
        (response.provider ? "<span>" + escapeHtml(response.provider) + "</span>" : "") +
        (engines.length ? "<span>" + escapeHtml(engines.join(", ")) + "</span>" : "") +
        "</div>" +
        (resultHTML ? '<div class="agent-chat__web-search-results">' + resultHTML + "</div>" : "") +
        (errorHTML ? '<div class="agent-chat__web-search-errors">' + errorHTML + "</div>" : "") +
        "</div>";
};

/**
 * Extract the UI-only source map from a completed native Agent search result.
 * @同步豁免: 生命周期
 * tool_result 到达后必须在下一条 assistant 内容渲染前同步登记映射。
 */
export const collectWebSearchReferences = (raw: string) => {
    const response = parseWebSearchResponse(raw);
    return response?.linkMap || {};
};

/**
 * Replace only mapped ref tokens before Markdown turns them into anchors.
 * @同步豁免: UI构建
 * Markdown 解析前必须同步完成引用替换，异步化会产生短暂的错误链接。
 */
export const resolveMappedWebReferences = (
    content: string,
    linkMap: Record<string, string>,
) => {
    const tokens = content.match(/ref:web-[0-9a-f]+/g);
    if (!tokens) {
        return content;
    }
    let resolvedContent = content;
    for (const token of tokens) {
        const target = normalizeWebURL(linkMap[token] || "");
        if (target) {
            resolvedContent = resolvedContent.split(token).join(encodeURI(target));
        }
    }
    return resolvedContent;
};

/** Handle an unverified anchor click without allowing browser navigation. */
const handleUnverifiedLinkClick = (event: MouseEvent, safeURL: string, onUnverified: (url: string) => void) => {
    event.preventDefault();
    event.stopPropagation();
    if (safeURL) {
        onUnverified(safeURL);
    }
};

/**
 * Remove unverified external anchors so model-invented sources cannot navigate silently.
 * @同步豁免: UI构建
 * DOM 事件绑定必须在同一次渲染中完成，避免链接在保护前可点击。
 */
export const protectUnverifiedWebLinks = (
    container: HTMLElement,
    verifiedURLs: Set<string>,
    onUnverified: (url: string) => void,
) => {
    const normalizedVerifiedURLs = normalizeVerifiedURLs(verifiedURLs);
    for (const anchor of container.querySelectorAll<HTMLAnchorElement>("a")) {
        const href = anchor.getAttribute("href") || "";
        const safeURL = normalizeWebURL(href);
        if (safeURL && normalizedVerifiedURLs.has(safeURL)) {
            continue;
        }
        if (!safeURL && !href.startsWith("ref:")) {
            continue;
        }
        anchor.removeAttribute("href");
        anchor.setAttribute("data-unverified-href", href);
        anchor.title = "This link was not returned by web search";
        anchor.addEventListener("click", (event) => handleUnverifiedLinkClick(event, safeURL, onUnverified));
    }
};
