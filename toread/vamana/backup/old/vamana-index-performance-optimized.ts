/**
 * 高性能Vamana图索引 - 基于Weaviate优化策略
 * 
 * 🚀 核心优化：
 * 1. 排序数组替代Set操作 (Weaviate核心优化)
 * 2. 位图访问标记系统
 * 3. 距离缓存优化
 * 4. 内存池化和局部性优化
 * 
 * 基于Weaviate团队文章：
 * "Five Optimizations for ANNS Indexing and Search"
 */

import { Vector, SearchResult, SearchParams, NodeData } from './common.js';

// ================ 类型定义 ================

export interface VamanaConfig {
  distanceFunction?: 'euclidean' | 'cosine' | 'inner_product' | 'custom';
  customDistanceFunction?: (a: any, b: any) => number;
  R?: number;           // 最大出度
  L?: number;           // 构建时的搜索宽度
  alpha?: number;       // RobustPrune的α参数
  searchListSize?: number; // 搜索时的beam size
  maxIterations?: number;
  useRobustPrune?: boolean;
}

export interface VamanaNode {
  vector: Float32Array;
  id: number;
  data: any;
  neighbors: number[]; // 出边邻居列表
}

export interface VamanaIndex {
  insertNode(vector: Vector, data?: NodeData): number;
  buildIndex(): void;
  searchKNN(queryVector: Vector, k?: number, searchParams?: SearchParams): SearchResult[];
  getStats(): VamanaStats;
  optimize(): void;
}

export interface VamanaStats {
  nodeCount: number;
  avgOutDegree: number;  
  maxOutDegree: number;  
  graphDensity: number;
  parameters: VamanaConfig;
}

interface SearchCandidate {
  id: number;
  distance: number;
}

// ================ 高性能工具类 ================

/**
 * 高性能排序数组 - 替代Set操作
 * 基于Weaviate的优化策略：使用排序数组 + 二分搜索
 */
class SortedCandidateArray {
  private candidates: SearchCandidate[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  // 🚀 二分搜索插入 - Weaviate优化策略
  insert(candidate: SearchCandidate): void {
    let left = 0;
    let right = this.candidates.length;
    
    // 二分查找插入位置
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.candidates[mid].distance < candidate.distance) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    this.candidates.splice(left, 0, candidate);
    
    // 保持大小限制
    if (this.candidates.length > this.maxSize) {
      this.candidates.length = this.maxSize;
    }
  }

  // 🚀 高效查找最近未访问节点
  findNearestUnvisited(visited: Uint8Array, visitCounter: number): SearchCandidate | null {
    for (const candidate of this.candidates) {
      if (visited[candidate.id] !== visitCounter) {
        return candidate;
      }
    }
    return null;
  }

  // 获取所有候选节点（按距离排序）
  getAll(): SearchCandidate[] {
    return this.candidates.slice();
  }

  clear(): void {
    this.candidates.length = 0;
  }

  get length(): number {
    return this.candidates.length;
  }
}

/**
 * 高性能访问标记 - 使用位图代替Set
 * 基于Weaviate的优化：位图表示访问状态
 */
class VisitedBitmap {
  public bitmap: Uint8Array;
  public counter: number = 1;

  constructor(maxNodes: number) {
    this.bitmap = new Uint8Array(maxNodes);
  }

  markVisited(nodeId: number): void {
    this.bitmap[nodeId] = this.counter;
  }

  isVisited(nodeId: number): boolean {
    return this.bitmap[nodeId] === this.counter;
  }

  reset(): void {
    this.counter++;
    if (this.counter === 255) {
      this.bitmap.fill(0);
      this.counter = 1;
    }
  }

  getVisitedNodes(): number[] {
    const visited: number[] = [];
    for (let i = 0; i < this.bitmap.length; i++) {
      if (this.bitmap[i] === this.counter) {
        visited.push(i);
      }
    }
    return visited;
  }
}

/**
 * 高性能距离缓存
 */
class DistanceCache {
  private cache = new Map<number, number>();
  private hits = 0;
  private misses = 0;

