/**
 * 向量数据库相关 API 定义
 * 
 * 这些 API 用于操作通用向量集合。
 * 注意：blocks_embedding_* 和 assets_embedding_* 前缀的集合是 embedding 专用集合，
 * 只能通过 /api/embedding/* 接口操作，不能通过这些通用 vector API 直接操作。
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

/**
 * 向量点 Schema
 */
const VectorPointSchema = z.object({
    id: z.string().describe('向量点的唯一标识符'),
    vector: z.array(z.number()).describe('向量数据，float32 数组'),
    meta: z.any().optional().describe('可选的元数据，任意 JSON 对象'),
});

/**
 * 搜索结果 Schema
 */
const SearchResultSchema = z.object({
    id: z.string().describe('匹配的向量点 ID'),
    score: z.number().describe('匹配得分/相似度'),
    meta: z.any().optional().describe('关联的元数据'),
});

export const vectorApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/vector/collections/build',
        en: 'vectorBuildCollection',
        zh_cn: '创建向量集合',
        description: '创建一个新的向量集合。集合名称不能以 blocks_embedding_ 或 assets_embedding_ 开头，这些是 embedding 专用集合。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            collection_name: z.string().describe('集合名称，不能为空'),
            dimension: z.number().int().positive().describe('向量维度，必须大于 0'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                collection_name: z.string().describe('创建的集合名称'),
                dimension: z.number().describe('向量维度'),
            }).nullable()
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/vector/collections/delete',
        en: 'vectorDeleteCollection',
        zh_cn: '删除向量集合',
        description: '删除指定的向量集合及其所有数据。集合名称不能以 blocks_embedding_ 或 assets_embedding_ 开头。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            collection_name: z.string().describe('要删除的集合名称'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                collection_name: z.string().describe('已删除的集合名称'),
            }).nullable()
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/vector/add',
        en: 'vectorAdd',
        zh_cn: '添加向量点',
        description: '向集合中添加一个或多个向量点。每个向量点需包含 id、vector 和可选的 meta。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            collection_name: z.string().describe('目标集合名称'),
            points: z.array(VectorPointSchema).describe('要添加的向量点数组'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                added_count: z.number().describe('成功添加的向量点数量'),
            }).nullable()
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/vector/delete',
        en: 'vectorDelete',
        zh_cn: '删除向量点',
        description: '根据 ID 列表删除集合中的向量点。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            collection_name: z.string().describe('目标集合名称'),
            ids: z.array(z.string()).describe('要删除的向量点 ID 列表'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                deleted_count: z.number().describe('成功删除的向量点数量'),
            }).nullable()
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/vector/query',
        en: 'vectorQuery',
        zh_cn: '向量相似性搜索',
        description: '在集合中搜索与给定向量最相似的 top_k 个结果。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            collection_name: z.string().describe('目标集合名称'),
            vector: z.array(z.number()).describe('查询向量'),
            top_k: z.number().int().positive().optional().describe('返回最相似的前 k 个结果，默认为 10'),
            limit: z.number().int().positive().optional().describe('top_k 的别名，兼容旧参数'),
            ef_search: z.number().int().optional().describe('HNSW 搜索参数，越大越精确但越慢'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.array(SearchResultSchema).describe('搜索结果数组')
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/vector/keys',
        en: 'vectorKeys',
        zh_cn: '获取向量点列表',
        description: '获取集合中所有向量点的 ID 列表，可选择是否包含元数据。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            collection_name: z.string().describe('目标集合名称'),
            with_meta: z.boolean().optional().describe('是否同时返回元数据，默认为 false'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.union([
                z.array(z.string()).describe('仅 ID 列表 (when with_meta=false)'),
                z.array(z.object({
                    id: z.string().describe('向量点 ID'),
                    meta: z.any().optional().describe('元数据'),
                })).describe('包含元数据的对象数组 (when with_meta=true)'),
            ])
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/vector/state',
        en: 'vectorState',
        zh_cn: '获取集合状态',
        description: '获取向量集合的当前状态信息，包括维度、记录数等。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            collection_name: z.string().describe('目标集合名称'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                name: z.string().describe('集合名称'),
                dimension: z.number().describe('向量维度'),
                item_count: z.number().describe('向量点数量'),
                max_layer: z.number().describe('HNSW 索引最大层数'),
            }).nullable()
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/vector/rebuild',
        en: 'vectorRebuild',
        zh_cn: '重建索引',
        description: '重建集合的 HNSW 索引。在大量增删操作后可以重建索引来优化搜索性能。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            collection_name: z.string().describe('目标集合名称'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-29',
    },
] as const satisfies readonly Api定义[];

export type VectorApiDefs = typeof vectorApiDefs;
