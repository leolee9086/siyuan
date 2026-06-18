/** 导出预览页签支持的预览类型 */
export type TExportPreviewType = "default" | "image" | "mp-wechat" | "zhihu" | "yuque";

/**
 * 导出预览页签类型定义
 */

/** 导出预览页签的 data 结构 */
export interface IExportPreviewData {
    /** 文档块 ID */
    blockId: string;
    /** 初始预览类型，缺省为普通导出预览 */
    previewType?: TExportPreviewType;
}


