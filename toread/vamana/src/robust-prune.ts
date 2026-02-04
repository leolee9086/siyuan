/**
 * RobustPrune剪枝算法模块
 * 实现Vamana图构建中的RobustPrune剪枝策略
 * 参考C++版本的occlude_list函数实现
 */

import { VamanaNode } from './types';
import { DistanceCache, DistanceConfig, computeDistance, computeDistanceFromIds } from './distance.js';

export interface SearchCandidate {
  id: number;
  distance: number;
}

/**
 * 计算候选节点到目标节点的距离并排序
 * 
 * @param nodeId 目标节点ID
 * @param candidateIds 候选节点ID列表
 * @param nodes 节点数组
 * @param distanceCache 距离缓存
 * @param distanceConfig 距离配置
 * @returns 按距离排序的候选节点列表
 */
function computeSortedCandidates(
  nodeId: number,
  candidateIds: number[],
  nodes: VamanaNode[],
  distanceCache: DistanceCache,
  distanceConfig: DistanceConfig
): SearchCandidate[] {
  const candidates: SearchCandidate[] = [];
  
  for (const candidateId of candidateIds) {
    if (candidateId !== nodeId && candidateId < nodes.length) {
      const distance = computeDistanceFromIds(nodeId, candidateId, nodes, distanceCache, distanceConfig);
      candidates.push({ id: candidateId, distance });
    }
  }

  // 按距离排序
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates;
}

/**
 * 计算L2或Cosine距离的剪枝条件
 * 
 * @param otherCandidate 其他候选节点
 * @param djk 两个候选节点间的距离
 * @param currentOccludeFactor 当前的遮挡因子
 * @returns 更新后的遮挡因子
 */
function computeL2CosineOccludeFactor(
  otherCandidate: SearchCandidate,
  djk: number,
  currentOccludeFactor: number
): number {
  if (djk === 0) {
    return Infinity; // 避免除零
  } else {
    return Math.max(currentOccludeFactor, otherCandidate.distance / djk);
  }
}

/**
 * 计算内积距离的剪枝条件
 * 
 * @param otherCandidate 其他候选节点
 * @param djk 两个候选节点间的距离
 * @param curAlpha 当前alpha值
 * @param eps epsilon值
 * @param currentOccludeFactor 当前的遮挡因子
 * @returns 更新后的遮挡因子
 */
function computeInnerProductOccludeFactor(
  otherCandidate: SearchCandidate,
  djk: number,
  curAlpha: number,
  eps: number,
  currentOccludeFactor: number
): number {
  const x = -otherCandidate.distance;
  const y = -djk;
  if (y > curAlpha * x) {
    return Math.max(currentOccludeFactor, eps);
  }
  return currentOccludeFactor;
}

/**
 * 根据距离函数类型计算剪枝条件
 * 
 * @param distanceConfig 距离配置
 * @param otherCandidate 其他候选节点
 * @param djk 两个候选节点间的距离
 * @param curAlpha 当前alpha值
 * @param eps epsilon值
 * @param currentOccludeFactor 当前的遮挡因子
 * @returns 更新后的遮挡因子
 */
function computeOccludeFactor(
  distanceConfig: DistanceConfig,
  otherCandidate: SearchCandidate,
  djk: number,
  curAlpha: number,
  eps: number,
  currentOccludeFactor: number
): number {
  if (distanceConfig.distanceFunction === 'euclidean' || distanceConfig.distanceFunction === 'cosine') {
    return computeL2CosineOccludeFactor(otherCandidate, djk, currentOccludeFactor);
  } else if (distanceConfig.distanceFunction === 'inner_product') {
    return computeInnerProductOccludeFactor(otherCandidate, djk, curAlpha, eps, currentOccludeFactor);
  }
  return currentOccludeFactor;
}

/**
 * 执行单轮剪枝操作
 * 
 * @param candidates 候选节点列表
 * @param occludeFactor 遮挡因子数组
 * @param curAlpha 当前alpha值
 * @param alpha 最大alpha值
 * @param degree 目标度数
 * @param maxc 最大候选数量
 * @param nodes 节点数组
 * @param distanceCache 距离缓存
 * @param distanceConfig 距离配置
 * @returns 本轮选择的节点ID列表
 */
function executePruningRound(
  candidates: SearchCandidate[],
  occludeFactor: number[],
  curAlpha: number,
  alpha: number,
  degree: number,
  maxc: number,
  nodes: VamanaNode[],
  distanceCache: DistanceCache,
  distanceConfig: DistanceConfig
): number[] {
  const result: number[] = [];
  let start = 0;
  const eps = curAlpha + 0.01; // 用于MIPS的epsilon值
  // 在当前alpha值下选择节点，使用maxc参数控制候选数量
  while (result.length < degree && start < candidates.length && start < maxc) {
    const candidate = candidates[start];
    // 检查是否被之前的alpha值剪枝
    if (occludeFactor[start] > curAlpha) {
      start++;
      continue;
    }
    // 选择这个节点
    occludeFactor[start] = Infinity;
    result.push(candidate.id);
    // 剪枝被这个节点覆盖的其他候选，使用maxc参数
    for (let t = start + 1; t < candidates.length && t < maxc; t++) {
      if (occludeFactor[t] > alpha) continue;
      
      const otherCandidate = candidates[t];
      const djk = computeDistanceFromIds(candidate.id, otherCandidate.id, nodes, distanceCache, distanceConfig);
      
      occludeFactor[t] = computeOccludeFactor(
        distanceConfig,
        otherCandidate,
        djk,
        curAlpha,
        eps,
        occludeFactor[t]
      );
    }
    start++;
  }
  
  return result;
}

/**
 * 正确的RobustPrune算法实现
 * 参考C++版本的occlude_list函数
 * 
 * 算法流程：
 * 1. 对候选集按距离排序
 * 2. 使用递增的alpha值进行多轮剪枝
 * 3. 每轮选择最近的节点，然后剪枝被覆盖的节点
 * 
 * @param nodeId 当前节点ID
 * @param candidateIds 候选节点ID列表
 * @param alpha 剪枝参数
 * @param degree 目标度数
 * @param maxc 最大候选数量（与C++版本保持一致）
 * @param nodes 节点数组
 * @param distanceCache 距离缓存
 * @param distanceConfig 距离配置
 * @returns 剪枝后的邻居ID列表
 */
export function robustPruneStandard(
  nodeId: number,
  candidateIds: number[],
  alpha: number,
  degree: number,
  maxc: number,
  nodes: VamanaNode[],
  distanceCache: DistanceCache,
  distanceConfig: DistanceConfig
): number[] {
  if (candidateIds.length === 0) return [];
  // 步骤1: 计算所有候选节点到当前节点的距离并排序
  const candidates = computeSortedCandidates(nodeId, candidateIds, nodes, distanceCache, distanceConfig);
  const result: number[] = [];
  let resultCount = 0;
  const occludeFactor = new Array(candidates.length).fill(0);
  let curAlpha = 1.0;
  // 多轮剪枝，直到达到目标数量或候选集为空
  while (curAlpha <= alpha && resultCount < degree) {
    const roundResult = executePruningRound(
      candidates,
      occludeFactor,
      curAlpha,
      alpha,
      degree - resultCount,
      maxc,
      nodes,
      distanceCache,
      distanceConfig
    ); 
    result.push(...roundResult);
    resultCount += roundResult.length;
    // 增加alpha值
    curAlpha *= 1.2;
  }  
  return result;
}

