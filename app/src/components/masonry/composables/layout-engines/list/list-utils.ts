/* eslint-disable @typescript-eslint/no-explicit-any */
import RBush from "rbush";
import { LayoutItem, BushItem } from "../types";

/**
 * 二分查找工具函数
 * 在排序数组中查找第一个满足条件的元素索引
 */
export function binarySearch<T>(arr: T[], predicate: (item: T) => boolean): number {
  let left = 0;
  let right = arr.length;
  
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (predicate(arr[mid])) {
      right = mid;
    } else {
      left = mid + 1;
    }
  }
  
  return left;
}

/**
 * 在 y 坐标范围内查找项目
 */
export function findItemsInYRange(
  sortedItems: LayoutItem[],
  startY: number,
  endY: number
): LayoutItem[] {
  // 列表项高度可变，起点在视口上方但底部仍与视口相交的项目必须继续渲染。
  const startIndex = binarySearch(sortedItems, item => item.y + item.height > startY);
  const endIndex = binarySearch(sortedItems, item => item.y >= endY);
  return sortedItems.slice(startIndex, endIndex);
}

/**
 * 创建 R-tree 项目
 */
export function createBushItem(item: LayoutItem): BushItem {
  return new BushItem(item);
}

/**
 * 批量创建 R-tree 项目
 */
export function createBushItems(items: LayoutItem[]): BushItem[] {
  return items.map(createBushItem);
}

function createListLayoutItem({
  item, index, y, height, containerWidth, gap, idKey
}: {
  item: any;
  index: number;
  y: number;
  height: number;
  containerWidth: number;
  gap: number;
  idKey: string;
}): LayoutItem {
  const width = Math.max(0, containerWidth - gap);
  return {
    id: item[idKey], data: item, index, x: 0, y, width, height,
    minX: 0, minY: y, maxX: width, maxY: y + height,
    columnIndex: 0, indexInColumn: index,
    isPlaceholder: !!item.isPlaceholder
  };
}

/**
 * 计算列表项目的布局位置
 */
export function calculateListLayout(
  items: any[],
  containerWidth: number,
  itemHeight: (item: any) => number,
  gap: number,
  idKey: string
): LayoutItem[] {
  let currentY = 0;
  
  return items.map((item, index) => {
    const height = itemHeight(item);
    const layoutItem: LayoutItem = {
      id: item[idKey],
      data: item,
      index,
      x: 0,
      y: currentY,
      width: Math.max(0, containerWidth - gap), // 减去间距，防止溢出
      height,
      minX: 0,
      minY: currentY,
      maxX: Math.max(0, containerWidth - gap),
      maxY: currentY + height,
      columnIndex: 0,
      indexInColumn: index,
      isPlaceholder: !!item.isPlaceholder
    };
    
    currentY += height + gap;
    return layoutItem;
  });
}

/**
 * 批量添加项目到列表布局
 */
export function appendListItems({
  itemsToAppend,
  containerWidth,
  itemHeight,
  gap,
  idKey,
  existingItems,
  idToItemMap
}: {
  itemsToAppend: any[];
  containerWidth: number;
  itemHeight: (item: any) => number;
  gap: number;
  idKey: string;
  existingItems: LayoutItem[];
  idToItemMap: Map<any, LayoutItem>;
}): {
  newLayoutItems: LayoutItem[];
  newBushItems: BushItem[];
} {
  if (itemsToAppend.length === 0) {
    return { newLayoutItems: [], newBushItems: [] };
  }

  // 计算起始 y 坐标
  const startY = existingItems.length > 0 
    ? existingItems[existingItems.length - 1].y + existingItems[existingItems.length - 1].height + gap
    : 0;

  // 计算新项目的布局
  const newLayoutItems: LayoutItem[] = [];
  let currentY = startY;

  itemsToAppend.forEach((item, indexInBatch) => {
    const globalIndex = existingItems.length + indexInBatch;
    const height = itemHeight(item);
    const layoutItem = createListLayoutItem({
      item, index: globalIndex, y: currentY, height, containerWidth, gap, idKey
    });

    newLayoutItems.push(layoutItem);
    idToItemMap.set(item[idKey], layoutItem);
    currentY += height + gap;
  });

  // 创建 R-tree 项目
  const newBushItems = createBushItems(newLayoutItems);

  return { newLayoutItems, newBushItems };
}

/**
 * 处理列表项目高度更新
 */
export function processListHeightUpdates({
  pendingUpdates,
  idToItemMap,
  allItems,
  gap
}: {
  pendingUpdates: Map<number, number>;
  idToItemMap: Map<any, LayoutItem>;
  allItems: LayoutItem[];
  gap: number;
}): {
  updatedItems: LayoutItem[];
  hasChanges: boolean;
} {
  if (pendingUpdates.size === 0) {
    return { updatedItems: allItems, hasChanges: false };
  }

  const updatesToProcess = new Map(pendingUpdates);
  const updatedItems = [...allItems];
  let hasChanges = false;

  // 按索引排序，确保按顺序处理
  const sortedUpdates = Array.from(updatesToProcess.entries())
    .sort(([a], [b]) => a - b);

  for (const [id, newHeight] of sortedUpdates) {
    const item = idToItemMap.get(id);
    if (!item || item.height === newHeight) {
continue;
}

    // 更新项目高度
    const oldHeight = item.height;
    item.height = newHeight;
    item.maxY = item.y + newHeight;
    hasChanges = true;

    // 重新计算后续项目的位置
    const itemIndex = item.index;
    let currentY = item.y + newHeight + gap;

    for (let i = itemIndex + 1; i < updatedItems.length; i++) {
      const nextItem = updatedItems[i];
      const heightDiff = currentY - nextItem.y;
      
      if (heightDiff !== 0) {
        nextItem.y = currentY;
        nextItem.minY = currentY;
        nextItem.maxY = currentY + nextItem.height;
        hasChanges = true;
      }
      
      currentY = nextItem.y + nextItem.height + gap;
    }
  }

  return { updatedItems, hasChanges };
}

/**
 * 查找列表中的可见项目
 */
export function findListVisibleItems({
  sortedItems,
  viewport,
  containerWidth
}: {
  sortedItems: LayoutItem[];
  viewport: { top: number; height: number };
  containerWidth: number;
}): LayoutItem[] {
  const { top, height } = viewport;
  const bottom = top + height;
  
  return findItemsInYRange(sortedItems, top, bottom);
}

/**
 * 查找选择框内的项目
 */
export function findItemsInSelectionBox({
  tree,
  box
}: {
  tree: RBush<BushItem>;
  box: { x: number; y: number; width: number; height: number };
}): LayoutItem[] {
  const bushItems = tree.search({
    minX: box.x,
    minY: box.y,
    maxX: box.x + box.width,
    maxY: box.y + box.height
  });
  
  return bushItems.map(bushItem => bushItem);
}
