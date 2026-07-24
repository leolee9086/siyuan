/**
 * 执行图标操作的参数
 */
export interface headIconCtx {
    type: string | null;
    target: HTMLElement;
    element: HTMLElement;
    refDefs: IRefDefs[];
    openRefInTab: (id: string, action: TProtyleAction[], zoomIn: boolean) => void;
    onDestroy: () => void;
}

/** 用途：固定操作涉及的 DOM 元素上下文。使用范围：panel/actions.ts。解耦评估：本地类型，通过类型文件集中管理。 */
export interface 固定状态上下文 {
    pinElement: Element;
    useElement: SVGUseElement;
    element: HTMLElement;
}
