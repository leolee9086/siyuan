export interface PositionedItem {
    y: number;
    height: number;
}

/**
 * 在一个按 y 坐标排序的数组中，使用二分查找来定位可见区域的起始和结束索引。
 * 灵感来自于 layout.js 中的 `二分查找可见素材` 函数。
 *
 * @param sortedItems - 已按 y 坐标升序排列的项目数组（通常是一列）。
 * @param viewMinY - 可视区域的起始 y 坐标。
 * @param viewMaxY - 可视区域的结束 y 坐标。
 * @returns - 可见项目的起始和结束索引。
 */
export function findVisibleRange(
    sortedItems: PositionedItem[], 
    viewMinY: number, 
    viewMaxY: number
): { start: number; end: number } {
    if (!sortedItems || sortedItems.length === 0) {
        return { start: -1, end: -1 };
    }

    // --- 查找起始索引 ---
    // 目标：找到第一个与可视区域相交的元素。
    // 即，第一个满足 item.y + item.height > viewMinY 的元素。
    let start = -1;
    let low = 0;
    let high = sortedItems.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const item = sortedItems[mid];
        
        if (item.y + item.height > viewMinY) {
            // 此项的底部在视口顶部之下，说明它可能可见，或者是第一个可见项。
            // 我们记录下这个索引，并尝试在它前面寻找更早的可见项。
            start = mid;
            high = mid - 1;
        } else {
            // 此项完全在视口之上，需要向后查找。
            low = mid + 1;
        }
    }

    // --- 查找结束索引 ---
    // 目标：找到最后一个与可视区域相交的元素。
    // 即，最后一个满足 item.y < viewMaxY 的元素。
    let end = -1;
    low = 0;
    high = sortedItems.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const item = sortedItems[mid];

        if (item.y < viewMaxY) {
            // 此项的顶部在视口底部之上，说明它可能可见，或者是最后一个可见项。
            // 我们记录下这个索引，并尝试在它后面寻找更晚的可见项。
            end = mid;
            low = mid + 1;
        } else {
            // 此项完全在视口之下，需要向前查找。
            high = mid - 1;
        }
    }

    // 如果起始索引没找到，说明所有元素都在视口之上，直接返回。
    if (start === -1) {
        return { start: -1, end: -1 };
    }
    
    // 如果结束索引没找到，说明所有元素都在视口之下。
    // 但由于 start 找到了，这意味着至少有一个元素与视口相交，所以 end 至少是 start。
    if (end === -1) {
        end = start;
    }

    return { start, end };
}
