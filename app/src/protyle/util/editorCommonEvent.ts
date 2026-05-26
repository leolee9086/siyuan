// S-forge: 拖拽逻辑已重构拆分到 dnd/ 子模块
import { onDragStart } from "./dnd/onDragStart";
import { IDndState } from "./dnd/onDrop.types";
import { onDrop } from "./dnd/onDrop";
import { onDragOver } from "./dnd/onDragOver";
import { onDragLeave } from "./dnd/onDragLeave";
import {focusBlock, focusByRange, getRangeByPoint} from "./selection";
import {
    hasClosestBlock,
    hasClosestByAttribute,
    hasClosestByClassName,
    hasClosestByTag,
    hasTopClosestByAttribute,
    isInEmbedBlock
} from "./hasClosest";
import {Constants} from "../../constants";
import {paste} from "./paste";
import {genEmptyElement, genSBElement, insertEmptyBlock} from "../../block/util";
import {cancelSB} from "../../block/util.cancelSB";
import {transaction, turnsIntoOneTransaction} from "../wysiwyg/transaction";
import {getParentBlock, getTopAloneElement} from "../wysiwyg/getBlock";
import {updateListOrder} from "../wysiwyg/list.updateOrder";
import {fetchPost, fetchSyncPost} from "../../util/network/fetch";
import {onGet} from "./onGet";
/// #if !MOBILE
import {getAllEditor} from "../../layout/getAll";
import {updatePanelByEditor} from "../../editor/util";
/// #endif
import {blockRender} from "../render/blockRender";
import {uploadLocalFiles} from "../upload";
import {insertHTML} from "./insertHTML";
import {isBrowser} from "../../util/platform/functions";
import {hideElements} from "../ui/hideElements";
import {insertAttrViewBlockAnimation} from "../render/av/row";
import * as dayjs from "dayjs";
import {zoomOut} from "../../menus/protyle";
/// #if !BROWSER
import {webUtils} from "electron";
import {dragUpload} from "../render/av/asset";
/// #else
import {uploadFiles} from "../upload";
/// #endif
import {addDragFill, getTypeByCellElement} from "../render/av/cell";
import {processClonePHElement} from "../render/util";
import {insertGalleryItemAnimation} from "../render/av/gallery/item";
import {clearSelect} from "./clear";
import {dragoverTab} from "../render/av/view";
import {setFold} from "./blockFold";

