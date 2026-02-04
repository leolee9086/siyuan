/**
 * 图搜索模块
 * 提供高性能的图搜索算法
 */

import { DistanceConfig, DistanceCache, computeDistance, computeDistanceFromIds } from './distance.js';
import { calculateSqNorm } from './utils/norms';
import { findCentroid } from './utils/centroid';
import { findMedoid } from './build/findMedoid';
import type { VamanaNode } from './types';

export interface SearchCandidate {
  id: number;
  distance: number;
  flag?: boolean; // 用于标记是否需要扩展
}

export interface SearchResult {
  candidates: SearchCandidate[];
  visited: Uint8Array; // 使用Uint8Array替代Set<number>以提高性能
  visitedNodeCount: number; // 新增：实际访问的节点数量
}

// 节点状态枚举
enum NodeState {
  UNVISITED = 0,    // 未访问
  VISITED = 1,      // 已访问
  IN_CANDIDATES = 2 // 在候选集中
}

// ================ 辅助函数 ================
const { VISITED, IN_CANDIDATES, UNVISITED } = NodeState;


// ================ 图搜索算法 ================


export function greedySearchMultiStart(
  queryVector: Float32Array,
  startNodeIds: number[], // 支持多个起始点
  beamSize: number,
  nodes: VamanaNode[],
  distanceConfig: DistanceConfig
): SearchResult {

  if (nodes.length === 0 || startNodeIds.length === 0) {
    return { candidates: [], visited: new Uint8Array(0), visitedNodeCount: 0 };
  }

  // 预计算查询向量的平方范数，避免重复计算
  const querySqNorm = calculateSqNorm(queryVector);

  // 使用Uint8Array表示节点状态，复用visited数组
  const visited = new Uint8Array(nodes.length);
  let visitedNodeCount = 0; // 新增：实际访问的节点数量

  // 使用有序数组管理候选集，限制大小为beamSize
  const candidates: SearchCandidate[] = [];
  let candidateCount = 0;

  // 添加所有起始节点
  for (const startNodeId of startNodeIds) {
    if (startNodeId >= nodes.length) continue;

    // 查询阶段：直接计算距离，不使用缓存
    const initialDistance = computeDistance(
      queryVector,
      nodes[startNodeId].vector,
      distanceConfig,
      querySqNorm,
      nodes[startNodeId].sqNorm
    );

    // 插入到有序位置
    insertCandidate(candidates, { id: startNodeId, distance: initialDistance, flag: true }, beamSize);
    candidateCount = Math.min(candidateCount + 1, beamSize);

    // 标记为在候选集中
    if (visited[startNodeId] === UNVISITED) { // 只有未访问过的节点才增加计数
      visited[startNodeId] = IN_CANDIDATES;
      visitedNodeCount++;
    }
  }

  let currentIndex = 0;
  // 主循环：处理需要扩展的节点
  while (currentIndex < candidateCount) {
    const currentCandidate = candidates[currentIndex];
    if (currentCandidate.flag) {
      currentCandidate.flag = false;
      const currentId = currentCandidate.id;
      // 标记为已访问
      if (visited[currentId] !== VISITED) { // 只有未标记为已访问的节点才增加计数
        visited[currentId] = VISITED;
        // visitedNodeCount++; // 已经在IN_CANDIDATES时计数，这里不再重复计数
      }
      // 探索当前节点的邻居
      const currentNode = nodes[currentId];
      for (const neighborId of currentNode.neighbors) {
        if (neighborId >= nodes.length) continue;
        // 检查邻居是否已经处理过
        if (visited[neighborId] === UNVISITED) {
          // 查询阶段：直接计算距离，不使用缓存
          const distance = computeDistance(
            queryVector,
            nodes[neighborId].vector,
            distanceConfig,
            querySqNorm,
            nodes[neighborId].sqNorm
          );
          // 尝试插入到候选集
          const inserted = insertCandidate(candidates, { id: neighborId, distance, flag: true }, beamSize);
          if (inserted) {
            candidateCount = Math.min(candidateCount + 1, beamSize);
            // 标记为在候选集中
            if (visited[neighborId] === UNVISITED) { // 只有未访问过的节点才增加计数
              visited[neighborId] = IN_CANDIDATES;
              visitedNodeCount++;
            }
          }
        }
      }
    }

    currentIndex++;
  }

  // 过滤掉无效的候选（距离为无穷大的）
  const validCandidates = candidates.filter(c => c.distance < Infinity);

  return {
    candidates: validCandidates,
    visited,
    visitedNodeCount // 返回实际访问的节点数量
  };
}
//@织:函数过长需要拆分
/**
 * 贪婪图搜索算法 - 用于建图阶段的多起始点搜索（使用缓存）
 * 
 * 优化策略：
 * 1. 使用最小堆管理候选集，O(log n)插入/删除
 * 2. 复用visited数组，避免额外的Set结构
 * 3. 对象池减少内存分配
 * 4. 使用距离缓存避免重复计算
 * 5. 改进候选集管理策略
 */
