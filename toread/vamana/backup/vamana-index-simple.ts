/**
 * 极简版Vamana图索引实现
 * 专注于正确性而非性能
 */

export interface VamanaConfig {
  R: number;           // 最大出度
  L: number;           // 搜索列表大小
  alpha: number;       // RobustPrune参数
}

export interface VamanaNode {
  id: number;
  vector: Float32Array;
  data: any;
  neighbors: Set<number>;
}

export interface SearchResult {
  id: number;
  distance: number;
  data?: any;
}

export function createSimpleVamanaIndex(config: VamanaConfig) {
  const { R, L, alpha } = config;
  
  const nodes: VamanaNode[] = [];
  const nodeMap = new Map<number, VamanaNode>();
  let nextId = 0;
  let entryPoint = 0;

  // 欧几里得距离
  function computeDistance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  // 简单的贪婪搜索
  function simpleSearch(queryVector: Float32Array, k: number): SearchResult[] {
    if (nodes.length === 0) return [];
    
    const visited = new Set<number>();
    const candidates: Array<{id: number, distance: number}> = [];
    
    // 从入口点开始
    const queue = [entryPoint];
    let iterations = 0;
    const maxIterations = Math.min(nodes.length * 2, 1000); // 防止死循环
    
    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const currentId = queue.shift()!;
      
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      
      const currentNode = nodeMap.get(currentId);
      if (!currentNode) continue;
      
      const distance = computeDistance(queryVector, currentNode.vector);
      candidates.push({ id: currentId, distance });
      
      // 添加邻居到队列（限制数量）
      let neighborCount = 0;
      for (const neighborId of currentNode.neighbors) {
        if (!visited.has(neighborId) && neighborCount < 5) {
          queue.push(neighborId);
          neighborCount++;
        }
      }
    }
    
    // 排序并返回top-k
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates.slice(0, k).map(c => ({
      id: c.id,
      distance: c.distance,
      data: nodeMap.get(c.id)?.data
    }));
  }

  // 极简的RobustPrune
  function simpleRobustPrune(candidates: Array<{id: number, distance: number}>, R: number): number[] {
    if (candidates.length <= R) {
      return candidates.map(c => c.id);
    }
    
    // 简单策略：保留距离最近的R个节点
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates.slice(0, R).map(c => c.id);
  }

  return {
    insertNode(vector: Float32Array, data: any = {}): number {
      const id = nextId++;
      const node: VamanaNode = {
        id,
        vector: new Float32Array(vector),
        data,
        neighbors: new Set()
      };
      
      nodes.push(node);
      nodeMap.set(id, node);
      
      // 如果是第一个节点，设为入口点
      if (nodes.length === 1) {
        entryPoint = id;
        return id;
      }
      
      // 简单连接策略：连接到最近的几个节点
      const candidates: Array<{id: number, distance: number}> = [];
      
      for (const existingNode of nodes) {
        if (existingNode.id === id) continue;
        const distance = computeDistance(vector, existingNode.vector);
        candidates.push({ id: existingNode.id, distance });
      }
      
      // 选择最近的几个节点作为邻居
      const selectedNeighbors = simpleRobustPrune(candidates, Math.min(R, 3));
      
      // 建立双向连接
      for (const neighborId of selectedNeighbors) {
        const neighborNode = nodeMap.get(neighborId);
        if (neighborNode) {
          node.neighbors.add(neighborId);
          neighborNode.neighbors.add(id);
          
          // 如果邻居的度数超过限制，进行简单修剪
          if (neighborNode.neighbors.size > R) {
            const neighborCandidates: Array<{id: number, distance: number}> = [];
            for (const nId of neighborNode.neighbors) {
              const nNode = nodeMap.get(nId);
              if (nNode) {
                const dist = computeDistance(neighborNode.vector, nNode.vector);
                neighborCandidates.push({ id: nId, distance: dist });
              }
            }
            
            const prunedNeighbors = simpleRobustPrune(neighborCandidates, R);
            neighborNode.neighbors.clear();
            prunedNeighbors.forEach(nId => neighborNode.neighbors.add(nId));
          }
        }
      }
      
      return id;
    },

    searchKNN(queryVector: Float32Array, k: number): SearchResult[] {
      return simpleSearch(queryVector, k);
    },

    getStats() {
      const totalDegree = nodes.reduce((sum, node) => sum + node.neighbors.size, 0);
      const avgDegree = nodes.length > 0 ? totalDegree / nodes.length : 0;
      const maxDegree = Math.max(...nodes.map(node => node.neighbors.size), 0);
      
      return {
        nodeCount: nodes.length,
        avgDegree,
        maxDegree,
        entryPoint
      };
    }
  };
} 