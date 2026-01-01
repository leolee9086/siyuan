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

    if (startSelected.length > 0) {
        pages.push({
            index: startIndex,
            positions: [startSelected],
        });
        const pageInfo = getPageViewInfo(pdf, startIndex);
        results.push(createAnnoCoords(pageInfo, startSelected, id, color, content, "text", "text"));
    }
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
