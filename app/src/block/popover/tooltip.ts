/**
 * Tooltip 相关函数
 * 从 popover.ts 拆分出来，处理各种元素的 tooltip 显示逻辑
 */

import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { fetchPost } from "../../util/network/fetch";
import { hideTooltip, showTooltip } from "../../dialog/tooltip";
import { isLocalPath } from "../../util/file/pathName";
import { Constants } from "../../constants";
import { getCellText } from "../../protyle/render/av/cell";
import { escapeAriaLabel, escapeHtml } from "../../util/DOM/escape";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { TooltipInfo } from "./tooltip.types";
export type { TooltipInfo };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 常量定义
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 滚动检测容差（用于判断文本是否溢出） */
const SCROLL_TOLERANCE = 0.5;

/** 单元格滚动检测容差 */
const CELL_SCROLL_TOLERANCE = 2;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 类型定义
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tooltip 获取函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 获取 AV 表头单元格的 tooltip 信息
 */
const getAVHeaderCellTooltip = (aElement: HTMLElement): string => {
    const textElement = aElement.querySelector(".av__celltext");
    const desc = aElement.getAttribute("data-desc");
    if (textElement && desc) {
        return `${getCellText(aElement)}<div class='ft__on-surface'>${escapeAriaLabel(desc)}</div>`;
    }
    if (textElement && textElement.scrollWidth > textElement.clientWidth + SCROLL_TOLERANCE) {
        return getCellText(aElement);
    }
    return "";
};

/**
 * 检查单元格文本是否溢出，如果溢出则返回 tooltip 内容
 */
const checkCellOverflow = (aElement: HTMLElement): string => {
    aElement.style.overflow = "auto";
    let tip = "";
    if (aElement.scrollWidth > aElement.clientWidth + CELL_SCROLL_TOLERANCE) {
        tip = Lute.EscapeHTMLStr(getCellText(aElement));
    }
    aElement.style.overflow = "";
    return tip;
};

/**
 * 获取 AV 普通单元格的 tooltip 信息
 */
const getAVCellTooltip = (aElement: HTMLElement, target: HTMLElement): { tip: string; tooltipClass: string } => {
    let tip = "";
    let tooltipClass = "";

    // 检查 URL 类型单元格
    const firstElementChild = aElement.firstElementChild;
    if (firstElementChild?.getAttribute("data-type") === "url" && firstElementChild.textContent && firstElementChild.textContent.indexOf("...") > -1) {
        tip = Lute.EscapeHTMLStr(firstElementChild.getAttribute("data-href") || "");
        tooltipClass = "href";
    }

    // 检查文本溢出
    if (!tip && aElement.dataset.wrap !== "true" && target.dataset.type !== "block-more" && !hasClosestByClassName(target, "block__icon")) {
        tip = checkCellOverflow(aElement);
    }

    return { tip, tooltipClass };
};

/**
 * 获取 AV 视图标签的 tooltip 信息
 */
const getAVViewTabTooltip = (aElement: HTMLElement): string => {
    const textElement = aElement.querySelector(".item__text");
    const desc = aElement.getAttribute("data-desc");
    if (textElement && desc) {
        return `${textElement.textContent}<div class='ft__on-surface'>${escapeAriaLabel(desc)}</div>`;
    }
    if (textElement && textElement.scrollWidth > textElement.clientWidth + SCROLL_TOLERANCE) {
        return textElement.textContent || "";
    }
    return "";
};

/**
 * 处理 AV 单元格 tooltip (Header vs Ordinary)
 */
const processAVCellTooltip = (aElement: HTMLElement, target: HTMLElement): { tip: string, tooltipClass: string } => {
    if (aElement.classList.contains("av__cell--header")) {
        return { tip: getAVHeaderCellTooltip(aElement), tooltipClass: "" };
    }
    return getAVCellTooltip(aElement, target);
};
/**
 * 获取特定元素（AV 单元格、URL、计算结果等）的 tooltip 信息
 */
