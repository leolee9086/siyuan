import { hasClosestByClassName } from "../protyle/util/hasClosest";
import type { IPdfInstance } from "./anno.types";
import type { IPageInfo } from "./anno.page.types";

/**
 * 从指定点获取页面信息
 * @param x X坐标
 * @param y Y坐标
 * @returns 页面信息或null
 */
export const getPageInfoFromPoint = (x: number, y: number): IPageInfo | null => {
    const element = document.elementFromPoint(x, y);
    if (!element) {
        return null;
    }

    const pageElement = hasClosestByClassName(element, "page");
    if (!pageElement) {
        return null;
    }

    const index = parseInt(pageElement.getAttribute("data-page-number") || "0") - 1;
    if (index < 0) {
        return null;
    }

    return {
        index,
        pageView: undefined, // 将在调用方设置
        pageRect: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            toJSON: () => ({})
        }, // 将在调用方设置
        viewport: undefined, // 将在调用方设置
    };
};

/**
 * 获取页面视图信息
 * @param pdf PDF实例
 * @param pageIndex 页面索引
 * @returns 页面视图信息
 */
export const getPageViewInfo = (pdf: IPdfInstance, pageIndex: number): IPageInfo => {
    const pageView = pdf.pdfViewer.getPageView(pageIndex);
    const pageRect = pageView.canvas.getClientRects()[0];
    const viewport = pageView.viewport;

    return {
        index: pageIndex,
        pageView,
        pageRect,
        viewport,
    };
};