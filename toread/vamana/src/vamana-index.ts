/**
 * 超优化Vamana图索引实现
 * 专门针对RobustPrune算法进行性能优化
 * 
 * 🔧 关键优化：
 * 1. 距离缓存避免重复计算
 * 2. 早期终止优化
 * 3. 内存池化邻居存储
 * 4. 批量处理优化
 */
import { DistanceCache, DistanceConfig, DistanceFunction, computeDistance } from './distance';
import {  greedySearchForBuilding, greedySearchMultiStart,    } from './graph-search';
import { findMedoid } from './build/findMedoid';
import { robustPruneStandard } from './robust-prune';
import type { VamanaNode, VamanaConfig, VamanaStats, VamanaState, VamanaIndex, Vector, SearchResult, SearchParams, NodeData } from './types';

import { insertNodeToState } from './crud/insert';
// ================ 常量定义 ================

/**
 * 图松弛因子 - 与C++版本保持一致
 * 用于控制邻居列表的动态增长和剪枝阈值
 */
const GRAPH_SLACK_FACTOR = 1.05;

// ================ 类型定义 ================

export type CustomDistanceFunction = (a: any, b: any) => number;




// ================ 配置验证 ================

/**
 * 验证Vamana配置参数
 */
function validateVamanaConfig(config: VamanaConfig): Required<VamanaConfig> {
  const {
    distanceFunction = 'euclidean',
    customDistanceFunction,
    R = 32,
    L = 64,
    alpha = 1.2,
    beamwidth = 4,  // 新增默认值
    maxIterations = 2
  } = config;

  if (distanceFunction !== 'euclidean' &&
    distanceFunction !== 'cosine' &&
    distanceFunction !== 'inner_product' &&
    distanceFunction !== 'custom') {
    throw new Error(`不支持的距离函数: ${distanceFunction}`);
  }

  if (distanceFunction === 'custom' && !customDistanceFunction) {
    throw new Error('使用自定义距离函数时必须提供customDistanceFunction');
  }

  if (R <= 0 || L <= 0 || alpha <= 0 || beamwidth <= 0) {
    throw new Error('配置参数必须为正数');
  }

  return {
    distanceFunction,
    customDistanceFunction: customDistanceFunction!,
    R,
    L,
    alpha,
    beamwidth,
    maxIterations
  };
}

// ================ 核心操作函数 ================



/**
 * 初始化节点的随机邻居
 * 为每个节点随机分配初始邻居，用于构建初始邻接图
 * @param nodes - 节点数组
 * @param nodeCount - 节点总数
 * @param maxDegree - 最大出度
 */
function initializeRandomNeighbors(nodes: VamanaNode[], nodeCount: number, maxDegree: number): void {
  // 预计算随机邻居数量，避免重复计算
  const numRandomNeighbors = Math.min(maxDegree, Math.floor(nodeCount / 10));
  // 预分配候选数组，避免重复创建
  const candidates = new Array(nodeCount - 1);
  for (let i = 0; i < nodeCount; i++) {
    const currentNode = nodes[i];
    // 快速构建候选数组（排除当前节点）
    let candidateIndex = 0;
    for (let j = 0; j < nodeCount; j++) {
      if (j !== i) {
        candidates[candidateIndex++] = j;
      }
    }
    // 随机选择邻居
    const randomNeighbors: number[] = [];
    const actualNeighborCount = Math.min(numRandomNeighbors, candidateIndex);
    for (let j = 0; j < actualNeighborCount; j++) {
      const randomIndex = Math.floor(Math.random() * candidateIndex);
      const neighborId = candidates[randomIndex];
      // 将选中的邻居移到数组末尾，避免重复选择
      candidates[randomIndex] = candidates[--candidateIndex];
      randomNeighbors.push(neighborId);
    }
    currentNode.neighbors = randomNeighbors;
  }
}

/**
 * 构建Vamana图索引
 * 基于C++实现修复：每个节点从多个起始点开始搜索，提高图的连通性
 */
