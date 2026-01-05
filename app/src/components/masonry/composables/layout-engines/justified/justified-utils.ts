/* eslint-disable @typescript-eslint/no-explicit-any */
import { Ref } from "vue";
import RBush from "rbush";
import { BushItem, LayoutItem } from "../types";
import { createSegmentTree, type SegmentTree } from "../../../utils/createSegmentTree";

// 默认宽高比
const DEFAULT_ASPECT_RATIO = 1; 

/**
 * 计算行布局信息
 * 将项目分割成行并计算每行的布局
 * 
 * 对齐布局特点:
 * - 每行宽度填满容器宽度
 * - 行内项目等比例缩放，保持宽高比
 * - 最后一行可能不会填满容器
 * 
 * 算法流程:
 * 1. 估算每行能放几个项目
 * 2. 使用分段树精确查找行断点
 * 3. 特殊处理最后一行
 * 4. 对其他行进行等比例缩放以填满容器
 * 
 * @example
 * const { newLayoutItems, layoutComplete } = calculateJustifiedLayout({
 *   items: dataItems,
 *   containerWidth: containerWidth,
 *   rowHeight: baseRowHeight, 
 *   gap: itemGap,
 *   idealWidths: cachedIdealWidths,
 *   segmentTree: widthSegmentTree,
 *   idKey: 'id'
 * });
 * 
 * @param params 所需的参数
 * @returns 计算后的布局项目
 */
export function calculateJustifiedLayout(params: {
    startIndex?: number;
    items: any[];
    containerWidth: Ref<number>;
    rowHeight: Ref<number>;
    gap: Ref<number>;
    idealWidths: number[];
    segmentTree: SegmentTree | null;
    idKey: string;
    existingItems?: LayoutItem[];
}): {
    newLayoutItems: LayoutItem[];
    layoutComplete: boolean;
} {
    const { 
        startIndex = 0, 
        items, 
        containerWidth, 
        rowHeight, 
        gap,
        idealWidths, 
        segmentTree,
        idKey,
        existingItems = []
    } = params;

    if (!segmentTree) {
        return { newLayoutItems: [], layoutComplete: false };
    }

    const containerW = containerWidth.value;
    const newLayoutItems: LayoutItem[] = startIndex > 0 && existingItems.length > 0 
        ? existingItems.slice(0, startIndex) 
        : [];
    
    let currentItemIndex = startIndex;
    let currentY = 0;

    if (startIndex > 0 && newLayoutItems.length > 0) {
        const prevItem = newLayoutItems[startIndex - 1];
        if (prevItem) {
            currentY = prevItem.y + prevItem.height + gap.value;
        }
    }
    
    const totalItemCount = items.length;

    while(currentItemIndex < totalItemCount) {
        // 1. 估算当前行能放下多少项目
        const avgIdealWidth = segmentTree.query(currentItemIndex, totalItemCount - 1) / (totalItemCount - currentItemIndex);
        const itemsPerRow = avgIdealWidth > 0 ? Math.max(1, Math.floor(containerW / (avgIdealWidth + gap.value))) : 1;

        // 2. 使用分段树精确查找断点
        const idealTotalWidthWithoutGap = containerW - (itemsPerRow - 1) * gap.value;
        const rowInfo = segmentTree.findBreakpoint(currentItemIndex, idealTotalWidthWithoutGap);
        let endIndex = rowInfo.endIndex;

        if (endIndex < currentItemIndex) {
            endIndex = currentItemIndex;
        }
        
        const rowItemsData = items.slice(currentItemIndex, endIndex + 1);
        
        // 3. 处理最后一行
        const isLastRow = endIndex === totalItemCount - 1;
        if (isLastRow) {
            let currentX = 0;
            rowItemsData.forEach((itemData, indexInRow) => {
                const itemIndex = currentItemIndex + indexInRow;
                const idealW = idealWidths[itemIndex];
                newLayoutItems[itemIndex] = {
                    id: itemData[idKey], data: itemData, index: itemIndex,
                    isPlaceholder: !!itemData.isPlaceholder,
                    width: idealW, height: rowHeight.value, x: currentX, y: currentY,
                    minX: currentX, minY: currentY, maxX: currentX + idealW, maxY: currentY + rowHeight.value,
                    columnIndex: indexInRow, indexInColumn: 0,
                };
                currentX += idealW + gap.value;
            });
            currentY += rowHeight.value + gap.value;
        } else {
             // 4. 计算缩放比例并布局
            const rowIdealWidth = rowInfo.sum;
            const rowGapTotal = (rowItemsData.length - 1) * gap.value;
            const scale = (containerW - rowGapTotal) / rowIdealWidth;
            const finalRowHeight = rowHeight.value * scale;

            let currentX = 0;
            rowItemsData.forEach((itemData, indexInRow) => {
                const itemIndex = currentItemIndex + indexInRow;
                const idealW = idealWidths[itemIndex];
                const finalWidth = idealW * scale;
                newLayoutItems[itemIndex] = {
                    id: itemData[idKey], data: itemData, index: itemIndex,
                    isPlaceholder: !!itemData.isPlaceholder,
                    width: finalWidth, height: finalRowHeight, x: currentX, y: currentY,
                    minX: currentX, minY: currentY, maxX: currentX + finalWidth, maxY: currentY + finalRowHeight,
                    columnIndex: indexInRow, indexInColumn: 0,
                };
                currentX += finalWidth + gap.value;
            });
            currentY += finalRowHeight + gap.value;
        }
       
        currentItemIndex = endIndex + 1;
    }

    return { newLayoutItems, layoutComplete: true };
}

