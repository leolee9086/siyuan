/**
 * 块属性相关 API 定义
 * 处理块的自定义属性的获取、设置和重置
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema, BlockId, 空请求Schema } from './types';

export const attrApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/attr/batchGetBlockAttrs',
        en: 'batchGetBlockAttrs',
        zh_cn: '批量获取块属性',
        description: '根据提供的块 ID 列表，批量获取这些块的所有自定义属性。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            ids: z.array(BlockId).describe('要获取属性的块 ID 数组'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.record(z.record(z.string())).describe('一个对象，键为块 ID，值为该块的属性对象 (属性名: 属性值)'),
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/attr/batchSetBlockAttrs',
        en: 'batchSetBlockAttrs',
        zh_cn: '批量设置块属性',
        description: '根据提供的块 ID 和对应的属性集，批量为这些块设置自定义属性。如果属性值为 null，则表示删除该属性。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            blockAttrs: z.array(z.object({
                id: BlockId.describe('块 ID'),
                attrs: z.record(z.string().nullable()).describe('要设置的属性对象 (属性名: 属性值)。如果属性值为 null，则删除该属性。'),
            })).describe('包含多个块属性设置的对象数组'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
    {
        method: 'POST',
        endpoint: '/api/attr/getBlockAttrs',
        en: 'getBlockAttrs',
        zh_cn: '获取块属性',
        description: '获取指定块 ID 的所有自定义属性。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: BlockId.describe('要获取属性的块 ID'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.record(z.string()).describe('该块的属性对象 (属性名: 属性值)'),
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/attr/getBookmarkLabels',
        en: 'getBookmarkLabels',
        zh_cn: '获取书签标签',
        description: '获取当前工作空间中所有书签使用过的标签列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: 空请求Schema,
        zodResponseSchema: 创建响应Schema(
            z.array(z.string()).describe('书签标签字符串数组'),
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/attr/resetBlockAttrs',
        en: 'resetBlockAttrs',
        zh_cn: '重置块属性',
        description: '重置指定块的若干属性。此操作通常用于删除属性，但需要提供属性的当前期望值进行匹配后才会执行。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: BlockId.describe('要重置属性的块 ID'),
            attrs: z.record(z.string()).describe('要重置的属性对象 (属性名: 期望的当前属性值)。只有当块的属性值与此处提供的值匹配时，该属性才会被移除。'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
    {
        method: 'POST',
        endpoint: '/api/attr/setBlockAttrs',
        en: 'setBlockAttrs',
        zh_cn: '设置块属性',
        description: '为指定的单个块设置自定义属性。如果属性值为 null，则表示删除该属性。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: BlockId.describe('要设置属性的块 ID'),
            attrs: z.record(z.string().nullable()).describe('要设置的属性对象 (属性名: 属性值)。如果属性值为 null，则删除该属性。'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
] as const satisfies readonly Api定义[];

export type AttrApiDefs = typeof attrApiDefs;
