import { genSBElement } from "../../../block/util";
import { focusBlock } from "../selection";
import { moveTo } from "./moveTo";
import { setFold } from "../../util/blockFold";
import { transaction, turnsIntoOneTransaction } from "../../wysiwyg/transaction";

export const dragSb = async (protyle: IProtyle, sourceElements: Element[], targetElement: Element, isBottom: boolean,
    direct: "col" | "row", isCopy: boolean) => {
    const isSameDoc = protyle.element.contains(sourceElements[0]);
    // 把列表块中的唯一一个列表项块拖拽到列表块的左侧 https://github.com/siyuan-note/siyuan/issues/16315
    if (isSameDoc && sourceElements[0].classList.contains("li") && targetElement === sourceElements[0].parentElement &&
        targetElement.childElementCount === sourceElements.length + 1) {
        const outLiElement = sourceElements.find((element) => {
            if (!targetElement.contains(element)) {
                return true;
            }
        });
        if (!outLiElement) {
            return;
        }
    }
    const undoOperations: IOperation[] = [];
    const targetMoveUndo: IOperation = {
        action: "move",
        id: targetElement.getAttribute("data-node-id"),
        previousID: targetElement.previousElementSibling?.getAttribute("data-node-id"),
        parentID: targetElement.parentElement?.getAttribute("data-node-id") || protyle.block.parentID || protyle.block.rootID
    };
    const sbElement = genSBElement(direct);
    targetElement.parentElement.replaceChild(sbElement, targetElement);
    const doOperations: IOperation[] = [{
        action: "insert",
        data: sbElement.outerHTML,
        id: sbElement.getAttribute("data-node-id"),
        nextID: sbElement.nextElementSibling?.getAttribute("data-node-id"),
        previousID: sbElement.previousElementSibling?.getAttribute("data-node-id"),
        parentID: sbElement.parentElement.getAttribute("data-node-id") || protyle.block.parentID || protyle.block.rootID
    }];
    // 临时插入，防止后面计算错误，最终再移动矫正
    sbElement.lastElementChild.before(targetElement);
    const moveToResult = await moveTo(protyle, sourceElements, sbElement, isSameDoc, "afterbegin", isCopy);
    doOperations.push(...moveToResult.doOperations);
    undoOperations.push(...moveToResult.undoOperations);
    const newSourceParentElement = moveToResult.newSourceElements;
    // 横向超级块A内两个元素拖拽成纵向超级块B，取消超级块A会导致 targetElement 被删除，需先移动再删除 https://github.com/siyuan-note/siyuan/issues/16292
    let removeIndex = doOperations.length;
    doOperations.find((item, index) => {
        // 横向超级块A内两个元素拖拽成纵向超级块B，取消超级块A会导致 targetElement 被删除，需先移动再删除 https://github.com/siyuan-note/siyuan/issues/16292
        if (item.action === "delete" && item.id === targetMoveUndo.parentID) {
            removeIndex = index;
        }
        // 超级块内有两个块，拖拽其中一个到超级块外 https://github.com/siyuan-note/siyuan/issues/16292#issuecomment-3523600155
        if (item.action === "delete" && item.id === targetElement.getAttribute("data-node-id")) {
            targetElement = sbElement.querySelector(`[data-node-id="${doOperations[index - 1].id}"]`);
        }
    });

    if (isBottom) {
        // 拖拽到超级块 col 下方， 其他块右侧
        sbElement.insertAdjacentElement("afterbegin", targetElement);
        doOperations.splice(removeIndex, 0, {
            action: "move",
            id: targetElement.getAttribute("data-node-id"),
            parentID: sbElement.getAttribute("data-node-id")
        });
    } else {
        sbElement.lastElementChild.insertAdjacentElement("beforebegin", targetElement);
        doOperations.splice(removeIndex, 0, {
            action: "move",
            id: targetElement.getAttribute("data-node-id"),
            previousID: newSourceParentElement[0].getAttribute("data-node-id"),
        });
    }
    undoOperations.push(targetMoveUndo);
    undoOperations.push({
        action: "delete",
        id: sbElement.getAttribute("data-node-id"),
    });
    let hasFoldHeading = false;
    newSourceParentElement.forEach(item => {
        if (item.getAttribute("data-type") === "NodeHeading" && item.getAttribute("fold") === "1") {
            hasFoldHeading = true;
            if (item.nextElementSibling && (
                item.nextElementSibling.getAttribute("data-type") !== "NodeHeading" ||
                item.nextElementSibling.getAttribute("data-subtype") > item.getAttribute("data-subtype")
            )) {
                const foldOperations = setFold(protyle, item, true, false, false, true);
                doOperations.push(...foldOperations.doOperations);
                // 不折叠，否则无法撤销 undoOperations.push(...foldOperations.undoOperations);
            }
            return true;
        }
    });
    if (isSameDoc || isCopy) {
        transaction(protyle, doOperations, undoOperations);
    } else {
        // 跨文档或插入折叠标题下不支持撤销
        transaction(protyle, doOperations);
    }
    if ((newSourceParentElement.length > 1 || hasFoldHeading) && direct === "col") {
        turnsIntoOneTransaction({
            protyle,
            selectsElement: newSourceParentElement.reverse(),
            type: "BlocksMergeSuperBlock",
            level: "row"
        });
    }
    if (document.contains(sourceElements[0])) {
        focusBlock(sourceElements[0]);
    } else {
        focusBlock(targetElement);
    }
};

