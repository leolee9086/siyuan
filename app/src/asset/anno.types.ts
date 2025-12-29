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
 * PDF 页面视图接口（PDF.js 的 PageView 对象）
 */
export interface IPdfPageView {
    /** 页面容器 div 元素 */
    div: HTMLDivElement;
    /** 页面 canvas 元素 */
    canvas: HTMLCanvasElement;
    /** 页面缩放比例 */
    scale: number;
    /** 视口信息 */
    viewport: IPdfViewport;
    /** 文本层 */
    textLayer: {
        /** 文本层容器元素 */
        div: HTMLElement;
    };
}

/**
 * PDF 视口接口（PDF.js 的 PageViewport 对象）
 */
export interface IPdfViewport {
    /** 视口宽度 */
    width: number;
    /** 视口高度 */
    height: number;
    /** 缩放比例 */
    scale: number;
    /**
     * 克隆视口并应用新选项
     * @param options - 克隆选项
     * @returns 新的视口对象
     */
    clone: (options?: { rotation?: number; scale?: number }) => IPdfViewport;
    /**
     * 将PDF坐标转换为视口坐标
     * @param rect - PDF坐标数组 [x1, y1, x2, y2]
     * @returns 视口坐标元组 [x1, y1, x2, y2]
     */
    convertToViewportRectangle: (rect: number[]) => [number, number, number, number];
}

/**
 * PDF 页面接口（PDF.js 的 PDFPageProxy 对象）
 */
export interface IPdfPage {
    /** 页面编号（从1开始） */
    pageNumber: number;
    /** 获取视口 */
    getViewport: (options: { scale: number; rotation?: number }) => {
        width: number;
        height: number;
        scale: number;
    };
    /** 渲染页面 */
    render: (params: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
        promise: Promise<void>;
    };
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
        getPageView: (index: number) => IPdfPageView | undefined;
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
        getPage: (pageNumber: number) => Promise<IPdfPage>;
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

/**
 * 工具栏操作上下文
 *
 * 包含工具栏操作处理所需的共享数据，避免重复获取
 */
export interface ToolbarActionContext {
    /** PDF文件路径，不包含origin */
    urlPath: string;
    /** 注释配置对象 */
    config: Record<string, IPdfAnno>;
    /** 当前注释ID */
    id: string | undefined;
    /** PDF实例对象 */
    pdf: IPdfInstance;
    /** 容器元素 */
    element: HTMLElement;
}

/**
 * 工具栏操作处理器接口
 *
 * 定义了工具栏操作处理器的标准签名，所有处理器都应遵循此接口
 *
 * @param ctx - 工具栏操作上下文，包含共享数据和PDF实例
 */
export type ToolbarActionHandler = (ctx: ToolbarActionContext) => void;

/**
 * 工具栏操作处理器注册表
 *
 * 使用对象映射将操作类型字符串与对应的处理函数关联
 * 实现了策略模式，便于扩展新的操作类型
 *
 * @example
 * ```typescript
 * const registry: ToolbarActionRegistry = {
 *   'remove': handleRemoveAction,
 *   'copy': handleCopyAction,
 *   // 可以轻松添加新操作
 *   'newAction': handleNewAction,
 * };
 * ```
 */
export type ToolbarActionRegistry = Record<string, ToolbarActionHandler>;

/**
 * 复制注释的核心逻辑参数
 */
export interface 复制注释参数 {
    /** 注释 ID 路径 */
    idPath: string;
    /** 文件名 */
    fileName: string;
    /** PDF 实例 */
    pdf: IPdfInstance;
    /** 注释模式 */
    mode: string | null;
    /** 注释内容 */
    content: string | null;
}

/**
 * 注释结果参数
 *
 * 用于创建注释结果时传递的参数
 */
export interface AnnotationResultParams {
    /** PDF实例 */
    pdf: IPdfInstance;
    /** 开始页面索引 */
    startIndex: number;
    /** 结束页面索引 */
    endIndex: number;
    /** 开始页选中的坐标 */
    startSelected: number[];
    /** 结束页选中的坐标 */
    endSelected: number[];
    /** 注释内容 */
    content: string;
    /** 注释颜色 */
    color: string;
}