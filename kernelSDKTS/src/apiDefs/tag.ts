/**
 * 标签相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

/** 标签信息 */
const 标签Schema = z.object({
    label: z.string().describe('标签的名称'),
    count: z.number().int().describe('标签关联的块数量'),
    blockCount: z.number().int().describe('标签关联的文档块数量'),
    hCreated: z.string().describe('标签创建时间的人类可读格式'),
    hUpdated: z.string().describe('标签最后更新时间的人类可读格式'),
});

/** 操作响应 */
const 操作响应Schema = 创建响应Schema(
    z.object({
        closeTimeout: z.number().optional().describe('操作失败时，前端弹窗的关闭延时（毫秒）'),
    }).nullable()
);

export const tagApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/tag/getTag',
        en: 'getTag',
        zh_cn: '获取所有标签列表',
        description: '获取当前工作空间的所有标签列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            sort: z.number().int().optional().describe('可选的排序模式。0: 按引用计数降序, 1-6: 其他排序方式'),
        }),
        zodResponseSchema: 创建响应Schema(z.array(标签Schema).nullable()),
    },
    {
        method: 'POST',
        endpoint: '/api/tag/removeTag',
        en: 'removeTag',
        zh_cn: '移除标签',
        description: '根据标签名称移除一个标签。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            label: z.string().describe('要移除的标签的名称'),
        }),
        zodResponseSchema: 操作响应Schema,
    },
    {
        method: 'POST',
        endpoint: '/api/tag/renameTag',
        en: 'renameTag',
        zh_cn: '重命名标签',
        description: '将一个旧标签名称重命名为一个新标签名称。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            oldLabel: z.string().describe('要重命名的旧标签名称'),
            newLabel: z.string().describe('新的标签名称'),
        }),
        zodResponseSchema: 操作响应Schema,
    },
] as const satisfies readonly Api定义[];

export type TagApiDefs = typeof tagApiDefs;
