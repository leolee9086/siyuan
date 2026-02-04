import type {DistanceFunction} from './distance';
import type {DistanceCache,DistanceConfig} from './distance';
export type CustomDistanceFunction = (a: any, b: any) => number;
/**
 * 通用类型定义
 */
export type Vector = number[] | Float32Array;
export interface NodeData {
  [key: string]: any;
}
export interface SearchResult {
  id: number;
  distance: number;
  data?: NodeData;
}
export interface SearchParams {
  ef?: number;
  searchListSize?: number; // Vamana uses this
}
export type VectorSimilarityFunction = 'EUCLIDEAN' | 'COSINE' | 'DOT_PRODUCT' | 'MAXIMUM_INNER_PRODUCT';
// 距离度量类型
export type DistanceMetric = 'euclidean' | 'cosine' | 'manhattan' | 'inner_product';
// 索引元数据
export interface IndexMetadata {
  nodeCount: number;
  dimension?: number;
  isTrained?: boolean;
  algorithm: string;
  parameters?: Record<string, any>;
}
// 序列化数据
export interface SerializedData {
  version: string;
  timestamp: number;
  algorithm: string;
  config: Record<string, any>;
  data: string;
}
// 邻居对象
export interface Neighbor {
  idx: number;
  distance: number;
} 
export interface VamanaStats {
    nodeCount: number;
    avgOutDegree: number;
    maxOutDegree: number;
    graphDensity: number;
    parameters: VamanaConfig;
}

export interface VamanaConfig {
    distanceFunction?: DistanceFunction;
    customDistanceFunction?: CustomDistanceFunction;
    R?: number;                    // 最大出度 (max_degree)
    L?: number;                    // 搜索时的候选列表大小 (l_search) - 修复：不是构建时的搜索宽度
    alpha?: number;                // RobustPrune参数
    beamwidth?: number;            // beam search宽度 (beam_width) - 新增
    maxIterations?: number;        // 最大迭代次数
}
 // ================ 状态管理 ================

 export interface VamanaState {
  nodes: VamanaNode[];
  medoidId: number;
  nextNodeId: number;
  distanceCache: DistanceCache;
  distanceConfig: DistanceConfig;
  config: Required<VamanaConfig>;
  hasBuilt: boolean; // 显式构建状态标志，与C++版本的_has_built保持一致
  inGraph: number[][]; // 反向图结构：inGraph[nodeId] = [指向该节点的节点ID列表]
}
export interface VamanaIndex {
    insertNode(vector: Vector, data?: NodeData): number;
    buildIndex(): void;
    searchKNN(queryVector: Vector, k?: number, searchParams?: SearchParams): SearchResult[];
    getStats(): VamanaStats;
    optimize(): void;
    getInternalState(): VamanaState; // 新增：暴露内部状态用于测试
    deleteNode(nodeId: number): boolean; // 新增：删除节点功能
  }
// ================ 类型定义 ================
export interface VamanaNode {
  vector: Float32Array;
  id: number;
  data: any;
  neighbors: number[]; // 出边邻居列表
  sqNorm?: number; // 预计算的向量平方范数，用于优化距离计算
}
