/**
 * 嵌入 Dock API 封装
 * 复用 vectorApi.ts 并扩展数据集相关接口
 */

import { fetchPost } from "../../../util/fetch";
import type { IEmbeddingDataset, IDatasetStatus, IPendingBlock, IBackendDataset, IEmbeddedBlock } from "./embeddingDock.types";

// =========== 数据集配置 API ===========

const STORAGE_KEY = "embedding_datasets";

/**
 * 获取数据集列表（从本地存储）
 */
export const 获取数据集列表 = (): IEmbeddingDataset[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};
export const getDatasets = 获取数据集列表;

/**
 * 保存数据集列表（到本地存储）
 */
export const 保存数据集列表 = (datasets: IEmbeddingDataset[]): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(datasets));
};
export const saveDatasets = 保存数据集列表;

/**
 * 添加数据集
 */
export const 添加数据集 = (dataset: IEmbeddingDataset): void => {
    const datasets = 获取数据集列表();
    datasets.push(dataset);
    保存数据集列表(datasets);
};
export const addDataset = 添加数据集;

/**
 * 删除数据集
 */
export const 删除数据集 = (id: string): void => {
    const datasets = 获取数据集列表().filter(d => d.id !== id);
    保存数据集列表(datasets);
};
export const removeDataset = 删除数据集;

/**
 * 更新数据集
 */
export const 更新数据集 = (id: string, updates: Partial<IEmbeddingDataset>): void => {
    const datasets = 获取数据集列表().map(d =>
        d.id === id ? { ...d, ...updates } : d
    );
    保存数据集列表(datasets);
};
export const updateDataset = 更新数据集;

// =========== 嵌入状态 API ===========

/**
 * 获取待嵌入块列表
 * @param force 是否强制重新嵌入（跳过 hash 检查，返回所有范围内的块）
 */
export const 获取待嵌入块 = async (
    dataset: string,
    model: string,
    limit = 100,
    refresh = false,
    ids?: string[],
    force = false
): Promise<{ pending: IPendingBlock[]; total: number }> => {
    return new Promise((resolve, reject) => {
        // @内联回调
        fetchPost("/api/embedding/blocks/pending", {
            dataset,
            model,
            limit,
            refresh,
            ids,
            force,
        }, (res) => {
            if (res.code !== 0) {
                reject(new Error(res.msg || "获取待嵌入块失败"));
                return;
            }
            resolve({
                pending: res.data?.pending ?? [],
                total: res.data?.total ?? 0,
            });
        });
    });
};
export const getPendingBlocks = 获取待嵌入块;

/**
 * 推送带向量的块嵌入
 */
export const 推送块嵌入 = async (
    blocks: { id: string; vector: number[] }[],
    model: string,
    dimension: number,
    dataset = "default"
): Promise<{ pushed: number; skipped: number }> => {
    return new Promise((resolve, reject) => {
        // @内联回调
        fetchPost("/api/embedding/blocks/pushWithVectors", {
            blocks,
            model,
            dimension,
            dataset,
        }, (res) => {
            if (res.code !== 0) {
                reject(new Error(res.msg || "推送块嵌入失败"));
                return;
            }
            resolve({
                pushed: res.data?.pushed ?? 0,
                skipped: res.data?.skipped ?? 0,
            });
        });
    });
};
export const pushBlocksWithVectors = 推送块嵌入;

/**
 * 获取数据集嵌入状态
 */
export const 获取嵌入状态 = async (
    dataset: string,
    model: string
): Promise<IDatasetStatus> => {
    // 获取待嵌入数量
    const { total: pending } = await 获取待嵌入块(dataset, model, 1, false);

    // 获取已嵌入数量
    const { total: embedded } = await 获取已嵌入块(dataset, model, 1, 0);

    return {
        embedded,
        pending,
    };
};
export const getDatasetStatus = 获取嵌入状态;

// =========== 后端数据集 API ===========

/**
 * 获取后端数据集列表
 */
export const 获取后端数据集列表 = async (): Promise<IBackendDataset[]> => {
    return new Promise((resolve, reject) => {
        // @内联回调
        fetchPost("/api/embedding/datasets", {}, (res) => {
            if (res.code !== 0) {
                reject(new Error(res.msg || "获取数据集列表失败"));
                return;
            }
            resolve(res.data?.datasets ?? []);
        });
    });
};
export const getBackendDatasets = 获取后端数据集列表;

/**
 * 获取已嵌入块列表
 */
export const 获取已嵌入块 = async (
    dataset: string,
    model: string,
    limit = 100,
    offset = 0
): Promise<{ blocks: IEmbeddedBlock[]; total: number }> => {
    return new Promise((resolve, reject) => {
        // @内联回调
        fetchPost("/api/embedding/blocks/embedded", {
            dataset,
            model,
            limit,
            offset,
        }, (res) => {
            if (res.code !== 0) {
                reject(new Error(res.msg || "获取已嵌入块失败"));
                return;
            }
            resolve({
                blocks: res.data?.blocks ?? [],
                total: res.data?.total ?? 0,
            });
        });
    });
};
export const getEmbeddedBlocks = 获取已嵌入块;

/**
 * 删除 embedding 集合（两阶段确认）
 */
export const 删除嵌入集合 = async (
    collectionType: "blocks" | "assets",
    model: string
): Promise<{ needConfirm: boolean; waitSeconds?: number; deleted?: boolean }> => {
    return new Promise((resolve, reject) => {
        // @内联回调
        fetchPost("/api/embedding/collections/delete", {
            collection_type: collectionType,
            model,
        }, (res) => {
            if (res.code !== 0) {
                reject(new Error(res.msg || "删除集合失败"));
                return;
            }
            resolve({
                needConfirm: res.data?.need_confirm ?? false,
                waitSeconds: res.data?.wait_seconds,
                deleted: res.data?.deleted,
            });
        });
    });
};
export const deleteEmbeddingCollection = 删除嵌入集合;

// =========== 语义搜索 API ===========

/**
 * 使用向量查询块（语义搜索）
 * 直接传入前端生成的向量，不依赖 Ollama
 */
export interface IBlockQueryResult {
    id: string;
    score: number;
    content: string;
    hpath: string;
    meta?: Record<string, unknown>;
    // 完整块信息
    type: string;
    box: string;
    rootID: string;
    name?: string;
    alias?: string;
    memo?: string;
    tag?: string;
    ial?: string;
}

export const 使用向量查询块 = async (
    vector: number[] | Float32Array,
    model: string,
    dataset: string,
    topK = 10
): Promise<IBlockQueryResult[]> => {
    return new Promise((resolve, reject) => {
        // @内联回调
        fetchPost("/api/embedding/blocks/queryWithVector", {
            vector: Array.from(vector),
            model,
            dataset,
            top_k: topK,
        }, (res) => {
            if (res.code !== 0) {
                reject(new Error(res.msg || "查询失败"));
                return;
            }
            resolve(res.data?.results ?? []);
        });
    });
};
export const queryBlocksWithVector = 使用向量查询块;
