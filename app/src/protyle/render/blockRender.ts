import { hasClosestByAttribute } from "../util/hasClosest";
import { fetchPost, fetchSyncPost } from "../../util/fetch";
import { processRender } from "../util/processCode";
import { highlightRender } from "./highlightRender";
import { genBreadcrumb, improveBreadcrumbAppearance } from "../wysiwyg/renderBacklink";
import { avRender } from "./av/render";
import { genRenderFrame } from "./util";
import { 语义搜索, 获取语义搜索配置 } from "../../layout/dock/embeddingDock/semanticSearch.api";
import { Constants } from "../../constants";

const getHeadingMode = (item: HTMLElement) => {
    const headingModeAttr = item.getAttribute("custom-heading-mode");
    return ["0", "1", "2"].includes(headingModeAttr || "") ? parseInt(headingModeAttr || "0", 10) : window.siyuan.config?.editor?.headingEmbedMode;
};

// @内联回调
const dispatchSearch = (protyle: IProtyle, item: HTMLElement, content: string, breadcrumb: boolean, top?: number) => {
    // 思源本体方式: JS 脚本
    if (content.startsWith("//!js")) {
        try {
            const includeIDs = new Function(
                "fetchSyncPost",
                "item",
                "protyle",
                "top",
                content)(fetchSyncPost, item, protyle, top);
            if (includeIDs instanceof Promise) {
                // @内联回调
                includeIDs.then((promiseIds) => {
                    if (Array.isArray(promiseIds)) {
                        fetchPost("/api/search/getEmbedBlock", {
                            embedBlockID: item.getAttribute("data-node-id"),
                            includeIDs: promiseIds,
                            headingMode: getHeadingMode(item),
                            breadcrumb
                        }, (response) => {
                            renderEmbed(response.data.blocks || [], protyle, item, top);
                        });
                    }
                }).catch((e) => {
                    renderEmbed([], protyle, item, top, e);
                });
                return;
            }
            if (Array.isArray(includeIDs)) {
                // @内联回调
                fetchPost("/api/search/getEmbedBlock", {
                    embedBlockID: item.getAttribute("data-node-id"),
                    includeIDs,
                    headingMode: getHeadingMode(item),
                    breadcrumb
                }, (response) => {
                    renderEmbed(response.data.blocks || [], protyle, item, top);
                });
                return;
            }
        } catch (e) {
            renderEmbed([], protyle, item, top, e);
        }
        return;
    }

    // S-forge: 增强搜索 - 关键词(k:)、语法(s:)、正则(r:)
    if (content.startsWith("k:") || content.startsWith("s:") || content.startsWith("r:")) {
        let method = 0;
        if (content.startsWith("s:")) {
            method = 1;
        } else if (content.startsWith("r:")) {
            method = 3;
        }
        const query = (content.length > 2) ? content.substring(2).trim() : "";
        const types = window.siyuan.storage?.[Constants.LOCAL_SEARCHDATA]?.types;
        // @内联回调
        fetchPost("/api/search/fullTextSearchBlock", {
            query,
            method,
            types: types || {},
            paths: [],
            groupBy: 0,
            orderBy: 0,
            page: 1,
        }, (response) => {
            // @内联回调
            const blocks = (response.data.blocks || []).map((b: IBlock) => {
                return {
                    block: b,
                    blockPaths: []
                };
            });
            renderEmbed(blocks, protyle, item, top);
        });
        return;
    }

    // S-forge: 增强搜索 - 语义搜索(n:)
    if (content.startsWith("n:")) {
        const query = (content.length > 2) ? content.substring(2).trim() : "";
        // @内联回调
        (async () => {
            try {
                const results = await 语义搜索(query, 获取语义搜索配置());
                // @内联回调
                const blocks = results.map(r => {
                    let ialObj = {};
                    if (r.ial) {
                        try {
                            ialObj = JSON.parse(r.ial);
                        } catch { /* ignore */ }
                    }
                    return {
                        block: {
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
                        } as IBlock,
                        blockPaths: []
                    };
                });
                renderEmbed(blocks, protyle, item, top);
            } catch (err) {
                console.error("[SemanticSearch] 嵌入块语义搜索失败:", err);
                renderEmbed([], protyle, item, top, "语义搜索失败");
            }
        })();
        return;
    }

    // 思源本体方式: SQL 查询
    // @内联回调
    fetchPost("/api/search/searchEmbedBlock", {
        embedBlockID: item.getAttribute("data-node-id"),
        stmt: content,
        headingMode: getHeadingMode(item),
        excludeIDs: [item.getAttribute("data-node-id"), protyle.block.rootID || ""],
        breadcrumb
    }, (response) => {
        renderEmbed(response.data.blocks, protyle, item, top);
    });
};

