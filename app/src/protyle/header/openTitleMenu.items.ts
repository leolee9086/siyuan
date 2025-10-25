import { MenuItem } from "../../menus/Menu.Item";
import { copySubMenu } from "../../menus/commonMenuItem.copy";
import { addEditorToDatabase } from "../render/av/addToDatabase";
import { deleteFile } from "../../editor/deleteFile";
import { openDocHistory } from "../../history/doc";

export const createProtyleCopyMenu = (protyle: IProtyle) => {
    return new MenuItem({
        id: "copy",
        label: window.siyuan.languages.copy,
        icon: "iconCopy",
        type: "submenu",
        submenu: copySubMenu([protyle.block.rootID], true, undefined, protyle.block.showAll ? protyle.block.id : protyle.block.rootID)
    });
};

export const createAddToDatabaseMenuItem = (protyle: IProtyle) => {
    const range = getSelection().rangeCount > 0 ? getSelection().getRangeAt(0) : undefined;
    return new MenuItem({
        id: "addToDatabase",
        label: window.siyuan.languages.addToDatabase,
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
        label: window.siyuan.languages.delete,
        click: () => {
            deleteFile(protyle.notebookId, protyle.path);
        }
    });
};



export const createFileHistoryMenuItem = (protyle: IProtyle, response: any) => {
    return new MenuItem({
        id: "fileHistory",
        label: window.siyuan.languages.fileHistory,
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
