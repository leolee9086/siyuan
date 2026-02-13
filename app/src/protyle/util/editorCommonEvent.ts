// S-forge: 拖拽逻辑已重构拆分到 dnd/ 子模块
import { onDragStart } from "./dnd/onDragStart";
import { IDndState, onDrop } from "./dnd/onDrop";
import { onDragOver } from "./dnd/onDragOver";
import { onDragLeave } from "./dnd/onDragLeave";

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

    editorElement.addEventListener("drop", async (event: DragEvent) => {
        await onDrop(protyle, editorElement, event as DragEvent & { target: HTMLElement }, state);
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
    });
};
