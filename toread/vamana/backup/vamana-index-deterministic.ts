/**
 * Vamana Graph Index Implementation - Deterministic Version
 * 确定性版本：使用位操作进行层级分配，避免随机性
 * 
 * 🎯 核心改进:
 * 1. 使用 (internalId & -internalId).bitlength 进行确定性层级分配
 * 2. 内部ID管理，确保连续性和可预测性
 * 3. 完美的指数分布，无随机性开销
 * 4. 结果完全可重现
 */

import { Vector, SearchResult, SearchParams, NodeData } from './common.js';
import { BinaryHeapGeneric } from './binary-heap.js';
import { MidiHeapGeneric } from './midi-heap.js';

export interface VamanaDeterministicConfig {
  distanceFunction?: 'euclidean' | 'cosine' | 'inner_product';
  M?: number;           // 每层的最大连接数
  efConstruction?: number; // 构建时的搜索宽度
  efSearch?: number;    // 默认搜索宽度
  maxLevels?: number;   // 最大层级数
  alpha?: number;       // RobustPrune的α参数
  useRobustPrune?: boolean; // 是否使用Vamana的RobustPrune
  maxNodes?: number;    // 最大节点数
}

interface VamanaDeterministicNode {
  vector: Float32Array;
  norm: number;
  internalId: number;   // 🎯 内部ID，从1开始连续分配
  externalId: number;   // 外部ID，用于标识
  data: any;
  level: number;        // 🎯 通过确定性算法分配
  neighbors: number[][]; // 每层的邻居列表（使用internalId）
}

interface Neighbor {
  internalId: number;
  distance: number;
}

export interface VamanaDeterministicIndex {
  insertNode(vector: Vector, data?: NodeData): number;
  searchKNN(queryVector: Vector, k?: number, searchParams?: SearchParams): SearchResult[];
  getStats(): any;
}

/**
 * 🎯 确定性层级分配函数
 * 使用位操作 (n & -n) 来获得完美的指数分布
 */
function assignLevelDeterministic(internalId: number, maxLevels: number): number {
  if (internalId <= 0) return 0;
  
  // 隔离最低位的1，然后计算bit length
  const lowestBit = internalId & -internalId;
  
  // JavaScript实现bitlength：32 - Math.clz32(x)
  const bitLength = 32 - Math.clz32(lowestBit);
  
  // 层级从0开始，限制最大层级
  return Math.min(bitLength - 1, maxLevels - 1);
}

