import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { setConfig } from "./config";
import { generateRectContent, createAnnoCoords } from "./anno.content";
import { getPageViewInfo } from "./anno.page";
import type { IPdfInstance, IPdfViewport, IStartPageInfo, IPageListItem } from "./anno.types";
import type { IPageInfo } from "./anno.page.types";

/**
 * 从矩形获取开始页面信息
 * @param rect 矩形边界
 * @returns 开始页面信息或null
 */
const getStartPageInfo = (rect: DOMRect): IStartPageInfo | null => {
    const element = document.elementFromPoint(rect.left, rect.top - 1);
    if (!element) {
        return null;
    }
    const startPageElement = hasClosestByClassName(element, "page");
    if (!startPageElement) {
        return null;
    }
    const pageNumber = startPageElement.getAttribute("data-page-number");
    if (!pageNumber) {
        return null;
    }
    const startIndex = parseInt(pageNumber) - 1;
    return { startPageElement, startIndex };
};

/**
 * 计算 PDF 坐标
 * @param rect 矩形边界
 * @param pageRect 页面矩形
 * @param viewport 视口
 * @returns PDF 坐标数组
 */
const calculatePdfCoordinates = (rect: DOMRect, pageRect: DOMRect, viewport: IPdfViewport): number[] => {
    const topLeft = viewport.convertToPdfPoint(rect.left - pageRect.x, rect.top - pageRect.y);
    const bottomRight = viewport.convertToPdfPoint(rect.right - pageRect.x, rect.bottom - pageRect.y);
    return topLeft.concat(bottomRight);
};

/**
 * 获取结束页面元素
 * @param rect 矩形边界
 * @returns 结束页面元素或false
 */
const getEndPageElement = (rect: DOMRect): HTMLElement | false => {
    let endElement = document.elementFromPoint(rect.right, rect.bottom + 1);
    if (!endElement) {
        endElement = document.body;
    }
    return hasClosestByClassName(endElement, "page");
};

/**
 * 处理结束页面
 * @param pdf PDF 实例
 * @param rect 矩形边界
 * @param startIndex 开始页面索引
 * @param id 注释 ID
 * @param color 注释颜色
 * @param content 注释内容
 * @param type 注释类型
 * @param pages 页面列表
 * @param result 结果列表
 * @returns 处理后的结果列表
 */
const processEndPage = (
    pdf: IPdfInstance,
    rect: DOMRect,
    startIndex: number,
    id: string,
    color: string,
    content: string,
    type: "text" | "border",
    pages: IPageListItem[],
    result: ReturnType<typeof createAnnoCoords>[]
): ReturnType<typeof createAnnoCoords>[] => {
    const endPageElement = getEndPageElement(rect);
    if (!endPageElement) {
        return result;
    }

    const pageNumber = endPageElement.getAttribute("data-page-number");
    if (!pageNumber) {
        return result;
    }

    const endIndex = parseInt(pageNumber) - 1;
    if (endIndex === startIndex) {
        return result;
    }

    const endPage = pdf.pdfViewer.getPageView(endIndex);
    if (!endPage) {
        return result;
    }
    const endPageRects = endPage.canvas.getClientRects();
    if (endPageRects.length === 0) {
        return result;
    }
    const endPageRect = endPageRects[0];
    if (!endPageRect) {
        return result;
    }
    const endViewport = endPage.viewport;

    const endSelected = calculatePdfCoordinates(rect, endPageRect, endViewport);
    pages.push({
        index: endPage.id - 1,
        positions: [endSelected],
    });
    const endPageInfo = getPageViewInfo(pdf, endIndex);
    result.push(createAnnoCoords(endPageInfo, endSelected, id, color, content, type, "rect"));
    return result;
};

/**
 * 创建注释结果
 * @param pageInfo 页面信息
 * @param startSelected 选中的坐标
 * @param id 注释 ID
 * @param color 注释颜色
 * @param content 注释内容
 * @param type 注释类型
 * @returns 注释结果数组
 */
const createAnnotationResult = (
    pageInfo: IPageInfo,
    startSelected: number[],
    id: string,
    color: string,
    content: string,
    type: "text" | "border"
): ReturnType<typeof createAnnoCoords>[] => {
    return [createAnnoCoords(pageInfo, startSelected, id, color, content, type, "rect")];
};

/**
 * 根据矩形获取高亮坐标
 * @param pdf PDF 实例
 * @param color 注释颜色
 * @param rectResizeElement 矩形调整元素
 * @param type 注释类型
 * @returns 高亮坐标结果或undefined
 */
export const getHightlightCoordsByRect = (
    pdf: IPdfInstance,
    color: string,
    rectResizeElement: HTMLElement,
    type: "text" | "border"
): ReturnType<typeof createAnnoCoords>[] | undefined => {
    const rect = rectResizeElement.getBoundingClientRect();

    const startPageInfo = getStartPageInfo(rect);
    if (!startPageInfo) {
        return;
    }
    const { startIndex } = startPageInfo;

    const startPage = pdf.pdfViewer.getPageView(startIndex);
    if (!startPage) {
        return;
    }
    const startPageRects = startPage.canvas.getClientRects();
    if (startPageRects.length === 0) {
        return;
    }
    const startPageRect = startPageRects[0];
    if (!startPageRect) {
        return;
    }
    const startViewport = startPage.viewport;

    const startSelected = calculatePdfCoordinates(rect, startPageRect, startViewport);

    const pages: IPageListItem[] = [
        {
            index: startPage.id - 1,
            positions: [startSelected],
        }
    ];

    const id = Lute.NewNodeID();
    const pageInfo = getPageViewInfo(pdf, startIndex);
    const content = generateRectContent(pdf, pageInfo, id);
    const result = createAnnotationResult(pageInfo, startSelected, id, color, content, type);

    processEndPage(pdf, rect, startIndex, id, color, content, type, pages, result);

    setConfig(pdf, id, {
        id,
        pages,
        content,
        color,
        type,
        mode: "rect",
    });
    return result;
};
