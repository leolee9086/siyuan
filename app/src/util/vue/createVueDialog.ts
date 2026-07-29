import { Dialog, IDialogOptions } from "../../dialog";
import { isMobile } from "../platform/functions";
import { createVueComponentInDialog } from "./mount";
import type { VueComponentMountConfig } from "./mount.types";

/**
 * Vue对话框配置接口
 */
export interface VueDialogConfig {
    /** 对话框data-key属性值 */
    dataKey: string;
    /** Vue组件挂载配置工厂函数，接收dialog实例作为参数 */
    vueConfigFactory: (dialog: Dialog) => VueComponentMountConfig;
    /** 对话框配置选项 */
    dialogOptions: Omit<IDialogOptions, "content">;
}

/**
 * 创建并显示Vue对话框的通用工具函数
 *
 * @param config Vue对话框配置
 * @returns 创建的对话框实例
 */
export const createVueDialog = (config: VueDialogConfig): Dialog => {
    const dialog = new Dialog({
        ...config.dialogOptions,
        content: "",
        width: config.dialogOptions.width || (isMobile() ? "92vw" : "520px"),
    });
    dialog.element.setAttribute("data-key", config.dataKey);
    const vueConfig = config.vueConfigFactory(dialog);
    createVueComponentInDialog(dialog, vueConfig);
    return dialog;
};
