/**
 * 拖拽状态类型定义
 * @property item 被拖拽的元素
 * @property outline Outline 实例
 * @property editor 关联的编辑器实例
 * @property ghostElement 拖拽时的幽灵元素
 * @property selectItem 当前悬停的目标元素
 * @property contentRect 容器矩形信息
 * @property startX 拖拽起始 X 坐标
 * @property startY 拖拽起始 Y 坐标
 */
export type DragState = {
    item: HTMLElement;
    outline: {element: HTMLElement};
    editor?: IProtyle;
    ghostElement?: HTMLElement;
    selectItem?: HTMLElement;
    contentRect: DOMRect;
    startX: number;
    startY: number;
};

/** Outline 树组件对展开状态提供的完整操作集合。 */
export interface IOutlineTreeState {
    getExpandIds: () => string[];
    setExpandIds: (ids: string[]) => void;
    expandAll: () => void;
    collapseAll: () => void;
}

/**
 * Outline 树交互领域根。
 *
 * 筛选、高亮、层级展开和右键树动作共享这一状态所有者；应用、页签、编辑器和网络身份不属于该领域。
 */
export interface IOutlineTreePanel {
    element: HTMLElement;
    headerElement: HTMLElement;
    tree: IOutlineTreeState;
    preFilterExpandIds: string[] | null;
    saveExpendIds: () => void;
    collapseChildren: (element: HTMLElement, expand?: boolean) => void;
    collapseSameLevel: (element: HTMLElement, expand?: boolean) => void;
}
