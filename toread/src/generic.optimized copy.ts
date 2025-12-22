import { BinaryHeapGeneric } from './binary-heap';
import { MidiHeapGeneric } from './midi-heap';

export interface HNSWConfig<T> {
  M: number;
  efConstruction: number;
  distanceFunction: (a: T, b: T) => number;
  distanceToQuery?: (query: T, target: T) => number; // 可选，如果未提供则使用distanceFunction
}

interface Neighbor {
  idx: number;
  distance: number;
}

export interface HNSWIndex<T> {
  insertNode: (vector: T) => void;
  search: (queryVector: T, k: number, efSearch?: number) => Neighbor[];
  deleteNode: (nodeIdx: number) => boolean;
  getStats: () => { 
    nodeCount: number; 
    activeNodeCount: number;
    deletedNodeCount: number;
    entryPoint: { idx: number; level: number } 
  };
}

// --- 节点有效性检查函数 ---

/**
 * 检查节点是否有效（未被删除）
 */
function isValidNode<T>(
  idx: number, 
  vectors: T[], 
  deletedNodes: Set<number>
): boolean {
  return idx >= 0 && idx < vectors.length && !deletedNodes.has(idx);
}

// --- 距离计算函数 ---

/**
 * 计算两个已存在节点之间的距离
 */
function computeDistance<T>(
  idxA: number, 
  idxB: number, 
  vectors: T[], 
  deletedNodes: Set<number>,
  distanceFunction: (a: T, b: T) => number
): number {
  // 检查节点有效性
  if (!isValidNode(idxA, vectors, deletedNodes) || !isValidNode(idxB, vectors, deletedNodes)) {
    return Infinity; // 无效节点返回无穷大距离
  }

  return distanceFunction(vectors[idxA]!, vectors[idxB]!);
}

/**
 * 计算查询向量到目标节点的距离
 */
function computeDistanceToTarget<T>(
  queryVector: T, 
  targetIdx: number, 
  vectors: T[], 
  deletedNodes: Set<number>,
  distanceFunction: (a: T, b: T) => number,
  distanceToQuery?: (query: T, target: T) => number
): number {
  // 检查目标节点有效性
  if (!isValidNode(targetIdx, vectors, deletedNodes)) {
    return Infinity; // 无效节点返回无穷大距离
  }

  const targetVector = vectors[targetIdx]!;
  
  // 如果提供了专门的distanceToQuery函数，使用它
  if (distanceToQuery) {
    return distanceToQuery(queryVector, targetVector);
  }
  
  // 否则使用通用的distanceFunction
  return distanceFunction(queryVector, targetVector);
}

// --- 层级搜索函数 ---

/**
 * 在指定层级上搜索最近的 ef 个邻居 - 使用优化的堆算法
 */
