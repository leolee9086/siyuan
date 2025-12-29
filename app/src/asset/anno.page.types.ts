import type { IPdfPageView } from "./anno.types";

/**
 * 页面信息接口
 */
export interface IPageInfo {
    /** 页面索引 */
    index: number;
    /** 页面视图 */
    pageView: IPdfPageView | undefined;
    /** 页面矩形 */
    pageRect: DOMRect;
    /** 页面视口 */
    viewport: IPdfPageView["viewport"] | undefined;
}
