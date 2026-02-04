/**
 * 距离计算工具函数
 */

import { DistanceConfig } from './types';
import { DistanceCache } from './cache';
import { computeDistance } from './functions';

/**
 * 基于节点ID计算距离的工具函数
 * 支持使用预计算的范数进行优化
 * 
 * @param id1 第一个节点ID
 * @param id2 第二个节点ID
 * @param nodes 节点数组
 * @param distanceCache 距离缓存
 * @param distanceConfig 距离配置
 * @returns 两个节点间的距离
 */
export function computeDistanceFromIds(
  id1: number, 
  id2: number, 
  nodes: any[], 
  distanceCache: DistanceCache, 
  distanceConfig: DistanceConfig
): number {
  if (id1 === id2) return 0;
  return distanceCache.getCachedDistance(id1, id2, (a, b) => {
    const nodeA = nodes[a];
    const nodeB = nodes[b];
    return computeDistance(
      nodeA.vector, 
      nodeB.vector, 
      distanceConfig,
      nodeA.sqNorm,
      nodeB.sqNorm
    );
  }, distanceConfig.distanceFunction);
}