import {fetchPost} from "../../util/network/fetch";
import {focusByWbr} from "../util/selection";
import {Constants} from "../../constants";
import {contentRendererRegistry} from "../../registry/contentRenderer/ContentRendererRegistry";
import {highlightRender} from "../render/highlightRender";
import {hasClosestByAttribute, hasTopClosestByAttribute, isInEmbedBlock} from "../util/hasClosest";
import {getAVLocateRenderer} from "../render/av/locate/renderer.port";
import {getTransactionTransformVisualEffects} from "./transaction/transformVisual/port";
import {genEmptyElement} from "../../block/element.factory";
import {hideElements} from "../ui/hideElements";
import {countBlockWord} from "../runtime/status.port";
import {
    getEmbedChildOperationContext,
    getFirstBlock,
    getNextBlockSibling,
    getPreviousBlockSibling,
} from "./getBlock";
import {processFold, syncFoldAndStyleAttrs} from "./transaction.fold";
import {refreshSbs} from "./transaction/refreshSbs";
import {queueTransaction} from "../util/transactionQueue";
import {disconnectInsertObserver} from "./transaction/insertObserver";
import {removeTopElementAndCollectOperations} from "./transaction/removeTopElement";
import {markTransactionSyncPending} from "./transaction/lifecycle/syncIndicator";

/** 在当前非 lite 事务内执行无 undo 的后续操作。 */
const executeNestedTransaction = (protyle: IProtyle, doOperations: IOperation[]) => {
    if (doOperations.length === 0) {
        return;
    }
    promiseTransaction({
        protyle,
        doOperations,
        skipSync: false,
    });
    disconnectInsertObserver(protyle, doOperations);
};

