import { Dialog } from "../../dialog";

/**
 * 获取 window.siyuan.dialogs
 * @returns dialogs 列表
 */
export const getSiyuanDialogs = (): Dialog[] => {
    return window.siyuan?.dialogs || [];
};

/**
 * 获取 window.siyuan.storage（对话框存储）
 * @returns storage 对象或 undefined
 */
export const getSiyuanDialogStorage = (): typeof window.siyuan.storage | undefined => {
    return window.siyuan?.storage;
};
