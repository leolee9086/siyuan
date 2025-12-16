import { hideElements } from "../ui/hideElements";
import { isNotCtrl } from "../util/compatibility";
import { getContenteditableElement } from "./getBlock";

export const commonInputMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController

) => {
    if (
        event.key !== "PageUp" &&
        event.key !== "PageDown" &&
        event.key !== "Home" &&
        event.key !== "End" &&
        event.key.indexOf("Arrow") === -1 &&
        isNotCtrl(event) &&
        event.key !== "Escape" &&
        !event.shiftKey &&
        !event.altKey &&
        !/^F\d{1,2}$/.test(event.key) &&
        event.key !== "Enter" &&
        event.key !== "Tab" &&
        event.key !== "Backspace" &&
        event.key !== "Delete" &&
        event.key !== "ContextMenu"
    ) {
        event.stopPropagation();
        hideElements(["select"], protyle);
        // https://github.com/siyuan-note/siyuan/issues/14743
        if (nodeElement && getContenteditableElement(nodeElement) &&
            range.endContainer.nodeType === 1 && (range.endContainer as HTMLElement).classList.contains("protyle-attr")) {
            range.collapse(true);
        }
        controller.abort("普通输入处理");
    }
};