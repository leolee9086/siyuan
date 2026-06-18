/** 用途：PDF 实例类型。使用范围：页面视图信息获取。解耦评估：同目录类型文件。 */
import type { IPdfInstance } from "./anno.types";
/** 用途：页面信息类型。使用范围：getPageViewInfo 返回值类型。解耦评估：同目录类型文件。 */
import type { IPageInfo } from "./anno.page.types";

/**
 * 获取页面视图信息
 * @param pdf PDF实例
 * @param pageIndex 页面索引
 * @returns 页面视图信息
 */
export const getPageViewInfo = async (pdf: IPdfInstance, pageIndex: number) => {
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