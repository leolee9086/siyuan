/**
 * 块引用相关 API 定义
 * 
 * 包含: getRefIDs, getRefText, swapBlockRef, transferBlockRef 等
 */
import { z } from 'zod';
import type { Api定义 } from '../../client/types';
import { 创建响应Schema } from '../types';

export const refApiDefs = [
    // ========== 块引用查询 ==========
    {
        method: 'POST',
        endpoint: '/api/block/getRefIDs',
        en: 'getRefIDs',
        zh_cn: '获取块引用的所有定义块ID',
        description: '获取指定块ID所引用的所有定义块的ID列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('发起引用的块 ID'),
        }),
        zodResponseSchema: 创建响应Schema(z.object({
            refDefs: z.array(z.object({
                refID: z.string().describe('引用块ID'),
                defIDs: z.array(z.string()).describe('定义块ID列表'),
            })).describe('引用定义关系列表'),
            originalRefBlockIDs: z.record(z.string(), z.string()).optional().describe('原始引用块ID映射'),
        })),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/getRefIDsByFileAnnotationID',
        en: 'getRefIDsByFileAnnotationID',
        zh_cn: '通过文件注解ID获取相关的引用ID和定义ID',
        description: '根据文件注解块的ID，查找与该注解相关的引用块ID和定义块ID。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('文件注解块的 ID'),
        }),
        zodResponseSchema: 创建响应Schema(z.object({
            refDefs: z.array(z.object({
                refID: z.string().describe('引用块ID'),
                defIDs: z.array(z.string()).describe('定义块ID列表'),
            })).describe('引用定义关系列表'),
        })),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/getBlockDefIDsByRefText',
        en: 'getBlockDefIDsByRefText',
        zh_cn: '根据引用文本获取块定义ID',
        description: '根据引用文本搜索并返回其可能指向的块定义ID列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            anchor: z.string().describe('要搜索的引用锚文本'),
            excludeIDs: z.array(z.string()).optional().describe('需要排除的块 ID 数组'),
        }),
        zodResponseSchema: 创建响应Schema(z.object({
            refDefs: z.array(z.object({
                refID: z.string().describe('引用块的ID'),
                defIDs: z.array(z.string()).describe('被引用的定义块ID列表'),
            })).describe('引用定义对的列表'),
        })),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/getRefText',
        en: 'getRefText',
        zh_cn: '获取引用块的锚文本',
        description: '获取指定引用块ID的锚文本内容。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('引用块的 ID'),
        }),
        zodResponseSchema: 创建响应Schema(z.string()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/getDOMText',
        en: 'getDOMText',
        zh_cn: '获取DOM中的纯文本内容',
        description: '提取给定DOM字符串中的纯文本内容。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            dom: z.string().describe('包含 HTML 标签的 DOM 字符串'),
        }),
        zodResponseSchema: 创建响应Schema(z.string()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/checkBlockRef',
        en: 'checkBlockRef',
        zh_cn: '检查块引用状态',
        description: '检查一批块ID的引用状态。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            ids: z.array(z.string()).describe('要检查的块 ID 数组'),
        }),
        zodResponseSchema: 创建响应Schema(z.record(z.string(), z.object({
            defCount: z.number().describe('该块作为定义块被引用的次数'),
            refCount: z.number().describe('该块作为引用块引用其他块的次数'),
        }))),
        lastVerified: '2025-12-28',
    },

    // ========== 引用操作 ==========
    {
        method: 'POST',
        endpoint: '/api/block/swapBlockRef',
        en: 'swapBlockRef',
        zh_cn: '交换引用块和定义块',
        description: '交换指定的引用块和其指向的定义块的角色。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            refID: z.string().describe('原引用块的 ID'),
            defID: z.string().describe('原定义块的 ID'),
            includeChildren: z.boolean().describe('是否包含子块进行交换'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/block/transferBlockRef',
        en: 'transferBlockRef',
        zh_cn: '转移块引用关系',
        description: '将原块的所有引用关系转移到目标块。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            fromID: z.string().describe('原块的 ID'),
            toID: z.string().describe('目标块的 ID'),
            refIDs: z.array(z.string()).optional().describe('指定要转移的引用块ID'),
            reloadUI: z.boolean().optional().describe('操作完成后是否重新加载UI'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-28',
    },
] as const satisfies readonly Api定义[];
