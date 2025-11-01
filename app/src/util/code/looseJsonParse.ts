// REF https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/eval

import { createSecureTemporaryModule } from './executor';
import { confirmDialog } from '../../dialog/confirmDialog';
import { parse } from 'es-module-lexer';

/**
 * 包名许可管理器
 * 负责管理用户对特定包名的许可决定，避免重复请求用户确认
 */
class PackagePermissionManager {
    private cache = new Map<string, boolean>();

    /**
     * 检查包名是否已在缓存中有许可结果
     * @param packageName 包名
     * @returns 是否已缓存及许可结果，未缓存返回null
     */
    getCachedPermission(packageName: string): boolean | null {
        return this.cache.has(packageName) ? this.cache.get(packageName)! : null;
    }

    /**
     * 缓存用户对包名的许可结果
     * @param packageName 包名
     * @param allowed 用户是否允许
     */
    cachePermission(packageName: string, allowed: boolean): void {
        this.cache.set(packageName, allowed);
    }

    /**
     * 清空缓存
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * 分离已缓存和未缓存的包
     * @param packages 包名列表
     * @returns 分离后的已缓存和未缓存包
     */
    separateCachedPackages(packages: string[]): { cached: string[], uncached: string[] } {
        const cached: string[] = [];
        const uncached: string[] = [];
        
        packages.forEach(pkg => {
            const permission = this.getCachedPermission(pkg);
            if (permission === true) {
                cached.push(pkg);
            } else if (permission === false) {
                // 如果用户之前拒绝过这个包，直接抛出错误
                throw new Error(`用户之前已拒绝导入包: ${pkg}`);
            } else {
                uncached.push(pkg);
            }
        });

        return { cached, uncached };
    }

    /**
     * 批量缓存包许可
     * @param packages 包名列表
     * @param allowed 用户是否允许
     */
    batchCachePermissions(packages: string[], allowed: boolean): void {
        packages.forEach(pkg => {
            this.cachePermission(pkg, allowed);
        });
    }
}

// 创建全局实例
const packagePermissionManager = new PackagePermissionManager();

/**
 * 从代码中提取外部包名
 */
const extractExternalPackages = async (code: string): Promise<string[]> => {
    try {
        await parse; // 确保 es-module-lexer 已初始化
        const imports = parse(code)[0] || [];
        const packageNames = new Set<string>();

        for (const importSpec of imports) {
            const importSource = code.substring(importSpec.s, importSpec.e);

            // 检查是否为外部包（不以 . 或 / 或 http 开头）
            if (!importSource.startsWith('.') &&
                !importSource.startsWith('/') &&
                !importSource.startsWith('http:') &&
                !importSource.startsWith('https:')) {

                // 提取包名
                const cleanSource = importSource.split('?')[0].split('#')[0];
                if (cleanSource.startsWith('@')) {
                    // 处理作用域包，如 @babel/core
                    const parts = cleanSource.split('/');
                    if (parts.length >= 2) {
                        packageNames.add(`${parts[0]}/${parts[1]}`);
                    }
                } else {
                    // 处理普通包名
                    packageNames.add(cleanSource);
                }
            }
        }

        return Array.from(packageNames);
    } catch (error) {
        console.warn('提取包名时出错:', error);
        return [];
    }
};

/**
 * 宽松的JSON解析函数，支持JavaScript表达式
 * 当代码中包含import或require语句时，使用执行器方案安全执行
 */
export const looseJsonParse = async (text: string): Promise<any> => {
    // 检查是否包含import或require语句
    const hasImportOrRequire = /\b(import|require)\b/.test(text);

    if (hasImportOrRequire) {
        // 提取外部包名
        const externalPackages = await extractExternalPackages(text);
        
        // 分离已缓存和未缓存的包
        const { cached: cachedPackages, uncached: uncachedPackages } = packagePermissionManager.separateCachedPackages(externalPackages);

        // 如果所有包都已缓存且被允许，直接执行
        if (uncachedPackages.length === 0) {
            try {
                const tempModule = await createSecureTemporaryModule(text, {
                    // 允许所有检测到的外部包
                    allowedPackages: externalPackages,
                    onUnauthorizedImport: 'throw',
                    // 启用模块重定向，将未配置重定向的包重定向到 esm.sh
                    moduleRedirectConfig: {
                        defaultServer: 'https://esm.sh',
                        packageRedirects: {},
                        enabled: true,
                        bareModulesOnly: true
                    }
                });
                
                try {
                    return tempModule.moduleExport.default;
                } finally {
                    // 清理资源
                    tempModule.cleanup();
                }
            } catch (error) {
                throw error;
            }
        }

        // 构建确认消息
        let confirmMessage = '检测到代码中包含 import 或 require 语句';
        
        if (cachedPackages.length > 0) {
            confirmMessage += `\n\n已允许的包（无需再次确认）：\n${cachedPackages.map(pkg => `• ${pkg}`).join('\n')}`;
        }
        
        if (uncachedPackages.length > 0) {
            confirmMessage += `\n\n新检测到的包（需要确认）：\n${uncachedPackages.map(pkg => `• ${pkg}`).join('\n')}`;
        } else {
            confirmMessage += '，但未检测到明确的外部包名';
        }
        
        confirmMessage += '\n\n是否继续执行？';

        // 弹出确认对话框，提示用户代码包含外部依赖
        return new Promise((resolve, reject) => {
            confirmDialog(
                '安全提示',
                confirmMessage,
                async () => {
                    try {
                        console.log(text);

                        // 将用户确认的包添加到缓存
                        packagePermissionManager.batchCachePermissions(uncachedPackages, true);

                        const tempModule = await createSecureTemporaryModule(text, {
                            // 允许所有检测到的外部包
                            allowedPackages: externalPackages,
                            onUnauthorizedImport: 'throw',
                            // 启用模块重定向，将未配置重定向的包重定向到 esm.sh
                            moduleRedirectConfig: {
                                defaultServer: 'https://esm.sh',
                                packageRedirects: {},
                                enabled: true,
                                bareModulesOnly: true
                            }
                        });
                        console.log(tempModule);
                        try {
                            resolve(tempModule.moduleExport.default);
                        } finally {
                            // 清理资源
                            tempModule.cleanup();
                        }
                    } catch (error) {
                        reject(error);
                    }
                },
                () => {
                    // 用户取消，将拒绝的包也缓存起来
                    packagePermissionManager.batchCachePermissions(uncachedPackages, false);
                    
                    // 用户取消，抛出错误
                    reject(new Error('用户取消了包含外部依赖的代码执行'));
                }
            );
        });
    } else {
        // 对于简单的JSON或JavaScript表达式，继续使用原来的方法
        return Function(`"use strict";return (${text})`)();
    }
};

/**
 * 导出缓存管理函数，供外部使用
 */
export const packageCacheManager = {
    getCachedPackagePermission: (packageName: string) => packagePermissionManager.getCachedPermission(packageName),
    cachePackagePermission: (packageName: string, allowed: boolean) => packagePermissionManager.cachePermission(packageName, allowed),
    clearCache: () => packagePermissionManager.clearCache()
};
