/**
 * 距离计算模块
 * 提供高性能的距离计算和缓存功能
 */

// 导出类型定义
export type { 
  DistanceFunction,
  CustomDistanceFunction,
  DistanceConfig,
  LRUNode
} from './types';

// 导出距离计算函数
export {
  calculateSqNorm,
  computeEuclideanDistance,
  computeCosineDistance,
  computeInnerProductDistance,
  computeDistance
} from './functions';

// 导出距离缓存
export { DistanceCache } from './cache';

// 导出工具函数
export { computeDistanceFromIds } from './utils';