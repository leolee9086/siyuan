import { genEmptyElement } from "../../block/element.factory";
import { getTopAloneElement } from "./getBlock";
import { fetchPost } from "../../util/network/fetch";
import { Constants } from "../../constants";
import { promiseTransaction } from "./transaction.promise";

export const transaction = (protyle: IProtyle, doOperations: IOperation[], undoOperations?: IOperation[],
                            options?: {skipSync?: boolean; callback?: () => void}) => {
    if (doOperations.length === 0) {
        return;
    }
    if (!protyle) {
        fetchPost("/api/transactions", {
            session: Constants.SIYUAN_APPID,
            app: Constants.SIYUAN_APPID,
            transactions: [{
                doOperations
            }]
        }, options?.callback);
        return;
    }
    if (undoOperations) {
        if (window.siyuan.config.fileTree.openFilesUseCurrentTab && protyle.model) {
            protyle.model.headElement.classList.remove("item--unupdate");
        }
        protyle.updated = true;
        protyle.undo.add(doOperations, undoOperations, protyle);
    }
    if (protyle.lite) {
        return;
    }
    promiseTransaction({
        protyle,
        doOperations,
        undoOperations,
        skipSync: options?.skipSync,
        callback: options?.callback,
    });

    doOperations.find(item => {
        if (item.action === "insert") {
            protyle.observerLoad?.disconnect();
            return true;
        }
    });
};

export const removeTopElement = (updateElement: Element, protyle: IProtyle) => {
    // 移动到其他文档中，该块需移除
    // TODO 文档没有打开时，需要通过后台获取 getTopAloneElement
    const topAloneElement = getTopAloneElement(updateElement);
    const doOperations: IOperation[] = [];
    if (topAloneElement !== updateElement) {
        updateElement.remove();
        doOperations.push({
            action: "delete",
            id: topAloneElement.getAttribute("data-node-id")
        });
    }
    topAloneElement.remove();
    if (protyle.wysiwyg.element.childElementCount === 0) {
        if (protyle.block.rootID === protyle.block.id) {
            const newId = Lute.NewNodeID();
            const newElement = genEmptyElement(false, false, newId);
            doOperations.push({
                action: "insert",
                data: newElement.outerHTML,
                id: newId,
                parentID: protyle.block.parentID
            });
            protyle.wysiwyg.element.innerHTML = newElement.outerHTML;
        } else {
            protyle.getInstance().zoomOut({
                id: protyle.block.rootID,
                isPushBack: false,
                focusId: protyle.block.id,
            });
        }
    }
    if (doOperations.length > 0) {
        transaction(protyle, doOperations, []);
    }
};

export { turnsIntoOneTransaction, turnsIntoTransaction, turnsOneInto } from "./transaction.turns";
export { processFold, removeUnfoldRepeatBlock } from "./transaction.fold";
export { onTransaction } from "./transaction.onTransaction";

export const updateTransaction = (protyle: IProtyle, element: Element, oldHTML: string,
                                  undoContext?: Record<string, string>) => {
    const id = element.getAttribute("data-node-id");
    const newHTML = element.outerHTML;
    if (newHTML === oldHTML.replace("<wbr>", "")) {
        return;
    }
    element.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
    transaction(protyle, [{
        id,
        data: newHTML,
        action: "update"
    }], [{
        id,
        data: oldHTML,
        action: "update",
        context: undoContext,
    }]);
};

export const updateBatchTransaction = (nodeElements: Element[], protyle: IProtyle, cb: (e: HTMLElement) => void) => {
    const operations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    nodeElements.forEach((element) => {
        const id = element.getAttribute("data-node-id");
        element.classList.remove("protyle-wysiwyg--select");
        element.removeAttribute("select-start");
        element.removeAttribute("select-end");
        undoOperations.push({
            action: "update",
            id,
            data: element.outerHTML
        });
        cb(element as HTMLElement);
        element.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
        operations.push({
            action: "update",
            id,
            data: element.outerHTML
        });
    });
    transaction(protyle, operations, undoOperations);
};
