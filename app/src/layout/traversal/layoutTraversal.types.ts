/** 布局遍历所需的页签结构；模型身份由调用方参数化保留。 */
export interface ILayoutTraversalTab<TModel extends object = object> {
    readonly headElement: HTMLElement;
    readonly model?: TModel;
}

/** 布局遍历所需的窗口结构；页签身份由调用方参数化保留。 */
export interface ILayoutTraversalWindow<TTab extends ILayoutTraversalTab = ILayoutTraversalTab> {
    readonly element: HTMLElement;
    readonly headersElement: HTMLElement;
    readonly children: readonly TTab[];
}

/** 布局树分支结构；递归关系覆盖 Layout 中嵌套的分支与窗口。 */
export interface ILayoutTraversalBranch<
    TTab extends ILayoutTraversalTab = ILayoutTraversalTab,
    TWindow extends ILayoutTraversalWindow<TTab> = ILayoutTraversalWindow<TTab>,
> {
    readonly children?: readonly (ILayoutTraversalBranch<TTab, TWindow> | TWindow)[];
}
