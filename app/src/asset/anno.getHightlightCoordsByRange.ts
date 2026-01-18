import { focusByRange } from "../ai/imports";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { getWindowSelection } from "../util/siyuanEnvironments/windowStandard.environment";
import { getTextNode } from "./anno";
import { setConfig } from "./anno.config";
import { createAnnoCoords } from "./anno.content";
import { mergeRects } from "../util/DOM/mergeRects";
import { processRangeContents } from "../util/DOM/rangeOperations";
import { getPageViewInfo } from "./anno.page";
import type { AnnotationResultParams, IPdfInstance, IRectBounds } from "./anno.types";

/**
 * 获取 Range 所在的页面信息
 */
const getRangePageInfo = (range: Range) => {
    const startPageElement = hasClosestByClassName(range.startContainer, "page");
    if (!startPageElement) {
        return;
    }
    const startIndex = parseInt(
        startPageElement.getAttribute("data-page-number") || "0") - 1;

    const endPageElement = hasClosestByClassName(range.endContainer, "page");
    if (!endPageElement) {
        return;
    }
    const endIndex = parseInt(endPageElement.getAttribute("data-page-number") || "0") - 1;

    return { startIndex, endIndex };
};

/**
 * 处理单个矩形，转换为 PDF 坐标
 */
const convertRectToPdfCoords = (
    r: IRectBounds,
    pageRect: DOMRect,
    viewport: { convertToPdfPoint: (x: number, y: number) => number[] }
): number[] => {
    const topLeft = viewport.convertToPdfPoint(r.left - pageRect.x, r.top - pageRect.y);
    const bottomRight = viewport.convertToPdfPoint(r.right - pageRect.x, r.bottom - pageRect.y);
    return topLeft.concat(bottomRight);
};

/**
 * 处理页面选区，返回选中的坐标
 */
const processPageSelection = (pdf: IPdfInstance, pageIndex: number, range: Range): number[] => {
    const page = pdf.pdfViewer.getPageView(pageIndex);
    if (!page) {
        return [];
    }
    const canvasRects = page.canvas.getClientRects();
    if (canvasRects.length === 0) {
        return [];
    }
    const pageRect = canvasRects[0];
    if (!pageRect) {
        return [];
    }
    const viewport = page.viewport;

    const selected: number[] = [];
    const rects = mergeRects(range);
    for (const r of rects) {
        const coords = convertRectToPdfCoords(r, pageRect, viewport);
        selected.push(...coords);
    }

    return selected;
};

/**
 * 获取结束页的选区坐标
 */
const getEndSelected = (pdf: IPdfInstance, endIndex: number, cloneRange: Range) => {
    focusByRange(cloneRange);
    const endPage = pdf.pdfViewer.getPageView(endIndex);
    if (!endPage) {
        return [];
    }
    const endTextNode = getTextNode(endPage.textLayer.div, true);
    if (endTextNode) {
        cloneRange.setStart(endTextNode, 0);
    }

    return processPageSelection(pdf, endIndex, cloneRange);
};

/**
 * 根据 Range 获取高亮坐标
 */
export const getHightlightCoordsByRange = (pdf: IPdfInstance, color: string) => {
    const selection = getWindowSelection();
    if (!selection || selection.rangeCount === 0) {
        return;
    }
    const range = selection.getRangeAt(0);
    const pageInfo = getRangePageInfo(range);
    if (!pageInfo) {
        return;
    }
    const { startIndex, endIndex } = pageInfo;
    const content = processRangeContents(range);
    const startPage = pdf.pdfViewer.getPageView(startIndex);
    if (!startPage) {
        return;
    }

    const cloneRange = range.cloneRange();
    const startTextNode = startIndex !== endIndex ? getTextNode(startPage.textLayer.div, false) : undefined;
    if (startTextNode) {
        range.setEndAfter(startTextNode);
    }

    const startSelected = processPageSelection(pdf, startIndex, range);

    let endSelected: number[] = [];
    /**
     * 意图：处理用户选区跨越多个 PDF 页面的情况。
     * `startIndex` 是选区起点所在的页码索引，`endIndex` 是选区终点所在的页码索引。
     * 
     * 生效场景：
     * - 当用户在 PDF 中拖选文本，且选区从第 N 页延伸到第 M 页（N < M）时，
     *   此判断为真，需要调用 `getEndSelected` 获取结束页上的选区坐标。
     * - 当选区仅在单页内时（startIndex === endIndex），跳过此步骤，
     *   因为所有坐标已经在 `startSelected` 中处理完毕。
     */
    if (startIndex !== endIndex) {
        endSelected = getEndSelected(pdf, endIndex, cloneRange);
    }

    return createAnnotationResults({ pdf, startIndex, endIndex, startSelected, endSelected, content, color });
};

/**
 * 创建注释结果
 */
const createAnnotationResults = (params: AnnotationResultParams) => {
    const { pdf, startIndex, endIndex, startSelected, endSelected, content, color } = params;
    const id = Lute.NewNodeID();
    const pages: {
        index: number;
        positions: number[][];
    }[] = [];
    const results = [];

    /**
     * 意图：检查起始页是否有有效的选区坐标。
     * `startSelected` 存储从 `processPageSelection` 返回的起始页坐标数据。
     * 
     * 生效场景：
     * - 当起始页成功获取到选区矩形坐标时，`startSelected.length > 0` 为真，
     *   需要将起始页的坐标数据添加到 `pages` 和 `results` 中。
     * - 当获取页面视图失败、canvas 不存在或没有有效选区矩形时，
     *   `startSelected` 为空数组，跳过起始页的处理。
     */
    if (startSelected.length > 0) {
        pages.push({
            index: startIndex,
            positions: [startSelected],
        });
        const pageInfo = getPageViewInfo(pdf, startIndex);
        results.push(createAnnoCoords(pageInfo, startSelected, id, color, content, "text", "text"));
    }
    /**
     * 意图：检查结束页是否有有效的选区坐标。
     * `endSelected` 仅在跨页选择时（startIndex !== endIndex）才会有数据。
     * 
     * 生效场景：
     * - 当用户选区跨越多个页面时，`endSelected` 包含结束页的坐标数据，
     *   此判断为真，需要将结束页的数据添加到 `pages` 和 `results` 中。
     * - 当选区仅在单页内，或获取结束页坐标失败时，
     *   `endSelected` 为空数组，跳过结束页的处理。
     */
    if (endSelected.length > 0) {
        pages.push({
            index: endIndex,
            positions: [endSelected],
        });
        const pageInfo = getPageViewInfo(pdf, endIndex);
        results.push(createAnnoCoords(pageInfo, endSelected, id, color, content, "text", "text"));
    }

    if (pages.length === 0) {
        return;
    }

    setConfig(pdf, id, {
        id,
        pages,
        content,
        color,
        type: "text",
        mode: "text",
    });

    return results;
};
