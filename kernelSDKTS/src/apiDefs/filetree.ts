/**
 * filetree 相关 API 定义
 * 
 * 文件树和文档管理相关的 API
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

// ========== 通用 Schema 定义 ==========

/** 文档文件 Schema */
const 文档文件Schema = z.object({
    type: z.string().describe('条目类型'),
    name: z.string().describe('文档名或目录名'),
    alias: z.string().optional().describe('文档别名'),
    memo: z.string().optional().describe('文档备注'),
    bookmark: z.string().optional().describe('文档书签内容'),
    hPath: z.string().describe('人类可读路径'),
    id: z.string().describe('文档ID'),
    path: z.string().describe('文档的实际存储路径'),
    nameCount: z.number().optional().describe('文档名中的字符数'),
    updated: z.number().describe('文档最后修改时间的Unix时间戳'),
    subFileCount: z.number().describe('子文档/目录的数量'),
    icon: z.string().optional().describe('文档图标'),
    sort: z.number().optional().describe('排序权重值'),
    refCount: z.number().optional().describe('被引用计数'),
    newFlashcardCount: z.number().optional().describe('新闪卡数量'),
    dueFlashcardCount: z.number().optional().describe('到期闪卡数量'),
    flashcardCount: z.number().optional().describe('总闪卡数量'),
    hidden: z.boolean().optional().describe('是否为隐藏文档'),
});

/** 搜索文档结果 Schema */
const 搜索文档结果Schema = z.object({
    box: z.string().describe('文档所属的笔记本ID'),
    path: z.string().describe('文档的实际存储路径'),
    hPath: z.string().describe('文档的人类可读路径'),
    id: z.string().describe('文档ID'),
    name: z.string().describe('文档名'),
    nameRaw: z.string().describe('文档名原文（可能包含高亮标签）'),
    alias: z.string().optional().describe('文档别名'),
    aliasRaw: z.string().optional().describe('文档别名原文'),
    memo: z.string().optional().describe('文档备注'),
});

/** 基础操作结果（带可选 closeTimeout） */
const 操作结果Schema = z.object({
    closeTimeout: z.number().optional().describe('操作失败时建议的关闭等待时间（毫秒）'),
});

