import type { SpatialData, SpatialCache, Rect, Point } from './types';
import { convertDOMRectToRect, computeRectCenter, computeRectArea } from './spatial-utils';

// 创建空间缓存
export const createSpatialCache = (): SpatialCache => ({
  data: new WeakMap(),
  lastUpdate: 0,
  dirtyElements: new Set(),
});

// 检查缓存是否有效
export const isCacheValid = (spatialData: SpatialData, maxAge: number): boolean => {
  const now = performance.now();
  return !spatialData.dirty && (now - spatialData.timestamp) < maxAge;
};

// 标记元素为脏状态
export const markElementDirty = (cache: SpatialCache, element: Element): void => {
  cache.dirtyElements.add(element);
  const spatialData = cache.data.get(element);
  if (spatialData) {
    spatialData.dirty = true;
  }
};

// 获取元素的空间数据
export const getElementSpatialData = (
  cache: SpatialCache, 
  element: Element, 
  maxAge: number = 16
): SpatialData | null => {
  const spatialData = cache.data.get(element);
  
  if (spatialData && isCacheValid(spatialData, maxAge)) {
    return spatialData;
  }
  
  return null;
};

// 更新元素的空间数据
export const updateElementSpatialData = (
  cache: SpatialCache, 
  element: Element
): SpatialData => {
  const domRect = element.getBoundingClientRect();
  const rect = convertDOMRectToRect(domRect);
  const center = computeRectCenter(rect);
  const area = computeRectArea(rect);
  
  const spatialData: SpatialData = {
    element,
    rect,
    center,
    area,
    timestamp: performance.now(),
    dirty: false,
  };
  
  cache.data.set(element, spatialData);
  cache.dirtyElements.delete(element);
  
  return spatialData;
};

// 批量更新空间数据
export const batchUpdateSpatialData = (
  cache: SpatialCache, 
  elements: Element[]
): void => {
  const now = performance.now();
  
  elements.forEach(element => {
    const spatialData = updateElementSpatialData(cache, element);
    spatialData.timestamp = now;
  });
  
  cache.lastUpdate = now;
};

// 清理过期的缓存数据
export const cleanupExpiredCache = (
  cache: SpatialCache, 
  maxAge: number = 60000
): void => {
  const now = performance.now();
  const expiredElements: Element[] = [];
  
  // 注意：WeakMap无法遍历，这里只能清理已知的元素
  cache.dirtyElements.forEach(element => {
    const spatialData = cache.data.get(element);
    if (spatialData && (now - spatialData.timestamp) > maxAge) {
      expiredElements.push(element);
    }
  });
  
  expiredElements.forEach(element => {
    cache.data.delete(element);
    cache.dirtyElements.delete(element);
  });
};

// 获取脏元素列表
export const getDirtyElements = (cache: SpatialCache): Element[] => {
  return Array.from(cache.dirtyElements);
};

// 检查缓存是否需要更新
export const shouldUpdateCache = (cache: SpatialCache, minInterval: number = 16): boolean => {
  const now = performance.now();
  return (now - cache.lastUpdate) >= minInterval;
};

// 预加载元素的空间数据
export const preloadSpatialData = (
  cache: SpatialCache, 
  elements: Element[]
): void => {
  requestIdleCallback(() => {
    batchUpdateSpatialData(cache, elements);
  });
};

// 获取缓存统计信息
export const getCacheStats = (cache: SpatialCache): {
  totalElements: number;
  dirtyElements: number;
  lastUpdate: number;
} => {
  // 注意：WeakMap无法获取size，这里只能返回部分信息
  return {
    totalElements: 0, // WeakMap无法统计
    dirtyElements: cache.dirtyElements.size,
    lastUpdate: cache.lastUpdate,
  };
}; 