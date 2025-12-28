/**
 * 集市 (Bazaar) 相关 API 定义
 * 
 * 这些 API 用于管理插件、主题、图标包、模板和挂件等集市资源。
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

/**
 * 包列表响应 Schema
 */
const PackagesResponseSchema = z.object({
    packages: z.array(z.any()).describe('包对象数组'),
});

/**
 * 带外观配置的响应 Schema
 */
const PackagesWithAppearanceResponseSchema = z.object({
    packages: z.array(z.any()).describe('包对象数组'),
    appearance: z.any().describe('外观配置对象'),
});

/**
 * 可更新包响应 Schema
 */
const UpdatedPackagesResponseSchema = z.object({
    plugins: z.array(z.any()).describe('可更新的插件'),
    widgets: z.array(z.any()).describe('可更新的挂件'),
    icons: z.array(z.any()).describe('可更新的图标包'),
    themes: z.array(z.any()).describe('可更新的主题'),
    templates: z.array(z.any()).describe('可更新的模板'),
});

export const bazaarApiDefs = [
    // === 插件 ===
    {
        method: 'POST',
        endpoint: '/api/bazaar/getBazaarPlugin',
        en: 'getBazaarPlugin',
        zh_cn: '获取集市插件列表',
        description: '从集市获取所有可用的插件列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            frontend: z.string().describe('客户端类型'),
            keyword: z.string().optional().describe('搜索关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/getInstalledPlugin',
        en: 'getInstalledPlugin',
        zh_cn: '获取已安装的插件列表',
        description: '获取本地已安装的插件列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            frontend: z.string().describe('客户端类型'),
            keyword: z.string().optional().describe('搜索关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/installBazaarPlugin',
        en: 'installBazaarPlugin',
        zh_cn: '安装集市插件',
        description: '从集市安装指定的插件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            repoURL: z.string().describe('仓库 URL'),
            repoHash: z.string().describe('版本哈希'),
            packageName: z.string().describe('包名称'),
            frontend: z.string().describe('客户端类型'),
            keyword: z.string().optional().describe('刷新列表的关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/uninstallBazaarPlugin',
        en: 'uninstallBazaarPlugin',
        zh_cn: '卸载插件',
        description: '卸载本地已安装的插件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            packageName: z.string().describe('包名称'),
            frontend: z.string().describe('客户端类型'),
            keyword: z.string().optional().describe('刷新列表的关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },

    // === 挂件 ===
    {
        method: 'POST',
        endpoint: '/api/bazaar/getBazaarWidget',
        en: 'getBazaarWidget',
        zh_cn: '获取集市挂件列表',
        description: '从集市获取所有可用的挂件列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            keyword: z.string().optional().describe('搜索关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/getInstalledWidget',
        en: 'getInstalledWidget',
        zh_cn: '获取已安装的挂件列表',
        description: '获取本地已安装的挂件列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            keyword: z.string().optional().describe('搜索关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/installBazaarWidget',
        en: 'installBazaarWidget',
        zh_cn: '安装集市挂件',
        description: '从集市安装指定的挂件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            repoURL: z.string().describe('仓库 URL'),
            repoHash: z.string().describe('版本哈希'),
            packageName: z.string().describe('包名称'),
            keyword: z.string().optional().describe('刷新列表的关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/uninstallBazaarWidget',
        en: 'uninstallBazaarWidget',
        zh_cn: '卸载挂件',
        description: '卸载本地已安装的挂件。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            packageName: z.string().describe('包名称'),
            keyword: z.string().optional().describe('刷新列表的关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },

    // === 图标包 ===
    {
        method: 'POST',
        endpoint: '/api/bazaar/getBazaarIcon',
        en: 'getBazaarIcon',
        zh_cn: '获取集市图标包列表',
        description: '从集市获取所有可用的图标包列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            keyword: z.string().optional().describe('搜索关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/getInstalledIcon',
        en: 'getInstalledIcon',
        zh_cn: '获取已安装的图标包列表',
        description: '获取本地已安装的图标包列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            keyword: z.string().optional().describe('搜索关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/installBazaarIcon',
        en: 'installBazaarIcon',
        zh_cn: '安装集市图标包',
        description: '从集市安装指定的图标包。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            repoURL: z.string().describe('仓库 URL'),
            repoHash: z.string().describe('版本哈希'),
            packageName: z.string().describe('包名称'),
            keyword: z.string().optional().describe('刷新列表的关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesWithAppearanceResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/uninstallBazaarIcon',
        en: 'uninstallBazaarIcon',
        zh_cn: '卸载图标包',
        description: '卸载本地已安装的图标包。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            packageName: z.string().describe('包名称'),
            keyword: z.string().optional().describe('刷新列表的关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesWithAppearanceResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },

    // === 模板 ===
    {
        method: 'POST',
        endpoint: '/api/bazaar/getBazaarTemplate',
        en: 'getBazaarTemplate',
        zh_cn: '获取集市模板列表',
        description: '从集市获取所有可用的模板列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            keyword: z.string().optional().describe('搜索关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/getInstalledTemplate',
        en: 'getInstalledTemplate',
        zh_cn: '获取已安装的模板列表',
        description: '获取本地已安装的模板列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            keyword: z.string().optional().describe('搜索关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/installBazaarTemplate',
        en: 'installBazaarTemplate',
        zh_cn: '安装集市模板',
        description: '从集市安装指定的模板。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            repoURL: z.string().describe('仓库 URL'),
            repoHash: z.string().describe('版本哈希'),
            packageName: z.string().describe('包名称'),
            keyword: z.string().optional().describe('刷新列表的关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/uninstallBazaarTemplate',
        en: 'uninstallBazaarTemplate',
        zh_cn: '卸载模板',
        description: '卸载本地已安装的模板。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            packageName: z.string().describe('包名称'),
            keyword: z.string().optional().describe('刷新列表的关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },

    // === 主题 ===
    {
        method: 'POST',
        endpoint: '/api/bazaar/getBazaarTheme',
        en: 'getBazaarTheme',
        zh_cn: '获取集市主题列表',
        description: '从集市获取所有可用的主题列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            keyword: z.string().optional().describe('搜索关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/getInstalledTheme',
        en: 'getInstalledTheme',
        zh_cn: '获取已安装的主题列表',
        description: '获取本地已安装的主题列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            keyword: z.string().optional().describe('搜索关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/installBazaarTheme',
        en: 'installBazaarTheme',
        zh_cn: '安装集市主题',
        description: '从集市安装指定的主题。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            repoURL: z.string().describe('仓库 URL'),
            repoHash: z.string().describe('版本哈希'),
            packageName: z.string().describe('包名称'),
            mode: z.number().describe('主题模式：0=亮色，1=暗色，2=跟随系统'),
            update: z.boolean().optional().describe('是否为更新操作'),
            keyword: z.string().optional().describe('刷新列表的关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesWithAppearanceResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/uninstallBazaarTheme',
        en: 'uninstallBazaarTheme',
        zh_cn: '卸载主题',
        description: '卸载本地已安装的主题。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            packageName: z.string().describe('包名称'),
            keyword: z.string().optional().describe('刷新列表的关键词'),
        }),
        zodResponseSchema: 创建响应Schema(PackagesWithAppearanceResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },

    // === 其他 ===
    {
        method: 'POST',
        endpoint: '/api/bazaar/getBazaarPackageREAME',
        en: 'getBazaarPackageREAME',
        zh_cn: '获取集市包的README',
        description: '获取指定集市包的 README 内容。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            repoURL: z.string().describe('仓库 URL'),
            repoHash: z.string().describe('版本哈希'),
            packageType: z.string().describe('包类型'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                html: z.string().describe('README HTML 内容'),
            }).nullable()
        ),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/getUpdatedPackage',
        en: 'getUpdatedPackage',
        zh_cn: '获取可更新的集市包',
        description: '检查并返回所有已安装且存在更新的包。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            frontend: z.string().describe('客户端类型'),
        }),
        zodResponseSchema: 创建响应Schema(UpdatedPackagesResponseSchema.nullable()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/batchUpdatePackage',
        en: 'batchUpdatePackage',
        zh_cn: '批量更新集市包',
        description: '批量更新本地缓存的集市包信息。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        zodRequestSchema: z.object({
            frontend: z.string().describe('客户端类型'),
        }),
        zodResponseSchema: 创建响应Schema(z.null()),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/bazaar/getBazaarKeywords',
        en: 'getBazaarKeywords',
        zh_cn: '获取集市搜索关键词',
        description: '获取集市热门搜索关键词列表。',
        needAuth: true,
        needAdminRole: false,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            type: z.string().describe('集市类型 (plugins, themes, icons, templates, widgets)'),
            frontend: z.string().optional().describe('客户端类型'),
            keyword: z.string().optional().describe('搜索关键词'),
        }),
        zodResponseSchema: 创建响应Schema(
            z.object({
                keywords: z.array(z.string()).describe('关键词列表'),
            }).nullable()
        ),
        lastVerified: '2025-12-28',
    },
] as const satisfies readonly Api定义[];

export type BazaarApiDefs = typeof bazaarApiDefs;
