/**
 * 搜索输入事件处理
 * 从 util.ts 拆分出来，便于维护
 */

import { Constants } from "../constants";
import { fetchPost } from "../util/network/fetch";
import { Protyle } from "../protyle";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { 语义搜索, 获取语义搜索配置 } from "../layout/dock/embeddingDock/semanticSearch.api";
import type { ISemanticSearchResult } from "../layout/dock/embeddingDock/embeddingDock.types";
import { onSearch } from "./utils/onSearch";

/**
 * 用途：描述本地块搜索接口的可选响应字段。
 * 使用范围：用于全文、语义和本地 Embedding 兜底搜索的统一渲染。
 * 关联类型：字段对应内核搜索响应和 IBlock 列表，均保持可选以兼容旧响应。
 */
type SearchResponseData = {
    blocks?: IBlock[];
    pageCount?: number;
    matchedBlockCount?: number;
    matchedRootCount?: number;
    docMode?: boolean;
};

/** 当前搜索预览中需要保持的块焦点标识。 */
type SearchFocusId = {currentId?: string; newId?: string};

/** 运行本地语义搜索所需的 UI 和搜索配置。 */
type LocalSemanticSearchContext = {
    query: string;
    edit: Protyle;
    element: Element;
    config: Config.IUILayoutTabSearchConfig;
    focusId?: SearchFocusId;
};

/** 语义搜索无内核结果时的异步兜底渲染上下文。 */
type SemanticFallbackContext = {
    element: Element;
    edit: Protyle;
    config: Config.IUILayoutTabSearchConfig;
    focusId: SearchFocusId | undefined;
    pageCount: number;
};

/** 块搜索回调需要的渲染上下文，避免在请求函数中传递过多独立参数。 */
type BlockSearchContext = {
    element: Element;
    edit: Protyle;
    config: Config.IUILayoutTabSearchConfig;
    focusId: SearchFocusId | undefined;
};

/** 输入事件延迟执行所需的搜索状态。 */
type ExecuteSearchContext = {
    element: Element;
    config: Config.IUILayoutTabSearchConfig;
    edit: Protyle;
    rmCurrentCriteria: boolean;
    focusId?: SearchFocusId;
};

/** Resolve a search control and fail early if the generated search template is incomplete. */
const requiredSearchElement = <T extends Element>(element: Element, selector: string) => {
    const result = element.querySelector<T>(selector);
    if (!result) {
        throw new Error("Search control not found: " + selector);
    }
    return result;
};

/** Convert Embedding Dock rows into the block shape expected by the existing result renderer. */
const semanticSearchResultsToBlocks = (results: ISemanticSearchResult[]) => {
    return results.map(r => {
        let ialObj = {};
        if (r.ial) {
            try {
                ialObj = JSON.parse(r.ial);
            } catch {
                // ignore invalid ial from custom embedding datasets
            }
        }
        const block: IBlock = {
            id: r.blockId,
            content: r.content || "",
            hPath: r.hpath || "",
            type: r.type || "p",
            box: r.box || "",
            rootID: r.rootID || r.blockId,
            name: r.name || "",
            alias: r.alias || "",
            memo: r.memo || "",
            tag: r.tag || "",
            ial: ialObj,
            refCount: Math.round(r.score * 100),
        };
        return block;
    });
};

/** Run Embedding Dock search only when the kernel semantic endpoint has no usable rows. */
const runLocalSemanticSearch = async (context: LocalSemanticSearchContext) => {
    const results = await 语义搜索(context.query, 获取语义搜索配置());
    onSearch(semanticSearchResultsToBlocks(results), context.edit, context.element, context.config, context.focusId);
    return results.length;
};

/** Compare request timestamps so an older local-search response cannot overwrite a newer one. */
const searchIsStale = (key: string, requestKey: string) => {
    const requestID = window.siyuan.reqIds[requestKey];
    const newerRequestID = window.siyuan.reqIds[key];
    return !!(newerRequestID && requestID && newerRequestID > requestID);
};

/** Notify plugins after a local search starts, preserving the existing extension hook. */
const emitSearchInput = (edit: Protyle, config: Config.IUILayoutTabSearchConfig, input: HTMLInputElement) => {
    for (const item of edit.protyle?.app.plugins || []) {
        item.eventBus.emit("input-search", {protyle: edit, config, searchElement: input});
    }
};

/** Render recent blocks when the local search query is empty. */
const finishRecentSearch = (element: Element, edit: Protyle, config: Config.IUILayoutTabSearchConfig) => {
    fetchPost("/api/block/getRecentUpdatedBlocks", {}, (response) => {
        // Ignore a response that started before a newer block-search request.
        if (searchIsStale("/api/search/fullTextSearchBlock", "/api/block/getRecentUpdatedBlocks")) {
            return;
        }
        onSearch(response.data, edit, element, config);
        const loading = requiredSearchElement<HTMLElement>(element, ".fn__loading");
        const result = requiredSearchElement<HTMLElement>(element, "#searchResult");
        loading.classList.add("fn__none");
        result.innerHTML = "";
        element.querySelector('[data-type="previous"]')?.setAttribute("disabled", "true");
        element.querySelector('[data-type="next"]')?.setAttribute("disabled", "true");
    });
};

/**
 * Run the local semantic fallback and update the existing pagination/status controls.
 * This is called only after the kernel semantic endpoint returns no rows.
 */
