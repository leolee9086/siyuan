import { MenuItem } from "../../menus/Menu.Item";
import { copySubMenu } from "../../menus/commonMenuItem.copy";
import { addEditorToDatabase } from "../render/av/addToDatabase";
import { deleteFile } from "../../editor/deleteFile";
import { openDocHistory } from "../../history/doc";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../layout/dock/dock.environment";

/**
 * 创建复制菜单项
 * @param protyle - 编辑器实例
 */
export const createProtyleCopyMenu = (protyle: IProtyle) => {
    return new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        type: "submenu",
        submenu: copySubMenu([protyle.block.rootID], true, undefined, protyle.block.showAll ? protyle.block.id : protyle.block.rootID)
    });
};

/**
 * 创建“添加到数据库”菜单项
 * @param protyle - 编辑器实例
 */
export const createAddToDatabaseMenuItem = (protyle: IProtyle) => {
    const range = getSelection()?.rangeCount && getSelection()?.rangeCount > 0 ? getSelection()?.getRangeAt(0) : undefined;
    return new MenuItem({
        id: "addToDatabase",
        label: siyuanI18n.addToDatabase,
        accelerator: getSiyuanConfig()?.keymap?.general?.addToDatabase?.custom || "",
        icon: "iconDatabase",
        /** @简洁函数 点击菜单项时触发，执行添加至数据库操作 */
        click: () => {
            if (!range) {
                return;
            }
            addEditorToDatabase(protyle, range, "title");
        }
    });
};

/**
 * 创建删除菜单项
 * @param protyle - 编辑器实例
 */
export const createDeleteMenuItem = (protyle: IProtyle) => {
    return new MenuItem({
        id: "delete",
        icon: "iconTrashcan",
        label: siyuanI18n.delete,
        /** @简洁函数 点击删除文档 */
        click: () => {
            if (protyle.notebookId && protyle.path) {
                deleteFile(protyle.notebookId, protyle.path);
            }
        }
    });
};

/**
 * 创建文件历史菜单项
 * @param protyle - 编辑器实例
 * @param response - 后端响应数据，包含文件名
 */
export const createFileHistoryMenuItem = (protyle: IProtyle, response: any) => {
    return new MenuItem({
        id: "fileHistory",
        label: siyuanI18n.fileHistory,
        icon: "iconHistory",
        /** @简洁函数 点击查看文件历史 */
        click() {
            if (protyle.notebookId && response.data.name) {
                openDocHistory({
                    app: protyle.app,
                    id: protyle.block.rootID,
                    notebookId: protyle.notebookId,
                    pathString: response.data.name
                });
            }
        }
    });
};

/**
 * 创建「注册为定时任务」菜单项
 * 在文档标题菜单中显示，允许用户将文档注册为 cronJob 扩展
 * 如果文档已经是任务，则显示「更新任务」而非「注册」
 * @param protyle - 编辑器实例
 * @param isRegistered - 文档是否已注册为任务（可选，由调用方提供避免重复查询）
 */
export const createCronjobMenuItem = (protyle: IProtyle, isRegistered?: boolean) => {
    // 根据是否已注册决定标签文案
    const registerLabel = isRegistered ? "更新 Go 定时任务" : "注册为 Go 定时任务";

    return new MenuItem({
        id: "cronjob",
        label: "定时任务",
        icon: "iconHistory",
        type: "submenu",
        submenu: [{
            id: "registerAsCronjob",
            label: registerLabel,
            /**
             * 注册/更新 cronjob 的点击回调
             */
            click: async () => {
                const { 注册扩展 } = await import("../../util/cronjobApi");
                if (!protyle.block.rootID) {
                    return;
                }
                const success = await 注册扩展(protyle.block.rootID, "go", "cronjob");
                if (!success) {
                    return;
                }

                const { showMessage } = await import("../../dialog/message");
                const msg = isRegistered ? "任务已更新" : "已注册为定时任务，可在侧边栏「定时任务」面板中管理";
                showMessage(msg);
                // 自动打开侧边栏面板
                const { getDockByType } = await import("../../layout/tabUtil");
                const dock = getDockByType("cronjob");
                if (dock) {
                    dock.toggleModel("cronjob", true);
                }
            },
        }, {
            id: "compileCronjob",
            label: "预览编译结果",
            /**
             * 编译 cronjob 的点击回调
             */
            click: async () => {
                const { 编译文档 } = await import("../../util/cronjobApi");
                if (!protyle.block.rootID) {
                    return;
                }
                const result = await 编译文档(protyle.block.rootID, "go");
                if (result) {
                    const { Dialog } = await import("../../dialog");
                    new Dialog({
                        title: "编译结果预览",
                        content: `<div class="b3-dialog__content">
                                <pre style="max-height: 60vh; overflow: auto; background: var(--b3-theme-background); padding: 16px; border-radius: 4px;"><code>${result.code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
                                <div style="margin-top: 8px; color: var(--b3-theme-on-surface-light);">输出路径: ${result.output}</div>
                            </div>`,
                        width: "800px"
                    });
                }
            }
        }]
    });
};
