/** 退出编辑器聚焦模式所需的完整公开参数；Protyle 实例自身提供编辑器状态。 */
export interface ProtyleZoomOutOptions {
    id: string;
    focusId?: string;
    isPushBack?: boolean;
    callback?: () => void;
    reload?: boolean;
    dataDocType?: string;
}

/** Protyle class 的完整公共领域表面；宿主模块依赖此类型而不加载编辑器实现。 */
export interface ProtyleDomain {
    readonly version: string;
    protyle: IProtyle;
    focus(): void;
    isUploading(): boolean;
    applyUploadedFiles(responseText: string): Promise<void>;
    uploadLocalFiles(files: string[] | ILocalFiles[], isUpload: boolean): void;
    clearStack(): void;
    destroy(): void;
    resize(): void;
    isFullscreen(): boolean;
    setFullscreen(enter: boolean): void;
    reload(focus: boolean, updateReadonly?: boolean): void;
    insert(html: string, isBlock?: boolean, useProtyleRange?: boolean): void;
    transaction(doOperations: IOperation[], undoOperations?: IOperation[]): void;
    turnIntoOneTransaction(selectsElement: Element[], type: TTurnIntoOne, subType?: TTurnIntoOneSub): void;
    turnElementsIntoTransaction(selectsElement: Element[], type: TTurnInto, subType?: number): void;
    turnIntoTransaction(nodeElement: Element, type: TTurnInto, subType?: number): void;
    updateTransaction(id: string, newHTML: string, html: string): void;
    updateTransactionElement(element: Element, oldHTML: string): void;
    updateBatchTransaction(nodeElements: Element[], cb: (element: HTMLElement) => void): void;
    getRange(element: Element): Range;
    hasClosestBlock(element: Node): false | HTMLElement;
    focusBlock(element: Element, toStart?: boolean): false | Range;
    disable(): void;
    enable(): void;
    renderAVAttribute(element: HTMLElement, id: string, cb?: (element: HTMLElement) => void): void;
    getSelectedBlockElements(): NodeListOf<Element>;
    getSelectedBlockIds(): void;
    switchMode(mode: TEditorMode): void;
    zoomOut(options: ProtyleZoomOutOptions): void;
}