export function createVamanaDeterministicIndex(config: VamanaDeterministicConfig = {}): VamanaDeterministicIndex {
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

  const nodes: VamanaDeterministicNode[] = [];
  let nextInternalId = 1; // 🎯 内部ID从1开始，确保位操作正确
  let nextExternalId = 0; // 外部ID从0开始
  
  // 入口点管理
  const entryPoint = { internalId: -1, level: 0 };
  
  // 访问标记
  let visited: Uint8Array = new Uint8Array(maxNodes);
  let visitCounter = 1;

  // 🚀 距离计算函数（节点间）
  function computeDistance(nodeA: VamanaDeterministicNode, nodeB: VamanaDeterministicNode): number {
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
        return -dot;
      }
      
      default:
        throw new Error(`Unsupported distance function: ${distanceFunction}`);
    }
  }

  // 🚀 查询到节点的距离计算
  function computeQueryDistance(queryVector: Float32Array, queryNorm: number, node: VamanaDeterministicNode): number {
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

  // 🎯 根据内部ID查找节点
  function getNodeByInternalId(internalId: number): VamanaDeterministicNode | null {
    // 直接通过索引访问，因为 internalId 从 1 开始，数组索引从 0 开始
    const index = internalId - 1;
    if (index >= 0 && index < nodes.length) {
      return nodes[index] || null;
    }
    return null;
  }

  // 🔧 层级搜索函数
  function searchLayerWithQuery(
    queryVector: Float32Array,
    queryNorm: number,
    startInternalId: number,
    level: number,
    ef: number
  ): Neighbor[] {
    if (!visited) throw new Error("Visited set not initialized");
    resetVisited();

    const candidates = new BinaryHeapGeneric<Neighbor>([], (a, b) => a.distance - b.distance);
    const results = new MidiHeapGeneric<Neighbor>(ef, (a, b) => b.distance - a.distance);

    // 🔧 确保起始节点存在且在正确层级
    const startNode = getNodeByInternalId(startInternalId);
    if (!startNode || startNode.level < level) {
      // 寻找一个合适的起始点
      let fallbackNode: VamanaDeterministicNode | null = null;
      for (const node of nodes) {
        if (node && node.level >= level) {
          fallbackNode = node;
          break;
        }
      }
      if (!fallbackNode) {
        return []; // 没有节点在这个层级
      }
      startInternalId = fallbackNode.internalId;
    }

    const actualStartNode = getNodeByInternalId(startInternalId)!;
    const startNodeDist = computeQueryDistance(queryVector, queryNorm, actualStartNode);
    visited[startInternalId] = visitCounter;
    candidates.push({ internalId: startInternalId, distance: startNodeDist });
    results.push({ internalId: startInternalId, distance: startNodeDist });

    while (candidates.length > 0) {
      const bestCandidate = candidates.peek()!;
      const farthestResult = results.peek();

      if (farthestResult && bestCandidate.distance > farthestResult.distance && results.isFull()) {
        break; 
      }
      const cand = candidates.pop()!;

      // 🔧 获取当前节点在指定层级的邻居
      const candNode = getNodeByInternalId(cand.internalId);
      if (!candNode) continue;
      
      const nodeNeighbors = candNode.neighbors[level] || [];
      for (const neighborInternalId of nodeNeighbors) {
        const neighborNode = getNodeByInternalId(neighborInternalId);
        if (neighborNode && neighborNode.level >= level && visited[neighborInternalId] !== visitCounter) {
          visited[neighborInternalId] = visitCounter;
          const dist = computeQueryDistance(queryVector, queryNorm, neighborNode);
          const currentFarthest = results.peek();
          
          if (!currentFarthest || !results.isFull() || dist < currentFarthest.distance) {
            candidates.push({ internalId: neighborInternalId, distance: dist });

            if (!results.isFull()) {
              results.push({ internalId: neighborInternalId, distance: dist });
            } else {
              results.replace({ internalId: neighborInternalId, distance: dist });
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
  function robustPruneForLevel(nodeInternalId: number, candidateInternalIds: number[], level: number): number[] {
    const sourceNode = getNodeByInternalId(nodeInternalId);
    if (!sourceNode) return [];

    // 合并候选节点和现有邻居
    const allCandidates = new Set<number>(candidateInternalIds);
    const existingNeighbors = sourceNode.neighbors[level] || [];
    for (const neighborInternalId of existingNeighbors) {
      const neighborNode = getNodeByInternalId(neighborInternalId);
      if (neighborNode && neighborNode.level >= level) {
        allCandidates.add(neighborInternalId);
      }
    }

    allCandidates.delete(nodeInternalId);
    if (allCandidates.size === 0) return [];

    const maxConnections = level === 0 ? M * 2 : M;

    // 使用MidiHeap排序候选节点
    const candidatesHeap = new MidiHeapGeneric<Neighbor>(
      allCandidates.size,
      (a: Neighbor, b: Neighbor) => a.distance - b.distance
    );

    for (const candidateInternalId of allCandidates) {
      const candidateNode = getNodeByInternalId(candidateInternalId);
      if (candidateNode) {
        const distance = computeDistance(sourceNode, candidateNode);
        candidatesHeap.push({ internalId: candidateInternalId, distance });
      }
    }

    const sortedCandidates = candidatesHeap.toSortedArray();
    const newNeighbors: number[] = [];
    const newNeighborsSet = new Set<number>();
    const toRemove = new Set<number>();

    // Vamana的RobustPrune算法
    for (const p of sortedCandidates) {
      if (newNeighbors.length >= maxConnections) break;
      if (toRemove.has(p.internalId)) continue;

      newNeighbors.push(p.internalId);
      newNeighborsSet.add(p.internalId);

      // 剪枝逻辑
      for (const other of sortedCandidates) {
        if (p.internalId === other.internalId || newNeighborsSet.has(other.internalId) || toRemove.has(other.internalId)) continue;
        
        const pNode = getNodeByInternalId(p.internalId);
        const otherNode = getNodeByInternalId(other.internalId);
        if (pNode && otherNode) {
          const distPToOther = computeDistance(pNode, otherNode);
          
          if (alpha * distPToOther < other.distance) {
            toRemove.add(other.internalId);
          }
        }
      }
    }

    return newNeighbors;
  }

  /**
   * 🔧 邻居连接策略
   */
  function connectNeighbors(nodeInternalId: number, level: number, nearestNeighbors: Neighbor[]) {
    const maxConnections = level === 0 ? M * 2 : M;
    
    // 选择邻居策略
    const selectedNeighbors = useRobustPrune 
      ? robustPruneForLevel(nodeInternalId, nearestNeighbors.map(n => n.internalId), level)
      : nearestNeighbors.slice(0, maxConnections).map(n => n.internalId);
    
    const node = getNodeByInternalId(nodeInternalId);
    if (!node) return;

    // 确保邻居列表存在
    if (!node.neighbors[level]) {
      node.neighbors[level] = [];
    }
    node.neighbors[level] = selectedNeighbors;

    // 🔧 反向连接处理
    for (const neighborInternalId of selectedNeighbors) {
      const neighbor = getNodeByInternalId(neighborInternalId);
      if (neighbor) {
        // 确保邻居的该层邻居列表存在
        if (!neighbor.neighbors[level]) {
          neighbor.neighbors[level] = [];
        }

        const neighborNeighbors = neighbor.neighbors[level];
        const neighborSet = new Set(neighborNeighbors);
        
        if (!neighborSet.has(nodeInternalId)) {
          neighbor.neighbors[level].push(nodeInternalId);
          
          // 邻居修剪
          if (neighbor.neighbors[level].length > maxConnections) {
            if (useRobustPrune) {
              neighbor.neighbors[level] = robustPruneForLevel(neighborInternalId, neighbor.neighbors[level], level);
            } else {
              // 简单截断到最近的邻居
              const neighborCandidates = neighbor.neighbors[level].map(connInternalId => {
                const connNode = getNodeByInternalId(connInternalId);
                return connNode ? {
                  internalId: connInternalId,
                  distance: computeDistance(neighbor, connNode)
                } : null;
              }).filter(Boolean) as Neighbor[];
              
              neighborCandidates.sort((a: Neighbor, b: Neighbor) => a.distance - b.distance);
              neighbor.neighbors[level] = neighborCandidates.slice(0, maxConnections).map(c => c.internalId);
            }
          }
        }
      }
    }
  }

  function insertNode(vector: Vector, data: NodeData = {}): number {
    const internalId = nextInternalId++;
    const externalId = nextExternalId++;
    const vectorArray = vector instanceof Float32Array ? vector : new Float32Array(vector);
    
    const norm = computeNorm(vectorArray);
    
    // 🎯 确定性层级分配！
    const determinedLevel = assignLevelDeterministic(internalId, maxLevels);
    
    const newNode: VamanaDeterministicNode = {
      vector: vectorArray,
      norm,
      internalId,
      externalId,
      data,
      level: determinedLevel,
      neighbors: Array.from({ length: maxLevels }, () => [])
    };

    nodes.push(newNode);

    // 🔧 第一个节点处理
    if (entryPoint.internalId === -1) {
      entryPoint.internalId = internalId;
      entryPoint.level = determinedLevel;
      return externalId;
    }
    
    const topLevel = entryPoint.level;
    let currentInternalId = entryPoint.internalId;
    
    // 🔧 从顶层向下搜索
    for (let level = topLevel; level > determinedLevel; level--) {
      const results = searchLayerWithQuery(vectorArray, norm, currentInternalId, level, 1);
      if (results.length > 0) {
        currentInternalId = results[0].internalId;
      }
    }

    // 🔧 在每一层建立连接
    for (let level = Math.min(determinedLevel, topLevel); level >= 0; level--) {
      const nearestCandidates = searchLayerWithQuery(vectorArray, norm, currentInternalId, level, efConstruction);
      
      if (nearestCandidates.length > 0) {
        connectNeighbors(internalId, level, nearestCandidates);
        currentInternalId = nearestCandidates[0].internalId;
      }
    }
    
    // 🔧 入口点更新策略
    if (determinedLevel > topLevel) {
      entryPoint.internalId = internalId;
      entryPoint.level = determinedLevel;
    }

    return externalId;
  }

  function searchKNN(queryVector: Vector, k = 10, searchParams: SearchParams = {}): SearchResult[] {
    if (nodes.length === 0) return [];

    const queryArray = queryVector instanceof Float32Array ? queryVector : new Float32Array(queryVector);
    const searchEf = searchParams.searchListSize || efSearch;
    
    const queryNorm = computeNorm(queryArray);

    if (entryPoint.internalId === -1) return [];

    let currentInternalId = entryPoint.internalId;
    const topLevel = entryPoint.level;
    
    // 🔧 从顶层向下搜索
    for (let level = topLevel; level > 0; level--) {
      const results = searchLayerWithQuery(queryArray, queryNorm, currentInternalId, level, 1);
      if (results.length > 0) {
        currentInternalId = results[0].internalId;
      }
    }
    
    const finalEf = Math.max(k, searchEf);
    const finalResults = searchLayerWithQuery(queryArray, queryNorm, currentInternalId, 0, finalEf);

    return finalResults.slice(0, k).map(neighbor => {
      const node = getNodeByInternalId(neighbor.internalId);
      return {
        id: node?.externalId || -1,
        distance: neighbor.distance,
        data: node?.data || {}
      };
    });
  }

  function getStats(): any {
    if (nodes.length === 0) {
      return {
        nodeCount: 0,
        avgOutDegree: 0,
        maxOutDegree: 0,
        entryPoint: { ...entryPoint },
        parameters: config,
        levelDistribution: {}
      };
    }

    const totalOutDegree = nodes.reduce((sum, node) => 
      sum + (node?.neighbors?.reduce((levelSum, neighbors) => levelSum + (neighbors?.length || 0), 0) || 0), 0);
    const maxOutDegree = Math.max(...nodes.map(node => 
      Math.max(...(node?.neighbors?.map(neighbors => neighbors?.length || 0) || [0]), 0)), 0);
    
    // 🎯 分析层级分布
    const levelDistribution: Record<number, number> = {};
    for (const node of nodes) {
      levelDistribution[node.level] = (levelDistribution[node.level] || 0) + 1;
    }
    
    return {
      nodeCount: nodes.length,
      avgOutDegree: nodes.length > 0 ? totalOutDegree / nodes.length : 0,
      maxOutDegree,
      entryPoint: { ...entryPoint },
      parameters: config,
      levelDistribution, // 🎯 展示确定性分布效果
      nextInternalId,
      nextExternalId,
      nodes: nodes.map(node => ({
        internalId: node.internalId,
        externalId: node.externalId,
        level: node.level
      }))
    };
  }

  return {
    insertNode,
    searchKNN,
    getStats
  };
}

/**
 * 🎯 确定性层级分配的优势总结:
 * 1. 🚀 性能: 单次位操作 vs 多次随机数生成
 * 2. 🎲 确定性: 相同输入永远产生相同结果
 * 3. 📈 分布质量: 完美的指数分布
 * 4. 🧮 数学美感: 基于数字本身的内在性质
 * 5. 🔍 调试友好: 可预测的层级分配
 */ 