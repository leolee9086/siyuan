import { matchHotKey } from "../util/hotKey";
import { getTopAloneElement } from "./getBlock";
import { setFold } from "../util/blockFold";

/**
 * 折叠展开快捷键中间件
 * 处理块和列表的折叠/展开操作
 */
export const foldHotkeyMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
): Promise<void> => {
    // 折叠快捷键处理
    if (matchHotKey(window.siyuan.config.keymap.editor.general.collapse.custom, event) && !event.repeat) {
        const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
        if (selectElements.length > 0) {
            setFold(protyle, selectElements[0] as Element);
        } else {
            if (nodeElement.parentElement?.getAttribute("data-type") === "NodeListItem") {
                if (nodeElement.parentElement && nodeElement.parentElement.childElementCount > 3) {
                    setFold(protyle, nodeElement.parentElement);
                } else {
                    setFold(protyle, nodeElement);
                }
            } else if (nodeElement.getAttribute("data-type") === "NodeHeading") {
                setFold(protyle, nodeElement);
            } else {
                setFold(protyle, getTopAloneElement(nodeElement));
            }
        }
        event.stopPropagation();
        event.preventDefault();
        controller.abort("折叠操作完成");
        return;
    }
    // 展开快捷键处理
    if (matchHotKey(window.siyuan.config.keymap.editor.general.expand.custom, event) && !event.repeat) {
        const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
        if (selectElements.length > 0) {
            setFold(protyle, selectElements[0] as Element, true);
        } else {
            if (nodeElement.parentElement?.getAttribute("data-type") === "NodeListItem") {
                if (nodeElement.parentElement && nodeElement.parentElement.childElementCount > 3) {
                    setFold(protyle, nodeElement.parentElement, true);
                } else {
                    setFold(protyle, nodeElement, true);
                }
            } else if (nodeElement.getAttribute("data-type") === "NodeHeading") {
                setFold(protyle, nodeElement, true);
            } else {
                setFold(protyle, getTopAloneElement(nodeElement), true);
            }
        }
        event.stopPropagation();
        event.preventDefault();
        controller.abort("展开操作完成");
        return;
    }
};