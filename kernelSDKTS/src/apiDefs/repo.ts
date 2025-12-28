/**
 * 仓库 (Repo) / 快照相关 API 定义
 * 
 * 这些 API 用于管理本地和云端的数据快照。
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

/**
 * 快照 Schema
 */
const SnapshotSchema = z.object({
    id: z.string().describe('快照的唯一标识符'),
    created: z.string().describe('创建时间戳 (Unix 秒级)'),
    hCreated: z.string().describe('格式化的创建时间'),
    size: z.number().int().describe('快照大小 (字节)'),
    hSize: z.string().describe('格式化的快照大小'),
    memo: z.string().describe('备注信息'),
});

/**
 * 标签快照 Schema
 */
const TagSnapshotSchema = SnapshotSchema.extend({
    tag: z.string().describe('标签名'),
});

/**
 * 快照分页响应 Schema
 */
const SnapshotPageResponseSchema = z.object({
    snapshots: z.array(SnapshotSchema).describe('快照列表'),
    pageCount: z.number().int().describe('总页数'),
    totalCount: z.number().int().describe('总数量'),
});

/**
 * 标签快照分页响应 Schema
 */
const TagSnapshotPageResponseSchema = z.object({
    snapshots: z.array(TagSnapshotSchema).describe('标签快照列表'),
    pageCount: z.number().int().describe('总页数'),
    totalCount: z.number().int().describe('总数量'),
});

/**
 * 文档差异项 Schema
 */
const DiffDocSchema = z.object({
    id: z.string().describe('文档 ID'),
    hPath: z.string().describe('文档 HPath'),
});

/**
 * 快照元信息 Schema
 */
const SnapshotMetaSchema = z.object({
    id: z.string().describe('快照 ID'),
    created: z.string().describe('创建时间戳'),
    memo: z.string().describe('备注'),
});

