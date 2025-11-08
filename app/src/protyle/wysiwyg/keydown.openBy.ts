import { openLink } from "../../editor/openLink";
import { hasClosestByAttribute } from "../util/hasClosest";
import { matchHotKey } from "../util/hotKey";
/**
 * 打开外部链接或者素材链接
 * @param event 
 * @param protyle 
 * @param nodeElement 
 * @param range 
 * @param controller 
 * @returns 
 */
export const openByMiddleWare = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (matchHotKey(window.siyuan.config.keymap.editor.general.openBy.custom, event)) {

        const aElement = hasClosestByAttribute(range.startContainer, "data-type", "a");
        if (aElement) {
            openLink(protyle, aElement.getAttribute("data-href"), undefined, false);
            event.preventDefault();
            event.stopPropagation();
            controller.abort()
            return;
        }
        const fileElement = hasClosestByAttribute(range.startContainer, "data-type", "file-annotation-ref");
        if (fileElement) {
            const fileIds = fileElement.getAttribute("data-id").split("/");
            const linkAddress = `assets/${fileIds[1]}`;
            openLink(protyle, linkAddress, undefined, false);
            event.preventDefault();
            event.stopPropagation();
            controller.abort()
            return;
        }
        controller.abort()

        return;
    }
}