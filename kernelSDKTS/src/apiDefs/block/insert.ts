/**
 * 块插入相关 API 定义
 * 
 * 包含: appendBlock, prependBlock, insertBlock, batchInsertBlock 等
 */
import { z } from 'zod';
import type { Api定义 } from '../../client/types';
import { 创建响应Schema } from '../types';
import { 插入块结果Schema, 数据类型Schema } from './schemas';

export const insertApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/block/appendBlock',
        en: 'appendBlock',
        zh_cn: '插入后置子块',
        description: '在指定父块的末尾插入新的子块。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            data: z.string().describe('要插入的内容'),
            dataType: 数据类型Schema.describe('指定 data 参数的类型'),
            parentID: z.string().describe('父块的 ID'),
        }),
        zodResponseSchema: 创建响应Schema(插入块结果Schema),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/prependBlock',
        en: 'prependBlock',
        zh_cn: '插入前置子块',
        description: '在指定父块的开头插入新的子块。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            data: z.string().describe('要插入的内容'),
            dataType: 数据类型Schema.describe('指定 data 参数的类型'),
            parentID: z.string().describe('父块的 ID'),
        }),
        zodResponseSchema: 创建响应Schema(插入块结果Schema),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/insertBlock',
        en: 'insertBlock',
        zh_cn: '插入块',
        description: '在指定位置插入新的内容块。通过 previousID 指定插入到某块之后，通过 nextID 指定插入到某块之前，通过 parentID 指定作为子块插入。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            data: z.string().describe('要插入的内容'),
            dataType: 数据类型Schema.describe('指定 data 参数的类型'),
            parentID: z.string().optional().describe('父块的 ID，插入为其子块'),
            previousID: z.string().optional().describe('前一个同级块的 ID，插入在其后'),
            nextID: z.string().optional().describe('后一个同级块的 ID，插入在其前'),
        }),
        zodResponseSchema: 创建响应Schema(插入块结果Schema),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/batchInsertBlock',
        en: 'batchInsertBlock',
        zh_cn: '批量插入块',
        description: '批量插入新的内容块。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            blocks: z.array(z.object({
                data: z.string().describe('要插入的内容'),
                dataType: 数据类型Schema.describe('指定 data 参数的类型'),
                parentID: z.string().optional().describe('父块的 ID'),
                previousID: z.string().optional().describe('前一个同级块的 ID'),
                nextID: z.string().optional().describe('后一个同级块的 ID'),
            })).describe('包含多个待插入块信息的数组'),
        }),
        zodResponseSchema: 创建响应Schema(插入块结果Schema),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/batchAppendBlock',
        en: 'batchAppendBlock',
        zh_cn: '批量后置插入块',
        description: '在指定父块的末尾批量插入新的子块。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            blocks: z.array(z.object({
                data: z.string().describe('要插入的内容'),
                dataType: 数据类型Schema.describe('指定 data 参数的类型'),
                parentID: z.string().describe('父块的 ID'),
            })).describe('包含多个待插入块信息的数组'),
        }),
        zodResponseSchema: 创建响应Schema(插入块结果Schema),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/batchPrependBlock',
        en: 'batchPrependBlock',
        zh_cn: '批量前置插入块',
        description: '在指定父块的开头批量插入新的子块。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            blocks: z.array(z.object({
                data: z.string().describe('要插入的内容'),
                dataType: 数据类型Schema.describe('指定 data 参数的类型'),
                parentID: z.string().describe('父块的 ID'),
            })).describe('包含多个待插入块信息的数组'),
        }),
        zodResponseSchema: 创建响应Schema(插入块结果Schema),
        lastVerified: '2025-12-28',
    },
    // 日记块
    {
        method: 'POST',
        endpoint: '/api/block/appendDailyNoteBlock',
        en: 'appendDailyNoteBlock',
        zh_cn: '追加日记块',
        description: '向指定笔记本的当日日记文档末尾追加新的内容块。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            data: z.string().describe('要追加的内容'),
            dataType: 数据类型Schema.describe('指定 data 参数的类型'),
            notebook: z.string().describe('目标笔记本的 ID'),
        }),
        zodResponseSchema: 创建响应Schema(插入块结果Schema),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/prependDailyNoteBlock',
        en: 'prependDailyNoteBlock',
        zh_cn: '前置追加日记块',
        description: '在指定笔记本的当日日记文档开头追加新的内容块。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            data: z.string().describe('要追加的内容'),
            dataType: 数据类型Schema.describe('指定 data 参数的类型'),
            notebook: z.string().describe('目标笔记本的 ID'),
        }),
        zodResponseSchema: 创建响应Schema(插入块结果Schema),
        lastVerified: '2025-12-28',
    },
] as const satisfies readonly Api定义[];
