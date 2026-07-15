import { hasClosestByClassName } from "../util/hasClosest";
import { hideElements } from "../ui/hideElements";
import { countBlockWord } from "../runtime/status.port";

/**
 * 处理重复按键时的ESC键逻辑
 */
const handleRepeatEscape = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
): boolean => {
    // https://github.com/siyuan-note/siyuan/issues/12989
    const cardElement = hasClosestByClassName(range.startContainer, "card__main", true);
    if (cardElement && document.activeElement && document.activeElement.classList.contains("protyle-wysiwyg")) {
        (cardElement.querySelector(".card__action:not(.fn__none) button:not([disabled])") as HTMLElement).focus();
        hideElements(["select"], protyle);
        return true;
    }
    return false;
};

/**
 * 处理非重复按键时的ESC键逻辑
 */
const handleNormalEscape = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
): boolean => {
    // 隐藏工具栏、提示框、子工具栏
    if (protyle.toolbar &&
        protyle.hint &&
        (!protyle.toolbar.element.classList.contains("fn__none") ||
        !protyle.hint.element.classList.contains("fn__none") ||
        !protyle.toolbar.subElement.classList.contains("fn__none"))) {
        hideElements(["toolbar", "hint", "util"], protyle);
        protyle.hint.enableExtend = false;
        return true;
    }
    
    // 移除菜单
    if (window.siyuan && window.siyuan.menus &&
        !window.siyuan.menus.menu.element.classList.contains("fn__none")) {
        // 防止 ESC 时选中当前块
        window.siyuan.menus.menu.remove(true);
        return true;
    }
    
    // 处理块选择状态
    if (nodeElement.classList.contains("protyle-wysiwyg--select")) {
        hideElements(["select"], protyle);
        countBlockWord([], protyle.block.rootID, false, protyle.options.status);
        return true;
    }
    
    // 默认处理：隐藏选择并选中当前块
    hideElements(["select"], protyle);
    range.collapse(false);
    nodeElement.classList.add("protyle-wysiwyg--select");
    const nodeId = nodeElement.getAttribute("data-node-id");
    if (nodeId) {
        countBlockWord([nodeId], protyle.block.rootID, false, protyle.options.status);
    }
    return true;
};

/**
 * ESC键处理中间件
 * 处理ESC键的各种交互场景，包括重复按键、工具栏隐藏、菜单移除和块选择状态切换
 */
export const escapeKeyMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
): Promise<void> => {
    if (event.key !== "Escape") {
        return;
    }
    
    let handled = false;
    
    if (event.repeat) {
        handled = handleRepeatEscape(event, protyle, nodeElement, range, controller);
    } else {
        handled = handleNormalEscape(event, protyle, nodeElement, range, controller);
    }
    
    if (handled) {
        event.stopPropagation();
        event.preventDefault();
        controller.abort("ESC键处理");
    }
};
