import { IMoveContext } from "./moveTo.types";
import {
    cleanupSourceElement,
    finalizeListOrders,
    handleCopyOperation,
    handleMoveOperation,
    handleNewListCreation,
    processCopyFoldHeadingIds,
    updateListAfterOperation
} from "./moveTo.helper";
import { getParentBlock, getPreviousBlockSibling } from "../../wysiwyg/getBlock";
import { findProtyleForElement } from "../../runtime/layout.port";
import { fetchSyncPost } from "../../../util/network/fetch";
import {convertListItemSubtype} from "./moveTo.helper.list";

const captureSourcePositions = async (protyle: IProtyle, sourceElements: Element[]) => {
    const sourcePositions = new Map<string, { previousID: string; parentID: string }>();
    for (const item of sourceElements) {
        const id = item.getAttribute("data-node-id");
        if (!id) {
            continue;
        }
        const parentBlock = getParentBlock(item);
        let parentID = parentBlock?.getAttribute("data-node-id") ?? "";
        if (!parentID) {
            const sourceProtyle = findProtyleForElement(parentBlock, "wysiwyg");
            parentID = sourceProtyle?.block?.rootID || "";
            if (!parentID) {
                const response = await fetchSyncPost("/api/block/getBlockInfo", {id});
                parentID = response?.data?.rootID || "";
            }
        }
        sourcePositions.set(id, {
            previousID: getPreviousBlockSibling(item)?.getAttribute("data-node-id") || "",
            parentID,
        });
    }
    return sourcePositions;
};

export const moveTo = async (protyle: IProtyle, sourceElements: Element[], targetElement: Element,
    isSameDoc: boolean, position: InsertPosition, isCopy: boolean) => {
    // @AIDONE
    const targetId = targetElement.getAttribute("data-node-id");
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    const copyFoldHeadingIds: { newId: string, oldId: string }[] = [];
    const newSourceElements: Element[] = [];

    let isSameLi = true;
    for (const item of sourceElements) {
        if (!item.classList.contains("li") || !targetElement.classList.contains("li")) {
            isSameLi = false;
            break;
        }
    }

    const context: IMoveContext = {
        protyle,
        doOperations,
        undoOperations,
        tempTargetElement: targetElement,
        targetElement,
        targetId,
        isSameLi,
        newListId: "",
        isCopy,
        isSameDoc,
        position,
        newSourceElements,
        copyFoldHeadingIds,
        sourcePositions: await captureSourcePositions(protyle, sourceElements),
    };

    const orderListElements: { [key: string]: Element } = {};

    for (let index = sourceElements.length - 1; index >= 0; index--) {
        const item = sourceElements[index];
        if (!item) {
            throw new Error("拖拽的块元素不存在");
        }
        const id = item.getAttribute("data-node-id");
        if (!id) {
            throw new Error("块元素缺少data-node-id属性");
        }
        const parentElement = item.parentElement;
        if (!parentElement) {
            throw new Error("拖拽的块元素缺少父元素");
        }
        const originalSubtype = item.getAttribute("data-subtype");

        handleNewListCreation(item, context);

        if (context.isCopy) {
            handleCopyOperation(item, id, context);
        } else {
            const oldSourceParentElement = getParentBlock(item);
            if (item.classList.contains("li") && item.getAttribute("data-subtype") === "o") {
                orderListElements[item.parentElement.getAttribute("data-node-id")] = item.parentElement;
            }

            handleMoveOperation(item, id, oldSourceParentElement, context);

            const targetSubtype = context.targetElement.getAttribute("data-subtype");
            if (item.getAttribute("data-type") === "NodeListItem" &&
                context.targetElement.getAttribute("data-type") === "NodeListItem" && targetSubtype &&
                originalSubtype !== targetSubtype) {
                const originalHTML = item.outerHTML;
                convertListItemSubtype(item, targetSubtype);
                context.doOperations.push({action: "update", id, data: item.outerHTML});
                context.undoOperations.push({action: "update", id, data: originalHTML});
            }

            await cleanupSourceElement(item, oldSourceParentElement, context);
        }

        updateListAfterOperation(sourceElements[index - 1], context, originalSubtype);
    }

    finalizeListOrders(orderListElements, doOperations, undoOperations);
    undoOperations.reverse();

    await processCopyFoldHeadingIds(copyFoldHeadingIds, doOperations, undoOperations);

    return {
        doOperations,
        undoOperations,
        newSourceElements
    };
};