// position: afterbegin 为拖拽成超级块; "afterend", "beforebegin" 一般拖拽
const moveTo = async (protyle: IProtyle, sourceElements: Element[], targetElement: Element,
                      isSameDoc: boolean, position: InsertPosition, isCopy: boolean) => {
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    const copyFoldHeadingIds: { newId: string, oldId: string }[] = [];
    const targetId = targetElement.getAttribute("data-node-id");
    const newSourceElements: Element[] = [];
    let tempTargetElement = targetElement;
    let isSameLi = true;
    sourceElements.find(item => {
        if (!item.classList.contains("li") || !targetElement.classList.contains("li") ||
            targetElement.getAttribute("data-subtype") !== item.getAttribute("data-subtype")) {
            isSameLi = false;
            return true;
        }
    });
    let newListElement: Element;
    let newListId: string;
    const orderListElements: { [key: string]: Element } = {};
    for (let index = sourceElements.length - 1; index >= 0; index--) {
        const item = sourceElements[index];
        const id = item.getAttribute("data-node-id");
        const parentID = getParentBlock(item).getAttribute("data-node-id") || protyle.block.parentID || protyle.block.rootID;
        if (item.getAttribute("data-type") === "NodeListItem" && !newListId && !isSameLi) {
            newListId = Lute.NewNodeID();
            newListElement = document.createElement("div");
            newListElement.innerHTML = `<div data-subtype="${item.getAttribute("data-subtype")}" data-node-id="${newListId}" data-type="NodeList" class="list"><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
            newListElement = newListElement.firstElementChild;
            doOperations.push({
                action: "insert",
                data: newListElement.outerHTML,
                id: newListId,
                previousID: position === "afterbegin" ? null : (position === "afterend" ? targetId : tempTargetElement.previousElementSibling?.getAttribute("data-node-id")),
                parentID: position === "afterbegin" ? targetId : (getParentBlock(tempTargetElement)?.getAttribute("data-node-id") || protyle.block.parentID || protyle.block.rootID),
            });
            undoOperations.push({
                action: "delete",
                id: newListId
            });
            tempTargetElement.insertAdjacentElement(position, newListElement);
            newSourceElements.push(newListElement);
        }
        const copyNewId = Lute.NewNodeID();
        if (isCopy && item.getAttribute("data-type") === "NodeHeading" && item.getAttribute("fold") === "1") {
            copyFoldHeadingIds.push({
                newId: copyNewId,
                oldId: id
            });
        }

        let copyElement;
        if (isCopy) {
            undoOperations.push({
                action: "delete",
                id: copyNewId,
            });
        } else {
            undoOperations.push({
                action: "move",
                id,
                previousID: item.previousElementSibling?.getAttribute("data-node-id"),
                parentID,
            });
        }
        if (!isSameDoc && !isCopy) {
            // 打开两个相同的文档
            const sameElement = protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`);
            if (sameElement) {
                sameElement.remove();
            }
        }
        if (isCopy) {
            copyElement = item.cloneNode(true) as HTMLElement;
            copyElement.setAttribute("data-node-id", copyNewId);
            copyElement.querySelectorAll("[data-node-id]").forEach((e) => {
                const newId = Lute.NewNodeID();
                e.setAttribute("data-node-id", newId);
                e.setAttribute("updated", newId.split("-")[0]);
            });
            if (newListId) {
                newListElement.insertAdjacentElement("afterbegin", copyElement);
                doOperations.push({
                    action: "insert",
                    id: copyNewId,
                    data: copyElement.outerHTML,
                    parentID: newListId,
                });
            } else {
                tempTargetElement.insertAdjacentElement(position, copyElement);
                doOperations.push({
                    action: "insert",
                    id: copyNewId,
                    data: copyElement.outerHTML,
                    previousID: position === "afterbegin" ? null : (position === "afterend" ? targetId : copyElement.previousElementSibling?.getAttribute("data-node-id")), // 不能使用常量，移动后会被修改
                    parentID: position === "afterbegin" ? targetId : (getParentBlock(copyElement)?.getAttribute("data-node-id") || protyle.block.parentID || protyle.block.rootID),
                });
                newSourceElements.push(copyElement);
            }
        } else {
            let topSourceElement = getTopAloneElement(item);
            const oldSourceParentElement = getParentBlock(item);
            if (item.classList.contains("li") && item.getAttribute("data-subtype") === "o") {
                orderListElements[item.parentElement.getAttribute("data-node-id")] = item.parentElement;
            }
            if (newListId) {
                newListElement.insertAdjacentElement("afterbegin", item);
                doOperations.push({
                    action: "move",
                    id,
                    parentID: newListId,
                });
            } else {
                tempTargetElement.insertAdjacentElement(position, item);
                doOperations.push({
                    action: "move",
                    id,
                    previousID: position === "afterbegin" ? null : (position === "afterend" ? targetId : item.previousElementSibling?.getAttribute("data-node-id")), // 不能使用常量，移动后会被修改
                    parentID: position === "afterbegin" ? targetId : (getParentBlock(item)?.getAttribute("data-node-id") || protyle.block.parentID || protyle.block.rootID),
                });
                newSourceElements.push(item);
            }

            if (topSourceElement !== item) {
                if (topSourceElement.contains(item)) {
                    topSourceElement = getTopAloneElement(oldSourceParentElement);
                }
                // 拖拽后剩下空元素
                doOperations.push({
                    action: "delete",
                    id: topSourceElement.getAttribute("data-node-id"),
                });
                undoOperations.push({
                    action: "insert",
                    data: topSourceElement.outerHTML,
                    id: topSourceElement.getAttribute("data-node-id"),
                    previousID: topSourceElement.previousElementSibling?.getAttribute("data-node-id"),
                    parentID: getParentBlock(topSourceElement)?.getAttribute("data-node-id") || protyle.block.parentID || protyle.block.rootID
                });
                const topSourceParentElement = topSourceElement.parentElement;
                topSourceElement.remove();
                if (!isSameDoc) {
                    // 打开两个相同的文档
                    const sameElement = protyle.wysiwyg.element.querySelector(`[data-node-id="${topSourceElement.getAttribute("data-node-id")}"]`);
                    if (sameElement) {
                        sameElement.remove();
                    }
                }
                if (topSourceParentElement.classList.contains("sb") && topSourceParentElement.childElementCount === 2) {
                    // 拖拽后，sb 只剩下一个元素
                    if (isSameDoc) {
                        const sbData = await cancelSB(protyle, topSourceParentElement);
                        doOperations.push(sbData.doOperations[0], sbData.doOperations[1]);
                        undoOperations.push(sbData.undoOperations[1], sbData.undoOperations[0]);
                    } else {
                        /// #if !MOBILE
                        const allEditor = getAllEditor();
                        for (let i = 0; i < allEditor.length; i++) {
                            if (allEditor[i].protyle.element.contains(topSourceParentElement)) {
                                const otherSbData = await cancelSB(allEditor[i].protyle, topSourceParentElement);
                                doOperations.push(otherSbData.doOperations[0], otherSbData.doOperations[1]);
                                undoOperations.push(otherSbData.undoOperations[1], otherSbData.undoOperations[0]);
                                // 需清空操作栈，否则撤销到移动出去的块的操作会抛异常
                                allEditor[i].protyle.undo.clear();
                                break;
                            }
                        }
                        /// #endif
                    }
                }
            } else if (oldSourceParentElement.classList.contains("sb") && oldSourceParentElement.childElementCount === 2) {
                // 拖拽后，sb 只剩下一个元素
                if (isSameDoc) {
                    const sbData = await cancelSB(protyle, oldSourceParentElement);
                    doOperations.push(sbData.doOperations[0], sbData.doOperations[1]);
                    undoOperations.push(sbData.undoOperations[1], sbData.undoOperations[0]);
                } else {
                    /// #if !MOBILE
                    const allEditor = getAllEditor();
                    for (let i = 0; i < allEditor.length; i++) {
                        if (allEditor[i].protyle.element.contains(oldSourceParentElement)) {
                            const otherSbData = await cancelSB(allEditor[i].protyle, oldSourceParentElement);
                            doOperations.push(otherSbData.doOperations[0], otherSbData.doOperations[1]);
                            undoOperations.push(otherSbData.undoOperations[1], otherSbData.undoOperations[0]);
                            // 需清空操作栈，否则撤销到移动出去的块的操作会抛异常
                            allEditor[i].protyle.undo.clear();
                            break;
                        }
                    }
                    /// #endif
                }
            } else if (oldSourceParentElement.classList.contains("protyle-wysiwyg") && oldSourceParentElement.childElementCount === 0) {
                /// #if !MOBILE
                // 拖拽后，根文档原内容为空
                getAllEditor().find(item => {
                    if (item.protyle.element.contains(oldSourceParentElement)) {
                        if (!item.protyle.block.showAll) {
                            const newId = Lute.NewNodeID();
                            doOperations.splice(0, 0, {
                                action: "insert",
                                id: newId,
                                data: genEmptyElement(false, false, newId).outerHTML,
                                parentID: item.protyle.block.parentID
                            });
                            undoOperations.splice(0, 0, {
                                action: "delete",
                                id: newId,
                            });
                        } else {
                            zoomOut({protyle: item.protyle, id: item.protyle.block.rootID});
                        }
                        return true;
                    }
                });
                /// #endif
            }
        }

        if (newListId && (index === 0 ||
            sourceElements[index - 1].getAttribute("data-type") !== "NodeListItem" ||
            sourceElements[index - 1].getAttribute("data-subtype") !== item.getAttribute("data-subtype"))
        ) {
            if (position === "beforebegin") {
                tempTargetElement = newListElement;
            }
            newListId = null;
            if (newListElement.getAttribute("data-subtype") === "o" && newListElement.firstElementChild.getAttribute("data-marker") !== "1.") {
                Array.from(newListElement.children).forEach((listItem) => {
                    if (listItem.classList.contains("protyle-attr")) {
                        return;
                    }
                    undoOperations.push({
                        action: "update",
                        id: listItem.getAttribute("data-node-id"),
                        data: listItem.outerHTML
                    });
                });
                updateListOrder(newListElement, 1);
                Array.from(newListElement.children).forEach((listItem) => {
                    if (listItem.classList.contains("protyle-attr")) {
                        return;
                    }
                    doOperations.push({
                        action: "update",
                        id: listItem.getAttribute("data-node-id"),
                        data: listItem.outerHTML
                    });
                });
                updateListOrder(newListElement, 1);
            }
        } else if (position === "beforebegin") {
            tempTargetElement = isCopy ? copyElement : item;
        }
    }
    Object.keys(orderListElements).forEach(key => {
        Array.from(orderListElements[key].children).forEach((item) => {
            if (item.classList.contains("protyle-attr")) {
                return;
            }
            undoOperations.push({
                action: "update",
                id: item.getAttribute("data-node-id"),
                data: item.outerHTML
            });
        });
        updateListOrder(orderListElements[key], 1);
        Array.from(orderListElements[key].children).forEach((item) => {
            if (item.classList.contains("protyle-attr")) {
                return;
            }
            doOperations.push({
                action: "update",
                id: item.getAttribute("data-node-id"),
                data: item.outerHTML
            });
        });
    });
    undoOperations.reverse();
    for (let j = 0; j < copyFoldHeadingIds.length; j++) {
        const childrenItem = copyFoldHeadingIds[j];
        const responseTransaction = await fetchSyncPost("/api/block/getHeadingInsertTransaction", {id: childrenItem.oldId});
        responseTransaction.data.doOperations.splice(0, 1);
        responseTransaction.data.doOperations[0].previousID = childrenItem.newId;
        responseTransaction.data.undoOperations.splice(0, 1);
        doOperations.push(...responseTransaction.data.doOperations);
        undoOperations.push(...responseTransaction.data.undoOperations);
    }
    return {
        doOperations,
        undoOperations,
        newSourceElements
    };
};

