/**
 * 语义搜索 API
 * 支持前端嵌入（Transformer.js）和后端嵌入（Ollama）两种模式
 * 支持跨数据集、多模型查询
 */

import { fetchPost } from "../../../util/fetch";
import { embeddingText } from "../../../util/embedding/transformer";
import type { ISemanticSearchResult, ISemanticSearchConfig, IEmbeddingDataset } from "./embeddingDock.types";
import { isFrontendModel, FRONTEND_EMBEDDING_MODELS } from "./embeddingDock.types";
import { 获取数据集列表, 使用向量查询块 } from "./embeddingDock.api";
import { Constants } from "../../../constants";
import { setStorageVal } from "../../../protyle/util/compatibility";

// =========== 查询语法解析 ===========

/**
 * 解析语义搜索查询，提取数据集指定前缀
 */
export function 解析语义查询(input: string, 默认数据集: string[]): {
    datasets: string[];  // 最终要查询的数据集列表
    query: string;       // 去除前缀后的查询文本
} {
    // 匹配 @dataset: 或 @[d1,d2]: 或 @*:
    const prefixMatch = input.match(/^@(\*|\[[\w,\-]+\]|[\w\-]+):\s*/);

    if (!prefixMatch) {
        // 无前缀，使用默认配置
        return {
            datasets: 默认数据集,
            query: input
        };
    }

    const datasetStr = prefixMatch[1] ?? "";
    const query = input.slice(prefixMatch[0].length);

    if (datasetStr === "*") {
        return { datasets: [], query };  // 空数组 = 查询全部
    }
    if (datasetStr.startsWith("[")) {
        // 多数据集: @[a,b,c]:
        const datasets = datasetStr.slice(1, -1).split(",").map(s => s.trim());
        return { datasets, query };
    }
    // 单数据集: @work-notes:
    return { datasets: [datasetStr], query };
}
export const parseSemanticQuery = 解析语义查询;

// =========== 向量生成 ===========

/**
 * 为指定模型生成查询向量
 * 前端模型使用 Transformer.js，后端模型调用 Ollama API
 */
export async function 生成查询向量(query: string, model: string): Promise<Float32Array> {
    // 检查是否为前端模型
    if (isFrontendModel(model)) {
        console.log(`[SemanticSearch] 使用前端模型 ${model} 生成查询向量`);
        return await embeddingText(query);
    }

    // 后端模型：调用 Ollama API
    console.log(`[SemanticSearch] 使用后端模型 ${model} 生成查询向量`);
    return new Promise((resolve, reject) => {
        // @内联回调
        fetchPost("/api/embedding/embed", {
            text: query,
            model: model,
        }, (res) => {
            if (res.code !== 0) {
                reject(new Error(res.msg || `后端嵌入失败: ${model}`));
                return;
            }
            if (!res.data?.vector) {
                reject(new Error("后端返回的向量为空"));
                return;
            }
            resolve(new Float32Array(res.data.vector));
        });
    });
}
export const generateQueryVector = 生成查询向量;

// =========== 语义搜索核心 ===========

/** 默认前端模型名称 */
const DEFAULT_MODEL = FRONTEND_EMBEDDING_MODELS.default?.name ?? "text2vec-base-chinese";

/**
 * 按模型分组数据集
 */
function 按模型分组数据集(datasets: IEmbeddingDataset[]): Map<string, IEmbeddingDataset[]> {
    const groups = new Map<string, IEmbeddingDataset[]>();
    for (const ds of datasets) {
        const model = ds.model || DEFAULT_MODEL;
        const existingGroup = groups.get(model);
        if (existingGroup) {
            existingGroup.push(ds);
        } else {
            groups.set(model, [ds]);
        }
    }
    return groups;
}

/**
 * 将距离转换为相似度分数
 * 向量搜索返回的是距离（越小越相似），我们需要转换为分数（越大越相似）
 * 使用 1 / (1 + distance) 公式，结果范围 (0, 1]
 */
function 距离转相似度(distance: number): number {
    return 1 / (1 + distance);
}

/**
 * 执行语义搜索（内部实现）
 */
