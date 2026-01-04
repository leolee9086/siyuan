// 空间选择器主入口

// 类型导出
export type {
  Rect,
  Point,
  SpatialData,
  SpatialQueryOptions,
  SpatialQueryResult,
  IntersectionType,
  BlockData,
  SpatialCache,
  SpatialHashGrid,
} from './types';

// 空间计算工具
export {
  convertDOMRectToRect,
  computeRectCenter,
  computeRectArea,
  isRectIntersecting,
  isRectContaining,
  computeRectIntersection,
  computeIntersectionArea,
  getIntersectionType,
  isPointInRect,
  computePointToRectDistance,
  mergeRects,
} from './spatial-utils';

// 空间缓存系统
export {
  createSpatialCache,
  isCacheValid,
  markElementDirty,
  getElementSpatialData,
  updateElementSpatialData,
  batchUpdateSpatialData,
  cleanupExpiredCache,
  getDirtyElements,
  shouldUpdateCache,
  preloadSpatialData,
  getCacheStats,
} from './spatial-cache';

// 空间哈希索引
export {
  createSpatialHashGrid,
  computeGridBlocks,
  addElementToSpatialHash,
  removeElementFromSpatialHash,
  updateElementInSpatialHash,
  queryIntersectingElements,
  updateGridBounds,
  getGridStats,
  cleanupEmptyBlocks,
  rebuildSpatialHash,
  getBlocksInArea,
} from './spatial-hash';

// 空间查询核心
export {
  queryIntersectingElementsWithCache,
  queryContainedElements,
  queryPartialElements,
  executeSpatialQuery,
  queryElementsNearPoint,
  queryElementsByIntersectionArea,
  getQueryStats,
} from './spatial-query';

// 导入用于内部使用
import type { Rect, Point, SpatialQueryOptions } from './types';
import { createSpatialCache } from './spatial-cache';
import { createSpatialHashGrid, addElementToSpatialHash, removeElementFromSpatialHash, updateElementInSpatialHash, rebuildSpatialHash, cleanupEmptyBlocks, getGridStats } from './spatial-hash';
import { updateElementSpatialData, cleanupExpiredCache, getCacheStats } from './spatial-cache';
import { queryIntersectingElementsWithCache, queryContainedElements, queryPartialElements, executeSpatialQuery, queryElementsNearPoint } from './spatial-query';

// 创建默认配置的空间选择器
export const createDefaultSpatialSelector = () => {
  const cache = createSpatialCache();
  const grid = createSpatialHashGrid(100);
  
  const defaultOptions: SpatialQueryOptions = {
    cacheStrategy: 'weak',
    updateInterval: 16,
    blockSize: 100,
    useVirtualization: true,
    intersectionThreshold: 0.1,
  };
  
  return {
    cache,
    grid,
    options: defaultOptions,
    
    // 便捷方法
    queryIntersecting: (elements: Element[], queryRect: Rect) =>
      queryIntersectingElementsWithCache(cache, grid, elements, queryRect, defaultOptions),
    
    queryContained: (elements: Element[], queryRect: Rect) =>
      queryContainedElements(cache, grid, elements, queryRect, defaultOptions),
    
    queryPartial: (elements: Element[], queryRect: Rect) =>
      queryPartialElements(cache, grid, elements, queryRect, defaultOptions),
    
    queryNearPoint: (elements: Element[], point: Point, radius: number) =>
      queryElementsNearPoint(cache, grid, elements, point, radius, defaultOptions),
    
    executeQuery: (elements: Element[], queryRect: Rect) =>
      executeSpatialQuery(cache, grid, elements, queryRect, defaultOptions),
    
    // 管理方法
    addElement: (element: Element, rect: Rect) => {
      addElementToSpatialHash(grid, element, rect);
      updateElementSpatialData(cache, element);
    },
    
    removeElement: (element: Element) => {
      removeElementFromSpatialHash(grid, element);
    },
    
    updateElement: (element: Element, oldRect: Rect, newRect: Rect) => {
      updateElementInSpatialHash(grid, element, oldRect, newRect);
      updateElementSpatialData(cache, element);
    },
    
    rebuild: (elements: Element[], getRect: (element: Element) => Rect) => {
      rebuildSpatialHash(grid, elements, getRect);
      elements.forEach(element => {
        updateElementSpatialData(cache, element);
      });
    },
    
    cleanup: () => {
      cleanupEmptyBlocks(grid);
      cleanupExpiredCache(cache);
    },
    
    getStats: () => ({
      cache: getCacheStats(cache),
      grid: getGridStats(grid),
    }),
  };
}; 