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
};
