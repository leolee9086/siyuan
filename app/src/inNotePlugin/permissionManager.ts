/**
 * 持久化权限管理器
 * 将用户允许的外部包列表保存到 localStorage
 */
/** 用途：包名许可管理器基类。使用范围：创建持久化权限管理器时作为存储层。解耦评估：通过 ./imports 转发。 */
import { PackagePermissionManager } from "./imports";

const PERMISSION_KEY = "in-note-plugin-allowed-packages";

/**
 * 从 localStorage 恢复已允许的包列表
 */
function 从存储恢复(base: PackagePermissionManager) {
    try {
        const saved = localStorage.getItem(PERMISSION_KEY);
        if (saved) {
            const packages: string[] = JSON.parse(saved);
            for (const pkg of packages) {
                base.cachePermission(pkg, true);
            }
        }
    } catch (e) {
        console.warn("恢复外部库许可列表失败:", e);
    }
}

/**
 * 获取所有允许的包名列表
 */
function 获取所有允许的包(base: PackagePermissionManager) {
    const result: string[] = [];
    const saved = localStorage.getItem(PERMISSION_KEY);
    // 仅在 localStorage 中存在已保存列表时进行恢复
    if (saved) {
        try {
            const packages: string[] = JSON.parse(saved);
            for (const pkg of packages) {
                // 只保留明确允许的包（permission === true），未缓存的包不加入结果集
                if (base.getCachedPermission(pkg) === true) {
                    result.push(pkg);
                }
            }
        } catch (e) {
            // 忽略解析错误
        }
    }
    return result;
}

/**
 * 保存允许的包到 localStorage
 */
function 保存到存储(base: PackagePermissionManager) {
    try {
        const packages = 获取所有允许的包(base);
        localStorage.setItem(PERMISSION_KEY, JSON.stringify(packages));
    } catch (e) {
        console.warn("保存外部库许可列表失败:", e);
    }
}

/**
 * 创建持久化权限管理器
 *
 * 作用：扩展现有的 PackagePermissionManager，添加 localStorage 持久化功能
 * 意图：将用户允许的外部包列表持久化，避免重复请求用户确认
 * 调用时机：模块加载时立即创建单例实例
 * @同步豁免: 生命周期 - 模块级单例初始化工厂，module 作用域同步调用
 */
export function createPersistentPermissionManager() {
    const base = new PackagePermissionManager();
    从存储恢复(base);

    return {
        /** 缓存权限并同步到 localStorage */
        cachePermission(packageName: string, allowed: boolean) {
            base.cachePermission(packageName, allowed);
            保存到存储(base);
        },
        /** 获取包名的缓存许可结果 */
        getCachedPermission(packageName: string) {
            return base.getCachedPermission(packageName);
        },
        /** 清除所有权限缓存 */
        clearCache() {
            base.clearCache();
            localStorage.removeItem(PERMISSION_KEY);
        },
        /** 分离已缓存和未缓存的包 */
        separateCachedPackages(packages: string[]) {
            return base.separateCachedPackages(packages);
        },
        /** 批量缓存包许可 */
        batchCachePermissions(packages: string[], allowed: boolean) {
            base.batchCachePermissions(packages, allowed);
        },
        /** 获取所有允许的包名列表 */
        获取所有允许的包() {
            return 获取所有允许的包(base);
        },
    };
}

/** 全局持久化权限管理器实例 */
export const persistentPermissionManager = createPersistentPermissionManager();