function searchLayerWithQuery<T>(
  queryVector: T,
  startNodeIdx: number,
  level: number,
  ef: number,
  vectors: T[],
  neighbors: number[][][],
  deletedNodes: Set<number>,
  distanceFunction: (a: T, b: T) => number,
  distanceToQuery?: (query: T, target: T) => number,
  visited?: Uint8Array
): Neighbor[] {
  if (!visited) throw new Error("Visited set not initialized");
  visited.fill(0);

  // 检查起始节点有效性
  if (!isValidNode(startNodeIdx, vectors, deletedNodes)) {
    return []; // 如果起始节点无效，返回空结果
  }

  // 使用动态二叉堆处理大小不定的候选集
  const candidates = new BinaryHeapGeneric<Neighbor>([], (a, b) => a.distance - b.distance);
  // 使用固定容量的MidiHeap处理Top-K结果集，性能更高
  const results = new MidiHeapGeneric<Neighbor>(ef, (a, b) => b.distance - a.distance);

  const startNodeDist = computeDistanceToTarget(
    queryVector, 
    startNodeIdx, 
    vectors, 
    deletedNodes, 
    distanceFunction, 
    distanceToQuery
  );
  visited[startNodeIdx] = 1;
  candidates.push({ idx: startNodeIdx, distance: startNodeDist });
  results.push({ idx: startNodeIdx, distance: startNodeDist });

  while (candidates.length > 0) {
    const bestCandidate = candidates.peek()!;
    const farthestResult = results.peek();

    // MidiHeap优化 - 剪枝逻辑更清晰
    if (farthestResult && bestCandidate.distance > farthestResult.distance && results.isFull()) {
      break; 
    }
    const cand = candidates.pop()!;

    const nodeNeighbors = neighbors[cand.idx]?.[level] || [];
    for (let i = 0; i < nodeNeighbors.length; i++) {
      const neighborIdx = nodeNeighbors[i]!;
      // 只处理有效的邻居节点
      if (visited[neighborIdx] === 0 && isValidNode(neighborIdx, vectors, deletedNodes)) {
        visited[neighborIdx] = 1;
        const dist = computeDistanceToTarget(
          queryVector, 
          neighborIdx, 
          vectors, 
          deletedNodes, 
          distanceFunction, 
          distanceToQuery
        );
        const currentFarthest = results.peek();
        
        // MidiHeap优化 - 使用isFull和replace API，效率更高
        if (!currentFarthest || !results.isFull() || dist < currentFarthest.distance) {
          candidates.push({ idx: neighborIdx, distance: dist });

          if (!results.isFull()) {
            results.push({ idx: neighborIdx, distance: dist });
          } else {
            results.replace({ idx: neighborIdx, distance: dist });
          }
        }
      }
    }
  }
  
  // MidiHeap优化 - toSortedArray 直接返回有序数组
  return results.toSortedArray().reverse();
}

// --- 邻居选择函数 ---

/**
 * 通过启发式方法选择邻居
 * 这是保证图连接多样性、避免陷入局部最优的关键
 */
function getNeighborsByHeuristic<T>(
  candidates: Neighbor[], 
  M: number, 
  vectors: T[], 
  deletedNodes: Set<number>,
  distanceFunction: (a: T, b: T) => number
): Neighbor[] {
  if (candidates.length <= M) {
    return candidates;
  }

  const result: Neighbor[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i]!;
    if (result.length >= M) break;
    if (visited.has(cand.idx)) continue;
    
    let good = true;
    for (let j = 0; j < result.length; j++) {
      const res = result[j]!;
      if (computeDistance(cand.idx, res.idx, vectors, deletedNodes, distanceFunction) < cand.distance) {
        good = false;
        break;
      }
    }

    if (good) {
      result.push(cand);
      visited.add(cand.idx);
    }
  }
  return result;
}

// --- 邻居管理函数 ---

/**
 * 从邻居列表中移除指定节点
 */
function removeNodeFromNeighbors<T>(
  nodeIdx: number, 
  neighbors: number[][][], 
  vectors: T[], 
  deletedNodes: Set<number>
): void {
  // 遍历所有节点，从它们的邻居列表中移除被删除的节点
  for (let i = 0; i < neighbors.length; i++) {
    if (!isValidNode(i, vectors, deletedNodes)) continue; // 跳过已删除的节点
    
    const nodeNeighbors = neighbors[i];
    if (!nodeNeighbors) continue;
    
    for (let level = 0; level < nodeNeighbors.length; level++) {
      const levelNeighbors = nodeNeighbors[level];
      if (!levelNeighbors) continue;
      
      // 过滤掉被删除的节点
      nodeNeighbors[level] = levelNeighbors.filter(neighborIdx => neighborIdx !== nodeIdx);
    }
  }
}

/**
 * 重新选择入口点
 */
function reselectEntryPoint<T>(
  vectors: T[], 
  deletedNodes: Set<number>, 
  nodeToLevels: Map<number, number>,
  entryPoint: { idx: number; level: number }
): void {
  let newEntryPoint = { idx: -1, level: -1 };
  
  // 找到层级最高的有效节点作为新入口点
  for (let i = 0; i < vectors.length; i++) {
    if (!isValidNode(i, vectors, deletedNodes)) continue;
    
    const nodeLevel = nodeToLevels.get(i) || 0;
    if (nodeLevel > newEntryPoint.level) {
      newEntryPoint = { idx: i, level: nodeLevel };
    }
  }
  
  // 如果没有找到有效节点，重置入口点
  if (newEntryPoint.idx === -1) {
    entryPoint.idx = -1;
    entryPoint.level = -1;
  } else {
    entryPoint.idx = newEntryPoint.idx;
    entryPoint.level = newEntryPoint.level;
  }
}

