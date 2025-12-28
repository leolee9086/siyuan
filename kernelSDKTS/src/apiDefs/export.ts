/**
 * export 相关 API 定义
 * 
 * 文档导出功能相关的 API，支持多种格式导出
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

// ========== 通用 Schema 定义 ==========

/** 导出文件结果 Schema (zip) */
const 导出Zip结果Schema = z.object({
    name: z.string().describe('导出的文件名'),
    zip: z.string().describe('导出的文件在服务器上的绝对路径'),
});

/** 只有 zip 路径的导出结果 Schema */
const 导出Zip路径Schema = z.object({
    zip: z.string().describe('导出的文件在服务器上的绝对路径'),
});

/** 导出 HTML 内容结果 Schema */
const 导出HTML内容Schema = z.object({
    id: z.string().describe('导出的文档ID'),
    name: z.string().describe('文档的原始名称'),
    content: z.string().describe('生成的 HTML 内容'),
});

export const exportApiDefs = [
    // ========== 导出到第三方平台 ==========
    {
        method: 'POST',
        endpoint: '/api/export/export2Liandi',
        en: 'export2Liandi',
        zh_cn: '导出到链滴',
        description: '将指定的文档内容导出到链滴社区。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出到链滴的文档ID'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
    },

    // ========== 文件导出 ==========
    {
        method: 'POST',
        endpoint: '/api/export/exportAsFile',
        en: 'exportAsFile',
        zh_cn: '导出上传的文件',
        description: "接收上传的文件，将其保存到临时导出目录，并返回处理后的文件名及可访问路径。通常用于'另存为'等场景。",
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            type: z.string().describe('上传文件的MIME类型'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                name: z.string().describe('处理后的文件名'),
                file: z.string().describe('文件在服务器上的可访问路径 (相对于/export/)'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportResources',
        en: 'exportResources',
        zh_cn: '导出指定资源',
        description: '将指定路径列表的文件或文件夹打包导出为一个 .zip 压缩文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            name: z.string().optional().describe("导出的 .zip 文件的主文件名 (不含扩展名)。如果为空，则默认为 'export-YYYY-MM-DD_HH-mm-ss' 格式"),
            paths: z.array(z.string()).describe('要导出的文件或文件夹在工作空间中的相对路径数组 (相对于data目录)'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                path: z.string().describe('导出的 .zip 文件在服务器上的绝对路径'),
            })
        ),
    },

    // ========== 导出全部数据 ==========
    {
        method: 'POST',
        endpoint: '/api/export/exportData',
        en: 'exportData',
        zh_cn: '导出全部数据',
        description: '导出当前工作空间的全部数据为一个 .zip 压缩文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(导出Zip路径Schema),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportDataInFolder',
        en: 'exportDataInFolder',
        zh_cn: '导出文件夹数据',
        description: '导出指定文件夹内的所有数据为一个压缩包。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            folder: z.string().describe('要导出数据的文件夹路径 (相对于工作空间data目录)'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                name: z.string().describe('导出的压缩包文件名 (不含路径)'),
            })
        ),
    },

    // ========== Markdown 导出 ==========
    {
        method: 'POST',
        endpoint: '/api/export/exportMd',
        en: 'exportMd',
        zh_cn: '导出单个文档为Markdown',
        description: '将指定的单个文档导出为 Markdown 文件，并打包成一个 .zip 压缩文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出的文档ID'),
        }),
        zodResponseSchema: 创建响应Schema(导出Zip结果Schema),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportMds',
        en: 'exportMds',
        zh_cn: '批量导出文档为Markdown',
        description: '将指定的多个文档分别导出为 Markdown 文件，并打包成一个 .zip 压缩文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            ids: z.array(z.string()).describe('要导出的文档ID数组'),
        }),
        zodResponseSchema: 创建响应Schema(导出Zip结果Schema),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportNotebookMd',
        en: 'exportNotebookMd',
        zh_cn: '导出笔记本为Markdown',
        description: '将指定的笔记本导出为 Markdown 格式的 .zip 压缩文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            notebook: z.string().describe('要导出的笔记本ID'),
        }),
        zodResponseSchema: 创建响应Schema(导出Zip结果Schema),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportMdContent',
        en: 'exportMdContent',
        zh_cn: '导出文档Markdown内容',
        description: '获取指定文档的 Markdown 文本内容，可自定义块引用和嵌入块的处理方式以及是否包含 YAML Front Matter。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出 Markdown 内容的文档ID'),
            refMode: z.number().optional().describe('块引用处理模式 (0: 锚文本, 1: ((id)) 形式, 2: 嵌入块, 默认遵从全局配置)'),
            embedMode: z.number().optional().describe('嵌入块处理模式 (0: 忽略, 1: 展开, 默认遵从全局配置)'),
            yfm: z.boolean().optional().describe('是否包含 YAML Front Matter (默认为 true)'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                hPath: z.string().describe('文档的人类可读路径 (面包屑路径)'),
                content: z.string().describe('导出的 Markdown 文本内容'),
            })
        ),
    },

    // ========== HTML 导出 ==========
    {
        method: 'POST',
        endpoint: '/api/export/exportHTML',
        en: 'exportHTML',
        zh_cn: '导出文档为标准HTML',
        description: '将指定文档导出为标准的、包含完整思源主题样式和脚本的 HTML 内容，通常用于生成可独立浏览的 HTML 文件或作为导出 PDF 的中间步骤。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出的文档ID'),
            pdf: z.boolean().describe('是否为导出 PDF 进行预处理'),
            savePath: z.string().describe('服务器上保存 HTML 文件的绝对路径'),
            keepFold: z.boolean().optional().describe('是否在导出时保持块的折叠状态'),
            merge: z.boolean().optional().describe('是否将子文档内容合并到主文档中导出'),
        }),
        zodResponseSchema: 创建响应Schema(导出HTML内容Schema),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportPreviewHTML',
        en: 'exportPreviewHTML',
        zh_cn: '导出文档预览HTML',
        description: '获取指定文档用于预览的 HTML 内容，包含块属性、类型等更丰富的上下文信息。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出预览 HTML 的文档ID'),
            keepFold: z.boolean().optional().describe('是否在导出时保持块的折叠状态'),
            merge: z.boolean().optional().describe('是否将子文档内容合并到主文档中导出'),
            image: z.boolean().optional().describe('是否为图片导出优化'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                id: z.string().describe('导出的文档ID'),
                name: z.string().describe('文档的原始名称'),
                content: z.string().describe('生成的预览 HTML 内容'),
                attrs: z.record(z.string()).describe('文档块的属性 (IAL)'),
                type: z.string().describe('文档块的类型'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportMdHTML',
        en: 'exportMdHTML',
        zh_cn: '导出文档为纯HTML内容',
        description: '获取指定文档渲染后的纯 HTML 内容（不包含完整主题样式和脚本）。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出 HTML 内容的文档ID'),
            savePath: z.string().describe('服务器上保存 HTML 文件的绝对路径'),
        }),
        zodResponseSchema: 创建响应Schema(导出HTML内容Schema),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportBrowserHTML',
        en: 'exportBrowserHTML',
        zh_cn: '导出浏览器HTML',
        description: '导出浏览器 HTML 内容。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({}),
        zodResponseSchema: 创建响应Schema(z.any()),
    },
    {
        method: 'POST',
        endpoint: '/api/export/preview',
        en: 'exportPreview',
        zh_cn: '获取文档HTML预览',
        description: '获取指定文档的完整 HTML 预览内容，包含标准主题和脚本，可直接用于浏览器展示。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要获取 HTML 预览的文档ID'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                html: z.string().describe('生成的文档 HTML 预览内容'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportTempContent',
        en: 'exportTempContent',
        zh_cn: '导出临时内容预览',
        description: '将传入的 Markdown 内容保存为临时文件，并返回预览的 URL。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            content: z.string().describe('要导出预览的 Markdown 内容字符串'),
            mode: z.number().optional().describe('导出模式'),
            theme: z.string().optional().describe('主题名称'),
            title: z.string().optional().describe('导出内容的标题'),
            type: z.string().optional().describe("导出类型，如 'html', 'pdf', 'png'"),
            css: z.string().optional().describe('自定义 CSS 内容'),
            js: z.string().optional().describe('自定义 JavaScript 内容'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                url: z.string().describe('生成的临时内容预览 URL'),
            })
        ),
    },

    // ========== 思源原生格式导出 ==========
    {
        method: 'POST',
        endpoint: '/api/export/exportSY',
        en: 'exportSY',
        zh_cn: '导出单个文档为.sy包',
        description: '将指定的单个文档导出为思源原生 .sy 格式的压缩包。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出的文档ID'),
        }),
        zodResponseSchema: 创建响应Schema(导出Zip结果Schema),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportNotebookSY',
        en: 'exportNotebookSY',
        zh_cn: '导出笔记本为.sy包',
        description: '将指定的笔记本导出为思源原生 .sy 格式的压缩包。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出的笔记本ID'),
        }),
        zodResponseSchema: 创建响应Schema(导出Zip路径Schema),
    },

    // ========== Office 格式导出 ==========
    {
        method: 'POST',
        endpoint: '/api/export/exportDocx',
        en: 'exportDocx',
        zh_cn: '导出文档为DOCX',
        description: '将指定的文档导出为 DOCX (.docx) 文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出的文档ID'),
            savePath: z.string().describe('服务器上保存 .docx 文件的绝对路径'),
            removeAssets: z.boolean().describe('是否移除导出的 Word 文件中包含的资源文件'),
            merge: z.boolean().optional().describe('是否将子文档内容合并到主文档中导出'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                path: z.string().describe('最终生成的 .docx 文件在服务器上的绝对路径'),
            })
        ),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportODT',
        en: 'exportODT',
        zh_cn: '导出文档为ODT',
        description: '将指定的文档导出为 ODT 格式的压缩文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出的文档ID'),
        }),
        zodResponseSchema: 创建响应Schema(导出Zip结果Schema),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportRTF',
        en: 'exportRTF',
        zh_cn: '导出文档为RTF',
        description: '将指定的文档导出为 RTF 格式的压缩文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出的文档ID'),
        }),
        zodResponseSchema: 创建响应Schema(导出Zip结果Schema),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportEPUB',
        en: 'exportEPUB',
        zh_cn: '导出文档为EPUB',
        description: '将指定的文档导出为 EPUB 格式的压缩文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出的文档ID'),
        }),
        zodResponseSchema: 创建响应Schema(导出Zip结果Schema),
    },

    // ========== 其他文本格式导出 ==========
    {
        method: 'POST',
        endpoint: '/api/export/exportAsciiDoc',
        en: 'exportAsciiDoc',
        zh_cn: '导出文档为AsciiDoc',
        description: '将指定的文档导出为 AsciiDoc 格式的压缩文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出的文档ID'),
        }),
        zodResponseSchema: 创建响应Schema(导出Zip结果Schema),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportReStructuredText',
        en: 'exportReStructuredText',
        zh_cn: '导出文档为reStructuredText',
        description: '将指定的文档导出为 reStructuredText 格式的压缩文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出的文档ID'),
        }),
        zodResponseSchema: 创建响应Schema(导出Zip结果Schema),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportTextile',
        en: 'exportTextile',
        zh_cn: '导出文档为Textile',
        description: '将指定的文档导出为 Textile 格式的压缩文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出的文档ID'),
        }),
        zodResponseSchema: 创建响应Schema(导出Zip结果Schema),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportOPML',
        en: 'exportOPML',
        zh_cn: '导出文档为OPML',
        description: '将指定的文档导出为 OPML 格式的压缩文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出的文档ID'),
        }),
        zodResponseSchema: 创建响应Schema(导出Zip结果Schema),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportOrgMode',
        en: 'exportOrgMode',
        zh_cn: '导出文档为OrgMode',
        description: '将指定的文档导出为 Org-mode 格式的压缩文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出的文档ID'),
        }),
        zodResponseSchema: 创建响应Schema(导出Zip结果Schema),
    },
    {
        method: 'POST',
        endpoint: '/api/export/exportMediaWiki',
        en: 'exportMediaWiki',
        zh_cn: '导出文档为MediaWiki',
        description: '将指定的文档导出为 MediaWiki 格式的压缩文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('要导出的文档ID'),
        }),
        zodResponseSchema: 创建响应Schema(导出Zip结果Schema),
    },

    // ========== PDF 相关 ==========
    {
        method: 'POST',
        endpoint: '/api/export/processPDF',
        en: 'processPDF',
        zh_cn: 'PDF导出后处理',
        description: '对已生成的用于 PDF 导出的 HTML 文件进行后处理，如添加水印等。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('相关文档的ID'),
            path: z.string().describe('已生成的 HTML 文件的绝对路径'),
            merge: z.boolean().optional().describe('是否将子文档内容合并'),
            removeAssets: z.boolean().describe('处理完成后是否移除相关资源文件'),
            watermark: z.boolean().describe('是否添加水印'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
    },

    // ========== 属性视图导出 ==========
    {
        method: 'POST',
        endpoint: '/api/export/exportAttributeView',
        en: 'exportAttributeView',
        zh_cn: '导出属性视图为CSV',
        description: '将指定的属性视图导出为 CSV 压缩文件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            id: z.string().describe('属性视图的ID (avID)'),
            blockID: z.string().describe('包含该属性视图的块ID'),
        }),
        zodResponseSchema: 创建响应Schema(导出Zip路径Schema),
    },
] as const satisfies readonly Api定义[];

export type ExportApiDefs = typeof exportApiDefs;
