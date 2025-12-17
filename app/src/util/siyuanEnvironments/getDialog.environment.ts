import { Dialog } from "../../dialog";

/**
 * 获取 window.siyuan.dialogs
 * @returns dialogs 列表
 */
export const getSiyuanDialogs = (): Dialog[] => {
    return window.siyuan?.dialogs || [];
};
