/** 用途：识别跨块 Range 终点。使用范围：Escape 多块选择。解耦评估：经目录入口复用 DOM 查询。 */
import {hasClosestBlock} from "./imports";
/** 用途：定位卡片容器。使用范围：重复 Escape。解耦评估：经目录入口复用 DOM 查询。 */
import {hasClosestByClassName} from "./imports";
/** 用途：提升嵌入块内选择。使用范围：Escape 多块选择。解耦评估：经目录入口复用嵌入判定。 */
import {isInEmbedBlock} from "./imports";
import { hideElements } from "../ui/hideElements";
/** 用途：更新块选择字数。使用范围：Escape 多块选择。解耦评估：经目录入口复用状态 Port。 */
import {countBlockWord} from "./imports";
import {getTopAloneElement} from "./getBlock";

/** 将跨块文本 Range 转成去重后的顶层块选择；普通单块 Range 返回 false。 */
const selectCrossBlockRange = (options: {
    protyle: IProtyle;
    nodeElement: HTMLElement;
    range: Range;
}) => {
    const {protyle, nodeElement, range} = options;
    const endElement = hasClosestBlock(range.endContainer);
    if (!endElement || nodeElement === endElement) {
        return false;
    }
    hideElements(["toolbar", "hint", "util"], protyle);
    hideElements(["select"], protyle);
    const selectElements: HTMLElement[] = [];
    for (const item of protyle.wysiwyg.element.querySelectorAll<HTMLElement>("[data-node-id]")) {
        if (item.querySelector("[data-node-id]") || !range.intersectsNode(item)) {
            continue;
        }
        const embedElement = isInEmbedBlock(item);
        const selectElement = getTopAloneElement(embedElement || item);
        if (!(selectElement instanceof HTMLElement)) {
            throw new TypeError("Escape block selection resolved a non-HTML element");
        }
        if (selectElements.includes(selectElement)) {
            continue;
        }
        selectElements.push(selectElement);
        selectElement.classList.add("protyle-wysiwyg--select");
    }
    range.collapse(false);
    countBlockWord(
        selectElements.map(item => item.getAttribute("data-node-id") || ""),
        protyle.block.rootID,
        false,
        protyle.options.status,
    );
    return true;
};

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
    // Escape 将跨块文本 Range 转换为稳定的块选择，供后续块级操作使用。
    if (selectCrossBlockRange({protyle, nodeElement, range})) {
        return true;
    }
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
