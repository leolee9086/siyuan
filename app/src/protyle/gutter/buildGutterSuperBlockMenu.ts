/**
 * Gutter 块菜单 - 超级块子菜单构建模块
 * 从 renderMenu 提取的超级块菜单构建逻辑
 */

import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { cancelSB } from "../../block/util.cancelSB";
import {transaction} from "../wysiwyg/transaction/submit";
import {updateTransaction} from "../wysiwyg/transaction/update";
import { focusBlock, focusByRange } from "../util/selection";
import { hideElements } from "../ui/hideElements";
import * as dayjs from "dayjs";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import {getEmbedChildOperationContext} from "../wysiwyg/getBlock";

/**
 * 构建 Gutter 超级块子菜单
 * 
 * @param protyle Protyle 实例
 * @param nodeElement 节点元素
 * @returns 菜单项数组
 */
export const buildGutterSuperBlockMenu = (protyle: IProtyle, nodeElement: Element): IMenu[] => {
    const isCol = nodeElement.getAttribute("data-sb-layout") === "col";
    const menus: IMenu[] = [];
    const config = getSiyuanConfig();

    menus.push({
        id: "cancelSuperBlock",
        label: siyuanI18n.cancel + " " + siyuanI18n.superBlock,
        accelerator: config.keymap.editor.general[isCol ? "hLayout" : "vLayout"].custom,
        async click() {
            const sbData = await cancelSB(protyle, nodeElement);
            transaction(protyle, sbData.doOperations, sbData.undoOperations);
            const embedContext = getEmbedChildOperationContext(nodeElement);
            const prevElement = embedContext?.resultElement.querySelector(`[data-node-id="${sbData.previousId}"]`) ||
                protyle.wysiwyg?.element.querySelector(`[data-node-id="${sbData.previousId}"]`);
            if (prevElement) {
                focusBlock(prevElement);
            }
            hideElements(["gutter"], protyle);
        }
    });

    menus.push({
        id: "turnInto" + (isCol ? "VLayout" : "HLayout"),
        accelerator: config.keymap.editor.general[isCol ? "vLayout" : "hLayout"].custom,
        label: siyuanI18n.turnInto + " " + siyuanI18n[isCol ? "vLayout" : "hLayout"],
        click() {
            const oldHTML = nodeElement.outerHTML;
            if (isCol) {
                nodeElement.setAttribute("data-sb-layout", "row");
            } else {
                nodeElement.setAttribute("data-sb-layout", "col");
            }
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(protyle, nodeElement, oldHTML);
            if (protyle.toolbar) {
                focusByRange(protyle.toolbar.range);
            }
            hideElements(["gutter"], protyle);
        }
    });

    return menus;
};
