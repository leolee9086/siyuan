import { Constants } from "../../../constants";
import { updateListOrder } from "../../wysiwyg/list.updateOrder";
import { IMoveContext } from "./moveTo.types";
import { getPreviousBlockSibling } from "../../wysiwyg/getBlock";

/** 将列表项的标记、任务状态和 subtype 原子转换为目标列表类型。 */
/** @同步豁免: 需要绝对同步的DOM访问 - 必须在生成移动事务 HTML 前同步更新列表项 DOM。 */
export const convertListItemSubtype = (listItem: Element, subtype: string) => {
    const actionElement = listItem.querySelector(".protyle-action");
    if (!["u", "o", "t"].includes(subtype)) {
        throw new TypeError(`Unsupported list subtype: ${subtype}`);
    }
    if (!actionElement) {
        throw new Error("List item is missing its protyle action element");
    }
    const definitions = new Map<string, {actionHTML: string; marker: string; task?: string}>([
        ["o", {
            actionHTML: '<div contenteditable="false" draggable="true" class="protyle-action protyle-action--order">1.</div>',
            marker: "1.",
        }],
        ["t", {
            actionHTML: '<div class="protyle-action protyle-action--task" draggable="true"><svg><use xlink:href="#iconUncheck"></use></svg></div>',
            marker: "*",
            task: " ",
        }],
        ["u", {
            actionHTML: '<div class="protyle-action" draggable="true"><svg><use xlink:href="#iconDot"></use></svg></div>',
            marker: "*",
        }],
    ]);
    const definition = definitions.get(subtype);
    if (!definition) {
        throw new Error(`Missing list subtype definition: ${subtype}`);
    }
    actionElement.outerHTML = definition.actionHTML;
    listItem.setAttribute("data-marker", definition.marker);
    listItem.removeAttribute("data-task");
    // 任务列表需要显式未完成状态，其余类型保持无 data-task。
    if (definition.task !== undefined) {
        listItem.setAttribute("data-task", definition.task);
    }
    listItem.setAttribute("data-subtype", subtype);
    listItem.classList.remove("protyle-task--done");
    listItem.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
};

export const handleNewListCreation = (item: Element, context: IMoveContext) => {
    if (item.getAttribute("data-type") !== "NodeListItem" || context.newListId || context.isSameLi) {
        return;
    }

    context.newListId = Lute.NewNodeID();
    context.newListElement = document.createElement("div");
    context.newListElement.innerHTML = `<div data-subtype="${item.getAttribute("data-subtype")}" data-node-id="${context.newListId}" data-type="NodeList" class="list"><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;

    if (context.newListElement.firstElementChild) {
        context.newListElement = context.newListElement.firstElementChild;
    }

    // Flatten logic for IDs
    const previousID = getPreviousIDForNewList(context);
    const parentID = getParentIDForNewList(context);

    context.doOperations.push({
        action: "insert",
        data: context.newListElement.outerHTML,
        id: context.newListId,
        previousID: previousID || undefined,
        parentID: parentID || undefined,
    });
    context.undoOperations.push({
        action: "delete",
        id: context.newListId,
    });
    context.tempTargetElement.insertAdjacentElement(context.position, context.newListElement);
    context.newSourceElements.push(context.newListElement);
};

const getPreviousIDForNewList = (context: IMoveContext): string | null | undefined => {
    if (context.position === "afterbegin") {
        return null;
    }
    if (context.position === "afterend") {
        return context.targetId;
    }
    const prevSibling = getPreviousBlockSibling(context.tempTargetElement);
    return prevSibling?.getAttribute("data-node-id");
};

const getParentIDForNewList = (context: IMoveContext): string | undefined => {
    if (context.position === "afterbegin") {
        return context.targetId;
    }
    const parent = context.tempTargetElement.parentElement;
    return parent?.getAttribute("data-node-id") || context.protyle.block.parentID || context.protyle.block.rootID;
};

export const updateListAfterOperation = (
    prevItem: Element | undefined,
    context: IMoveContext,
    originalSubtype: string | null,
) => {
    const isValidListOp = context.newListId && (!prevItem ||
        prevItem.getAttribute("data-type") !== "NodeListItem" ||
        prevItem.getAttribute("data-subtype") !== originalSubtype);

    if (isValidListOp) {
        handleValidListUpdate(context);
        return;
    }

    const shouldUpdateTempTarget = context.position === "beforebegin" && context.newSourceElements.length > 0;
    if (shouldUpdateTempTarget) {
        const lastMoved = context.newSourceElements[context.newSourceElements.length - 1];
        context.tempTargetElement = lastMoved;
    }
};

const handleValidListUpdate = (context: IMoveContext) => {
    if (context.position === "beforebegin") {
        context.tempTargetElement = context.newListElement!;
    }

    const isOrderedList = context.newListElement && context.newListElement.getAttribute("data-subtype") === "o";
    if (isOrderedList && context.newListElement!.firstElementChild && context.newListElement!.firstElementChild.getAttribute("data-marker") !== "1.") {
        updateListOperations(context.newListElement!, context);
    }

    context.newListId = "";
};

const updateListOperations = (listElement: Element, context: IMoveContext) => {
    const children = Array.from(listElement.children);
    for (const listItem of children) {
        if (listItem.classList.contains("protyle-attr")) {
            continue;
        }
        context.undoOperations.push({
            action: "update",
            id: listItem.getAttribute("data-node-id"),
            data: listItem.outerHTML
        });
    }
    updateListOrder(listElement, 1);

    const updatedChildren = Array.from(listElement.children);
    for (const listItem of updatedChildren) {
        if (listItem.classList.contains("protyle-attr")) {
            continue;
        }
        context.doOperations.push({
            action: "update",
            id: listItem.getAttribute("data-node-id"),
            data: listItem.outerHTML
        });
    }
    updateListOrder(listElement, 1);
};

export const finalizeListOrders = (orderListElements: { [key: string]: Element }, doOperations: IOperation[], undoOperations: IOperation[]) => {
    const keys = Object.keys(orderListElements);
    for (const key of keys) {
        const listElement = orderListElements[key];
        if (!listElement) {
            continue;
        }
        generateUpdateOperations(listElement, undoOperations);

        updateListOrder(listElement, 1);

        generateUpdateOperations(listElement, doOperations);
    }
};

const generateUpdateOperations = (listElement: Element, operations: IOperation[]) => {
    const children = Array.from(listElement.children);
    for (const item of children) {
        if (item.classList.contains("protyle-attr")) {
            continue;
        }
        operations.push({
            action: "update",
            id: item.getAttribute("data-node-id"),
            data: item.outerHTML
        });
    }
};
