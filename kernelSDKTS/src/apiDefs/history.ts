/**
 * 历史记录相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

// ====== 复用的 Schema ======

/** 历史条目 Schema */
const 历史条目Schema = z.object({
    id: z.string().describe('历史记录条目的唯一ID'),
    title: z.string().describe('历史记录条目的标题或名称'),
    content: z.string().describe('历史记录条目的简要内容或描述'),
    notebookID: z.string().describe('所属笔记本ID'),
    notebookName: z.string().describe('所属笔记本名称'),
    path: z.string().describe('相关文档或资源的路径'),
    type: z.number().int().describe('历史记录类型'),
    created: z.string().describe('创建时间'),
    updated: z.string().describe('更新时间'),
    size: z.number().int().describe('大小 (字节)'),
    hSize: z.string().describe('人类可读的大小'),
    count: z.number().int().describe('相关计数'),
    repoID: z.string().optional().describe('版本库ID'),
    historyName: z.string().optional().describe('历史文件名'),
    historyPath: z.string().optional().describe('历史文件完整路径'),
    docID: z.string().optional().describe('相关文档ID'),
});

export const historyApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/history/getNotebookHistory',
        en: 'getNotebookHistory',
        zh_cn: '获取笔记本历史记录',
        description: '获取所有笔记本的历史记录信息。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({}).optional(),
        zodResponseSchema: 创建响应Schema(z.object({
            histories: z.array(z.object({
                id: z.string().describe('历史记录的唯一ID'),
                title: z.string().describe('历史记录的标题 (通常是笔记本名称)'),
                type: z.number().int().describe('历史类型 (应为2，代表笔记本历史)'),
                created: z.string().describe('历史创建的时间戳 (格式：YYYYMMDDHHmmss)'),
                updated: z.string().describe('历史更新的时间戳 (格式：YYYYMMDDHHmmss)'),
                count: z.number().int().describe('该历史版本包含的文档数量'),
                size: z.number().int().describe('历史版本占用的磁盘空间大小 (字节)'),
                hSize: z.string().describe('人类可读的磁盘空间大小'),
                repoID: z.string().describe('所属版本库ID (通常是笔记本ID)'),
                historyName: z.string().describe('历史文件名'),
                historyPath: z.string().describe('历史文件的完整存储路径'),
            })).describe('笔记本历史记录数组'),
        }).nullable()),
    },
    {
        method: 'POST',
        endpoint: '/api/history/rollbackNotebookHistory',
        en: 'rollbackNotebookHistory',
        zh_cn: '回滚笔记本历史版本',
        description: '将整个笔记本回滚到指定的历史版本。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            historyPath: z.string().describe('笔记本历史版本的路径，通常从 getNotebookHistory 接口获取'),
        }),
        zodResponseSchema: 创建响应Schema(z.null().describe('成功时固定为 null')),
    },
    {
        method: 'POST',
        endpoint: '/api/history/rollbackAssetsHistory',
        en: 'rollbackAssetsHistory',
        zh_cn: '回滚资源文件历史',
        description: '将资源文件回滚到指定的历史版本。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            historyPath: z.string().describe('资源文件历史版本的路径'),
        }),
        zodResponseSchema: 创建响应Schema(z.null().describe('成功时固定为 null')),
    },
    {
        method: 'POST',
        endpoint: '/api/history/getDocHistoryContent',
        en: 'getDocHistoryContent',
        zh_cn: '获取文档历史版本内容',
        description: '获取指定文档历史版本的内容和相关信息。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            historyPath: z.string().describe('文档历史版本的路径'),
            k: z.string().optional().describe('搜索关键词，用于在历史内容中高亮显示'),
            highlight: z.boolean().optional().default(true).describe('是否对关键词进行高亮显示，默认为 true'),
        }),
        zodResponseSchema: 创建响应Schema(z.object({
            id: z.string().describe('文档的 ID'),
            rootID: z.string().describe('文档的根块 ID'),
            content: z.string().describe('文档历史版本的内容 (HTML 格式)'),
            isLargeDoc: z.boolean().describe('是否为大文档'),
        }).nullable()),
    },
    {
        method: 'POST',
        endpoint: '/api/history/rollbackDocHistory',
        en: 'rollbackDocHistory',
        zh_cn: '回滚文档历史版本',
        description: '将单个文档回滚到指定的历史版本。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            notebook: z.string().describe('文档所属的笔记本 ID'),
            historyPath: z.string().describe('文档历史版本的路径'),
        }),
        zodResponseSchema: 创建响应Schema(z.object({
            box: z.string().describe('文档所属的笔记本 ID'),
        }).nullable()),
    },
    {
        method: 'POST',
        endpoint: '/api/history/clearWorkspaceHistory',
        en: 'clearWorkspaceHistory',
        zh_cn: '清空工作区历史记录',
        description: '清空当前工作空间下的所有历史记录。这是一个耗时操作，执行前会有提示。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({}).optional(),
        zodResponseSchema: 创建响应Schema(z.null().describe('成功时固定为 null')),
    },
    {
        method: 'POST',
        endpoint: '/api/history/reindexHistory',
        en: 'reindexHistory',
        zh_cn: '重建历史记录索引',
        description: '重建整个工作空间的历史记录索引。这是一个后台异步操作。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({}).optional(),
        zodResponseSchema: 创建响应Schema(z.null().describe('成功时固定为 null')),
    },
    {
        method: 'POST',
        endpoint: '/api/history/searchHistory',
        en: 'searchHistory',
        zh_cn: '搜索历史记录',
        description: '根据关键词、笔记本、类型等分页搜索历史记录。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            notebook: z.string().optional().describe('笔记本 ID，如果提供，则限定在该笔记本内搜索'),
            type: z.number().int().optional().default(0).describe('历史记录类型：0 表示文档，1 表示资源文件，2 表示笔记本。默认为 0 (文档)。'),
            query: z.string().describe('搜索关键词'),
            page: z.number().int().optional().default(1).describe('页码，从 1 开始，默认为 1'),
            op: z.string().optional().default('all').describe('搜索操作类型'),
        }),
        zodResponseSchema: 创建响应Schema(z.object({
            histories: z.array(z.object({
                created: z.string().describe('历史记录分组的创建日期 (格式：YYYYMMDD)'),
                count: z.number().int().describe('该日期分组下的历史条目数量'),
                items: z.array(历史条目Schema).optional().describe('该日期分组下的具体历史条目列表'),
            })).describe('按日期分组的历史记录数组'),
            pageCount: z.number().int().describe('总页数'),
            totalCount: z.number().int().describe('符合条件的总历史记录条目数'),
        }).nullable()),
    },
    {
        method: 'POST',
        endpoint: '/api/history/getHistoryItems',
        en: 'getHistoryItems',
        zh_cn: '获取历史条目列表',
        description: '根据创建日期、关键词等条件获取历史记录中的具体条目列表。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            created: z.string().describe('创建日期，格式如 "YYYYMMDD"'),
            notebook: z.string().optional().describe('笔记本 ID，如果提供，则限定在该笔记本内搜索'),
            type: z.number().int().optional().default(0).describe('历史记录类型：0 表示文档，1 表示资源文件，2 表示笔记本。'),
            query: z.string().describe('搜索关键词'),
            op: z.string().optional().default('all').describe('搜索操作类型'),
        }),
        zodResponseSchema: 创建响应Schema(z.object({
            items: z.array(历史条目Schema).describe('符合条件的历史条目数组'),
        }).nullable()),
    },
] as const satisfies readonly Api定义[];

export type HistoryApiDefs = typeof historyApiDefs;
