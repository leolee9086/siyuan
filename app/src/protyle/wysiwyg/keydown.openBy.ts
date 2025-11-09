import { openLink } from "../../editor/openLink";
import { openBy } from "../../editor/utils.openBy";
import { isLocalPath } from "../../util/pathName";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig";
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
    if (matchHotKey(getSiyuanConfig().keymap.editor.general.openBy.custom, event)) {

        const aElement = hasClosestByAttribute(range.startContainer, "data-type", "a");
        if (aElement) {
            const href = aElement.getAttribute("data-href");
            if (href) {
                openLink(protyle, href, undefined, false);
                event.preventDefault();
                event.stopPropagation();
                controller.abort("已打开链接")
                return;
            }
        }
        const fileElement = hasClosestByAttribute(range.startContainer, "data-type", "file-annotation-ref");
        if (fileElement) {
            const fileId = fileElement.getAttribute("data-id");
            if (fileId) {
                const fileIds = fileId.split("/");
                const linkAddress = `assets/${fileIds[1]}`;
                openLink(protyle, linkAddress, undefined, false);
                event.preventDefault();
                event.stopPropagation();
                controller.abort("已打开文件引用")
                return;
            }
        }
        controller.abort("未找到可打开的链接或文件")

        return;
    }
}



export const openLocalMiddleWare = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    /// #if !BROWSER
    if (matchHotKey(window.siyuan.config.keymap.editor.general.showInFolder.custom, event)) {
        const aElement = hasClosestByAttribute(range.startContainer, "data-type", "a");
        if (aElement) {
            const linkAddress = aElement.getAttribute("data-href");
            if (isLocalPath(linkAddress)) {
                openBy(linkAddress, "folder");
                event.preventDefault();
                event.stopPropagation();
                controller.abort("已打开文件本地文件")
            }
        }
        return;
    }
    /// #endif
}
