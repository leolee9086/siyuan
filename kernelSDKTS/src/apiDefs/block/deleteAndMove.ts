/**
 * 块删除与移动相关 API 定义
 * 
 * 包含: deleteBlock, moveBlock, moveOutlineHeading
 */
import { z } from 'zod';
import type { Api定义 } from '../../client/types';
import { 创建响应Schema } from '../types';
import { 插入块结果Schema } from './schemas';

export const deleteAndMoveApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/block/deleteBlock',
        en: 'deleteBlock',
        zh_cn: '删除块',
        description: '删除指定的块ID。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要删除的块 ID'),
        }),
        zodResponseSchema: 创建响应Schema(插入块结果Schema),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/moveBlock',
        en: 'moveBlock',
        zh_cn: '移动块',
        description: '将指定的块移动到新的父块下或同级块的特定位置。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要移动的块的 ID'),
            parentID: z.string().optional().describe('新的父块 ID'),
            previousID: z.string().optional().describe('新的前一个同级块的 ID'),
        }),
        zodResponseSchema: 创建响应Schema(插入块结果Schema),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/moveOutlineHeading',
        en: 'moveOutlineHeading',
        zh_cn: '移动大纲标题块',
        description: '移动大纲中的标题块到新的父级或同级位置。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要移动的大纲标题块的 ID'),
            parentID: z.string().optional().describe('新的父块 ID'),
            previousID: z.string().optional().describe('新的前一个同级标题块的 ID'),
        }),
        zodResponseSchema: 创建响应Schema(插入块结果Schema),
        lastVerified: '2025-12-28',
    },
    // 折叠/展开
    {
        method: 'POST',
        endpoint: '/api/block/foldBlock',
        en: 'foldBlock',
        zh_cn: '折叠块',
        description: '折叠指定的块ID。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要折叠的块 ID'),
        }),
        zodResponseSchema: 创建响应Schema(插入块结果Schema),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/unfoldBlock',
        en: 'unfoldBlock',
        zh_cn: '展开块',
        description: '展开指定的块ID。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要展开的块 ID'),
        }),
        zodResponseSchema: 创建响应Schema(插入块结果Schema),
        lastVerified: '2025-12-28',
    },
] as const satisfies readonly Api定义[];
