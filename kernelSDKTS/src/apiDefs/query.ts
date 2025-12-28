/**
 * SQL 查询相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

export const queryApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/query/sql',
        en: 'SQL',
        zh_cn: '执行SQL查询',
        description: '执行 SQL 查询语句，返回查询结果。思源笔记使用 SQLite 作为底层数据库。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            stmt: z.string().describe('必需。要执行的 SQL 查询语句。'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.array(z.record(z.any())).nullable().describe('查询结果数组。每个元素是一个对象，键为列名，值为该列的值。')
        ),
        lastVerified: '2025-12-28',
    },
] as const satisfies readonly Api定义[];

export type QueryApiDefs = typeof queryApiDefs;
