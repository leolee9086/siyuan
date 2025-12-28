/**
 * 嵌入 (Embedding) 相关 API 定义
 * 
 * 这些 API 用于管理块和素材的向量嵌入，支持通过 Ollama 服务生成嵌入向量，
 * 也支持前端预计算向量后直接入库。
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

/**
 * 嵌入服务状态 Schema
 */
const EmbeddingStatusSchema = z.object({
    ollama_enabled: z.boolean().describe('Ollama 服务是否启用'),
    ollama_endpoint: z.string().optional().describe('Ollama API 端点'),
    current_model: z.string().optional().describe('当前使用的嵌入模型'),
    dimension: z.number().optional().describe('当前模型的向量维度'),
});

/**
 * 待嵌入块信息 Schema (简化版)
 */
const PendingBlockSchema = z.object({
    id: z.string().describe('块 ID'),
    content: z.string().describe('块内容文本'),
});

/**
 * 搜索结果 Schema
 */
const EmbeddingSearchResultSchema = z.object({
    id: z.string().describe('匹配的 ID'),
    score: z.number().describe('匹配得分/相似度'),
    meta: z.any().optional().describe('关联的元数据'),
});

/**
 * 带向量的块数据 Schema (用于 pushWithVectors)
 */
const BlockWithVectorSchema = z.object({
    id: z.string().describe('块 ID'),
    vector: z.array(z.number()).describe('预计算的向量'),
});

/**
 * 带向量的素材数据 Schema
 */
const AssetWithVectorSchema = z.object({
    path: z.string().describe('素材路径'),
    vector: z.array(z.number()).describe('预计算的向量'),
});

/**
 * 模型信息 Schema
 */
const ModelInfoSchema = z.object({
    name: z.string().describe('模型名称'),
    size: z.number().optional().describe('模型大小 (bytes)'),
    parameter_size: z.string().optional().describe('参数量描述'),
});

/**
 * 数据集信息 Schema
 */
const DatasetInfoSchema = z.object({
    name: z.string().describe('数据集名称'),
    type: z.enum(['blocks', 'assets']).describe('类型：blocks 或 assets'),
    model: z.string().describe('使用的模型'),
    count: z.number().describe('记录数量'),
});

