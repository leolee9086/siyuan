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
