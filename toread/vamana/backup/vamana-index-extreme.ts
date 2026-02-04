/**
 * Vamana Graph Index Implementation - Extreme Version (Fixed)
 * 修正版本：解决层级搜索、入口点选择和邻居连接的关键问题
 * 
 * 🔧 主要修复:
 * 1. 修正层级搜索时的终止条件
 * 2. 改进入口点选择和更新策略
 * 3. 优化邻居连接的双向处理
 * 4. 确保图的连通性和搜索质量
 */

import { Vector, SearchResult, SearchParams, NodeData } from './common.js';
import { BinaryHeapGeneric } from './binary-heap.js';
import { MidiHeapGeneric } from './midi-heap.js';

export interface VamanaExtremeConfig {
  distanceFunction?: 'euclidean' | 'cosine' | 'inner_product';
  M?: number;           // 类似HNSW的M，每层的最大连接数
  efConstruction?: number; // 类似HNSW的efConstruction，构建时的搜索宽度
  efSearch?: number;    // 默认搜索宽度
  maxLevels?: number;   // 最大层级数
  alpha?: number;       // RobustPrune的α参数
  useRobustPrune?: boolean; // 是否使用Vamana的RobustPrune
  maxNodes?: number;    // 最大节点数
}

interface VamanaExtremeNode {
  vector: Float32Array;
  norm: number;
  id: number;
  data: any;
  level: number;
  neighbors: number[][]; // 每层的邻居列表
}

interface Neighbor {
  id: number;
  distance: number;
}

export interface VamanaExtremeIndex {
  insertNode(vector: Vector, data?: NodeData): number;
  searchKNN(queryVector: Vector, k?: number, searchParams?: SearchParams): SearchResult[];
  getStats(): any;
}