export const embeddingApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/embedding/status',
        en: 'embeddingStatus',
        zh_cn: '获取嵌入服务状态',
        description: '获取嵌入服务的当前状态，包括 Ollama 是否启用、当前模型等信息。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(EmbeddingStatusSchema),
    },
    {
        method: 'POST',
        endpoint: '/api/embedding/datasets',
        en: 'embeddingDatasets',
        zh_cn: '获取数据集列表',
        description: '获取所有已创建的 embedding 数据集列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(
            z.object({
                datasets: z.array(DatasetInfoSchema).describe('数据集列表'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/embedding/blocks/push',
        en: 'embeddingBlocksPush',
        zh_cn: '推送块嵌入',
        description: '将指定块推送到嵌入队列，由 Ollama 计算向量并存储。需要 Ollama 服务启用。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            ids: z.array(z.string()).describe('要嵌入的块 ID 列表'),
            dataset: z.string().optional().describe('目标数据集名称，默认为 "default"'),
            model: z.string().optional().describe('使用的嵌入模型，默认使用当前配置的模型'),
            force: z.boolean().optional().describe('是否强制重新嵌入，忽略 hash 检查'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                pushed: z.number().describe('成功推送的块数量'),
                skipped: z.number().describe('跳过的块数量（已存在或未变化）'),
                model: z.string().describe('使用的模型名称'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/embedding/blocks/pushWithVectors',
        en: 'embeddingBlocksPushWithVectors',
        zh_cn: '使用预计算向量推送块嵌入',
        description: '直接传入预计算好的向量数据推送块嵌入，不调用 Ollama。适用于前端/第三方服务计算向量的场景。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            blocks: z.array(BlockWithVectorSchema).describe('带向量的块数据列表'),
            dimension: z.number().int().positive().describe('向量维度，必须大于 0'),
            model: z.string().describe('模型名称，用于确定目标集合'),
            dataset: z.string().optional().describe('目标数据集名称，默认为 "default"'),
            force: z.boolean().optional().describe('是否强制覆盖已存在的嵌入'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                pushed: z.number().describe('成功推送的块数量'),
                skipped: z.number().describe('跳过的块数量'),
                model: z.string().describe('使用的模型名称'),
                dimension: z.number().describe('向量维度'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/embedding/blocks/query',
        en: 'embeddingBlocksQuery',
        zh_cn: '查询相似块',
        description: '根据文本查询找到语义最相似的块。需要 Ollama 服务计算查询文本的向量。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            query: z.string().describe('查询文本'),
            top_k: z.number().int().positive().optional().describe('返回最相似的前 k 个结果，默认为 10'),
            dataset: z.string().optional().describe('目标数据集名称，默认为 "default"'),
            model: z.string().optional().describe('使用的嵌入模型'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                results: z.array(EmbeddingSearchResultSchema).describe('搜索结果'),
                model: z.string().describe('使用的模型名称'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/embedding/blocks/queryWithVector',
        en: 'embeddingBlocksQueryWithVector',
        zh_cn: '使用向量查询相似块',
        description: '直接使用预计算的向量查询相似块，不依赖 Ollama。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            vector: z.array(z.number()).describe('查询向量'),
            top_k: z.number().int().positive().optional().describe('返回最相似的前 k 个结果，默认为 10'),
            dataset: z.string().optional().describe('目标数据集名称，默认为 "default"'),
            model: z.string().describe('模型名称，用于确定目标集合'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                results: z.array(EmbeddingSearchResultSchema).describe('搜索结果'),
                model: z.string().describe('使用的模型名称'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/embedding/blocks/pending',
        en: 'embeddingBlocksPending',
        zh_cn: '获取待嵌入块列表',
        description: '获取尚未嵌入或需要更新的块列表。用于增量同步块嵌入。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            model: z.string().describe('模型名称'),
            dataset: z.string().optional().describe('目标数据集名称，默认为 "default"'),
            box: z.string().optional().describe('限定笔记本 ID'),
            limit: z.number().int().positive().optional().describe('最大返回数量，默认为 100'),
            ids: z.array(z.string()).optional().describe('精准同步名单，只检查这些 ID'),
            force: z.boolean().optional().describe('是否强制返回所有块，忽略 hash 检查'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                pending: z.array(PendingBlockSchema).describe('待嵌入的块列表'),
                total: z.number().describe('待嵌入块总数'),
                model: z.string().describe('使用的模型名称'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/embedding/blocks/embedded',
        en: 'embeddingBlocksEmbedded',
        zh_cn: '获取已嵌入块列表',
        description: '获取已完成嵌入的块 ID 列表，支持分页。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            model: z.string().describe('模型名称'),
            dataset: z.string().optional().describe('目标数据集名称，默认为 "default"'),
            limit: z.number().int().positive().optional().describe('每页数量，默认为 100'),
            offset: z.number().int().nonnegative().optional().describe('偏移量，默认为 0'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                blocks: z.array(z.string()).describe('已嵌入的块 ID 列表'),
                total: z.number().describe('已嵌入块总数'),
                model: z.string().describe('使用的模型名称'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/embedding/assets/push',
        en: 'embeddingAssetsPush',
        zh_cn: '推送素材嵌入',
        description: '将指定素材推送到嵌入队列，由 Ollama 计算向量并存储。需要 Ollama 服务启用。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            paths: z.array(z.string()).describe('要嵌入的素材路径列表'),
            dataset: z.string().optional().describe('目标数据集名称，默认为 "default"'),
            model: z.string().optional().describe('使用的嵌入模型'),
            force: z.boolean().optional().describe('是否强制重新嵌入'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                pushed: z.number().describe('成功推送的素材数量'),
                skipped: z.number().describe('跳过的素材数量'),
                model: z.string().describe('使用的模型名称'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/embedding/assets/pushWithVectors',
        en: 'embeddingAssetsPushWithVectors',
        zh_cn: '使用预计算向量推送素材嵌入',
        description: '直接传入预计算好的向量数据推送素材嵌入，不调用 Ollama。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            assets: z.array(AssetWithVectorSchema).describe('带向量的素材数据列表'),
            dimension: z.number().int().positive().describe('向量维度，必须大于 0'),
            model: z.string().describe('模型名称，用于确定目标集合'),
            dataset: z.string().optional().describe('目标数据集名称，默认为 "default"'),
            force: z.boolean().optional().describe('是否强制覆盖已存在的嵌入'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                pushed: z.number().describe('成功推送的素材数量'),
                skipped: z.number().describe('跳过的素材数量'),
                model: z.string().describe('使用的模型名称'),
                dimension: z.number().describe('向量维度'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/embedding/assets/query',
        en: 'embeddingAssetsQuery',
        zh_cn: '查询相似素材',
        description: '根据文本查询找到语义最相似的素材。需要 Ollama 服务计算查询文本的向量。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            query: z.string().describe('查询文本'),
            top_k: z.number().int().positive().optional().describe('返回最相似的前 k 个结果，默认为 10'),
            dataset: z.string().optional().describe('目标数据集名称，默认为 "default"'),
            model: z.string().optional().describe('使用的嵌入模型'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                results: z.array(EmbeddingSearchResultSchema).describe('搜索结果'),
                model: z.string().describe('使用的模型名称'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/embedding/assets/pending',
        en: 'embeddingAssetsPending',
        zh_cn: '获取待嵌入素材列表',
        description: '获取尚未嵌入或需要更新的素材列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            dataset: z.string().optional().describe('目标数据集名称，默认为 "default"'),
            limit: z.number().int().positive().optional().describe('最大返回数量，默认为 100'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                pending: z.array(z.object({
                    path: z.string().describe('素材路径'),
                })).describe('待嵌入的素材列表'),
                total: z.number().describe('待嵌入素材总数'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/embedding/collections/delete',
        en: 'embeddingCollectionsDelete',
        zh_cn: '删除嵌入集合',
        description: '删除指定类型和模型对应的嵌入集合。这是一个两阶段确认操作。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            collection_type: z.enum(['blocks', 'assets']).describe('集合类型：blocks 或 assets'),
            model: z.string().describe('模型名称'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                status: z.string().optional().describe('操作状态'),
                message: z.string().optional().describe('操作消息'),
            }).nullable()
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/embedding/models',
        en: 'embeddingModels',
        zh_cn: '获取模型列表',
        description: '获取本地可用的嵌入模型列表。需要 Ollama 服务启用。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(
            z.object({
                models: z.array(ModelInfoSchema).describe('可用模型列表'),
                current_model: z.string().describe('当前使用的模型'),
                recommended_models: z.array(z.string()).describe('推荐的嵌入模型列表'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/embedding/models/pull',
        en: 'embeddingPullModel',
        zh_cn: '拉取模型',
        description: '从 Ollama 拉取（下载）指定的嵌入模型。这是一个同步阻塞操作，可能需要较长时间。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            model: z.string().describe('要拉取的模型名称'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                model: z.string().describe('拉取的模型名称'),
                status: z.string().describe('拉取状态'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/embedding/models/set',
        en: 'embeddingSetModel',
        zh_cn: '设置当前模型',
        description: '设置当前使用的嵌入模型。需要 Ollama 服务启用。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            model: z.string().describe('要设置的模型名称'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                model: z.string().describe('设置后的模型名称'),
                dimension: z.number().describe('模型的向量维度'),
            })
        ),
    },
] as const satisfies readonly Api定义[];

export type EmbeddingApiDefs = typeof embeddingApiDefs;
