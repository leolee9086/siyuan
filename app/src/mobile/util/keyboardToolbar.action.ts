import {listIndent, listOutdent} from "../../protyle/wysiwyg/list";
import {hasClosestBlock, hasClosestByAttribute, hasClosestByClassName, hasClosestByTag} from "../../protyle/util/hasClosest";
import {moveToDown, moveToUp} from "../../protyle/wysiwyg/move";
import {Constants} from "../../constants";
import {focusByRange} from "../../protyle/util/selection";
import {getCurrentEditor} from "./getCurrentEditor"; // 独立模块，打断循环依赖
import {fontEvent, getFontNodeElements} from "../../protyle/toolbar/Font";
import {hideElements} from "../../protyle/ui/hideElements";
import {softEnter} from "../../protyle/wysiwyg/enter";
import {isInAndroid, isInHarmony} from "../../protyle/util/compatibility";
import {tabCodeBlock} from "../../protyle/wysiwyg/codeBlock";
import {callMobileAppShowKeyboard} from "./mobileAppUtil";
import {renderTextMenu, renderSlashMenu} from "./keyboardToolbar.menu";

interface ToolbarActionDeps {
    hideKeyboardToolbarUtil: () => void;
    showKeyboardToolbarUtil: (oldScrollTop: number) => void;
    activeBlur: () => void;
    setPreventRender: (value: boolean) => void;
}

