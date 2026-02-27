// REF https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/eval

import { createSecureTemporaryModule } from "./executor";
import { confirmDialog } from "../../../dialog/confirmDialog";
import { parse } from "es-module-lexer";
import { PackagePermissionManager } from "./PackagePermissionManager";
import type { 确认执行参数 } from "./looseJsonParse.types";

// 创建全局实例
const packagePermissionManager = new PackagePermissionManager();

/**
 * 创建临时模块的配置对象
 */
const 创建模块配置 = (allowedPackages: string[]) => ({
    allowedPackages,
    onUnauthorizedImport: "throw" as const,
    moduleRedirectConfig: {
        defaultServer: "https://esm.sh",
        packageRedirects: {},
        enabled: true,
        bareModulesOnly: true
    }
});

/**
 * 执行临时模块并返回默认导出
 */
const 执行临时模块 = async (text: string, allowedPackages: string[]): Promise<unknown> => {
    const tempModule = await createSecureTemporaryModule(text, 创建模块配置(allowedPackages));
    try {
        return tempModule.moduleExport.default;
    } finally {
        tempModule.cleanup();
    }
};

/**
 * 处理作用域包，如 @babel/core -> @babel/core
 * 如果格式正确则添加到 Set 中
 */
const 尝试添加作用域包 = (cleanSource: string, packageNames: Set<string>): void => {
    const parts = cleanSource.split("/");
    if (parts.length < 2) {
        return;
    }
    packageNames.add(`${parts[0]}/${parts[1]}`);
};

/**
 * 从代码中提取外部包名
 */
const extractExternalPackages = async (code: string): Promise<string[]> => {
    try {
        await parse; // 确保 es-module-lexer 已初始化
        const [imports = []] = parse(code);
        const packageNames = new Set<string>();

        for (const importSpec of imports) {
            const importSource = code.substring(importSpec.s, importSpec.e);

            // 检查是否为外部包（不以 . 或 / 或 http 开头）
            const 是内部或URL模块 = importSource.startsWith(".") ||
                importSource.startsWith("/") ||
                importSource.startsWith("http:") ||
                importSource.startsWith("https:");
            if (是内部或URL模块) {
                continue;
            }

            // 提取包名
            const queryRemoved = importSource.split("?")[0] ?? "";
            const cleanSource = queryRemoved.split("#")[0] ?? "";

            // 处理作用域包，如 @babel/core
            if (cleanSource.startsWith("@")) {
                尝试添加作用域包(cleanSource, packageNames);
                continue;
            }
            // 处理普通包名
            packageNames.add(cleanSource);
        }

        return Array.from(packageNames);
    } catch (error) {
        console.warn("提取包名时出错:", error);
        return [];
    }
};

/**
 * 构建确认消息
 */
const 构建确认消息 = (cachedPackages: string[], uncachedPackages: string[]): string => {
    let confirmMessage = "检测到代码中包含 import 或 require 语句";

    if (cachedPackages.length > 0) {
        confirmMessage += `\n\n已允许的包（无需再次确认）：\n${cachedPackages.map(pkg => `• ${pkg}`).join("\n")}`;
    }

    if (uncachedPackages.length === 0) {
        confirmMessage += "，但未检测到明确的外部包名";
    }
    if (uncachedPackages.length > 0) {
        confirmMessage += `\n\n新检测到的包（需要确认）：\n${uncachedPackages.map(pkg => `• ${pkg}`).join("\n")}`;
    }

    confirmMessage += "\n\n是否继续执行？";
    return confirmMessage;
};


/**
 * 通过确认对话框执行代码
 */
const 通过确认执行 = (参数: 确认执行参数): Promise<unknown> => {
    const { text, externalPackages, uncachedPackages, confirmMessage } = 参数;

    return new Promise((resolve, reject) => {
        // @内联回调
        confirmDialog(
            "安全提示",
            confirmMessage,
            async () => {
                try {
                    console.log(text);
                    packagePermissionManager.batchCachePermissions(uncachedPackages, true);
                    const result = await 执行临时模块(text, externalPackages);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            },
            () => {
                packagePermissionManager.batchCachePermissions(uncachedPackages, false);
                reject(new Error("用户取消了包含外部依赖的代码执行"));
            }
        );
    });
};

/**
 * 宽松的JSON解析函数，支持JavaScript表达式
 * 当代码中包含import或require语句时，使用执行器方案安全执行
 */
export const looseJsonParse = async (text: string): Promise<unknown> => {
    // 检查是否包含import或require语句
    try {
        //兼容原本的情况
        const result = new Function(`"use strict";return (${text})`)();
        return result;
    } catch {
        //允许使用外部库
        const externalPackages = await extractExternalPackages(text);
        const { cached: cachedPackages, uncached: uncachedPackages } = packagePermissionManager.separateCachedPackages(externalPackages);

        // 如果所有包都已缓存且被允许，直接执行
        if (uncachedPackages.length === 0) {
            return 执行临时模块(text, externalPackages);
        }

        // 弹出确认对话框，提示用户代码包含外部依赖
        const confirmMessage = 构建确认消息(cachedPackages, uncachedPackages);
        return 通过确认执行({ text, externalPackages, uncachedPackages, confirmMessage });
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
