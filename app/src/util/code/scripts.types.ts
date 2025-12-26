/**
 * 临时ESM模块信息
 */
export interface TemporaryModule {
    /** 模块URL */
    moduleUrl: string;
    /** 模块导出 */
    moduleExport: Record<string, unknown>;
    /** 清理函数 */
    cleanup: () => void;
}
