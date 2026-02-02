/**
 * 块更新相关 API 定义
 * 
 * 包含: updateBlock, batchUpdateBlock
 */
import { z } from 'zod';
import type { Api定义 } from '../../client/types';
import { 创建响应Schema } from '../types';
import { 插入块结果Schema, 数据类型Schema } from './schemas';

export const updateApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/block/updateBlock',
        en: 'updateBlock',
        zh_cn: '更新块内容',
        description: '更新指定块ID的内容。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要更新的块 ID'),
            data: z.string().describe('新的块内容'),
            dataType: 数据类型Schema.describe('指定 data 参数的类型'),
        }),
        zodResponseSchema: 创建响应Schema(插入块结果Schema),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/batchUpdateBlock',
        en: 'batchUpdateBlock',
        zh_cn: '批量更新块内容',
        description: '批量更新多个块的内容。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            blocks: z.array(z.object({
                id: z.string().describe('要更新的块 ID'),
                data: z.string().describe('新的块内容'),
                dataType: 数据类型Schema.describe('指定 data 参数的类型'),
            })).describe('包含多个待更新块信息的数组'),
        }),
        zodResponseSchema: 创建响应Schema(插入块结果Schema),
        lastVerified: '2025-12-28',
    },
] as const satisfies readonly Api定义[];

export type UpdateApiDefs = typeof updateApiDefs;