/**
 * 连接新节点和它的邻居
 */
function connectNeighbors<T>(
  nodeIdx: number, 
  level: number, 
  nearestNeighbors: Neighbor[], 
  neighbors: number[][][], 
  vectors: T[], 
  deletedNodes: Set<number>,
  distanceFunction: (a: T, b: T) => number,
  M: number
): void {
  // 根据层级使用正确的最大连接数：底层M*2，其他层M
  const maxConnections = level === 0 ? M * 2 : M;
  
  // 应用启发式算法选择最多样化的邻居
  const selectedNeighbors = getNeighborsByHeuristic(
    nearestNeighbors, 
    maxConnections, 
    vectors, 
    deletedNodes, 
    distanceFunction
  );
  neighbors[nodeIdx]![level] = selectedNeighbors.map(n => n.idx);

  for (let i = 0; i < selectedNeighbors.length; i++) {
      const neighbor = selectedNeighbors[i]!;
      
      if (!Array.isArray(neighbors[neighbor.idx])) {
          neighbors[neighbor.idx] = [];
      }
      if (!Array.isArray(neighbors[neighbor.idx]![level])) {
          neighbors[neighbor.idx]![level] = [];
      }

      neighbors[neighbor.idx]![level]!.push(nodeIdx);

      // MidiHeap优化 + BUG修复 - 使用层级对应的最大连接数进行修剪
      if (neighbors[neighbor.idx]![level]!.length > maxConnections) {
          const connections = neighbors[neighbor.idx]![level]!;
          
          // 使用MidiHeap选出Top-maxConnections最近的邻居
          const heap = new MidiHeapGeneric<Neighbor>(maxConnections, (a, b) => b.distance - a.distance);

          for(let j = 0; j < connections.length; j++) {
              const connIdx = connections[j]!;
              const dist = computeDistance(neighbor.idx, connIdx, vectors, deletedNodes, distanceFunction);
              const connNode = { idx: connIdx, distance: dist };

              if (!heap.isFull()) {
                  heap.push(connNode);
              } else if (dist < heap.peek()!.distance) {
                  heap.replace(connNode);
              }
          }
          neighbors[neighbor.idx]![level] = heap.toArray().map(c => c.idx);
      }
  }
}

// --- 层级分配函数 ---

/**
 * 确定性层级分配函数
 */
function assignLevelDeterministic(arrayIndex: number, maxLevels: number): number {
  const internalId = arrayIndex + 1;
  const lowestBit = internalId & -internalId;
  const level = 31 - Math.clz32(lowestBit);
  return Math.min(level, maxLevels - 1);
}

// --- 主要API函数 ---

/**
 * 插入新节点
 */
