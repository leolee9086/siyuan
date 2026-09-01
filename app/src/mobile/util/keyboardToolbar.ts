import {
    hasClosestBlock,
    hasClosestByAttribute,
    hasClosestByClassName,
    hasClosestByTag,
} from "../../protyle/util/hasClosest";
import {Constants} from "../../constants";
import {focusBlock, focusByRange, getSelectionPosition} from "../../protyle/util/selection";
import {getCurrentEditor} from "./getCurrentEditor"; // 从独立模块导入，避免循环依赖 closePanel → keyboardToolbar → mobile/editor → closePanel
import {hideElements} from "../../protyle/ui/hideElements";
import {
    isInAndroid,
    isInEdge,
    isInHarmony,
    isInMobileApp,
} from "../../protyle/util/compatibility";
import {armKeyboardLock, canInput} from "../keyboard/mobileAppUtil";
import {handleToolbarClick} from "./keyboardToolbar.action";
import {isNotEditBlock} from "../../protyle/wysiwyg/getBlock";
import {getMirror, getUndoRootID, hasUndoStateMirror, initMirror} from "../../protyle/undo/globalUndo";
import {activeBlur} from "../keyboard/activeBlur";
import {hideKeyboardToolbar} from "../keyboard/hideKeyboardToolbar";
import {getMobileKeyboardLifecycleState} from "../keyboard/MobileKeyboardLifecycleRegistry";
import {KEYBOARD_TOOLBAR_HTML} from "./keyboardToolbar.menu";
import {getMobilePluginToolbarItems} from "./pluginToolbar";
import {
    getKeyboardHideResult,
    getMovingSelectionEndpoint,
    hasFixedSelectionEndpointChanged,
    hasVisibleSelectionText,
    isTableCellSelectAll,
    KeyboardHideResult,
    shouldHideKeyboardAfterResize,
    shouldPreserveTableCellSelectAll,
    type TSelectionEndpoint,
} from "./touchSelection";

type TAndroidBoundedSelection = {
    container: HTMLElement,
    anchorNode: Node,
    anchorOffset: number,
    focusNode: Node,
    focusOffset: number,
};

type TAndroidTableCellSelectAll = {
    cell: HTMLTableCellElement,
    editableElement: HTMLElement,
    expiresAt: number,
    range: Range,
};

const ANDROID_TABLE_CELL_SELECT_ALL_TIMEOUT = 2000;

let clearRenderGutterAfterScroll: () => void;
let preventRenderTimeout: number;
let restoringAndroidBoundedSelection = false;
let lastAndroidBoundedSelection: TAndroidBoundedSelection | undefined;
let androidMovingSelectionEndpoint: TSelectionEndpoint | undefined;
let pendingAndroidTableCellSelectAll: TAndroidTableCellSelectAll | undefined;
let restoringAndroidTableCellSelectAll = false;

export const updateMobilePluginToolbar = (protyle: IProtyle) => {
    const currentProtyle = getCurrentEditor()?.protyle;
    if (currentProtyle && currentProtyle !== protyle) {
        return;
    }
    const inlineToolbarElement = document.querySelector<HTMLElement>(
        '#keyboardToolbar .keyboard__action[data-type="inline-memo"]')?.parentElement;
    if (!inlineToolbarElement) {
        return;
    }
    inlineToolbarElement.querySelectorAll('[data-plugin-toolbar="true"]').forEach(item => item.remove());
    getMobilePluginToolbarItems(protyle.options.toolbar, Constants.INLINE_TYPE).forEach(toolbarItem => {
        const itemElement = document.createElement("button");
        itemElement.className = "keyboard__action";
        itemElement.dataset.type = toolbarItem.name;
        itemElement.dataset.pluginToolbar = "true";
        itemElement.innerHTML = `<svg><use xlink:href="#${toolbarItem.icon}"></use></svg>`;
        const label = toolbarItem.tip || (toolbarItem.lang ? window.siyuan.languages[toolbarItem.lang] : "");
        if (label) {
            itemElement.setAttribute("aria-label", label);
        }
        inlineToolbarElement.append(itemElement);
    });
};

export const resetAndroidBoundedSelectionGesture = () => {
    androidMovingSelectionEndpoint = undefined;
};

