/**
 * SQLite 相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

export const sqliteApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/sqlite/flushTransaction',
        en: 'flushTransaction',
        zh_cn: '刷新事务队列',
        description: '将内核中待处理的数据库事务队列立即刷新到磁盘。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(z.null().describe('接口成功执行时，data 固定为 null。')),
    },
] as const satisfies readonly Api定义[];

export type SqliteApiDefs = typeof sqliteApiDefs;
