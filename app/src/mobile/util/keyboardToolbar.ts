import {
    hasClosestBlock,
    hasClosestByAttribute,
    hasClosestByClassName,
} from "../../protyle/util/hasClosest";
import {Constants} from "../../constants";
import {focusBlock, focusByRange, getSelectionPosition} from "../../protyle/util/selection";
import {getCurrentEditor} from "./getCurrentEditor"; // 从独立模块导入，避免循环依赖 closePanel → keyboardToolbar → mobile/editor → closePanel
import {isInAndroid, isInEdge, isInHarmony} from "../../protyle/util/compatibility";
import {canInput, keyboardLockUntil} from "./mobileAppUtil";
import {handleToolbarClick} from "./keyboardToolbar.action";
import {isNotEditBlock} from "../../protyle/wysiwyg/getBlock";
import {getMirror} from "../../protyle/undo/globalUndo";

export {renderTextMenu} from "./keyboardToolbar.menu";
import {KEYBOARD_TOOLBAR_HTML} from "./keyboardToolbar.menu";

let renderKeyboardToolbarTimeout: number;
let showUtil = false;

export const showKeyboardToolbarUtil = (oldScrollTop: number) => {
    window.siyuan.menus.menu.remove();
    showUtil = true;
    const toolHeight = document.querySelector(".keyboard__bar").clientHeight;
    const toolbarElement = document.getElementById("keyboardToolbar");
    let keyboardHeight = window.innerHeight / 2 - toolHeight;
    if (window.siyuan.mobile.size.isLandscape) {
        if (window.siyuan.mobile.size.landscape.height1 !== window.siyuan.mobile.size.landscape.height2) {
            keyboardHeight = window.siyuan.mobile.size.landscape.height1 - window.siyuan.mobile.size.landscape.height2 + toolHeight;
        }
    } else {
        if (window.siyuan.mobile.size.portrait.height1 !== window.siyuan.mobile.size.portrait.height2) {
            keyboardHeight = window.siyuan.mobile.size.portrait.height1 - window.siyuan.mobile.size.portrait.height2 + toolHeight;
        }
    }
    const editor = getCurrentEditor();
    if (editor) {
        editor.protyle.element.parentElement.style.paddingBottom = keyboardHeight + "px";
        editor.protyle.contentElement.scrollTop = oldScrollTop;
    }
    setTimeout(() => {
        toolbarElement.style.height = keyboardHeight + "px";
    }, Constants.TIMEOUT_TRANSITION); // 防止抖动
    setTimeout(() => {
        showUtil = false;
    }, 1000);   // 防止光标改变后斜杆菜单消失
};

const hideKeyboardToolbarUtil = () => {
    const toolbarElement = document.getElementById("keyboardToolbar");
    toolbarElement.style.height = "";
    const editor = getCurrentEditor();
    if (editor) {
        editor.protyle.element.parentElement.style.paddingBottom = "48px";
    }
    toolbarElement.querySelector('.keyboard__action[data-type="add"]').classList.remove("protyle-toolbar__item--current");
    toolbarElement.querySelector('.keyboard__action[data-type="text"]').classList.remove("protyle-toolbar__item--current");
    toolbarElement.querySelector('.keyboard__action[data-type="done"] use').setAttribute("xlink:href", "#iconKeyboardHide");
};

