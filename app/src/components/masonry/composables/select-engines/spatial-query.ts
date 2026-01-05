import type { 
  Rect, 
  SpatialQueryOptions, 
  SpatialQueryResult, 
  IntersectionType,
  SpatialCache,
  SpatialHashGrid 
} from "./types";
import { 
  isRectIntersecting, 
  isRectContaining, 
  getIntersectionType,
  computeIntersectionArea 
} from "./spatial-utils";
import { 
  getElementSpatialData, 
  updateElementSpatialData,
  shouldUpdateCache 
} from "./spatial-cache";
import { 
  queryIntersectingElements,
  getBlocksInArea 
} from "./spatial-hash";

// 查询与指定矩形相交的元素
export const queryIntersectingElementsWithCache = (
  cache: SpatialCache,
  grid: SpatialHashGrid,
  elements: Element[],
  queryRect: Rect,
  options: SpatialQueryOptions
): Element[] => {
  // 使用空间哈希进行粗筛
  const candidateElements = queryIntersectingElements(grid, queryRect);
  
  // 使用缓存进行精确筛选
  const intersectingElements: Element[] = [];
  
  candidateElements.forEach(element => {
    let spatialData = getElementSpatialData(cache, element, options.updateInterval);
    
    if (!spatialData) {
      spatialData = updateElementSpatialData(cache, element);
    }
    
    if (isRectIntersecting(spatialData.rect, queryRect)) {
      intersectingElements.push(element);
    }
  });
  
  return intersectingElements;
};

// 查询完全包含在指定矩形内的元素
export const queryContainedElements = (
  cache: SpatialCache,
  grid: SpatialHashGrid,
  elements: Element[],
  queryRect: Rect,
  options: SpatialQueryOptions
): Element[] => {
  const intersectingElements = queryIntersectingElementsWithCache(
    cache, grid, elements, queryRect, options
  );
  
  const containedElements: Element[] = [];
  
  intersectingElements.forEach(element => {
    const spatialData = getElementSpatialData(cache, element, options.updateInterval);
    if (spatialData && isRectContaining(queryRect, spatialData.rect)) {
      containedElements.push(element);
    }
  });
  
  return containedElements;
};

// 查询部分相交的元素
export const queryPartialElements = (
  cache: SpatialCache,
  grid: SpatialHashGrid,
  elements: Element[],
  queryRect: Rect,
  options: SpatialQueryOptions
): Element[] => {
  const intersectingElements = queryIntersectingElementsWithCache(
    cache, grid, elements, queryRect, options
  );
  
  const partialElements: Element[] = [];
  
  intersectingElements.forEach(element => {
    const spatialData = getElementSpatialData(cache, element, options.updateInterval);
    if (spatialData) {
      const intersectionType = getIntersectionType(queryRect, spatialData.rect);
      if (intersectionType === "intersecting") {
        partialElements.push(element);
      }
    }
  });
  
  return partialElements;
};

// 执行完整的空间查询
export const executeSpatialQuery = (
  cache: SpatialCache,
  grid: SpatialHashGrid,
  elements: Element[],
  queryRect: Rect,
  options: SpatialQueryOptions
): SpatialQueryResult => {
  // 检查是否需要更新缓存
  if (shouldUpdateCache(cache, options.updateInterval)) {
    // 批量更新可见元素的空间数据
    const visibleElements = queryIntersectingElements(grid, queryRect);
    visibleElements.forEach(element => {
      updateElementSpatialData(cache, element);
    });
  }
  
  const intersectingElements = queryIntersectingElementsWithCache(
    cache, grid, elements, queryRect, options
  );
  
  const containedElements = queryContainedElements(
    cache, grid, elements, queryRect, options
  );
  
  const partialElements = queryPartialElements(
    cache, grid, elements, queryRect, options
  );
  
  return {
    elements,
    intersectingElements,
    containedElements,
    partialElements,
  };
};

// 查询指定点附近的元素
export const queryElementsNearPoint = (
  cache: SpatialCache,
  grid: SpatialHashGrid,
  elements: Element[],
  point: { x: number; y: number },
  radius: number,
  options: SpatialQueryOptions
): Element[] => {
  const queryRect: Rect = {
    left: point.x - radius,
    top: point.y - radius,
    right: point.x + radius,
    bottom: point.y + radius,
    width: radius * 2,
    height: radius * 2,
  };
  
  const candidateElements = queryIntersectingElementsWithCache(
    cache, grid, elements, queryRect, options
  );
  
  // 精确计算距离
  const nearbyElements: Element[] = [];
  
  candidateElements.forEach(element => {
    const spatialData = getElementSpatialData(cache, element, options.updateInterval);
    if (spatialData) {
      const center = spatialData.center;
      const distance = Math.sqrt(
        Math.pow(center.x - point.x, 2) + Math.pow(center.y - point.y, 2)
      );
      
      if (distance <= radius) {
        nearbyElements.push(element);
      }
    }
  });
  
  return nearbyElements;
};

// 查询交集面积超过阈值的元素
export const queryElementsByIntersectionArea = (
  cache: SpatialCache,
  grid: SpatialHashGrid,
  elements: Element[],
  queryRect: Rect,
  minArea: number,
  options: SpatialQueryOptions
): Element[] => {
  const intersectingElements = queryIntersectingElementsWithCache(
    cache, grid, elements, queryRect, options
  );
  
  const qualifiedElements: Element[] = [];
  
  intersectingElements.forEach(element => {
    const spatialData = getElementSpatialData(cache, element, options.updateInterval);
    if (spatialData) {
      const intersectionArea = computeIntersectionArea(queryRect, spatialData.rect);
      if (intersectionArea >= minArea) {
        qualifiedElements.push(element);
      }
    }
  });
  
  return qualifiedElements;
};

// 获取查询区域的统计信息
export const getQueryStats = (
  cache: SpatialCache,
  grid: SpatialHashGrid,
  queryRect: Rect
): {
  totalCandidates: number;
  totalIntersecting: number;
  totalContained: number;
  totalPartial: number;
  cacheHitRate: number;
} => {
  const candidates = queryIntersectingElements(grid, queryRect);
  let cacheHits = 0;
  let intersecting = 0;
  let contained = 0;
  let partial = 0;
  
  candidates.forEach(element => {
    const spatialData = getElementSpatialData(cache, element);
    if (spatialData) {
      cacheHits++;
      
      if (isRectIntersecting(spatialData.rect, queryRect)) {
        intersecting++;
        
        const intersectionType = getIntersectionType(queryRect, spatialData.rect);
        if (intersectionType === "contained") {
          contained++;
        } else if (intersectionType === "intersecting") {
          partial++;
        }
      }
    }
  });
  
  return {
    totalCandidates: candidates.length,
    totalIntersecting: intersecting,
    totalContained: contained,
    totalPartial: partial,
    cacheHitRate: candidates.length > 0 ? cacheHits / candidates.length : 0,
  };
}; 