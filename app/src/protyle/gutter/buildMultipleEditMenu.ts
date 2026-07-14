/**
 * 多选块编辑操作菜单构建模块
 * 从 buildGutterMultipleMenu.ts 拆分而来
 */
import { MenuItem } from "../../menus/Menu.Item";
import { removeBlock } from "../wysiwyg/remove";
import { focusBlock, getEditorRange } from "../util/selection";
import { movePathTo } from "../../util/file/movePathTo";
import { hintMoveBlock } from "../hint/extend";
import { addEditorToDatabase } from "../render/av/addToDatabase";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 构建编辑操作菜单（剪切、移动、删除等）
 */
export const 构建编辑操作菜单 = (protyle: IProtyle, selectsElement: Element[]): void => {
    if (protyle.disabled) {
        return;
    }

    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "cut",
        label: siyuanI18n.cut,
        accelerator: "⌘X",
        icon: "iconCut",
        click: () => {
            focusBlock(selectsElement[0]);
            document.execCommand("cut");
        }
    }).element);

    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "move",
        protyle: {standalone: false, requires: ["navigation"]},
        label: siyuanI18n.move,
        accelerator: getSiyuanConfig().keymap.general.move.custom,
        icon: "iconMove",
        click: () => {
            movePathTo({
                // @内联回调
                cb: (toPath) => {
                    hintMoveBlock(toPath[0], selectsElement, protyle);
                },
                flashcard: false
            });
        }
    }).element);

    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "addToDatabase",
        protyle: {standalone: false, requires: ["database"]},
        label: siyuanI18n.addToDatabase,
        accelerator: getSiyuanConfig().keymap.general.addToDatabase.custom,
        icon: "iconDatabase",
        click: () => {
            addEditorToDatabase(protyle, getEditorRange(selectsElement[0]));
        }
    }).element);

    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "delete",
        label: siyuanI18n.delete,
        icon: "iconTrashcan",
        accelerator: "⌫",
        click: () => {
            protyle.breadcrumb?.hide();
            removeBlock(protyle, selectsElement[0], getEditorRange(selectsElement[0]), "Backspace");
        }
    }).element);
};
