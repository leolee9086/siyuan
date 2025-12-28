/**
 * 模板相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

export const templateApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/template/docSaveAsTemplate',
        en: 'docSaveAsTemplate',
        zh_cn: '文档另存为模板',
        description: '将指定 ID 的文档内容保存为一个模板。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要作为模板保存的文档ID'),
            name: z.string().describe('模板的名称'),
            overwrite: z.boolean().describe('如果已存在同名模板，是否覆盖'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
    {
        method: 'POST',
        endpoint: '/api/template/render',
        en: 'renderTemplate',
        zh_cn: '渲染模板',
        description: '根据给定的模板文件路径和可选的上下文块ID，渲染模板内容。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            path: z.string().describe('模板文件的绝对路径'),
            id: z.string().describe('可选的上下文块ID'),
            preview: z.boolean().optional().describe('是否为预览模式，默认 false'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                path: z.string().describe('渲染的模板文件路径'),
                content: z.string().describe('渲染后的模板内容 (HTML)'),
            }).nullable()
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/template/renderSprig',
        en: 'renderSprig',
        zh_cn: '渲染 Sprig 模板字符串',
        description: '使用 Go 的 Sprig 模板函数库渲染给定的模板字符串。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            template: z.string().describe('包含 Sprig 模板语法的字符串'),
        }),
        zodResponseSchema: 创建响应Schema(z.string().nullable()),
    },
] as const satisfies readonly Api定义[];

export type TemplateApiDefs = typeof templateApiDefs;