export const filetreeApiDefs = [
    // ========== 文档搜索 ==========
    {
        method: 'POST',
        endpoint: '/api/filetree/searchDocs',
        en: 'searchDocs',
        zh_cn: '搜索文档标题和别名',
        description: '根据关键词搜索匹配的文档标题和别名。主要用于快速查找文档，不支持全文搜索。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            k: z.string().describe('搜索关键词。'),
            flashcard: z.boolean().optional().describe('是否仅在包含闪卡的文档中搜索'),
            excludeIDs: z.array(z.string()).optional().describe('排除的文档ID列表'),
        }),
        zodResponseSchema: 创建响应Schema(z.array(搜索文档结果Schema)),
        lastVerified: '2025-12-28',
    },

    // ========== 文档列表 ==========
    {
        method: 'POST',
        endpoint: '/api/filetree/listDocsByPath',
        en: 'listDocsByPath',
        zh_cn: '获取指定路径下的文档列表',
        description: '获取指定笔记本和路径下的文档及子文件夹列表，支持排序、闪卡过滤和数量限制。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            notebook: z.string().describe('笔记本ID'),
            path: z.string().describe('要列出文档的路径（相对于笔记本根目录）'),
            sort: z.number().optional().describe('排序模式'),
            flashcard: z.boolean().optional().describe('是否仅列出包含闪卡的文档'),
            maxListCount: z.number().optional().describe('最大列出数量'),
            showHidden: z.boolean().optional().describe('是否显示隐藏文件'),
            ignoreMaxListHint: z.boolean().optional().describe('是否忽略超出数量限制的提示'),
            app: z.string().optional().describe('应用标识'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                box: z.string().describe('请求的笔记本ID'),
                path: z.string().describe('请求的路径'),
                files: z.array(文档文件Schema).describe('文档和子目录列表'),
            })
        ),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/listDocTree',
        en: 'listDocTree',
        zh_cn: '列出文档树',
        description: '列出指定笔记本的文档树结构，支持过滤、排序等。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            notebook: z.string().describe('要列出文档树的笔记本ID'),
            path: z.string().describe('要列出文档树的起始路径'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                tree: z.array(z.object({
                    id: z.string().describe('文档或目录的ID'),
                    children: z.array(z.any()).optional().describe('子文档或子目录'),
                })).describe('文档树结构数组'),
            })
        ),
        lastVerified: '2025-12-28',
    },

    // ========== 获取文档内容 ==========
    {
        method: 'POST',
        endpoint: '/api/filetree/getDoc',
        en: 'getDoc',
        zh_cn: '获取文档内容和结构',
        description: '获取指定文档的详细信息，包括块内容、结构、属性等。支持多种加载模式和查询参数。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要获取的文档或块的ID'),
            index: z.number().optional().describe('列表项索引，从0开始'),
            query: z.string().optional().describe('搜索关键词'),
            queryMethod: z.number().optional().describe('搜索方法：0-关键词，1-查询语法'),
            queryTypes: z.record(z.boolean()).optional().describe('搜索类型配置'),
            mode: z.number().optional().describe('加载模式：0-仅当前，1-向上，2-向下，3-上下，4-末尾'),
            size: z.number().optional().describe('加载块的数量'),
            startID: z.string().optional().describe('动态加载范围的起始块ID'),
            endID: z.string().optional().describe('动态加载范围的结束块ID'),
            isBacklink: z.boolean().optional().describe('是否为反向链接视图'),
            originalRefBlockIDs: z.record(z.string()).optional().describe('原始引用块ID映射'),
            highlight: z.boolean().optional().describe('是否对内容进行高亮处理'),
            reqId: z.string().optional().describe('请求ID，用于跟踪请求'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                id: z.string().describe('请求的原始块ID'),
                mode: z.number().describe('请求的加载模式'),
                parentID: z.string().describe('父块ID'),
                parent2ID: z.string().describe('父父块ID'),
                rootID: z.string().describe('文档根块ID'),
                type: z.number().describe('块类型'),
                content: z.string().describe('块的DOM内容'),
                blockCount: z.number().describe('返回的块数量'),
                eof: z.boolean().describe('是否已到达文档末尾'),
                scroll: z.boolean().describe('是否需要滚动定位'),
                box: z.string().describe('文档所属的笔记本ID'),
                path: z.string().describe('文档的存储路径'),
                isSyncing: z.boolean().describe('文档是否正在同步中'),
                isBacklinkExpand: z.boolean().describe('是否为反链展开上下文'),
                keywords: z.array(z.string()).optional().describe('搜索匹配的关键词列表'),
                reqId: z.string().optional().describe('请求时传递的 reqId'),
            })
        ),
        lastVerified: '2025-12-28',
    },

    // ========== 路径相关 ==========
    {
        method: 'POST',
        endpoint: '/api/filetree/getDocCreateSavePath',
        en: 'getDocCreateSavePath',
        zh_cn: '获取新文档的默认保存位置',
        description: '根据当前笔记本和全局配置，计算并返回创建新文档时应使用的默认笔记本ID和保存路径。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            notebook: z.string().describe('当前操作的笔记本ID'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                box: z.string().describe('用于保存新文档的笔记本ID'),
                path: z.string().describe('用于保存新文档的人类可读路径'),
            })
        ),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/getRefCreateSavePath',
        en: 'getRefCreateSavePath',
        zh_cn: '获取新块引的默认保存位置',
        description: '根据当前笔记本和全局配置，计算并返回创建新块引文档时应使用的默认笔记本ID和保存路径。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            notebook: z.string().describe('当前操作的笔记本ID'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                box: z.string().describe('用于保存新块引文档的笔记本ID'),
                path: z.string().describe('用于保存新块引文档的人类可读路径'),
            })
        ),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/getHPathByPath',
        en: 'getHPathByPath',
        zh_cn: '通过文档实际路径获取人类可读路径',
        description: '根据文档在笔记本中的实际存储路径，获取其人类可读路径 (HPath)。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            notebook: z.string().describe('文档所在的笔记本ID'),
            path: z.string().describe('文档的实际存储路径'),
        }),
        zodResponseSchema: 创建响应Schema(z.string()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/getHPathsByPaths',
        en: 'getHPathsByPaths',
        zh_cn: '批量通过文档实际路径获取人类可读路径',
        description: '根据一组文档的实际存储路径，批量获取它们对应的人类可读路径。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            paths: z.array(z.string()).describe('文档的实际存储路径列表'),
        }),
        zodResponseSchema: 创建响应Schema(z.array(z.string())),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/getHPathByID',
        en: 'getHPathByID',
        zh_cn: '通过ID获取文档的人类可读路径',
        description: '根据文档或块的ID，获取其在笔记本中的人类可读路径 (HPath)。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要查询的文档或块的ID'),
        }),
        zodResponseSchema: 创建响应Schema(z.string()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/getPathByID',
        en: 'getPathByID',
        zh_cn: '通过ID获取文档的实际存储路径和笔记本ID',
        description: '根据文档或块的ID，获取其实际存储路径和所在的笔记本ID。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要查询的文档或块的ID'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                path: z.string().describe('文档的实际存储路径'),
                notebook: z.string().describe('文档所在的笔记本ID'),
            })
        ),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/getFullHPathByID',
        en: 'getFullHPathByID',
        zh_cn: '通过ID获取完整层级路径',
        description: '根据文档或块的ID，获取其在笔记本中的完整层级标题路径。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要查询的文档或块的ID'),
        }),
        zodResponseSchema: 创建响应Schema(z.string()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/getIDsByHPath',
        en: 'getIDsByHPath',
        zh_cn: '通过人类可读路径获取文档ID列表',
        description: '根据文档的人类可读路径和笔记本ID，获取所有匹配该路径的文档ID列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            notebook: z.string().describe('文档所在的笔记本ID'),
            path: z.string().describe('要查询的文档的人类可读路径'),
        }),
        zodResponseSchema: 创建响应Schema(z.array(z.string())),
        lastVerified: '2025-12-28',
    },

    // ========== 创建文档 ==========
    {
        method: 'POST',
        endpoint: '/api/filetree/createDocWithMd',
        en: 'createDocWithMd',
        zh_cn: '通过Markdown创建文档',
        description: '在指定笔记本、路径下，使用提供的Markdown内容创建一个新文档。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            notebook: z.string().describe('文档所属的笔记本ID'),
            path: z.string().describe('文档的人类可读路径 (HPath)'),
            markdown: z.string().describe('新文档的Markdown内容'),
            parentID: z.string().optional().describe('可选的父文档ID'),
            id: z.string().optional().describe('可选的新文档ID'),
            tags: z.string().optional().describe('可选的文档标签字符串，逗号分隔'),
            withMath: z.boolean().optional().describe('Markdown内容中是否包含数学公式'),
            clippingHref: z.string().optional().describe('剪藏的原始URL'),
            listDocTree: z.boolean().optional().describe('是否触发文档树更新事件'),
            callback: z.string().optional().describe('回调标识'),
        }),
        zodResponseSchema: 创建响应Schema(z.string()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/createDailyNote',
        en: 'createDailyNote',
        zh_cn: '创建或获取今日日记',
        description: '根据用户配置的日记模板创建今日的日记文档。如果今日的日记已存在，则直接返回该日记的信息。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            notebook: z.string().describe('要在哪个笔记本下创建日记的ID'),
            app: z.string().optional().describe('发起创建请求的应用标识'),
            callback: z.string().optional().describe('回调标识'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                id: z.string().describe('创建或获取到的日记文档的根块ID'),
            })
        ),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/createDoc',
        en: 'createDoc',
        zh_cn: '创建文档',
        description: '在指定的笔记本和路径下创建一个新的文档，并可以附带初始Markdown内容和排序信息。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            notebook: z.string().describe('文档所属的笔记本ID'),
            path: z.string().describe('文档的存储路径'),
            title: z.string().describe('文档的标题'),
            md: z.string().describe('文档的初始Markdown内容'),
            sorts: z.array(z.string()).optional().describe('可选的排序信息数组'),
            listDocTree: z.boolean().optional().describe('是否触发文档树更新事件'),
            callback: z.string().optional().describe('回调标识'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                id: z.string().describe('新创建文档的根块ID'),
                closeTimeout: z.number().optional().describe('操作失败时的建议等待时间'),
            })
        ),
        lastVerified: '2025-12-28',
    },

    // ========== 重命名文档 ==========
    {
        method: 'POST',
        endpoint: '/api/filetree/renameDoc',
        en: 'renameDoc',
        zh_cn: '重命名文档 (基于路径)',
        description: '根据指定的笔记本ID、文档路径和新标题，重命名该文档。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            notebook: z.string().describe('文档所在的笔记本ID'),
            path: z.string().describe('要重命名的文档的当前相对路径'),
            title: z.string().describe('文档的新标题'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/renameDocByID',
        en: 'renameDocByID',
        zh_cn: '重命名文档 (基于ID)',
        description: '根据指定的文档ID和新标题，重命名该文档。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要重命名的文档的ID'),
            title: z.string().describe('文档的新标题'),
        }),
        zodResponseSchema: 创建响应Schema(操作结果Schema.nullable()),
        lastVerified: '2025-12-28',
    },

    // ========== 删除文档 ==========
    {
        method: 'POST',
        endpoint: '/api/filetree/removeDoc',
        en: 'removeDoc',
        zh_cn: '移除文档 (基于路径)',
        description: '根据指定的笔记本ID和文档路径，移除该文档。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            notebook: z.string().describe('文档所在的笔记本ID'),
            path: z.string().describe('要移除的文档的相对路径'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/removeDocByID',
        en: 'removeDocByID',
        zh_cn: '移除文档 (基于ID)',
        description: '根据指定的文档ID，移除该文档。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要移除的文档的ID'),
        }),
        zodResponseSchema: 创建响应Schema(操作结果Schema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/removeDocs',
        en: 'removeDocs',
        zh_cn: '批量移除文档',
        description: '根据一组复合路径批量移除文档。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            paths: z.array(z.string()).describe('要移除的文档的复合路径数组'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-28',
    },

    // ========== 移动文档 ==========
    {
        method: 'POST',
        endpoint: '/api/filetree/moveDocs',
        en: 'moveDocs',
        zh_cn: '批量移动文档 (基于路径)',
        description: '将一组源文档移动到目标笔记本的指定路径下。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            fromPaths: z.array(z.string()).describe('要移动的源文档路径数组'),
            toNotebook: z.string().describe('目标笔记本的ID'),
            toPath: z.string().describe('目标路径'),
            callback: z.string().optional().describe('回调标识'),
        }),
        zodResponseSchema: 创建响应Schema(操作结果Schema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/moveDocsByID',
        en: 'moveDocsByID',
        zh_cn: '批量移动文档 (基于ID)',
        description: '将一组源文档移动到目标文档的目录下。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            fromIDs: z.array(z.string()).describe('要移动的源文档ID数组'),
            toID: z.string().describe('目标文档或目录的ID'),
            callback: z.string().optional().describe('回调标识'),
        }),
        zodResponseSchema: 创建响应Schema(操作结果Schema.nullable()),
        lastVerified: '2025-12-28',
    },

    // ========== 复制文档 ==========
    {
        method: 'POST',
        endpoint: '/api/filetree/duplicateDoc',
        en: 'duplicateDoc',
        zh_cn: '复制文档',
        description: '复制（克隆）一个指定的文档。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要复制的源文档的ID'),
            listDocTree: z.boolean().optional().describe('是否触发文档树更新事件'),
            callback: z.string().optional().describe('回调标识'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                id: z.string().describe('新复制出来的文档的根块ID'),
                notebook: z.string().describe('新文档所在的笔记本ID'),
                path: z.string().describe('新文档的存储路径'),
                hPath: z.string().describe('新文档的人类可读路径'),
                closeTimeout: z.number().optional().describe('操作失败时的建议等待时间'),
            })
        ),
        lastVerified: '2025-12-28',
    },

    // ========== 文档转换 ==========
    {
        method: 'POST',
        endpoint: '/api/filetree/doc2Heading',
        en: 'doc2Heading',
        zh_cn: '文档转换为标题块',
        description: '将一个源文档的内容转换为一个标题块，并将其插入到目标文档的指定位置。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            srcID: z.string().describe('要转换的源文档的ID'),
            targetID: z.string().describe('目标标题块的ID'),
            after: z.boolean().describe('是否插入到目标块之后'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                srcTreeBox: z.string().describe('源文档所在的笔记本ID'),
                srcTreePath: z.string().describe('源文档的路径'),
                closeTimeout: z.number().optional().describe('操作失败时的建议等待时间'),
            })
        ),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/heading2Doc',
        en: 'heading2Doc',
        zh_cn: '标题块转换为文档',
        description: '将源文档中的一个标题块及其后续同级内容，转换为一个新的独立文档。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            srcHeadingID: z.string().describe('要转换的标题块的ID'),
            targetNoteBook: z.string().describe('新文档将要创建在哪个笔记本'),
            targetPath: z.string().optional().describe('新文档在目标笔记本中的保存路径'),
            previousPath: z.string().optional().describe('用于指定新文档在文档树中的排序位置'),
            callback: z.string().optional().describe('回调标识'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/li2Doc',
        en: 'li2Doc',
        zh_cn: '列表项转换为文档',
        description: '将源文档中的一个列表项转换为一个新的独立文档。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            srcListItemID: z.string().describe('要转换的列表项的ID'),
            targetNoteBook: z.string().describe('新文档将要创建在哪个笔记本'),
            targetPath: z.string().optional().describe('新文档在目标笔记本中的保存路径'),
            previousPath: z.string().optional().describe('用于指定新文档在文档树中的排序位置'),
            callback: z.string().optional().describe('回调标识'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-28',
    },

    // ========== 排序和索引 ==========
    {
        method: 'POST',
        endpoint: '/api/filetree/changeSort',
        en: 'changeSort',
        zh_cn: '更改文档树排序',
        description: '更改指定笔记本下，特定路径列表的文档树排序方式。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            notebook: z.string().describe('要更改排序的笔记本ID'),
            paths: z.array(z.string()).describe('需要调整排序的文档路径列表'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/upsertIndexes',
        en: 'upsertIndexes',
        zh_cn: '更新或插入索引',
        description: '根据指定的文档路径列表，更新或插入这些文档在搜索引擎中的索引。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            paths: z.array(z.string()).describe('需要更新索引的文档绝对路径列表'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/removeIndexes',
        en: 'removeIndexes',
        zh_cn: '移除索引',
        description: '根据指定的文档路径列表，从搜索引擎中移除这些文档的索引。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            paths: z.array(z.string()).describe('需要移除索引的文档绝对路径列表'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-28',
    },

    // ========== 其他 ==========
    {
        method: 'POST',
        endpoint: '/api/filetree/moveLocalShorthands',
        en: 'moveLocalShorthands',
        zh_cn: '移动本地的闪念速记',
        description: '将指定笔记本中的本地闪念速记移动到配置的存放位置。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            notebook: z.string().describe('要处理闪念速记的笔记本ID'),
            path: z.string().optional().describe('可选的目标路径'),
            parentID: z.string().optional().describe('可选的目标父文档ID'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/filetree/refreshFiletree ',
        en: 'rebuildDataIndex',
        zh_cn: '刷新文档树并重建索引',
        description: '触发一次全局的文档树刷新和全量索引重建。这是一个耗时操作。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-28',
    },
] as const satisfies readonly Api定义[];

export type FiletreeApiDefs = typeof filetreeApiDefs;