function buildIndexForState(state: VamanaState): void {
  const { nodes } = state
  const nodeCount = nodes.length
  const R = state.config.R
  if (nodeCount === 0) return;

  console.log(`🔧 构建优化Vamana图 (${nodeCount}个节点)`);

  // 步骤1: 初始化一个随机邻接图
  console.log(`📊 步骤1: 初始化随机邻接图`);
  initializeRandomNeighbors(state.nodes, nodeCount, R);

  // 步骤2: 计算入口点（medoid）
  console.log(`🎯 步骤2: 计算入口点（medoid）`);
  state.medoidId = findMedoid(state.nodes);
  console.log(`📍 入口点: ${state.medoidId}`);

  // 步骤3&4: 从入口点出发遍历，使用路径上的所有点作为候选邻居，然后裁边，调整alpha重复迭代
  // L不必调整
  const Lvec = [state.config.L, state.config.L * 1.2];

  const NUM_RNDS = 2;

  for (let rnd_no = 0; rnd_no < NUM_RNDS; rnd_no++) {
    const L = Lvec[rnd_no];
    const currentAlpha = rnd_no === NUM_RNDS - 1 ? state.config.alpha : 1.0;

    console.log(`🔄 第${rnd_no + 1}轮迭代: L=${L}, alpha=${currentAlpha}`);

    // 为每个节点，从入口点进行KNN搜索，收集搜索路径上的所有节点作为候选邻居
    const batchSize = Math.min(100, Math.max(10, Math.floor(state.nodes.length / 10)));

    for (let batchStart = 0; batchStart < state.nodes.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, state.nodes.length);

      for (let i = batchStart; i < batchEnd; i++) {
        const nodeId = i;

        // 从入口点开始，使用类似KNN搜索的方式找到目标节点，收集搜索过程中访问的所有节点
        const pathNodes = new Set<number>();

        // 使用贪心搜索从入口点找到目标节点，收集搜索过程中访问的所有节点
        const searchResult = greedySearchForBuilding(
          nodeId,  // 目标节点
          state.medoidId,  // 从入口点开始
          L,  // 搜索宽度
          state.nodes,
          state.distanceCache,
          state.distanceConfig
        );

        // 将搜索过程中访问的所有节点作为候选邻居
        for (const candidate of searchResult.candidates) {
          pathNodes.add(candidate.id);
        }
        pathNodes.delete(nodeId);

        const candidateNeighbors = Array.from(pathNodes);

        // 使用RobustPrune选择最佳邻居
        const maxc = Math.max(state.config.R * 2, 100);
        state.nodes[nodeId].neighbors = robustPruneStandard(
          nodeId,
          candidateNeighbors,
          currentAlpha,
          state.config.R,
          maxc,
          state.nodes,
          state.distanceCache,
          state.distanceConfig
        );
      }
    }
    const num_nodes = state.nodes.length;
    // 添加反向连接并确保图的连通性
    for (let batchStart = 0; batchStart < num_nodes; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, num_nodes);

      for (let i = batchStart; i < batchEnd; i++) {
        const nodeId = i;
        const currentNode = state.nodes[nodeId];

        // 清空当前节点的反向图记录
        state.inGraph[nodeId] = [];

        // 为当前节点的每个邻居添加反向连接
        for (const neighborId of currentNode.neighbors) {
          if (neighborId < state.nodes.length) {
            const neighbor = state.nodes[neighborId];

            // 添加反向连接到邻居的邻居列表
            if (!neighbor.neighbors.includes(nodeId)) {
              neighbor.neighbors.push(nodeId);

              // 如果邻居的度超过GRAPH_SLACK_FACTOR * R的限制，进行剪枝
              if (neighbor.neighbors.length > Math.floor(GRAPH_SLACK_FACTOR * state.config.R)) {
                const maxc = Math.max(state.config.R * 2, 100);
                neighbor.neighbors = robustPruneStandard(
                  neighborId,
                  neighbor.neighbors,
                  currentAlpha,
                  state.config.R,
                  maxc,
                  state.nodes,
                  state.distanceCache,
                  state.distanceConfig
                );
              }
            }

            // 维护反向图结构：将当前节点添加到邻居的反向图中
            state.inGraph[neighborId].push(nodeId);
          }
        }
      }
    }
  }

  // 标记图已构建完成
  state.hasBuilt = true;
  console.log(`✅ Vamana图构建完成`);
}

/**
 * 在Vamana图中搜索K近邻
 */
function searchKNNInState(
  state: VamanaState,
  queryVector: Vector,
  k = 10,
  searchParams: SearchParams = {}
): SearchResult[] {
  const {nodes,medoidId,distanceCache,distanceConfig}=state
  const nodeCount = nodes.length
  if (nodeCount === 0) return [];
  const queryArray = queryVector instanceof Float32Array ? queryVector : new Float32Array(queryVector);
  const beamSize = searchParams.searchListSize || state.config.L || 100;
  // 使用显式构建状态标志检查
  if (!state.hasBuilt) {
    throw new Error('Vamana图未构建');
  }
  // 使用贪婪搜索从medoid开始
  const searchResult = greedySearchMultiStart(
    queryArray,
    [medoidId],
    beamSize,
    nodes,
    distanceConfig
  );
  // 过滤掉已删除的节点并返回最近的k个结果
  return searchResult.candidates
    .filter(candidate => !nodes[candidate.id]?.data.deleted)
    .slice(0, k)
    .map(candidate => ({
      id: candidate.id,
      distance: candidate.distance,
      data: nodes[candidate.id]?.data
    }));
}

/**
 * 获取Vamana图的统计信息
 */
