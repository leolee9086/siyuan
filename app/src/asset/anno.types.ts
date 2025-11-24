/**
 * PDF 注释相关的类型定义
 */

/**
 * PDF 注释数据结构
 */
export interface IPdfAnno {
    /** 注释ID */
    id: string;
    /** 注释颜色 */
    color: string;
    /** 注释内容 */
    content: string;
    /** 注释类型：text 或 border */
    type: "text" | "border";
    /** 注释模式：text 或 rect */
    mode: "text" | "rect";
    /** 关联的注释ID列表 */
    ids?: string[];
    /** 页面索引和位置信息 */
    pages: Array<{
        /** 页面索引 */
        index: number;
        /** 位置坐标 */
        positions: number[][];
    }>;
}

/**
 * PDF 配置接口
 */
export interface IPdfConfig {
    /** 文件路径 */
    file: string;
    /** 注释配置 */
    config?: Record<string, IPdfAnno>;
    /** 工具栏元素 */
    toolbar: {
        /** 矩形注释工具 */
        rectAnno: HTMLElement;
    };
    /** 主容器元素 */
    mainContainer: HTMLElement;
}

/**
 * PDF 实例接口
 */
export interface IPdfInstance {
    /** PDF 应用配置 */
    appConfig: IPdfConfig;
    /** PDF 查看器 */
    pdfViewer: {
        /** 获取页面视图 */
        getPageView: (index: number) => any;
        /** 当前缩放比例 */
        currentScale: number;
        /** 获取可见页面 */
        _getVisiblePages: () => {
            first: { view: { canvas: HTMLElement } };
            last: { view: { canvas: HTMLElement } };
        };
    };
    /** PDF 文档 */
    pdfDocument: {
        getPage: (pageNumber: number) => Promise<any>;
    };
    /** PDF 光标工具 */
    pdfCursorTools: {
        switchTool: (tool: number) => void;
    };
    /** 当前注释ID */
    annoId?: string;
}

/**
 * 注释坐标信息
 */
export interface IAnnoCoords {
    /** 页面索引 */
    index: number;
    /** 坐标点 */
    coords: number[][] | number[];
    /** 注释ID */
    id: string;
    /** 注释颜色 */
    color: string;
    /** 注释内容 */
    content: string;
    /** 注释类型 */
    type: "text" | "border" | string;
    /** 注释模式 */
    mode: "text" | "rect" | string;
    /** 关联的注释ID列表 */
    ids?: string[];
}

/**
 * 矩形边界信息
 */
export interface IRectBounds {
    /** 左边界 */
    left: number;
    /** 上边界 */
    top: number;
    /** 右边界 */
    right: number;
    /** 下边界 */
    bottom: number;
}

/**
 * 页面位置信息
 */
export interface IPagePosition {
    /** 页面索引 */
    index: number;
    /** 位置坐标 */
    positions: number[][];
}

/**
 * 全局变量 rectElement 的类型
 */
export type RectElementType = HTMLElement | null;