/**
 * 归档相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

const 标准空响应 = 创建响应Schema(z.any().nullable().describe('此接口通常不返回数据'));

export const archiveApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/archive/unzip',
        en: 'unzip',
        zh_cn: '解压文件',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        description: '将指定的 .zip 文件解压到指定路径。',
        zodRequestSchema: z.object({
            zipPath: z.string().describe('要解压的 .zip 文件的绝对路径或相对于工作空间的路径'),
            path: z.string().describe('解压到目标目录的绝对路径或相对于工作空间的路径'),
        }),
        zodResponseSchema: 标准空响应,
    },
    {
        method: 'POST',
        endpoint: '/api/archive/zip',
        en: 'zip',
        zh_cn: '压缩文件/目录',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        description: '将指定路径的文件或目录压缩到指定的 .zip 文件。',
        zodRequestSchema: z.object({
            path: z.string().describe('要压缩的文件或目录的绝对路径或相对于工作空间的路径'),
            zipPath: z.string().describe('生成的 .zip 文件保存的绝对路径或相对于工作空间的路径'),
        }),
        zodResponseSchema: 标准空响应,
    },
] as const satisfies readonly Api定义[];

export type ArchiveApiDefs = typeof archiveApiDefs;
