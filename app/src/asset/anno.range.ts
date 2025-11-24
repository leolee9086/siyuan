import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { focusByRange } from "../protyle/util/selection";
import type { IPdfInstance, IAnnoCoords } from "./anno.types";
import type { IPageInfo } from "./anno.page";
import { mergeRects } from "./anno.coords";
import { setConfig } from "./anno.config";

/**
 * 范围信息接口
 */
export interface IRangeInfo {
    /** 选择范围 */
    range: Range;
    /** 起始页面索引 */
    startIndex: number;
    /** 结束页面索引 */
    endIndex: number;
    /** 是否跨页面 */
    isCrossPage: boolean;
}

/**
 * 起始页面注释数据接口
 */
export interface IStartAnnotationData {
    /** 起始页面视图信息 */
    startPageViewInfo: IPageInfo;
    /** 起始页面坐标 */
    startSelected: number[];
    /** 注释ID */
    id: string;
    /** 注释内容 */
    content: string;
    /** 起始页面注释坐标对象 */
    startAnnoCoords: IAnnoCoords;
}

/**
 * 注释结果数据接口
 */
export interface IAnnotationResults {
    /** 页面数组 */
    pages: Array<{ index: number; positions: number[][] }>;
    /** 结果数组 */
    result: IAnnoCoords[];
}

/**
 * 提取选择范围和页面信息
 * @returns 范围信息或null
 */
export const extractRangeInfo = (): IRangeInfo | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }
    
    const range = selection.getRangeAt(0);
    const startPageElement = hasClosestByClassName(range.startContainer, "page");
    if (!startPageElement) {
        return null;
    }
    const startIndex = parseInt(
        startPageElement.getAttribute("data-page-number") || "0") - 1;

    const endPageElement = hasClosestByClassName(range.endContainer, "page");
    if (!endPageElement) {
        return null;
    }
    const endIndex = parseInt(endPageElement.getAttribute("data-page-number") || "0") - 1;
    
    return {
        range,
        startIndex,
        endIndex,
        isCrossPage: startIndex !== endIndex
    };
};

/**
 * 处理范围内容（BR标签和特殊字符）
 * @param range 选择范围
 * @returns 处理后的内容文本
 */
export const processRangeContent = (range: Range): string => {
    // https://github.com/siyuan-note/siyuan/issues/5213
    const rangeContents = range.cloneContents();
    Array.from(rangeContents.children).forEach(item => {
        if (item.tagName === "BR" && item.previousElementSibling && item.nextElementSibling) {
            const previousText = item.previousElementSibling.textContent;
            const nextText = item.nextElementSibling.textContent;
            if (/^[A-Za-z]$/.test(previousText.substring(previousText.length - 2, previousText.length - 1)) &&
                /^[A-Za-z]$/.test(nextText.substring(0, 1))) {
                if (previousText.endsWith("-")) {
                    item.previousElementSibling.textContent = previousText.substring(0, previousText.length - 1);
                } else {
                    // 中文情况不能添加 https://github.com/siyuan-note/siyuan/issues/8152
                    item.insertAdjacentText("afterend", " ");
                }
            }
        }
    });
    
    // eslint-disable-next-line no-control-regex
    return Lute.EscapeHTMLStr(rangeContents.textContent.replace(/[\x00]|\n/g, ""));
};

/**
 * 处理跨页面的选择范围
 * @param pdf PDF实例
 * @param rangeInfo 范围信息
 * @returns 处理后的范围和结束页面坐标
 */
export const processCrossPageRange = (pdf: IPdfInstance, rangeInfo: IRangeInfo): {
    startRange: Range;
    endSelected: number[][]
} => {
    const { range, startIndex, endIndex, isCrossPage } = rangeInfo;
    
    const cloneRange = range.cloneRange();
    const endSelected: number[][] = [];
    
    if (isCrossPage) {
        // 处理起始页面范围
        const startPage = pdf.pdfViewer.getPageView(startIndex);
        const textLayerElement = startPage.textLayer.div;
        const spans = textLayerElement.querySelectorAll('span[role="presentation"]');
        let index = spans.length - 1;
        while (index >= 0 && index < spans.length) {
            const span = spans[index];
            if (span && span.textContent) {
                range.setEndAfter(span);
                break;
            } else {
                index--;
            }
        }
        
        // 处理结束页面范围
        focusByRange(cloneRange);
        const endPage = pdf.pdfViewer.getPageView(endIndex);
        const endPageRect = endPage.canvas.getClientRects()[0];
        const endViewport = endPage.viewport;
        
        const endTextLayerElement = endPage.textLayer.div;
        const endSpans = endTextLayerElement.querySelectorAll('span[role="presentation"]');
        let endIndexSpan = 0;
        while (endIndexSpan >= 0 && endIndexSpan < endSpans.length) {
            const span = endSpans[endIndexSpan];
            if (span && span.textContent) {
                cloneRange.setStart(span, 0);
                break;
            } else {
                endIndexSpan++;
            }
        }
        
        mergeRects(cloneRange).forEach(function (r) {
            endSelected.push(
                endViewport.convertToPdfPoint(r.left - endPageRect.x,
                    r.top - endPageRect.y).concat(endViewport.convertToPdfPoint(r.right - endPageRect.x,
                        r.bottom - endPageRect.y)),
            );
        });
    }
    
    return {
        startRange: isCrossPage ? range : cloneRange,
        endSelected
    };
};

