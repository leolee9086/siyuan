import {focusBlock, focusByWbr, getEditorRange} from "../util/selection";
import {blockRender} from "../render/blockRender";
import {contentRendererRegistry} from "../../registry/contentRenderer/ContentRendererRegistry";
import {highlightRender} from "../render/highlightRender";
import {hasClosestBlock, isInEmbedBlock} from "../util/hasClosest";
import {avRender} from "../render/av/render";
import {refreshSbs} from "./transaction.refreshSbs";

export const handleInsert = (operation: IOperation, protyle: IProtyle, isUndo: boolean): void => {
    if (operation.context?.ignoreProcess === "true") {
        return;
    }
    const cursorElements: Element[] = [];
    const pushCursorElement = (element: Element | null) => {
        if (element) {
            cursorElements.push(element);
        }
    };
    if (operation.previousID) {
        const previousElement = protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.previousID}"]`);
        if (previousElement.length === 0 && isUndo && protyle.wysiwyg.element.childElementCount === 0) {
            // https://github.com/siyuan-note/siyuan/issues/15396 操作后撤销
            protyle.wysiwyg.element.innerHTML = operation.data;
            pushCursorElement(protyle.wysiwyg.element.firstElementChild);
        } else if (previousElement.length === 0 && protyle.options.backlinkData && isUndo && getSelection().rangeCount > 0) {
            // 反链面板删除超级块中的最后一个段落块后撤销
            const blockElement = hasClosestBlock(getSelection().getRangeAt(0).startContainer);
            if (blockElement) {
                blockElement.insertAdjacentHTML("beforebegin", operation.data);
                pushCursorElement(blockElement.previousElementSibling);
            }
        } else {
            previousElement.forEach(item => {
                const embedElement = isInEmbedBlock(item);
                if (embedElement) {
                    // https://github.com/siyuan-note/siyuan/issues/5524
                    embedElement.removeAttribute("data-render");
                    blockRender(protyle, embedElement);
                } else {
                    item.insertAdjacentHTML("afterend", operation.data);
                    pushCursorElement(item.nextElementSibling);
                }
            });
        }
    } else if (operation.nextID) {
        Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.nextID}"]`)).forEach(item => {
            const embedElement = isInEmbedBlock(item);
            if (embedElement) {
                // https://github.com/siyuan-note/siyuan/issues/5524
                embedElement.removeAttribute("data-render");
                blockRender(protyle, embedElement);
            } else {
                item.insertAdjacentHTML("beforebegin", operation.data);
                pushCursorElement(item.previousElementSibling);
            }
        });
    } else {
        const parentElement = protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.parentID}"]`);
        if (!protyle.options.backlinkData && operation.parentID === protyle.block.parentID && !protyle.block.showAll) {
            protyle.wysiwyg.element.insertAdjacentHTML("afterbegin", operation.data);
            pushCursorElement(protyle.wysiwyg.element.firstElementChild);
        } else if (parentElement.length === 0 && protyle.options.backlinkData && isUndo && getSelection().rangeCount > 0) {
            // 反链面板删除超级块中的段落块后撤销
            const blockElement = hasClosestBlock(getSelection().getRangeAt(0).startContainer);
            if (blockElement) {
                blockElement.insertAdjacentHTML("beforebegin", operation.data);
                pushCursorElement(blockElement.previousElementSibling);
            }
        } else {
            parentElement.forEach(item => {
                if (!isInEmbedBlock(item)) {
                    // 列表特殊处理
                    if (item.firstElementChild?.classList.contains("protyle-action")) {
                        item.firstElementChild.insertAdjacentHTML("afterend", operation.data);
                        pushCursorElement(item.firstElementChild.nextElementSibling);
                    } else if (item.classList.contains("callout")) {
                        item.querySelector(".callout-content").insertAdjacentHTML("afterbegin", operation.data);
                        pushCursorElement(item.querySelector("[data-node-id]"));
                    } else {
                        item.insertAdjacentHTML("afterbegin", operation.data);
                        pushCursorElement(item.firstElementChild);
                    }
                }
            });
        }
    }
    // https://github.com/siyuan-note/siyuan/issues/4420
    protyle.wysiwyg.element.querySelectorAll('[data-type="NodeHeading"]').forEach(item => {
        if (item.lastElementChild.getAttribute("spin") === "1") {
            item.lastElementChild.remove();
        }
    });
    if (cursorElements.length === 0) {
        return;
    }
    cursorElements.forEach(item => {
        // https://github.com/siyuan-note/siyuan/issues/16554
        item.querySelector(".protyle-attr--av")?.remove();
        item.removeAttribute("custom-avs");
        item.getAttributeNames().forEach(attr => {
            if (attr.startsWith("custom-sy-av-s-text-")) {
                item.removeAttribute(attr);
            }
        });
        contentRendererRegistry.renderBatch(item);
        highlightRender(item);
        avRender(item, protyle);
        blockRender(protyle, item);
        const wbrElement = item.querySelector("wbr");
        if (isUndo) {
            if (operation.context?.setRange === "true") {
                const range = getEditorRange(item);
                if (wbrElement) {
                    focusByWbr(item, range);
                } else {
                    focusBlock(item);
                }
            }
        } else if (wbrElement) {
            wbrElement.remove();
        }
    });
    protyle.wysiwyg.element.querySelectorAll("[parent-heading]").forEach(item => {
        item.remove();
    });
    refreshSbs(...cursorElements);
};
