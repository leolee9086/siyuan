import {getAllEditor} from "../layout/getAll";
import {showMessage} from "../dialog/message";
import {fetchSyncPost} from "../util/fetch";
import type {ProtyleDomain} from "../protyle/protyle.types";
import {inputEvent} from "./inputEvent";
import {
    markdownForResult,
    renderResponse,
} from "./webSearchRenderer";
import type {HumanWebSearchResult, SearchEnvelope, WebSearchElements, WebSearchState} from "./webSearch.types";

/** Select a visible document editor while excluding the search preview editor itself. */
const visibleDocumentEditor = () => {
    for (const editor of getAllEditor()) {
        const protyle = editor.protyle;
        const element = protyle?.element;
        if (!element || element.classList.contains("fn__none") || element.closest(".search__preview")) {
            continue;
        }
        if (element.closest(".layout__center") && protyle.block?.rootID) {
            return protyle;
        }
    }
    return undefined;
};

/** Append Markdown to the root block of the currently visible document. */
const appendCurrentDocument = (protyle: IProtyle, data: string) => fetchSyncPost("/api/block/appendBlock", {
    dataType: "markdown", data, parentID: protyle.block.rootID,
});

/** Append Markdown to the current notebook's daily note when that target exists. */
const appendDailyNote = async (protyle: IProtyle, data: string) => {
    if (!protyle.notebookId) {
        await showMessage("The current document has no notebook.", 4000, "error");
        return undefined;
    }
    return fetchSyncPost("/api/block/appendDailyNoteBlock", {
        dataType: "markdown", data, notebook: protyle.notebookId,
    });
};

/** Persist a selected result and report the exact target to the user. */
const addResultToNote = async (result: HumanWebSearchResult, target: "current" | "daily") => {
    const protyle = visibleDocumentEditor();
    if (!protyle) {
        await showMessage("Open a document before adding a search result.", 4000, "error");
        return false;
    }
    const data = markdownForResult(result);
    const response = target === "daily" ? await appendDailyNote(protyle, data) : await appendCurrentDocument(protyle, data);
    if (!response || response.code !== 0) {
        await showMessage(response?.msg || "Failed to add search result to note.", 5000, "error");
        return false;
    }
    await showMessage(target === "daily" ? "Added to today's note." : "Added to the current document.", 3000);
    return true;
};

/** Resolve a required web-search control with a typed selector. */
const requiredWebSearchElement = <T extends Element>(root: HTMLElement, selector: string) => {
    const result = root.querySelector<T>(selector);
    if (!result) {
        throw new Error("Web search control not found: " + selector);
    }
    return result;
};

/** Resolve the DOM controls used by the network source without coupling to local search internals. */
const getWebSearchElements = (root: HTMLElement) => ({
    root,
    sourceLocal: requiredWebSearchElement<HTMLElement>(root, "#searchSourceLocal"),
    sourceWeb: requiredWebSearchElement<HTMLElement>(root, "#searchSourceWeb"),
    webPanel: requiredWebSearchElement<HTMLElement>(root, "#searchWebPanel"),
    status: requiredWebSearchElement<HTMLElement>(root, "#searchWebStatus"),
    results: requiredWebSearchElement<HTMLElement>(root, "#searchWebResults"),
    input: requiredWebSearchElement<HTMLInputElement>(root, "#searchInput"),
    runButton: requiredWebSearchElement<HTMLButtonElement>(root, "#searchWebRun"),
    provider: requiredWebSearchElement<HTMLSelectElement>(root, "#searchWebProvider"),
    queryType: requiredWebSearchElement<HTMLSelectElement>(root, "#searchWebType"),
    timeRange: requiredWebSearchElement<HTMLSelectElement>(root, "#searchWebTimeRange"),
    localOnly: root.querySelectorAll(".search__local-toolbar, .search__local-only"),
});

/** Switch the source view and restore local search state when the user switches back. */
const setWebSearchMode = (state: WebSearchState<ProtyleDomain>, next: boolean) => {
    const elements = state.elements;
    state.webMode = next;
    elements.root.dataset.searchSource = next ? "web" : "local";
    elements.sourceLocal.classList.toggle("search__source-tab--active", !next);
    elements.sourceWeb.classList.toggle("search__source-tab--active", next);
    elements.sourceLocal.setAttribute("aria-selected", String(!next));
    elements.sourceWeb.setAttribute("aria-selected", String(next));
    for (const item of elements.localOnly) {
        item.classList.toggle("fn__none", next);
    }
    elements.webPanel.classList.toggle("fn__none", !next);
    elements.input.placeholder = next ? "Search the web" : window.siyuan.languages.showRecentUpdatedBlocks;
    if (next && elements.input.value.trim()) {
        void state.runSearch();
        return;
    }
    if (!next) {
        inputEvent(elements.root, state.config, state.edit);
    }
};