const getSpecificElementTooltip = (aElement: HTMLElement, target: HTMLElement, initialTip: string): { tip: string, tooltipClass: string } | undefined => {
    let tip = "";
    let tooltipClass = "";

    // AV 单元格处理
    if (aElement.classList.contains("av__cell") && !aElement.classList.contains("ariaLabel")) {
        return processAVCellTooltip(aElement, target);
    }

    // AV 视图标签处理
    if (aElement.parentElement?.parentElement?.classList.contains("av__views") &&
        aElement.parentElement.classList.contains("layout-tab-bar")) {
        tip = getAVViewTabTooltip(aElement);
        return { tip, tooltipClass };
    }

    // URL 文本单元格处理
    if (aElement.classList.contains("av__celltext--url")) {
        const title = aElement.getAttribute("data-name") || "";
        tip = initialTip ? `<span style="word-break: break-all">${initialTip.substring(0, Constants.SIZE_TITLE)}</span>${title ? '<div class="fn__hr"></div><span>' + title + "</span>" : ""}` : title;
        tooltipClass = "href";
        return { tip, tooltipClass };
    }

    // 计算结果单元格处理
    if (aElement.classList.contains("av__calc--ashow") && aElement.clientWidth + CELL_SCROLL_TOLERANCE < aElement.scrollWidth) {
        tip = (aElement.lastChild?.textContent || "") + " " + (aElement.firstElementChild?.textContent || "");
        return { tip, tooltipClass };
    }

    // 关联单元格处理
    if (aElement.getAttribute("data-type") === "setRelationCell") {
        return getRelationCellTooltip(aElement, tooltipClass);
    }

    return undefined;
};

/**
 * 获取关联单元格的 tooltip 信息
 */
const getRelationCellTooltip = (aElement: HTMLElement, tooltipClass: string): { tip: string, tooltipClass: string } | undefined => {
    const childElement = aElement.querySelector(".b3-menu__label");
    if (!childElement || childElement.clientWidth >= childElement.scrollWidth) {
        return undefined;
    }
    const tip = childElement.textContent || "";
    return { tip, tooltipClass };
};



/**
 * 获取超链接 tooltip 信息
 */
const getLinkTooltipInfo = (aElement: HTMLElement): { tip: string, tooltipClass: string, tooltipSpace?: number } => {
    let tip = "";
    let tooltipClass = "";
    let tooltipSpace: number | undefined;

    const href = aElement.getAttribute("data-href") || "";
    // 链接地址强制换行 https://github.com/siyuan-note/siyuan/issues/11539
    if (href) {
        tip = `<span style="word-break: break-all">${href.substring(0, Constants.SIZE_TITLE)}</span>`;
        tooltipClass = "href"; // 为超链接添加 class https://github.com/siyuan-note/siyuan/issues/11440#issuecomment-2119080691
        tooltipSpace = 0;
    }
    const title = aElement.getAttribute("data-title");
    if (title) {
        tip = (tip ? (tip + '<div class="fn__hr"></div>') : "") + "<span>" + title + "</span>";
    }

    if (tooltipSpace !== undefined) {
        return { tip, tooltipClass, tooltipSpace };
    }
    return { tip, tooltipClass };
};
/**
 * 获取元素的 tooltip 信息
 */
