
// 用途：BlockPanel 编辑器结构；使用范围：观察器参数；解耦评估：纯能力接口，不依赖 Protyle class。
import type { IBlockPanelEditor } from "./editor.types";

/**
 * 设置观察器的参数
 */
export interface 设置观察器参数 {
    element: HTMLElement;
    editors: IBlockPanelEditor[];
    initProtyle: (editorElement: HTMLElement, afterCB?: () => void) => void;
    resizeEditor: (protyle: IProtyle) => void;
}

/**
 * 设置观察器的返回值
 */
export interface 观察器实例 {
    observerResize: ResizeObserver;
    observerLoad: IntersectionObserver;
}

/**
 * 绑定滚动事件的参数
 */
export interface 绑定滚动事件参数 {
    element: HTMLElement;
    editors: IBlockPanelEditor[];
    hideGutter: (protyle: IProtyle) => void;
}
