/** 内联内容复制参数 */
export type InlineContentParams = {
    protyle: IProtyle;
    range: Range;
    selectImgElement: HTMLElement | null;
    selectTypes: string[];
};

/** 复制内容路由参数 */
export type RouteContentParams = {
    protyle: IProtyle;
    nodeElement: HTMLElement;
    range: Range;
    selectElements: Element[];
    selectImgElement: HTMLElement | null;
    selectAVElement: HTMLElement | null;
    selectTableElement: boolean | number;
    selectTableRange: boolean;
    tableRangeElement: HTMLElement;
    tableRangeStartCell: HTMLElement;
    tableRangeEndCell: HTMLElement;
};
