/**
 * 向量数据库API客户端
 * 用于调用后端 /api/vector/* 接口
 */

import { fetchPost } from "../../network/fetch";
import type { VectorPoint, QueryResult, CollectionState } from "./vectorApi.types";
import { embeddingText } from "./transformer";

// =========== API 封装 ===========

/**
 * 创建向量集合
 */
export const 创建集合 = async (集合名称: string, 向量维度: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        // @内联回调
        fetchPost("/api/vector/collections/build", {
            collection_name: 集合名称,
            dimension: 向量维度,
        }, (res) => {
            if (res.code !== 0) {
                reject(new Error(res.msg || "创建集合失败"));
                return;
            }
            resolve();
        });
    });
};
export const createCollection = 创建集合;

/**
 * 添加向量点
 */
export const 添加向量 = async (集合名称: string, 向量点列表: VectorPoint[]): Promise<number> => {
    return new Promise((resolve, reject) => {
        // @内联回调
        fetchPost("/api/vector/add", {
            collection_name: 集合名称,
            points: 向量点列表.map(p => ({
                id: p.id,
                vector: Array.from(p.vector),
                meta: p.meta,
            })),
        }, (res) => {
            if (res.code !== 0) {
                reject(new Error(res.msg || "添加向量失败"));
                return;
            }
            resolve(res.data?.added_count ?? 0);
        });
    });
};
export const addVectors = 添加向量;

/**
 * 查询相似向量
 */
export const 查询向量 = async (
    集合名称: string,
    查询向量: number[] | Float32Array,
    返回数量 = 10,
    efSearch = 0
): Promise<QueryResult[]> => {
    return new Promise((resolve, reject) => {
        // @内联回调
        fetchPost("/api/vector/query", {
            collection_name: 集合名称,
            vector: Array.from(查询向量),
            top_k: 返回数量,
            ef_search: efSearch,
        }, (res) => {
            if (res.code !== 0) {
                reject(new Error(res.msg || "查询向量失败"));
                return;
            }
            resolve(res.data ?? []);
        });
    });
};
export const queryVectors = 查询向量;

/**
 * 删除向量
 */
export const 删除向量 = async (集合名称: string, ids: string[]): Promise<number> => {
    return new Promise((resolve, reject) => {
        // @内联回调
        fetchPost("/api/vector/delete", {
            collection_name: 集合名称,
            ids,
        }, (res) => {
            if (res.code !== 0) {
                reject(new Error(res.msg || "删除向量失败"));
                return;
            }
            resolve(res.data?.deleted_count ?? 0);
        });
    });
};
export const deleteVectors = 删除向量;

/**
 * 获取集合中所有key
 */
export const 获取所有键 = async (集合名称: string, withMeta = false): Promise<string[] | Array<{ id: string; meta?: unknown }>> => {
    return new Promise((resolve, reject) => {
        // @内联回调
        fetchPost("/api/vector/keys", {
            collection_name: 集合名称,
            with_meta: withMeta,
        }, (res) => {
            if (res.code !== 0) {
                reject(new Error(res.msg || "获取键失败"));
                return;
            }
            resolve(res.data ?? []);
        });
    });
};
export const getKeys = 获取所有键;

/**
 * 获取集合状态
 */
export const 获取集合状态 = async (集合名称: string): Promise<CollectionState> => {
    return new Promise((resolve, reject) => {
        // @内联回调
        fetchPost("/api/vector/state", {
            collection_name: 集合名称,
        }, (res) => {
            if (res.code !== 0) {
                reject(new Error(res.msg || "获取状态失败"));
                return;
            }
            resolve(res.data);
        });
    });
};
export const getCollectionState = 获取集合状态;

/**
 * 重建索引
 */
export const 重建索引 = async (集合名称: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        // @内联回调
        fetchPost("/api/vector/rebuild", {
            collection_name: 集合名称,
        }, (res) => {
            if (res.code !== 0) {
                reject(new Error(res.msg || "重建索引失败"));
                return;
            }
            resolve();
        });
    });
};
export const rebuildIndex = 重建索引;

// =========== 高级功能：文本向量化 + 存储/查询 ===========

/**
 * 向量化文本并存储到集合
 */
export const 存储文本向量 = async (
    集合名称: string,
    id: string,
    文本: string,
    meta?: Record<string, unknown>
): Promise<void> => {
    const 向量 = await embeddingText(文本);
    await 添加向量(集合名称, [{
        id,
        vector: Array.from(向量),
        meta: { ...meta, text: 文本 },
    }]);
};
export const storeTextVector = 存储文本向量;

/**
 * 用文本查询相似内容
 */
export const 文本相似查询 = async (
    集合名称: string,
    查询文本: string,
    返回数量 = 10
): Promise<QueryResult[]> => {
    const 向量 = await embeddingText(查询文本);
    return 查询向量(集合名称, 向量, 返回数量);
};
export const searchByText = 文本相似查询;

