import type { IPdfInstance } from "./anno.types";
import type { IPageInfo } from "./anno.page.types";

/**
 * 获取页面视图信息
 * @param pdf PDF实例
 * @param pageIndex 页面索引
 * @returns 页面视图信息
 */
export const getPageViewInfo = (pdf: IPdfInstance, pageIndex: number): IPageInfo => {
    const pageView = pdf.pdfViewer.getPageView(pageIndex);
    if (!pageView) {
        throw new Error(`无法获取页面视图: pageIndex=${pageIndex}`);
    }
    const pageRect = pageView.canvas.getClientRects()[0];
    if (!pageRect) {
        throw new Error(`无法获取页面矩形: pageIndex=${pageIndex}`);
    }
    const viewport = pageView.viewport;

    return {
        index: pageIndex,
        pageView,
        pageRect,
        viewport,
    };
};