/**
 * 向对齐布局中添加新项目
 * 计算新项目的理想宽度，用于后续布局
 * 
 * 对齐布局添加特点:
 * - 基于项目的宽高比和基础行高计算理想宽度
 * - 如果没有已知宽高比，使用默认值1
 * 
 * @example
 * const { newIdealWidths } = appendJustifiedItems({
 *   itemsToAppend: newItems,
 *   rowHeight: baseRowHeight,
 *   idKey: 'id',
 *   itemAspectRatios: aspectRatioCache
 * });
 * 
 * @param params 所需的参数
 * @returns 布局结果
 */
export function appendJustifiedItems(params: {
    itemsToAppend: any[];
    rowHeight: Ref<number>;
    idKey: string;
    itemAspectRatios: Map<any, number>;
}): {
    newIdealWidths: number[];
} {
    const { 
        itemsToAppend, 
        rowHeight,
        idKey, 
        itemAspectRatios 
    } = params;

    if (itemsToAppend.length === 0) {
        return { newIdealWidths: [] };
    }

    const newIdealWidths = itemsToAppend.map(itemData => {
        const aspectRatio = itemAspectRatios.get(itemData[idKey]) || DEFAULT_ASPECT_RATIO;
        return rowHeight.value * aspectRatio;
    });

    return { newIdealWidths };
}

/**
 * 处理对齐布局的高度更新请求
 * 根据新的高度更新宽高比和分段树
 * 
 * 对齐布局高度更新特点:
 * - 当项目高度变化时，宽高比也随之变化
 * - 更新分段树中的理想宽度值
 * - 返回受影响的最小索引位置
 * 
 * @example
 * const { minChangedIndex, updatedSegmentTree, updatedIdealWidths, hasChanges } = 
 *   processJustifiedHeightUpdates({
 *     pendingUpdates: heightUpdates,
 *     idToItemMap: itemMap,
 *     itemAspectRatios: aspectRatios,
 *     segmentTree: currentSegmentTree,
 *     idealWidths: currentIdealWidths,
 *     rowHeight: baseRowHeight
 * });
 * 
 * @param params 所需的参数
 * @returns 处理结果
 */
export function processJustifiedHeightUpdates(params: {
    pendingUpdates: Map<any, number>;
    idToItemMap: Map<any, LayoutItem>;
    itemAspectRatios: Map<any, number>;
    segmentTree: SegmentTree | null;
    idealWidths: number[];
    rowHeight: Ref<number>;
}): {
    minChangedIndex: number;
    updatedSegmentTree: SegmentTree | null;
    updatedIdealWidths: number[];
    hasChanges: boolean;
} {
    const { 
        pendingUpdates, 
        idToItemMap, 
        itemAspectRatios, 
        segmentTree, 
        idealWidths,
        rowHeight
    } = params;
    
    if (pendingUpdates.size === 0 || !segmentTree) {
        return { 
            minChangedIndex: Infinity, 
            updatedSegmentTree: segmentTree,
            updatedIdealWidths: idealWidths,
            hasChanges: false 
        };
    }

    const updatedIdealWidths = [...idealWidths];
    let minChangedIndex = Infinity;
    let hasChanges = false;

    pendingUpdates.forEach((newHeight, id) => {
        const item = idToItemMap.get(id);
        if (!item || item.height === newHeight) {
return;
}
        
        const oldAspectRatio = itemAspectRatios.get(id) || DEFAULT_ASPECT_RATIO;
        const newAspectRatio = item.width / newHeight;
        
        if (Math.abs(oldAspectRatio - newAspectRatio) > 1e-6) {
            const newIdealWidth = rowHeight.value * newAspectRatio;
            segmentTree.update(item.index, newIdealWidth);
            updatedIdealWidths[item.index] = newIdealWidth;
            if (item.index < minChangedIndex) {
                minChangedIndex = item.index;
                hasChanges = true;
            }
        }
    });

    return { 
        minChangedIndex, 
        updatedSegmentTree: segmentTree,
        updatedIdealWidths,
        hasChanges
    };
}

/**
 * 查找对齐布局中可见的项目
 * 使用R-Tree高效查询视口中的项目
 * 
 * @example
 * const visibleItems = findJustifiedVisibleItems({
 *   tree: rTree,
 *   viewport: { top: scrollTop, height: viewportHeight },
 *   containerWidth: containerWidth,
 *   allItems: layoutItems
 * });
 * 
 * @param params 所需的参数
 * @returns 可见的布局项目
 */
export function findJustifiedVisibleItems(params: {
    tree: RBush<BushItem>;
    viewport: { top: number, height: number };
    containerWidth: Ref<number>;
    allItems: LayoutItem[];
}): LayoutItem[] {
    const { tree, viewport, containerWidth, allItems } = params;
    
    const results = tree.search({
        minX: 0,
        minY: viewport.top,
        maxX: containerWidth.value,
        maxY: viewport.top + viewport.height,
    });
    
    // 从R-Tree拿到ID，再从allItems中获取最新的对象
    const visibleIds = new Set(results.map(r => r.id));
    return allItems.filter(item => visibleIds.has(item.id));
} 