/**
 * setInlineMark 方法的辅助函数 - 菜单显示
 * 从 setInlineMark.helper.ts 拆分出来
 */

import { Constants } from "../../../constants";
import { linkMenu } from "../../../menus/protyle.linkMenu";
import { mathRender } from "../../render/mathRender";
import { isHTMLElement } from "./inlineMark.guard";

/**
 * 显示特殊类型的编辑菜单
 * 根据内联元素类型（数学公式、备注、链接）显示对应的编辑界面
 * 
 * 原始位置: index.ts L831-L850
 */
export function 显示特殊类型菜单(
    protyle: IProtyle,
    showMenuElement: HTMLElement,
    type: string,
    selectText: string,
    newNodes: Node[],
    nodeElement: HTMLElement,
    html: string
): void {
    if (showMenuElement.nodeType === 3) {
        return;
    }

    const showMenuTypes = (showMenuElement.getAttribute("data-type") || "").split(" ");

    if (type === "inline-math") {
        mathRender(nodeElement);
    }

    if (type === "inline-math" && selectText === "" && showMenuTypes.includes("inline-math") && protyle.toolbar) {
        protyle.toolbar.showRender(protyle, showMenuElement, undefined, html);
    }

    if (type === "inline-math") {
        return;
    }

    if (type === "inline-memo" &&
        !showMenuElement.getAttribute("data-inline-memo-content") &&
        showMenuTypes.includes("inline-memo") &&
        protyle.toolbar) {
        protyle.toolbar.showRender(protyle, showMenuElement, newNodes.filter(isHTMLElement), html);
        return;
    }

    if (type === "a" &&
        showMenuTypes.includes("a") &&
        (showMenuElement.textContent?.replace(Constants.ZWSP, "") === "" || !showMenuElement.getAttribute("data-href"))) {
        linkMenu(protyle, showMenuElement, !!showMenuElement.getAttribute("data-href"));
    }
}