export const handleToolbarClick = (
    event: Event,
    moved: boolean,
    deps: ToolbarActionDeps,
) => {
    if (moved) {
        return;
    }
    const protyle = getCurrentEditor()?.protyle;
    const target = event.target as HTMLElement;
    const toolbarElement = document.getElementById("keyboardToolbar");
    const slashBtnElement = hasClosestByClassName(event.target as HTMLElement, "keyboard__slash-item");
    if (slashBtnElement && !slashBtnElement.getAttribute("data-type")) {
        const dataValue = decodeURIComponent(slashBtnElement.getAttribute("data-value"));
        if (dataValue === Constants.ZWSP + 3) {
            return;
        }
        protyle.hint.fill(dataValue, protyle, false);   // 点击后 range 会改变
        event.preventDefault();
        event.stopPropagation();
        if (dataValue === "((" || dataValue === "{{") {
            // (( / {{ 的候选列表无输入框，需保持键盘不收起，否则无法继续输入筛选。
            // 见 https://github.com/siyuan-note/siyuan/issues/17877
            callMobileAppShowKeyboard();
            if (isInHarmony() || isInAndroid()) {
                setTimeout(() => focusByRange(protyle.toolbar.range), Constants.TIMEOUT_TRANSITION);
            }
        } else if (slashBtnElement.getAttribute("data-focus") === "true") {
            focusByRange(protyle.toolbar.range);
        }
        return;
    }
    const buttonElement = hasClosestByTag(target, "BUTTON");
    if (!buttonElement || buttonElement.getAttribute("disabled")) {
        return;
    }
    const type = buttonElement.getAttribute("data-type");
    // appearance
    if (["clear", "style2", "style4", "color", "backgroundColor", "fontSize", "style1"].includes(type)) {
        const nodeElements = getFontNodeElements(protyle);
        const itemElement = buttonElement.firstElementChild as HTMLElement;
        if (type === "style1") {
            fontEvent(protyle, nodeElements, type, itemElement.style.backgroundColor + Constants.ZWSP + itemElement.style.color);
        } else if (type === "fontSize") {
            fontEvent(protyle, nodeElements, type, itemElement.textContent.trim());
        } else if (type === "backgroundColor") {
            fontEvent(protyle, nodeElements, type, itemElement.style.backgroundColor);
        } else if (type === "color") {
            fontEvent(protyle, nodeElements, type, itemElement.style.color);
        } else {
            fontEvent(protyle, nodeElements, type);
        }
    }

    event.preventDefault();
    event.stopPropagation();
    if (getSelection().rangeCount === 0) {
        return;
    }

    const range = getSelection().getRangeAt(0);
    if (type === "done") {
        if (toolbarElement.clientHeight > 100) {
            if (isInHarmony() || isInAndroid()) {
                setTimeout(() => focusByRange(range), Constants.TIMEOUT_TRANSITION);
            } else {
                focusByRange(range);
            }
            deps.hideKeyboardToolbarUtil();
            callMobileAppShowKeyboard();
        } else {
            deps.activeBlur();
        }
        return;
    }
    if (window.siyuan.config.readonly || !protyle || protyle.disabled) {
        return;
    }
    if (type === "undo") {
        protyle.undo.undo(protyle);
        return;
    } else if (type === "redo") {
        protyle.undo.redo(protyle);
        return;
    }
    if (getSelection().rangeCount === 0) {
        return;
    }
    const nodeElement = hasClosestBlock(range.startContainer);
    if (!nodeElement) {
        return;
    }
    // inline element
    if (type === "goback") {
        toolbarElement.querySelector('.keyboard__action[data-type="goinline"]').classList.remove("protyle-toolbar__item--current");
        const dynamicElements = document.querySelectorAll("#keyboardToolbar .keyboard__dynamic");
        dynamicElements[0].classList.remove("fn__none");
        dynamicElements[1].classList.add("fn__none");
        focusByRange(range);
        deps.setPreventRender(true);
        setTimeout(() => {
            deps.setPreventRender(false);
        }, 1000);
        return;
    } else if (type === "goinline") {
        buttonElement.classList.add("protyle-toolbar__item--current");
        const dynamicElements = document.querySelectorAll("#keyboardToolbar .keyboard__dynamic");
        dynamicElements[1].classList.remove("fn__none");
        dynamicElements[0].classList.add("fn__none");
        focusByRange(range);
        return;
    } else if (["a", "block-ref", "inline-math", "inline-memo"].includes(type)) {
        if (!hasClosestByAttribute(range.startContainer, "data-type", "NodeCodeBlock")) {
            hideElements(["util"], protyle);
            protyle.toolbar.element.querySelector(`[data-type="${type}"]`).dispatchEvent(new CustomEvent("click"));
        }
        return;
    } else if (buttonElement.classList.contains("keyboard__action") && ["strong", "em", "s", "code", "mark", "tag", "u", "sup", "clear", "sub", "kbd"].includes(type)) {
        if (!hasClosestByAttribute(range.startContainer, "data-type", "NodeCodeBlock")) {
            protyle.toolbar.setInlineMark(protyle, type, "toolbar");
        }
        return;
    } else if (type === "text") {
        if (buttonElement.classList.contains("protyle-toolbar__item--current")) {
            deps.hideKeyboardToolbarUtil();
            focusByRange(range);
        } else {
            buttonElement.classList.add("protyle-toolbar__item--current");
            toolbarElement.querySelector('.keyboard__action[data-type="done"] use').setAttribute("xlink:href", "#iconCloseRound");
            const oldScrollTop = protyle.contentElement.scrollTop;
            renderTextMenu(protyle, toolbarElement);
            deps.showKeyboardToolbarUtil(oldScrollTop);
            window.JSAndroid?.hideKeyboard();
            setTimeout(() => {
                focusByRange(range);
                deps.setPreventRender(true);
                setTimeout(() => {
                    deps.setPreventRender(false);
                }, 1000);
            }, Constants.TIMEOUT_TRANSITION);
        }
        return;
    } else if (type === "moveup") {
        moveToUp(protyle, nodeElement, range);
        focusByRange(range);
        return;
    } else if (type === "movedown") {
        moveToDown(protyle, nodeElement, range);
        focusByRange(range);
        return;
    } else if (type === "softLine") {
        range.extractContents();
        softEnter(range, nodeElement, protyle);
        focusByRange(range);
        return;
    } else if (type === "add") {
        if (buttonElement.classList.contains("protyle-toolbar__item--current")) {
            if (isInHarmony() || isInAndroid()) {
                setTimeout(() => focusByRange(range), Constants.TIMEOUT_TRANSITION);
            } else {
                focusByRange(range);
            }
            deps.hideKeyboardToolbarUtil();
            callMobileAppShowKeyboard();
        } else {
            (document.activeElement as HTMLElement)?.blur();
            buttonElement.classList.add("protyle-toolbar__item--current");
            toolbarElement.querySelector('.keyboard__action[data-type="done"] use').setAttribute("xlink:href", "#iconCloseRound");
            const oldScrollTop = protyle.contentElement.scrollTop;
            renderSlashMenu(protyle, toolbarElement);
            deps.showKeyboardToolbarUtil(oldScrollTop);
            window.JSAndroid?.hideKeyboard();
        }
        return;
    } else if (type === "block") {
        protyle.gutter.renderMenu(protyle, nodeElement);
        window.siyuan.menus.menu.fullscreen();
        deps.activeBlur();
        return;
    } else if (type === "outdent") {
        if (nodeElement.classList.contains("code-block")) {
            if (range.toString() !== "") {
                tabCodeBlock(protyle, nodeElement, range, true);
            }
        } else {
            listOutdent(protyle, [nodeElement.parentElement], range);
        }
        focusByRange(range);
        return;
    } else if (type === "indent") {
        if (nodeElement.classList.contains("code-block")) {
            if (range.toString() !== "") {
                tabCodeBlock(protyle, nodeElement, range);
            }
        } else {
            listIndent(protyle, [nodeElement.parentElement], range);
        }
        focusByRange(range);
        return;
    }
};
