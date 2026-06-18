/**
 * 向量数据库API类型定义
 */

/** 导出 VectorPoint 向量点类型，包含 id、向量和可选元数据 */
export interface VectorPoint {
    id: string;
    vector: number[];
    meta?: Record<string, unknown>;
}

/**
 * 导出 QueryResult 向量查询结果类型，包含目标 id、距离分数和可选元数据。
 * 用途：向量相似度搜索的返回结果类型。
 */
export interface QueryResult {
    id: string;
    distance: number;
    meta?: Record<string, unknown>;
}

/**
 * 导出 CollectionState 向量集合状态类型，包含集合名称、维度、条目数和最大层数。
 * 用途：描述向量数据库集合的当前状态信息。
 */
export interface CollectionState {
    name: string;
    dimension: number;
    item_count: number;
    max_layer: number;
}
