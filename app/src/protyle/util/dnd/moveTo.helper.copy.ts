import { fetchSyncPost } from "../../../util/network/fetch";
import { IMoveContext } from "./moveTo.types";
import { getPreviousBlockSibling } from "../../wysiwyg/getBlock";

export const handleCopyOperation = (item: Element, id: string, context: IMoveContext) => {
    const copyNewId = Lute.NewNodeID();
    if (item.getAttribute("data-type") === "NodeHeading" && item.getAttribute("fold") === "1") {
        context.copyFoldHeadingIds.push({
            newId: copyNewId,
            oldId: id
        });
    }

    context.undoOperations.push({
        action: "delete",
        id: copyNewId,
    });

    const copyElement = item.cloneNode(true) as HTMLElement;
    copyElement.setAttribute("data-node-id", copyNewId);

    const childrenWithId = copyElement.querySelectorAll("[data-node-id]");
    for (const e of childrenWithId) {
        const newId = Lute.NewNodeID();
        const updatedTimestamp = newId.split("-")[0] ?? "";
        e.setAttribute("data-node-id", newId);
        e.setAttribute("updated", updatedTimestamp);
    }

    if (context.newListId) {
        insertCopyIntoNewList(copyElement, copyNewId, context);
        return;
    }
    insertCopyElement(copyElement, copyNewId, context);
};

const insertCopyIntoNewList = (copyElement: HTMLElement, copyNewId: string, context: IMoveContext) => {
    if (!context.newListElement) {
        throw new Error("新列表元素不存在");
    }
    context.newListElement.insertAdjacentElement("afterbegin", copyElement);
    context.doOperations.push({
        action: "insert",
        id: copyNewId,
        data: copyElement.outerHTML,
        parentID: context.newListId,
    });
};

const insertCopyElement = (copyElement: HTMLElement, copyNewId: string, context: IMoveContext) => {
    context.tempTargetElement.insertAdjacentElement(context.position, copyElement);

    // afterbegin 分支：作为子节点插入
    if (context.position === "afterbegin") {
        const parentID = context.targetId || undefined;
        context.doOperations.push({
            action: "insert",
            id: copyNewId,
            data: copyElement.outerHTML,
            previousID: undefined,
            parentID,
        });
        context.newSourceElements.push(copyElement);
        return;
    }

    // 其他分支：作为兄弟节点插入
    const prevSibling = getPreviousBlockSibling(copyElement);
    const previousID = (context.position === "afterend" ? context.targetId : prevSibling?.getAttribute("data-node-id")) || undefined;
    const parent = copyElement.parentElement;
    const parentID = parent?.getAttribute("data-node-id") || context.protyle.block.parentID || context.protyle.block.rootID;

    context.doOperations.push({
        action: "insert",
        id: copyNewId,
        data: copyElement.outerHTML,
        previousID,
        parentID,
    });
    context.newSourceElements.push(copyElement);
};

export const processCopyFoldHeadingIds = async (copyFoldHeadingIds: { newId: string, oldId: string }[], doOperations: IOperation[], undoOperations: IOperation[]) => {
    for (const childrenItem of copyFoldHeadingIds) {
        const responseTransaction = await fetchSyncPost("/api/block/getHeadingInsertTransaction", { id: childrenItem.oldId });
        const transactionDoOperations = responseTransaction.data.doOperations;
        const transactionUndoOperations = responseTransaction.data.undoOperations;
        transactionDoOperations.splice(0, 1);
        const firstDoOperation = transactionDoOperations[0];
        firstDoOperation.previousID = childrenItem.newId;
        transactionUndoOperations.splice(0, 1);
        doOperations.push(...transactionDoOperations);
        undoOperations.push(...transactionUndoOperations);
    }
};