const finishSemanticFallback = async (context: SemanticFallbackContext) => {
    const {element, edit, config, focusId, pageCount} = context;
    const loading = requiredSearchElement<HTMLElement>(element, ".fn__loading");
    const result = requiredSearchElement<HTMLElement>(element, "#searchResult");
    try {
        const localCount = await runLocalSemanticSearch({query: config.query, edit, element, config, focusId});
        loading.classList.add("fn__none");
        result.innerHTML = `${config.page}/${localCount > 0 ? 1 : pageCount}<span class="fn__space"></span><span class="ft__on-surface">${siyuanI18n.findInDoc.replace("${x}", localCount.toString()).replace("${y}", localCount.toString())}</span>`;
        result.setAttribute("data-pagecount", localCount > 0 ? "1" : pageCount.toString());
    } catch (err) {
        console.error("[SemanticSearch] 搜索失败:", err);
        onSearch([], edit, element, config, focusId);
        loading.classList.add("fn__none");
        result.innerHTML = "<span class=\"ft__error\">语义搜索失败</span>";
    }
    element.querySelector('[data-type="previous"]')?.setAttribute("disabled", "disabled");
    element.querySelector('[data-type="next"]')?.setAttribute("disabled", "disabled");
};

/** Update the local result count while preserving the document-mode wording. */
const updateSearchSummary = (element: Element, config: Config.IUILayoutTabSearchConfig, data: SearchResponseData) => {
    const result = requiredSearchElement<HTMLElement>(element, "#searchResult");
    // A valid search can match zero blocks, in which case the counter should be cleared.
    if (!(data.matchedBlockCount || 0)) {
        result.innerHTML = "";
        result.setAttribute("data-pagecount", data.pageCount || 1);
        return;
    }
    let text = siyuanI18n.findInDoc.replace("${x}", data.matchedRootCount).replace("${y}", data.matchedBlockCount);
    if (data.docMode) {
        text = siyuanI18n.matchDoc.replace("${x}", data.matchedRootCount);
    }
    result.innerHTML = `${config.page}/${data.pageCount || 1}<span class="fn__space"></span><span class="ft__on-surface">${text}</span>`;
    result.setAttribute("data-pagecount", data.pageCount || 1);
};

/** Send the local block request and route its response to the normal or semantic fallback renderer. */
const finishBlockSearch = (context: BlockSearchContext) => {
    const {element, edit, config, focusId} = context;
    const endpoint = config.method === 4 ? "/api/search/semanticSearchBlock" : "/api/search/fullTextSearchBlock";
    fetchPost(endpoint, {
        query: config.query, method: config.method, types: config.types, subTypes: config.subTypes,
        paths: config.idPath || [], groupBy: config.group, orderBy: config.sort, page: config.page || 1, pageSize: 32,
    }, (response) => {
        const requestKey = config.method === 4 ? "/api/search/semanticSearchBlock" : "/api/search/fullTextSearchBlock";
        // Ignore an older block response when the recent-block request already moved on.
        if (searchIsStale("/api/block/getRecentUpdatedBlocks", requestKey)) {
            return;
        }
        config.page = config.page || 1;
        const data: SearchResponseData = response.data || {};
        // Semantic search can be configured while the local Embedding Dock remains the only usable source.
        if (config.method === 4 && (data.blocks || []).length === 0) {
            void finishSemanticFallback({element, edit, config, focusId, pageCount: data.pageCount || 1});
            return;
        }
        element.querySelector('[data-type="next"]')?.toggleAttribute("disabled", !(config.page < data.pageCount));
        element.querySelector('[data-type="previous"]')?.toggleAttribute("disabled", !(config.page > 1));
        onSearch(data.blocks || [], edit, element, config, focusId);
        updateSearchSummary(element, config, data);
        requiredSearchElement<HTMLElement>(element, ".fn__loading").classList.add("fn__none");
    });
};

/** Prepare local-search UI state before dispatching either recent-block or block search. */
const executeSearch = (context: ExecuteSearchContext) => {
    const {element, config, edit, rmCurrentCriteria, focusId} = context;
    // Remove the previous criteria chip only when the caller explicitly requests a fresh search.
    if (rmCurrentCriteria) {
        element.querySelector("#criteria .b3-chip--current")?.classList.remove("b3-chip--current");
    }
    const list = requiredSearchElement<HTMLElement>(element, "#searchList");
    const loading = requiredSearchElement<HTMLElement>(element, ".fn__loading");
    const input = requiredSearchElement<HTMLInputElement>(element, "#searchInput");
    loading.classList.remove("fn__none");
    loading.style.top = list.offsetTop + "px";
    config.query = input.value;
    list.scrollTo(0, 0);
    emitSearchInput(edit, config, input);
    // Empty queries use the recent-block endpoint; non-empty queries use the configured block search.
    if (config.query === "" && (!config.idPath || config.idPath.length === 0)) {
        finishRecentSearch(element, edit, config);
        return;
    }
    finishBlockSearch(element, edit, config, focusId);
};

/**
 * 搜索输入事件处理函数。
 * @参数豁免: 遗留代码。该函数由现有搜索菜单、快捷键和分页回调共同调用，保持五参数兼容可避免扩大本次网络搜索改动的调用面。
 */
export const inputEvent = (element: Element, config: Config.IUILayoutTabSearchConfig,
    edit: Protyle, rmCurrentCriteria = false, focusId?: SearchFocusId) => {
    // Web mode owns its request lifecycle and must not start a competing local request.
    if (element.getAttribute("data-search-source") === "web") {
        return;
    }
    let inputTimeout = parseInt(element.getAttribute("data-timeout") || "0");
    clearTimeout(inputTimeout);
    // This existing timer is input debouncing for local search; the interval is the shared UI constant.
    inputTimeout = window.setTimeout(() => executeSearch({element, config, edit, rmCurrentCriteria, focusId}), Constants.TIMEOUT_INPUT);
    element.setAttribute("data-timeout", inputTimeout.toString());
};
