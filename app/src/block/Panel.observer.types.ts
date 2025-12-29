
import { Protyle } from "../protyle";

/**
 * 设置观察器的参数
 */
export interface 设置观察器参数 {
    element: HTMLElement;
    editors: Protyle[];
    initProtyle: (editorElement: HTMLElement, afterCB?: () => void) => void;
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
    editors: Protyle[];
}
