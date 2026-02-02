/**
 * 标题块相关 API 定义
 * 
 * 包含: getHeadingLevelTransaction, getHeadingChildrenIDs, appendHeadingChildren 等
 */
import { z } from 'zod';
import type { Api定义 } from '../../client/types';
import { 创建响应Schema } from '../types';
import { TransactionSchema } from './schemas';

export const headingApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/block/getHeadingLevelTransaction',
        en: 'getHeadingLevelTransaction',
        zh_cn: '获取调整标题级别的事务',
        description: '获取调整指定标题块级别所需的事务操作列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要调整级别的标题块 ID'),
            level: z.number().int().describe('新的标题级别 (1-6)'),
        }),
        zodResponseSchema: 创建响应Schema(TransactionSchema),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/getHeadingDeleteTransaction',
        en: 'getHeadingDeleteTransaction',
        zh_cn: '获取删除标题块的事务',
        description: '获取删除指定标题块所需的事务操作列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要获取删除事务的标题块 ID'),
        }),
        zodResponseSchema: 创建响应Schema(TransactionSchema),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/getHeadingInsertTransaction',
        en: 'getHeadingInsertTransaction',
        zh_cn: '获取插入标题块的事务',
        description: '获取插入标题块所需的事务操作列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('标题块的 ID'),
        }),
        zodResponseSchema: 创建响应Schema(TransactionSchema),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/getHeadingChildrenIDs',
        en: 'getHeadingChildrenIDs',
        zh_cn: '获取标题块下所有子孙块的ID',
        description: '获取指定标题块ID下的所有子孙块的ID列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('目标标题块的 ID'),
        }),
        zodResponseSchema: 创建响应Schema(z.array(z.string())),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/getHeadingChildrenDOM',
        en: 'getHeadingChildrenDOM',
        zh_cn: '获取标题块下所有子孙块的DOM',
        description: '获取指定标题块ID下的所有子孙块的DOM内容。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('目标标题块的 ID'),
            removeFoldAttr: z.boolean().optional().describe('是否移除折叠属性，默认为 true'),
        }),
        zodResponseSchema: 创建响应Schema(z.string()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/appendHeadingChildren',
        en: 'appendHeadingChildren',
        zh_cn: '追加标题块子块',
        description: '追加标题块的子块内容。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('标题块的 ID'),
            childrenDOM: z.string().describe('要追加的子块 DOM 内容'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-28',
    },
] as const satisfies readonly Api定义[];

export type HeadingApiDefs = typeof headingApiDefs;
