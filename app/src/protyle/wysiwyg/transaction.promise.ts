import { fetchPost } from "../../util/network/fetch";
import { focusByWbr } from "../util/selection";
import { Constants } from "../../constants";
import { blockRender } from "../render/blockRender";
import { contentRendererRegistry } from "../../registry/contentRenderer/ContentRendererRegistry";
import { highlightRender } from "../render/highlightRender";
import { hasClosestByAttribute, hasTopClosestByAttribute, isInEmbedBlock } from "../util/hasClosest";
import { avRender } from "../render/av/render";
import { isMobile } from "../../platform";
import { genEmptyElement } from "../../block/util";
import { hideElements } from "../ui/hideElements";
import { countBlockWord } from "../../layout/status";
import { isPaidUser, needSubscribe } from "../../util/platform/needSubscribe";
import { processClonePHElement } from "../render/util";
import { getFirstBlock } from "./getBlock";
import { processFold } from "./transaction.fold";
// circular import — safe because only used at runtime inside callbacks
import { transaction, removeTopElement } from "./transaction";

// 用于执行操作，外加处理当前编辑器中块引用、嵌入块的更新
export const promiseTransaction = () => {
    if (window.siyuan.transactions.length === 0) {
        return;
    }
    const protyle = window.siyuan.transactions[0].protyle;
    const doOperations = window.siyuan.transactions[0].doOperations;
    const undoOperations = window.siyuan.transactions[0].undoOperations;
    // S-forge: 移植自上游 — skipSync 支持
    const skipSync = window.siyuan.transactions[0].skipSync;
    // 1. * ;2. * ;3. a
    // 第一步请求没有返回前在 transaction 中会合并1、2步，此时第一步请求返回将被以下代码删除，在输入a时，就会出现 block not found，因此以下代码不能放入请求回调中
    window.siyuan.transactions.splice(0, 1);
    fetchPost("/api/transactions", {
        session: protyle.id,
        app: Constants.SIYUAN_APPID,
        transactions: [{
            doOperations,
            undoOperations // 目前用于 ws 推送更新大纲
        }]
    }, (response) => {
        if (window.siyuan.transactions.length === 0) {
            const ids: string[] = [];
            protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select").forEach(item => {
                ids.push(item.getAttribute("data-node-id"));
            });
            countBlockWord(ids, protyle.block.rootID, true);
        } else {
            promiseTransaction();
        }
        if (skipSync) {
            return;
        }
        if (isMobile && ((0 !== window.siyuan.config.sync.provider && isPaidUser()) ||
            (0 === window.siyuan.config.sync.provider && !needSubscribe(""))) &&
            window.siyuan.config.repo.key && window.siyuan.config.sync.enabled) {
            document.getElementById("toolbarSync").classList.remove("fn__none");
        }
        let range: Range;
        if (getSelection().rangeCount > 0) {
            range = getSelection().getRangeAt(0);
        }
        response.data[0].doOperations.forEach((operation: IOperation) => {
            if (operation.action === "unfoldHeading" || operation.action === "foldHeading") {
                processFold(operation, protyle);
                return;
            }
            if (operation.action === "update") {
                if (protyle.options.backlinkData) {
                    // 反链中有多个相同块的情况
                    Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`)).forEach(item => {
                        if (!isInEmbedBlock(item)) {
                            if (range && (item === range.startContainer || item.contains(range.startContainer))) {
                                // 正在编辑的块不能进行更新
                            } else {
                                item.outerHTML = operation.data.replace("<wbr>", "");
                            }
                        }
                    });
                    contentRendererRegistry.renderBatch(protyle.wysiwyg.element);
                    highlightRender(protyle.wysiwyg.element);
                    avRender(protyle.wysiwyg.element, protyle);
                    blockRender(protyle, protyle.wysiwyg.element);
                }
                // 当前编辑器中更新嵌入块
                updateEmbed(protyle, operation);
                return;
            }
            if (operation.action === "delete" || operation.action === "append") {
                if (protyle.options.backlinkData) {
                    Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`)).forEach(item => {
                        if (!isInEmbedBlock(item) && !item.contains(range.startContainer)) {
                            item.remove();
                        }
                    });
                }
                // 更新嵌入块
                protyle.wysiwyg.element.querySelectorAll('[data-type="NodeBlockQueryEmbed"]').forEach((item) => {
                    if (item.querySelector(`[data-node-id="${operation.id}"]`)) {
                        item.removeAttribute("data-render");
                        blockRender(protyle, item);
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
                    let hasFind = false;
                    if (operation.previousID && updateElements.length > 0) {
                        Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.previousID}"]`)).forEach(item => {
                            if (!isInEmbedBlock(item) && !item.nextElementSibling.contains(range.startContainer)) {
                                item.after(processClonePHElement(updateElements[0].cloneNode(true) as Element));
                                hasFind = true;
                            }
                        });
                    } else if (updateElements.length > 0) {
                        Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.parentID}"]`)).forEach(item => {
                            if (!isInEmbedBlock(item) && !getFirstBlock(item).contains(range.startContainer)) {
                                const cloneElement = processClonePHElement(updateElements[0].cloneNode(true) as Element);
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
                            removeTopElement(item, protyle);
                        }
                    });
                }
                // 更新嵌入块
                protyle.wysiwyg.element.querySelectorAll('[data-type="NodeBlockQueryEmbed"]').forEach((item) => {
                    if (item.querySelector(`[data-node-id="${operation.id}"],[data-node-id="${operation.parentID}"],[data-node-id="${operation.previousID}"]`)) {
                        item.removeAttribute("data-render");
                        blockRender(protyle, item);
                    }
                });
                return;
            }
            if (operation.action === "insert") {
                // insert
                if (protyle.options.backlinkData) {
                    const cursorElements: Element[] = [];
                    if (operation.previousID) {
                        Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.previousID}"]`)).forEach(item => {
                            if (item.nextElementSibling?.getAttribute("data-node-id") !== operation.id &&
                                !item.contains(range.startContainer) && // 当前操作块不再进行操作
                                !hasClosestByAttribute(item, "data-node-id", operation.id) && // 段落转列表会在段落后插入新列表
                                !isInEmbedBlock(item)) {
                                item.insertAdjacentHTML("afterend", operation.data);
                                cursorElements.push(item.nextElementSibling);
                            }
                        });
                    } else {
                        Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.parentID}"]`)).forEach(item => {
                            if (!isInEmbedBlock(item) && !item.contains(range.startContainer)) {
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
                        avRender(item, protyle);
                        blockRender(protyle, item);
                        const wbrElement = item.querySelector("wbr");
                        if (wbrElement) {
                            wbrElement.remove();
                        }
                    });
                }
                // 不更新嵌入块：在快速删除时重新渲染嵌入块会导致滚动条产生滚动从而触发 getDoc 请求，此时删除的块还没有写库，会把已删除的块 append 到文档底部，最终导致查询块失败、光标丢失
                // protyle.wysiwyg.element.querySelectorAll('[data-type="NodeBlockQueryEmbed"]').forEach((item) => {
                //     if (item.getAttribute("data-node-id") === operation.id) {
                //         item.removeAttribute("data-render");
                //         blockRender(protyle, item);
                //     }
                // });
                protyle.wysiwyg.element.querySelectorAll("[parent-heading]").forEach(item => {
                    item.remove();
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
            transaction(protyle, [{
                action: "insert",
                data: emptyElement.outerHTML,
                id: newID,
                parentID: protyle.block.parentID
            }]);
            // 不能撤销，否则就无限循环了
            focusByWbr(emptyElement, range);
        }
    });
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
        avRender(protyle.wysiwyg.element, protyle);
    }
};
