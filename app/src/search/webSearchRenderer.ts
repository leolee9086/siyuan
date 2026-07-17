import {escapeAttr, escapeHtml} from "../util/DOM/escape";
import type {HumanWebSearchResponse, HumanWebSearchResult} from "./webSearch.types";

/** Reject unsafe result links before they reach an anchor element. */
export const safeURL = (value: string) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
    } catch {
        return "";
    }
};

/** Turn engine markup and whitespace into a compact human-readable snippet. */
export const cleanSnippet = (value: string) => value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/** Extract a stable host label for the result metadata row. */
const hostOf = (value: string) => {
    try {
        return new URL(value).hostname.replace(/^www\./, "");
    } catch {
        return "";
    }
};

/** Format optional publication time without making missing dates look like current dates. */
const formatDate = (value?: number) => {
    if (!value) {
        return "";
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
};

/** Render one result in the same scan order as mainstream search result lists. */
const renderResult = (result: HumanWebSearchResult, index: number) => {
    const url = safeURL(result.url || "");
    const title = escapeHtml(result.title || result.url || "Untitled result");
    const snippet = escapeHtml(cleanSnippet(result.snippet || ""));
    const host = escapeHtml(hostOf(url));
    const date = escapeHtml(formatDate(result.publishedDate));
    const engines = escapeHtml((result.engines || []).join(" · "));
    const metadata = [host, date, engines].filter(Boolean).join(" · ");
    const link = url
        ? '<a class="search__web-result-title" href="' + escapeAttr(url) + '" target="_blank" rel="noreferrer noopener">' + title + "</a>"
        : '<span class="search__web-result-title">' + title + "</span>";
    const current = '<button class="b3-button b3-button--icon b3-button--text search__web-result-action" data-web-add="current" data-web-index="' + index + '" aria-label="Add to current document" title="Add to current document"><svg><use xlink:href="#iconAdd"></use></svg></button>';
    const daily = '<button class="b3-button b3-button--icon b3-button--text search__web-result-action" data-web-add="daily" data-web-index="' + index + '" aria-label="Add to today note" title="Add to today note"><svg><use xlink:href="#iconCalendar"></use></svg></button>';
    return '<article class="search__web-result" data-web-result-index="' + index + '">' +
        '<div class="search__web-result-main">' + link +
        (metadata ? '<div class="search__web-result-meta">' + metadata + "</div>" : "") +
        (snippet ? '<div class="search__web-result-snippet">' + snippet + "</div>" : "") +
        '</div><div class="search__web-result-actions">' + current + daily + "</div></article>";
};

/** Render the complete response, including non-fatal per-engine errors. */
export const renderResponse = (response: HumanWebSearchResponse) => {
    const results = response.results || [];
    let html = results.map((result, index) => renderResult(result, index)).join("");
    // A successful request can legitimately return no rows, so keep the empty state visible.
    if (results.length === 0) {
        html = '<div class="search__web-empty">No results found.</div>';
    }
    // Per-engine failures are non-fatal when another engine returned usable results.
    if (response.errors && response.errors.length > 0) {
        html += '<div class="search__web-errors">' + response.errors.map(error =>
            `<div>${escapeHtml(error.engine + ": " + error.message)}</div>`).join("") + "</div>";
    }
    return html;
};

/** Convert a result into portable Markdown for the existing block insertion APIs. */
export const markdownForResult = (result: HumanWebSearchResult) => {
    const title = (result.title || result.url || "Untitled result").replace(/[\r\n]+/g, " ").trim();
    const url = safeURL(result.url || "");
    const snippet = cleanSnippet(result.snippet || "");
    const source = (result.engines || []).join(", ");
    const lines = ["### " + title];
    if (url) {
        lines.push("[" + title.replace(/[\[\]]/g, "") + "](" + url + ")");
    }
    if (snippet) {
        lines.push("", snippet);
    }
    if (source) {
        lines.push("", "> Source: " + source);
    }
    return lines.join("\n");
};
