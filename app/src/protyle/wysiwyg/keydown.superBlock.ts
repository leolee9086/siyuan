
import { matchHotKey } from "../util/hotKey";
import { cancelSB } from "../../block/util.cancelSB";
import {transaction} from "./transaction/submit";
import {turnsIntoOneTransaction} from "./transaction/turns/container";
import {updateTransaction} from "./transaction/update";
import { focusByWbr } from "../util/selection";
import * as dayjs from "dayjs";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";


export const handleVLayoutMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (!matchHotKey(getSiyuanConfig().keymap.editor.general.vLayout.custom, event)) {
        return;
    }
    if (!protyle.wysiwyg) {
        throw new Error("protyle结构错误");
    }
    event.preventDefault();
    event.stopPropagation();
    const selectsElement: HTMLElement[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
    // 处理单个超级块的布局切换
    const firstSelectedBlockElement = selectsElement[0];

    if (selectsElement.length === 1 && firstSelectedBlockElement && firstSelectedBlockElement.getAttribute("data-type") === "NodeSuperBlock") {
        const firstSelectedBlockId = firstSelectedBlockElement.getAttribute("data-node-id");
        if (!firstSelectedBlockId) {
            throw new Error("块元素缺少id");
        }
        if (firstSelectedBlockElement.getAttribute("data-sb-layout") === "col") {
            const oldHTML = firstSelectedBlockElement.outerHTML;
            firstSelectedBlockElement.setAttribute("data-sb-layout", "row");
            firstSelectedBlockElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(protyle, firstSelectedBlockElement, oldHTML);
        } else {
            range.insertNode(document.createElement("wbr"));
            const sbData = await cancelSB(protyle, firstSelectedBlockElement);
            transaction(protyle, sbData.doOperations, sbData.undoOperations);
            focusByWbr(protyle.wysiwyg.element, range);
        }
        controller.abort("垂直布局：单个超级块布局切换");
        return;
    }

    // 处理多个块合并为超级块
    if (selectsElement.length < 2 || selectsElement[0]?.classList.contains("li")) {
        controller.abort("垂直布局：选中块不足或包含列表项");
        return;
    }

    turnsIntoOneTransaction({
        protyle,
        selectsElement,
        type: "BlocksMergeSuperBlock",
        level: "row"
    });
    controller.abort("垂直布局：合并为超级块");
    return;
};

/**
 * 处理水平布局快捷键
 * @param event 键盘事件
 * @param protyle 编辑器实例
 * @param range 当前选择范围
 */
export const handleHLayoutMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (!matchHotKey(getSiyuanConfig().keymap.editor.general.hLayout.custom, event)) {
        return false;
    }
    if (!protyle.wysiwyg) {
        throw new Error("protyle结构错误");
    }
    event.preventDefault();
    event.stopPropagation();

    const selectsElement: HTMLElement[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
    // 处理单个超级块的布局切换
    const firstSelectedBlockElement = selectsElement[0];


    // 处理单个超级块的布局切换
    if (selectsElement.length === 1 && firstSelectedBlockElement && firstSelectedBlockElement.getAttribute("data-type") === "NodeSuperBlock") {
        const firstSelectedBlockId = firstSelectedBlockElement.getAttribute("data-node-id");
        if (!firstSelectedBlockId) {
            throw new Error("块元素缺少id");
        }
        if (firstSelectedBlockElement.getAttribute("data-sb-layout") === "row") {
            const oldHTML = firstSelectedBlockElement.outerHTML;
            firstSelectedBlockElement.setAttribute("data-sb-layout", "col");
            firstSelectedBlockElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(protyle, firstSelectedBlockElement, oldHTML);
        } else {
            range.insertNode(document.createElement("wbr"));
            const sbData = await cancelSB(protyle, firstSelectedBlockElement);
            transaction(protyle, sbData.doOperations, sbData.undoOperations);
            focusByWbr(protyle.wysiwyg.element, range);
        }
        controller.abort("水平布局：单个超级块布局切换");
        return true;
    }

    // 处理多个块合并为超级块
    if (selectsElement.length < 2 || selectsElement[0]?.classList.contains("li")) {
        controller.abort("水平布局：选中块不足或包含列表项");
        return true;
    }

    turnsIntoOneTransaction({
        protyle,
        selectsElement,
        type: "BlocksMergeSuperBlock",
        level: "col"
    });
    controller.abort("水平布局：合并为超级块");

    return true;
};

