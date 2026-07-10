/**
 * index.mousedown.resize 子模块的接口类型定义
 */

/**
 * 表格列宽拖拽上下文数据
 */
export interface TableColResizeContext {
    colElement: HTMLElement;
    html: string;
    oldWidth: number;
    x: number;
    hasScroll: boolean;
}

/**
 * 列宽拖拽 mouseup 清理选项
 */
export interface TableColMouseupOptions {
    protyle: IProtyle;
    nodeElement: HTMLElement;
    html: string;
    documentSelf: Document;
}
