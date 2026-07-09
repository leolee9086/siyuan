import { genEmptyElement } from "../../../block/util";
import { cancelSB } from "../../../block/util.cancelSB";
import { getParentBlock, getPreviousBlockSibling, getSbChildBlockCount, getTopAloneElement } from "../../wysiwyg/getBlock";
import { getAllEditor } from "../../../layout/getAll";
import { zoomOut } from "../../../menus/protyleMenus/editorMenu/protyle.zoomOut";
import { isMobile } from "../../../platform";
import { IMoveContext } from "./moveTo.types";

export const cleanupSourceElement = async (item: Element, oldSourceParentElement: HTMLElement, context: IMoveContext) => {
    let topSourceElement = getTopAloneElement(item);

    if (topSourceElement !== item && topSourceElement.contains(item)) {
        topSourceElement = getTopAloneElement(oldSourceParentElement);
        await handleTopSourceElementCleanup(topSourceElement, context);
        return;
    }

    if (oldSourceParentElement.classList.contains("sb") && getSbChildBlockCount(oldSourceParentElement) === 1) {
        await handleCancelSB(oldSourceParentElement, context);
        return;
    }

    if (oldSourceParentElement.classList.contains("protyle-wysiwyg") && oldSourceParentElement.childElementCount === 0) {
        await handleEmptyRoot(oldSourceParentElement, context);
    }
};

const removeSameElementIfNotSameDoc = (context: IMoveContext, element: Element) => {
    if (context.isSameDoc) {
        return;
    }

    const nodeId = element.getAttribute("data-node-id");
    const sameElement = context.protyle.wysiwyg.element.querySelector(`[data-node-id="${nodeId}"]`);
    sameElement?.remove();
};

const handleTopSourceElementCleanup = async (topSourceElement: Element, context: IMoveContext) => {
    const topSourceId = topSourceElement.getAttribute("data-node-id");
    if (!topSourceId) {
        return;
    }

    context.doOperations.push({
        action: "delete",
        id: topSourceId,
    });

    const prevSibling = getPreviousBlockSibling(topSourceElement);
    const parent = getParentBlock(topSourceElement);

    context.undoOperations.push({
        action: "insert",
        data: topSourceElement.outerHTML,
        id: topSourceId,
        previousID: prevSibling?.getAttribute("data-node-id"),
        parentID: parent?.getAttribute("data-node-id") || context.protyle.block.parentID || context.protyle.block.rootID
    });
    const topSourceParentElement = topSourceElement.parentElement;
    topSourceElement.remove();
    removeSameElementIfNotSameDoc(context, topSourceElement);

    const needsCancelSB = topSourceParentElement?.classList.contains("sb") && getSbChildBlockCount(topSourceParentElement) === 1;
    if (needsCancelSB) {
        await handleCancelSB(topSourceParentElement, context);
    }
};

const handleCancelSBSameDoc = async (element: HTMLElement, context: IMoveContext) => {
    const sbData = await cancelSB(context.protyle, element);
    //@AIDONE:变量应该先声明后使用sbData.doOperations[0]等应该有明确而合适的变量名
    // @存疑: 原代码只取了 doOperations[0] 和 [1]，undoOperations[0] 和 [1]
    // cancelSB 返回的结构是: doOperations = [移动子块操作..., 删除超级块操作]
    // 如果超级块有超过2个子块，这里可能会丢失中间的操作，但此处保持原有逻辑不变
    const firstDoOp = sbData.doOperations[0];
    const secondDoOp = sbData.doOperations[1];
    const firstUndoOp = sbData.undoOperations[0];
    const secondUndoOp = sbData.undoOperations[1];
    if (!firstDoOp || !secondDoOp || !firstUndoOp || !secondUndoOp) {
        return;
    }
    context.doOperations.push(firstDoOp, secondDoOp);
    context.undoOperations.push(secondUndoOp, firstUndoOp);
};

const handleCancelSB = async (element: HTMLElement, context: IMoveContext) => {
    if (context.isSameDoc) {
        await handleCancelSBSameDoc(element, context);
        return;
    }
    if (isMobile) {
        return;
    }
    const allEditor = getAllEditor();
    for (const editor of allEditor) {
        if (!editor.protyle.element.contains(element)) {
            continue;
        }

        const otherSbData = await cancelSB(editor.protyle, element);
        // @存疑: 同上，只取了前两个操作，可能丢失多子块场景的操作
        const firstOtherDoOp = otherSbData.doOperations[0];
        const secondOtherDoOp = otherSbData.doOperations[1];
        const firstOtherUndoOp = otherSbData.undoOperations[0];
        const secondOtherUndoOp = otherSbData.undoOperations[1];
        if (!firstOtherDoOp || !secondOtherDoOp || !firstOtherUndoOp || !secondOtherUndoOp) {
            continue;
        }
        context.doOperations.push(firstOtherDoOp, secondOtherDoOp);
        context.undoOperations.push(secondOtherUndoOp, firstOtherUndoOp);
        break;
    }
};

const handleEmptyRoot = async (element: HTMLElement, context: IMoveContext) => {
    if (isMobile) {
        return;
    }
    const allEditor = getAllEditor();
    for (const item of allEditor) {
        if (!item.protyle.element.contains(element)) {
            continue;
        }

        if (item.protyle.block.showAll) {
            zoomOut({ protyle: item.protyle, id: item.protyle.block.rootID });
            break;
        }

        const newId = Lute.NewNodeID();
        context.doOperations.splice(0, 0, {
            action: "insert",
            id: newId,
            data: genEmptyElement(false, false, newId).outerHTML,
            parentID: item.protyle.block.parentID
        });
        context.undoOperations.splice(0, 0, {
            action: "delete",
            id: newId,
        });
        break;
    }
};