/** Execute one real network request and render structured results or diagnostics. */
const requestWebSearch = async (state: WebSearchState<ProtyleDomain>) => {
    const elements = state.elements;
    const query = elements.input.value.trim();
    if (!query || !state.webMode) {
        return;
    }
    const serial = ++state.runSerial;
    elements.status.textContent = "Searching...";
    elements.results.innerHTML = "";
    state.currentResults = [];
    elements.runButton.disabled = true;
    try {
        const response = await fetch("/api/search/webSearch", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({query, numResults: 10, provider: elements.provider.value,
                queryType: elements.queryType.value, timeRange: elements.timeRange.value, searchType: "auto"}),
        });
        const envelope: SearchEnvelope = await response.json();
        if (serial !== state.runSerial) {
            return;
        }
        // HTTP failures and malformed success envelopes must remain visible instead of rendering a blank panel.
        if (!response.ok || envelope.code !== 0 || !envelope.data) {
            elements.status.textContent = envelope.msg || "Web search failed.";
            return;
        }
        const result = envelope.data;
        state.currentResults = result.results || [];
        elements.status.textContent = (result.results || []).length + " results · " + (result.provider || "web") +
            (result.usedEngines && result.usedEngines.length ? " · " + result.usedEngines.length + " engines" : "");
        elements.results.innerHTML = renderResponse(result);
    } catch (error) {
        // A newer request owns the panel, so an older request must not overwrite its status.
        if (serial === state.runSerial) {
            elements.status.textContent = error instanceof Error ? error.message : "Web search failed.";
        }
    } finally {
        // Only the current request may re-enable the search button.
        if (serial === state.runSerial) {
            elements.runButton.disabled = false;
        }
    }
};

/** Bind result actions so each search item can be inserted without leaving the search view. */
const bindWebSearchResultActions = (state: WebSearchState<ProtyleDomain>) => {
    state.elements.webPanel.addEventListener("click", (event: MouseEvent) => {
        if (!(event.target instanceof HTMLElement)) {
            return;
        }
        const target = event.target.closest<HTMLButtonElement>("[data-web-add]");
        if (!target) {
            return;
        }
        const result = state.currentResults[Number(target.dataset.webIndex)];
        if (!result) {
            return;
        }
        const targetKind = target.dataset.webAdd;
        if (targetKind !== "current" && targetKind !== "daily") {
            return;
        }
        target.disabled = true;
        void addResultToNote(result, targetKind).then(success => {
            if (success) {
                target.innerHTML = '<svg><use xlink:href="#iconCheck"></use></svg>';
                return;
            }
            target.disabled = false;
        });
    });
};

/** Bind source switching, debounce typing, explicit submit, and keyboard submit. */
const bindWebSearchInputs = (state: WebSearchState<ProtyleDomain>, setMode: (next: boolean) => void) => {
    const elements = state.elements;
    elements.sourceLocal.addEventListener("click", () => setMode(false));
    elements.sourceWeb.addEventListener("click", () => setMode(true));
    elements.runButton.addEventListener("click", () => void state.runSearch());
    elements.input.addEventListener("input", () => {
        if (!state.webMode) {
            return;
        }
        window.clearTimeout(state.timer);
        // This is input debouncing: 350 ms is long enough to avoid a request per keystroke while preserving interactive search.
        state.timer = window.setTimeout(() => void state.runSearch(), 350);
    });
    elements.input.addEventListener("keydown", (event: KeyboardEvent) => {
        if (!state.webMode || event.key !== "Enter") {
            return;
        }
        event.preventDefault();
        window.clearTimeout(state.timer);
        void state.runSearch();
    });
};

/** Initialize the human-facing web source in the existing global search dialog. */
export const initWebSearch = (element: HTMLElement, config: Config.IUILayoutTabSearchConfig, edit: ProtyleDomain) => {
    let state: WebSearchState<ProtyleDomain>;
    /** Run the current web request after state and DOM handlers have been initialized. */
    const runSearch = () => requestWebSearch(state);
    state = {
        elements: getWebSearchElements(element), config, edit, webMode: false,
        runSerial: 0, timer: 0, currentResults: [], runSearch,
    };
    /** Switch the visible source while keeping local and network search state independent. */
    const setMode = (next: boolean) => setWebSearchMode(state, next);
    bindWebSearchInputs(state, setMode);
    bindWebSearchResultActions(state);
    return {setMode, runSearch: state.runSearch};
};
