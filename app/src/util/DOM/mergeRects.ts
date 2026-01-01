/**
 * 判断两个垂直范围是否有显著重叠（重叠比例超过阈值）
 *
 * @param top1 - 第一个矩形的顶部
 * @param bottom1 - 第一个矩形的底部
 * @param top2 - 第二个矩形的顶部
 * @param bottom2 - 第二个矩形的底部
 * @param 重叠阈值 - 重叠占较小矩形高度的最小比例，默认 0.5（50%）
 * @returns 是否有显著重叠
 */
const 垂直范围有显著重叠 = (
    top1: number, bottom1: number,
    top2: number, bottom2: number,
    重叠阈值 = 0.5
): boolean => {
    // 计算重叠区域
    const 重叠顶部 = Math.max(top1, top2);
    const 重叠底部 = Math.min(bottom1, bottom2);
    const 重叠高度 = Math.max(0, 重叠底部 - 重叠顶部);

    // 如果没有重叠，直接返回 false
    if (重叠高度 === 0) {
        return false;
    }

    // 计算两个矩形中较小的高度
    const 高度1 = bottom1 - top1;
    const 高度2 = bottom2 - top2;
    const 较小高度 = Math.min(高度1, 高度2);

    // 判断重叠比例是否超过阈值
    return 重叠高度 / 较小高度 >= 重叠阈值;
};

/**
 * 合并文本范围的相邻矩形区域
 *
 * 当文本跨越多行时，Range.getClientRects() 会返回多个矩形区域。
 * 此函数将这些相邻或相近的矩形合并为更大的矩形，以便于处理高亮显示等操作。
 *
 * 同一行判定逻辑：当两个矩形的垂直范围有超过50%的重叠时，认为它们在同一行。
 * 这种相对阈值比固定像素值更能适应不同字号的情况。
 *
 * @param range - 需要合并矩形区域的文本范围
 * @returns 合并后的矩形数组，每个矩形包含 left、top、right、bottom 属性
 */
export const mergeRects = (range: Range) => {
    // 获取文本范围的所有客户端矩形
    const rects = range.getClientRects();
    // 存储合并后的矩形数组
    const mergedRects: { left: number; top: number; right: number; bottom: number; }[] = [];

    // 遍历所有矩形
    for (const item of Array.from(rects)) {
        // 跳过高度或宽度为0的矩形（通常是空行或不可见元素）
        if (item.height === 0 || item.width === 0) {
            continue;
        }

        const lastRect = mergedRects[mergedRects.length - 1];

        // 如果是第一个矩形，或者当前矩形与上一个矩形不在同一行
        const 是第一个矩形 = !lastRect;
        const 与上一个矩形在同一行 = lastRect && 垂直范围有显著重叠(
            lastRect.top, lastRect.bottom,
            item.top, item.bottom
        );

        if (是第一个矩形 || !与上一个矩形在同一行) {
            // 创建新的合并矩形
            mergedRects.push({ left: item.left, top: item.top, right: item.right, bottom: item.bottom });
            continue;
        }

        // 与上一个矩形在同一行，扩展合并矩形的边界
        if (lastRect) {
            // 扩展右边界
            lastRect.right = Math.max(lastRect.right, item.right);
            // 也扩展左边界（以防矩形顺序不是严格从左到右）
            lastRect.left = Math.min(lastRect.left, item.left);
            // 更新垂直范围以包含所有同行矩形
            lastRect.top = Math.min(lastRect.top, item.top);
            lastRect.bottom = Math.max(lastRect.bottom, item.bottom);
        }
    }

    return mergedRects;
};
