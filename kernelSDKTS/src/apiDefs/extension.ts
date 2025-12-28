/**
 * 扩展相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

export const extensionApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/extension/copy',
        en: 'extensionCopy',
        zh_cn: '扩展内容复制处理',
        description: '处理来自浏览器扩展（如剪藏）复制过来的内容。将 HTML DOM 转换为 Markdown，并处理其中的资源文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            dom: z.string().describe('要处理的 HTML DOM 内容字符串 (FormData)'),
            notebook: z.string().optional().describe('目标笔记本ID，资源文件将保存到该笔记本的 assets 文件夹下'),
            href: z.string().optional().describe('原始剪藏页面的 URL，如果指向链滴文章会优先获取 Markdown'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                md: z.string().describe('转换后或直接获取的 Markdown 内容'),
                withMath: z.boolean().describe('是否包含数学公式 (KaTeX)'),
            }).nullable()
        ),
    },
] as const satisfies readonly Api定义[];

export type ExtensionApiDefs = typeof extensionApiDefs;
