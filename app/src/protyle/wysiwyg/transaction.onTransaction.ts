import { focusBlock, focusByWbr, focusSideBlock, getEditorRange } from "../util/selection";
import { blockRender } from "../render/blockRender";
import { contentRendererRegistry } from "../../registry/contentRenderer/ContentRendererRegistry";
import { highlightRender } from "../render/highlightRender";
import { isInEmbedBlock } from "../util/hasClosest";
import { zoomOut } from "../../menus/protyleMenus/editorMenu/protyle.zoomOut";
import { disabledProtyle } from "../util/onGet";
import { avRender, refreshAV } from "../render/av/render";
import { removeFoldHeading } from "../util/heading";
import { reloadProtyle } from "../util/reload";
import { getTopAloneElement } from "./getBlock";
import { removeUnfoldRepeatBlock } from "./transaction.fold";
import { handleUpdateAttrs } from "./transaction.onTransaction.attrs";
import { handleMove } from "./transaction.onTransaction.move";
import { handleInsert } from "./transaction.onTransaction.insert";
import { updateEmbed } from "./transaction.promise";
import { refreshSbs } from "./transaction.refreshSbs";

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
    // 表格出现滚动条，更新块后需还原横向滚动位置 https://github.com/siyuan-note/siyuan/issues/3650
    let tableScrollLeft = 0;
    const tableItem = updateElements.find(item => item.classList.contains("table"));
    if (tableItem) {
        tableScrollLeft = (tableItem.firstElementChild as HTMLElement).scrollLeft;
    }
    updateElements.forEach(item => {
        // 图标撤销后无法渲染
        if (item.getAttribute("data-subtype") === "echarts") {
            item.outerHTML = protyle.lute.SpinBlockDOM(operation.data);
        } else {
            item.outerHTML = operation.data;
        }
    });
    Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`)).find(item => {
        if (!isInEmbedBlock(item)) {
            if (item.getAttribute("data-type") === "NodeBlockQueryEmbed") {
                item.removeAttribute("data-render");
            }
            updateElements[0] = item;
            return true;
        }
    });
    if (tableScrollLeft > 0) {
        (updateElements[0].firstElementChild as HTMLElement).scrollLeft = tableScrollLeft;
    }
    const wbrElement = updateElements[0].querySelector("wbr");
    if (isUndo) {
        const range = getEditorRange(updateElements[0]);
        if (wbrElement) {
            focusByWbr(updateElements[0], range);
        } else {
            focusBlock(updateElements[0]);
        }
    } else if (wbrElement) {
        wbrElement.remove();
    }
    contentRendererRegistry.renderBatch(updateElements.length === 1 ? updateElements[0] : protyle.wysiwyg.element);
    highlightRender(updateElements.length === 1 ? updateElements[0] : protyle.wysiwyg.element);
    avRender(updateElements.length === 1 ? updateElements[0] : protyle.wysiwyg.element, protyle);
    blockRender(protyle, updateElements.length === 1 ? updateElements[0] : protyle.wysiwyg.element);
    // 更新 ws 嵌入块
    updateEmbed(protyle, operation);
    refreshSbs(updateElements[0]);
};

// 用于推送和撤销
export const onTransaction = (protyle: IProtyle, operation: IOperation, isUndo: boolean) => {
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
        protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach(item => {
            if (JSON.parse(operation.data).fold === "1") {
                item.setAttribute("fold", "1");
            } else {
                item.removeAttribute("fold");
            }
        });
        return;
    }
    if (operation.action === "unfoldHeading") {
        protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach(item => {
            item.removeAttribute("fold");
            // undo 会走 transaction
            if (isUndo) {
                if (operation.retData) {
                    removeUnfoldRepeatBlock(operation.retData, protyle);
                    item.insertAdjacentHTML("afterend", operation.retData);
                }
                return;
            }
            const embedElement = isInEmbedBlock(item);
            if (embedElement) {
                embedElement.removeAttribute("data-render");
                blockRender(protyle, embedElement);
                return;
            }
            if (operation.retData) {
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
                zoomOut({
                    protyle,
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
            zoomOut({
                protyle,
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
            zoomOut({
                protyle,
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
        "setAttrViewColWrap", "setAttrViewColWidth", "removeAttrViewColOption", "setAttrViewName", "setAttrViewFilters",
        "setAttrViewSorts", "setAttrViewColCalc", "removeAttrViewCol", "updateAttrViewColNumberFormat", "removeAttrViewBlock",
        "replaceAttrViewBlock", "updateAttrViewColTemplate", "setAttrViewColPin", "addAttrViewView", "setAttrViewColIcon",
        "removeAttrViewView", "setAttrViewViewName", "setAttrViewViewIcon", "duplicateAttrViewView", "sortAttrViewView",
        "updateAttrViewColRelation", "setAttrViewPageSize", "updateAttrViewColRollup", "sortAttrViewKey", "setAttrViewColDesc",
        "duplicateAttrViewKey", "setAttrViewViewDesc", "setAttrViewCoverFrom", "setAttrViewCoverFromAssetKeyID",
        "setAttrViewBlockView", "setAttrViewCardSize", "setAttrViewCardAspectRatio", "hideAttrViewName", "setAttrViewShowIcon",
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
        return;
    }
    if (operation.action === "doUpdateUpdated") {
        updateElements.forEach(item => {
            item.setAttribute("updated", operation.data);
        });
        return;
    }
};
