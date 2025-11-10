import { fetchPost } from "../../ai/imports";
import { rename, replaceFileName } from "../../editor/rename";
import { openAttr } from "../../menus/commonMenuItem";
import { matchHotKey } from "../util/hotKey";
import { getTopAloneElement } from "./getBlock";
import { getContentByInlineHTML } from "./keydown";
import { updateTransaction } from "./transaction";

export const attrMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController

) => {
    const selectText = range.toString()
    if (matchHotKey(window.siyuan.config.keymap.editor.general.attr.custom, event)) {
        const topElement = getTopAloneElement(nodeElement);
        if (selectText === "") {
            const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
            let actionElement;
            if (selectElements.length === 1) {
                actionElement = selectElements[0];
            } else {
                actionElement = topElement;
            }
            openAttr(actionElement, "bookmark", protyle);
        } else {
            getContentByInlineHTML(range, (content) => {
                const oldHTML = topElement.outerHTML;
                const nameElement = topElement.lastElementChild.querySelector(".protyle-attr--name");
                if (nameElement) {
                    nameElement.innerHTML = `<svg><use xlink:href="#iconN"></use></svg>${content.trim()}`;
                } else {
                    topElement.lastElementChild.insertAdjacentHTML("afterbegin", `<div class="protyle-attr--name"><svg><use xlink:href="#iconN"></use></svg>${content.trim()}</div>`);
                }
                topElement.setAttribute("name", content.trim());
                updateTransaction(protyle, topElement.getAttribute("data-node-id"), topElement.outerHTML, oldHTML);
            });
        }
        event.preventDefault();
        event.stopPropagation();
        controller.abort()
        return true;
    }
}

export const renameMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController

) => {
    const selectText =range.toString()
    if (matchHotKey(window.siyuan.config.keymap.editor.general.rename.custom, event) && !protyle.disabled) {
        if (selectText === "") {
            fetchPost("/api/block/getDocInfo", {
                id: protyle.block.rootID
            }, (response) => {
                rename({
                    notebookId: protyle.notebookId,
                    path: protyle.path,
                    name: response.data.ial.title,
                    range,
                    type: "file",
                });
            });
        } else {
            fetchPost("/api/filetree/renameDoc", {
                notebook: protyle.notebookId,
                path: protyle.path,
                title: replaceFileName(selectText),
            });
        }
        event.preventDefault();
        event.stopPropagation();
        controller.abort()
        return;
    }
}