// 用于执行操作，外加处理当前编辑器中块引用、嵌入块的更新
export const promiseTransaction = (options: {
    protyle: IProtyle,
    doOperations: IOperation[],
    undoOperations?: IOperation[],
    skipSync: boolean,
    callback?: () => void,
}) => {
    const protyle = options.protyle;
    // 受影响的嵌入块需推迟到事务提交后再渲染，否则其查询请求会早于写入到达内核而拿到旧数据
    const pendingEmbedElements = new Set<Element>();
    markTransactionSyncPending();
    let range: Range;
    if (getSelection().rangeCount > 0) {
        range = getSelection().getRangeAt(0);
    }
    const isEmbedChildOperation = !!(range && getEmbedChildOperationContext(range.startContainer));
    if (!options.skipSync) {
        options.doOperations.forEach((operation: IOperation) => {
            if (operation.action === "update") {
                // 当前编辑器中的其他块
                let updatedEmbed = false;

                const updateElements = Array.from(
                    protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`)
                );
                // updateTransaction 会在本地编辑元素上设置该属性，用于在存在同 ID 副本时保留当前 DOM 和光标。
                const currentUpdateElement = updateElements.find(item =>
                    item.getAttribute(Constants.ATTRIBUTE_EDITING) === "true" && getEmbedChildOperationContext(item));
                const currentEmbedContext = currentUpdateElement && getEmbedChildOperationContext(currentUpdateElement);
                const currentEmbedElement = currentEmbedContext && isInEmbedBlock(currentUpdateElement, false);

                const updateHTML = (item: Element, html: string, force = false) => {
                    if (!force && item.getAttribute(Constants.ATTRIBUTE_EDITING) === "true") {
                        item.removeAttribute(Constants.ATTRIBUTE_EDITING);
                        return;
                    }
                    const tempElement = document.createElement("template");
                    tempElement.innerHTML = html;
                    tempElement.content.querySelectorAll(".protyle-wysiwyg--select").forEach(selectItem => {
                        selectItem.classList.remove("protyle-wysiwyg--select");
                    });
                    const wbrElement = tempElement.content.querySelector("wbr");
                    if (wbrElement) {
                        wbrElement.remove();
                    }
                    item.outerHTML = tempElement.innerHTML;
                    updatedEmbed = true;
                };

                const allTempElement = document.createElement("template");
                allTempElement.innerHTML = operation.data;
                updateElements.forEach((item) => {
                    if ((currentEmbedElement && isInEmbedBlock(item, false) === currentEmbedElement) ||
                        (range && (item === range.startContainer || item.contains(range.startContainer)))) {
                        // 正在编辑的块不能进行更新
                        item.removeAttribute(Constants.ATTRIBUTE_EDITING);
                    } else {
                        // 从可编辑嵌入块发起更新时，同 ID 的普通副本可能带有其他事务遗留的编辑标记，仍需同步。
                        updateHTML(item, operation.data, !!currentEmbedElement && !isInEmbedBlock(item));
                    }
                });
                protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg__embed").forEach(item => {
                    if (item === currentEmbedContext?.resultElement ||
                        (range && (item === range.startContainer || item.contains(range.startContainer)))) {
                        // 正在编辑的块不能进行更新
                        item.removeAttribute(Constants.ATTRIBUTE_EDITING);
                    } else {
                        // https://github.com/siyuan-note/siyuan/issues/14495
                        const newTempElement = allTempElement.content.querySelector(`[data-node-id="${item.getAttribute("data-id")}"]`);
                        if (newTempElement && !isInEmbedBlock(newTempElement)) {
                            updateHTML(item.querySelector("[data-node-id]"), newTempElement.outerHTML);
                        } else {
                            item.removeAttribute(Constants.ATTRIBUTE_EDITING);
                        }
                    }
                });
                if (updatedEmbed) {
                    contentRendererRegistry.renderBatch(protyle.wysiwyg.element);
                    highlightRender(protyle.wysiwyg.element);
                    getAVLocateRenderer()(protyle.wysiwyg.element, protyle);
                }
                return;
            }
            if (operation.action === "delete" || operation.action === "append") {
                // 普通编辑流程自行维护本地 DOM；仅嵌入块编辑需要额外删除外层同 ID 副本。
                if ((operation.action === "delete" && isEmbedChildOperation) || protyle.options.backlinkData) {
                    Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`)).forEach(item => {
                        if (!isInEmbedBlock(item) && (!range || !item.contains(range.startContainer))) {
                            item.remove();
                        }
                    });
                }
                // 更新嵌入块
                protyle.wysiwyg.element.querySelectorAll('[data-type="NodeBlockQueryEmbed"]').forEach((item) => {
                    if (item.querySelector(`[data-node-id="${operation.id}"]`)) {
                        pendingEmbedElements.add(item);
                    }
                });
                hideElements(["gutter"], protyle);
                return;
            }
            if (operation.action === "move") {
                if (protyle.options.backlinkData) {
                    const updateElements: Element[] = [];
                    Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`)).forEach(item => {
                        if (!isInEmbedBlock(item)) {
                            const topElement = hasTopClosestByAttribute(item, "data-node-id", null);
                            if (topElement && !topElement.contains(range.startContainer)) {
                                // 当前操作块不再进行操作，否则光标丢失 https://github.com/siyuan-note/siyuan/issues/13946
                                updateElements.push(item);
                            }
                        }
                    });
                    // 移动前记录源块所在的超级块，移动后刷新其拖拽手柄（移出后手柄需清理）
                    const originSbs: Element[] = [];
                    updateElements.forEach(item => {
                        const sb = item.closest('[data-type="NodeSuperBlock"]');
                        if (sb && !originSbs.includes(sb)) {
                            originSbs.push(sb);
                        }
                    });
                    let hasFind = false;
                    if (operation.previousID && updateElements.length > 0) {
                        Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.previousID}"]`)).forEach(item => {
                            if (!isInEmbedBlock(item) && !getNextBlockSibling(item)?.contains(range.startContainer)) {
                                item.after(updateElements[0].cloneNode(true));
                                hasFind = true;
                            }
                        });
                    } else if (updateElements.length > 0) {
                        Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.parentID}"]`)).forEach(item => {
                            if (!isInEmbedBlock(item) && !getFirstBlock(item).contains(range.startContainer)) {
                                const cloneElement = updateElements[0].cloneNode(true) as Element;
                                // 列表特殊处理
                                if (item.firstElementChild?.classList.contains("protyle-action")) {
                                    item.firstElementChild.after(cloneElement);
                                } else if (item.classList.contains("callout")) {
                                    item.querySelector(".callout-content").prepend(cloneElement);
                                } else {
                                    item.prepend(cloneElement);
                                }
                                hasFind = true;
                            }
                        });
                    }
                    updateElements.forEach(item => {
                        if (hasFind) {
                            item.remove();
                        } else if (!hasFind && item.parentElement) {
                            const followUpOperations = removeTopElementAndCollectOperations(item, protyle);
                            executeNestedTransaction(protyle, followUpOperations);
                        }
                    });
                    // 块移出后刷新源超级块的手柄（originSb 在元素被移除前捕获）
                    refreshSbs(...originSbs);
                }
                // 更新嵌入块
                protyle.wysiwyg.element.querySelectorAll('[data-type="NodeBlockQueryEmbed"]').forEach((item) => {
                    if (item.querySelector(`[data-node-id="${operation.id}"],[data-node-id="${operation.parentID}"],[data-node-id="${operation.previousID}"]`)) {
                        pendingEmbedElements.add(item);
                    }
                });
                // 移动块（含撤销移动）后刷新相关超级块的拖拽手柄，避免手柄残留/缺失
                const moveEls = [operation.id, operation.parentID, operation.previousID]
                    .map(id => id ? protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`) : null)
                    .filter(Boolean) as Element[];
                refreshSbs(...moveEls);
                return;
            }
            if (operation.action === "insert") {
                // 块已被本地 DOM 操作插入时仍需同步其他普通副本，并跳过当前副本避免重复
                // https://github.com/siyuan-note/siyuan/issues/17890
                const insertedElements = Array.from(
                    protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`)
                );
                const insertedElement = insertedElements[0];
                const currentEmbedElement = insertedElement && isInEmbedBlock(insertedElement, false);
                if (insertedElement) {
                    protyle.wysiwyg.element.querySelectorAll("[data-type=\"NodeBlockQueryEmbed\"]").forEach(item => {
                        if (item !== currentEmbedElement && containsOperationAnchor(item, operation)) {
                            pendingEmbedElements.add(item);
                        }
                    });
                    getDocumentEmbedResults(protyle.wysiwyg.element, operation.parentID).forEach(item => {
                        const embedElement = isInEmbedBlock(item, false);
                        if (embedElement && embedElement !== currentEmbedElement) {
                            pendingEmbedElements.add(embedElement);
                        }
                    });
                }
                const cursorElements: Element[] = [];
                if (operation.previousID) {
                    Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.previousID}"]`)).forEach(item => {
                        const embedElement = isInEmbedBlock(item, false);
                        if (embedElement) {
                            if (embedElement !== currentEmbedElement) {
                                pendingEmbedElements.add(embedElement);
                            }
                            return;
                        }
                        const hasInsertedSibling = insertedElements.some(insertedItem =>
                            !isInEmbedBlock(insertedItem, false) && insertedItem.parentElement === item.parentElement);
                        if (!hasInsertedSibling &&
                            getNextBlockSibling(item)?.getAttribute("data-node-id") !== operation.id &&
                            (!range || !item.contains(range.startContainer)) && // 当前操作块不再进行操作
                            // 段落转列表会在段落后插入新列表
                            !hasClosestByAttribute(item, "data-node-id", operation.id) &&
                            // 嵌入块后不能插入
                            !item.parentElement.classList.contains("protyle-wysiwyg__embed")) {
                            item.insertAdjacentHTML("afterend", operation.data);
                            cursorElements.push(item.nextElementSibling);
                        }
                    });
                } else if (operation.nextID) {
                    Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.nextID}"]`)).forEach(item => {
                        const embedElement = isInEmbedBlock(item, false);
                        if (embedElement) {
                            if (embedElement !== currentEmbedElement) {
                                pendingEmbedElements.add(embedElement);
                            }
                            return;
                        }
                        const hasInsertedSibling = insertedElements.some(insertedItem =>
                            !isInEmbedBlock(insertedItem, false) && insertedItem.parentElement === item.parentElement);
                        if (!hasInsertedSibling &&
                            getPreviousBlockSibling(item)?.getAttribute("data-node-id") !== operation.id &&
                            (!range || !item.contains(range.startContainer)) &&
                            !hasClosestByAttribute(item, "data-node-id", operation.id) &&
                            !item.parentElement.classList.contains("protyle-wysiwyg__embed")) {
                            item.insertAdjacentHTML("beforebegin", operation.data);
                            cursorElements.push(item.previousElementSibling);
                        }
                    });
                } else {
                    Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.parentID}"]`)).forEach(item => {
                        const embedElement = isInEmbedBlock(item, false);
                        if (embedElement) {
                            if (embedElement !== currentEmbedElement) {
                                pendingEmbedElements.add(embedElement);
                            }
                            return;
                        }
                        if (item.querySelector(`[data-node-id="${operation.id}"]`)) {
                            return;
                        }
                        if (!range || !item.contains(range.startContainer)) {
                            // 列表特殊处理
                            if (item.firstElementChild && item.firstElementChild.classList.contains("protyle-action") &&
                                item.firstElementChild.nextElementSibling?.getAttribute("data-node-id") !== operation.id) {
                                item.firstElementChild.insertAdjacentHTML("afterend", operation.data);
                                cursorElements.push(item.firstElementChild.nextElementSibling);
                            } else if (item.classList.contains("callout") &&
                                item.querySelector("[data-node-id]")?.getAttribute("data-node-id") !== operation.id) {
                                item.querySelector(".callout-content").insertAdjacentHTML("afterbegin", operation.data);
                                cursorElements.push(item.querySelector("[data-node-id]"));
                            } else if (item.firstElementChild.getAttribute("data-node-id") !== operation.id) {
                                item.insertAdjacentHTML("afterbegin", operation.data);
                                cursorElements.push(item.firstElementChild);
                            }
                        }
                    });
                    getDocumentEmbedResults(protyle.wysiwyg.element, operation.parentID).forEach(item => {
                        const embedElement = isInEmbedBlock(item, false);
                        if (embedElement && embedElement !== currentEmbedElement) {
                            pendingEmbedElements.add(embedElement);
                        }
                    });
                }
                // https://github.com/siyuan-note/siyuan/issues/4420
                protyle.wysiwyg.element.querySelectorAll('[data-type="NodeHeading"]').forEach(item => {
                    if (item.lastElementChild.getAttribute("spin") === "1") {
                        item.lastElementChild.remove();
                    }
                });
                cursorElements.forEach(item => {
                    contentRendererRegistry.renderBatch(item);
                    highlightRender(item);
                    getAVLocateRenderer()(item, protyle);
                    getTransactionTransformVisualEffects().renderBlock(protyle, item);
                    item.querySelectorAll("wbr").forEach(wbrItem => {
                        wbrItem.remove();
                    });
                });
                protyle.wysiwyg.element.querySelectorAll("[parent-heading]").forEach(item => {
                    item.remove();
                });
                // 插入块后刷新所在超级块的拖拽手柄（本地新块已在 DOM 跳过插入时也需刷新）
                const insertedEl = protyle.wysiwyg.element.querySelector(`[data-node-id="${operation.id}"]`);
                refreshSbs(insertedEl);
                return;
            }
            if (operation.action === "setAttrs") {
                syncFoldAndStyleAttrs(protyle.wysiwyg.element, operation);
                const gutterFoldElement = protyle.gutter.element.querySelector('[data-type="fold"]');
                if (gutterFoldElement) {
                    gutterFoldElement.removeAttribute("disabled");
                }
                // 仅在 alt+click 箭头折叠时才会触发
                protyle.wysiwyg.element.querySelectorAll('[data-type="NodeBlockQueryEmbed"]').forEach((item) => {
                    if (item.querySelector(`[data-node-id="${operation.id}"]`)) {
                        pendingEmbedElements.add(item);
                    }
                });
            }
        });
        // 删除仅有的折叠标题后展开内容为空
        if (protyle.wysiwyg.element.childElementCount === 0 &&
            // 聚焦时不需要新增块，否则会导致 https://github.com/siyuan-note/siyuan/issues/12326 第一点
            !protyle.block.showAll) {
            const newID = Lute.NewNodeID();
            const emptyElement = genEmptyElement(false, true, newID);
            protyle.wysiwyg.element.insertAdjacentElement("afterbegin", emptyElement);
            const insertOperations: IOperation[] = [{
                action: "insert",
                data: emptyElement.outerHTML,
                id: newID,
                parentID: protyle.block.parentID
            }];
            executeNestedTransaction(protyle, insertOperations);
            // 不能撤销，否则就无限循环了
            focusByWbr(emptyElement, range);
        }
    }
    queueTransaction(protyle, () => fetchPost("/api/transactions", {
        session: protyle.id,
        app: Constants.SIYUAN_APPID,
        transactions: [{
            doOperations: options.doOperations,
            undoOperations: options.undoOperations,// 目前用于 ws 推送更新大纲
        }]
    }, (response) => {
        const ids: string[] = [];
        protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select").forEach(item => {
            ids.push(item.getAttribute("data-node-id"));
        });
        countBlockWord(ids, protyle.block.rootID, true);
        if (!options.skipSync) {
            response.data[0].doOperations.forEach((operation: IOperation) => {
                if (operation.action === "unfoldHeading" || operation.action === "foldHeading") {
                    processFold(operation, protyle);
                    return;
                }
            });
        }
        // 事务提交后再渲染嵌入块，避免其查询请求早于写入到达内核而拿到旧数据
        pendingEmbedElements.forEach(item => {
            if (item.isConnected) {
                item.removeAttribute("data-render");
                getTransactionTransformVisualEffects().renderBlock(protyle, item);
            }
        });
        options.callback?.();
    }));
};

