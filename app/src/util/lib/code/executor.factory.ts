/**
 * 模块创建器工厂函数
 * 提供便捷的模块创建方法
 */
import { SecureModuleCreator, SecurityError } from "./executor";
import type { TemporaryModule } from "./executor.types";

// 重新导出 SecurityError 以保持向后兼容
export { SecurityError };

/**
 * 创建临时ESM模块（保持向后兼容）
 */
export async function createTemporaryModule(code: string): Promise<TemporaryModule> {
    // 创建默认的安全模块创建器
    const creator = new SecureModuleCreator({
        allowedPackages: [],
        packagePatterns: [],
        autoAllowScoped: false,
        defaultOptions: {
            onUnauthorizedImport: "throw",
            customMocks: {}
        },
        moduleRedirectConfig: {
            defaultServer: "https://esm.sh",
            packageRedirects: {},
            enabled: false,
            bareModulesOnly: true
        }
    });
    return creator.createSecureModule(code);
}

/**
 * 创建带有自定义安全配置的临时模块
 * @param code 要执行的代码
 * @param options 安全配置选项
 * @returns 安全的模块 URL
 */
export async function createSecureTemporaryModule(
    code: string,
    options: {
        allowedPackages?: string[];
        packagePatterns?: RegExp[];
        autoAllowScoped?: boolean;
        onUnauthorizedImport?: "throw" | "mock" | "remove";
        customMocks?: Record<string, unknown>;
        moduleRedirectConfig?: {
            defaultServer?: string;
            packageRedirects?: Record<string, string>;
            enabled?: boolean;
            bareModulesOnly?: boolean;
        };
    } = {}
): Promise<TemporaryModule> {
    const creator = new SecureModuleCreator({
        allowedPackages: options.allowedPackages ?? [],
        packagePatterns: options.packagePatterns ?? [],
        autoAllowScoped: options.autoAllowScoped ?? false,
        defaultOptions: {
            onUnauthorizedImport: options.onUnauthorizedImport ?? "throw",
            customMocks: options.customMocks ?? {}
        },
        moduleRedirectConfig: {
            defaultServer: options.moduleRedirectConfig?.defaultServer ?? "https://esm.sh",
            packageRedirects: options.moduleRedirectConfig?.packageRedirects ?? {},
            enabled: options.moduleRedirectConfig?.enabled ?? false,
            bareModulesOnly: options.moduleRedirectConfig?.bareModulesOnly ?? true
        }
    });

    return await creator.createSecureModule(code);
}

/**
 * 创建带有动态白名单的临时模块
 * @param code 要执行的代码
 * @param options 动态安全配置选项
 * @returns 安全的模块 URL
 */
export async function createDynamicSecureTemporaryModule(
    code: string,
    options: {
        allowedPackages?: string[];
        packagePatterns?: RegExp[];
        autoAllowScoped?: boolean;
        onUnauthorizedImport?: "throw" | "mock" | "remove";
        customMocks?: Record<string, unknown>;
    } = {}
): Promise<TemporaryModule> {
    const creator = new SecureModuleCreator({
        allowedPackages: options.allowedPackages ?? [],
        packagePatterns: options.packagePatterns ?? [],
        autoAllowScoped: options.autoAllowScoped ?? false,
        defaultOptions: {
            onUnauthorizedImport: options.onUnauthorizedImport ?? "throw",
            customMocks: options.customMocks ?? {}
        },
        moduleRedirectConfig: {
            defaultServer: "https://esm.sh",
            packageRedirects: {},
            enabled: false,
            bareModulesOnly: true
        }
    });

    return await creator.createSecureModule(code);
}