export const dragSame = async (protyle: IProtyle, sourceElements: Element[], targetElement: Element, isBottom: boolean, isCopy: boolean) => {
    const isSameDoc = protyle.element.contains(sourceElements[0]);
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];

    const moveToResult = await moveTo(protyle, sourceElements, targetElement, isSameDoc, isBottom ? "afterend" : "beforebegin", isCopy);
    doOperations.push(...moveToResult.doOperations);
    undoOperations.push(...moveToResult.undoOperations);
    const newSourceParentElement = moveToResult.newSourceElements;
    let foldData;
    if (isBottom &&
        targetElement.getAttribute("data-type") === "NodeHeading" &&
        targetElement.getAttribute("fold") === "1") {
        foldData = setFold(protyle, targetElement, true, false, false, true);
    } else if (!isBottom && targetElement.previousElementSibling &&
        targetElement.previousElementSibling.getAttribute("data-type") === "NodeHeading" &&
        targetElement.previousElementSibling.getAttribute("fold") === "1") {
        foldData = setFold(protyle, targetElement.previousElementSibling, true, false, false, true);
    }
    if (foldData) {
        foldData.doOperations[0].context = {
            focusId: sourceElements[0].getAttribute("data-node-id"),
        };
        doOperations.push(...foldData.doOperations);
        undoOperations.push(...foldData.undoOperations);
    }
    if (targetElement.getAttribute("data-type") === "NodeListItem" &&
        targetElement.getAttribute("data-subtype") === "o") {
        // https://github.com/siyuan-note/insider/issues/536
        Array.from(targetElement.parentElement.children).forEach((item) => {
            if (item.classList.contains("protyle-attr")) {
                return;
            }
            undoOperations.splice(0, 0, {
                action: "update",
                id: item.getAttribute("data-node-id"),
                data: item.outerHTML
            });
        });
        updateListOrder(targetElement.parentElement, 1);
        Array.from(targetElement.parentElement.children).forEach((item) => {
            if (item.classList.contains("protyle-attr")) {
                return;
            }
            doOperations.push({
                action: "update",
                id: item.getAttribute("data-node-id"),
                data: item.outerHTML
            });
        });
    }
    let hasFoldHeading = false;
    newSourceParentElement.forEach(item => {
        if (item.getAttribute("data-type") === "NodeHeading" && item.getAttribute("fold") === "1") {
            hasFoldHeading = true;
            if (item.nextElementSibling && (
                item.nextElementSibling.getAttribute("data-type") !== "NodeHeading" ||
                item.nextElementSibling.getAttribute("data-subtype") > item.getAttribute("data-subtype")
            )) {
                const foldOperations = setFold(protyle, item, true, false, false, true);
                doOperations.push(...foldOperations.doOperations);
                // 不折叠，否则无法撤销 undoOperations.push(...foldOperations.undoOperations);
            }
            return true;
        }
    });
    if (isSameDoc || isCopy) {
        transaction(protyle, doOperations, undoOperations);
    } else {
        // 跨文档或插入折叠标题下不支持撤销
        transaction(protyle, doOperations);
    }
    if ((newSourceParentElement.length > 1 || hasFoldHeading) &&
        newSourceParentElement[0].parentElement.classList.contains("sb") &&
        newSourceParentElement[0].parentElement.getAttribute("data-sb-layout") === "col") {
        turnsIntoOneTransaction({
            protyle,
            selectsElement: newSourceParentElement.reverse(),
            type: "BlocksMergeSuperBlock",
            level: "row"
        });
    }
    if (document.contains(sourceElements[0])) {
        focusBlock(sourceElements[0]);
    } else {
        focusBlock(targetElement);
    }
};
