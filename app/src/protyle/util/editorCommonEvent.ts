// S-forge: 拖拽逻辑已重构拆分到 dnd/ 子模块。
import { onDragStart } from "./dnd/onDragStart";
import { IDndState } from "./dnd/onDrop.types";
import { onDrop } from "./dnd/onDrop";
import { onDragOver } from "./dnd/onDragOver";
import { onDragLeave } from "./dnd/onDragLeave";
import { cleanupDragIndicators } from "./dnd/util";
import { hideDragTip } from "./dragTip";
import { isDragEventWithHTMLElement } from "./dnd/onDrop.guard";

const handleDragEnd = (state: IDndState, editorElement: HTMLElement) => {
    if (window.siyuan.dragElement) {
        window.siyuan.dragElement.style.opacity = "";
        window.siyuan.dragElement = undefined;
        document.onmousemove = null;
    }
    cleanupDragIndicators(editorElement);
    state.dragoverElement = undefined;
    hideDragTip();
    window.siyuan.dragTitle = "";
};
export const dropEvent = (protyle: IProtyle, editorElement: HTMLElement) => {
    const state: IDndState = {
        counter: 0,
        dragoverElement: undefined,
        disabledPosition: "",
    };
    editorElement.addEventListener("dragstart", (event) => {
        onDragStart(protyle, event);
    });

    // @内联回调
    editorElement.addEventListener("drop", async (event: DragEvent) => {
        if (!isDragEventWithHTMLElement(event)) {
            return;
        }
        try {
            await onDrop(protyle, editorElement, event, state);
        } finally {
            cleanupDragIndicators(document);
            handleDragEnd(state, editorElement);
        }
    });
    // @内联回调
    editorElement.addEventListener("dragover", (event: DragEvent) => {
        if (!isDragEventWithHTMLElement(event)) {
            return;
        }
        onDragOver(protyle, editorElement, event, state);
    });

    editorElement.addEventListener("dragleave", (event: DragEvent) => {
        onDragLeave(protyle, editorElement, event, state);
    });

    editorElement.addEventListener("dragenter", (event) => {
        event.preventDefault();
        state.counter++;
    });

    editorElement.addEventListener("dragend", () => {
        handleDragEnd(state, editorElement);
    });

    document.addEventListener("dragend", () => {
        cleanupDragIndicators(document);
    }, {once: true});
};
