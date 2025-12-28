/**
 * 代码片段相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

/** 代码片段 */
const 代码片段Schema = z.object({
    id: z.string().describe('代码片段的唯一ID'),
    name: z.string().describe('代码片段的名称'),
    type: z.enum(['js', 'css']).describe("代码片段的类型：'js' 或 'css'"),
    enabled: z.boolean().describe('代码片段是否启用'),
    content: z.string().describe('代码片段的实际内容'),
});

export const snippetApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/snippet/getSnippet',
        en: 'getSnippet',
        zh_cn: '获取代码片段',
        description: '获取已保存的代码片段列表。可根据类型、启用状态和关键字过滤。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            type: z.enum(['js', 'css', 'all']).describe("要获取的类型：'js', 'css', 或 'all'"),
            enabled: z.number().int().min(0).max(2).describe('根据启用状态过滤：0-仅禁用, 1-仅启用, 2-全部'),
            keyword: z.string().optional().describe('可选搜索关键字'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                snippets: z.array(代码片段Schema),
            }).nullable()
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/snippet/removeSnippet',
        en: 'removeSnippet',
        zh_cn: '移除代码片段',
        description: '根据ID移除指定的代码片段。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要移除的代码片段ID'),
        }),
        zodResponseSchema: 创建响应Schema(代码片段Schema.nullable()),
    },
    {
        method: 'POST',
        endpoint: '/api/snippet/setSnippet',
        en: 'setSnippet',
        zh_cn: '设置代码片段列表',
        description: '设置全新的代码片段列表。这是全量替换操作。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            snippets: z.array(代码片段Schema).describe('完整的代码片段列表'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
] as const satisfies readonly Api定义[];

export type SnippetApiDefs = typeof snippetApiDefs;
