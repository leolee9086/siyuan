/**
 * 资源文件 (Asset) 相关 API 定义
 * 
 * 这些 API 用于管理思源笔记中的资源文件（图片、附件等）。
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

/**
 * 文件元信息 Schema
 */
const FileStatSchema = z.object({
    size: z.number().describe('文件大小（字节）'),
    hSize: z.string().describe('人类可读的文件大小'),
    created: z.number().describe('创建时间戳（毫秒）'),
    hCreated: z.string().describe('人类可读的创建时间'),
    updated: z.number().describe('最后修改时间戳（毫秒）'),
    hUpdated: z.string().describe('人类可读的最后修改时间'),
});

/**
 * OCR 结果 Schema
 */
const OcrResultSchema = z.object({
    text: z.string().describe('OCR 识别出的文本内容'),
    ocrJSON: z.any().describe('原始 OCR 结果，JSON 对象'),
});

export const assetApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/asset/uploadCloud',
        en: 'uploadCloud',
        zh_cn: '上传资源到云端',
        description: '将指定文档引用的所有本地资源上传到云存储。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('文档块 ID'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/uploadCloudByAssetsPaths',
        en: 'uploadCloudByAssetsPaths',
        zh_cn: '按路径上传资源到云端',
        description: '根据资源路径列表将指定资源上传到云存储。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            paths: z.array(z.string()).describe('资源路径列表'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/insertLocalAssets',
        en: 'insertLocalAssets',
        zh_cn: '插入本地资源文件',
        description: '将本地文件复制到 assets 文件夹并在文档中插入引用。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            assetPaths: z.array(z.string()).describe('本地资源文件的绝对路径'),
            id: z.string().describe('目标文档块 ID'),
            isUpload: z.boolean().optional().describe('是否为上传操作'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                succMap: z.record(z.string()).describe('成功插入的资源映射'),
            })
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/resolveAssetPath',
        en: 'resolveAssetPath',
        zh_cn: '解析资源绝对路径',
        description: '将资源相对路径转换为文件系统绝对路径。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            path: z.string().describe('资源相对路径'),
        }),
        zodResponseSchema: 创建响应Schema(z.string().describe('绝对路径')),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/upload',
        en: 'Upload',
        zh_cn: '上传文件',
        description: '处理文件上传。通过 FormData 传递文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        formDataRequest: true,
        zodRequestSchema: z.object({
            assetPath: z.string().optional().describe('保存的相对路径'),
            id: z.string().optional().describe('关联的文档块 ID'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                errFiles: z.array(z.string()).describe('上传失败的文件名'),
                succMap: z.record(z.string()).describe('上传成功的文件映射'),
            })
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/setFileAnnotation',
        en: 'setFileAnnotation',
        zh_cn: '设置文件标注',
        description: '为资源文件保存标注信息（如 PDF XFDF 标注）。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            path: z.string().describe('资源文件路径'),
            data: z.string().describe('标注数据（XFDF 格式）'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/getFileAnnotation',
        en: 'getFileAnnotation',
        zh_cn: '获取文件标注',
        description: '获取资源文件的标注信息。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            path: z.string().describe('资源文件路径'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                data: z.string().describe('标注数据'),
            })
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/getUnusedAssets',
        en: 'getUnusedAssets',
        zh_cn: '获取未使用资源列表',
        description: '获取未被任何文档引用的资源文件列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(
            z.object({
                unusedAssets: z.array(z.any()).describe('未使用的资源列表'),
            })
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/getMissingAssets',
        en: 'getMissingAssets',
        zh_cn: '获取丢失的资源列表',
        description: '获取被引用但实际文件不存在的资源列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(
            z.object({
                missingAssets: z.array(z.any()).describe('丢失的资源列表'),
            })
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/removeUnusedAsset',
        en: 'removeUnusedAsset',
        zh_cn: '移除单个未使用资源',
        description: '删除指定的未使用资源文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            path: z.string().describe('资源文件路径'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                path: z.string().describe('被移除的资源路径'),
            })
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/removeUnusedAssets',
        en: 'removeUnusedAssets',
        zh_cn: '移除所有未使用资源',
        description: '删除所有未被引用的资源文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(
            z.object({
                paths: z.array(z.string()).describe('被移除的资源路径列表'),
            })
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/getDocImageAssets',
        en: 'getDocImageAssets',
        zh_cn: '获取文档图片资源列表',
        description: '获取文档引用的所有图片类型资源。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('文档块 ID'),
        }),
        zodResponseSchema: 创建响应Schema(z.any().describe('图片资源列表')),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/getDocAssets',
        en: 'getDocAssets',
        zh_cn: '获取文档资源列表',
        description: '获取文档引用的所有资源文件。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('文档块 ID'),
        }),
        zodResponseSchema: 创建响应Schema(z.any().describe('资源文件列表')),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/renameAsset',
        en: 'renameAsset',
        zh_cn: '重命名资源文件',
        description: '重命名资源文件并自动更新所有引用。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            oldPath: z.string().describe('当前资源路径'),
            newName: z.string().describe('新文件名'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                newPath: z.string().describe('重命名后的新路径'),
            })
        ),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/getImageOCRText',
        en: 'getImageOCRText',
        zh_cn: '获取图片 OCR 文本',
        description: '获取图片资源的 OCR 识别文本。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            path: z.string().describe('图片资源路径'),
        }),
        zodResponseSchema: 创建响应Schema(z.object({
            text: z.string().describe('OCR 识别出的文本内容'),
        })),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/setImageOCRText',
        en: 'setImageOCRText',
        zh_cn: '设置图片 OCR 文本',
        description: '手动设置图片资源的 OCR 文本。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            path: z.string().describe('图片资源路径'),
            text: z.string().describe('OCR 文本'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/ocr',
        en: 'ocr',
        zh_cn: '对图片进行 OCR',
        description: '对图片执行 OCR 识别。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            path: z.string().describe('图片资源路径'),
        }),
        zodResponseSchema: 创建响应Schema(OcrResultSchema),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/fullReindexAssetContent',
        en: 'fullReindexAssetContent',
        zh_cn: '重建资源文件内容索引',
        description: '完全重新索引所有资源文件的内容。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-29',
    },
    {
        method: 'POST',
        endpoint: '/api/asset/statAsset',
        en: 'statAsset',
        zh_cn: '获取文件元信息',
        description: '获取资源文件的大小、创建和修改时间等信息。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            path: z.string().describe('资源路径或 file:/// 绝对路径'),
        }),
        zodResponseSchema: 创建响应Schema(FileStatSchema),
        lastVerified: '2025-12-29',
    },
] as const satisfies readonly Api定义[];

export type AssetApiDefs = typeof assetApiDefs;