const renderKeyboardToolbar = () => {
    clearTimeout(renderKeyboardToolbarTimeout);
    renderKeyboardToolbarTimeout = window.setTimeout(() => {
        if (!canInput(document.activeElement)) {
            hideKeyboardToolbar();
            return;
        }
        if (!showUtil) {
            hideKeyboardToolbarUtil();
        }
        showKeyboardToolbar();
        const dynamicElements = document.querySelectorAll("#keyboardToolbar .keyboard__dynamic");
        const range = getSelection().getRangeAt(0);
        const isProtyle = hasClosestByClassName(range.startContainer, "protyle-wysiwyg", true);
        const nodeElement = hasClosestBlock(range.startContainer);
        if (!isProtyle || !nodeElement ||
            hasClosestByAttribute(range.startContainer, "data-type", "av-search")) {
            dynamicElements[0].classList.add("fn__none");
            dynamicElements[1].classList.add("fn__none");
            return;
        }

        const selectText = range.toString();

        if (!nodeElement.classList.contains("code-block") &&
            (selectText || dynamicElements[0].querySelector('[data-type="goinline"]').classList.contains("protyle-toolbar__item--current"))) {
            dynamicElements[0].classList.add("fn__none");
            dynamicElements[1].classList.remove("fn__none");
        } else {
            dynamicElements[0].classList.remove("fn__none");
            dynamicElements[1].classList.add("fn__none");
        }

        const protyle = getCurrentEditor().protyle;
        protyle.toolbar.range = range;
        if (!dynamicElements[0].classList.contains("fn__none")) {
            // 撤销权威栈在 kernel，本地按 rootID 读镜像设按钮态（零 fetch）
            const undoState = protyle.block?.rootID ? getMirror(protyle.block.rootID) : {canUndo: false, canRedo: false};
            if (!undoState.canUndo) {
                dynamicElements[0].querySelector('[data-type="undo"]').setAttribute("disabled", "disabled");
            } else {
                dynamicElements[0].querySelector('[data-type="undo"]').removeAttribute("disabled");
            }
            if (!undoState.canRedo) {
                dynamicElements[0].querySelector('[data-type="redo"]').setAttribute("disabled", "disabled");
            } else {
                dynamicElements[0].querySelector('[data-type="redo"]').removeAttribute("disabled");
            }
            const outdentElement = dynamicElements[0].querySelector('[data-type="outdent"]');
            const goinlineElement = dynamicElements[0].querySelector('[data-type="goinline"]');
            if (nodeElement.classList.contains("code-block")) {
                goinlineElement.classList.add("fn__none");
            } else {
                goinlineElement.classList.remove("fn__none");
            }
            if (nodeElement.parentElement.classList.contains("li")) {
                outdentElement.classList.remove("fn__none");
                outdentElement.nextElementSibling.classList.remove("fn__none");
                if (nodeElement.parentElement.previousElementSibling) {
                    outdentElement.nextElementSibling.removeAttribute("disabled");
                } else {
                    outdentElement.nextElementSibling.setAttribute("disabled", "true");
                }
            } else if (nodeElement.classList.contains("code-block") && range.toString()) {
                outdentElement.classList.remove("fn__none");
                outdentElement.nextElementSibling.classList.remove("fn__none");
            } else {
                outdentElement.classList.add("fn__none");
                outdentElement.nextElementSibling.classList.add("fn__none");
            }
        }

        if (!dynamicElements[1].classList.contains("fn__none")) {
            dynamicElements[1].querySelectorAll(".protyle-toolbar__item--current").forEach(item => {
                item.classList.remove("protyle-toolbar__item--current");
            });
            const types = protyle.toolbar.getCurrentType(range);
            types.forEach(item => {
                if (["search-mark", "a", "block-ref", "virtual-block-ref", "text", "file-annotation-ref", "inline-math",
                    "inline-memo", "", "backslash"].includes(item)) {
                    return;
                }
                const itemElement = dynamicElements[1].querySelector(`[data-type="${item}"]`);
                if (itemElement) {
                    itemElement.classList.add("protyle-toolbar__item--current");
                }
            });
        }
    }, 620); // 需等待 range 更新
};

export const showKeyboardToolbar = () => {
    if (!showUtil) {
        hideKeyboardToolbarUtil();
    }
    const toolbarElement = document.getElementById("keyboardToolbar");
    if (!toolbarElement.classList.contains("fn__none") || getSelection().rangeCount === 0) {
        return;
    }
    toolbarElement.classList.remove("fn__none");
    toolbarElement.style.zIndex = (++window.siyuan.zIndex).toString();
    const modelElement = document.getElementById("model");
    if (modelElement.style.transform === "translateY(0px)") {
        modelElement.style.paddingBottom = "48px";
    }
    const range = getSelection().getRangeAt(0);
    const editor = getCurrentEditor();
    if (editor) {
        if (editor.protyle.wysiwyg.element.contains(range.startContainer)) {
            editor.protyle.element.parentElement.style.paddingBottom = "48px";
        }
        editor.protyle.app.plugins.forEach(item => {
            item.eventBus.emit("mobile-keyboard-show");
        });
    }
    setTimeout(() => {
        const contentElement = hasClosestByClassName(range.startContainer, "protyle-content", true);
        if (contentElement) {
            let cursorTop = getSelectionPosition(contentElement).top;
            if (cursorTop < 0 && window.siyuan.mobile.touchRange) {
                const rangeBlockElement = hasClosestBlock(window.siyuan.mobile.touchRange.startContainer);
                if (rangeBlockElement) {
                    if (isNotEditBlock(rangeBlockElement)) {
                        focusBlock(rangeBlockElement);
                    } else {
                        focusByRange(window.siyuan.mobile.touchRange);
                    }
                    cursorTop = getSelectionPosition(contentElement, window.siyuan.mobile.touchRange).top;
                }
            }
            if (cursorTop < window.innerHeight - 42 && cursorTop > contentElement.getBoundingClientRect().top) {
                return;
            }
            contentElement.scroll({
                top: cursorTop < 0 ? contentElement.scrollTop + window.innerHeight - 42 :
                    contentElement.scrollTop + cursorTop - window.innerHeight + 42 + 26,
                left: contentElement.scrollLeft,
                behavior: "smooth"
            });
        }
    }, Constants.TIMEOUT_TRANSITION);
};

