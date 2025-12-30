/**
 * showContent 模块类型定义
 */

/** 操作上下文类型 */
export interface 操作上下文 {
    protyle: IProtyle;
    nodeElement: Element;
    subElement: HTMLElement;
    buttonHTML: string;
    hasCopy: boolean;
    rangePosition: { left: number; top: number };
    range: Range;
}
