/**
 * 包名许可管理器
 * 负责管理用户对特定包名的许可决定，避免重复请求用户确认
 */
export class PackagePermissionManager {
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
    separateCachedPackages(packages: string[]): { cached: string[]; uncached: string[]; } {
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
