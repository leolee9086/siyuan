/**
 * 临时ESM模块信息
 */
 interface TemporaryModule {
    /** 模块URL */
    moduleUrl: string;
    /** 模块导出 */
    moduleExport: any;
    /** 清理函数 */
    cleanup: () => void;
}
/**
 * 创建临时ESM模块
 */
export async function createTemporaryModule(code: string): Promise<TemporaryModule> {
    // 动态导入模块
    // 创建Blob URL
    const blob = new Blob([code], { type: 'application/javascript' });
    const moduleUrl = URL.createObjectURL(blob);
    try {
        const moduleExport = await import(/* webpackIgnore: true */ moduleUrl);
        // 返回模块信息和清理函数
        return {
            moduleUrl,
            moduleExport: moduleExport,
            cleanup: () => {
                URL.revokeObjectURL(moduleUrl);
            }
        };
    } catch (error) {
        // 如果导入失败，清理URL并重新抛出错误
        URL.revokeObjectURL(moduleUrl);
        throw new Error(`创建临时模块失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}
