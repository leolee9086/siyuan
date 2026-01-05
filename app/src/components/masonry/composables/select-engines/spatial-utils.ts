import type { Rect, Point, IntersectionType } from "./types";

// 将DOMRect转换为Rect
export const convertDOMRectToRect = (domRect: DOMRect): Rect => ({
  left: domRect.left,
  top: domRect.top,
  right: domRect.right,
  bottom: domRect.bottom,
  width: domRect.width,
  height: domRect.height,
});

// 计算矩形的中心点
export const computeRectCenter = (rect: Rect): Point => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

// 计算矩形的面积
export const computeRectArea = (rect: Rect): number => rect.width * rect.height;

// 检查两个矩形是否相交
export const isRectIntersecting = (rect1: Rect, rect2: Rect): boolean => {
  return !(rect1.right < rect2.left || 
           rect1.left > rect2.right || 
           rect1.bottom < rect2.top || 
           rect1.top > rect2.bottom);
};

// 检查矩形1是否完全包含矩形2
export const isRectContaining = (rect1: Rect, rect2: Rect): boolean => {
  return rect1.left <= rect2.left && 
         rect1.top <= rect2.top && 
         rect1.right >= rect2.right && 
         rect1.bottom >= rect2.bottom;
};

// 计算两个矩形的交集
export const computeRectIntersection = (rect1: Rect, rect2: Rect): Rect | null => {
  if (!isRectIntersecting(rect1, rect2)) {
return null;
}
  
  const left = Math.max(rect1.left, rect2.left);
  const top = Math.max(rect1.top, rect2.top);
  const right = Math.min(rect1.right, rect2.right);
  const bottom = Math.min(rect1.bottom, rect2.bottom);
  
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
};

// 计算交集面积
export const computeIntersectionArea = (rect1: Rect, rect2: Rect): number => {
  const intersection = computeRectIntersection(rect1, rect2);
  return intersection ? computeRectArea(intersection) : 0;
};

// 判断交集类型
export const getIntersectionType = (rect1: Rect, rect2: Rect): IntersectionType => {
  if (!isRectIntersecting(rect1, rect2)) {
return "none";
}
  if (isRectContaining(rect1, rect2)) {
return "contained";
}
  
  const intersectionArea = computeIntersectionArea(rect1, rect2);
  const rect2Area = computeRectArea(rect2);
  
  // 如果交集面积超过90%，认为是包含关系
  if (intersectionArea / rect2Area > 0.9) {
return "contained";
}
  
  return "intersecting";
};

// 检查点是否在矩形内
export const isPointInRect = (point: Point, rect: Rect): boolean => {
  return point.x >= rect.left && 
         point.x <= rect.right && 
         point.y >= rect.top && 
         point.y <= rect.bottom;
};

// 计算点到矩形的距离
export const computePointToRectDistance = (point: Point, rect: Rect): number => {
  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
  return Math.sqrt(dx * dx + dy * dy);
};

// 合并多个矩形
export const mergeRects = (rects: Rect[]): Rect | null => {
  if (rects.length === 0) {
return null;
}
  
  let left = rects[0].left;
  let top = rects[0].top;
  let right = rects[0].right;
  let bottom = rects[0].bottom;
  
  for (let i = 1; i < rects.length; i++) {
    const rect = rects[i];
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }
  
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}; 