export function greedySearchForBuildingMultiStart(
  nodeId: number, // 当前节点ID
  startNodeIds: number[], // 支持多个起始点
  beamSize: number,
  nodes: VamanaNode[],
  distanceCache: DistanceCache,
  distanceConfig: DistanceConfig,
  globalVisited?: Uint8Array // 新增：全局共享的visited数组
): SearchResult {
  if (nodes.length === 0 || startNodeIds.length === 0) {
    return { candidates: [], visited: new Uint8Array(0), visitedNodeCount: 0 };
  }

  // 使用全局visited数组或创建新的visited数组
  const visited = globalVisited || new Uint8Array(nodes.length);
  let visitedNodeCount = 0; // 新增：实际访问的节点数量

  // 使用有序数组管理候选集，限制大小为beamSize
  const candidates: SearchCandidate[] = [];
  let candidateCount = 0;

  // 添加所有起始节点
  for (const startNodeId of startNodeIds) {
    if (startNodeId >= nodes.length) continue;

    // 建图阶段：使用缓存计算距离
    const initialDistance = computeDistanceFromIds(
      nodeId,
      startNodeId,
      nodes,
      distanceCache,
      distanceConfig
    );

    // 插入到有序位置
    insertCandidate(candidates, { id: startNodeId, distance: initialDistance, flag: true }, beamSize);
    candidateCount = Math.min(candidateCount + 1, beamSize);

    // 标记为在候选集中
    if (visited[startNodeId] === UNVISITED) { // 只有未访问过的节点才增加计数
      visited[startNodeId] = IN_CANDIDATES;
      visitedNodeCount++;
    }
  }

  let currentIndex = 0;

  // 主循环：处理需要扩展的节点
  while (currentIndex < candidateCount) {
    const currentCandidate = candidates[currentIndex];

    if (currentCandidate.flag) {
      currentCandidate.flag = false;
      const currentId = currentCandidate.id;

      // 标记为已访问
      if (visited[currentId] !== VISITED) { // 只有未标记为已访问的节点才增加计数
        visited[currentId] = VISITED;
        // visitedNodeCount++; // 已经在IN_CANDIDATES时计数，这里不再重复计数
      }

      // 探索当前节点的邻居
      const currentNode = nodes[currentId];
      for (const neighborId of currentNode.neighbors) {
        if (neighborId >= nodes.length) continue;

        // 检查邻居是否已经处理过
        if (visited[neighborId] === UNVISITED) {
          // 建图阶段：使用缓存计算距离
          const distance = computeDistanceFromIds(
            nodeId,
            neighborId,
            nodes,
            distanceCache,
            distanceConfig
          );

          // 尝试插入到候选集
          const inserted = insertCandidate(candidates, { id: neighborId, distance, flag: true }, beamSize);
          if (inserted) {
            candidateCount = Math.min(candidateCount + 1, beamSize);
            // 标记为在候选集中
            if (visited[neighborId] === UNVISITED) { // 只有未访问过的节点才增加计数
              visited[neighborId] = IN_CANDIDATES;
              visitedNodeCount++;
            }
          }
        }
      }
    }

    currentIndex++;
  }

  // 过滤掉无效的候选（距离为无穷大的）
  const validCandidates = candidates.filter(c => c.distance < Infinity);

  return {
    candidates: validCandidates,
    visited,
    visitedNodeCount // 返回实际访问的节点数量
  };
}

/**
 * 将候选插入到有序数组中，保持距离排序
 * @param candidates 候选数组
 * @param newCandidate 新候选
 * @param maxSize 最大大小
 * @returns 是否成功插入
 */
function insertCandidate(candidates: SearchCandidate[], newCandidate: SearchCandidate, maxSize: number): boolean {
  // 如果数组未满，直接插入
  if (candidates.length < maxSize) {
    // 使用二分查找找到插入位置
    const insertPos = binarySearchInsertPosition(candidates, newCandidate.distance);

    // 移动元素
    candidates.push(newCandidate);
    for (let i = candidates.length - 1; i > insertPos; i--) {
      candidates[i] = candidates[i - 1];
    }
    candidates[insertPos] = newCandidate;
    return true;
  }

  // 如果数组已满，检查是否可以替换最后一个元素
  if (newCandidate.distance < candidates[candidates.length - 1].distance) {
    // 使用二分查找找到插入位置
    const insertPos = binarySearchInsertPosition(candidates, newCandidate.distance);

    // 移动元素
    for (let i = candidates.length - 1; i > insertPos; i--) {
      candidates[i] = candidates[i - 1];
    }
    candidates[insertPos] = newCandidate;
    return true;
  }

  return false;
}