const clearAndroidBoundedSelection = () => {
    lastAndroidBoundedSelection = undefined;
    androidMovingSelectionEndpoint = undefined;
};

const rememberAndroidTableCellSelectAll = () => {
    if (!isInAndroid() || restoringAndroidTableCellSelectAll) {
        return;
    }
    const selection = getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return;
    }
    const range = selection.getRangeAt(0);
    const startCell = (hasClosestByTag(range.startContainer, "TD") ||
        hasClosestByTag(range.startContainer, "TH")) as HTMLTableCellElement;
    const endCell = (hasClosestByTag(range.endContainer, "TD") ||
        hasClosestByTag(range.endContainer, "TH")) as HTMLTableCellElement;
    if (!startCell || startCell !== endCell || !isTableCellSelectAll(range.toString(), startCell.textContent)) {
        if (pendingAndroidTableCellSelectAll && startCell && startCell !== pendingAndroidTableCellSelectAll.cell) {
            pendingAndroidTableCellSelectAll = undefined;
        }
        return;
    }
    const editor = getCurrentEditor();
    const editableElement = (canInput(document.activeElement) ||
        hasClosestByAttribute(range.startContainer, "contenteditable", "true", true)) as HTMLElement;
    if (!editor || !editableElement || !editor.protyle.wysiwyg.element.contains(startCell) ||
        !(editableElement === startCell || editableElement.contains(startCell) || startCell.contains(editableElement))) {
        return;
    }
    pendingAndroidTableCellSelectAll = {
        cell: startCell,
        editableElement,
        expiresAt: Date.now() + ANDROID_TABLE_CELL_SELECT_ALL_TIMEOUT,
        range: range.cloneRange(),
    };
};

const hasRecentAndroidTableCellSelectAll = (pendingSelection = pendingAndroidTableCellSelectAll) =>
    !!pendingSelection && shouldPreserveTableCellSelectAll(pendingSelection.expiresAt, Date.now()) &&
    pendingSelection.cell.isConnected && pendingSelection.editableElement.isConnected &&
    pendingSelection.range.startContainer.isConnected && pendingSelection.range.endContainer.isConnected;

const restoreRecentAndroidTableCellSelectAll = () => {
    const pendingSelection = pendingAndroidTableCellSelectAll;
    pendingAndroidTableCellSelectAll = undefined;
    if (!pendingSelection || !hasRecentAndroidTableCellSelectAll(pendingSelection)) {
        return false;
    }
    restoringAndroidTableCellSelectAll = true;
    try {
        armKeyboardLock();
        pendingSelection.editableElement.focus({preventScroll: true});
        const selection = getSelection();
        selection.removeAllRanges();
        selection.addRange(pendingSelection.range);
    } finally {
        window.setTimeout(() => {
            restoringAndroidTableCellSelectAll = false;
        });
    }
    return true;
};

const getAndroidBoundedSelection = (selection: Selection, container: HTMLElement): TAndroidBoundedSelection => ({
    container,
    anchorNode: selection.anchorNode,
    anchorOffset: selection.anchorOffset,
    focusNode: selection.focusNode,
    focusOffset: selection.focusOffset,
});

const hasSelectionPointChanged = (node: Node, offset: number, previousNode: Node, previousOffset: number) =>
    node !== previousNode || offset !== previousOffset;

const restoreAndroidBoundedSelection = (selection: Selection, restored: TAndroidBoundedSelection) => {
    lastAndroidBoundedSelection = restored;
    restoringAndroidBoundedSelection = true;
    try {
        selection.setBaseAndExtent(
            restored.anchorNode,
            restored.anchorOffset,
            restored.focusNode,
            restored.focusOffset,
        );
    } finally {
        window.setTimeout(() => {
            restoringAndroidBoundedSelection = false;
        });
    }
    return true;
};

