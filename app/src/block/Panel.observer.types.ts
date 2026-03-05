
// 用途：Protyle 编辑器类型定义；使用范围：观察器参数中标注编辑器实例数组类型；解耦评估：核心类型定义，作为类型导入不影响运行时
import type { Protyle } from "./imports";

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
