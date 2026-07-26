import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { writeText } from "../util/compatibility";
import { matchHotKey } from "../util/hotKey";
import { focusByRange, getEditorRange } from "../util/selection";
import {getContentByInlineHTML} from "./keydown/content/getContentByInlineHTML";
export const copyTextMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    const selectText = range.toString();
    if (matchHotKey(getSiyuanConfig().keymap.editor.general.copyText.custom, event)) {
        // 用于标识复制文本 *
        if (selectText !== "") {
            // 和复制块引用保持一致 https://github.com/siyuan-note/siyuan/issues/9093
            getContentByInlineHTML(range, (content) => {
                writeText(`${content.trim()} ((${nodeElement.getAttribute("data-node-id")} "*"))`);
            });
        } else {
            const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
            if (selectElements.length > 0) {
                selectElements[0].setAttribute("data-reftext", "true");
                focusByRange(getEditorRange(nodeElement));
                document.execCommand("copy");
            } else {
                writeText(`((${nodeElement.getAttribute("data-node-id")} "*"))`);
            }
        }
        event.preventDefault();
        event.stopPropagation();
        controller.abort("复制为引用文本");
        return true;
    }
};
