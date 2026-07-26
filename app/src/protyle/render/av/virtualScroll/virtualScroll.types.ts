/** 单个 AV body 的完整虚拟滚动窗口状态。 */
export interface AVVirtualBodyState {
    renderedStart: number;
    renderedEnd: number;
    dataOffset: number;
    view: IAVView;
    topSpacerHeight: number;
    pinIndex?: number;
    rowHeight?: number;
    selectedRowIds?: Set<string>;
}

/** 单个 AV 视图登记的数据源。 */
export interface AVVirtualDataSource {
    protyle: IProtyle;
    data: IAV;
}

/** AV 虚拟滚动跨调用状态的完整注册表。 */
export interface AVVirtualScrollRegistryState {
    dataSources: Map<string, AVVirtualDataSource>;
    bodyStates: WeakMap<HTMLElement, AVVirtualBodyState>;
    trimPending: WeakSet<HTMLElement>;
    lastScrollTop: number | undefined;
}
