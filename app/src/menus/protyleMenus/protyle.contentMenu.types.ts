/**
 * 内容菜单上下文，用于在子函数间传递共享状态
 */
export interface IContentMenuContext {
    protyle: IProtyle;
    nodeElement: Element;
    range: Range;
    oldHTML: string;
    id: string;
}

/**
 * 行内元素菜单所需的上下文
 */
export interface IInlineMenuContext {
    protyle: IProtyle;
    nodeElement: Element;
    range: Range;
    oldHTML: string;
    inlineElement: HTMLSpanElement;
}