const getAndroidSelectionContainer = (selection: Selection) => {
    const previousContainer = lastAndroidBoundedSelection?.container;
    if (previousContainer?.classList.contains("agent-chat__body") &&
        (previousContainer.contains(selection.anchorNode) || previousContainer.contains(selection.focusNode))) {
        return previousContainer;
    }
    const anchorAgentBody = hasClosestByClassName(selection.anchorNode, "agent-chat__body", true);
    const focusAgentBody = hasClosestByClassName(selection.focusNode, "agent-chat__body", true);
    if (anchorAgentBody && anchorAgentBody === focusAgentBody) {
        return anchorAgentBody;
    }

    const protyle = getCurrentEditor()?.protyle;
    const previewVisible = protyle && !protyle.preview.element.classList.contains("fn__none");
    if (!protyle || (!protyle.disabled && !previewVisible)) {
        return;
    }
    return previewVisible ? protyle.preview.previewElement : protyle.wysiwyg.element;
};

const preserveAndroidBoundedSelection = () => {
    if (!isInAndroid() || restoringAndroidBoundedSelection) {
        return false;
    }
    const selection = getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed ||
        !selection.anchorNode || !selection.focusNode) {
        clearAndroidBoundedSelection();
        return false;
    }
    const container = getAndroidSelectionContainer(selection);
    if (!container) {
        clearAndroidBoundedSelection();
        return false;
    }
    const contains = (node: Node) => node === container || container.contains(node);
    const anchorInside = contains(selection.anchorNode);
    const focusInside = contains(selection.focusNode);
    const current = getAndroidBoundedSelection(selection, container);
    const previous = lastAndroidBoundedSelection;
    const previousAvailable = previous?.container === container &&
        previous.anchorNode.isConnected && previous.focusNode.isConnected &&
        contains(previous.anchorNode) && contains(previous.focusNode);
    if (container.classList.contains("agent-chat__body")) {
        if (!previousAvailable) {
            androidMovingSelectionEndpoint = undefined;
            if (anchorInside && focusInside) {
                lastAndroidBoundedSelection = current;
            } else {
                clearAndroidBoundedSelection();
            }
            return false;
        }
        const anchorChanged = hasSelectionPointChanged(
            current.anchorNode,
            current.anchorOffset,
            previous.anchorNode,
            previous.anchorOffset,
        );
        const focusChanged = hasSelectionPointChanged(
            current.focusNode,
            current.focusOffset,
            previous.focusNode,
            previous.focusOffset,
        );
        androidMovingSelectionEndpoint = getMovingSelectionEndpoint(
            androidMovingSelectionEndpoint,
            anchorChanged,
            focusChanged,
        );
        if (!androidMovingSelectionEndpoint) {
            if (anchorInside && focusInside) {
                lastAndroidBoundedSelection = current;
                return false;
            }
            return restoreAndroidBoundedSelection(selection, previous);
        }
        const movingAnchor = androidMovingSelectionEndpoint === "anchor";
        const movingEndpointInside = movingAnchor ? anchorInside : focusInside;
        if (!movingEndpointInside || hasFixedSelectionEndpointChanged(
            androidMovingSelectionEndpoint,
            anchorChanged,
            focusChanged,
        )) {
            return restoreAndroidBoundedSelection(selection, {
                container,
                anchorNode: movingAnchor && anchorInside ? current.anchorNode : previous.anchorNode,
                anchorOffset: movingAnchor && anchorInside ? current.anchorOffset : previous.anchorOffset,
                focusNode: !movingAnchor && focusInside ? current.focusNode : previous.focusNode,
                focusOffset: !movingAnchor && focusInside ? current.focusOffset : previous.focusOffset,
            });
        }
        lastAndroidBoundedSelection = current;
        return false;
    }
    androidMovingSelectionEndpoint = undefined;
    if (anchorInside && focusInside) {
        lastAndroidBoundedSelection = current;
        return false;
    }
    if (!previousAvailable || anchorInside === focusInside) {
        clearAndroidBoundedSelection();
        return false;
    }
    return restoreAndroidBoundedSelection(selection, {
        container,
        anchorNode: anchorInside ? current.anchorNode : previous.anchorNode,
        anchorOffset: anchorInside ? current.anchorOffset : previous.anchorOffset,
        focusNode: focusInside ? current.focusNode : previous.focusNode,
        focusOffset: focusInside ? current.focusOffset : previous.focusOffset,
    });
};

const preventKeyboardToolbarRender = () => {
    const state = getMobileKeyboardLifecycleState();
    state.preventRender = true;
    clearTimeout(preventRenderTimeout);
    preventRenderTimeout = window.setTimeout(() => {
        getMobileKeyboardLifecycleState().preventRender = false;
    }, 1000);
};

