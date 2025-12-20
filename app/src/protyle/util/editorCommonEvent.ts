import { onDragStart } from "./dnd/onDragStart";
import { IDndState, onDrop } from "./dnd/onDrop";
import { onDragOver } from "./dnd/onDragOver";

/**
 * @AIDONE 此文件过长且存在多处lint问题,应该被拆分并修正
 * @param protyle 
 * @param editorElement 
 */
export const dropEvent = (protyle: IProtyle, editorElement: HTMLElement) => {
    const state: IDndState = {
        counter: 0,
        dragoverElement: undefined,
        disabledPosition: "",
    };
    editorElement.addEventListener("dragstart", (event) => {
        onDragStart(protyle, event);
    });

    editorElement.addEventListener("drop", async (event: DragEvent & { target: HTMLElement }) => {
        await onDrop(protyle, editorElement, event, state);
    });

    editorElement.addEventListener("dragover", (event: DragEvent & { target: HTMLElement }) => {
        onDragOver(protyle, editorElement, event, state);
    });

    editorElement.addEventListener("dragleave", (event: DragEvent & { target: HTMLElement }) => {
        if (protyle.disabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        state.counter--;
        if (state.counter === 0) {
            editorElement.querySelectorAll(".dragover__left, .dragover__right, .dragover__bottom, .dragover__top, .dragover").forEach((item: HTMLElement) => {
                item.classList.remove("dragover__top", "dragover__bottom", "dragover__left", "dragover__right", "dragover");
            });
            state.dragoverElement = undefined;
        }
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
    });
};