export const blockRender = (protyle: IProtyle, element: Element, top?: number) => {
    let blockElements: Element[] = [];
    if (element.getAttribute("data-type") === "NodeBlockQueryEmbed") {
        // 编辑器内代码块编辑渲染
        blockElements = [element];
    } else {
        blockElements = Array.from(element.querySelectorAll('[data-type="NodeBlockQueryEmbed"]'));
    }
    if (blockElements.length === 0) {
        return;
    }
    // @内联回调
    for (const itemElement of blockElements) {
        const item = itemElement as HTMLElement;
        if (item.getAttribute("data-render") === "true") {
            continue;
        }
        // 需置于请求返回前，否则快速滚动会导致重复加载 https://ld246.com/article/1666857862494?r=88250
        item.setAttribute("data-render", "true");
        genRenderFrame(item);
        if (item.childElementCount > 3) {
            item.style.height = (item.clientHeight - 4) + "px"; // 减少抖动 https://ld246.com/article/1668669380171
            const children = Array.from(item.children);
            for (let i = 1; i < children.length - 1; i++) {
                if (!children[i].classList.contains("protyle-cursor")) {
                    children[i].remove();
                }
            }
        }
        const content = Lute.UnEscapeHTMLStr(item.getAttribute("data-content") || "");
        let breadcrumb: boolean | string = item.getAttribute("breadcrumb") || "";
        if (breadcrumb) {
            breadcrumb = breadcrumb === "true";
        } else {
            breadcrumb = window.siyuan.config?.editor?.embedBlockBreadcrumb || false;
        }

        dispatchSearch(protyle, item, content, breadcrumb as boolean, top);
    }
};

const renderEmbed = (blocks: {
    block: IBlock,
    blockPaths: IBreadcrumb[]
}[], protyle: IProtyle, item: HTMLElement, top?: number, errorTip?: string) => {
    if (!item.firstElementChild) {
        return;
    }
    const rotateElement = item.querySelector(".fn__rotate");
    if (rotateElement) {
        rotateElement.classList.remove("fn__rotate");
    }
    let html = "";
    // @内联回调
    for (const blocksItem of blocks) {
        let breadcrumbHTML = "";
        if (blocksItem.blockPaths.length !== 0) {
            breadcrumbHTML = genBreadcrumb(blocksItem.blockPaths, true);
        }
        html += `<div class="protyle-wysiwyg__embed" data-id="${blocksItem.block.id}">${breadcrumbHTML}${blocksItem.block.content}</div>`;
    }
    if (blocks.length > 0) {
        item.firstElementChild.insertAdjacentHTML("afterend", html);
        const embedElements = item.querySelectorAll(".protyle-wysiwyg__embed");
        if (embedElements.length > 0) {
            improveBreadcrumbAppearance(embedElements[0] as HTMLElement);
        }
    } else {
        item.firstElementChild.insertAdjacentHTML("afterend", `<div class="protyle-wysiwyg__embed ft__smaller ft__secondary b3-form__space--small" contenteditable="false">${errorTip || window.siyuan.languages?.refExpired}</div>`);
    }

    processRender(item);
    highlightRender(item);
    avRender(item, protyle);
    if (top && protyle.contentElement) {
        // 前进后退定位 https://ld246.com/article/1667652729995
        protyle.contentElement.scrollTop = top;
    }
    let maxDeep = 0;
    let deepEmbedElement: false | HTMLElement = item;
    while (maxDeep < 4 && deepEmbedElement) {
        const parent = deepEmbedElement.parentElement;
        if (!parent) {
            break;
        }
        deepEmbedElement = hasClosestByAttribute(parent, "data-type", "NodeBlockQueryEmbed");
        maxDeep++;
    }
    if (maxDeep < 4) {
        const nestedEmbeds = item.querySelectorAll('[data-type="NodeBlockQueryEmbed"]');
        for (const embedElement of Array.from(nestedEmbeds)) {
            blockRender(protyle, embedElement);
        }
    }
    item.style.height = "";
};