export function createVamanaIndexExtreme(config: VamanaExtremeConfig = {}): VamanaExtremeIndex {
  const {
    distanceFunction = 'cosine',
    M = 16,
    efConstruction = 64,
    efSearch = 32,
    maxLevels = 16,
    alpha = 1.2,
    useRobustPrune = true,
    maxNodes = 100000
  } = config;

  const nodes: VamanaExtremeNode[] = [];
  let nextNodeId = 0;
  
  // 🔧 修正入口点管理策略
  const entryPoint = { id: -1, level: 0 };
  
  // 访问标记
  let visited: Uint8Array = new Uint8Array(maxNodes);
  let visitCounter = 1;

  // 🚀 距离计算函数（节点间）
  function computeDistance(nodeA: VamanaExtremeNode, nodeB: VamanaExtremeNode): number {
    switch (distanceFunction) {
      case 'euclidean': {
        let sum = 0;
        const len = Math.min(nodeA.vector.length, nodeB.vector.length);
        for (let i = 0; i < len; i++) {
          const diff = nodeA.vector[i] - nodeB.vector[i];
          sum += diff * diff;
        }
        return Math.sqrt(sum);
      }
      
      case 'cosine': {
        let dot = 0;
        const len = Math.min(nodeA.vector.length, nodeB.vector.length);
        for (let i = 0; i < len; i++) {
          dot += nodeA.vector[i] * nodeB.vector[i];
        }
        // 使用预计算的范数
        const normProduct = nodeA.norm * nodeB.norm;
        if (normProduct === 0) return 1;
        return 1 - (dot / normProduct);
      }
      
      case 'inner_product': {
        let dot = 0;
        const len = Math.min(nodeA.vector.length, nodeB.vector.length);
        for (let i = 0; i < len; i++) {
          dot += nodeA.vector[i] * nodeB.vector[i];
        }
        return -dot; // 负内积，因为我们要最小化距离
      }
      
      default:
        throw new Error(`Unsupported distance function: ${distanceFunction}`);
    }
  }

  // 🚀 查询到节点的距离计算
  function computeQueryDistance(queryVector: Float32Array, queryNorm: number, node: VamanaExtremeNode): number {
    switch (distanceFunction) {
      case 'euclidean': {
        let sum = 0;
        const len = Math.min(queryVector.length, node.vector.length);
        for (let i = 0; i < len; i++) {
          const diff = queryVector[i] - node.vector[i];
          sum += diff * diff;
        }
        return Math.sqrt(sum);
      }
      
      case 'cosine': {
        let dot = 0;
        const len = Math.min(queryVector.length, node.vector.length);
        for (let i = 0; i < len; i++) {
          dot += queryVector[i] * node.vector[i];
        }
        const normProduct = queryNorm * node.norm;
        if (normProduct === 0) return 1;
        return 1 - (dot / normProduct);
      }
      
      case 'inner_product': {
        let dot = 0;
        const len = Math.min(queryVector.length, node.vector.length);
        for (let i = 0; i < len; i++) {
          dot += queryVector[i] * node.vector[i];
        }
        return -dot;
      }
      
      default:
        throw new Error(`Unsupported distance function: ${distanceFunction}`);
    }
  }

  function computeNorm(vector: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < vector.length; i++) {
      sum += vector[i] * vector[i];
    }
    return Math.sqrt(sum);
  }

  function resetVisited(): void {
    visitCounter++;
    if (visitCounter >= 255) {
      visitCounter = 1;
      visited.fill(0);
    }
  }

  // 🔧 修正版本的层级搜索 - 关键修复
  function searchLayerWithQuery(
    queryVector: Float32Array,
    queryNorm: number,
    startNodeId: number,
    level: number,
    ef: number
  ): Neighbor[] {
    if (!visited) throw new Error("Visited set not initialized");
    resetVisited();

    const candidates = new BinaryHeapGeneric<Neighbor>([], (a, b) => a.distance - b.distance);
    const results = new MidiHeapGeneric<Neighbor>(ef, (a, b) => b.distance - a.distance);

    // 🔧 确保起始节点存在且在正确层级
    if (startNodeId >= nodes.length || !nodes[startNodeId] || nodes[startNodeId].level < level) {
      // 如果起始节点不在当前层级，寻找一个合适的起始点
      let fallbackStartId = -1;
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i] && nodes[i].level >= level) {
          fallbackStartId = i;
          break;
        }
      }
      if (fallbackStartId === -1) {
        return []; // 没有节点在这个层级
      }
      startNodeId = fallbackStartId;
    }

    const startNodeDist = computeQueryDistance(queryVector, queryNorm, nodes[startNodeId]);
    visited[startNodeId] = visitCounter;
    candidates.push({ id: startNodeId, distance: startNodeDist });
    results.push({ id: startNodeId, distance: startNodeDist });

    while (candidates.length > 0) {
      const bestCandidate = candidates.peek()!;
      const farthestResult = results.peek();

      if (farthestResult && bestCandidate.distance > farthestResult.distance && results.isFull()) {
        break; 
      }
      const cand = candidates.pop()!;

      // 🔧 确保邻居列表存在且节点在正确层级
      const nodeNeighbors = nodes[cand.id]?.neighbors[level] || [];
      for (const neighborId of nodeNeighbors) {
        if (neighborId < nodes.length && nodes[neighborId] && nodes[neighborId].level >= level && visited[neighborId] !== visitCounter) {
          visited[neighborId] = visitCounter;
          const dist = computeQueryDistance(queryVector, queryNorm, nodes[neighborId]);
          const currentFarthest = results.peek();
          
          if (!currentFarthest || !results.isFull() || dist < currentFarthest.distance) {
            candidates.push({ id: neighborId, distance: dist });

            if (!results.isFull()) {
              results.push({ id: neighborId, distance: dist });
            } else {
              results.replace({ id: neighborId, distance: dist });
            }
          }
        }
      }
    }
    
    return results.toSortedArray().reverse();
  }

  /**
   * 🚀 Vamana的RobustPrune算法 - 多层适配版本
   */
  function robustPruneForLevel(nodeId: number, candidateIds: number[], level: number): number[] {
    const sourceNode = nodes[nodeId];
    if (!sourceNode) return [];

    // 合并候选节点和现有邻居
    const allCandidates = new Set<number>(candidateIds);
    const existingNeighbors = sourceNode.neighbors[level] || [];
    for (const neighborId of existingNeighbors) {
      if (neighborId < nodes.length && nodes[neighborId] && nodes[neighborId].level >= level) {
        allCandidates.add(neighborId);
      }
    }

    allCandidates.delete(nodeId);
    if (allCandidates.size === 0) return [];

    const maxConnections = level === 0 ? M * 2 : M;

    // 使用MidiHeap排序候选节点
    const candidatesHeap = new MidiHeapGeneric<Neighbor>(
      allCandidates.size,
      (a: Neighbor, b: Neighbor) => a.distance - b.distance
    );

    for (const candidateId of allCandidates) {
      if (candidateId < nodes.length && nodes[candidateId]) {
        const distance = computeDistance(sourceNode, nodes[candidateId]);
        candidatesHeap.push({ id: candidateId, distance });
      }
    }

    const sortedCandidates = candidatesHeap.toSortedArray();
    const newNeighbors: number[] = [];
    const newNeighborsSet = new Set<number>();
    const toRemove = new Set<number>();

    // Vamana的RobustPrune算法
    for (const p of sortedCandidates) {
      if (newNeighbors.length >= maxConnections) break;
      if (toRemove.has(p.id)) continue;

      newNeighbors.push(p.id);
      newNeighborsSet.add(p.id);

      // 剪枝逻辑
      for (const other of sortedCandidates) {
        if (p.id === other.id || newNeighborsSet.has(other.id) || toRemove.has(other.id)) continue;
        
        const distPToOther = computeDistance(nodes[p.id], nodes[other.id]);
        
        if (alpha * distPToOther < other.distance) {
          toRemove.add(other.id);
        }
      }
    }

    return newNeighbors;
  }

  /**
   * 🔧 改进的连接策略 - 确保双向连接正确性
   */
  function connectNeighbors(nodeId: number, level: number, nearestNeighbors: Neighbor[]) {
    const maxConnections = level === 0 ? M * 2 : M;
    
    // 选择邻居策略
    const selectedNeighbors = useRobustPrune 
      ? robustPruneForLevel(nodeId, nearestNeighbors.map(n => n.id), level)
      : nearestNeighbors.slice(0, maxConnections).map(n => n.id);
    
    // 确保邻居列表存在
    if (!nodes[nodeId].neighbors[level]) {
      nodes[nodeId].neighbors[level] = [];
    }
    nodes[nodeId].neighbors[level] = selectedNeighbors;

    // 🔧 改进的反向连接处理
    for (const neighborId of selectedNeighbors) {
      if (neighborId < nodes.length && nodes[neighborId]) {
        const neighbor = nodes[neighborId];
        
        // 确保邻居的该层邻居列表存在
        if (!neighbor.neighbors[level]) {
          neighbor.neighbors[level] = [];
        }

        const neighborNeighbors = neighbor.neighbors[level];
        const neighborSet = new Set(neighborNeighbors);
        
        if (!neighborSet.has(nodeId)) {
          neighbor.neighbors[level].push(nodeId);
          
          // 邻居修剪
          if (neighbor.neighbors[level].length > maxConnections) {
            if (useRobustPrune) {
              neighbor.neighbors[level] = robustPruneForLevel(neighborId, neighbor.neighbors[level], level);
            } else {
              // 简单截断到最近的邻居
              const neighborCandidates = neighbor.neighbors[level].map(connId => ({
                id: connId,
                distance: computeDistance(neighbor, nodes[connId])
              }));
              
              neighborCandidates.sort((a, b) => a.distance - b.distance);
              neighbor.neighbors[level] = neighborCandidates.slice(0, maxConnections).map(c => c.id);
            }
          }
        }
      }
    }
  }

  function insertNode(vector: Vector, data: NodeData = {}): number {
    const nodeId = nextNodeId++;
    const vectorArray = vector instanceof Float32Array ? vector : new Float32Array(vector);
    
    const norm = computeNorm(vectorArray);
    
    // 🔧 改进的层级生成 - 更保守的策略
    let randomLevel = 0;
    const levelProbability = 1.0 / Math.log(2.0); // HNSW标准参数
    while (Math.random() < (1 / levelProbability) && randomLevel < maxLevels - 1) {
      randomLevel++;
    }
    
    const newNode: VamanaExtremeNode = {
      vector: vectorArray,
      norm,
      id: nodeId,
      data,
      level: randomLevel,
      neighbors: Array.from({ length: maxLevels }, () => [])
    };

    nodes.push(newNode);

    // 🔧 第一个节点处理
    if (entryPoint.id === -1) {
      entryPoint.id = nodeId;
      entryPoint.level = randomLevel;
      return nodeId;
    }
    
    const topLevel = entryPoint.level;
    let currentNodeId = entryPoint.id;
    
    // 🔧 修正层级搜索逻辑 - 从顶层向下搜索
    for (let level = topLevel; level > randomLevel; level--) {
      const results = searchLayerWithQuery(vectorArray, norm, currentNodeId, level, 1);
      if (results.length > 0) {
        currentNodeId = results[0].id;
      }
    }

    // 🔧 在每一层建立连接 - 从新节点层级向下
    for (let level = Math.min(randomLevel, topLevel); level >= 0; level--) {
      const nearestCandidates = searchLayerWithQuery(vectorArray, norm, currentNodeId, level, efConstruction);
      
      if (nearestCandidates.length > 0) {
        connectNeighbors(nodeId, level, nearestCandidates);
        currentNodeId = nearestCandidates[0].id; // 为下一层选择入口点
      }
    }
    
    // 🔧 保守的入口点更新策略 - 只在确实更高时更新
    if (randomLevel > topLevel) {
      entryPoint.id = nodeId;
      entryPoint.level = randomLevel;
    }

    return nodeId;
  }

  function searchKNN(queryVector: Vector, k = 10, searchParams: SearchParams = {}): SearchResult[] {
    if (nodes.length === 0) return [];

    const queryArray = queryVector instanceof Float32Array ? queryVector : new Float32Array(queryVector);
    const searchEf = searchParams.searchListSize || efSearch;
    
    const queryNorm = computeNorm(queryArray);

    if (entryPoint.id === -1 || entryPoint.id >= nodes.length) return [];

    let currentNodeId = entryPoint.id;
    const topLevel = entryPoint.level;
    
    // 🔧 修正搜索流程 - 确保每层都有有效的搜索
    for (let level = topLevel; level > 0; level--) {
      const results = searchLayerWithQuery(queryArray, queryNorm, currentNodeId, level, 1);
      if (results.length > 0) {
        currentNodeId = results[0].id;
      }
    }
    
    const finalEf = Math.max(k, searchEf);
    const finalResults = searchLayerWithQuery(queryArray, queryNorm, currentNodeId, 0, finalEf);

    return finalResults.slice(0, k).map(neighbor => ({
      id: neighbor.id,
      distance: neighbor.distance,
      data: nodes[neighbor.id]?.data || {}
    }));
  }

  function getStats(): any {
    const totalOutDegree = nodes.reduce((sum, node) => 
      sum + (node?.neighbors?.reduce((levelSum, neighbors) => levelSum + (neighbors?.length || 0), 0) || 0), 0);
    const maxOutDegree = Math.max(...nodes.map(node => 
      Math.max(...(node?.neighbors?.map(neighbors => neighbors?.length || 0) || [0]), 0)), 0);
    
    return {
      nodeCount: nodes.length,
      avgOutDegree: nodes.length > 0 ? totalOutDegree / nodes.length : 0,
      maxOutDegree,
      entryPoint: { ...entryPoint },
      parameters: config
    };
  }

  return {
    insertNode,
    searchKNN,
    getStats
  };
}

/**
 * 🔧 修复总结:
 * 1. 修正了层级搜索中的节点存在性检查
 * 2. 改进了入口点选择和更新策略
 * 3. 优化了邻居连接的双向处理逻辑
 * 4. 确保图的连通性和搜索质量
 * 5. 添加了更多的边界条件检查
 */ 