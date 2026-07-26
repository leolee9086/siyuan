import {transaction} from "../wysiwyg/transaction/submit";
import {preventScroll} from "../scroll/preventScroll";
import {isInEmbedBlock} from "./hasClosest";
import {scrollCenter} from "../../util/DOM/highlightById";
import {getSbChildBlockCount, getTopAloneElement} from "../wysiwyg/getBlock";
import {applyFoldStateRequest} from "./blockFold/state";

export const setFold = (protyle: IProtyle, nodeElement: Element, isOpen?: boolean,
                        isRemove?: boolean, addLoading = true, getOperations = false) => {
    const result = applyFoldStateRequest({protyle, nodeElement, isOpen, isRemove, addLoading});
    if (!result.doOperations) {
        return result;
    }
    if (!getOperations) {
        transaction(protyle, result.doOperations, result.undoOperations);
    }
    // 折叠后，防止滚动条滚动后调用 get 请求 https://github.com/siyuan-note/siyuan/issues/2248
    preventScroll(protyle);
    return result;
};

const isFoldable = (el: Element) => {
    const type = el.getAttribute("data-type");
    return type === "NodeHeading" ||
        (type === "NodeCallout" && el.querySelector(".callout-content").childElementCount > 1) ||
        ((type === "NodeListItem" || type === "NodeBlockquote") && el.childElementCount > 3) ||
        (type === "NodeSuperBlock" && getSbChildBlockCount(el) > 1);
};

export const foldBlocksRecursively = (protyle: IProtyle, nodeElements: Element[]) => {
    const result: Set<Element> = new Set();
    nodeElements.forEach(element => {
        if (isFoldable(element)) {
            result.add(element);
        }
        element.querySelectorAll("[data-type='NodeHeading'], .li, .bq, .sb, .callout").forEach(child => {
            if (isFoldable(child)) {
                // Skip headings inside list items to avoid "double dot" and gutter icon conflicts
                if (child.getAttribute("data-type") === "NodeHeading" &&
                    child.parentElement?.getAttribute("data-type") === "NodeListItem") {
                    return;
                }
                result.add(child);
            }
        });
        const type = element.getAttribute("data-type");
        if (type === "NodeHeading") {
            const nodeH = parseInt(element.getAttribute("data-subtype").substr(1));
            let nextElement = element.nextElementSibling;
            while (nextElement) {
                const currentH = parseInt(nextElement.getAttribute("data-subtype")?.substr(1));
                if (!nextElement.classList.contains("protyle-attr") && (isNaN(currentH) || currentH > nodeH)) {
                    if (isFoldable(nextElement)) {
                        result.add(nextElement);
                    }
                    nextElement.querySelectorAll("[data-type='NodeHeading'], .li, .bq, .sb, .callout").forEach(child => {
                        if (isFoldable(child)) {
                            // Skip headings inside list items to avoid "double dot" and gutter icon conflicts
                            if (child.getAttribute("data-type") === "NodeHeading" &&
                                child.parentElement?.getAttribute("data-type") === "NodeListItem") {
                                return;
                            }
                            result.add(child);
                        }
                    });
                    nextElement = nextElement.nextElementSibling;
                } else {
                    break;
                }
            }
        }
    });

    const elementsToFold = Array.from(result);
    if (elementsToFold.length === 0) {
        return;
    }

    // Determine target state: if any block is unfolded, we fold all. Otherwise we expand all.
    let isFoldAll = elementsToFold.some(item => item.getAttribute("fold") !== "1");
    if (isFoldAll && nodeElements.length === 1 && nodeElements[0].getAttribute("fold") === "1") {
        isFoldAll = false;
    }
    elementsToFold.sort((a, b) => {
        const position = a.compareDocumentPosition(b);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
            return isFoldAll ? 1 : -1;
        } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
            return isFoldAll ? -1 : 1;
        }
        return 0;
    });

    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    elementsToFold.forEach(element => {
        const hasFold = element.getAttribute("fold") === "1";
        if ((isFoldAll && hasFold) || (!isFoldAll && !hasFold)) {
            return;
        }
        const ops = setFold(protyle, element, !isFoldAll, false, false, true);
        if (ops.doOperations && ops.doOperations.length > 0) {
            doOperations.push(...ops.doOperations);
            undoOperations.push(...ops.undoOperations);
        }
    });

    if (doOperations.length > 0) {
        transaction(protyle, doOperations, undoOperations);
        preventScroll(protyle);
        scrollCenter(protyle, elementsToFold[0]);
    }
};

export const getFoldBlock = (protyle: IProtyle, nodeElement: HTMLElement, cb: (elements: Element[]) => void) => {
    const selectElements = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
    if (selectElements.length > 0) {
        cb(selectElements);
    } else if (nodeElement) {
        if (nodeElement.parentElement.getAttribute("data-type") === "NodeListItem") {
            if (nodeElement.parentElement.childElementCount > 3) {
                cb([nodeElement.parentElement]);
            } else {
                cb([nodeElement]);
            }
        } else if (nodeElement.getAttribute("data-type") === "NodeHeading") {
            cb([nodeElement]);
        } else {
            cb([getTopAloneElement(nodeElement)]);
        }
    }
    return true;
};

export const setFoldById = (data: {
    id: string;
    currentNodeID: string;
}, protyle: IProtyle) => {
    const elements = protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${data.id}"]`);
    for (const item of Array.from(elements)) {
        if (isInEmbedBlock(item)) {
            continue;
        }
        const operations = setFold(protyle, item, true, false, true, true);
        const firstOperation = operations.doOperations?.[0];
        if (firstOperation) {
            firstOperation.context = {focusId: data.currentNodeID};
        }
        transaction(protyle, operations.doOperations, operations.undoOperations);
        break;
    }
};
