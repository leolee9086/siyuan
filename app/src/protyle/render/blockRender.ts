import { hasClosestByAttribute } from "../util/hasClosest";
import { fetchPost, fetchSyncPost } from "../../util/network/fetch";
import { contentRendererRegistry } from "../../registry/contentRenderer/ContentRendererRegistry";
import { highlightRender } from "./highlightRender";
import { genBreadcrumb, improveBreadcrumbAppearance } from "../wysiwyg/renderBacklink";
import { avRender } from "./av/render";
import { genRenderFrame } from "./util";
import { 语义搜索, 获取语义搜索配置 } from "../../layout/dock/embeddingDock/semanticSearch.api";
import { Constants } from "../../constants";
import type { SearchContext, SemanticSearchResultItem } from "./blockRender.types";
import { getSiyuanConfig, getSafeSiyuanStorage } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { isStylableElement } from "../../util/DOM/element.guard";

const getHeadingMode = (item: HTMLElement) => {
    const headingModeAttr = item.getAttribute("custom-heading-mode");
    return ["0", "1", "2"].includes(headingModeAttr || "") ? parseInt(headingModeAttr || "0", 10) : getSiyuanConfig()?.editor?.headingEmbedMode;
};

/** 处理 JS 脚本搜索 (//!js) */
const handleJsScriptSearch = (ctx: SearchContext): boolean => {
    const { protyle, item, content, breadcrumb, top } = ctx;
    if (!content.startsWith("//!js")) {
        return false;
    }
    try {
        const includeIDs = new Function(
            "fetchSyncPost", "item", "protyle", "top", content
        )(fetchSyncPost, item, protyle, top);

        if (includeIDs instanceof Promise) {
            // @内联回调
            includeIDs.then((promiseIds) => {
                if (!Array.isArray(promiseIds)) {
                    return;
                }
                // @内联回调
                fetchPost("/api/search/getEmbedBlock", {
                    embedBlockID: item.getAttribute("data-node-id"),
                    includeIDs: promiseIds,
                    headingMode: getHeadingMode(item),
                    breadcrumb
                }, (response) => {
                    renderEmbed(response.data.blocks || [], protyle, item, top);
                });
            }).catch((e) => renderEmbed([], protyle, item, top, e));
            return true;
        }
        if (Array.isArray(includeIDs)) {
            fetchPost("/api/search/getEmbedBlock", {
                embedBlockID: item.getAttribute("data-node-id"),
                includeIDs,
                headingMode: getHeadingMode(item),
                breadcrumb
            }, (response) => {
                renderEmbed(response.data.blocks || [], protyle, item, top);
            });
        }
    } catch (e) {
        renderEmbed([], protyle, item, top, String(e));
    }
    return true;
};

/** 处理关键词/语法/正则搜索 (k:/s:/r:) */
const handleKeywordSearch = (ctx: SearchContext): boolean => {
    const { protyle, item, content, top } = ctx;
    const isKeyword = content.startsWith("k:");
    const isSyntax = content.startsWith("s:");
    const isRegex = content.startsWith("r:");
    if (!isKeyword && !isSyntax && !isRegex) {
        return false;
    }

    const methodMap: Record<string, number> = { "k:": 0, "s:": 1, "r:": 3 };
    const prefix = content.substring(0, 2);
    const method = methodMap[prefix] ?? 0;
    const query = content.length > 2 ? content.substring(2).trim() : "";
    const searchData = getSafeSiyuanStorage()?.[Constants.LOCAL_SEARCHDATA];
    const types = searchData?.types;

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
        const blocks = (response.data.blocks || []).map((b: IBlock) => ({
            block: b,
            blockPaths: []
        }));
        renderEmbed(blocks, protyle, item, top);
    });
    return true;
};