async function 执行搜索核心(
    cleanQuery: string,
    modelGroups: Map<string, IEmbeddingDataset[]>,
    config: ISemanticSearchConfig
): Promise<ISemanticSearchResult[]> {
    const allResults: ISemanticSearchResult[] = [];

    for (const [model, datasets] of modelGroups) {
        console.log(`[SemanticSearch] 处理模型 ${model}，包含 ${datasets.length} 个数据集`);

        try {
            // 生成该模型的查询向量
            const queryVector = await 生成查询向量(cleanQuery, model);
            console.log(`[SemanticSearch] 模型 ${model} 向量维度: ${queryVector.length}`);

            // 查询每个数据集
            for (const dataset of datasets) {
                console.log(`[SemanticSearch] 查询数据集: ${dataset.id}`);

                try {
                    // 使用 embedding API 查询（会自动处理集合名称）
                    const results = await 使用向量查询块(
                        queryVector,
                        model,
                        dataset.id,
                        config.topK
                    );

                    // 转换结果格式
                    for (const r of results) {
                        // embedding API 返回的是 score（距离，越小越的相似）
                        // 转换为相似度分数（越大越相似）
                        const score = 距离转相似度(r.score);

                        // 过滤低于阈值的结果
                        if (config.threshold > 0 && score < config.threshold) {
                            continue;
                        }

                        allResults.push({
                            blockId: r.id,
                            score,
                            dataset: dataset.id,
                            meta: r.meta,
                        });
                    }

                    console.log(`[SemanticSearch] 数据集 ${dataset.id} 返回 ${results.length} 条结果`);
                } catch (queryError) {
                    console.error(`[SemanticSearch] 查询数据集 ${dataset.id} 失败:`, queryError);
                    // 继续查询其他集合
                }
            }
        } catch (vectorError) {
            console.error(`[SemanticSearch] 模型 ${model} 生成向量失败:`, vectorError);
            // 继续处理其他模型
        }
    }

    return allResults;
}

/**
 * 执行语义搜索
 * @param query 查询文本
 * @param config 搜索配置
 * @returns 搜索结果列表（按相似度降序）
 */
export async function 语义搜索(
    query: string,
    config: ISemanticSearchConfig
): Promise<ISemanticSearchResult[]> {
    console.log("[SemanticSearch] ========== 开始语义搜索 ==========");
    console.log(`[SemanticSearch] 查询: "${query.substring(0, 50)}${query.length > 50 ? "..." : ""}"`);
    console.log("[SemanticSearch] 配置:", config);

    // 1. 解析查询语法
    const { datasets: targetDatasetIds, query: cleanQuery } = 解析语义查询(query, config.datasets);
    console.log(`[SemanticSearch] 目标数据集: ${targetDatasetIds.length === 0 ? "全部" : targetDatasetIds.join(", ")}`);

    // 2. 获取前端数据集配置（从 localStorage）
    const allDatasets = 获取数据集列表();
    console.log(`[SemanticSearch] 数据集配置总数: ${allDatasets.length}`);
    const targetDatasets = targetDatasetIds.length === 0
        ? allDatasets
        : allDatasets.filter(ds => targetDatasetIds.includes(ds.id));  // 使用 id 进行匹配

    if (targetDatasets.length === 0) {
        console.warn("[SemanticSearch] 没有找到匹配的数据集。请先在 Embedding Dock 中创建数据集并进行嵌入。");
        return [];
    }
    console.log(`[SemanticSearch] 实际查询 ${targetDatasets.length} 个数据集`);

    // 3. 按模型分组
    const modelGroups = 按模型分组数据集(targetDatasets);
    console.log(`[SemanticSearch] 涉及 ${modelGroups.size} 个不同模型`);

    // 4. 执行搜索
    const allResults = await 执行搜索核心(cleanQuery, modelGroups, config);

    // 5. 按分数排序并截取 topK
    allResults.sort((a, b) => b.score - a.score);
    const finalResults = allResults.slice(0, config.topK);

    console.log(`[SemanticSearch] 最终返回 ${finalResults.length} 条结果`);
    console.log("[SemanticSearch] ========== 语义搜索完成 ==========");

    return finalResults;
}
export const semanticSearch = 语义搜索;

// =========== 配置管理 ===========

/**
 * 获取语义搜索配置
 */
export function 获取语义搜索配置(): ISemanticSearchConfig {
    const siyuanGlobal = (globalThis as { siyuan?: { storage?: Record<string, unknown> } }).siyuan;
    const stored = siyuanGlobal?.storage?.[Constants.LOCAL_SEMANTIC_SEARCH];
    if (stored && typeof stored === "object") {
        return stored as ISemanticSearchConfig;
    }
    // 返回默认配置
    return {
        datasets: [],
        topK: 10,
        threshold: 0,
    };
}
export const getSemanticSearchConfig = 获取语义搜索配置;

/**
 * 保存语义搜索配置
 */
export function 保存语义搜索配置(config: ISemanticSearchConfig): void {
    const siyuanGlobal = (globalThis as { siyuan?: { storage?: Record<string, unknown> } }).siyuan;
    if (siyuanGlobal?.storage) {
        siyuanGlobal.storage[Constants.LOCAL_SEMANTIC_SEARCH] = config;
        setStorageVal(Constants.LOCAL_SEMANTIC_SEARCH, config);
    }
}
export const saveSemanticSearchConfig = 保存语义搜索配置;