/**
 * 计算选择范围的坐标
 * @param pdf PDF实例
 * @param rangeInfo 范围信息
 * @param startRange 起始范围
 * @param endSelected 结束页面坐标（从processCrossPageRange获取）
 * @returns 起始和结束页面的坐标数组
 */
export const calculateRangeCoords = (
    pdf: IPdfInstance,
    rangeInfo: IRangeInfo,
    startRange: Range,
    endSelected: number[][]
): { startSelected: number[][]; endSelected: number[][] } => {
    const { startIndex } = rangeInfo;
    
    // 计算起始页面坐标
    const startPage = pdf.pdfViewer.getPageView(startIndex);
    const startPageRect = startPage.canvas.getClientRects()[0];
    const startViewport = startPage.viewport;
    
    const startSelected: number[][] = [];
    mergeRects(startRange).forEach(function (r) {
        startSelected.push(
            startViewport.convertToPdfPoint(r.left - startPageRect.x,
                r.top - startPageRect.y).concat(startViewport.convertToPdfPoint(r.right - startPageRect.x,
                    r.bottom - startPageRect.y)),
        );
    });
    
    return {
        startSelected,
        endSelected
    };
};

/**
 * 构建注释结果数据
 * @param rangeInfo 范围信息
 * @param startSelected 起始页面坐标
 * @param endSelected 结束页面坐标
 * @param content 内容文本
 * @param color 颜色
 * @param id 注释ID
 * @returns 注释结果数组和页面信息
 */
export const buildAnnotationResults = (
    rangeInfo: IRangeInfo,
    startSelected: number[][],
    endSelected: number[][],
    content: string,
    color: string,
    id: string
): {
    results: IAnnoCoords[];
    pages: Array<{ index: number; positions: number[][] }>
} => {
    const { startIndex, endIndex, isCrossPage } = rangeInfo;
    const pages: Array<{ index: number; positions: number[][] }> = [];
    const results: IAnnoCoords[] = [];
    
    if (startSelected.length > 0) {
        pages.push({
            index: startIndex,
            positions: startSelected,
        });
        results.push({
            index: startIndex,
            coords: startSelected,
            id,
            color,
            content,
            type: "text",
            mode: "text",
        });
    }
    
    if (isCrossPage && endSelected.length > 0) {
        pages.push({
            index: endIndex,
            positions: endSelected,
        });
        results.push({
            index: endIndex,
            coords: endSelected,
            id,
            color,
            content,
            type: "text",
            mode: "text"
        });
    }
    
    return {
        results,
        pages
    };
};

/**
 * 根据范围获取高亮坐标
 * @param pdf PDF实例
 * @param color 颜色
 * @returns 坐标信息数组
 */
export const getHightlightCoordsByRange = (pdf: IPdfInstance, color: string): IAnnoCoords[] | undefined => {
    // 提取选择范围和页面信息
    const rangeInfo = extractRangeInfo();
    if (!rangeInfo) {
        return;
    }
    
    // 处理范围内容（BR标签和特殊字符）
    const content = processRangeContent(rangeInfo.range);
    
    // 处理跨页面的选择范围
    const { startRange, endSelected } = processCrossPageRange(pdf, rangeInfo);
    
    // 计算选择范围的坐标
    const { startSelected, endSelected: finalEndSelected } = calculateRangeCoords(
        pdf,
        rangeInfo,
        startRange,
        endSelected
    );
    
    // 生成注释ID
    const id = Lute.NewNodeID();
    
    // 构建注释结果数据
    const { results, pages } = buildAnnotationResults(
        rangeInfo,
        startSelected,
        finalEndSelected,
        content,
        color,
        id
    );
    
    // 如果没有有效的页面，返回undefined
    if (pages.length === 0) {
        return;
    }
    setConfig(pdf, id, {
        pages,
        content,
        color,
        type: "text",
        mode: "text",
    });
    
    return results;
};