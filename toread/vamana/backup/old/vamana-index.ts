/**
 * Vamana Graph Index Implementation
 * 基于Microsoft Research的DiskANN论文实现
 * 
 * 论文: Efficient and Robust Approximate Nearest Neighbor Search using Hierarchical Navigable Small World Graphs
 * 主要特点:
 * 1. 单层有向图结构 (vs HNSW的多层)
 * 2. RobustPrune邻居选择算法
 * 3. Beam Search搜索策略
 * 4. 优化的内存局部性
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

// ================ 主要实现 ================

/**
 * 创建Vamana图索引
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

  /**
   * 找到数据集的中位点（medoid）
   * 选择到所有其他点距离总和最小的点作为图搜索的入口点
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
          totalDistance += computeDistance(nodes[i].vector, nodes[j].vector);
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
   * 贪婪图搜索 - Vamana的核心搜索算法
   * 从起始节点开始，通过图的边进行beam search
   */
  function greedySearch(queryVector: Float32Array, startNodeId: number, beamSize: number): { candidates: SearchCandidate[], visited: Set<number> } {
    const candidates: SearchCandidate[] = [];
    const visited = new Set<number>();
    const candidateSet = new Set<number>();

    if (nodes.length === 0) {
      return { candidates: [], visited };
    }

    // 初始化候选集
    candidates.push({
      id: startNodeId,
      distance: computeDistance(queryVector, nodes[startNodeId].vector)
    });
    candidateSet.add(startNodeId);

    let loopCount = 0;
    const maxLoops = nodes.length * 2;

    while (true) {
      loopCount++;
      if (loopCount > maxLoops) {
        console.error('greedySearch死循环风险!', {
          startNodeId,
          beamSize,
          visitedSize: visited.size,
          candidates: candidates.map(c => c.id)
        });
        throw new Error(`greedySearch loop limit exceeded: ${maxLoops}`);
      }
      // 找到候选集中未访问的最近节点
      let bestCandidate: SearchCandidate | null = null;
      let bestIndex = -1;

      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (!visited.has(candidate.id)) {
          if (!bestCandidate || candidate.distance < bestCandidate.distance) {
            bestCandidate = candidate;
            bestIndex = i;
          }
        }
      }

      if (!bestCandidate) break;

      visited.add(bestCandidate.id);
      const currentNode = nodes[bestCandidate.id];

      // 探索当前节点的邻居
      for (const neighborId of currentNode.neighbors) {
        if (neighborId < nodes.length && !candidateSet.has(neighborId)) {
          const distance = computeDistance(queryVector, nodes[neighborId].vector);
          candidates.push({ id: neighborId, distance });
          candidateSet.add(neighborId);
        }
      }

      // 保持候选集大小限制
      if (candidates.length > beamSize) {
        candidates.sort((a, b) => a.distance - b.distance);
        candidates.splice(beamSize);
        
        // 更新candidateSet
        candidateSet.clear();
        for (const candidate of candidates) {
          candidateSet.add(candidate.id);
        }
      }
    }

    candidates.sort((a, b) => a.distance - b.distance);
    return { candidates, visited };
  }

  /**
   * RobustPrune算法 - Vamana的关键剪枝算法
   * 基于alpha参数进行智能邻居选择，避免冗余连接
   */
  function robustPrune(nodeId: number, candidateIds: number[], alpha: number): number[] {
    const sourceNode = nodes[nodeId];
    if (!sourceNode) return [];

    // 合并候选节点和现有邻居
    const allCandidates = new Set<number>(candidateIds);
    for (const neighborId of sourceNode.neighbors) {
      if (neighborId < nodes.length) {
        allCandidates.add(neighborId);
      }
    }

    // 移除自身
    allCandidates.delete(nodeId);

    // 计算所有候选节点到源节点的距离
    const candidatesWithDistance: SearchCandidate[] = [];
    for (const candidateId of allCandidates) {
      if (candidateId < nodes.length) {
        const distance = computeDistance(sourceNode.vector, nodes[candidateId].vector);
        candidatesWithDistance.push({ id: candidateId, distance });
      }
    }

    // 按距离排序
    candidatesWithDistance.sort((a, b) => a.distance - b.distance);

    const newNeighbors: number[] = [];
    const toRemove = new Set<number>();

    // RobustPrune的核心逻辑
    for (const candidate of candidatesWithDistance) {
      if (toRemove.has(candidate.id)) continue;
      if (newNeighbors.length >= R) break;

      newNeighbors.push(candidate.id);

      // 标记需要移除的候选节点
      for (const other of candidatesWithDistance) {
        if (other.id !== candidate.id && !toRemove.has(other.id)) {
          const distanceBetween = computeDistance(nodes[candidate.id].vector, nodes[other.id].vector);
          if (alpha * distanceBetween <= other.distance) {
            toRemove.add(other.id);
          }
        }
      }
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

    // 使用贪婪搜索找到候选邻居
    const searchResult = greedySearch(vectorArray, medoidId, L);
    const visitedNodes = Array.from(searchResult.visited);

    // 使用RobustPrune选择最佳邻居
    if (useRobustPrune) {
      newNode.neighbors = robustPrune(nodeId, visitedNodes, alpha);
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
              neighbor.neighbors = robustPrune(neighborId, neighbor.neighbors, alpha);
            } else {
              // 简单截断
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
    
    console.log(`🔧 构建Vamana图 (${nodes.length}个节点)`);
    
    // 重新计算medoid
    medoidId = findMedoid();
    
    // 为每个节点重新构建邻居连接
    const nodeIds = Array.from({ length: nodes.length }, (_, i) => i);
    
    // 随机打乱插入顺序（Vamana算法的重要特性）
    for (let i = nodeIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nodeIds[i], nodeIds[j]] = [nodeIds[j], nodeIds[i]];
    }

    for (const nodeId of nodeIds) {
      const searchResult = greedySearch(nodes[nodeId].vector, medoidId, L);
      const visitedNodes = Array.from(searchResult.visited);
      
      if (useRobustPrune) {
        nodes[nodeId].neighbors = robustPrune(nodeId, visitedNodes, alpha);
      }
    }
    
    console.log('✅ Vamana图构建完成');
  }

  function searchKNN(queryVector: Vector, k = 10, searchParams: SearchParams = {}): SearchResult[] {
    if (nodes.length === 0) return [];

    const queryArray = queryVector instanceof Float32Array ? queryVector : new Float32Array(queryVector);
    const beamSize = searchParams.searchListSize || searchListSize;
    
    // 使用贪婪搜索从medoid开始
    const searchResult = greedySearch(queryArray, medoidId, beamSize);
    
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
    console.log('开始Vamana图优化...');
    buildIndex();
    console.log('Vamana图优化完成');
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
    
    return {
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
  }

  return {
    insertNode,
    buildIndex,
    searchKNN,
    getStats,
    optimize
  };
} 
