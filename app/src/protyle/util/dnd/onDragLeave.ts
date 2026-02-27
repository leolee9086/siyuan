import { IDndState } from "./onDrop.types";

export const onDragLeave = (protyle: IProtyle, editorElement: HTMLElement, event: DragEvent, state: IDndState) => {
    if (protyle.disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    state.counter--;
    if (state.counter === 0) {
        const elements = editorElement.querySelectorAll(".dragover__left, .dragover__right, .dragover__bottom, .dragover__top, .dragover");
        for (const item of elements) {
            item.classList.remove("dragover__top", "dragover__bottom", "dragover__left", "dragover__right", "dragover");
        }
        state.dragoverElement = undefined;
    }
};
