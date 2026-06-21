import { zoomOut } from "../../menus/protyleMenus/editorMenu/protyle.zoomOut";
import { genEmptyElement } from "../../block/util";
import { getTopAloneElement } from "./getBlock";
import { fetchPost } from "../../util/network/fetch";
import { Constants } from "../../constants";
import { blockRender } from "../render/blockRender";
import { processFold } from "./transaction.fold";
import { promiseTransaction } from "./transaction.promise";

let transactionsTimeout: number;

export const transaction = (protyle: IProtyle, doOperations: IOperation[], undoOperations?: IOperation[]) => {
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
        });
        return;
    }

    const lastTransaction = window.siyuan.transactions[window.siyuan.transactions.length - 1];
    let needDebounce = false;
    const time = Date.now();
    if (lastTransaction && lastTransaction.doOperations.length === 1 && lastTransaction.doOperations[0].action === "update" &&
        doOperations.length === 1 && doOperations[0].action === "update" &&
        lastTransaction.doOperations[0].id === doOperations[0].id &&
        protyle.transactionTime - time < Constants.TIMEOUT_INPUT) {
        needDebounce = true;
    }
    if (undoOperations) {
        if (window.siyuan.config.fileTree.openFilesUseCurrentTab && protyle.model) {
            protyle.model.headElement.classList.remove("item--unupdate");
        }
        protyle.updated = true;
        if (needDebounce) {
            protyle.undo.replace(doOperations, protyle);
        } else {
            protyle.undo.add(doOperations, undoOperations, protyle);
        }
    }
    if ((doOperations.length === 1 && (
        doOperations[0].action === "unfoldHeading" || doOperations[0].action === "setAttrViewBlockView" ||
        (doOperations[0].action === "setAttrs" && doOperations[0].data.startsWith('{"fold":'))
    )) || (doOperations.length === 2 && doOperations[0].action === "insertAttrViewBlock")) {
        protyle.transactionTime = time + Constants.TIMEOUT_INPUT * 2;
        fetchPost("/api/transactions", {
            session: protyle.id,
            app: Constants.SIYUAN_APPID,
            transactions: [{
                doOperations,
                undoOperations
            }]
        }, (response) => {
            response.data[0].doOperations.forEach((operation: IOperation) => {
                if (operation.action === "unfoldHeading" || operation.action === "foldHeading") {
                    processFold(operation, protyle);
                } else if (operation.action === "setAttrs") {
                    const gutterFoldElement = protyle.gutter.element.querySelector('[data-type="fold"]');
                    if (gutterFoldElement) {
                        gutterFoldElement.removeAttribute("disabled");
                    }
                    protyle.wysiwyg.element.querySelectorAll('[data-type="NodeBlockQueryEmbed"]').forEach((item) => {
                        if (item.querySelector(`[data-node-id="${operation.id}"]`)) {
                            item.removeAttribute("data-render");
                            blockRender(protyle, item);
                        }
                    });
                }
            });
        });
        return;
    }
    window.clearTimeout(transactionsTimeout);
    if (needDebounce) {
        window.siyuan.transactions[window.siyuan.transactions.length - 1].protyle = protyle;
        window.siyuan.transactions[window.siyuan.transactions.length - 1].doOperations = doOperations;
    } else {
        window.siyuan.transactions.push({
            protyle,
            doOperations,
            undoOperations
        });
    }
    protyle.transactionTime = time;
    transactionsTimeout = window.setTimeout(() => {
        promiseTransaction();
    }, Constants.TIMEOUT_INPUT * 2);

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
            zoomOut({
                protyle,
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

export const updateTransaction = (protyle: IProtyle, element: Element, oldHTML: string) => {
    const id = element.getAttribute("data-node-id");
    const newHTML = element.outerHTML;
    if (newHTML === oldHTML) {
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
        action: "update"
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
