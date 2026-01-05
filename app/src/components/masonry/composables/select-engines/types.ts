// 空间选择器类型定义

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface SpatialData {
  element: Element;
  rect: Rect;
  center: Point;
  area: number;
  timestamp: number;
  dirty: boolean;
}

export interface SpatialQueryOptions {
  cacheStrategy: "none" | "weak" | "strong";
  updateInterval: number;
  blockSize: number;
  useVirtualization: boolean;
  intersectionThreshold: number;
}

export interface SpatialQueryResult {
  elements: Element[];
  intersectingElements: Element[];
  containedElements: Element[];
  partialElements: Element[];
}

export type IntersectionType = "none" | "intersecting" | "contained" | "partial";

export interface BlockData {
  key: string;
  elements: Element[];
  bounds: Rect;
}

export interface SpatialCache {
  data: WeakMap<Element, SpatialData>;
  lastUpdate: number;
  dirtyElements: Set<Element>;
}

export interface SpatialHashGrid {
  blockSize: number;
  blocks: Map<string, Element[]>;
  bounds: Rect | null;
} 