function insertNode<T>(
  vector: T,
  vectors: T[],
  neighbors: number[][][],
  deletedNodes: Set<number>,
  nodeToLevels: Map<number, number>,
  entryPoint: { idx: number; level: number },
  distanceFunction: (a: T, b: T) => number,
  distanceToQuery: ((query: T, target: T) => number) | undefined,
  M: number,
  efConstruction: number,
  visited: Uint8Array
): void {
  const newNodeIdx = vectors.length;

  vectors.push(vector);
  neighbors.push([]);

  if (entryPoint.idx === -1) {
    entryPoint.idx = newNodeIdx;
    entryPoint.level = 0;
    neighbors[newNodeIdx]![0] = [];
    nodeToLevels.set(newNodeIdx, 0);
    return;
  }
  
  // 确定新节点的最高层级 - 使用确定性算法
  const max_level = 16; // 与Current HNSW保持一致
  const randomLevel = assignLevelDeterministic(newNodeIdx, max_level);
  const topLevel = entryPoint.level;
  
  // 记录节点的最高层级
  nodeToLevels.set(newNodeIdx, randomLevel);
  
  let currentNodeIdx = entryPoint.idx;
  
  // 从顶层向下搜索
  for (let level = topLevel; level > randomLevel; level--) {
      const results = searchLayerWithQuery(
        vector, 
        currentNodeIdx, 
        level, 
        1, 
        vectors, 
        neighbors, 
        deletedNodes, 
        distanceFunction, 
        distanceToQuery, 
        visited
      );
      if (results.length > 0) {
        currentNodeIdx = results[0]!.idx;
      }
  }

  // 在每一层连接邻居
  for (let level = Math.min(randomLevel, topLevel); level >= 0; level--) {
      const nearestCandidates = searchLayerWithQuery(
        vector, 
        currentNodeIdx, 
        level, 
        efConstruction, 
        vectors, 
        neighbors, 
        deletedNodes, 
        distanceFunction, 
        distanceToQuery, 
        visited
      );
      
      // 确保即使候选者少于M个也能正确处理
      const M_level = level === 0 ? M * 2 : M;
      const selectedNeighbors = getNeighborsByHeuristic(
        nearestCandidates, 
        M_level, 
        vectors, 
        deletedNodes, 
        distanceFunction
      );

      connectNeighbors(
        newNodeIdx, 
        level, 
        selectedNeighbors, 
        neighbors, 
        vectors, 
        deletedNodes, 
        distanceFunction, 
        M
      );

      // 从已选出的、最多样化的邻居中选择下一层的入口点
      if (selectedNeighbors.length > 0) {
        currentNodeIdx = selectedNeighbors[0]!.idx; 
      }
  }
  
  // 如果新节点的层级更高，则更新入口点
  if (randomLevel > topLevel) {
      entryPoint.idx = newNodeIdx;
      entryPoint.level = randomLevel;
  }
}

/**
 * 删除节点
 */
function deleteNode<T>(
  nodeIdx: number,
  vectors: T[],
  neighbors: number[][][],
  deletedNodes: Set<number>,
  nodeToLevels: Map<number, number>,
  entryPoint: { idx: number; level: number }
): boolean {
  // 检查节点是否存在且有效
  if (nodeIdx < 0 || nodeIdx >= vectors.length || deletedNodes.has(nodeIdx)) {
    return false; // 节点不存在或已被删除
  }

  // 标记节点为已删除
  deletedNodes.add(nodeIdx);

  // 从所有邻居的连接中移除该节点
  removeNodeFromNeighbors(nodeIdx, neighbors, vectors, deletedNodes);

  // 如果删除的是入口点，需要重新选择入口点
  if (nodeIdx === entryPoint.idx) {
    reselectEntryPoint(vectors, deletedNodes, nodeToLevels, entryPoint);
  }

  return true;
}

/**
 * 搜索最近邻
 */
function search<T>(
  queryVector: T,
  k: number,
  efSearch: number | undefined,
  vectors: T[],
  neighbors: number[][][],
  deletedNodes: Set<number>,
  nodeToLevels: Map<number, number>,
  entryPoint: { idx: number; level: number },
  distanceFunction: (a: T, b: T) => number,
  distanceToQuery: ((query: T, target: T) => number) | undefined,
  efConstruction: number,
  visited: Uint8Array
): Neighbor[] {
  if (entryPoint.idx === -1 || !isValidNode(entryPoint.idx, vectors, deletedNodes)) return [];

  let currentNodeIdx = entryPoint.idx;
  const topLevel = entryPoint.level;
  
  // 使用新的searchLayerWithQuery函数
  for (let level = topLevel; level > 0; level--) {
      const results = searchLayerWithQuery(
        queryVector, 
        currentNodeIdx, 
        level, 
        1, 
        vectors, 
        neighbors, 
        deletedNodes, 
        distanceFunction, 
        distanceToQuery, 
        visited
      );
      if (results.length > 0) {
        currentNodeIdx = results[0]!.idx;
      } else {
        // 如果当前层级没有找到有效结果，尝试重新选择入口点
        reselectEntryPoint(vectors, deletedNodes, nodeToLevels, entryPoint);
        if (entryPoint.idx === -1) return [];
        currentNodeIdx = entryPoint.idx;
        break;
      }
  }
  
  const finalEf = Math.max(k, efSearch || efConstruction);
  const finalResults = searchLayerWithQuery(
    queryVector, 
    currentNodeIdx, 
    0, 
    finalEf, 
    vectors, 
    neighbors, 
    deletedNodes, 
    distanceFunction, 
    distanceToQuery, 
    visited
  );

  return finalResults.slice(0, k);
}

