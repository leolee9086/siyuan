/**
 * 格式化相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

const 标准空响应 = 创建响应Schema(z.null());

export const formatApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/format/autoSpace',
        en: 'autoSpace',
        zh_cn: '自动空格',
        description: '为指定块内容在中英文、数字之间自动添加空格，优化排版。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要处理的块 ID'),
        }),
        zodResponseSchema: 标准空响应,
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/format/netAssets2LocalAssets',
        en: 'netAssets2LocalAssets',
        zh_cn: '网络资源转本地资源',
        description: '将指定块内的所有外部网络资源下载并转存为本地资源。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要处理的块 ID'),
        }),
        zodResponseSchema: 标准空响应,
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/format/netImg2LocalAssets',
        en: 'netImg2LocalAssets',
        zh_cn: '网络图片转本地资源',
        description: '将指定块内的网络图片转存为本地资源。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要处理的块 ID'),
            url: z.string().optional().describe('可选。只转存指定 URL 的图片，留空则转存全部'),
        }),
        zodResponseSchema: 标准空响应,
        lastVerified: '2025-12-28',
    },
] as const satisfies readonly Api定义[];

export type FormatApiDefs = typeof formatApiDefs;
