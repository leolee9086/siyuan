import { Dialog } from "../../dialog";
import { isMobile } from "../../util/functions";
import { createVueComponentInDialog, VueComponentMountConfig } from "../vue/mount";

/**
 * Vue对话框配置接口
 */
export interface VueDialogConfig {
    /** 对话框标题 */
    title: string;
    /** 对话框宽度，默认移动端为"92vw"，桌面端为"520px" */
    width?: string;
    /** 对话框data-key属性值 */
    dataKey: string;
    /** Vue组件挂载配置工厂函数，接收dialog实例作为参数 */
    vueConfigFactory: (dialog: Dialog) => VueComponentMountConfig;
}

/**
 * 创建并显示Vue对话框的通用工具函数
 *
 * @param config Vue对话框配置
 * @returns 创建的对话框实例
 */
export const createVueDialog = (config: VueDialogConfig): Dialog => {
    const dialog = new Dialog({
        title: config.title,
        content: "",
        width: config.width || (isMobile() ? "92vw" : "520px"),
    });
    
    dialog.element.setAttribute("data-key", config.dataKey);
    const vueConfig = config.vueConfigFactory(dialog);
    createVueComponentInDialog(dialog, vueConfig);
    
    return dialog;
};