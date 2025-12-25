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
    embedMode?: "incremental" | "full"; // 嵌入方式：增量（默认）或全量重新嵌入
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
    reason: "new" | "outdated" | "force";
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

// =========== 语义搜索相关类型 ===========

/**
 * 语义搜索配置（独立存储于 LOCAL_SEMANTIC_SEARCH）
 * 不修改 IUILayoutTabSearchConfig，保持与 siyuan-note 数据兼容
 */
export interface ISemanticSearchConfig {
    /** 查询的数据集 ID 列表，空数组表示查询所有 */
    datasets: string[];
    /** 返回结果数量 */
    topK: number;
    /** 相似度阈值（0-1），低于此值的结果将被过滤 */
    threshold: number;
    /** 上次查询内容 */
    lastQuery?: string;
}

/**
 * 语义搜索结果
 */
export interface ISemanticSearchResult {
    /** 块 ID */
    blockId: string;
    /** 相似度分数（0-1） */
    score: number;
    /** 所属数据集 */
    dataset: string;
    /** 块内容（可选，需要额外查询） */
    content?: string | undefined;
    /** 块元数据 */
    meta?: Record<string, unknown> | undefined;
}

/**
 * 前端嵌入模型信息（默认模型，可扩展）
 */
export const FRONTEND_EMBEDDING_MODELS: Record<string, { name: string; fullName: string; dimension: number }> = {
    /** 默认前端模型 */
    default: {
        name: "text2vec-base-chinese",
        fullName: "leolee9086/text2vec-base-chinese",
        dimension: 768,
    },
    // 未来可以添加更多前端模型
};

/**
 * 判断模型是否为前端模型（可在浏览器中运行）
 */
export function isFrontendModel(modelName: string): boolean {
    const frontendModelNames = Object.values(FRONTEND_EMBEDDING_MODELS)
        .map(m => [m.name, m.fullName])
        .flat();
    return frontendModelNames.includes(modelName);
}