const getVisibleViewportBounds = () => {
    if (!isInMobileApp() && window.visualViewport) {
        return {
            top: window.visualViewport.offsetTop,
            bottom: window.visualViewport.offsetTop + window.visualViewport.height,
        };
    }
    return {
        top: 0,
        bottom: window.innerHeight,
    };
};

const updateKeyboardToolbarPosition = () => {
    if (isInMobileApp() || !window.visualViewport) {
        return;
    }
    const toolbarElement = document.getElementById("keyboardToolbar");
    const viewportBottom = window.visualViewport.offsetTop + window.visualViewport.height;
    const toolbarHeight = toolbarElement.getBoundingClientRect().height || 48;
    toolbarElement.style.transform = "";
    toolbarElement.style.bottom = "auto";
    toolbarElement.style.top = `${viewportBottom - toolbarHeight}px`;
};

export const showKeyboardToolbarUtil = (oldScrollTop: number) => {
    const state = getMobileKeyboardLifecycleState();
    window.siyuan.menus.menu.remove();
    state.showUtil = true;
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
        updateKeyboardToolbarPosition();
    }, Constants.TIMEOUT_TRANSITION); // 防止抖动
    setTimeout(() => {
        getMobileKeyboardLifecycleState().showUtil = false;
    }, 1000);   // 防止光标改变后斜杆菜单消失
};

const hideKeyboardToolbarUtil = () => {
    const toolbarElement = document.getElementById("keyboardToolbar");
    toolbarElement.style.height = "";
    updateKeyboardToolbarPosition();
    const editor = getCurrentEditor();
    if (editor) {
        editor.protyle.element.parentElement.style.paddingBottom = "48px";
    }
    toolbarElement.querySelector('.keyboard__action[data-type="add"]').classList.remove("protyle-toolbar__item--current");
    toolbarElement.querySelector('.keyboard__action[data-type="text"]').classList.remove("protyle-toolbar__item--current");
    toolbarElement.querySelector('.keyboard__action[data-type="done"] use').setAttribute("xlink:href", "#iconKeyboardHide");
};