export const repoApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/repo/initRepoKey',
        en: 'initRepoKey',
        zh_cn: '初始化仓库密钥',
        description: '为当前工作区初始化一个新的随机加密密钥。旧密钥将被覆盖。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/initRepoKeyFromPassphrase',
        en: 'initRepoKeyFromPassphrase',
        zh_cn: '通过口令初始化仓库密钥',
        description: '通过用户提供的口令生成并初始化仓库加密密钥。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            passphrase: z.string().min(1).describe('用于生成密钥的用户口令'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/resetRepo',
        en: 'resetRepo',
        zh_cn: '重置本地仓库',
        description: '重置本地仓库，清空所有快照并重新初始化密钥。危险操作！',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/purgeRepo',
        en: 'purgeRepo',
        zh_cn: '清理本地仓库',
        description: '彻底删除本地仓库数据，包括所有快照。不可逆操作！',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/purgeCloudRepo',
        en: 'purgeCloudRepo',
        zh_cn: '清理云端仓库',
        description: '彻底删除云端所有仓库数据。不可逆操作！',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/importRepoKey',
        en: 'importRepoKey',
        zh_cn: '导入仓库密钥',
        description: '导入仓库加密密钥文件 (.sykey)。通过 FormData 接收文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        formDataRequest: true,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/createSnapshot',
        en: 'createSnapshot',
        zh_cn: '创建快照',
        description: '为当前工作区创建一个新的快照。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            memo: z.string().optional().describe('快照备注信息'),
            tag: z.string().optional().describe('标签名，如果提供则同时成为标签快照'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                id: z.string().describe('新创建的快照 ID'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/tagSnapshot',
        en: 'tagSnapshot',
        zh_cn: '标记快照',
        description: '为指定的本地快照打上标签。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('快照 ID'),
            tag: z.string().min(1).describe('标签名'),
            memo: z.string().optional().describe('备注，会覆盖原有备注'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/checkoutRepo',
        en: 'checkoutRepo',
        zh_cn: '检出仓库快照',
        description: '将工作区回滚到指定快照版本。危险操作！',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要检出的快照 ID'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/getRepoSnapshots',
        en: 'getRepoSnapshots',
        zh_cn: '获取本地快照列表',
        description: '分页获取本地存储的所有普通快照列表。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            page: z.number().int().positive().describe('页码，从 1 开始'),
        }),
        zodResponseSchema: 创建响应Schema(SnapshotPageResponseSchema),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/getRepoTagSnapshots',
        en: 'getRepoTagSnapshots',
        zh_cn: '获取本地标签快照列表',
        description: '分页获取本地存储的所有标签快照列表。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            page: z.number().int().positive().describe('页码，从 1 开始'),
        }),
        zodResponseSchema: 创建响应Schema(TagSnapshotPageResponseSchema),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/removeRepoTagSnapshot',
        en: 'removeRepoTagSnapshot',
        zh_cn: '移除本地标签快照',
        description: '从本地仓库移除指定的标签快照。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('标签快照 ID'),
            tag: z.string().describe('标签名'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/getCloudRepoTagSnapshots',
        en: 'getCloudRepoTagSnapshots',
        zh_cn: '获取云端标签快照列表',
        description: '分页获取云端存储的所有标签快照列表。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            page: z.number().int().positive().describe('页码，从 1 开始'),
        }),
        zodResponseSchema: 创建响应Schema(TagSnapshotPageResponseSchema),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/getCloudRepoSnapshots',
        en: 'getCloudRepoSnapshots',
        zh_cn: '获取云端快照列表',
        description: '分页获取云端存储的所有普通快照列表。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            page: z.number().int().positive().describe('页码，从 1 开始'),
        }),
        zodResponseSchema: 创建响应Schema(SnapshotPageResponseSchema),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/removeCloudRepoTagSnapshot',
        en: 'removeCloudRepoTagSnapshot',
        zh_cn: '移除云端标签快照',
        description: '从云端移除指定的标签快照。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('标签快照 ID'),
            tag: z.string().describe('标签名'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/uploadCloudSnapshot',
        en: 'uploadCloudSnapshot',
        zh_cn: '上传快照到云端',
        description: '将指定的本地快照上传到云端。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('本地快照 ID'),
            tag: z.string().optional().describe('标签名（标签快照时需要）'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/downloadCloudSnapshot',
        en: 'downloadCloudSnapshot',
        zh_cn: '下载云端快照',
        description: '从云端下载指定的快照到本地。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('云端快照 ID'),
            tag: z.string().optional().describe('标签名（标签快照时需要）'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/diffRepoSnapshots',
        en: 'diffRepoSnapshots',
        zh_cn: '比较快照差异',
        description: '比较两个本地快照之间的差异。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            left: z.string().describe('左侧快照 ID（旧版本）'),
            right: z.string().describe('右侧快照 ID（新版本）'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                addsLeft: z.array(DiffDocSchema).describe('新增的文档'),
                updatesLeft: z.array(DiffDocSchema).describe('在左侧存在并被修改的文档'),
                updatesRight: z.array(DiffDocSchema).describe('在右侧存在并被修改的文档'),
                removesRight: z.array(DiffDocSchema).describe('被删除的文档'),
                left: SnapshotMetaSchema.describe('左侧快照元信息'),
                right: SnapshotMetaSchema.describe('右侧快照元信息'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/openRepoSnapshotDoc',
        en: 'openRepoSnapshotDoc',
        zh_cn: '打开快照中的文档',
        description: '获取快照中特定文档的内容，用于预览历史版本。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('快照中文档的标识符'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                title: z.string().describe('文档标题'),
                content: z.string().describe('文档内容 (HTML)'),
                displayInText: z.boolean().describe('是否纯文本显示'),
                updated: z.string().describe('最后更新时间戳'),
            }).nullable()
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/getRepoFile',
        en: 'getRepoFile',
        zh_cn: '获取快照中的文件内容',
        description: '获取快照中特定文件的原始内容。返回文件数据流。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('快照 ID'),
            path: z.string().optional().describe('文件的相对路径'),
        }),
        zodResponseSchema: z.any().describe('文件数据流'),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/setRepoIndexRetentionDays',
        en: 'setRepoIndexRetentionDays',
        zh_cn: '设置快照索引保留天数',
        description: '设置本地快照索引的保留天数。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            days: z.number().int().min(1).describe('保留天数'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
    {
        method: 'POST',
        endpoint: '/api/repo/setRetentionIndexesDaily',
        en: 'setRetentionIndexesDaily',
        zh_cn: '设置每日快照保留数量',
        description: '设置每日自动快照的保留数量。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            indexes: z.number().int().min(1).describe('每日保留数量'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
    },
] as const satisfies readonly Api定义[];

export type RepoApiDefs = typeof repoApiDefs;
