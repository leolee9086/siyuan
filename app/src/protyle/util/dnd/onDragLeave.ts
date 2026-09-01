import { IDndState } from "./onDrop.types";
import { cleanupDragIndicators } from "./util";
import { hideDragTip } from "../dragTip";
import { cleanupKanbanGroupDragover } from "./onDragOver";

export const onDragLeave = (protyle: IProtyle, editorElement: HTMLElement, event: DragEvent, state: IDndState) => {
    if (protyle.disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    state.counter--;
    if (state.counter === 0) {
        cleanupKanbanGroupDragover();
        cleanupDragIndicators(editorElement);
        state.dragoverElement = undefined;
        hideDragTip();
    }
};
