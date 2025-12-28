/**
 * 插件 (Petal) 相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

/** 插件信息 */
const 插件Schema = z.object({
    name: z.string().describe('插件的包名 (唯一标识符)'),
    displayName: z.string().describe('插件的显示名称'),
    enabled: z.boolean().describe('插件是否已启用'),
    incompatible: z.boolean().describe('插件是否与当前前端版本不兼容'),
    js: z.string().optional().describe('插件的 JavaScript 代码内容'),
    css: z.string().optional().describe('插件的 CSS 代码内容'),
    i18n: z.record(z.any()).optional().describe('插件的国际化文本资源对象'),
});

export const petalApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/petal/loadPetals',
        en: 'loadPetals',
        zh_cn: '加载插件列表',
        description: '加载指定前端界面的所有已启用且兼容的插件及其代码和配置信息。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            frontend: z.string().describe("必需。指定前端界面，如 'desktop', 'mobile'"),
        }),
        zodResponseSchema: 创建响应Schema(z.array(插件Schema).nullable()),
    },
    {
        method: 'POST',
        endpoint: '/api/petal/setPetalEnabled',
        en: 'setPetalEnabled',
        zh_cn: '设置插件启用状态',
        description: '设置指定前端界面中特定插件的启用或禁用状态。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            packageName: z.string().describe('必需。插件的包名'),
            enabled: z.boolean().describe('必需。true 启用，false 禁用'),
            frontend: z.string().describe("必需。前端界面，如 'desktop', 'mobile'"),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                name: z.string(),
                displayName: z.string(),
                enabled: z.boolean(),
                incompatible: z.boolean(),
            }).nullable()
        ),
    },
] as const satisfies readonly Api定义[];

export type PetalApiDefs = typeof petalApiDefs;
