/**
 * 关系图相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

// ====== 复用的 Schema ======

/** 节点类型筛选配置 */
const 节点类型Schema = z.object({
    tag: z.boolean().describe('是否显示标签节点'),
    paragraph: z.boolean().describe('是否显示段落块节点'),
    heading: z.boolean().describe('是否显示标题块节点'),
    math: z.boolean().describe('是否显示数学公式块节点'),
    code: z.boolean().describe('是否显示代码块节点'),
    table: z.boolean().describe('是否显示表格块节点'),
    list: z.boolean().describe('是否显示列表块节点'),
    listItem: z.boolean().describe('是否显示列表项块节点'),
    blockquote: z.boolean().describe('是否显示引述块节点'),
    super: z.boolean().describe('是否显示超级块节点'),
}).describe('节点类型筛选配置');

/** D3 力导向图配置 */
const D3配置Schema = z.object({
    nodeSize: z.number().describe('节点大小'),
    linkWidth: z.number().describe('连线宽度'),
    lineOpacity: z.number().describe('连线不透明度'),
    centerStrength: z.number().describe('中心力强度'),
    collideRadius: z.number().describe('碰撞半径'),
    collideStrength: z.number().describe('碰撞力强度'),
    linkDistance: z.number().int().describe('连线距离'),
    arrow: z.boolean().describe('是否显示箭头'),
}).describe('D3力导向图配置');

/** 全局关系图配置 */
const 全局关系图配置Schema = z.object({
    minRefs: z.number().int().describe('节点最少被引用次数（低于此值将被隐藏）'),
    dailyNote: z.boolean().describe('是否包含日记节点'),
    type: 节点类型Schema,
    d3: D3配置Schema,
}).describe('全局关系图配置项');

/** 局部关系图配置 */
const 局部关系图配置Schema = z.object({
    dailyNote: z.boolean().describe('是否包含日记节点'),
    type: 节点类型Schema,
    d3: D3配置Schema,
}).describe('局部关系图配置项');

/** 节点 Schema */
const 节点Schema = z.object({
    id: z.string().describe('节点 ID (通常是块 ID 或标签名)'),
    box: z.string().describe('节点所属的笔记本 ID'),
    path: z.string().describe('节点对应的文档路径'),
    size: z.number().describe('节点在图中的显示大小'),
    title: z.string().optional().describe('节点标题 (通常是文档名或截取的块内容)'),
    label: z.string().describe('节点标签 (显示在节点上的文字)'),
    type: z.string().describe('节点类型 (块类型或 "tag")'),
    refs: z.number().int().describe('节点的引用数量'),
    defs: z.number().int().describe('节点的被引用数量 (定义数量)'),
});

/** 边 Schema */
const 边Schema = z.object({
    from: z.string().describe('起始节点 ID'),
    to: z.string().describe('目标节点 ID'),
    ref: z.boolean().describe('是否为引用关系 (true: 引用关系, false: 父子层级关系)'),
    arrows: z.object({
        to: z.object({
            enabled: z.boolean().describe('箭头是否启用'),
        }).optional().describe('指向目标的箭头配置'),
    }).optional().describe('箭头配置'),
});

export const graphApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/graph/getGraph',
        en: 'getGraph',
        zh_cn: '获取全局关系图数据',
        description: '根据关键词和配置获取全局关系图的节点和边数据。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            reqId: z.any().describe('请求 ID，用于跟踪异步请求'),
            k: z.string().describe('搜索关键词，用于筛选关系图中的节点'),
            conf: 全局关系图配置Schema,
        }),
        zodResponseSchema: 创建响应Schema(z.object({
            nodes: z.array(节点Schema).describe('关系图中的节点列表'),
            links: z.array(边Schema).describe('关系图中的边列表'),
            conf: 全局关系图配置Schema.describe('更新后的全局关系图配置项'),
            box: z.string().describe('当前知识空间（笔记本组）ID'),
            reqId: z.any().describe('请求 ID，与请求参数中的 reqId 一致'),
        })),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/graph/getLocalGraph',
        en: 'getLocalGraph',
        zh_cn: '获取局部关系图数据',
        description: '根据指定的文档 ID、关键词和配置获取局部关系图（如文档关系图、反链关系图等）的节点和边数据。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            reqId: z.any().describe('请求 ID，用于跟踪异步请求'),
            id: z.string().describe('文档 ID，用于构建局部关系图的中心节点'),
            k: z.string().describe('搜索关键词，用于筛选关系图中的节点'),
            conf: 局部关系图配置Schema,
        }),
        zodResponseSchema: 创建响应Schema(z.object({
            id: z.string().describe('请求的文档 ID'),
            box: z.string().describe('当前知识空间（笔记本组）ID'),
            nodes: z.array(节点Schema).describe('关系图中的节点列表'),
            links: z.array(边Schema).describe('关系图中的边列表'),
            conf: 局部关系图配置Schema.describe('更新后的局部关系图配置项'),
            reqId: z.any().describe('请求 ID，与请求参数中的 reqId 一致'),
        })),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/graph/resetGraph',
        en: 'resetGraph',
        zh_cn: '重置全局关系图配置',
        description: '将全局关系图的配置恢复为默认设置。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({}).optional(),
        zodResponseSchema: 创建响应Schema(z.object({
            conf: 全局关系图配置Schema.describe('重置后的全局关系图配置项'),
        })),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/graph/resetLocalGraph',
        en: 'resetLocalGraph',
        zh_cn: '重置局部关系图配置',
        description: '将局部关系图的配置恢复为默认设置。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({}).optional(),
        zodResponseSchema: 创建响应Schema(z.object({
            conf: 局部关系图配置Schema.describe('重置后的局部关系图配置项'),
        })),
        lastVerified: '2025-12-29',
    },
] as const satisfies readonly Api定义[];

export type GraphApiDefs = typeof graphApiDefs;
