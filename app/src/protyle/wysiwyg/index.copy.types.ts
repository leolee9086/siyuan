/** 内联内容复制参数 */
export type InlineContentParams = {
    protyle: IProtyle;
    range: Range;
    selectImgElement: HTMLElement | null;
    selectTypes: string[];
};

/**
 * The copy pipeline only needs the event capabilities below. Keeping this
 * contract structural allows the cut pipeline to build clipboard data before
 * it mutates the document, without fabricating a browser ClipboardEvent.
 */
export type CopyClipboardEvent = {
    target: HTMLElement;
    clipboardData: DataTransfer;
    preventDefault: () => void;
    stopPropagation: () => void;
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
