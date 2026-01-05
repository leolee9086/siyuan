import type { Rect, BlockData } from "./types";
import { isRectIntersecting } from "./spatial-utils";

// 空间哈希网格
export interface SpatialHashGrid {
  blockSize: number;
  blocks: Map<string, Element[]>;
  bounds: Rect | null;
}

// 创建空间哈希网格
export const createSpatialHashGrid = (blockSize: number = 100): SpatialHashGrid => ({
  blockSize,
  blocks: new Map(),
  bounds: null,
});

// 计算元素所属的网格块
export const computeGridBlocks = (
  rect: Rect, 
  blockSize: number
): string[] => {
  const startX = Math.floor(rect.left / blockSize);
  const endX = Math.floor(rect.right / blockSize);
  const startY = Math.floor(rect.top / blockSize);
  const endY = Math.floor(rect.bottom / blockSize);
  
  const blocks: string[] = [];
  
  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      blocks.push(`${x},${y}`);
    }
  }
  
  return blocks;
};

// 添加元素到空间哈希
export const addElementToSpatialHash = (
  grid: SpatialHashGrid, 
  element: Element, 
  rect: Rect
): void => {
  const blockKeys = computeGridBlocks(rect, grid.blockSize);
  
  blockKeys.forEach(key => {
    if (!grid.blocks.has(key)) {
      grid.blocks.set(key, []);
    }
    grid.blocks.get(key)!.push(element);
  });
  
  // 更新边界
  updateGridBounds(grid, rect);
};

// 从空间哈希中移除元素
export const removeElementFromSpatialHash = (
  grid: SpatialHashGrid, 
  element: Element
): void => {
  grid.blocks.forEach((elements, key) => {
    const index = elements.indexOf(element);
    if (index !== -1) {
      elements.splice(index, 1);
      if (elements.length === 0) {
        grid.blocks.delete(key);
      }
    }
  });
};

// 更新元素在空间哈希中的位置
export const updateElementInSpatialHash = (
  grid: SpatialHashGrid, 
  element: Element, 
  oldRect: Rect, 
  newRect: Rect
): void => {
  removeElementFromSpatialHash(grid, element);
  addElementToSpatialHash(grid, element, newRect);
};

// 查询与指定矩形相交的元素
export const queryIntersectingElements = (
  grid: SpatialHashGrid, 
  queryRect: Rect
): Element[] => {
  const blockKeys = computeGridBlocks(queryRect, grid.blockSize);
  const candidateElements = new Set<Element>();
  
  blockKeys.forEach(key => {
    const elements = grid.blocks.get(key);
    if (elements) {
      elements.forEach(element => candidateElements.add(element));
    }
  });
  
  return Array.from(candidateElements);
};

// 更新网格边界
export const updateGridBounds = (grid: SpatialHashGrid, rect: Rect): void => {
  if (!grid.bounds) {
    grid.bounds = { ...rect };
    return;
  }
  
  grid.bounds.left = Math.min(grid.bounds.left, rect.left);
  grid.bounds.top = Math.min(grid.bounds.top, rect.top);
  grid.bounds.right = Math.max(grid.bounds.right, rect.right);
  grid.bounds.bottom = Math.max(grid.bounds.bottom, rect.bottom);
  grid.bounds.width = grid.bounds.right - grid.bounds.left;
  grid.bounds.height = grid.bounds.bottom - grid.bounds.top;
};

// 获取网格统计信息
export const getGridStats = (grid: SpatialHashGrid): {
  totalBlocks: number;
  totalElements: number;
  averageElementsPerBlock: number;
} => {
  let totalElements = 0;
  
  grid.blocks.forEach(elements => {
    totalElements += elements.length;
  });
  
  return {
    totalBlocks: grid.blocks.size,
    totalElements,
    averageElementsPerBlock: grid.blocks.size > 0 ? totalElements / grid.blocks.size : 0,
  };
};

// 清理空的网格块
export const cleanupEmptyBlocks = (grid: SpatialHashGrid): void => {
  const emptyKeys: string[] = [];
  
  grid.blocks.forEach((elements, key) => {
    if (elements.length === 0) {
      emptyKeys.push(key);
    }
  });
  
  emptyKeys.forEach(key => {
    grid.blocks.delete(key);
  });
};

// 重建空间哈希
export const rebuildSpatialHash = (
  grid: SpatialHashGrid, 
  elements: Element[], 
  getRect: (element: Element) => Rect
): void => {
  grid.blocks.clear();
  grid.bounds = null;
  
  elements.forEach(element => {
    const rect = getRect(element);
    addElementToSpatialHash(grid, element, rect);
  });
};

// 获取指定区域内的所有块
export const getBlocksInArea = (
  grid: SpatialHashGrid, 
  area: Rect
): BlockData[] => {
  const blockKeys = computeGridBlocks(area, grid.blockSize);
  const blocks: BlockData[] = [];
  
  blockKeys.forEach(key => {
    const elements = grid.blocks.get(key);
    if (elements && elements.length > 0) {
      const [x, y] = key.split(",").map(Number);
      const bounds: Rect = {
        left: x * grid.blockSize,
        top: y * grid.blockSize,
        right: (x + 1) * grid.blockSize,
        bottom: (y + 1) * grid.blockSize,
        width: grid.blockSize,
        height: grid.blockSize,
      };
      
      blocks.push({ key, elements, bounds });
    }
  });
  
  return blocks;
}; 