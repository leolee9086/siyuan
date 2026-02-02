/**
 * 块其他 API 定义
 * 
 * 包含: setBlockReminder
 */
import { z } from 'zod';
import type { Api定义 } from '../../client/types';
import { 创建响应Schema } from '../types';

export const miscApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/block/setBlockReminder',
        en: 'setBlockReminder',
        zh_cn: '设置块提醒时间',
        description: '为指定的块ID设置一个提醒时间。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要设置提醒的块 ID'),
            timed: z.string().describe('提醒时间，格式为 yyyyMMddHHmmss'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-28',
    },
] as const satisfies readonly Api定义[];

export type MiscApiDefs = typeof miscApiDefs;