const containsOperationAnchor = (element: Element, operation: IOperation) => {
    const ids = new Set<string>();
    [operation.previousID, operation.nextID, operation.parentID].forEach(id => {
        if (id) {
            ids.add(id);
        }
    });
    return Array.from(element.querySelectorAll("[data-node-id]")).some(item => {
        const id = item.getAttribute("data-node-id");
        return isInEmbedBlock(item, false) === element && !!id && ids.has(id);
    });
};

const getDocumentEmbedResults = (element: Element, targetID?: string) => {
    if (!targetID) {
        return [];
    }
    return Array.from(element.querySelectorAll<HTMLElement>(
        ".protyle-wysiwyg__embed[data-allow-child-operation=\"true\"]"
    )).filter(item => item.getAttribute("data-id") === targetID && !getEmbedChildOperationContext(item)?.targetElement);
};

export const updateEmbed = (protyle: IProtyle, operation: IOperation) => {
    let updatedEmbed = false;

    const updateHTML = (item: Element, html: string) => {
        const tempElement = document.createElement("template");
        tempElement.innerHTML = protyle.lute.SpinBlockDOM(html);
        tempElement.content.querySelectorAll('[contenteditable="true"]').forEach(editItem => {
            editItem.setAttribute("contenteditable", "false");
        });
        tempElement.content.querySelectorAll(".protyle-wysiwyg--select").forEach(selectItem => {
            selectItem.classList.remove("protyle-wysiwyg--select");
        });
        const wbrElement = tempElement.content.querySelector("wbr");
        if (wbrElement) {
            wbrElement.remove();
        }
        item.outerHTML = tempElement.innerHTML;
        updatedEmbed = true;
    };

    const allTempElement = document.createElement("template");
    allTempElement.innerHTML = operation.data;
    protyle.wysiwyg.element.querySelectorAll('[data-type="NodeBlockQueryEmbed"]').forEach((item) => {
        const matchElement = item.querySelectorAll(`[data-node-id="${operation.id}"]`);
        if (matchElement.length > 0) {
            matchElement.forEach(embedItem => {
                updateHTML(embedItem, operation.data);
            });
        } else {
            item.querySelectorAll(".protyle-wysiwyg__embed").forEach(embedBlockItem => {
                const newTempElement = allTempElement.content.querySelector(`[data-node-id="${embedBlockItem.getAttribute("data-id")}"]`);
                if (newTempElement && !isInEmbedBlock(newTempElement)) {
                    updateHTML(embedBlockItem.querySelector("[data-node-id]"), newTempElement.outerHTML);
                }
            });
        }
    });
    if (updatedEmbed) {
        contentRendererRegistry.renderBatch(protyle.wysiwyg.element);
        highlightRender(protyle.wysiwyg.element);
        getAVLocateRenderer()(protyle.wysiwyg.element, protyle);
    }
};
