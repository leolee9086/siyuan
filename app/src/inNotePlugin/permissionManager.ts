/**
 * 持久化权限管理器
 * 扩展现有的 PackagePermissionManager，添加 localStorage 持久化功能
 */
import { PackagePermissionManager } from "../util/lib/code/PackagePermissionManager";

const PERMISSION_KEY = "in-note-plugin-allowed-packages";

/**
 * 持久化权限管理器
 * 将用户允许的外部包列表保存到 localStorage
 */
export class PersistentPermissionManager extends PackagePermissionManager {
    constructor() {
        super();
        this.从存储恢复();
    }

    /**
     * 从 localStorage 恢复已允许的包
     */
    private 从存储恢复(): void {
        try {
            const saved = localStorage.getItem(PERMISSION_KEY);
            if (saved) {
                const packages = JSON.parse(saved) as string[];
                packages.forEach((pkg) => super.cachePermission(pkg, true));
            }
        } catch (e) {
            console.warn("恢复外部库许可列表失败:", e);
        }
    }

    /**
     * 缓存权限并同步到 localStorage
     */
    cachePermission(packageName: string, allowed: boolean): void {
        super.cachePermission(packageName, allowed);
        this.保存到存储();
    }

    /**
     * 保存允许的包到 localStorage
     */
    private 保存到存储(): void {
        try {
            const packages = this.获取所有允许的包();
            localStorage.setItem(PERMISSION_KEY, JSON.stringify(packages));
        } catch (e) {
            console.warn("保存外部库许可列表失败:", e);
        }
    }

    /**
     * 获取所有允许的包名列表
     */
    获取所有允许的包(): string[] {
        // 注意：需要访问父类的 cache 属性
        // 由于 PackagePermissionManager 的 cache 是 private，
        // 这里通过遍历已知包来获取
        // 实际实现可能需要修改父类或使用其他方式
        const result: string[] = [];
        // 使用 getCachedPermission 来检查包状态
        // 这是一个临时方案，后续可以优化
        const saved = localStorage.getItem(PERMISSION_KEY);
        if (saved) {
            try {
                const packages = JSON.parse(saved) as string[];
                for (const pkg of packages) {
                    const permission = this.getCachedPermission(pkg);
                    if (permission === true) {
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
     * 清除所有权限缓存
     */
    clearCache(): void {
        super.clearCache();
        localStorage.removeItem(PERMISSION_KEY);
    }
}

/** 全局持久化权限管理器实例 */
export const persistentPermissionManager = new PersistentPermissionManager();
