/**
 * 判断两个垂直区间是否属于同一行，用于把 Range 返回的碎片矩形收敛成更稳定的行矩形。
 * 调用时机：`mergeRects` 在遍历 `Range.getClientRects()` 时按需调用。
 * 问题/改进：当前阈值固定为 50%，后续如发现特殊字号场景可考虑参数化。
 */
const hasSignificantVerticalOverlap = (
    top1: number,
    bottom1: number,
    top2: number,
    bottom2: number,
    overlapThreshold = 0.5
) => {
    const overlapTop = Math.max(top1, top2);
    const overlapBottom = Math.min(bottom1, bottom2);
    const overlapHeight = Math.max(0, overlapBottom - overlapTop);
    const hasOverlap = overlapHeight > 0;
    if (!hasOverlap) {
        return false;
    }
    const firstHeight = bottom1 - top1;
    const secondHeight = bottom2 - top2;
    const smallerHeight = Math.min(firstHeight, secondHeight);
    return overlapHeight / smallerHeight >= overlapThreshold;
};

/**
 * 合并同一行或相邻的 Range 矩形，减少 PDF 标注等场景下碎片化矩形带来的后续处理成本。
 * 调用时机：PDF 标注坐标计算和其他 Range 矩形归并流程会同步调用。
 * 问题/改进：当前返回的是轻量对象而非 `DOMRect`，若后续需要更多几何信息可扩展字段。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const mergeRects = (range: Range) => {
    const mergedRects: Array<{ left: number; top: number; right: number; bottom: number }> = [];
    for (const rect of Array.from(range.getClientRects())) {
        const isVisibleRect = rect.height > 0 && rect.width > 0;
        if (!isVisibleRect) {
            continue;
        }
        const lastRect = mergedRects[mergedRects.length - 1];
        const isFirstRect = !lastRect;
        if (isFirstRect) {
            mergedRects.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
            continue;
        }
        const isSameRow = hasSignificantVerticalOverlap(lastRect.top, lastRect.bottom, rect.top, rect.bottom);
        if (!isSameRow) {
            mergedRects.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
            continue;
        }
        lastRect.left = Math.min(lastRect.left, rect.left);
        lastRect.top = Math.min(lastRect.top, rect.top);
        lastRect.right = Math.max(lastRect.right, rect.right);
        lastRect.bottom = Math.max(lastRect.bottom, rect.bottom);
    }
    return mergedRects;
};
