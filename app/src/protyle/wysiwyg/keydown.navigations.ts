import { isIncludesHotKey } from "../util/hotKey";
import { getSelectionOffset } from "../util/selection";
import { getContenteditableElement, isEndOfBlock } from "./getBlock";

export const arrowLeftRightMiddleWare = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (event.shiftKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        const selectElements = protyle.wysiwyg?.element.querySelectorAll(".protyle-wysiwyg--select");
        if (selectElements && selectElements.length > 0) {
            event.stopPropagation();
            event.preventDefault();
            controller.abort();
            return
        }

        if (!range.toString()) {
            if (event.key === "ArrowRight" && isEndOfBlock(range) && !isIncludesHotKey("⌥⇧→")) {
                event.preventDefault();
                event.stopPropagation();
                controller.abort();
                return
            }
            const nodeEditableElement = getContenteditableElement(nodeElement);
            if (nodeEditableElement) {
                const position = getSelectionOffset(nodeEditableElement, protyle.wysiwyg?.element, range);
                if (position.start === 0 && event.key === "ArrowLeft" && !isIncludesHotKey("⌥⇧←")) {
                    event.preventDefault();
                    event.stopPropagation();
                    controller.abort();
                    return
                }
            }
        }
    }
}