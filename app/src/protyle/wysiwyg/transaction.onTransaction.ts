import { focusBlock, focusByWbr, focusSideBlock, getEditorRange } from "../util/selection";
import { blockRender } from "../render/blockRender";
import { contentRendererRegistry } from "../../registry/contentRenderer/ContentRendererRegistry";
import { highlightRender } from "../render/highlightRender";
import { isInEmbedBlock } from "../util/hasClosest";
import { disabledProtyle } from "../util/onGet";
import {avRender} from "../render/av/render";
import {refreshAV} from "../render/av/render.refresh";
import { removeFoldHeading } from "../util/heading";
import { reloadProtyle } from "../util/reload";
import { getTopAloneElement } from "./getBlock";
import {removeUnfoldRepeatBlock, syncFoldAndStyleAttrs} from "./transaction.fold";
import { handleUpdateAttrs } from "./transaction.onTransaction.attrs";
import { handleMove } from "./transaction.onTransaction.move";
import { handleInsert } from "./transaction.onTransaction.insert";
import { updateEmbed } from "./transaction.promise";
import { refreshSbs } from "./transaction/refreshSbs";

const deleteBlock = (updateElements: Element[], id: string, protyle: IProtyle, isUndo: boolean) => {
    if (isUndo && updateElements[0]) {
        focusSideBlock(updateElements[0]);
    }
    const sbParents: Element[] = [];
    updateElements.forEach(item => {
        const sbElement = item.closest('[data-type="NodeSuperBlock"]');
        if (sbElement && !sbParents.includes(sbElement)) {
            sbParents.push(sbElement);
        }
        if (isUndo) {
            // https://github.com/siyuan-note/siyuan/issues/13617
            item.remove();
        } else {
            // 需移除顶层，否则删除唯一的列表项后列表无法清除干净 https://github.com/siyuan-note/siyuan/issues/12326 第一点
            const topElement = getTopAloneElement(item);
            if (topElement) {
                topElement.remove();
            }
        }
    });
    // 更新 ws 嵌入块
    protyle.wysiwyg.element.querySelectorAll('[data-type="NodeBlockQueryEmbed"]').forEach((item) => {
        if (item.querySelector(`[data-node-id="${id}"]`)) {
            item.removeAttribute("data-render");
            blockRender(protyle, item);
        }
    });
    refreshSbs(...sbParents);
};

const updateBlock = (updateElements: Element[], protyle: IProtyle, operation: IOperation, isUndo: boolean) => {
    const range = getSelection().rangeCount > 0 ? getSelection().getRangeAt(0) : null;
    updateElements.forEach(item => {
        const isRangeBlock = !!range && item.contains(range.startContainer);
        let tableScrollLeft: number;
        let tableScrollTop: number;
        let contentScrollTop: number;
        if (item.classList.contains("table")) {
            tableScrollLeft = item.firstElementChild.scrollLeft;
            tableScrollTop = item.firstElementChild.scrollTop;
            if (isRangeBlock) {
                contentScrollTop = protyle.contentElement.scrollTop;
            }
        }
        const html = item.getAttribute("data-subtype") === "echarts" ?
            protyle.lute.SpinBlockDOM(operation.data) : operation.data;
        item.insertAdjacentHTML("afterend", html);
        const replacement = item.nextElementSibling;
        item.remove();

        const wbrElement = replacement.querySelector("wbr");
        if (isRangeBlock && isUndo) {
            if (wbrElement) {
                focusByWbr(replacement, range || getEditorRange(replacement));
            } else {
                focusBlock(replacement);
            }
        }
        wbrElement?.remove();
        if (tableScrollLeft > 0) {
            replacement.firstElementChild.scrollLeft = tableScrollLeft;
        }
        if (tableScrollTop > 0) {
            replacement.firstElementChild.scrollTop = tableScrollTop;
        }
        if (contentScrollTop > 0) {
            protyle.contentElement.scrollTop = contentScrollTop;
            protyle.scroll.lastScrollTop = contentScrollTop - 1;
        }
        contentRendererRegistry.renderBatch(replacement);
        highlightRender(replacement);
        avRender(replacement, protyle);
        blockRender(protyle, replacement);
        refreshSbs(replacement);
    });
};

