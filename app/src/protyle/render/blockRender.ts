import { hasClosestByAttribute } from "../util/hasClosest";
import { fetchPost, fetchSyncPost } from "../../util/network/fetch";
import { contentRendererRegistry } from "../../registry/contentRenderer/ContentRendererRegistry";
import { highlightRender } from "./highlightRender";
import {genBreadcrumb, improveBreadcrumbAppearance} from "../breadcrumb/backlinkBreadcrumb";
import { avRender } from "./av/render";
import { genRenderFrame } from "./util";
import { 语义搜索, 获取语义搜索配置 } from "../../layout/dock/embeddingDock/semanticSearch.api";
import { Constants } from "../../constants";
import type { SearchContext, SemanticSearchResultItem } from "./render.types";
import { getSiyuanConfig, getSafeSiyuanStorage } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { isStylableElement } from "../../util/DOM/element.guard";
import {withEncryptedNotebook} from "../../util/file/notebook/store";
import {disabledWYSIWYG} from "../util/disabledWYSIWYG";
import {normalizeHTMLAssetIFrameBlockDOM} from "../../asset/html";
import {finishCustomEmbedRender, finishEmptyEmbedRender, IEmbedRenderLoadingState} from "./embedRenderState";

/**
 * 表示嵌入查询返回或本地搜索合成的一项块结果。
 * 所有查询模式在进入统一 DOM 渲染前都转换为此结构；服务端结果可额外声明子块操作能力。
 */
interface IEmbedBlockResult {
    block: IBlock;
    blockPaths: IBreadcrumb[];
    allowChildOperation?: boolean;
}

const getHeadingMode = (item: HTMLElement) => {
    const headingModeAttr = item.getAttribute("custom-heading-mode");
    return ["0", "1", "2"].includes(headingModeAttr || "") ? parseInt(headingModeAttr || "0", 10) : getSiyuanConfig()?.editor?.headingEmbedMode;
};

/** 处理 JS 脚本搜索 (//!js)，安全模式下禁用并返回过期提示 */
const handleJsScriptSearch = (ctx: SearchContext, loadingState: IEmbedRenderLoadingState): boolean => {
    const { protyle, item, content, breadcrumb, top, onEmbedRender } = ctx;
    if (!content.startsWith("//!js")) {
        return false;
    }
    // 安全模式下禁用 JS 查询嵌入块，与代码片段（CSS/JS snippet）的处理保持一致
    if (getSiyuanConfig()?.system?.safeMode) {
        renderEmbed([], protyle, item, top, window.siyuan.languages.safeModeJSTip, onEmbedRender);
        return true;
    }
    const renderError = (error: unknown) => {
        console.error(error);
        renderEmbed([], protyle, item, top, String(error), onEmbedRender);
    };
    try {
        // 以异步 IIFE 包装用户脚本，使查询代码可以像同步代码一样书写并支持 await
        const includeIDsPromise = new Function(
            "fetchSyncPost",
            "item",
            "protyle",
            "top",
            `return (async () => {
${content}
})();`
        )(fetchSyncPost, item, protyle, top);
        // @内联回调
        includeIDsPromise.then((includeIDs: unknown) => {
            if (!Array.isArray(includeIDs)) {
                finishCustomEmbedRender(item, loadingState, onEmbedRender);
                return;
            }
            // @内联回调
            fetchPost("/api/search/getEmbedBlock", withEncryptedNotebook(protyle.notebookId, {
                embedBlockID: item.getAttribute("data-node-id"),
                includeIDs,
                headingMode: getHeadingMode(item),
                breadcrumb
            }), (response) => {
                renderEmbed(response.data.blocks || [], protyle, item, top, undefined, onEmbedRender);
            });
        }).catch(renderError);
    } catch (e) {
        renderError(e);
    }
    return true;
};

/** 处理关键词/语法/正则搜索 (k:/s:/r:) */
const handleKeywordSearch = (ctx: SearchContext): boolean => {
    const { protyle, item, content, top, onEmbedRender } = ctx;
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
        renderEmbed(blocks, protyle, item, top, undefined, onEmbedRender);
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
    const { protyle, item, content, top, onEmbedRender } = ctx;
    if (!content.startsWith("n:")) {
        return false;
    }
    const query = content.length > 2 ? content.substring(2).trim() : "";
    (async () => {
        try {
            const results = await 语义搜索(query, 获取语义搜索配置());
            const blocks = results.map(convertSemanticResult);
            renderEmbed(blocks, protyle, item, top, undefined, onEmbedRender);
        } catch (err) {
            console.error("[SemanticSearch] 嵌入块语义搜索失败:", err);
            renderEmbed([], protyle, item, top, "语义搜索失败", onEmbedRender);
        }
    })();
    return true;
};

/** 处理 SQL 查询（默认方式） */
const handleSqlSearch = (ctx: SearchContext): void => {
    const { protyle, item, content, breadcrumb, top, onEmbedRender } = ctx;
    fetchPost("/api/search/searchEmbedBlock", withEncryptedNotebook(protyle.notebookId, {
        embedBlockID: item.getAttribute("data-node-id"),
        stmt: content,
        headingMode: getHeadingMode(item),
        excludeIDs: [item.getAttribute("data-node-id"), protyle.block.rootID || ""],
        breadcrumb
    }), (response) => {
        renderEmbed(response.data.blocks, protyle, item, top, undefined, onEmbedRender);
    });
};

