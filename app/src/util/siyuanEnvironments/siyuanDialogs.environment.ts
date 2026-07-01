import type { Dialog } from "../../dialog";

/**
 * 获取当前 window.siyuan.zIndex
 * @returns 当前 zIndex 值
 */
export const getSiyuanZIndex = () => {
    return window.siyuan?.zIndex || 0;
};

/**
 * 增加并获取 window.siyuan.zIndex
 * @returns 增加后的 zIndex 值
 */
export const incrementSiyuanZIndex = () => {
    return ++window.siyuan.zIndex;
};

/**
 * 将对话框推入 window.siyuan.dialogs
 * @param dialog 对话框实例
 */
export const pushSiyuanDialog = (dialog: Dialog) => {
    window.siyuan.dialogs.push(dialog);
};

/**
 * 获取 window.siyuan.dialogs
 * @returns Dialog 数组
 */
export const getSiyuanDialogs = () => {
    return window.siyuan.dialogs;
};
