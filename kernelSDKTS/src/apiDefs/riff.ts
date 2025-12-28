/**
 * 闪卡 (Riff) 相关 API 定义
 * 
 * 这些 API 用于管理闪卡包和闪卡的复习功能。
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

/**
 * 闪卡包 Schema
 */
const RiffDeckSchema = z.object({
    id: z.string().describe('闪卡包 ID'),
    name: z.string().describe('闪卡包名称'),
    size: z.number().int().describe('闪卡包中的卡片数量'),
    created: z.string().describe('创建时间，格式 YYYY-MM-DD HH:mm:ss'),
    updated: z.string().describe('更新时间，格式 YYYY-MM-DD HH:mm:ss'),
});

/**
 * 闪卡 Schema
 */
const RiffCardSchema = z.object({
    id: z.string().describe('闪卡块 ID'),
    deckID: z.string().describe('所属闪卡包 ID'),
    blockID: z.string().describe('原始块 ID'),
    created: z.string().describe('创建时间戳 (毫秒)'),
    due: z.string().describe('到期时间戳 (毫秒)'),
    interval: z.number().describe('复习间隔 (天)'),
    easeFactor: z.number().describe('易度因子'),
    reps: z.number().int().describe('已复习次数'),
});

/**
 * 已复习卡片 Schema
 */
const ReviewedCardSchema = z.object({
    cardID: z.string().describe('已复习卡片的 ID'),
});

/**
 * 到期闪卡响应 Schema
 */
const DueCardsResponseSchema = z.object({
    cards: z.array(RiffCardSchema).describe('到期闪卡列表'),
    unreviewedCount: z.number().int().describe('未复习卡片总数'),
    unreviewedNewCardCount: z.number().int().describe('未复习新卡片数量'),
    unreviewedOldCardCount: z.number().int().describe('未复习旧卡片数量'),
});

