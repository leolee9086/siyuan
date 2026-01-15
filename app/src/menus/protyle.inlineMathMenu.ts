import * as dayjs from "dayjs";
import { focusByRange } from "../ai/imports";
import { Constants } from "../constants";
import { hasClosestBlock } from "../protyle/util/hasClosest";
import { focusByWbr } from "../protyle/util/selection";
import { updateTransaction } from "../protyle/wysiwyg/transaction";
import { getSiyuanGlobalMenusMenu } from "../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { MenuItem } from "./Menu.Item";


export const inlineMathMenu = (protyle: IProtyle, element: Element) => {
    getSiyuanGlobalMenusMenu().remove();
    getSiyuanGlobalMenusMenu().element.setAttribute("data-name", Constants.MENU_INLINE_MATH);
    const nodeElement = hasClosestBlock(element);
    if (!nodeElement) {
        return;
    }
    const id = nodeElement.getAttribute("data-node-id");
    const html = nodeElement.outerHTML;
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        click() {
            const range = document.createRange();
            range.selectNode(element);
            focusByRange(range);
            document.execCommand("copy");
        }
    }).element);
    if (!protyle.disabled) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "cut",
            icon: "iconCut",
            label: siyuanI18n.cut,
            click() {
                const range = document.createRange();
                range.selectNode(element);
                focusByRange(range);
                document.execCommand("cut");
            }
        }).element);
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "remove",
            icon: "iconTrashcan",
            label: siyuanI18n.remove,
            click() {
                element.insertAdjacentHTML("afterend", "<wbr>");
                element.remove();
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, html);
                focusByWbr(nodeElement, protyle.toolbar.range);
            }
        }).element);
    }
    const rect = element.getBoundingClientRect();
    getSiyuanGlobalMenusMenu().popup({
        x: rect.left,
        y: rect.top + 26,
        h: 26
    });
};