/**
 * 使用二分查找找到插入位置
 * @param candidates 有序候选数组
 * @param distance 要插入的距离
 * @returns 插入位置
 */
function binarySearchInsertPosition(candidates: SearchCandidate[], distance: number): number {
  let left = 0;
  let right = candidates.length;

  while (left < right) {
    const mid = (left + right) >>> 1; // 使用无符号右移避免溢出
    if (candidates[mid].distance < distance) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left;
}


/**
 * 贪婪图搜索算法 - 建图阶段的单起始点版本（使用缓存）
 * 
 * 优化策略：
 * 1. 使用有序数组而非堆，适用于beamSize较小的情况
 * 2. 正确的终止条件：当没有更多节点需要扩展时停止
 * 3. 高效的候选集管理，避免重复计算
 * 4. 支持frozen point处理
 * 5. 使用Uint8Array优化visited集合性能
 * 6. 使用距离缓存避免重复计算
 */
export function greedySearchForBuilding(
  nodeId: number,
  startNodeId: number,
  beamSize: number,
  nodes: VamanaNode[],
  distanceCache: DistanceCache,
  distanceConfig: DistanceConfig,
  globalVisited?: Uint8Array // 新增：全局共享的visited数组
): SearchResult {
  return greedySearchForBuildingMultiStart(nodeId, [startNodeId], beamSize, nodes, distanceCache, distanceConfig, globalVisited);
}


/**
 * 基于图结构的中位点查找算法
 * 利用图的拓扑结构进行启发式选择
 */
export function findMedoidGraphBased(
  nodes: VamanaNode[],
  distanceCache: DistanceCache,
  distanceConfig: DistanceConfig
): number {
  if (nodes.length === 0) {
    throw new Error('Cannot find medoid for an empty set of nodes.');
  }
  if (nodes.length === 1) {
    return 0;
  }

  // 策略1：选择度数最高的节点作为候选
  let maxDegree = 0;
  let highDegreeCandidates: number[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const degree = nodes[i].neighbors.length;
    if (degree > maxDegree) {
      maxDegree = degree;
      highDegreeCandidates = [i];
    } else if (degree === maxDegree) {
      highDegreeCandidates.push(i);
    }
  }

  // 在高度数候选节点中寻找中位点
  let bestMedoid = highDegreeCandidates[0];
  let minTotalDistance = Infinity;

  for (const candidateId of highDegreeCandidates) {
    let totalDistance = 0;

    // 计算候选节点到所有其他节点的距离
    for (let j = 0; j < nodes.length; j++) {
      if (candidateId !== j) {
        totalDistance += computeDistanceFromIds(candidateId, j, nodes, distanceCache, distanceConfig);
      }
    }

    if (totalDistance < minTotalDistance) {
      minTotalDistance = totalDistance;
      bestMedoid = candidateId;
    }
  }

  return bestMedoid;
}

/**
 * 增量更新中位点
 * 当添加或删除节点时，增量更新中位点而不是重新计算
 */
export function updateMedoidIncremental(
  currentMedoid: number,
  nodes: VamanaNode[],
  distanceCache: DistanceCache,
  distanceConfig: DistanceConfig,
  addedNodes?: number[], // 新添加的节点ID
  removedNodes?: number[] // 被删除的节点ID
): number {
  if (nodes.length === 0) {
    throw new Error('Cannot update medoid for an empty set of nodes.');
  }
  if (nodes.length === 1) {
    return 0;
  }

  // 如果没有变化，直接返回当前中位点
  if ((!addedNodes || addedNodes.length === 0) && (!removedNodes || removedNodes.length === 0)) {
    return currentMedoid;
  }

  // 检查当前中位点是否仍然有效
  if (removedNodes && removedNodes.includes(currentMedoid)) {
    // 当前中位点被删除，需要重新计算
    return findMedoid(nodes);
  }

  // 计算新添加节点到所有其他节点的距离
  const newCandidates = addedNodes || [];
  let bestMedoid = currentMedoid;
  let minTotalDistance = Infinity;

  // 计算当前中位点的总距离
  let currentTotalDistance = 0;
  for (let j = 0; j < nodes.length; j++) {
    if (currentMedoid !== j) {
      currentTotalDistance += computeDistanceFromIds(currentMedoid, j, nodes, distanceCache, distanceConfig);
    }
  }
  minTotalDistance = currentTotalDistance;

  // 检查新候选节点是否更好
  for (const candidateId of newCandidates) {
    let totalDistance = 0;

    for (let j = 0; j < nodes.length; j++) {
      if (candidateId !== j) {
        totalDistance += computeDistanceFromIds(candidateId, j, nodes, distanceCache, distanceConfig);
      }
    }

    if (totalDistance < minTotalDistance) {
      minTotalDistance = totalDistance;
      bestMedoid = candidateId;
    }
  }

  return bestMedoid;
}