/**
 * 获取统计信息
 */
function getStats<T>(
  vectors: T[],
  deletedNodes: Set<number>,
  entryPoint: { idx: number; level: number }
): { 
  nodeCount: number; 
  activeNodeCount: number;
  deletedNodeCount: number;
  entryPoint: { idx: number; level: number } 
} {
  return {
    nodeCount: vectors.length,
    activeNodeCount: vectors.length - deletedNodes.size,
    deletedNodeCount: deletedNodes.size,
    entryPoint: { ...entryPoint }
  };
}

// --- 主工厂函数 ---

export function createHNSWIndex<T>(config: HNSWConfig<T>): HNSWIndex<T> {
  const { M, efConstruction, distanceFunction, distanceToQuery } = config;

  // --- 数据存储 ---
  const vectors: T[] = [];
  const neighbors: number[][][] = []; // [nodeId][level] -> [neighborId, ...]
  const entryPoint = { idx: -1, level: -1 };

  // --- 删除功能相关数据结构 ---
  const deletedNodes: Set<number> = new Set();
  const nodeToLevels: Map<number, number> = new Map(); // 记录每个节点的最高层级

  // --- 性能优化组件 ---
  // 在构造时分配，避免重复创建
  let visited: Uint8Array | null = null;
  const maxNodes = 10000; // 预设最大容量
  visited = new Uint8Array(maxNodes);

  return {
    insertNode: (vector: T) => insertNode(
      vector, 
      vectors, 
      neighbors, 
      deletedNodes, 
      nodeToLevels, 
      entryPoint, 
      distanceFunction, 
      distanceToQuery, 
      M, 
      efConstruction, 
      visited!
    ),
    search: (queryVector: T, k: number, efSearch?: number) => search(
      queryVector, 
      k, 
      efSearch, 
      vectors, 
      neighbors, 
      deletedNodes, 
      nodeToLevels, 
      entryPoint, 
      distanceFunction, 
      distanceToQuery, 
      efConstruction, 
      visited!
    ),
    deleteNode: (nodeIdx: number) => deleteNode(
      nodeIdx, 
      vectors, 
      neighbors, 
      deletedNodes, 
      nodeToLevels, 
      entryPoint
    ),
    getStats: () => getStats(vectors, deletedNodes, entryPoint),
  };
}

/**
 * 泛型HNSW索引实现
 * 
 * 🚀 主要特性：
 * 1. 完全泛型化 - 支持任意数据类型和距离函数
 * 2. 自定义距离函数 - 支持传入任意的距离计算函数
 * 3. 优化性能 - 使用MidiHeap和BinaryHeap优化
 * 4. 删除功能 - 完整的软删除支持
 * 5. 无函数嵌套 - 所有函数都是顶层函数，便于测试和维护
 * 
 * 📊 适用场景：
 * - 向量相似性搜索（使用欧几里得距离、余弦距离等）
 * - 字符串相似性搜索（使用编辑距离、Jaccard距离等）
 * - 图节点相似性搜索（使用图距离函数）
 * - 任意自定义距离度量的相似性搜索
 * 
 * 🎯 使用示例：
 * ```typescript
 * // 向量相似性搜索
 * const vectorIndex = createHNSWIndex({
 *   M: 16,
 *   efConstruction: 200,
 *   distanceFunction: (a, b) => cosineDistance(a, b)
 * });
 * 
 * // 字符串相似性搜索
 * const stringIndex = createHNSWIndex({
 *   M: 16,
 *   efConstruction: 200,
 *   distanceFunction: (a, b) => editDistance(a, b)
 * });
 * ```
 */ 