export const hideKeyboardToolbar = () => {
    if (showUtil) {
        return;
    }
    const toolbarElement = document.getElementById("keyboardToolbar");
    if (toolbarElement.classList.contains("fn__none")) {
        return;
    }
    toolbarElement.classList.add("fn__none");
    toolbarElement.style.height = "";
    const editor = getCurrentEditor();
    if (editor) {
        editor.protyle.element.parentElement.style.paddingBottom = "";
        editor.protyle.app.plugins.forEach(item => {
            item.eventBus.emit("mobile-keyboard-hide");
        });
    }
    const modelElement = document.getElementById("model");
    if (modelElement.style.transform === "translateY(0px)") {
        modelElement.style.paddingBottom = "";
    }
};

export const activeBlur = () => {
    const now = Date.now();
    if (now < keyboardLockUntil) {
        console.warn(`activeBlur blocked by lock (remaining: ${keyboardLockUntil - now}ms)`);
        return;
    }

    if (window.JSAndroid && window.JSAndroid.hideKeyboard) {
        window.JSAndroid.hideKeyboard();
    } else if (window.JSHarmony && window.JSHarmony.hideKeyboard) {
        window.JSHarmony.hideKeyboard();
    }
    hideKeyboardToolbar();
    (document.activeElement as HTMLElement).blur();
};

export const initKeyboardToolbar = () => {
    let preventRender = false;
    document.addEventListener("selectionchange", () => {
        if (preventRender || (getCurrentEditor()?.protyle?.toolbar.isMultiSelectMode())) {
            return;
        }
        renderKeyboardToolbar();
    }, false);
    window.siyuan.mobile.size.isLandscape = window.matchMedia && window.matchMedia("(orientation: landscape)").matches;
    if (window.siyuan.mobile.size.isLandscape) {
        window.siyuan.mobile.size.landscape = {
            height1: window.innerHeight,
            height2: window.innerHeight,
        };
    } else {
        window.siyuan.mobile.size.portrait = {
            height1: window.innerHeight,
            height2: window.innerHeight,
        };
    }
    if (!isInEdge()) {
        window.addEventListener("resize", () => {
            // 获取键盘高度
            window.siyuan.mobile.size.isLandscape = window.matchMedia && window.matchMedia("(orientation: landscape)").matches;
            if (window.siyuan.mobile.size.isLandscape) {
                if (!window.siyuan.mobile.size.landscape) {
                    window.siyuan.mobile.size.landscape = {
                        height1: window.innerHeight,
                        height2: window.innerHeight,
                    };
                }
                if (window.innerHeight < window.siyuan.mobile.size.landscape.height1 - 100) {
                    window.siyuan.mobile.size.landscape.height2 = window.innerHeight;
                }
                if (window.innerHeight > window.siyuan.mobile.size.landscape.height1) {
                    window.siyuan.mobile.size.landscape.height1 = window.innerHeight;
                }
                if (window.siyuan.mobile.size.landscape.height2 < window.innerHeight) {
                    const isInputFocused = document.activeElement && (
                        ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) ||
                        (document.activeElement as HTMLElement).isContentEditable);
                    if (!isInputFocused) {
                        activeBlur();
                    }
                } else if (!preventRender) {
                    renderKeyboardToolbar();
                }
            } else {
                if (!window.siyuan.mobile.size.portrait) {
                    window.siyuan.mobile.size.portrait = {
                        height1: window.innerHeight,
                        height2: window.innerHeight,
                    };
                }
                if (window.innerHeight < window.siyuan.mobile.size.portrait.height1 - 100) {
                    window.siyuan.mobile.size.portrait.height2 = window.innerHeight;
                }
                if (window.innerHeight > window.siyuan.mobile.size.portrait.height1) {
                    window.siyuan.mobile.size.portrait.height1 = window.innerHeight;
                }
                if (window.siyuan.mobile.size.portrait.height2 < window.innerHeight) {
                    const isInputFocused = document.activeElement && (
                        ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) ||
                        (document.activeElement as HTMLElement).isContentEditable);
                    if (!isInputFocused) {
                        activeBlur();
                    }
                } else if (!preventRender) {
                    renderKeyboardToolbar();
                }
            }
        });
    }
    const toolbarElement = document.getElementById("keyboardToolbar");
    toolbarElement.innerHTML = KEYBOARD_TOOLBAR_HTML;
    let startY = 0;
    let startX = 0;
    let moved = false;
    toolbarElement.addEventListener("touchstart", e => {
        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
        moved = false;
    });
    toolbarElement.addEventListener("touchmove", e => {
        if (Math.abs(e.touches[0].clientY - startY) > 10 || Math.abs(e.touches[0].clientX - startX) > 10) {
            moved = true;
        }
    });
    toolbarElement.addEventListener(isInAndroid() || isInHarmony() ? "touchend" : "click", (event) => {
        handleToolbarClick(event, moved, {
            hideKeyboardToolbarUtil,
            showKeyboardToolbarUtil,
            activeBlur,
            setPreventRender: (value: boolean) => {
                preventRender = value;
            },
        });
    });
};
