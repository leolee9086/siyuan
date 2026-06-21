import { IMoveContext } from "./moveTo.types";

const computePreviousID = (context: IMoveContext, prevSibling: Element | null): string | null | undefined => {
    if (context.position === "afterbegin") {
return null;
}
    if (context.position === "afterend") {
return context.targetId;
}
    return prevSibling?.getAttribute("data-node-id");
};

const computeParentID = (context: IMoveContext, parent: Element | null): string | undefined => {
    if (context.position === "afterbegin") {
return context.targetId;
}
    return parent?.getAttribute("data-node-id") || context.protyle.block.parentID || context.protyle.block.rootID;
};

const removeSameElementIfExists = (context: IMoveContext, id: string) => {
    if (context.isSameDoc) {
return;
}
    if (!context.protyle.wysiwyg) {
throw new Error("protyle结构错误");
}

    const sameElement = context.protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`);
    sameElement?.remove();
};

export const handleMoveOperation = (item: Element, id: string, oldSourceParentElement: HTMLElement, context: IMoveContext) => {
    const sourcePosition = context.sourcePositions.get(id) || { previousID: "", parentID: "" };

    context.undoOperations.push({
        action: "move",
        id,
        previousID: sourcePosition.previousID,
        parentID: sourcePosition.parentID,
    });

    removeSameElementIfExists(context, id);

    if (context.newListId) {
        insertMoveIntoNewList(item, id, context);
        return;
    }
    insertMoveElement(item, id, context);
};

const insertMoveIntoNewList = (item: Element, id: string, context: IMoveContext) => {
    if (!context.newListElement) {
throw new Error("List element missing");
}
    context.newListElement.insertAdjacentElement("afterbegin", item);
    context.doOperations.push({
        action: "move",
        id,
        parentID: context.newListId,
    });
};

const insertMoveElement = (item: Element, id: string, context: IMoveContext) => {
    context.tempTargetElement.insertAdjacentElement(context.position, item);
    const prevSibling = item.previousElementSibling;
    const parent = item.parentElement;

    const previousIDOps = computePreviousID(context, prevSibling);
    const parentIDOps = computeParentID(context, parent);

    context.doOperations.push({
        action: "move",
        id,
        previousID: previousIDOps ?? undefined,
        parentID: parentIDOps
    });
    context.newSourceElements.push(item);
};
