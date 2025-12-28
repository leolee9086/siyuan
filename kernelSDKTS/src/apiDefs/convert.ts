/**
 * 格式转换相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

export const convertApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/convert/pandoc',
        en: 'pandoc',
        zh_cn: 'Pandoc 格式转换',
        description: '调用系统安装的 Pandoc 工具进行文档格式转换。需要提供 Pandoc 命令行参数。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            dir: z.string().optional().describe('Pandoc 命令执行的工作目录路径，如果为空则在临时目录中执行'),
            args: z.array(z.string()).describe('Pandoc 命令行参数数组'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                path: z.string().describe('转换后输出文件的路径'),
            })
        ),
        lastVerified: '2025-12-28',
    },
] as const satisfies readonly Api定义[];

export type ConvertApiDefs = typeof convertApiDefs;
