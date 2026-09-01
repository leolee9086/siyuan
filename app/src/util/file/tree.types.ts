/** 用途：以官方块数据类型为 Tree 内核载荷的兼容基底；使用范围：仅限 Tree 渲染数据契约。 */
import type {IBlock} from "siyuan";
/** 用途：以官方树节点类型为递归数据兼容基底；使用范围：Tree 输入与更新契约。 */
import type {IBlockTree} from "siyuan";

/**
 * Kernel `model.Block` 经过 JSON 序列化后交给 Tree 的渲染投影。
 * 仅收紧渲染器实际读取的字段；其余生态字段继承官方 `IBlock`，不另行声明平行版本。
 */
export type TreeBlockData = Omit<IBlock, "ial"> & {
    id: string;
    type: string;
    subType: string;
    content: string;
    refText: string;
    defID: string;
    defPath: string;
    depth: number;
    count: number;
    folded: boolean;
    /** Kernel 对没有 IAL 的普通块序列化为 null；文档块渲染图标时仍要求存在映射。 */
    ial: Record<string, string> | null;
};

/**
 * Tree 接收的完整递归节点数据，以官方 IBlockTree 为基底，并精确表达 Kernel 的 folded 与块载荷。
 * 普通官方 IBlockTree 可直接赋值；扩展部分只修正内核 JSON 比官方声明更宽的真实字段。
 */
export type TreeNodeData = Omit<IBlockTree, "blocks" | "children"> & {
    folded?: boolean;
    showArrow?: boolean;
    icon?: string;
    number?: string;
    blocks?: (IBlock | TreeBlockData)[];
    children?: TreeNodeData[];
};

/** Tree 构造所需的完整配置，由组合边界创建具体树实例。 */
export interface TreeOptions {
    element: HTMLElement;
    data: TreeNodeData[] | null;
    blockExtHTML?: string | undefined;
    topExtHTML?: string | undefined;
    titleTooltipPosition?: string | undefined;
    blockDraggable?: boolean | undefined;
    click?(element: HTMLElement, event?: MouseEvent): void;
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
    click(element: Element, event?: MouseEvent): void;
    updateData(data: TreeNodeData[] | null): void;
    toggleBlocks(liElement: Element): void;
    expandAll(): void;
    collapseAll(): void;
    getExpandIds(): string[];
    setExpandIds(ids: string[]): void;
    createTopLevelItem(data: TreeNodeData): HTMLLIElement;
}
