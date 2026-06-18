/** 用途：PDF 页面视图类型。使用范围：标注页面类型定义。解耦评估：同目录类型文件，直接导入。 */
import type { IPdfPageView } from "./anno.types";
/** 用途：PDF 视口类型。使用范围：标注页面类型定义。解耦评估：同目录类型文件，直接导入。 */
import type { IPdfViewport } from "./anno.types";

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
    viewport: IPdfViewport | undefined;
}
