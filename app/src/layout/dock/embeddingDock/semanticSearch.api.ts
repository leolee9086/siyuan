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
            continue;
        }
        groups.set(model, [ds]);
    }
    return groups;
}

/** 向量召回数量（扩大召回以提高精度） */
const RECALL_K = 100;

/**
 * 计算两个字符串的编辑距离（Levenshtein Distance）
 * 使用动态规划，空间优化为 O(min(m,n))
 */
function 计算编辑距离(a: string, b: string): number {
    if (a.length > b.length) {
        [a, b] = [b, a];  // 确保 a 是较短的字符串
    }

    const m = a.length;
    const n = b.length;

    // 空字符串情况
    if (m === 0) {
        return n;
    }

    // 使用一维数组优化空间
    let prev = new Array(m + 1);
    let curr = new Array(m + 1);

    for (let i = 0; i <= m; i++) {
        prev[i] = i;
    }

    for (let j = 1; j <= n; j++) {
        curr[0] = j;
        for (let i = 1; i <= m; i++) {
            if (a[i - 1] === b[j - 1]) {
                curr[i] = prev[i - 1];
                continue;
            }
            curr[i] = 1 + Math.min(prev[i - 1], prev[i], curr[i - 1]);
        }
        [prev, curr] = [curr, prev];
    }

    return prev[m];
}

/**
 * 计算编辑距离相似度（归一化到 0-1）
 * 1 表示完全相同，0 表示完全不同
 */
function 编辑距离相似度(query: string, content: string): number {
    // 取内容前 500 字符进行比较（避免长文本计算过慢）
    const contentTruncated = content.slice(0, 500);
    const distance = 计算编辑距离(query, contentTruncated);
    const maxLen = Math.max(query.length, contentTruncated.length);
    if (maxLen === 0) {
        return 1;
    }
    return 1 - distance / maxLen;
}

/**
 * 混合排序：结合向量相似度和编辑距离相似度
 * 使用加权平均，编辑距离权重较高以处理量化精度损失
 */
function 混合排序(
    results: ISemanticSearchResult[],
    query: string,
    vectorWeight = 0.3,
    editWeight = 0.7
): ISemanticSearchResult[] {
    const scored = results.map(item => {
        const editSim = 编辑距离相似度(query, item.content || "");
        const hybridScore = vectorWeight * item.score + editWeight * editSim;
        return { ...item, score: hybridScore };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored;
}

/**
 * 倒数排名融合 (Reciprocal Rank Fusion, RRF) 算法
 * 通过融合多个来源的排名而非原始评分，提升结果的相关性。
 * @param resultsBySource 各数据源的结果列表（每个列表应预先排好序）
 * @param k RRF 常数，通常设为 60
 */
// @内联回调
function rrf融合(resultsBySource: ISemanticSearchResult[][], k = 60): ISemanticSearchResult[] {
    const fusedScores = new Map<string, { score: number; item: ISemanticSearchResult }>();

    for (const sourceResults of resultsBySource) {
        let rank = 1;
        for (const item of sourceResults) {
            const rrfScore = 1 / (k + rank);
            const existing = fusedScores.get(item.blockId);
            if (existing) {
                existing.score += rrfScore;
            } else {
                fusedScores.set(item.blockId, { score: rrfScore, item });
            }
            rank++;
        }
    }

    // 转换为数组并按融合后的分数降序排序
    const finalResults = Array.from(fusedScores.values()).map(({ score, item }) => {
        return {
            ...item,
            score: score // 将 RRF 分数存回 score 字段
        };
    });

    finalResults.sort((a, b) => b.score - a.score);
    return finalResults;
}

/**
 * 合并同模型下多个数据集的结果
 * 同一个 blockId 出现在多个数据集时，取分数平均值
 */
function 合并同模型结果(datasetResults: ISemanticSearchResult[][]): ISemanticSearchResult[] {
    const merged = new Map<string, { total: number; count: number; item: ISemanticSearchResult }>();

    for (const results of datasetResults) {
        for (const item of results) {
            const existing = merged.get(item.blockId);
            if (existing) {
                existing.total += item.score;
                existing.count += 1;
            } else {
                merged.set(item.blockId, { total: item.score, count: 1, item });
            }
        }
    }

    // 计算平均分数并排序
    const finalResults = Array.from(merged.values()).map(({ total, count, item }) => ({
        ...item,
        score: total / count  // 平均分数
    }));

    finalResults.sort((a, b) => b.score - a.score);
    return finalResults;
}

/**
 * 执行语义搜索（内部实现）返回按模型分组的结果
 * 同模型下的多个数据集结果会合并（同ID取平均分数）
 * @param cleanQuery 原始查询文本（用于编辑距离计算）
 */
async function 执行搜索按模型分组(
    cleanQuery: string,
    modelGroups: Map<string, IEmbeddingDataset[]>,
    config: ISemanticSearchConfig
): Promise<ISemanticSearchResult[][]> {
    const resultsByModel: ISemanticSearchResult[][] = [];

    for (const [model, datasets] of modelGroups) {
        try {
            const queryVector = await 生成查询向量(cleanQuery, model);
            const datasetResults: ISemanticSearchResult[][] = [];

            for (const dataset of datasets) {
                try {
                    // 扩大召回：使用 RECALL_K 而非 topK
                    const results = await 使用向量查询块(queryVector, model, dataset.id, RECALL_K);
                    const currentDatasetResults: ISemanticSearchResult[] = [];
                    for (const r of results) {
                        // 后端返回的 score 已经是相似度（0-1，越大越相似），无需转换
                        const score = r.score;
                        if (config.threshold > 0 && score < config.threshold) {
                            continue;
                        }
                        currentDatasetResults.push({
                            blockId: r.id,
                            score,
                            dataset: dataset.id,
                            content: r.content,
                            hpath: r.hpath,
                            type: r.type,
                            box: r.box,
                            rootID: r.rootID,
                            name: r.name,
                            alias: r.alias,
                            memo: r.memo,
                            tag: r.tag,
                            ial: r.ial,
                            meta: r.meta,
                        });
                    }
                    datasetResults.push(currentDatasetResults);
                } catch (queryError) {
                    console.error(`[SemanticSearch] 查询数据集 ${dataset.id} 失败:`, queryError);
                }
            }

            // 同模型下的多个数据集结果合并（同ID取平均分数）
            const mergedResults = 合并同模型结果(datasetResults);

            // 二次排序：使用编辑距离重排序，提升精确匹配的排名
            const rerankedResults = 混合排序(mergedResults, cleanQuery);

            if (rerankedResults.length > 0) {
                resultsByModel.push(rerankedResults);
            }
        } catch (vectorError) {
            console.error(`[SemanticSearch] 模型 ${model} 生成向量失败:`, vectorError);
        }
    }

    return resultsByModel;
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

    // 4. 执行搜索并获取按模型分组的结果（同模型内已合并取平均）
    const resultsByModel = await 执行搜索按模型分组(cleanQuery, modelGroups, config);

    // 5. 融合策略：单模型直接使用，多模型间 RRF 融合
    // @内联回调
    const aggregatedResults = ((): ISemanticSearchResult[] => {
        if (resultsByModel.length === 0) {
            return [];
        }
        if (resultsByModel.length === 1) {
            // 单模型：直接使用合并后的结果（已按分数排序）
            return resultsByModel[0] ?? [];
        }
        // 多模型：使用 RRF 融合（不同模型的分数不可直接比较）
        return rrf融合(resultsByModel);
    })();

    // 6. 截取 topK
    const finalResults = aggregatedResults.slice(0, config.topK);

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

