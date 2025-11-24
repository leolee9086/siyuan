/**
 * 合并文本范围的相邻矩形区域
 *
 * 当文本跨越多行时，Range.getClientRects() 会返回多个矩形区域。
 * 此函数将这些相邻或相近的矩形合并为更大的矩形，以便于处理高亮显示等操作。
 *
 * @param range - 需要合并矩形区域的文本范围
 * @returns 合并后的矩形数组，每个矩形包含 left、top、right、bottom 属性
 */
export const mergeRects = (range: Range) => {
    // 获取文本范围的所有客户端矩形
    const rects = range.getClientRects();
    // 存储合并后的矩形数组
    const mergedRects: { left: number; top: number; right: number; bottom: number; }[] = [];
    // 记录上一个矩形的顶部位置，用于判断是否为相邻行
    let lastTop: number | undefined = undefined;
    
    // 遍历所有矩形
    Array.from(rects).forEach(item => {
        // 跳过高度或宽度为0的矩形（通常是空行或不可见元素）
        if (item.height === 0 || item.width === 0) {
            return;
        }
        
        // 如果是第一个矩形，或者当前矩形与上一个矩形不在同一行（垂直距离超过4像素）
        if (typeof lastTop === "undefined" || Math.abs(lastTop - item.top) > 4) {
            // 创建新的合并矩形
            mergedRects.push({ left: item.left, top: item.top, right: item.right, bottom: item.bottom });
            lastTop = item.top;
        } else {
            // 与上一个矩形在同一行，扩展上一个矩形的右边界
            const lastRect = mergedRects[mergedRects.length - 1];
            if (lastRect) {
                lastRect.right = item.right;
            }
        }
    });
    
    return mergedRects;
};
