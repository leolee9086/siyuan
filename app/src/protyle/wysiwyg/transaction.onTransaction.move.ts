import {fetchPost} from "../../util/network/fetch";
import {focusBlock, focusByWbr} from "../util/selection";
import {getContenteditableElement} from "./getBlock";
import {blockRender} from "../render/blockRender";
import {hasClosestBlock, hasTopClosestByAttribute, isInEmbedBlock} from "../util/hasClosest";
import {isMobile} from "../../platform";
import {findProtyleBlockCopies} from "../runtime/layout.port";
import {removeTopElement} from "./transaction/submit";
import {refreshSbs} from "./transaction/refreshSbs";

export const handleMove = (operation: IOperation, protyle: IProtyle, updateElements: Element[], isUndo: boolean): void => {
    if (operation.context?.ignoreProcess === "true") {
        return;
    }
    if (!isMobile && updateElements.length === 0) {
        // 打开两个相同的文档 A、A1，从 A 拖拽块 B 到 A1，在后续 ws 处理中，无法获取到拖拽出去的 B
        findProtyleBlockCopies(operation.id).forEach(copy => {
            updateElements.push(copy.cloneNode(true) as Element);
        });
    }
    // 折叠标题移动到横向超级块的第一个块上后撤销
    if (updateElements.length === 0) {
        const tempEl = document.createElement("div");
        tempEl.setAttribute("data-node-id", operation.id);
        tempEl.setAttribute("data-protyle-id", protyle.element.getAttribute("data-id"));
        updateElements.push(tempEl);
        fetchPost("/api/block/getBlockDOM", {
            id: operation.id,
            notebook: protyle.notebookId,
        }, (response) => {
            document.querySelectorAll(`.protyle-wysiwyg [data-node-id="${response.data.id}"]`).forEach(item => {
                if (item.getAttribute("data-protyle-id")) {
                    item.outerHTML = response.data.dom;
                    item.removeAttribute("data-protyle-id");
                }
            });
        });
    }
    let range;
    if (isUndo && getSelection().rangeCount > 0) {
        range = getSelection().getRangeAt(0);
        const rangeBlockElement = hasClosestBlock(range.startContainer);
        if (rangeBlockElement) {
            if (getContenteditableElement(rangeBlockElement)) {
                range.insertNode(document.createElement("wbr"));
            } else {
                getContenteditableElement(updateElements[0])?.insertAdjacentHTML("afterbegin", "<wbr>");
            }
        }
    }
    const originSbs: Element[] = [];
    updateElements.forEach(item => {
        const sbElement = item.closest('[data-type="NodeSuperBlock"]');
        if (sbElement && !originSbs.includes(sbElement)) {
            originSbs.push(sbElement);
        }
    });
    let hasFind = false;
    if (operation.previousID && updateElements.length > 0) {
        const previousElement = protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.previousID}"]`);
        if (previousElement.length === 0 && protyle.options.backlinkData && isUndo && getSelection().rangeCount > 0) {
            // 反链面板删除超级块中的最后一个段落块后撤销重做
            const blockElement = hasTopClosestByAttribute(range.startContainer, "data-node-id", null);
            if (blockElement) {
                blockElement.before(updateElements[0].cloneNode(true));
                hasFind = true;
            }
        } else {
            previousElement.forEach(item => {
                if (!isInEmbedBlock(item)) {
                    item.after(updateElements[0].cloneNode(true));
                    hasFind = true;
                }
            });
        }
    } else if (updateElements.length > 0) {
        const parentElement = protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.parentID}"]`);
        if (!protyle.options.backlinkData && operation.parentID === protyle.block.parentID && !protyle.block.showAll) {
            protyle.wysiwyg.element.prepend(updateElements[0].cloneNode(true));
            hasFind = true;
        } else if (parentElement.length === 0 && protyle.options.backlinkData && isUndo && getSelection().rangeCount > 0) {
            // 反链面板删除超级块中的段落块后撤销再重做 https://github.com/siyuan-note/siyuan/issues/14496#issuecomment-2771372486
            const topBlockElement = hasTopClosestByAttribute(getSelection().getRangeAt(0).startContainer, "data-node-id", null);
            if (topBlockElement) {
                topBlockElement.before(updateElements[0].cloneNode(true));
                hasFind = true;
            }
        } else {
            parentElement.forEach(item => {
                if (!isInEmbedBlock(item)) {
                    const cloneElement = updateElements[0].cloneNode(true) as Element;
                    // 列表特殊处理
                    if (item.firstElementChild?.classList.contains("protyle-action")) {
                        item.firstElementChild.after(cloneElement);
                    } else if (item.classList.contains("callout")) {
                        item.querySelector(".callout-content").prepend(cloneElement);
                    } else {
                        item.prepend(cloneElement);
                    }
                    hasFind = true;
                }
            });
        }
    }
    updateElements.forEach(item => {
        if (hasFind) {
            item.remove();
        } else if (!hasFind && item.parentElement) {
            removeTopElement(item, protyle);
        }
    });
    refreshSbs(...originSbs);
    if (isUndo && range) {
        if (operation.data === "focus") {
            // 标记需要 focus，https://ld246.com/article/1650018446988/comment/1650081404993?r=Vanessa#comments
            Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`)).find(item => {
                if (!isInEmbedBlock(item)) {
                    focusBlock(item);
                    return true;
                }
            });
            document.querySelectorAll("wbr").forEach(item => {
                item.remove();
            });
        } else {
            focusByWbr(protyle.wysiwyg.element, range);
        }
    }
    protyle.wysiwyg.element.querySelectorAll('[data-type="NodeBlockQueryEmbed"]').forEach((item) => {
        if (item.querySelector(`[data-node-id="${operation.id}"],[data-node-id="${operation.parentID}"],[data-node-id="${operation.previousID}"]`)) {
            item.removeAttribute("data-render");
            blockRender(protyle, item);
        }
    });
    const moveElements = [operation.id, operation.parentID, operation.previousID]
        .map(id => id ? protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`) : null)
        .filter(Boolean) as Element[];
    refreshSbs(...moveElements);
};
