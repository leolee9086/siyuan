import type { IPageInfo } from "./anno.page";
import type { IRectBounds } from "./anno.types";

/**
 * 计算矩形在页面上的坐标
 * @param pageInfo 页面信息
 * @param rect 矩形边界
 * @returns 坐标数组
 */
export const calculateRectCoords = (pageInfo: IPageInfo, rect: DOMRect): number[] => {
    return pageInfo.viewport.convertToPdfPoint(
        rect.left - pageInfo.pageRect.x,
        rect.top - pageInfo.pageRect.y
    ).concat(pageInfo.viewport.convertToPdfPoint(
        rect.right - pageInfo.pageRect.x,
        rect.bottom - pageInfo.pageRect.y
    ));
};

/**
 * 合并矩形
 * @param range 范围对象
 * @returns 合并后的矩形边界数组
 */
export const mergeRects = (range: Range): IRectBounds[] => {
    const rects = range.getClientRects();
    const mergedRects: IRectBounds[] = [];
    let lastTop: number | undefined = undefined;
    
    Array.from(rects).forEach(item => {
        if (item.height === 0 || item.width === 0) {
            return;
        }
        if (typeof lastTop === "undefined" || Math.abs(lastTop - item.top) > 4) {
            mergedRects.push({ 
                left: item.left, 
                top: item.top, 
                right: item.right, 
                bottom: item.bottom 
            });
            lastTop = item.top;
        } else {
            if (mergedRects.length > 0) {
                mergedRects[mergedRects.length - 1]!.right = item.right;
            }
        }
    });
    
    return mergedRects;
};