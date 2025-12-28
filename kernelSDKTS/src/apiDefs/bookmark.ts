/**
 * 书签相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

/** 书签块信息 */
const 书签块Schema = z.object({
    id: z.string().describe('块的 ID'),
    type: z.string().describe('块的类型 (例如 Paragraph, Heading, List, Document 等)'),
    content: z.string().describe('块的显示内容 (对于普通块可能是名称或概要，对于属性视图是其标题)'),
    markdown: z.string().describe('块的 Markdown 源码'),
    name: z.string().optional().describe('块的命名属性 (IAL 中的 name)'),
    alias: z.string().optional().describe('块的别名属性 (IAL 中的 alias)'),
    memo: z.string().optional().describe('块的备注属性 (IAL 中的 memo)'),
    icon: z.string().optional().describe('块的图标 (IAL 中的 icon, Emoji 或图片路径)'),
    hPath: z.string().describe("块所在文档的人类可读路径 (例如 '/文档名/子文档名')"),
    path: z.string().describe('块所在文档的绝对存储路径'),
    box: z.string().describe('块所属的笔记本 ID'),
    rootID: z.string().describe('块所属的根文档块 ID'),
});

/** 书签分组 */
const 书签分组Schema = z.object({
    name: z.string().describe('书签的名称 (用户在 IAL 中为块设置的 bookmark 属性值)'),
    blocks: z.array(书签块Schema).describe('属于此书签名称下的块对象列表'),
    type: z.string().describe("固定为 'bookmark'，表示这是一个书签分组"),
    depth: z.number().int().describe('层级深度，对于书签固定为 1'),
    count: z.number().int().describe('此书签名称下包含的块的数量'),
});

/** 操作响应 (可能包含 closeTimeout) */
const 操作响应Schema = 创建响应Schema(
    z.object({
        closeTimeout: z.number().describe('一个建议的关闭超时时间 (毫秒)，通常在错误时提供以便UI提示'),
    }).optional().nullable()
);

export const bookmarkApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/bookmark/getBookmark',
        en: 'getBookmark',
        zh_cn: '获取书签',
        description: '构建并返回当前工作空间的所有书签列表。书签是为块设置的特定名称，方便快速访问。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(
            z.array(书签分组Schema).describe('书签数据数组，每个元素是一个书签分组及其包含的书签块列表')
        ),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bookmark/removeBookmark',
        en: 'removeBookmark',
        zh_cn: '移除书签',
        description: '根据书签名称（即块的 IAL 中 bookmark 属性的值）移除一个或多个书签。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            bookmark: z.string().describe('要移除的书签的名称 (块 IAL 中 bookmark 属性的值)'),
        }),
        zodResponseSchema: 操作响应Schema,
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bookmark/renameBookmark',
        en: 'renameBookmark',
        zh_cn: '重命名书签',
        description: '将具有特定旧书签名称（块 IAL 中 bookmark 属性的旧值）的所有书签重命名为一个新的书签名称。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            oldBookmark: z.string().describe('要重命名的旧书签名称 (块 IAL 中 bookmark 属性的当前值)'),
            newBookmark: z.string().describe('新的书签名称 (将写入块 IAL 中 bookmark 属性的新值)'),
        }),
        zodResponseSchema: 操作响应Schema,
        lastVerified: '2025-12-28',
    },
] as const satisfies readonly Api定义[];

export type BookmarkApiDefs = typeof bookmarkApiDefs;
