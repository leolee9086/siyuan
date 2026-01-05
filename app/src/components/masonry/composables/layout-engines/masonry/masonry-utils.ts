/* eslint-disable @typescript-eslint/no-explicit-any */
import { Ref } from "vue";
import RBush from "rbush";
import { BushItem, LayoutItem, LayoutColumn } from "../types";
import { getShortestColumn } from "../layoutUtils";

/**
 * 瀑布流布局项目追加函数  
 * 将新项目追加到现有布局中，并更新相关状态
 * 
 * 瀑布流布局特点: 
 * - 每列宽度相同，但高度可变
 * - 将项目按照"最短列优先"原则分配到各列中
 * 
 * @example
 * const { newLayoutItems, newBushItems, modifiedColumns } = appendMasonryItems({
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
export function appendMasonryItems(params: {
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
        if (idToItemMap.has(id)) {
return;
}

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
 * 瀑布流布局高度更新处理函数
 * 处理项目高度变更并重新计算受影响的列
 * 
 * 瀑布流高度更新特点: 
 * - 当项目高度变化时，只影响该项目所在的列
 * - 需要重新计算该列中该项目之后的所有项目的Y坐标
 * 
 * @example
 * const { updatedColumns, changedColumns, hasChanges } = processMasonryHeightUpdates({
 *   pendingUpdates: heightUpdates,
 *   idToItemMap: idMap,
 *   columns: columnData,
 *   gap: gap
 * });
 * 
 * @param params 所需的参数
 * @returns 处理结果
 */
export function processMasonryHeightUpdates(params: {
    pendingUpdates: Map<any, number>;
    idToItemMap: Map<any, LayoutItem>;
    allItems: LayoutItem[];
    columns: LayoutColumn[];
    gap: Ref<number>;
}): {
    updatedItems: LayoutItem[];
    updatedColumns: LayoutColumn[];
    changedColumns: Map<number, number>;
    hasChanges: boolean;
} {
    const { pendingUpdates, idToItemMap, allItems, columns, gap } = params;
    
    if (pendingUpdates.size === 0) {
        return { 
            updatedItems: allItems,
            updatedColumns: columns, 
            changedColumns: new Map(), 
            hasChanges: false 
        };
    }

    // 创建副本以保持纯函数
    const updatedItems = [...allItems];
    const updatedColumns = [...columns];
    const changedColumns = new Map<number, number>();
    let hasChanges = false;

    // 记录每列中最小的变化项目索引
    pendingUpdates.forEach((newHeight, id) => {
        const item = idToItemMap.get(id);
        if (!item) {
return;
}
        
        const oldHeight = item.height;
        if (oldHeight === newHeight) {
return;
}
        
        // 找到对应的项目并更新高度
        const columnIndex = item.columnIndex;
        const column = updatedColumns[columnIndex];
        const heightDiff = newHeight - oldHeight;
        
        // 更新项目高度
        item.height = newHeight;
        
        // 记录列变化
        if (!changedColumns.has(columnIndex) || 
            changedColumns.get(columnIndex)! > item.indexInColumn) {
            changedColumns.set(columnIndex, item.indexInColumn);
        }
        
        // 更新列高度
        column.height += heightDiff;
        hasChanges = true;
    });

    if (!hasChanges) {
        return { 
            updatedItems,
            updatedColumns, 
            changedColumns, 
            hasChanges 
        };
    }

    // 重新计算受影响列中项目的Y坐标
    changedColumns.forEach((startIndexInColumn, columnIndex) => {
        const column = updatedColumns[columnIndex];
        const items = column.items;
        
        if (startIndexInColumn >= items.length) {
return;
}
        
        // 计算起始Y坐标
        let currentY = 0;
        if (startIndexInColumn > 0) {
            const prevItem = items[startIndexInColumn - 1];
            currentY = prevItem.y + prevItem.height + gap.value;
        }
        
        // 更新后续项目的Y坐标
        for (let i = startIndexInColumn; i < items.length; i++) {
            const item = items[i];
            item.y = currentY;
            currentY += item.height + gap.value;
        }
    });

    return { 
        updatedItems,
        updatedColumns, 
        changedColumns, 
        hasChanges 
    };
}

/**
 * 查找瀑布流布局中可见的项目
 * 使用R-Tree快速查找视口中的项目
 * 
 * @example
 * const visibleItems = findMasonryVisibleItems({
 *   tree: rTree,
 *   viewport: { top: scrollTop, height: viewportHeight },
 *   containerWidth: containerWidth,
 *   allItems: layoutItems
 * });
 * 
 * @param params 所需的参数
 * @returns 可见的布局项目
 */
export function findMasonryVisibleItems(params: {
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