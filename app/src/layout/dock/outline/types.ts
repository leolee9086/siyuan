/**
 * 用途：提供 Outline 所在页签的布局领域根契约。
 * 使用范围：Outline 抽象契约及其拆分后的树、筛选、消息处理模块；具体 Tab/Wnd 只在组合与校验边界出现。
 * 解耦评估：该类型描述稳定的布局关系，应由 layout 公共类型根统一定义；这样可避免在 Outline 内复制 Window/Tab 局部接口。
 */
import type {LayoutTab} from "../../layout.types";

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
export interface IOutlinePanel {
    element: HTMLElement;
    headerElement: HTMLElement;
    tree: IOutlineTreeState;
    preFilterExpandIds: string[] | null;
    blockId: string;
    type: "pin" | "local";
    isPreview: boolean;
    parent: LayoutTab;
    saveExpendIds: () => void;
    collapseChildren: (element: HTMLElement, expand?: boolean) => void;
    collapseSameLevel: (element: HTMLElement, expand?: boolean) => void;
    setCurrent: (nodeElement: HTMLElement) => void;
    setCurrentByPreview: (nodeElement: Element) => void;
    setCurrentById: (id: string) => void;
    setFilter: () => void;
    showExpandLevelMenu: (target: HTMLElement) => void;
    showContextMenu: (element: HTMLElement, event: MouseEvent) => void;
    minimize: () => void;
    update: (data: IWebSocketData, callbackId?: string) => void;
    updateDocTitle: (ial?: IObject, count?: number) => void;
}
