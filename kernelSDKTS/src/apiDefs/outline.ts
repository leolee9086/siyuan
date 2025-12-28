/**
 * 大纲相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

/** 大纲条目 Schema (递归结构) */
const 大纲条目Schema: z.ZodType<{
    id: string;
    depth: number;
    text: string;
    blockCount: number;
    subType: string;
    children?: unknown[];
}> = z.lazy(() =>
    z.object({
        id: z.string().describe('标题块的唯一标识符 (ID)'),
        depth: z.number().int().describe('标题的层级深度，例如 H1 为 0，H2 为 1'),
        text: z.string().describe('标题块的文本内容'),
        blockCount: z.number().int().describe('该标题下的内容块数量'),
        subType: z.string().describe("标题块的子类型，例如 'h1', 'h2', 'h3' 等"),
        children: z.array(大纲条目Schema).optional().describe('子标题数组'),
    })
);

export const outlineApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/outline/getDocOutline',
        en: 'getDocOutline',
        zh_cn: '获取文档大纲',
        description: '获取指定文档块的层级大纲结构。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('必需。要获取大纲的文档块的 ID。'),
            preview: z.boolean().optional().default(false).describe('可选。是否为预览模式获取大纲，默认为 false。'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.array(大纲条目Schema).nullable().describe('文档的大纲结构数组。')
        ),
    },
] as const satisfies readonly Api定义[];

export type OutlineApiDefs = typeof outlineApiDefs;
