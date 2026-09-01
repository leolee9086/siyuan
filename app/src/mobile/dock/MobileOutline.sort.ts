import {Constants} from "../../constants";
import {transaction} from "../../protyle/wysiwyg/transaction/submit";
import {hasClosestByClassName} from "../../protyle/util/hasClosest";
import {dragOverScroll, stopScrollAnimation} from "../../boot/globalEvent/dragover";
import {bindMousePointerTouchBridge, isMousePointerTouchEvent} from "../util/mousePointerTouchBridge";
import type {MobileOutlineElementPort, MobileOutlineSortPort} from "./outline/ports.types";

interface OutlineTouchDragState {
    selectedElement: HTMLElement;
    startX: number;
    startY: number;
    isDragging: boolean;
    ghostElement: HTMLElement | null;
    startTime: number;
    selectItem: HTMLElement | null;
}

const clearDragIndicators = (outline: MobileOutlineElementPort) => {
    outline.element.querySelectorAll(".dragover__top, .dragover__bottom, .dragover, .dragover__current").forEach((item) => {
        item.classList.remove("dragover__top", "dragover__bottom", "dragover", "dragover__current");
    });
};

const createGhostElement = (selectedElement: HTMLElement, x: number, y: number) => {
    const ghostElement = selectedElement.cloneNode(true) as HTMLElement;
    ghostElement.id = "dragGhost";
    ghostElement.firstElementChild?.setAttribute("style", "padding-left:4px");
    ghostElement.setAttribute(
        "style",
        `border-radius: var(--b3-border-radius);background-color: var(--b3-list-hover);pointer-events:none;position:fixed;top:${y}px;left:${x}px;z-index:999997;`
    );
    document.body.append(ghostElement);
    return ghostElement;
};

const markDropTarget = (outline: MobileOutlineSortPort, state: OutlineTouchDragState, touch: Touch) => {
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const selectItem = target?.closest(".b3-list-item") as HTMLElement;
    if (!selectItem || selectItem.tagName !== "LI" || !outline.tree.element.contains(selectItem)) {
        clearDragIndicators(outline);
        state.selectItem = null;
        return;
    }
    clearDragIndicators(outline);
    if (selectItem === state.selectedElement) {
        selectItem.classList.add("dragover__current");
        state.selectItem = null;
        return;
    }
    const rect = selectItem.getBoundingClientRect();
    const edge = rect.height * .2;
    if (touch.clientY > rect.bottom - edge) {
        selectItem.classList.add("dragover__bottom");
    } else if (touch.clientY < rect.top + edge) {
        selectItem.classList.add("dragover__top");
    } else {
        selectItem.classList.add("dragover");
    }
    state.selectItem = selectItem;
};

const moveOutlineItem = (outline: MobileOutlineElementPort, state: OutlineTouchDragState) => {
    const item = state.selectedElement;
    const selectItem = state.selectItem || outline.element.querySelector<HTMLElement>(".dragover__top, .dragover__bottom, .dragover");
    const editor = window.siyuan.mobile.editor?.protyle;
    if (!selectItem || !editor) {
        return;
    }
    let previousID: string | undefined;
    let parentID: string | undefined;
    const undoPreviousID = item.previousElementSibling?.tagName === "UL"
        ? item.previousElementSibling.previousElementSibling?.getAttribute("data-node-id") ?? undefined
        : item.previousElementSibling?.getAttribute("data-node-id") ?? undefined;
    const undoParentID = item.parentElement.previousElementSibling?.getAttribute("data-node-id") ?? undefined;
    let hasChange = true;
    if (selectItem.classList.contains("dragover")) {
        parentID = selectItem.getAttribute("data-node-id") ?? undefined;
        if (selectItem.nextElementSibling?.tagName === "UL") {
            selectItem.nextElementSibling.insertAdjacentElement("afterbegin", item);
        } else {
            selectItem.insertAdjacentHTML("afterend", `<ul>${item.outerHTML}</ul>`);
            item.remove();
        }
    } else if (selectItem.classList.contains("dragover__top")) {
        parentID = selectItem.parentElement.previousElementSibling?.getAttribute("data-node-id") ?? undefined;
        previousID = selectItem.previousElementSibling?.tagName === "UL"
            ? selectItem.previousElementSibling.previousElementSibling?.getAttribute("data-node-id") ?? undefined
            : selectItem.previousElementSibling?.getAttribute("data-node-id") ?? undefined;
        hasChange = previousID !== item.dataset.nodeId && parentID !== item.dataset.nodeId;
        if (hasChange) {
            selectItem.before(item);
        }
    } else if (selectItem.classList.contains("dragover__bottom")) {
        previousID = selectItem.getAttribute("data-node-id") ?? undefined;
        hasChange = previousID !== item.previousElementSibling?.getAttribute("data-node-id");
        if (hasChange) {
            selectItem.after(item);
        }
    } else {
        return;
    }
    if (!hasChange) {
        return;
    }
    outline.element.setAttribute("data-loading", "true");
    transaction(editor, [{
        action: "moveOutlineHeading",
        id: item.dataset.nodeId,
        previousID,
        parentID,
    }], [{
        action: "moveOutlineHeading",
        id: item.dataset.nodeId,
        previousID: undoPreviousID,
        parentID: undoParentID,
    }]);
    editor.wysiwyg.element.querySelectorAll('[data-type="NodeHeading"] [contenteditable="true"][spellcheck]').forEach((headingItem) => {
        headingItem.setAttribute("contenteditable", "false");
    });
};

