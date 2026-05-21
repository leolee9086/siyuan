/**
 * 搜索输入事件处理
 * 从 util.ts 拆分出来，便于维护
 */

import { Constants } from "../constants";
import { fetchPost } from "../util/network/fetch";
import { Protyle } from "../protyle";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { 语义搜索, 获取语义搜索配置 } from "../layout/dock/embeddingDock/semanticSearch.api";
import { onSearch } from "./utils/onSearch";

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
        const loadingElement = element.querySelector(".fn__loading--top");
        loadingElement.classList.remove("fn__none");
        const searchInputElement = element.querySelector("#searchInput") as HTMLInputElement;
        config.query = searchInputElement.value;
        element.querySelector("#searchList").scrollTo(0, 0);
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
            // method=4 表示语义搜索
            if (config.method === 4) {
                // 异步执行语义搜索
                (async () => {
                    try {
                        const semanticConfig = 获取语义搜索配置();
                        const results = await 语义搜索(config.query, semanticConfig);

                        if (results.length === 0) {
                            loadingElement?.classList.add("fn__none");
                            searchResultElement.innerHTML = "<span class=\"ft__on-surface\">语义搜索: 0 个结果</span>";
                            onSearch([], edit, element, config, focusId);
                            return;
                        }

                        // 【改进】直接使用语义搜索返回的完整块信息，无需二次 SQL 查询
                        const blocks: IBlock[] = results.map(r => {
                            let ialObj = {};
                            if (r.ial) {
                                try {
                                    ialObj = JSON.parse(r.ial);
                                } catch { /* ignore */ }
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
                                // 语义搜索：相似度分数（暂存 refCount 供 UI 显示）
                                refCount: Math.round(r.score * 100),
                            } as IBlock;
                        });

                        onSearch(blocks, edit, element, config, focusId);
                        loadingElement?.classList.add("fn__none");
                        searchResultElement.innerHTML = `<span class="ft__on-surface">语义搜索: ${results.length} 个结果</span>`;
                        // 语义搜索不分页
                        previousElement.setAttribute("disabled", "disabled");
                        nextElement.setAttribute("disabled", "disabled");
                    } catch (err) {
                        console.error("[SemanticSearch] 搜索失败:", err);
                        loadingElement?.classList.add("fn__none");
                        searchResultElement.innerHTML = "<span class=\"ft__error\">语义搜索失败</span>";
                    }
                })();
            } else {
                // 传统文本搜索
                fetchPost("/api/search/fullTextSearchBlock", {
                    query: config.query,
                    method: config.method,
                    types: config.types,
                    subTypes: config.subTypes,
                    paths: config.idPath || [],
                    groupBy: config.group,
                    orderBy: config.sort,
                    page: config.page || 1,
                }, (response) => {
                    if (window.siyuan.reqIds["/api/block/getRecentUpdatedBlocks"] && window.siyuan.reqIds["/api/search/fullTextSearchBlock"] &&
                        window.siyuan.reqIds["/api/block/getRecentUpdatedBlocks"] > window.siyuan.reqIds["/api/search/fullTextSearchBlock"]) {
                        return;
                    }
                    if (!config.page) {
                        config.page = 1;
                    }
                    if (config.page < response.data.pageCount) {
                        nextElement.removeAttribute("disabled");
                    } else {
                        nextElement.setAttribute("disabled", "disabled");
                    }
                    onSearch(response.data.blocks, edit, element, config, focusId);
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
        }
    }, Constants.TIMEOUT_INPUT);
    element.setAttribute("data-timeout", inputTimeout.toString());
};
