/**
 * Lute 引擎相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

export const luteApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/lute/copyStdMarkdown',
        en: 'copyStdMarkdown',
        zh_cn: '导出标准Markdown',
        description: '将指定ID的块内容导出为标准 Markdown 格式的字符串。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出内容的块的ID'),
            assetsDestSpace2Underscore: z.boolean().optional().describe('是否将资源文件名中的空格替换为下划线'),
            fillCSSVar: z.boolean().optional().describe('是否填充 CSS 变量'),
            adjustHeadingLevel: z.boolean().optional().describe('是否调整标题层级'),
            imgTag: z.boolean().optional().describe('是否使用 img 标签而非 Markdown 语法'),
        }),
        zodResponseSchema: 创建响应Schema(z.string().describe('导出的标准 Markdown 内容')),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/lute/html2BlockDOM',
        en: 'html2BlockDOM',
        zh_cn: 'HTML转块DOM',
        description: '将输入的 HTML 字符串转换为思源笔记的块级 DOM 结构。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            dom: z.string().describe('要转换的 HTML 字符串'),
        }),
        zodResponseSchema: 创建响应Schema(z.string().describe('转换后的块级 DOM (HTML 格式的字符串)')),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/lute/spinBlockDOM',
        en: 'spinBlockDOM',
        zh_cn: '处理块DOM(原生渲染优化)',
        description: '对传入的块级 DOM 字符串执行 Lute 引擎的 SpinBlockDOM 处理。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            dom: z.string().describe('要处理的块级 DOM 字符串 (HTML 格式)'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                dom: z.string().describe('经过 SpinBlockDOM 处理后的块级 DOM 字符串'),
            })
        ),
        lastVerified: '2025-12-28',
    },
] as const satisfies readonly Api定义[];

export type LuteApiDefs = typeof luteApiDefs;
