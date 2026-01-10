import { MenuItem } from "../../menus/Menu.Item";
import { copySubMenu } from "../../menus/commonMenuItem.copy";
import { addEditorToDatabase } from "../render/av/addToDatabase";
import { deleteFile } from "../../editor/deleteFile";
import { openDocHistory } from "../../history/doc";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

export const createProtyleCopyMenu = (protyle: IProtyle) => {
    return new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        type: "submenu",
        submenu: copySubMenu([protyle.block.rootID], true, undefined, protyle.block.showAll ? protyle.block.id : protyle.block.rootID)
    });
};

export const createAddToDatabaseMenuItem = (protyle: IProtyle) => {
    const range = getSelection().rangeCount > 0 ? getSelection().getRangeAt(0) : undefined;
    return new MenuItem({
        id: "addToDatabase",
        label: siyuanI18n.addToDatabase,
        accelerator: window.siyuan.config.keymap.general.addToDatabase.custom,
        icon: "iconDatabase",
        click: () => {
            addEditorToDatabase(protyle, range, "title");
        }
    });
};

export const createDeleteMenuItem = (protyle: IProtyle) => {
    return new MenuItem({
        id: "delete",
        icon: "iconTrashcan",
        label: siyuanI18n.delete,
        click: () => {
            deleteFile(protyle.notebookId, protyle.path);
        }
    });
};



export const createFileHistoryMenuItem = (protyle: IProtyle, response: any) => {
    return new MenuItem({
        id: "fileHistory",
        label: siyuanI18n.fileHistory,
        icon: "iconHistory",
        click() {
            openDocHistory({
                app: protyle.app,
                id: protyle.block.rootID,
                notebookId: protyle.notebookId,
                pathString: response.data.name
            });
        }
    });
};

/**
 * 创建「注册为定时任务」菜单项
 * 在文档标题菜单中显示，允许用户将文档注册为 cronJob 扩展
 * @param protyle - 编辑器实例
 */
export const createCronjobMenuItem = (protyle: IProtyle) => {
    return new MenuItem({
        id: "cronjob",
        label: "定时任务",
        icon: "iconClock",
        type: "submenu",
        submenu: [{
            id: "registerAsCronjob",
            label: "注册为 Go 定时任务",
            click: async () => {
                const { 注册扩展 } = await import("../../util/cronjobApi");
                const success = await 注册扩展(protyle.block.rootID, "go", "cronjob");
                if (success) {
                    const { showMessage } = await import("../../dialog/message");
                    showMessage("已注册为定时任务，可在侧边栏「定时任务」面板中管理");
                }
            }
        }, {
            id: "compileCronjob",
            label: "预览编译结果",
            click: async () => {
                const { 编译文档 } = await import("../../util/cronjobApi");
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