export const getTooltipInfo = (aElement: HTMLElement, target: HTMLElement): TooltipInfo => {
    let tooltipClass = "";
    let tip = aElement.getAttribute("aria-label") || "";
    let tooltipSpace: number | undefined;

    const specificTooltip = getSpecificElementTooltip(aElement, target, tip);
    if (specificTooltip) {
        tip = specificTooltip.tip;
        tooltipClass = specificTooltip.tooltipClass;
    }

    // 行级备注处理
    // 行级备注处理
    const memoTip = !tip ? escapeHtml(aElement.getAttribute("data-inline-memo-content") || "") : "";
    if (memoTip) {
        tip = memoTip;
        tooltipClass = "memo"; // 为行级备注添加 class https://github.com/siyuan-note/siyuan/issues/6161
        tooltipSpace = 0; // tooltip 和备注元素之间不能有空隙 https://github.com/siyuan-note/siyuan/issues/14796#issuecomment-3649757267
    }

    // 超链接处理
    const linkInfo = !tip ? getLinkTooltipInfo(aElement) : undefined;
    if (linkInfo?.tip) {
        tip = linkInfo.tip;
        tooltipClass = linkInfo.tooltipClass;
        tooltipSpace = linkInfo.tooltipSpace;
    }

    if (tooltipSpace !== undefined) {
        return { tip, tooltipClass, tooltipSpace };
    }
    return { tip, tooltipClass };
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tooltip 显示函数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 处理 statAsset 请求响应
 */
const handleStatAssetResponse = (response: IWebSocketData, tip: string, title: string | null, aElement: HTMLElement, tooltipClass: string) => {
    let assetTip = tip;
    if (response.code === 1) {
        showTooltip(title ? assetTip + '<div class="fn__hr"></div><span>' + title + "</span>" : assetTip, aElement, tooltipClass);
        return;
    }
    assetTip += ` ${response.data.hSize}${title ? '<div class="fn__hr"></div><span>' + title + "</span>" : ""}<br>${siyuanI18n?.modifiedAt} ${response.data.hUpdated}<br>${siyuanI18n?.createdAt} ${response.data.hCreated}`;
    showTooltip(assetTip, aElement, tooltipClass);
};

/**
 * 处理本地路径的 tooltip 显示
 */
const handleLocalPathTooltip = (aElement: HTMLElement, tip: string, tooltipClass: string) => {
    const href = aElement.getAttribute("data-href");
    const title = aElement.getAttribute("data-title");
    fetchPost("/api/asset/statAsset", { path: href }, (response) => {
        handleStatAssetResponse(response, tip, title, aElement, tooltipClass);
    });
};

/**
 * 更新笔记本 tooltip 内容
 */
const updateNotebookTooltip = (response: IWebSocketData, target: HTMLElement, notebookItemElement: HTMLElement) => {
    const boxData = response.data.boxInfo;
    const tip = `${boxData.name} <small class='ft__on-surface'>${boxData.hSize}</small>${boxData.docCount !== 0 ? siyuanI18n.includeSubFile.replace("x", boxData.docCount) : ""}<br>${siyuanI18n.modifiedAt} ${boxData.hMtime}<br>${siyuanI18n.createdAt} ${boxData.hCtime}`;
    const scopeNotebookItemElement = hasClosestByClassName(target, "b3-list-item__text");
    if (notebookItemElement && scopeNotebookItemElement && (notebookItemElement === scopeNotebookItemElement)) {
        showTooltip(tip, notebookItemElement);
    }
    if (scopeNotebookItemElement &&
        scopeNotebookItemElement.parentElement?.getAttribute("data-type") === "navigation-root" &&
        scopeNotebookItemElement.parentElement?.parentElement?.getAttribute("data-url") === boxData.id) {
        scopeNotebookItemElement.setAttribute("aria-label", tip);
    }
};

/**
 * 处理笔记本的 tooltip 显示
 */
const handleNotebookTooltip = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }
    const notebookItemElement = hasClosestByClassName(target, "b3-list-item__text");
    if (!notebookItemElement) {
        return;
    }
    if (notebookItemElement.parentElement?.getAttribute("data-type") !== "navigation-root") {
        return;
    }
    const url = notebookItemElement.parentElement?.parentElement?.getAttribute("data-url");
    if (!url) {
        return;
    }
    fetchPost("/api/notebook/getNotebookInfo", { notebook: url }, (response) => {
        updateNotebookTooltip(response, target, notebookItemElement);
    });
};

/**
 * 处理 tooltip 的显示逻辑
 * @returns 是否成功显示了 tooltip 并停止事件传播
 */
export const handleTooltipDisplay = (
    aElement: HTMLElement,
    event: MouseEvent,
    tooltipInfo: TooltipInfo
): boolean => {
    const { tip, tooltipClass, tooltipSpace } = tooltipInfo;

    // 处理本地路径 tooltip（异步）
    if (tip && isLocalPath(aElement.getAttribute("data-href") || "") && !aElement.classList.contains("b3-tooltips")) {
        handleLocalPathTooltip(aElement, tip, tooltipClass);
        return true;
    }

    // 处理笔记本 tooltip
    handleNotebookTooltip(event);

    // 显示标准 tooltip
    if (tip && !aElement.classList.contains("b3-tooltips")) {
        // https://github.com/siyuan-note/siyuan/issues/11294
        try {
            showTooltip(decodeURIComponent(tip), aElement, tooltipClass, event, tooltipSpace);
        } catch {
            // https://ld246.com/article/1718235737991
            showTooltip(tip, aElement, tooltipClass, event, tooltipSpace);
        }
        return true;
    }

    return false;
};