  // 使用Cantor配对函数生成唯一键
  private cantorPair(a: number, b: number): number {
    return ((a + b) * (a + b + 1)) / 2 + b;
  }

  getCachedDistance(id1: number, id2: number, computeFn: (id1: number, id2: number) => number): number {
    if (id1 === id2) return 0;
    
    const key = id1 < id2 ? this.cantorPair(id1, id2) : this.cantorPair(id2, id1);
    
    if (this.cache.has(key)) {
      this.hits++;
      return this.cache.get(key)!;
    }
    
    const distance = computeFn(id1, id2);
    this.cache.set(key, distance);
    this.misses++;
    return distance;
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / (this.hits + this.misses) || 0
    };
  }
}

// ================ 主要实现 ================

/**
 * 创建高性能Vamana图索引
 */
export function createVamanaIndex(config: VamanaConfig = {}): VamanaIndex {
  const {
    distanceFunction = 'euclidean',
    customDistanceFunction,
    R = 32,
    L = 64,
    alpha = 1.2,
    searchListSize = 100,
    maxIterations = 2,
    useRobustPrune = true
  } = config;

  const nodes: VamanaNode[] = [];
  let medoidId: number = 0;
  let nextNodeId = 0;
  
  // 🚀 高性能工具初始化
  const distanceCache = new DistanceCache();
  const maxNodes = 100000; // 预估最大节点数
  const visitedBitmap = new VisitedBitmap(maxNodes);

  function computeDistance(vecA: Float32Array, vecB: Float32Array): number {
    if (distanceFunction === 'custom' && customDistanceFunction) {
      return customDistanceFunction(
        { vector: vecA }, 
        { vector: vecB }
      );
    }

    switch (distanceFunction) {
      case 'euclidean': {
        let sum = 0;
        for (let i = 0; i < vecA.length; i++) {
          const diff = vecA[i] - vecB[i];
          sum += diff * diff;
        }
        return Math.sqrt(sum);
      }
      case 'cosine': {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
          dotProduct += vecA[i] * vecB[i];
          normA += vecA[i] * vecA[i];
          normB += vecB[i] * vecB[i];
        }
        const normProduct = Math.sqrt(normA) * Math.sqrt(normB);
        return normProduct === 0 ? 1 : 1 - (dotProduct / normProduct);
      }
      case 'inner_product': {
        let sum = 0;
        for (let i = 0; i < vecA.length; i++) {
          sum += vecA[i] * vecB[i];
        }
        return -sum;
      }
      default:
        throw new Error(`不支持的距离函数: ${distanceFunction}`);
    }
  }

  function computeDistanceFromIds(id1: number, id2: number): number {
    return distanceCache.getCachedDistance(id1, id2, (a, b) => {
      return computeDistance(nodes[a].vector, nodes[b].vector);
    });
  }

  /**
   * 找到数据集的中位点（medoid）
   */
  function findMedoid(): number {
    if (nodes.length === 0) return 0;
    if (nodes.length === 1) return 0;

    let bestMedoid = 0;
    let minTotalDistance = Infinity;

    for (let i = 0; i < nodes.length; i++) {
      let totalDistance = 0;
      for (let j = 0; j < nodes.length; j++) {
        if (i !== j) {
          totalDistance += computeDistanceFromIds(i, j);
        }
      }
      
      if (totalDistance < minTotalDistance) {
        minTotalDistance = totalDistance;
        bestMedoid = i;
      }
    }

    return bestMedoid;
  }

  /**
   * 🚀 高性能贪婪图搜索 - Weaviate风格优化
   * 使用排序数组和位图替代Set操作
   */
  function greedySearchOptimized(queryVector: Float32Array, startNodeId: number, beamSize: number): { candidates: SearchCandidate[], visited: number[] } {
    if (nodes.length === 0) {
      return { candidates: [], visited: [] };
    }

    // 🚀 重置访问标记
    visitedBitmap.reset();
    
    // 🚀 使用排序数组代替候选集Set
    const candidateArray = new SortedCandidateArray(beamSize);
    
    // 初始化
    const startDistance = computeDistance(queryVector, nodes[startNodeId].vector);
    candidateArray.insert({ id: startNodeId, distance: startDistance });

    let maxIterations = nodes.length * 2;
    let iterationCount = 0;

    while (iterationCount < maxIterations) {
      iterationCount++;
      
      // 🚀 高效查找最近未访问节点
      const bestCandidate = candidateArray.findNearestUnvisited(visitedBitmap.bitmap, visitedBitmap.counter);
      
      if (!bestCandidate) break;

      // 标记为已访问
      visitedBitmap.markVisited(bestCandidate.id);
      const currentNode = nodes[bestCandidate.id];

      // 探索邻居
      for (const neighborId of currentNode.neighbors) {
        if (neighborId < nodes.length && !visitedBitmap.isVisited(neighborId)) {
          const distance = computeDistance(queryVector, nodes[neighborId].vector);
          candidateArray.insert({ id: neighborId, distance });
        }
      }
    }

    return { 
      candidates: candidateArray.getAll(),
      visited: visitedBitmap.getVisitedNodes()
    };
  }

  /**
   * 🚀 高性能RobustPrune算法
   * 基于标准算法流程 + Weaviate性能优化
   */
  function robustPruneOptimized(nodeId: number, candidateIds: number[], alpha: number): number[] {
    const sourceNode = nodes[nodeId];
    if (!sourceNode) return [];

    // 🚀 使用排序数组代替Set
    const candidateArray: SearchCandidate[] = [];
    const candidateSet = new Set<number>(candidateIds);
    
    // 添加现有邻居
    for (const neighborId of sourceNode.neighbors) {
      if (neighborId < nodes.length) {
        candidateSet.add(neighborId);
      }
    }
    candidateSet.delete(nodeId);

    if (candidateSet.size === 0) return [];

    // 预计算距离并创建排序数组
    for (const candidateId of candidateSet) {
      const distance = computeDistanceFromIds(nodeId, candidateId);
      candidateArray.push({ id: candidateId, distance });
    }

    // 🚀 一次性排序，避免重复排序
    candidateArray.sort((a, b) => a.distance - b.distance);

    const newNeighbors: number[] = [];
    const remainingCandidates = candidateArray.slice(); // 创建副本用于修改

    // 标准RobustPrune流程
    while (newNeighbors.length < R && remainingCandidates.length > 0) {
      // 选择最近的候选节点
      const closest = remainingCandidates.shift()!;
      newNeighbors.push(closest.id);

      // 🚀 高效剪枝：使用索引而非创建新数组
      let writeIndex = 0;
      for (let readIndex = 0; readIndex < remainingCandidates.length; readIndex++) {
        const candidate = remainingCandidates[readIndex];
        const distClosestToCandidate = computeDistanceFromIds(closest.id, candidate.id);
        
        // RobustPrune条件检查
        if (alpha * distClosestToCandidate > candidate.distance) {
          remainingCandidates[writeIndex++] = candidate;
        }
      }
      remainingCandidates.length = writeIndex; // 截断数组
    }

    return newNeighbors;
  }

  function insertNode(vector: Vector, data: NodeData = {}): number {
    const nodeId = nextNodeId++;
    const vectorArray = vector instanceof Float32Array ? vector : new Float32Array(vector);
    
    const newNode: VamanaNode = {
      vector: vectorArray,
      id: nodeId,
      data,
      neighbors: []
    };

    nodes.push(newNode);

    if (nodes.length === 1) {
      medoidId = 0;
      return nodeId;
    }

    // 使用优化的贪婪搜索
    const searchResult = greedySearchOptimized(vectorArray, medoidId, L);
    const visitedNodes = searchResult.visited;

    // 使用优化的RobustPrune
    if (useRobustPrune) {
      newNode.neighbors = robustPruneOptimized(nodeId, visitedNodes, alpha);
    } else {
      // 简单选择最近的R个邻居
      searchResult.candidates.sort((a, b) => a.distance - b.distance);
      newNode.neighbors = searchResult.candidates.slice(0, R).map(c => c.id);
    }

    // 添加反向连接
    for (const neighborId of newNode.neighbors) {
      if (neighborId < nodes.length) {
        const neighbor = nodes[neighborId];
        if (!neighbor.neighbors.includes(nodeId)) {
          neighbor.neighbors.push(nodeId);
          
          // 如果邻居的度超过限制，进行剪枝
          if (neighbor.neighbors.length > R) {
            if (useRobustPrune) {
              neighbor.neighbors = robustPruneOptimized(neighborId, neighbor.neighbors, alpha);
            } else {
              neighbor.neighbors = neighbor.neighbors.slice(0, R);
            }
          }
        }
      }
    }

    return nodeId;
  }

  function buildIndex(): void {
    if (nodes.length === 0) return;
    
    console.log(`🚀 构建高性能Vamana图 (${nodes.length}个节点)`);
    
    // 清空缓存
    distanceCache.clear();
    
    // 重新计算medoid
    medoidId = findMedoid();
    
    // 为每个节点重新构建邻居连接
    const nodeIds = Array.from({ length: nodes.length }, (_, i) => i);
    
    // 随机打乱顺序
    for (let i = nodeIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nodeIds[i], nodeIds[j]] = [nodeIds[j], nodeIds[i]];
    }

    for (const nodeId of nodeIds) {
      const searchResult = greedySearchOptimized(nodes[nodeId].vector, medoidId, L);
      const visitedNodes = searchResult.visited;
      
      if (useRobustPrune) {
        nodes[nodeId].neighbors = robustPruneOptimized(nodeId, visitedNodes, alpha);
      }
    }
    
    console.log('✅ 高性能Vamana图构建完成');
    console.log('📊 距离缓存统计:', distanceCache.getStats());
  }

  function searchKNN(queryVector: Vector, k = 10, searchParams: SearchParams = {}): SearchResult[] {
    if (nodes.length === 0) return [];

    const queryArray = queryVector instanceof Float32Array ? queryVector : new Float32Array(queryVector);
    const beamSize = searchParams.searchListSize || searchListSize;
    
    // 使用优化的贪婪搜索
    const searchResult = greedySearchOptimized(queryArray, medoidId, beamSize);
    
    // 返回最近的k个结果
    return searchResult.candidates
      .slice(0, k)
      .map(candidate => ({
        id: candidate.id,
        distance: candidate.distance,
        data: nodes[candidate.id]?.data
      }));
  }

  function optimize(): void {
    console.log('开始高性能Vamana图优化...');
    buildIndex();
    console.log('高性能Vamana图优化完成');
  }

  function getStats(): VamanaStats {
    if (nodes.length === 0) {
      return {
        nodeCount: 0,
        avgOutDegree: 0,
        maxOutDegree: 0,
        graphDensity: 0,
        parameters: {
          distanceFunction,
          customDistanceFunction,
          R,
          L,
          alpha,
          searchListSize,
          maxIterations,
          useRobustPrune
        }
      };
    }
    
    const totalDegree = nodes.reduce((sum, node) => sum + node.neighbors.length, 0);
    const avgOutDegree = totalDegree / nodes.length;
    const maxOutDegree = Math.max(...nodes.map(node => node.neighbors.length));
    
    const stats = {
      nodeCount: nodes.length,
      avgOutDegree,
      maxOutDegree,
      graphDensity: nodes.length > 1 ? totalDegree / (nodes.length * (nodes.length - 1)) : 0,
      parameters: {
        distanceFunction,
        customDistanceFunction,
        R,
        L,
        alpha,
        searchListSize,
        maxIterations,
        useRobustPrune
      }
    };

    console.log('🔍 距离缓存性能:', distanceCache.getStats());
    
    return stats;
  }

  return {
    insertNode,
    buildIndex,
    searchKNN,
    getStats,
    optimize
  };
} 