/** 分发搜索请求到对应的处理函数 */
const dispatchSearch = (ctx: SearchContext, loadingState: IEmbedRenderLoadingState) => {
    if (handleJsScriptSearch(ctx, loadingState)) {
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

/**
 * 扫描并异步渲染指定范围内尚未处理的嵌入块。
 * `onEmbedRender` 用于 Agent 等宿主等待每一项异步查询完成 DOM 写入。
 */
/** @参数豁免: 生命周期 */
export const blockRender = (protyle: IProtyle, element: Element, top?: number, onEmbedRender?: () => void) => {
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
        const content = Lute.UnEscapeHTMLStr(item.getAttribute("data-content") || "");
        // 查询内容为空时仅重建框架并结束本次渲染，避免发起无效请求
        if (!content.trim()) {
            genRenderFrame(item);
            finishEmptyEmbedRender(item, onEmbedRender);
            continue;
        }
        // 需置于请求返回前，否则快速滚动会导致重复加载 https://ld246.com/article/1666857862494?r=88250
        item.setAttribute("data-render", "true");
        genRenderFrame(item);
        const loadingState: IEmbedRenderLoadingState = {
            rotateElement: item.querySelector(":scope > .protyle-icons .protyle-action__reload .fn__rotate"),
        };
        if (item.childElementCount > 3) {
            loadingState.height = (item.clientHeight - 4) + "px";
            item.style.height = loadingState.height; // 减少抖动 https://ld246.com/article/1668669380171
            // 使用 slice 从索引 1 到倒数第二个，避免索引访问可能返回 undefined
            const middleChildren = Array.from(item.children).slice(1, -1);
            for (const child of middleChildren) {
                if (!child.classList.contains("protyle-cursor")) {
                    child.remove();
                }
            }
        }
        const breadcrumbAttr = item.getAttribute("breadcrumb") || "";
        const breadcrumb: boolean = breadcrumbAttr
            ? breadcrumbAttr === "true"
            : (getSiyuanConfig()?.editor?.embedBlockBreadcrumb || false);

        dispatchSearch({protyle, item, content, breadcrumb, top, onEmbedRender}, loadingState);
    }
};

/** 生成嵌入块的 HTML，非首个嵌入块额外生成浮窗图标 */
const generateEmbedBlocksHtml = (blocks: IEmbedBlockResult[]): string => {
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
        const childOperationAttr = blocksItem.allowChildOperation ? ' data-allow-child-operation="true"' : "";
        const rootIDAttr = blocksItem.block.rootID ? ` data-root-id="${blocksItem.block.rootID}"` : "";
        html += `<div class="protyle-wysiwyg__embed" data-id="${block.id}"${rootIDAttr}${childOperationAttr}>
${popover}${breadcrumbHTML}${block.content}
</div>`;
    }
    return html;
};

/** 渲染嵌入块，更新首个嵌入块浮窗图标 ID，并改善面包屑外观 */
const renderBlocksAndImproveBreadcrumb = (item: HTMLElement, blocks: IEmbedBlockResult[]): void => {
    const html = generateEmbedBlocksHtml(blocks);
    if (!item.firstElementChild) {
        return;
    }
    item.firstElementChild.insertAdjacentHTML("afterend", normalizeHTMLAssetIFrameBlockDOM(html));
    // 更新第一个嵌入块的浮窗图标 data-id（复用框架内已有的图标）
    const firstBlock = blocks[0];
    const popoverElement = firstBlock ? item.querySelectorAll(".protyle-icon")[2] : undefined;
    // 首项复用框架自带的浮窗按钮，仅在块和按钮均存在时更新目标。
    if (firstBlock && popoverElement) {
        popoverElement.setAttribute("data-id", firstBlock.block.id || "");
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
const renderNestedEmbeds = (protyle: IProtyle, item: HTMLElement, onEmbedRender?: () => void) => {
    if (calculateEmbedDepth(item) >= 4) {
        return;
    }
    const nestedEmbeds = item.querySelectorAll('[data-type="NodeBlockQueryEmbed"]');
    for (const embedElement of Array.from(nestedEmbeds)) {
        blockRender(protyle, embedElement, undefined, onEmbedRender);
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
/** @参数豁免: 生命周期 */
const renderEmbed = (blocks: IEmbedBlockResult[], protyle: IProtyle, item: HTMLElement, top?: number,
                     errorTip?: string, onEmbedRender?: () => void) => {
    if (!item.firstElementChild) {
        onEmbedRender?.();
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
    if (protyle.disabled) {
        // 嵌入块异步渲染可能晚于只读状态设置，需同步禁用新插入的可编辑节点
        disabledWYSIWYG(item);
    }
    // 当提供了滚动位置参数且编辑器内容元素存在时，恢复滚动位置
    // 用于前进后退导航时的精确定位 https://ld246.com/article/1667652729995
    if (top && protyle.contentElement) {
        protyle.contentElement.scrollTop = top;
    }
    renderNestedEmbeds(protyle, item, onEmbedRender);
    item.style.height = "";
    onEmbedRender?.();
};
