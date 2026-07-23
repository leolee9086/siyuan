/**
 * Gutter 块菜单 - 编辑操作菜单构建模块
 * 包含剪切、移动、添加到数据库、删除等菜单项
 */
import { focusBlock, getEditorRange } from "../util/selection";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { movePathTo } from "../../util/file/movePathTo";
import { hintMoveBlock } from "../hint/extend";
import { addEditorToDatabase } from "../../protyle/render/av/addToDatabase";
import { removeBlock } from "../wysiwyg/remove";
import type { IGutterEditMenuContext } from "./gutter.types";

/**
 * 构建编辑操作菜单项数组(剪切、移动、添加到数据库、删除)
 */
export function buildGutterEditMenu(context: IGutterEditMenuContext): IMenu[] {
    const { protyle, nodeElement } = context;
    const config = getSiyuanConfig();
    const items: IMenu[] = [];
    if (!context.isEmbedMenu && !protyle.disabled) {
        items.push({
            id: "cut",
            icon: "iconCut",
            label: siyuanI18n.cut,
            accelerator: "⌘X",
            click: () => {
                focusBlock(nodeElement);
                // @全局对象
                document.execCommand("cut");
            }
        }, {
            id: "move",
            protyle: {standalone: false, requires: ["navigation"]},
            icon: "iconMove",
            label: siyuanI18n.move,
            accelerator: config.keymap.general.move.custom,
            click: () => {
                movePathTo({
                    cb: (toPath) => {
                        if (toPath && toPath.length > 0 && toPath[0]) {
                            hintMoveBlock(toPath[0], [nodeElement], protyle);
                        }
                    },
                    flashcard: false,
                });
            }
        });
    }
    if (!protyle.disabled) {
        items.push({
            id: "addToDatabase",
            protyle: {standalone: false, requires: ["database"]},
            icon: "iconDatabase",
            label: siyuanI18n.addToDatabase,
            accelerator: config.keymap.general.addToDatabase.custom,
            click: () => {
                addEditorToDatabase(protyle, getEditorRange(nodeElement));
            }
        });
    }
    if (context.allowRemoval ?? !protyle.disabled) {
        items.push({
            id: "delete",
            icon: "iconTrashcan",
            label: siyuanI18n.delete,
            accelerator: "⌫",
            click: () => {
                protyle.breadcrumb?.hide();
                removeBlock(protyle, nodeElement, getEditorRange(nodeElement), "Backspace");
            }
        });
    }
    return items;
}