/** 将语义搜索结果转换为嵌入块格式 */
const convertSemanticResult = (r: SemanticSearchResultItem): { block: IBlock; blockPaths: IBreadcrumb[] } => {
    let ialObj: Record<string, string> = {};
    if (r.ial) {
        try {
            ialObj = JSON.parse(r.ial);
        } catch {
            /* ignore */
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
    return { block, blockPaths: [] };
};

/** 处理语义搜索 (n:) */
const handleSemanticSearch = (ctx: SearchContext): boolean => {
    const { protyle, item, content, top } = ctx;
    if (!content.startsWith("n:")) {
        return false;
    }
    const query = content.length > 2 ? content.substring(2).trim() : "";
    (async () => {
        try {
            const results = await 语义搜索(query, 获取语义搜索配置());
            const blocks = results.map(convertSemanticResult);
            renderEmbed(blocks, protyle, item, top);
        } catch (err) {
            console.error("[SemanticSearch] 嵌入块语义搜索失败:", err);
            renderEmbed([], protyle, item, top, "语义搜索失败");
        }
    })();
    return true;
};

/** 处理 SQL 查询（默认方式） */
const handleSqlSearch = (ctx: SearchContext): void => {
    const { protyle, item, content, breadcrumb, top } = ctx;
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

/** 分发搜索请求到对应的处理函数 */
const dispatchSearch = (protyle: IProtyle, item: HTMLElement, content: string, breadcrumb: boolean, top?: number) => {
    const ctx: SearchContext = { protyle, item, content, breadcrumb, top };
    if (handleJsScriptSearch(ctx)) {
        return;
    }
    if (handleKeywordSearch(ctx)) {
        return;
    }
    if (handleSemanticSearch(ctx)) {
        return;
    }
    handleSqlSearch(ctx);
};

export const blockRender = (protyle: IProtyle, element: Element, top?: number) => {
    // 默认：查询子元素中的嵌入块
    let blockElements: Element[] = Array.from(element.querySelectorAll('[data-type="NodeBlockQueryEmbed"]:not([data-render="true"])'));
    // 卫语句：如果元素本身就是嵌入块，则只处理它
    if (element.getAttribute("data-type") === "NodeBlockQueryEmbed") {
        blockElements = element.getAttribute("data-render") === "true" ? [] : [element];
    }
    if (blockElements.length === 0) {
        return;
    }
    // @内联回调
    for (const itemElement of blockElements) {
        if (!isStylableElement(itemElement)) {
            continue;
        }
        const item = itemElement;
        // 需置于请求返回前，否则快速滚动会导致重复加载 https://ld246.com/article/1666857862494?r=88250
        item.setAttribute("data-render", "true");
        genRenderFrame(item);
        if (item.childElementCount > 3) {
            item.style.height = (item.clientHeight - 4) + "px"; // 减少抖动 https://ld246.com/article/1668669380171
            // 使用 slice 从索引 1 到倒数第二个，避免索引访问可能返回 undefined
            const middleChildren = Array.from(item.children).slice(1, -1);
            for (const child of middleChildren) {
                if (!child.classList.contains("protyle-cursor")) {
                    child.remove();
                }
            }
        }
        const content = Lute.UnEscapeHTMLStr(item.getAttribute("data-content") || "");
        const breadcrumbAttr = item.getAttribute("breadcrumb") || "";
        const breadcrumb: boolean = breadcrumbAttr
            ? breadcrumbAttr === "true"
            : (getSiyuanConfig()?.editor?.embedBlockBreadcrumb || false);

        dispatchSearch(protyle, item, content, breadcrumb, top);
    }
};

/** 生成嵌入块的 HTML，非首个嵌入块额外生成浮窗图标 */
const generateEmbedBlocksHtml = (blocks: { block: IBlock; blockPaths: IBreadcrumb[] }[]): string => {
    let html = "";
    for (let i = 0; i < blocks.length; i++) {
        const blocksItem = blocks[i];
        if (!blocksItem) {
            continue;
        }
        const { block, blockPaths } = blocksItem;
        const breadcrumbHTML = blockPaths.length !== 0
            ? genBreadcrumb(blockPaths, true)
            : "";
        let popover = "";
        if (i !== 0) {
            popover = `<div class="protyle-icons"><span data-id="${block.id}" data-action="openFloat" aria-label="${siyuanI18n.refPopover}" data-position="4north" class="ariaLabel protyle-icon protyle-icon--last protyle-icon--first"><svg><use xlink:href="#iconPictureInPicture"></use></svg></span></div>`;
        }
        html += `<div class="protyle-wysiwyg__embed" data-id="${block.id}">
${popover}${breadcrumbHTML}${block.content}
</div>`;
    }
    return html;
};

/** 渲染嵌入块，更新首个嵌入块浮窗图标 ID，并改善面包屑外观 */
const renderBlocksAndImproveBreadcrumb = (item: HTMLElement, blocks: { block: IBlock; blockPaths: IBreadcrumb[] }[]): void => {
    const html = generateEmbedBlocksHtml(blocks);
    if (!item.firstElementChild) {
        return;
    }
    item.firstElementChild.insertAdjacentHTML("afterend", html);
    // 更新第一个嵌入块的浮窗图标 data-id（复用框架内已有的图标）
    if (blocks.length > 0 && blocks[0]) {
        const popoverElement = item.querySelectorAll(".protyle-icon")[2];
        if (popoverElement) {
            popoverElement.setAttribute("data-id", blocks[0].block.id || "");
        }
    }
    const firstEmbedElement = item.querySelector(".protyle-wysiwyg__embed");
    if (!firstEmbedElement || !isStylableElement(firstEmbedElement)) {
        return;
    }
    // 类型守卫确保 firstEmbedElement 是 HTMLElement 或 SVGElement
    // improveBreadcrumbAppearance 需要 HTMLElement，但嵌入块通常是 HTMLElement
    if (firstEmbedElement instanceof HTMLElement) {
        improveBreadcrumbAppearance(firstEmbedElement);
    }
};

/** 计算嵌入块嵌套深度 */
const calculateEmbedDepth = (item: HTMLElement): number => {
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
    return maxDeep;
};

/** 渲染嵌套的嵌入块 */
const renderNestedEmbeds = (protyle: IProtyle, item: HTMLElement) => {
    if (calculateEmbedDepth(item) >= 4) {
        return;
    }
    const nestedEmbeds = item.querySelectorAll('[data-type="NodeBlockQueryEmbed"]');
    for (const embedElement of Array.from(nestedEmbeds)) {
        blockRender(protyle, embedElement);
    }
};

/**
 * 渲染嵌入块内容
 *
 * 作用：将查询到的块数据渲染到嵌入块容器中，包括处理错误提示、嵌套渲染等
 * 意图：为嵌入块查询功能提供统一的渲染逻辑，支持面包屑、高亮、AV等各种块类型
 * 调用时机：当嵌入块查询完成后，需要将结果渲染到DOM中时调用
 * 问题/改进：需要处理深度嵌套可能导致的性能问题
 */
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
    // 空块时显示过期/错误提示
    if (blocks.length === 0) {
        const emptyHtml = `<div class="protyle-wysiwyg__embed ft__smaller ft__secondary b3-form__space--small" contenteditable="false">${errorTip || siyuanI18n.refExpired}</div>`;
        item.firstElementChild.insertAdjacentHTML("afterend", emptyHtml);
    }
    if (blocks.length > 0) {
        renderBlocksAndImproveBreadcrumb(item, blocks);
    }

    contentRendererRegistry.renderBatch(item);
    highlightRender(item);
    avRender(item, protyle);
    // 当提供了滚动位置参数且编辑器内容元素存在时，恢复滚动位置
    // 用于前进后退导航时的精确定位 https://ld246.com/article/1667652729995
    if (top && protyle.contentElement) {
        protyle.contentElement.scrollTop = top;
    }
    renderNestedEmbeds(protyle, item);
    item.style.height = "";
};
