/* eslint-disable @typescript-eslint/no-explicit-any */
import { Ref } from 'vue';
import RBush from 'rbush';
import { BushItem, LayoutItem, LayoutColumn } from '../types';
import { getShortestColumn } from '../layoutUtils';

/**
 * 网格布局项目追加函数
 * 将新项目追加到现有布局中，并更新相关状态
 * 
 * 网格布局特点: 
 * - 每行等高，相同的columnWidth
 * - 将项目按照"最短列优先"原则分配到各列中
 * 
 * @example
 * const { newLayoutItems, newBushItems, modifiedColumns } = appendGridItems({
 *   itemsToAppend: newItems,
 *   columnWidth: columnWidth,
 *   gap: gap,
 *   idKey: 'id',
 *   columns: columns,
 *   allItems: previousItems,
 *   idToItemMap: itemIdMap
 * });
 * 
 * @param params 所有需要的参数
 * @returns 包含新创建的布局项和Bush项的对象
 */
export function appendGridItems(params: {
    itemsToAppend: any[];
    columnWidth: Ref<number>;
    gap: Ref<number>;
    idKey: string;
    itemHeight?: (itemData: any, columnWidth: number) => number;
    columns: LayoutColumn[];
    allItems: LayoutItem[];
    idToItemMap: Map<any, LayoutItem>;
}): { 
    newLayoutItems: LayoutItem[]; 
    newBushItems: BushItem[];
    modifiedColumns: LayoutColumn[];
} {
    const { 
        itemsToAppend,
        columnWidth, 
        gap,
        idKey, 
        itemHeight,
        columns,
        allItems,
        idToItemMap
    } = params;

    if (itemsToAppend.length === 0) {
        return { newLayoutItems: [], newBushItems: [], modifiedColumns: columns };
    }

    const newLayoutItems: LayoutItem[] = [];
    const newBushItems: BushItem[] = [];
    
    // 创建新列的副本，以便函数保持纯粹
    const modifiedColumns = [...columns];

    itemsToAppend.forEach(itemData => {
        const id = itemData[idKey];
        // 防止重复添加
        if (idToItemMap.has(id)) return;

        const shortestColumn = getShortestColumn(modifiedColumns);
        const columnIndex = shortestColumn.index;
        
        const newItem: LayoutItem = {
            id,
            data: itemData,
            isPlaceholder: !!itemData.isPlaceholder,
            index: allItems.length + newLayoutItems.length,
            columnIndex,
            indexInColumn: modifiedColumns[columnIndex].items.length,
            width: columnWidth.value,
            height: itemHeight ? itemHeight(itemData, columnWidth.value) : columnWidth.value,
            x: columnIndex * (columnWidth.value + gap.value),
            y: shortestColumn.height,
            minX: 0, minY: 0, maxX: 0, maxY: 0 // 将在 BushItem 中计算
        };
        
        modifiedColumns[columnIndex].items.push(newItem);
        modifiedColumns[columnIndex].height += newItem.height + gap.value;
        
        newBushItems.push(new BushItem(newItem));
        newLayoutItems.push(newItem);
    });

    return { newLayoutItems, newBushItems, modifiedColumns };
}

/**
 * 网格布局项目高度更新处理函数 - 特殊处理行的等高特性
 * 处理项目高度变更并重新计算受影响的布局
 * 
 * 网格布局高度更新特点: 
 * - 同一行的项目保持等高，取该行最高的项目高度
 * - 当某行高度变化时，需要重新计算后续行的Y坐标
 * 
 * @example
 * const { updatedItems, hasChanges } = processGridHeightUpdates({
 *   pendingUpdates: heightUpdates,
 *   idToItemMap: idMap,
 *   allItems: items,
 *   columnCount: columnCount,
 *   gap: gap
 * });
 * 
 * @param params 所需的参数
 * @returns 处理结果
 */
export function processGridHeightUpdates(params: {
    pendingUpdates: Map<any, number>;
    idToItemMap: Map<any, LayoutItem>;
    allItems: LayoutItem[];
    columnCount: Ref<number>;
    gap: Ref<number>;
}): {
    updatedItems: LayoutItem[];
    hasChanges: boolean;
} {
    const { pendingUpdates, idToItemMap, allItems, columnCount, gap } = params;
    
    if (pendingUpdates.size === 0) {
        return { 
            updatedItems: allItems, 
            hasChanges: false 
        };
    }

    // 创建副本以保持纯函数
    const updatedItems = [...allItems];
    const changedRows = new Set<number>(); // 记录发生变化的行的 indexInColumn

    // 首先检测哪些行受到影响
    pendingUpdates.forEach((newHeight, id) => {
        const item = idToItemMap.get(id);
        if (!item || item.height === newHeight) return;

        item.height = newHeight;
        changedRows.add(item.indexInColumn);
    });

    if (changedRows.size === 0) {
        return { 
            updatedItems, 
            hasChanges: false 
        };
    }

    // 对所有受影响的行进行重新计算
    const sortedChangedRows = Array.from(changedRows).sort((a, b) => a - b);
    
    sortedChangedRows.forEach(rowIndex => {
        const rowStartIndex = rowIndex * columnCount.value;
        const rowEndIndex = Math.min(rowStartIndex + columnCount.value, updatedItems.length);
        const rowItems = updatedItems.slice(rowStartIndex, rowEndIndex);

        if (rowItems.length === 0) return;

        const maxRowHeight = Math.max(...rowItems.map(item => item.height));

        // 更新行内所有项目的高度
        rowItems.forEach(item => item.height = maxRowHeight);
    });

    // 从第一个发生变化的行开始，更新后续所有项目的Y坐标
    const firstChangedRowIndex = sortedChangedRows[0];
    let currentY = 0;
    if (firstChangedRowIndex > 0) {
        const prevRowIndex = (firstChangedRowIndex * columnCount.value) - 1;
        if (prevRowIndex >= 0 && prevRowIndex < updatedItems.length) {
            const prevItem = updatedItems[prevRowIndex];
            currentY = prevItem.y + prevItem.height + gap.value;
        }
    }

    for (let i = firstChangedRowIndex * columnCount.value; i < updatedItems.length; i++) {
        const item = updatedItems[i];
        const isFirstInRow = item.columnIndex === 0;

        if (isFirstInRow && i > firstChangedRowIndex * columnCount.value) {
            const prevItem = updatedItems[i - 1];
            currentY = prevItem.y + prevItem.height + gap.value;
        }
        item.y = currentY;
    }

    return { 
        updatedItems, 
        hasChanges: true 
    };
}

/**
 * 查找网格布局中可见的项目
 * 用于快速确定当前视口中应该渲染哪些项目
 * 
 * @example
 * const visibleItems = findGridVisibleItems({
 *   tree: rTree,
 *   viewport: { top: scrollTop, height: viewportHeight },
 *   containerWidth: containerWidth,
 *   allItems: layoutItems
 * });
 * 
 * @param params 所需的参数
 * @returns 可见的布局项目
 */
export function findGridVisibleItems(params: {
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