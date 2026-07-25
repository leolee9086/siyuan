/** Tree 构造所需的完整配置，由组合边界创建具体树实例。 */
export interface TreeOptions {
    element: HTMLElement;
    data: IBlockTree[];
    blockExtHTML?: string;
    topExtHTML?: string;
    blockDraggable?: boolean;
    click?(element: HTMLElement, event: MouseEvent): void;
    ctrlClick?(element: HTMLElement, event: MouseEvent): void;
    altClick?(element: HTMLElement, event: MouseEvent): void;
    shiftClick?(element: HTMLElement): void;
    toggleClick?(element: HTMLElement): void;
    rightClick?(element: HTMLElement, event: MouseEvent): void;
    dragStart?(element: HTMLElement, event: DragEvent): boolean;
    dragEnd?(element: HTMLElement, event: DragEvent): boolean;
}

/** Tree class 的完整公共领域表面。 */
export interface TreeDomain {
    element: HTMLElement;
    click: (element: Element, event?: MouseEvent) => void;
    updateData(data: IBlockTree[]): void;
    toggleBlocks(liElement: Element): void;
    expandAll(): void;
    collapseAll(): void;
    getExpandIds(): string[];
    setExpandIds(ids: string[]): void;
}
