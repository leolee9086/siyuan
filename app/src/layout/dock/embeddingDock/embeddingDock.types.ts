/**
 * 嵌入数据集类型定义
 */

// 数据集配置（与 ICustomList 对应）
export interface IEmbeddingDataset {
    id: string;
    title: string;
    icon: string;
    type: "dynamic" | "static";
    target: string | string[];  // SQL 或 ID 列表
    model: string;              // 嵌入模型名
    scopeVersion: number;       // 范围版本号
}

// 数据集状态
export interface IDatasetStatus {
    embedded: number;   // 已嵌入数
    pending: number;    // 待处理数
    lastRefresh?: number; // 上次刷新时间戳
}

// 待嵌入块
export interface IPendingBlock {
    id: string;
    content: string;
    reason: "new" | "outdated";
}

// 嵌入进度
export interface IEmbeddingProgress {
    total: number;
    current: number;
    status: "idle" | "embedding" | "done" | "error";
    error?: string;
}

// 后端数据集信息（从 /api/embedding/datasets 返回）
export interface IBackendDataset {
    name: string;
    collectionName: string;
    type: string;  // "blocks" | "assets"
    model: string;
    dimension: number;
    count: number;
}

// 已嵌入块信息
export interface IEmbeddedBlock {
    blockId: string;
    vectorId: string;
    hash: string;
    meta?: Record<string, unknown>;
}