function getStatsFromState(state: VamanaState): VamanaStats {
  if (state.nodes.length === 0) {
    return {
      nodeCount: 0,
      avgOutDegree: 0,
      maxOutDegree: 0,
      graphDensity: 0,
      parameters: state.config
    };
  }

  // 计算活跃节点（未删除的节点）
  const activeNodes = state.nodes.filter(node => !node.data.deleted);
  const activeNodeCount = activeNodes.length;

  if (activeNodeCount === 0) {
    return {
      nodeCount: 0,
      avgOutDegree: 0,
      maxOutDegree: 0,
      graphDensity: 0,
      parameters: state.config
    };
  }

  // 计算出度统计
  let totalOutDegree = 0;
  let maxOutDegree = 0;

  for (const node of activeNodes) {
    const outDegree = node.neighbors.filter(neighborId =>
      neighborId < state.nodes.length && !state.nodes[neighborId]?.data.deleted
    ).length;
    totalOutDegree += outDegree;
    maxOutDegree = Math.max(maxOutDegree, outDegree);
  }

  const avgOutDegree = totalOutDegree / activeNodeCount;

  // 计算图密度（活跃节点之间的连接数 / 最大可能连接数）
  const maxPossibleEdges = activeNodeCount * (activeNodeCount - 1);
  const graphDensity = maxPossibleEdges > 0 ? totalOutDegree / maxPossibleEdges : 0;

  return {
    nodeCount: activeNodeCount,
    avgOutDegree,
    maxOutDegree,
    graphDensity,
    parameters: state.config
  };
}

/**
 * 高效删除节点 - 利用反向图结构
 * 时间复杂度：O(1) 查找指向该节点的所有节点
 */
function deleteNodeFromState(state: VamanaState, nodeId: number): boolean {
  // 检查节点是否存在
  const { nodes, inGraph } = state;
  const num_nodes = nodes.length;
  if (nodeId < 0 || nodeId >= num_nodes) {
    return false;
  }
  // 使用反向图结构快速找到所有指向该节点的节点
  const incomingNodes = inGraph[nodeId];
  // 从所有指向该节点的邻居中移除连接

  for (const neighborId of incomingNodes) {
    if (neighborId < num_nodes) {
      const neighbor = nodes[neighborId];
      // 从邻居的出边列表中移除该节点
      neighbor.neighbors = neighbor.neighbors.filter(id => id !== nodeId);
    }
  }

  // 同时从所有节点的邻居列表中移除该节点（确保完整性）
  for (let i = 0; i < state.nodes.length; i++) {
    if (i !== nodeId && !state.nodes[i].data.deleted) {
      state.nodes[i].neighbors = state.nodes[i].neighbors.filter(id => id !== nodeId);
    }
  }

  // 清空该节点的反向图记录
  state.inGraph[nodeId] = [];

  // 标记节点为已删除（软删除，保持索引一致性）
  state.nodes[nodeId] = {
    ...state.nodes[nodeId],
    vector: new Float32Array(0), // 清空向量
    neighbors: [], // 清空邻居
    data: { deleted: true } // 标记为已删除
  };

  // 如果删除的是medoid，需要重新计算
  if (state.medoidId === nodeId) {
    // 找到第一个未删除的节点作为临时medoid
    let newMedoidId = -1;
    for (let i = 0; i < state.nodes.length; i++) {
      if (!state.nodes[i].data.deleted) {
        newMedoidId = i;
        break;
      }
    }
    state.medoidId = newMedoidId;
  }

  return true;
}

// ================ 主要实现 ================

/**
 * 创建超优化Vamana图索引
 */
export function createVamanaIndex(config: VamanaConfig = {}): VamanaIndex {
  const validatedConfig = validateVamanaConfig(config);

  // 初始化状态
  const state: VamanaState = {
    nodes: [],
    medoidId: 0,
    nextNodeId: 0,
    distanceCache: new DistanceCache(),
    distanceConfig: {
      distanceFunction: validatedConfig.distanceFunction,
      customDistanceFunction: validatedConfig.customDistanceFunction
    },
    config: validatedConfig,
    hasBuilt: false, // 初始状态：未构建
    inGraph: [] // 初始化反向图
  };

  return {
    insertNode: (vector: Vector, data: NodeData = {}) => insertNodeToState(state, vector, data),
    buildIndex: () => buildIndexForState(state),
    searchKNN: (queryVector: Vector, k = 10, searchParams: SearchParams = {}) =>
      searchKNNInState(state, queryVector, k, searchParams),
    getStats: () => getStatsFromState(state),
    optimize: () => {
      console.log('开始优化Vamana图优化...');
      buildIndexForState(state);
      console.log('优化Vamana图优化完成');
    },
    getInternalState: () => state, // 新增：暴露内部状态
    deleteNode: (nodeId: number) => {
      return deleteNodeFromState(state, nodeId);
    }
  };
}

