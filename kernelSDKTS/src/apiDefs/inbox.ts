/**
 * 速记 (Inbox) 相关 API 定义
 * 处理云端速记的获取和删除
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

// 速记对象 Schema
const 速记Schema = z.object({
    oId: z.string().describe('速记的原始唯一标识符 (通常为时间戳字符串)'),
    shorthandContent: z.string().describe('速记内容 (经过 Lute 引擎处理后的 HTML 格式)'),
    shorthandMd: z.string().describe('速记内容的原始 Markdown 格式'),
    shorthandDesc: z.string().describe('速记的描述 (经过处理，例如音视频标签被替换为文字)'),
    hCreated: z.string().describe('格式化后的创建时间 (YYYY-MM-DD HH:mm)'),
}).catchall(z.any());

// 速记详情 Schema (用于 getShorthand)
const 速记详情Schema = z.object({
    id: z.string().optional().describe('速记的唯一标识符 (通常为时间戳字符串)'),
    shorthandContent: z.string().describe('速记内容 (经过 Lute 引擎处理后的 HTML 格式)'),
    shorthandMd: z.string().describe('速记内容的原始 Markdown 格式'),
    hCreated: z.string().describe('格式化后的创建时间 (YYYY-MM-DD HH:mm)'),
}).catchall(z.any());

export const inboxApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/inbox/getShorthand',
        en: 'getShorthand',
        zh_cn: '获取单个速记',
        description: '根据ID获取单个云端速记条目的详细内容。速记内容会从 Markdown 转换为 HTML。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要获取的速记的唯一标识符 (通常为时间戳字符串)'),
        }),
        zodResponseSchema: 创建响应Schema(速记详情Schema),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/inbox/getShorthands',
        en: 'getShorthands',
        zh_cn: '获取速记列表',
        description: '分页获取云端速记条目列表。速记内容会从 Markdown 转换为 HTML，描述会做简化处理。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            page: z.number().int().min(1).describe('要获取的速记列表的页码，从 1 开始'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                shorthands: z.array(速记Schema).describe('速记对象列表'),
            }).catchall(z.any()),
        ),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/inbox/removeShorthands',
        en: 'removeShorthands',
        zh_cn: '移除速记',
        description: '根据ID列表批量移除云端速记条目。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            ids: z.array(z.string()).describe('要移除的速记的唯一标识符数组'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-28',
    },
] as const satisfies readonly Api定义[];

export type InboxApiDefs = typeof inboxApiDefs;
