/**
 * 嵌入 Dock API 封装
 * 复用 vectorApi.ts 并扩展数据集相关接口
 */

import { fetchPost } from "../../../util/fetch";
import type { IEmbeddingDataset, IDatasetStatus, IPendingBlock } from "./embeddingDock.types";

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
 */
export const 获取待嵌入块 = async (
    dataset: string,
    model: string,
    limit = 100,
    refresh = false
): Promise<{ pending: IPendingBlock[]; total: number }> => {
    return new Promise((resolve, reject) => {
        fetchPost("/api/embedding/blocks/pending", {
            dataset,
            model,
            limit,
            refresh,
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
    // 通过 pending 接口获取状态
    const { total } = await 获取待嵌入块(dataset, model, 1, false);

    // TODO: 需要后端提供已嵌入数量的接口
    return {
        embedded: 0, // 暂时无法获取
        pending: total,
    };
};
export const getDatasetStatus = 获取嵌入状态;
