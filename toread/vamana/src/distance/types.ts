/**
 * 距离计算模块类型定义
 */

/**
 * 支持的距离计算函数类型
 */
export type DistanceFunction = 'euclidean' | 'cosine' | 'inner_product' | 'custom';

/**
 * 自定义距离计算函数类型
 */
export type CustomDistanceFunction = (a: any, b: any) => number;

/**
 * 距离计算配置接口
 */
export interface DistanceConfig {
  /** 距离函数类型 */
  distanceFunction: DistanceFunction;
  /** 自定义距离函数（当distanceFunction为'custom'时使用） */
  customDistanceFunction?: CustomDistanceFunction;
  /** 是否对内积距离进行预处理 */
  ipPrepared?: boolean;
  /** 填充维度ID */
  paddingId?: number;
}
/**
 * LRU缓存节点接口
 */
export interface LRUNode {
  /** 缓存键 */
  key: number;
  /** 存储的距离值 */
  value: number;
  /** 前向指针（LRU链表） */
  prev: LRUNode | null;
  /** 后向指针（LRU链表） */
  next: LRUNode | null;
}