const dragSb = async (protyle: IProtyle, sourceElements: Element[], targetElement: Element, isBottom: boolean,
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
        context: {
            removeFold: "true"
        },
        id: targetElement.getAttribute("data-node-id"),
        previousID: targetElement.previousElementSibling?.getAttribute("data-node-id"),
        parentID: getParentBlock(targetElement)?.getAttribute("data-node-id") || protyle.block.parentID || protyle.block.rootID
    };
    const sbElement = genSBElement(direct);
    targetElement.parentElement.replaceChild(sbElement, targetElement);
    const doOperations: IOperation[] = [{
        action: "insert",
        data: sbElement.outerHTML,
        id: sbElement.getAttribute("data-node-id"),
        nextID: sbElement.nextElementSibling?.getAttribute("data-node-id"),
        previousID: sbElement.previousElementSibling?.getAttribute("data-node-id"),
        parentID: getParentBlock(sbElement)?.getAttribute("data-node-id") || protyle.block.parentID || protyle.block.rootID
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
    const foldElements: Element[] = [];
    newSourceParentElement.forEach(item => {
        if (item.getAttribute("data-type") === "NodeHeading" && item.getAttribute("fold") === "1" &&
            item.nextElementSibling && (
                item.nextElementSibling.getAttribute("data-type") !== "NodeHeading" ||
                (item.nextElementSibling.getAttribute("data-subtype") || "") > item.getAttribute("data-subtype")
            )) {
            foldElements.push(item);
        }
    });
    if ((newSourceParentElement.length > 1 || foldElements.length > 0) && direct === "col") {
        const mergeOperations = await turnsIntoOneTransaction({
            protyle,
            selectsElement: newSourceParentElement.reverse(),
            type: "BlocksMergeSuperBlock",
            level: "row",
            unfocus: true,
            getOperations: true
        });
        doOperations.push(...mergeOperations.doOperations);
        undoOperations.splice(0, 0, ...mergeOperations.undoOperations);
    }
    foldElements.forEach(item => {
        const foldOperations = setFold(protyle, item, true, false, false, true);
        doOperations.push(...foldOperations.doOperations);
        undoOperations.splice(0, 0, ...foldOperations.undoOperations);
    });
    if (isSameDoc || isCopy) {
        transaction(protyle, doOperations, undoOperations);
    } else {
        // 跨文档或插入折叠标题下不支持撤销
        transaction(protyle, doOperations);
    }
    if (document.contains(sourceElements[0])) {
        focusBlock(sourceElements[0]);
    } else {
        focusBlock(targetElement);
    }
};

const dragSame = async (protyle: IProtyle, sourceElements: Element[], targetElement: Element, isBottom: boolean, isCopy: boolean) => {
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
            level: "row",
            unfocus: true,
        });
    }
    if (document.contains(sourceElements[0])) {
        focusBlock(sourceElements[0]);
    } else {
        focusBlock(targetElement);
    }
};

