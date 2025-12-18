
import { Files } from "../Files";

import { onDragStart } from "./dnd.onDragStart";
import { onDragOver } from "./dnd.onDragOver";
import { onDrop } from "./dnd.onDrop";
import { onDragEnd } from "./dnd.onDragEnd";

export const initFilesDrag = (files: Files) => {
    files.element.addEventListener("dragstart", (event: DragEvent) => {
        onDragStart(files, event as DragEvent & { target: HTMLElement });
    });
    files.element.addEventListener("dragend", (event) => {
        onDragEnd(files, event);
    });
    files.element.addEventListener("dragover", (event: any) => {
        onDragOver(files, event);
    });
    let counter = 0;
    // @内联回调
    files.element.addEventListener("dragleave", () => {
        counter--;
        if (counter === 0) {
            const dragOverElements = files.element.querySelectorAll(".dragover, .dragover__bottom, .dragover__top");
            for (const item of Array.from(dragOverElements)) {
                item.classList.remove("dragover", "dragover__bottom", "dragover__top");
            }
        }
    });
    files.element.addEventListener("dragenter", (event) => {
        event.preventDefault();
        counter++;
    });
    files.element.addEventListener("drop", async (event: DragEvent) => {
        counter = 0;
        await onDrop(files, event as DragEvent & { target: HTMLElement });
    });
};
