import { MenuItem } from "../../menus/Menu.Item";
import {copySubMenu} from "../../menus/commonMenuItem/copy/copySubMenu.factory";
import { addEditorToDatabase } from "../render/av/addToDatabase";
import { deleteFile } from "../../editor/deleteFile";
import { openDocHistory } from "../../history/doc";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../layout/dock/dock.environment";
import { fetchSyncPost } from "../../util/network/fetch";
import { Dialog, showMessage } from "../runtime/dialog.port";
import { encodeBase64 } from "../util/compatibility";

/**
 * 创建复制菜单项
 * @param protyle - 编辑器实例
 */
export const createProtyleCopyMenu = (protyle: IProtyle) => {
    const submenu = copySubMenu([protyle.block.rootID], true, undefined, protyle.block.showAll ? protyle.block.id : protyle.block.rootID);
    submenu.push({
        iconHTML: "",
        label: siyuanI18n.copyDoc,
        accelerator: undefined,
        click: async () => {
            const [responseHTML, responseText] = await Promise.all([
                fetchSyncPost("/api/block/getBlockDOM", {
                    id: protyle.block.rootID,
                    notebook: protyle.notebookId,
                }),
                fetchSyncPost("/api/export/exportMdContent", {
                    id: protyle.block.rootID,
                    refMode: 3,
                    embedMode: 1,
                    yfm: false,
                    fillCSSVar: false,
                    adjustHeadingLevel: false
                })
            ]);
            const textHTML = `<!--data-siyuan='${encodeBase64(responseHTML.data.dom)}'-->${responseHTML.data.dom}`;
            await navigator.clipboard.write([
                new ClipboardItem({
                    "text/plain": new Blob([responseText.data.content], { type: "text/plain" }),
                    "text/html": new Blob([textHTML], { type: "text/html" }),
                })
            ]);
            showMessage(siyuanI18n.copied);
        }
    });
    return new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        type: "submenu",
        submenu
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
                const { 注册扩展 } = await import("../../util/network/cronjobApi");
                if (!protyle.block.rootID) {
                    return;
                }
                const success = await 注册扩展(protyle.block.rootID, "go", "cronjob");
                if (!success) {
                    return;
                }

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
                const { 编译文档 } = await import("../../util/network/cronjobApi");
                if (!protyle.block.rootID) {
                    return;
                }
                const result = await 编译文档(protyle.block.rootID, "go");
                if (result) {
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

/**
 * 创建「注册为笔记内插件」菜单项
 * 在文档标题菜单中显示，允许用户将文档注册为笔记内插件
 * 如果文档已经是插件，则显示「更新插件」而非「注册」
 * @param protyle - 编辑器实例
 * @param isRegistered - 文档是否已注册为插件（可选，由调用方提供避免重复查询）
 */
export const createInNotePluginMenuItem = (protyle: IProtyle, isRegistered?: boolean) => {
    // 根据是否已注册决定标签文案
    const registerLabel = isRegistered ? "更新插件" : "注册为笔记内插件";

    return new MenuItem({
        id: "inNotePlugin",
        label: registerLabel,
        icon: "iconPlugin",
        /**
         * 注册/更新笔记内插件的点击回调
         */
        click: async () => {
            const docId = protyle.block.rootID;
            const name = protyle.title?.editElement?.textContent || docId;

            await protyle.app.inNotePluginManager.设置为插件文档(docId);
            // 已注册时重载,未注册时启用
            const [动作, 成功消息, 失败消息] = isRegistered
                ? [() => protyle.app.inNotePluginManager.重载插件(docId), "已重载", "重载失败"]
                : [() => protyle.app.inNotePluginManager.启用插件(docId, name), "已启用", "启用失败"];
            const success = await 动作();
            const msg = success ? 成功消息 : 失败消息;
            showMessage(`笔记内插件 [${name}] ${msg}`, success ? undefined : 3000, success ? undefined : "error");
        }
    });
};
