/**
 * 创建临时ESM模块
 * 作用：通过 Blob URL 动态加载代码字符串为可执行模块。
 * 意图：将动态模块创建逻辑封装为独立函数，避免调用方直接操作 Blob/URL 生命周期。
 * 调用时机：需要执行用户编写的脚本或插件代码时调用。
 */
export async function createTemporaryModule(code: string) {
    // 动态导入模块
    // 创建Blob URL
    const blob = new Blob([code], { type: "application/javascript" });
    const moduleUrl = URL.createObjectURL(blob);
    try {
        const moduleExport = await import(/* webpackIgnore: true */ moduleUrl);
        // 返回模块信息和清理函数
        return {
            moduleUrl,
            moduleExport: moduleExport,
            /** 清理函数：释放 Blob URL，避免内存泄漏 */
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
