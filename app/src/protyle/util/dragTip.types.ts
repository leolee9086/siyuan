/**
 * 拖拽提示框内部状态：含 DOM 元素引用、当前文案以及 RAF 调度标识
 *
 * 意图：通过一个可变的全局 state 对象统一管理拖拽提示框的所有可变数据，
 *       配合 requestAnimationFrame 将高频 dragover 事件合并到下一帧渲染，
 *       避免逐次写 DOM 造成卡顿
 * 调用时机：由 dragTip.ts 内部的渲染循环 read/write
 */
export type DragTipState = {
    /** requestAnimationFrame 的返回值，用于去重和取消 */
    rafId: number;
    /** 拖拽对象的名称（上半行） */
    title: string;
    /** 操作文案（下半行） */
    action: string;
    /** 当前光标在视口中的坐标 */
    position: { x: number; y: number };
    /** 拖拽提示框的根 DOM 元素 */
    element: HTMLElement | null;
    /** 名称显示区域 */
    titleElement: HTMLElement | null;
    /** 操作文案显示区域 */
    actionElement: HTMLElement | null;
    /** 上一次渲染的 title，用于按需更新 */
    lastTitle: string;
    /** 上一次渲染的 action，用于按需更新 */
    lastAction: string;
    /** 提示框当前渲染宽度（px），定位计算使用真实测量值而非估算值 */
    width: number;
    /** 提示框当前渲染高度（px），用于计算提示框相对光标或幽灵元素的上方偏移 */
    height: number;
    /** Alt 拖拽幽灵元素的几何信息；null 表示当前拖拽未启用幽灵跟随 */
    ghost: DragTipGhost | null;
};

/**
 * Alt 拖拽幽灵元素的几何信息
 * offsetX / offsetY 为光标相对幽灵元素左上角的偏移，
 * 用于让提示框跟随幽灵元素而非光标本体
 */
export type DragTipGhost = {
    /** 幽灵元素宽度（px） */
    width: number;
    /** 幽灵元素高度（px） */
    height: number;
    /** 光标相对幽灵元素左缘的水平偏移（px） */
    offsetX: number;
    /** 光标相对幽灵元素顶缘的垂直偏移（px） */
    offsetY: number;
};
