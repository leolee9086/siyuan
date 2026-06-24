// S-forge: 拖拽逻辑已重构拆分到 dnd/ 子模块。
import { onDragStart } from "./dnd/onDragStart";
import { IDndState } from "./dnd/onDrop.types";
import { onDrop } from "./dnd/onDrop";
import { onDragOver } from "./dnd/onDragOver";
import { onDragLeave } from "./dnd/onDragLeave";
import { cleanupDragIndicators } from "./dnd/util";
import { hideDragTip } from "./dragTip";

export const dropEvent = (protyle: IProtyle, editorElement: HTMLElement) => {
    const state: IDndState = {
        counter: 0,
        dragoverElement: undefined,
        disabledPosition: "",
    };
    editorElement.addEventListener("dragstart", (event) => {
        onDragStart(protyle, event);
    });

    editorElement.addEventListener("drop", async (event: DragEvent) => {
        await onDrop(protyle, editorElement, event as DragEvent & { target: HTMLElement }, state);
        cleanupDragIndicators(document);
    });

    editorElement.addEventListener("dragover", (event: DragEvent) => {
        onDragOver(protyle, editorElement, event as DragEvent & { target: HTMLElement }, state);
    });

    editorElement.addEventListener("dragleave", (event: DragEvent) => {
        onDragLeave(protyle, editorElement, event, state);
    });

    editorElement.addEventListener("dragenter", (event) => {
        event.preventDefault();
        state.counter++;
    });

    editorElement.addEventListener("dragend", () => {
        if (window.siyuan.dragElement) {
            window.siyuan.dragElement.style.opacity = "";
            window.siyuan.dragElement = undefined;
            document.onmousemove = null;
        }
        cleanupDragIndicators(editorElement);
        state.dragoverElement = undefined;
        hideDragTip();
        window.siyuan.dragTitle = "";
    });

    document.addEventListener("dragend", () => {
        cleanupDragIndicators(document);
    }, {once: true});
};