// 用于推送和撤销
const applyTransactionOperation = (protyle: IProtyle, operation: IOperation, isUndo: boolean) => {
    if (protyle.wysiwyg.element.firstElementChild?.classList.contains("protyle-password")) {
        return;
    }
    const updateElements: Element[] = [];
    Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`)).forEach(item => {
        if (!isInEmbedBlock(item)) {
            updateElements.push(item);
        }
    });
    if (operation.action === "setAttrs") {
        syncFoldAndStyleAttrs(protyle.wysiwyg.element, operation);
        return;
    }
    if (operation.action === "unfoldHeading") {
        protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach(item => {
            item.removeAttribute("fold");
            if (isUndo && operation.retData) {
                removeUnfoldRepeatBlock(operation.retData, protyle);
                item.insertAdjacentHTML("afterend", operation.retData);
            }
            const embedElement = isInEmbedBlock(item);
            if (embedElement) {
                embedElement.removeAttribute("data-render");
                blockRender(protyle, embedElement);
                return;
            }
            if (operation.retData && !isUndo) {
                removeUnfoldRepeatBlock(operation.retData, protyle);
                item.insertAdjacentHTML("afterend", operation.retData);
            }
            if (operation.data === "remove") {
                item.remove();
            }
        });
        if (operation.retData) {
            if (protyle.disabled) {
                disabledProtyle(protyle);
            }
            contentRendererRegistry.renderBatch(protyle.wysiwyg.element);
            highlightRender(protyle.wysiwyg.element);
            avRender(protyle.wysiwyg.element, protyle);
            blockRender(protyle, protyle.wysiwyg.element);
            refreshSbs(...Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`)));
        }
        return;
    }
    if (operation.action === "foldHeading") {
        protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach(item => {
            item.setAttribute("fold", "1");
            if (!operation.retData) {
                removeFoldHeading(item);
            }
        });
        // undo 会走 transaction
        if (isUndo) {
            return;
        }
        refreshSbs(...Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`)));
        if (operation.retData) {
            operation.retData.forEach((item: string) => {
                let embedElement: HTMLElement | false;
                Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${item}"]`)).find(itemElement => {
                    embedElement = isInEmbedBlock(itemElement);
                    if (embedElement) {
                        return true;
                    }
                    itemElement.remove();
                });
                // 折叠嵌入块的父级
                if (embedElement) {
                    embedElement.removeAttribute("data-render");
                    blockRender(protyle, embedElement);
                }
            });
            if (protyle.wysiwyg.element.childElementCount === 0) {
                protyle.getInstance().zoomOut({
                    id: protyle.block.rootID,
                    isPushBack: false,
                    focusId: operation.id,
                });
            }
        }
        return;
    }
    if (operation.action === "delete") {
        if (updateElements.length > 0 || !isUndo) {
            deleteBlock(updateElements, operation.id, protyle, isUndo);
        } else if (isUndo) {
            protyle.getInstance().zoomOut({
                id: protyle.block.rootID,
                isPushBack: false,
                focusId: operation.id,
                callback() {
                    Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`)).forEach(item => {
                        if (!isInEmbedBlock(item)) {
                            updateElements.push(item);
                        }
                    });
                    deleteBlock(updateElements, operation.id, protyle, isUndo);
                }
            });
        }
        return;
    }
    if (operation.action === "update") {
        // 缩放后仅更新局部 https://github.com/siyuan-note/siyuan/issues/14326
        if (updateElements.length === 0) {
            const newUpdateElement = protyle.wysiwyg.element.querySelector("[data-node-id]");
            if (newUpdateElement) {
                const newUpdateId = newUpdateElement.getAttribute("data-node-id");
                const tempElement = document.createElement("template");
                tempElement.innerHTML = operation.data;
                const newTempElement = tempElement.content.querySelector(`[data-node-id="${newUpdateId}"]`);
                if (newTempElement) {
                    updateElements.push(newUpdateElement);
                    operation.data = newTempElement.outerHTML;
                    operation.id = newUpdateId;
                    // https://github.com/siyuan-note/siyuan/issues/14326#issuecomment-2746140335
                    for (let i = 1; i < protyle.wysiwyg.element.childElementCount; i++) {
                        protyle.wysiwyg.element.childNodes[i].remove();
                        i--;
                    }
                }
            }
        }
        if (updateElements.length > 0) {
            updateBlock(updateElements, protyle, operation, isUndo);
        } else if (isUndo) {
            protyle.getInstance().zoomOut({
                id: protyle.block.rootID,
                isPushBack: false,
                focusId: operation.id,
                callback() {
                    Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`)).forEach(item => {
                        if (!isInEmbedBlock(item)) {
                            updateElements.push(item);
                        }
                    });
                    updateBlock(updateElements, protyle, operation, isUndo);
                }
            });
        } else { // updateElements 没有包含嵌入块，在悬浮层编辑嵌入块时，嵌入块也需要更新
            // 更新 ws 嵌入块
            updateEmbed(protyle, operation);
        }
        return;
    }
    if (operation.action === "updateAttrs") { // 调用接口才推送
        handleUpdateAttrs(operation, protyle);
        return;
    }
    if (operation.action === "move") {
        handleMove(operation, protyle, updateElements, isUndo);
        return;
    }
    if (operation.action === "insert") {
        handleInsert(operation, protyle, isUndo);
        return;
    }
    if (operation.action === "append") {
        // 目前只有移动块的时候会调用，反连面板就自己点击刷新处理。
        if (!protyle.options.backlinkData) {
            reloadProtyle(protyle, false);
        }
        return;
    }
    if (["addAttrViewCol", "updateAttrViewCol", "updateAttrViewColOptions",
        "updateAttrViewColOption", "updateAttrViewCell", "sortAttrViewRow", "sortAttrViewCol", "setAttrViewColHidden",
        "setAttrViewColWrap", "setAttrViewColWidth", "setAttrViewColAlign", "removeAttrViewColOption", "setAttrViewName", "setAttrViewFilters",
        "setAttrViewSorts", "setAttrViewNewItemTemplates", "setAttrViewColCalc", "removeAttrViewCol", "updateAttrViewColNumberFormat", "removeAttrViewBlock",
        "replaceAttrViewBlock", "updateAttrViewColTemplate", "setAttrViewColPin", "addAttrViewView", "setAttrViewColIcon",
        "removeAttrViewView", "setAttrViewViewName", "setAttrViewViewIcon", "duplicateAttrViewView", "sortAttrViewView",
        "updateAttrViewColRelation", "setAttrViewPageSize", "updateAttrViewColRollup", "sortAttrViewKey", "setAttrViewColDesc",
        "duplicateAttrViewKey", "setAttrViewViewDesc", "setAttrViewCoverFrom", "setAttrViewCoverFromAssetKeyID",
        "setAttrViewBlockView", "setAttrViewCardSize", "setAttrViewCardWidth", "setAttrViewCardAspectRatio", "setAttrViewCardAspectRatioValue", "hideAttrViewName", "setAttrViewShowIcon",
        "setAttrViewWrapField", "setAttrViewGroup", "removeAttrViewGroup", "hideAttrViewGroup", "sortAttrViewGroup",
        "foldAttrViewGroup", "hideAttrViewAllGroups", "setAttrViewFitImage", "setAttrViewDisplayFieldName",
        "insertAttrViewBlock", "setAttrViewColDateFillSpecificTime", "setAttrViewFillColBackgroundColor", "setAttrViewUpdatedIncludeTime",
        "setAttrViewCreatedIncludeTime"].includes(operation.action)) {
        // 撤销 transaction 会进行推送，需使用推送来进行刷新最新数据 https://github.com/siyuan-note/siyuan/issues/13607
        if (!isUndo) {
            refreshAV(protyle, operation);
        } else if (operation.action === "setAttrViewName") {
            // setAttrViewName 同文档不会推送，需手动刷新
            Array.from(protyle.wysiwyg.element.querySelectorAll(`.av[data-av-id="${operation.id}"]`)).forEach((item: HTMLElement) => {
                const titleElement = item.querySelector(".av__title") as HTMLElement;
                if (!titleElement) {
                    return;
                }
                titleElement.textContent = operation.data;
                titleElement.dataset.title = operation.data;
            });
        }
        protyle.databaseAttributePanel?.refreshForOperation(operation);
        return;
    }
    if (operation.action === "doUpdateUpdated") {
        updateElements.forEach(item => {
            item.setAttribute("updated", operation.data);
        });
        return;
    }
};

export const onTransaction = (protyle: IProtyle, operations: IOperation | IOperation[], isUndo: boolean) => {
    const operationList = Array.isArray(operations) ? operations : [operations];
    for (const operation of operationList) {
        applyTransactionOperation(protyle, operation, isUndo);
    }
};
