import {fetchPost} from "./imports";
import { rename, replaceFileName } from "../../editor/rename";
import {openAttr} from "../../menus/commonMenuItem/fileAttr/openAttr";
import { matchHotKey } from "../util/hotKey";
import { getTopAloneElement } from "./getBlock";
import {getContentByInlineHTML} from "./keydown/content/getContentByInlineHTML";
import {updateTransaction} from "./transaction/update";
import { Constants } from "../../constants";
/** 用途：为文档重命名信息请求附加加密 notebook。使用范围：rename 中间件。解耦评估：经目录入口复用唯一参数构造器。 */
import {withEncryptedNotebook} from "./imports";

export const attrMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController

) => {
    const selectText = range.toString();
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
        controller.abort("打开块属性");
        return true;
    }
};

export const renameMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController

) => {
    const selectText =range.toString();
    if (matchHotKey(window.siyuan.config.keymap.editor.general.rename.custom, event) && !protyle.disabled) {
        if (selectText === "") {
            const docInfoParams = withEncryptedNotebook(protyle.notebookId, {id: protyle.block.rootID});
            fetchPost("/api/block/getDocInfo", docInfoParams, (response) => {
                rename({
                    notebookId: protyle.notebookId,
                    path: protyle.path,
                    name: response.data.ial.title,
                    empty: response.data.ial[Constants.CUSTOM_SY_TITLE_EMPTY] === "true",
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
        controller.abort("重命名文档");
        return;
    }
};
