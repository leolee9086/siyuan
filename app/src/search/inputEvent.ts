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

const semanticSearchResultsToBlocks = (results: ISemanticSearchResult[]): IBlock[] => {
    return results.map(r => {
        let ialObj = {};
        if (r.ial) {
            try {
                ialObj = JSON.parse(r.ial);
            } catch {
                // ignore invalid ial from custom embedding datasets
            }
        }
        return {
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
        } as IBlock;
    });
};

const runLocalSemanticSearch = async (
    query: string,
    edit: Protyle,
    element: Element,
    config: Config.IUILayoutTabSearchConfig,
    focusId?: {
        currentId?: string,
        newId?: string
    },
) => {
    const results = await 语义搜索(query, 获取语义搜索配置());
    onSearch(semanticSearchResultsToBlocks(results), edit, element, config, focusId);
    return results.length;
};

/**
 * 搜索输入事件处理函数
 */
export const inputEvent = (element: Element, config: Config.IUILayoutTabSearchConfig,
    edit: Protyle, rmCurrentCriteria = false,
    focusId?: {
        currentId?: string,
        newId?: string
    }) => {
    let inputTimeout = parseInt(element.getAttribute("data-timeout") || "0");
    clearTimeout(inputTimeout);
    inputTimeout = window.setTimeout(() => {
        if (rmCurrentCriteria) {
            element.querySelector("#criteria .b3-chip--current")?.classList.remove("b3-chip--current");
        }
        const listElement = element.querySelector("#searchList") as HTMLElement;
        const loadingElement = element.querySelector(".fn__loading") as HTMLElement;
        loadingElement.classList.remove("fn__none");
        loadingElement.style.top = listElement.offsetTop + "px";
        const searchInputElement = element.querySelector("#searchInput") as HTMLInputElement;
        config.query = searchInputElement.value;
        listElement.scrollTo(0, 0);
        const previousElement = element.querySelector('[data-type="previous"]');
        const nextElement = element.querySelector('[data-type="next"]');
        edit.protyle?.app.plugins.forEach(item => {
            item.eventBus.emit("input-search", {
                protyle: edit,
                config,
                searchElement: searchInputElement,
            });
        });
        const searchResultElement = element.querySelector("#searchResult");
        if (config.query === "" && (!config.idPath || config.idPath.length === 0)) {
            fetchPost("/api/block/getRecentUpdatedBlocks", {}, (response) => {
                if (window.siyuan.reqIds["/api/block/getRecentUpdatedBlocks"] && window.siyuan.reqIds["/api/search/fullTextSearchBlock"] &&
                    window.siyuan.reqIds["/api/block/getRecentUpdatedBlocks"] < window.siyuan.reqIds["/api/search/fullTextSearchBlock"]) {
                    return;
                }
                onSearch(response.data, edit, element, config);
                loadingElement.classList.add("fn__none");
                searchResultElement.innerHTML = "";
                previousElement.setAttribute("disabled", "true");
                nextElement.setAttribute("disabled", "true");
            });
        } else {
            if (config.page > 1) {
                previousElement.removeAttribute("disabled");
            } else {
                previousElement.setAttribute("disabled", "disabled");
            }
            const endpoint = config.method === 4 ? "/api/search/semanticSearchBlock" : "/api/search/fullTextSearchBlock";
            fetchPost(endpoint, {
                query: config.query,
                method: config.method,
                types: config.types,
                subTypes: config.subTypes,
                paths: config.idPath || [],
                groupBy: config.group,
                orderBy: config.sort,
                page: config.page || 1,
                pageSize: 32,
            }, (response) => {
                const searchReqId = config.method === 4
                    ? window.siyuan.reqIds["/api/search/semanticSearchBlock"]
                    : window.siyuan.reqIds["/api/search/fullTextSearchBlock"];
                if (window.siyuan.reqIds["/api/block/getRecentUpdatedBlocks"] && searchReqId &&
                    window.siyuan.reqIds["/api/block/getRecentUpdatedBlocks"] > searchReqId) {
                    return;
                }
                if (!config.page) {
                    config.page = 1;
                }
                const blocks = response.data?.blocks || [];
                // S-forge: 保留本地 Embedding Dock 语义搜索能力，在内核语义搜索没有可用结果时兜底。
                if (config.method === 4 && blocks.length === 0) {
                    (async () => {
                        try {
                            const localCount = await runLocalSemanticSearch(config.query, edit, element, config, focusId);
                            loadingElement.classList.add("fn__none");
                            searchResultElement.innerHTML = `${config.page}/${localCount > 0 ? 1 : (response.data?.pageCount || 1)}<span class="fn__space"></span>
<span class="ft__on-surface">${siyuanI18n.findInDoc.replace("${x}", localCount.toString()).replace("${y}", localCount.toString())}</span>`;
                            searchResultElement.setAttribute("data-pagecount", localCount > 0 ? "1" : (response.data?.pageCount || 1).toString());
                            previousElement.setAttribute("disabled", "disabled");
                            nextElement.setAttribute("disabled", "disabled");
                        } catch (err) {
                            console.error("[SemanticSearch] 搜索失败:", err);
                            onSearch([], edit, element, config, focusId);
                            loadingElement.classList.add("fn__none");
                            searchResultElement.innerHTML = "<span class=\"ft__error\">语义搜索失败</span>";
                            previousElement.setAttribute("disabled", "disabled");
                            nextElement.setAttribute("disabled", "disabled");
                        }
                    })();
                    return;
                }
                if (config.page < response.data.pageCount) {
                    nextElement.removeAttribute("disabled");
                } else {
                    nextElement.setAttribute("disabled", "disabled");
                }
                onSearch(blocks, edit, element, config, focusId);
                let text = siyuanI18n.findInDoc.replace("${x}", response.data.matchedRootCount).replace("${y}", response.data.matchedBlockCount);
                if (response.data.docMode) {
                    text = siyuanI18n.matchDoc.replace("${x}", response.data.matchedRootCount);
                }
                searchResultElement.innerHTML = `${config.page}/${response.data.pageCount || 1}<span class="fn__space"></span>
<span class="ft__on-surface">${text}</span>`;
                loadingElement.classList.add("fn__none");
                searchResultElement.setAttribute("data-pagecount", response.data.pageCount || 1);
            });
        }
    }, Constants.TIMEOUT_INPUT);
    element.setAttribute("data-timeout", inputTimeout.toString());
};