/**
 * @AIDONE 此文件过长且存在多处lint问题,应该被拆分并修正
 * @param protyle 
 * @param editorElement 
 */
export const dropEvent = (protyle: IProtyle, editorElement: HTMLElement) => {
    const state: IDndState = {
        counter: 0,
        dragoverElement: undefined,
        disabledPosition: "",
    };
    editorElement.addEventListener("dragstart", (event) => {
        onDragStart(protyle, event);
    });

    editorElement.addEventListener("drop", async (event: DragEvent) => {
        await onDrop(protyle, editorElement, event as DragEvent & { target: HTMLElement }, state);
    });


    editorElement.addEventListener("dragover", (event: DragEvent) => {
        onDragOver(protyle, editorElement, event as DragEvent & { target: HTMLElement }, state);
    });

    editorElement.addEventListener("dragleave", (event: DragEvent) => {
        onDragLeave(protyle, editorElement, event, state);
    });

    editorElement.addEventListener("dragenter", (event) => {
        event.preventDefault();
        state.counter++;
    });

    editorElement.addEventListener("dragend", () => {
        if (window.siyuan.dragElement) {
            window.siyuan.dragElement.style.opacity = "";
            window.siyuan.dragElement = undefined;
            document.onmousemove = null;
        }
    });
};
