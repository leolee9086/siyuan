import {fetchPost} from "../../util/network/fetch";
import {focusBlock} from "../util/selection";
import {Constants} from "../../constants";
import {blockRender} from "../render/blockRender";
import {contentRendererRegistry} from "../../registry/contentRenderer/ContentRendererRegistry";
import {highlightRender} from "../render/highlightRender";
import {isInEmbedBlock} from "../util/hasClosest";
import {disabledProtyle, onGet} from "../util/onGet";
import {avRender} from "../render/av/render";
import {scrollCenter} from "../../util/DOM/highlightById";
import {refreshSbs} from "./transaction.refreshSbs";

export const removeUnfoldRepeatBlock = (html: string, protyle: IProtyle) => {
    const temp = document.createElement("template");
    temp.innerHTML = html;
    Array.from(temp.content.children).forEach(item => {
        protyle.wysiwyg.element.querySelector(`[data-node-id="${item.getAttribute("data-node-id")}"]`)?.remove();
    });
};

export const processFold = (operation: IOperation, protyle: IProtyle) => {
    if (operation.action === "unfoldHeading" || operation.action === "foldHeading") {
        const gutterFoldElement = protyle.gutter.element.querySelector('[data-type="fold"]');
        if (gutterFoldElement) {
            gutterFoldElement.removeAttribute("disabled");
        }
        if (operation.action === "unfoldHeading") {
            const scrollTop = protyle.contentElement.scrollTop;
            const headingElements = Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`));
            headingElements.forEach(item => {
                const embedElement = isInEmbedBlock(item);
                if (embedElement) {
                    embedElement.removeAttribute("data-render");
                    blockRender(protyle, embedElement);
                    return;
                }
                if (!item.lastElementChild.classList.contains("protyle-attr")) {
                    item.lastElementChild.remove();
                }
                removeUnfoldRepeatBlock(operation.retData, protyle);
                item.insertAdjacentHTML("afterend", operation.retData);
                if (operation.data === "remove") {
                    // https://github.com/siyuan-note/siyuan/issues/2188
                    const selection = getSelection();
                    if (selection.rangeCount > 0 && item.contains(selection.getRangeAt(0).startContainer)) {
                        focusBlock(item.nextElementSibling, undefined, true);
                    }
                    item.remove();
                }
            });
            if (protyle.disabled) {
                disabledProtyle(protyle);
            }
            contentRendererRegistry.renderBatch(protyle.wysiwyg.element);
            highlightRender(protyle.wysiwyg.element);
            avRender(protyle.wysiwyg.element, protyle);
            blockRender(protyle, protyle.wysiwyg.element);
            refreshSbs(...headingElements);
            if (operation.context?.focusId) {
                const focusElement = protyle.wysiwyg.element.querySelector(`[data-node-id="${operation.context.focusId}"]`);
                focusBlock(focusElement);
                scrollCenter(protyle, focusElement);
            } else {
                protyle.contentElement.scrollTop = scrollTop;
                protyle.scroll.lastScrollTop = scrollTop;
            }
            return;
        }
        protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach(item => {
            const embedElement = isInEmbedBlock(item);
            if (embedElement) {
                embedElement.removeAttribute("data-render");
                blockRender(protyle, embedElement);
            }
        });
        refreshSbs(...Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`)));
        // 折叠标题后未触发动态加载 https://github.com/siyuan-note/siyuan/issues/4168
        if (protyle.wysiwyg.element.lastElementChild.getAttribute("data-eof") !== "2" &&
            !protyle.scroll.element.classList.contains("fn__none") &&
            protyle.contentElement.scrollHeight - protyle.contentElement.scrollTop < protyle.contentElement.clientHeight * 2    // https://github.com/siyuan-note/siyuan/issues/7785
        ) {
            fetchPost("/api/filetree/getDoc", {
                id: protyle.wysiwyg.element.lastElementChild.getAttribute("data-node-id"),
                mode: 2,
                size: window.siyuan.config.editor.dynamicLoadBlocks,
            }, getResponse => {
                onGet({
                    data: getResponse,
                    protyle,
                    action: [Constants.CB_GET_APPEND, Constants.CB_GET_UNCHANGEID],
                });
            });
        }
        return;
    }
};