export function bindOutlineSort(outline: MobileOutlineSortPort) {
    const scrollElement = outline.tree.element;
    let touchDragState: OutlineTouchDragState | null = null;
    let longPressTimer: number | undefined;
    const cancelLongPressTimer = () => {
        if (longPressTimer !== undefined) {
            clearTimeout(longPressTimer);
            longPressTimer = undefined;
        }
    };
    const vibrateOutline = () => {
        if (window.webkit?.messageHandlers.vibrate) {
            window.webkit.messageHandlers.vibrate.postMessage("");
        } else if (navigator.vibrate) {
            navigator.vibrate(Constants.TIMEOUT_VIBRATION_DURATION);
        }
    };
    outline.element.addEventListener("touchstart", (event: TouchEvent) => {
        const editor = window.siyuan.mobile.editor?.protyle;
        if (window.siyuan.config.readonly || outline.element.getAttribute("data-loading") === "true" ||
            event.touches.length !== 1 || !editor || editor.disabled || editor.block.rootID !== outline.blockId) {
            return;
        }
        const touch = event.touches[0];
        const liElement = hasClosestByClassName(touch.target as HTMLElement, "b3-list-item") as HTMLElement;
        if (!liElement || liElement.tagName !== "LI") {
            return;
        }
        cancelLongPressTimer();
        touchDragState = {
            selectedElement: liElement,
            startX: touch.clientX,
            startY: touch.clientY,
            isDragging: false,
            ghostElement: null,
            startTime: Date.now() - (isMousePointerTouchEvent(event) ? Constants.TIMEOUT_LONGPRESS : 0),
            selectItem: null,
        };
        // 上游 18347：长按后自动进入拖拽（无需移动），并震动反馈
        if (!isMousePointerTouchEvent(event)) {
            const state = touchDragState;
            longPressTimer = window.setTimeout(() => {
                if (touchDragState !== state || state.isDragging) {
                    return;
                }
                state.isDragging = true;
                state.selectedElement.style.opacity = "0.38";
                state.ghostElement = createGhostElement(state.selectedElement, state.startX, state.startY);
                vibrateOutline();
            }, Constants.TIMEOUT_LONGPRESS);
        }
    }, {passive: false});
    outline.element.addEventListener("touchmove", (event: TouchEvent) => {
        const state = touchDragState;
        if (!state) {
            return;
        }
        const touch = event.touches[0];
        if (!state.isDragging) {
            const moved = Math.abs(touch.clientX - state.startX) > Constants.SIZE_DRAG_THRESHOLD ||
                Math.abs(touch.clientY - state.startY) > Constants.SIZE_DRAG_THRESHOLD;
            if (Date.now() - state.startTime < Constants.TIMEOUT_LONGPRESS && moved) {
                cancelLongPressTimer();
                touchDragState = null;
                return;
            }
            if (!moved) {
                return;
            }
            cancelLongPressTimer();
            state.isDragging = true;
            state.selectedElement.style.opacity = "0.38";
            state.ghostElement = createGhostElement(state.selectedElement, touch.clientX, touch.clientY);
            // 非鼠标长按拖拽需震动（上游 18347）
            if (!isMousePointerTouchEvent(event)) {
                vibrateOutline();
            }
        }
        event.preventDefault();
        event.stopPropagation();
        const ghostElement = state.ghostElement;
        if (!ghostElement) {
            throw new Error("Outline drag state is missing its ghost element");
        }
        ghostElement.style.top = `${touch.clientY}px`;
        ghostElement.style.left = `${touch.clientX}px`;
        dragOverScroll({clientY: touch.clientY} as MouseEvent, scrollElement.getBoundingClientRect(), scrollElement);
        markDropTarget(outline, state, touch);
    }, {passive: false});
    outline.element.addEventListener("touchend", () => {
        const state = touchDragState;
        if (!state) {
            return;
        }
        cancelLongPressTimer();
        stopScrollAnimation();
        state.selectedElement.style.opacity = "";
        state.ghostElement?.remove();
        if (state.isDragging) {
            moveOutlineItem(outline, state);
            clearDragIndicators(outline);
        }
        touchDragState = null;
    });
    outline.element.addEventListener("touchcancel", () => {
        cancelLongPressTimer();
        stopScrollAnimation();
        touchDragState?.ghostElement?.remove();
        if (touchDragState?.selectedElement) {
            touchDragState.selectedElement.style.opacity = "";
        }
        clearDragIndicators(outline);
        touchDragState = null;
    });
    // 上游 18347：滚动 / 指针取消 / 失焦时中止拖拽
    const cancelOutlineDrag = () => {
        cancelLongPressTimer();
        stopScrollAnimation();
        touchDragState?.ghostElement?.remove();
        if (touchDragState?.selectedElement) {
            touchDragState.selectedElement.style.opacity = "";
        }
        clearDragIndicators(outline);
        touchDragState = null;
    };
    scrollElement.addEventListener("scroll", () => {
        if (touchDragState && !touchDragState.isDragging) {
            cancelOutlineDrag();
        }
    }, {passive: true});
    outline.element.addEventListener("pointercancel", cancelOutlineDrag);
    window.addEventListener("blur", cancelOutlineDrag);
    bindMousePointerTouchBridge(outline.element);
}