export const riffApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/riff/createRiffDeck',
        en: 'createRiffDeck',
        zh_cn: '创建闪卡包',
        description: '创建一个新的闪卡包。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            name: z.string().describe('新闪卡包的名称'),
        }),
        zodResponseSchema: 创建响应Schema(RiffDeckSchema),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/riff/renameRiffDeck',
        en: 'renameRiffDeck',
        zh_cn: '重命名闪卡包',
        description: '重命名指定的闪卡包。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            deckID: z.string().describe('要重命名的闪卡包 ID'),
            name: z.string().describe('新的闪卡包名称'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/riff/removeRiffDeck',
        en: 'removeRiffDeck',
        zh_cn: '移除闪卡包',
        description: '移除指定的闪卡包及其包含的所有闪卡。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            deckID: z.string().describe('要移除的闪卡包 ID'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/riff/getRiffDecks',
        en: 'getRiffDecks',
        zh_cn: '获取所有闪卡包',
        description: '获取当前工作空间中所有的闪卡包列表。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(z.array(RiffDeckSchema)),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/riff/addRiffCards',
        en: 'addRiffCards',
        zh_cn: '添加闪卡',
        description: '将指定的块添加为闪卡到指定的闪卡包中。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            deckID: z.string().describe('目标闪卡包的 ID'),
            blockIDs: z.array(z.string()).describe('要添加为闪卡的块 ID 数组'),
        }),
        zodResponseSchema: 创建响应Schema(RiffDeckSchema.nullable()),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/riff/removeRiffCards',
        en: 'removeRiffCards',
        zh_cn: '移除闪卡',
        description: '从指定的闪卡包中移除指定的闪卡。如果 deckID 为空字符串，则从所有闪卡包中移除。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            deckID: z.string().describe('目标闪卡包 ID，空字符串表示从所有卡包移除'),
            blockIDs: z.array(z.string()).describe('要移除的闪卡块 ID 数组'),
        }),
        zodResponseSchema: 创建响应Schema(RiffDeckSchema.nullable()),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/riff/getRiffDueCards',
        en: 'getRiffDueCards',
        zh_cn: '获取闪卡包中的到期闪卡',
        description: '获取指定闪卡包中所有到期应复习的闪卡。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            deckID: z.string().describe('闪卡包 ID'),
            reviewedCards: z.array(ReviewedCardSchema).optional().describe('已复习过的卡片列表，用于排除'),
        }),
        zodResponseSchema: 创建响应Schema(DueCardsResponseSchema),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/riff/getTreeRiffDueCards',
        en: 'getTreeRiffDueCards',
        zh_cn: '获取文档树下的到期闪卡',
        description: '获取指定文档树（根块）下所有到期应复习的闪卡。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            rootID: z.string().describe('文档树的根块 ID'),
            reviewedCards: z.array(ReviewedCardSchema).optional().describe('已复习过的卡片列表'),
        }),
        zodResponseSchema: 创建响应Schema(DueCardsResponseSchema),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/riff/getNotebookRiffDueCards',
        en: 'getNotebookRiffDueCards',
        zh_cn: '获取笔记本下的到期闪卡',
        description: '获取指定笔记本下所有到期应复习的闪卡。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            notebook: z.string().describe('笔记本 ID'),
            reviewedCards: z.array(ReviewedCardSchema).optional().describe('已复习过的卡片列表'),
        }),
        zodResponseSchema: 创建响应Schema(DueCardsResponseSchema),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/riff/reviewRiffCard',
        en: 'reviewRiffCard',
        zh_cn: '复习闪卡',
        description: '对指定的闪卡进行一次复习，并根据评分更新其下次到期时间等学习状态。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            deckID: z.string().describe('闪卡所属的卡包 ID'),
            cardID: z.string().describe('要复习的闪卡块 ID'),
            rating: z.number().int().min(0).max(4).describe('评分：0=Again, 1=Hard, 2=Good, 3=Easy, 4=Soon'),
            reviewedCards: z.array(ReviewedCardSchema).optional().describe('已复习过的卡片列表'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/riff/skipReviewRiffCard',
        en: 'skipReviewRiffCard',
        zh_cn: '跳过复习闪卡',
        description: '跳过当前闪卡的复习，将其推迟到当前学习队列的末尾或稍后。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            deckID: z.string().describe('闪卡所属的卡包 ID'),
            cardID: z.string().describe('要跳过复习的闪卡块 ID'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/riff/getRiffCards',
        en: 'getRiffCards',
        zh_cn: '获取闪卡包中的所有闪卡',
        description: '获取指定闪卡包中的所有闪卡，支持分页。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('闪卡包 ID'),
            page: z.number().int().min(1).describe('页码，从 1 开始'),
            pageSize: z.number().int().min(1).optional().describe('每页数量，默认为 20'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                blocks: z.array(RiffCardSchema).describe('当前页的闪卡对象数组'),
                total: z.number().int().describe('该闪卡包下闪卡总数'),
                pageCount: z.number().int().describe('总页数'),
            })
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/riff/getTreeRiffCards',
        en: 'getTreeRiffCards',
        zh_cn: '获取文档树下的所有闪卡',
        description: '获取指定文档树（根块）下的所有闪卡块 ID，支持分页。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('文档树的根块 ID'),
            page: z.number().int().min(1).describe('页码，从 1 开始'),
            pageSize: z.number().int().min(1).optional().describe('每页数量，默认为 20'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                blocks: z.array(z.string()).describe('当前页的闪卡块 ID 数组'),
                total: z.number().int().describe('该文档树下闪卡总数'),
                pageCount: z.number().int().describe('总页数'),
            })
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/riff/getNotebookRiffCards',
        en: 'getNotebookRiffCards',
        zh_cn: '获取笔记本下的所有闪卡',
        description: '获取指定笔记本下的所有闪卡块 ID，支持分页。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('笔记本 ID'),
            page: z.number().int().min(1).describe('页码，从 1 开始'),
            pageSize: z.number().int().min(1).optional().describe('每页数量，默认为 20'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                blocks: z.array(z.string()).describe('当前页的闪卡块 ID 数组'),
                total: z.number().int().describe('该笔记本下闪卡总数'),
                pageCount: z.number().int().describe('总页数'),
            })
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/riff/resetRiffCards',
        en: 'resetRiffCards',
        zh_cn: '重置闪卡',
        description: '重置指定范围内的闪卡的学习进度。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            type: z.enum(['notebook', 'tree', 'deck']).describe('重置类型'),
            id: z.string().describe('对应类型的 ID'),
            deckID: z.string().describe('闪卡包 ID'),
            blockIDs: z.array(z.string()).optional().describe('要重置的具体闪卡块 ID 数组'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/riff/batchSetRiffCardsDueTime',
        en: 'batchSetRiffCardsDueTime',
        zh_cn: '批量设置闪卡到期时间',
        description: '批量设置闪卡的到期时间。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            cardDues: z.array(z.object({
                id: z.string().describe('闪卡块 ID'),
                due: z.string().describe('新的到期时间，ISO 8601 格式'),
            })).describe('闪卡 ID 和对应新到期时间的数组'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/riff/getRiffCardsByBlockIDs',
        en: 'getRiffCardsByBlockIDs',
        zh_cn: '根据块ID批量获取闪卡信息',
        description: '根据一组块 ID 批量获取它们对应的闪卡信息。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            blockIDs: z.array(z.string()).describe('块 ID 数组'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                blocks: z.array(RiffCardSchema).describe('对应的闪卡信息数组'),
            })
        ),
        lastVerified: '2025-12-29',
    },
] as const satisfies readonly Api定义[];

export type RiffApiDefs = typeof riffApiDefs;