const renderKeyboardToolbar = () => {
    const state = getMobileKeyboardLifecycleState();
    clearTimeout(state.renderToolbarTimeout);
    state.renderToolbarTimeout = window.setTimeout(() => {
        if (!canInput(document.activeElement)) {
            hideKeyboardToolbar();
            return;
        }
        if (!getMobileKeyboardLifecycleState().showUtil) {
            hideKeyboardToolbarUtil();
        }
        showKeyboardToolbar();
        const dynamicElements = document.querySelectorAll("#keyboardToolbar .keyboard__dynamic");
        const range = getSelection().getRangeAt(0);
        const isProtyle = hasClosestByClassName(range.startContainer, "protyle-wysiwyg", true);
        const nodeElement = hasClosestBlock(range.startContainer);
        const endNodeElement = hasClosestBlock(range.endContainer);
        if (!isProtyle || !nodeElement ||
            hasClosestByAttribute(range.startContainer, "data-type", "av-search")) {
            dynamicElements[0].classList.add("fn__none");
            dynamicElements[1].classList.add("fn__none");
            return;
        }

        const selectText = range.toString();
        const startCellElement = hasClosestByTag(range.startContainer, "TD") ||
            hasClosestByTag(range.startContainer, "TH");
        const endCellElement = hasClosestByTag(range.endContainer, "TD") ||
            hasClosestByTag(range.endContainer, "TH");
        const disableLink = (!!endNodeElement && nodeElement !== endNodeElement) ||
            (!!startCellElement && !!endCellElement && startCellElement !== endCellElement);
        dynamicElements[1].querySelector('[data-type="a"]').toggleAttribute("disabled", disableLink);
        dynamicElements[1].querySelector('[data-type="block-ref"]').toggleAttribute("disabled", disableLink);

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
            // 撤销权威栈在 kernel，本地按 rootID 读镜像设按钮态，首次进入嵌入源文档时按需初始化。
            const undoRootID = getUndoRootID(protyle, range);
            if (undoRootID && !hasUndoStateMirror(undoRootID)) {
                initMirror(undoRootID).then((initialized) => {
                    if (initialized && getUndoRootID(protyle, protyle.toolbar.range) === undoRootID) {
                        renderKeyboardToolbar();
                    }
                });
            }
            const undoState = undoRootID ? getMirror(undoRootID) : {
                canUndo: false,
                canRedo: false
            };
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
    const state = getMobileKeyboardLifecycleState();
    if (!state.showUtil) {
        hideKeyboardToolbarUtil();
    }
    const toolbarElement = document.getElementById("keyboardToolbar");
    const selection = getSelection();
    if (selection.rangeCount > 0 &&
        hasClosestByClassName(selection.getRangeAt(0).startContainer, "agent-chat__composer-host", true)) {
        // 智能体发送框自带操作栏，不能显示会作用于下层文档的移动端编辑工具栏。
        window.dispatchEvent(new CustomEvent("siyuan-mobile-keyboard-change", {detail: true}));
        toolbarElement.classList.add("fn__none");
        document.getElementById("model").style.paddingBottom = "";
        return;
    }
    if (!toolbarElement.classList.contains("fn__none")) {
        window.dispatchEvent(new CustomEvent("siyuan-mobile-keyboard-change", {detail: true}));
        return;
    }
    if (selection.rangeCount === 0) {
        return;
    }
    toolbarElement.classList.remove("fn__none");
    window.dispatchEvent(new CustomEvent("siyuan-mobile-keyboard-change", {detail: true}));
    toolbarElement.style.zIndex = (++window.siyuan.zIndex).toString();
    updateKeyboardToolbarPosition();
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
    clearTimeout(state.scrollSelectionIntoViewTimeout);
    clearRenderGutterAfterScroll?.();
    state.scrollSelectionIntoViewTimeout = window.setTimeout(() => {
        if (editor?.protyle.toolbar.isMultiSelectMode()) {
            return;
        }
        const contentElement = hasClosestByClassName(range.startContainer, "protyle-content", true);
        if (contentElement) {
            const renderGutter = () => {
                const blockElement = hasClosestBlock(range.startContainer);
                if (!editor?.protyle.gutter || !editor.protyle.options.render.gutter ||
                    !blockElement || !editor.protyle.wysiwyg.element.contains(blockElement)) {
                    return;
                }
                const targetElement = range.startContainer.nodeType === Node.ELEMENT_NODE ?
                    range.startContainer as Element : range.startContainer.parentElement;
                editor.protyle.gutter.render(editor.protyle, blockElement, targetElement);
            };
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
            const viewportBounds = getVisibleViewportBounds();
            if (cursorTop < viewportBounds.bottom - 42 &&
                cursorTop > Math.max(contentElement.getBoundingClientRect().top, viewportBounds.top)) {
                renderGutter();
                return;
            }
            const clearRenderGutter = () => {
                contentElement.removeEventListener("scrollend", renderGutterAfterScroll);
                contentElement.removeEventListener("touchstart", clearRenderGutter);
                clearTimeout(renderGutterTimeout);
                clearRenderGutterAfterScroll = undefined;
            };
            const renderGutterAfterScroll = () => {
                clearRenderGutter();
                renderGutter();
            };
            const renderGutterTimeout = window.setTimeout(renderGutterAfterScroll, Constants.TIMEOUT_COUNT);
            clearRenderGutterAfterScroll = clearRenderGutter;
            contentElement.addEventListener("scrollend", renderGutterAfterScroll, {once: true});
            contentElement.addEventListener("touchstart", clearRenderGutter, {once: true, passive: true});
            contentElement.scroll({
                top: cursorTop < 0 ?
                    contentElement.scrollTop + viewportBounds.bottom - viewportBounds.top - 42 :
                    contentElement.scrollTop + cursorTop - viewportBounds.bottom + 42 + 26,
                left: contentElement.scrollLeft,
                behavior: "smooth"
            });
        }
    }, Constants.TIMEOUT_TRANSITION);
};

export const hideKeyboardToolbarByApp = (preserveSelection = false) => {
    const tableCellSelectionRestored = preserveSelection && restoreRecentAndroidTableCellSelectAll();
    if (tableCellSelectionRestored) {
        return KeyboardHideResult.RestoreTableCellSelection;
    }
    preventKeyboardToolbarRender();
    hideKeyboardToolbar();
    const editor = getCurrentEditor();
    const selection = getSelection();
    if (!editor) {
        return KeyboardHideResult.Cleanup;
    }
    hideElements(["util"], editor.protyle);
    const range = selection?.rangeCount > 0 && !selection.isCollapsed ? selection.getRangeAt(0) : undefined;
    const hasVisibleEditorSelection = !!range && hasVisibleSelectionText(range.toString()) &&
        editor.protyle.wysiwyg.element.contains(range.startContainer) &&
        editor.protyle.wysiwyg.element.contains(range.endContainer);
    const result = getKeyboardHideResult(preserveSelection, tableCellSelectionRestored, hasVisibleEditorSelection);
    if (result === KeyboardHideResult.PreserveSelection || !hasVisibleEditorSelection) {
        return result;
    }
    (document.activeElement as HTMLElement)?.blur();
    selection?.removeAllRanges();
    return result;
};

export const initKeyboardToolbar = () => {
    const initialState = getMobileKeyboardLifecycleState();
    initialState.preventRender = false;
    initialState.gestureStartX = 0;
    initialState.gestureStartY = 0;
    initialState.gestureMoved = false;
    if (!isInMobileApp() && window.visualViewport) {
        let pendingUpdate = false;
        const viewportHandler = () => {
            if (pendingUpdate) {
                return;
            }
            pendingUpdate = true;
            requestAnimationFrame(() => {
                pendingUpdate = false;
                updateKeyboardToolbarPosition();
            });
        };
        window.visualViewport.addEventListener("resize", viewportHandler);
        window.visualViewport.addEventListener("scroll", viewportHandler);
        viewportHandler();
    }
    document.addEventListener("selectionchange", () => {
        rememberAndroidTableCellSelectAll();
        if (preserveAndroidBoundedSelection()) {
            return;
        }
        if (getMobileKeyboardLifecycleState().preventRender || (getCurrentEditor()?.protyle?.toolbar.isMultiSelectMode())) {
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
                    if (shouldHideKeyboardAfterResize(isInputFocused, hasRecentAndroidTableCellSelectAll())) {
                        activeBlur();
                    }
                } else if (!getMobileKeyboardLifecycleState().preventRender) {
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
                    if (shouldHideKeyboardAfterResize(isInputFocused, hasRecentAndroidTableCellSelectAll())) {
                        activeBlur();
                    }
                } else if (!getMobileKeyboardLifecycleState().preventRender) {
                    renderKeyboardToolbar();
                }
            }
        });
    }
    const toolbarElement = document.getElementById("keyboardToolbar");
    toolbarElement.innerHTML = KEYBOARD_TOOLBAR_HTML;
    toolbarElement.addEventListener("touchstart", e => {
        const state = getMobileKeyboardLifecycleState();
        state.gestureStartY = e.touches[0].clientY;
        state.gestureStartX = e.touches[0].clientX;
        state.gestureMoved = false;
    });
    toolbarElement.addEventListener("touchmove", e => {
        const state = getMobileKeyboardLifecycleState();
        if (Math.abs(e.touches[0].clientY - state.gestureStartY) > 10 || Math.abs(e.touches[0].clientX - state.gestureStartX) > 10) {
            state.gestureMoved = true;
        }
    });
    toolbarElement.addEventListener("mousedown", event => {
        const buttonElement = hasClosestByTag(event.target as HTMLElement, "BUTTON");
        const type = buttonElement && buttonElement.getAttribute("data-type");
        if (type === "undo" || type === "redo") {
            // 保持编辑器焦点，避免异步撤销或重做期间软键盘收起。
            event.preventDefault();
        }
    });
    toolbarElement.addEventListener(isInAndroid() || isInHarmony() ? "touchend" : "click", (event) => {
        handleToolbarClick(event, getMobileKeyboardLifecycleState().gestureMoved, {
            hideKeyboardToolbarUtil,
            showKeyboardToolbarUtil,
            activeBlur,
            setPreventRender: (value: boolean) => {
                getMobileKeyboardLifecycleState().preventRender = value;
            },
        });
    });
};
