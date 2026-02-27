/**
 * 向量数据库API类型定义
 */

export interface VectorPoint {
    id: string;
    vector: number[];
    meta?: Record<string, unknown>;
}

export interface QueryResult {
    id: string;
    distance: number;
    meta?: Record<string, unknown>;
}

export interface CollectionState {
    name: string;
    dimension: number;
    item_count: number;
    max_layer: number;
}
