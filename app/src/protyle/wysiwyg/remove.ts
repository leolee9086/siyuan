// S-forge: 保留本地单行 import 格式
import { focusBlock, focusByWbr, getSelectionOffset, setLastNodeRange } from "../util/selection";
import {
    getContenteditableElement,
    getEmbedChildOperationContext,
    getEmbedChildOperationParentID,
    getLastBlock,
    getNextBlock, getParentBlock,
    getPreviousBlock,
    getPreviousBlockSibling,
    getSbChildBlockCount,
    getTopAloneElement,
    getTopEmptyElement,
    hasNextSibling,
    hasPreviousSibling,
    IEmbedChildOperationContext
} from "./getBlock";
import { transaction, turnsIntoTransaction, updateTransaction } from "./transaction";
import { genEmptyElement, rebalanceSbWidth, refreshSbResize } from "../../block/util";
import { cancelSB } from "../../block/util.cancelSB";
import { updateListOrder } from "./list.updateOrder";
import { setFold } from "../util/blockFold";
import { zoomOut } from "../../menus/protyleMenus/editorMenu/protyle.zoomOut";
import { preventScroll } from "../scroll/preventScroll";
import { hideElements } from "../ui/hideElements";
import { Constants } from "../../constants";
import { scrollCenter } from "../../util/DOM/highlightById";
import { isMobile } from "../../util/platform/functions";
import { mathRender } from "../render/mathRender";
import { hasClosestBlock, hasClosestByClassName, isInEmbedBlock } from "../util/hasClosest";
import { removeProtyleBacklinkEditor } from "../runtime/layout.port";
import { fetchPost, fetchSyncPost } from "../../util/network/fetch";
import { onGet } from "../util/onGet";
import { removeLi } from "./remove.removeLi";
import { withEncryptedNotebook } from "../../util/pathName";

/**
 * 作用：把超级块删除后的宽度重平衡写入事务。
 * 意图：删除子块会移除 resize 手柄并改变剩余列宽，需要让撤销/重做同步 DOM 宽度。
 * 调用时机：删除操作未取消超级块、仍保留多个子块时调用。
 * 问题/改进：依赖调用方传入已完成 DOM 删除后的超级块元素。
 */
const appendSuperBlockWidthOperations = (parentElement: Element, doOperations: IOperation[], undoOperations: IOperation[]) => {
    refreshSbResize(parentElement);
    const widthChanges = rebalanceSbWidth(parentElement);
    for (const change of widthChanges) {
        const targetEl = parentElement.querySelector(`[data-node-id="${change.id}"]`);
        // 重平衡返回的块可能已被删除，缺少 DOM 时跳过对应事务项。
        if (!targetEl) {
            continue;
        }
        doOperations.push({ action: "update", id: change.id, data: targetEl.outerHTML });
        undoOperations.push({ action: "update", id: change.id, data: change.oldHTML });
    }
};

export const removeBlock = async (protyle: IProtyle, blockElement: Element, range: Range, type: "Delete" | "Backspace" | "remove") => {
    protyle.observerLoad?.disconnect();
    // 删除后，防止滚动条滚动后调用 get 请求，因为返回的请求已查找不到内容块了
    preventScroll(protyle);
    const selectElements = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
    if (selectElements?.length > 0) {
        const embedSelectElements = selectElements.filter(item => isInEmbedBlock(item));
        if (embedSelectElements.length > 0) {
            // 嵌入块内暂不支持跨边界或多块删除，避免上溯时删除查询目标。
            if (embedSelectElements.length !== selectElements.length || embedSelectElements.length !== 1) {
                return;
            }
            const embedContext = getEmbedChildOperationContext(embedSelectElements[0]);
            const topElement = getTopAloneElement(embedSelectElements[0]);
            if (!embedContext || !canDeleteEmbedElement(topElement, type, embedContext)) {
                return;
            }
        }
        const deletes: IOperation[] = [];
        const inserts: IOperation[] = [];
        let sideElement: Element | boolean;
        let sideIsNext = false;
        if (type === "Backspace") {
            sideElement = getPreviousBlockSibling(selectElements[0]);
            if (!sideElement) {
                sideIsNext = true;
                sideElement = selectElements[selectElements.length - 1].nextElementSibling;
            }
        } else {
            sideElement = selectElements[selectElements.length - 1].nextElementSibling;
            sideIsNext = true;
            if (!sideElement) {
                sideIsNext = false;
                sideElement = getPreviousBlockSibling(selectElements[0]);
            }
        }
        let listElement: Element;
        let topParentElement: Element;
        hideElements(["select"], protyle);
        const unfoldData: {
            [key: string]: {
                element: Element,
                previousID?: string
            }
        } = {};
        for (let i = 0; i < selectElements.length; i++) {
            const item = selectElements[i];
            const topElement = getTopAloneElement(item);
            topParentElement = topElement.parentElement;
            const id = topElement.getAttribute("data-node-id");
            deletes.push({
                action: "delete",
                id,
            });
            if (type === "Backspace") {
                sideElement = getPreviousBlock(topElement);
                if (!sideElement) {
                    sideIsNext = true;
                    sideElement = getNextBlock(topElement);
                }
            } else {
                sideElement = getNextBlock(topElement);
                sideIsNext = true;
                if (!sideElement) {
                    sideIsNext = false;
                    sideElement = getPreviousBlock(topElement);
                }
            }
            if (!sideElement && !protyle.options.backlinkData) {
                sideElement = topElement.parentElement || protyle.wysiwyg.element.firstElementChild;
                sideIsNext = false;
            }
            if (topElement.getAttribute("data-type") === "NodeHeading" && topElement.getAttribute("fold") === "1") {
                const foldTransaction = await fetchSyncPost("/api/block/getHeadingDeleteTransaction", {
                    id: topElement.getAttribute("data-node-id"),
                });
                deletes.push(...foldTransaction.data.doOperations.slice(1));
                foldTransaction.data.undoOperations.forEach((operationItem: IOperation, index: number) => {
                    if (index > 0) {
                        operationItem.context = {
                            ignoreProcess: "true"
                        };
                    }
                });
                foldTransaction.data.undoOperations.reverse();
                const foldPreviousBlockElement = getPreviousBlockSibling(topElement);
                if (foldPreviousBlockElement &&
                    foldPreviousBlockElement.getAttribute("data-type") === "NodeHeading" &&
                    foldPreviousBlockElement.getAttribute("fold") === "1") {
                    const foldId = foldPreviousBlockElement.getAttribute("data-node-id");
                    if (!unfoldData[foldId]) {
                        const foldTransaction = await fetchSyncPost("/api/block/getHeadingDeleteTransaction", {
                            id: foldId,
                        });
                        unfoldData[foldId] = {
                            element: foldPreviousBlockElement,
                            previousID: foldTransaction.data.doOperations[foldTransaction.data.doOperations.length - 1].id
                        };
                    }
                }
                inserts.push(...foldTransaction.data.undoOperations);
                // https://github.com/siyuan-note/siyuan/issues/4422
                topElement.firstElementChild.removeAttribute("contenteditable");
                topElement.remove();
            } else {
                let data = topElement.outerHTML;    // 不能 spin ，否则 li 会变为 list
                if (topElement.classList.contains("render-node") || topElement.querySelector("div.render-node")) {
                    data = protyle.lute.SpinBlockDOM(topElement.outerHTML);  // 防止图表撤销问题
                }
                const previousBlockElement = getPreviousBlockSibling(topElement);
                let previousID = previousBlockElement ? previousBlockElement.getAttribute("data-node-id") : "";
                if (previousBlockElement &&
                    previousBlockElement.getAttribute("data-type") === "NodeHeading" &&
                    previousBlockElement.getAttribute("fold") === "1") {
                    const foldId = previousBlockElement.getAttribute("data-node-id");
                    if (!unfoldData[foldId]) {
                        const foldTransaction = await fetchSyncPost("/api/block/getHeadingDeleteTransaction", {
                            id: foldId,
                        });
                        unfoldData[foldId] = {
                            element: previousBlockElement,
                            previousID: foldTransaction.data.doOperations[foldTransaction.data.doOperations.length - 1].id
                        };
                    }
                    previousID = unfoldData[foldId].previousID;
                }
                inserts.push({
                    action: "insert",
                    data,
                    id,
                    previousID,
                    parentID: getOperationParentID(topElement, protyle.block.parentID)
                });
                if (topElement.getAttribute("data-subtype") === "o" && topElement.classList.contains("li")) {
                    listElement = topElement.parentElement;
                } else {
                    listElement = undefined;
                }
                // https://github.com/siyuan-note/siyuan/issues/12327
                if (topElement.parentElement.classList.contains("li") && topElement.parentElement.childElementCount === 4 &&
                    topElement.parentElement.getAttribute("fold") === "1") {
                    unfoldData[topElement.parentElement.getAttribute("data-node-id")] = {
                        element: topElement.parentElement,
                    };
                }
                topElement.remove();
                // 删除列表项内容块后，若该列表项仅剩子列表而无内容块，需补一个空段落。
                const liChildren = Array.from(topParentElement.children);
                const firstBlock = liChildren.find(item => item.hasAttribute("data-node-id") &&
                    !item.classList.contains("protyle-action") && !item.classList.contains("protyle-attr"));
                if (topParentElement.classList.contains("li") && firstBlock?.classList.contains("list")) {
                    const emptyID = Lute.NewNodeID();
                    const emptyElement = genEmptyElement(false, false, emptyID);
                    liChildren.find(item => item.classList.contains("protyle-action"))?.after(emptyElement);
                    deletes.push({
                        action: "insert",
                        data: emptyElement.outerHTML,
                        id: emptyID,
                        nextID: firstBlock.getAttribute("data-node-id"),
                        parentID: topParentElement.getAttribute("data-node-id"),
                    });
                    inserts.push({
                        action: "delete",
                        id: emptyID,
                    });
                }
            }
        }
        Object.keys(unfoldData).forEach(item => {
            const foldOperations = setFold(protyle, unfoldData[item].element, true, false, false, true);
            deletes.push(...foldOperations.doOperations);
            inserts.splice(0, 0, ...foldOperations.undoOperations);
        });
        if (sideElement) {
            if (protyle.block.showAll && sideElement.classList.contains("protyle-wysiwyg") && protyle.wysiwyg.element.childElementCount === 0) {
                setTimeout(() => {
                    if (document.contains(protyle.element)) {
                        zoomOut({ protyle, id: protyle.block.parent2ID, focusId: protyle.block.parent2ID });
                    }
                }, Constants.TIMEOUT_INPUT * 2 + 100);
            } else {
                if ((sideElement.classList.contains("protyle-wysiwyg") && protyle.wysiwyg.element.childElementCount === 0)) {
                    const newID = Lute.NewNodeID();
                    const emptyElement = genEmptyElement(false, true, newID);
                    sideElement.insertAdjacentElement("afterbegin", emptyElement);
                    deletes.push({
                        action: "insert",
                        data: emptyElement.outerHTML,
                        id: newID,
                        parentID: sideElement.getAttribute("data-node-id") || protyle.block.parentID
                    });
                    inserts.push({
                        action: "delete",
                        id: newID,
                    });
                    sideElement = undefined;
                    focusByWbr(emptyElement, range);
                }
                // https://github.com/siyuan-note/siyuan/issues/5485
                // https://github.com/siyuan-note/siyuan/issues/10389
                // https://github.com/siyuan-note/siyuan/issues/10899
                if (type !== "Backspace" && sideIsNext) {
                    focusBlock(sideElement as Element);
                } else {
                    focusBlock(sideElement as Element, undefined, false);
                }
                scrollCenter(protyle, sideElement as Element);
                if (listElement) {
                    inserts.push({
                        action: "update",
                        id: listElement.getAttribute("data-node-id"),
                        data: listElement.outerHTML
                    });
                    listElement.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
                    updateListOrder(listElement, 1);
                    deletes.push({
                        action: "update",
                        id: listElement.getAttribute("data-node-id"),
                        data: listElement.outerHTML
                    });
                }
            }
        }
        if (deletes.length > 0) {
            if (topParentElement && topParentElement.getAttribute("data-type") === "NodeSuperBlock" && getSbChildBlockCount(topParentElement) === 1) {
                const sbData = await cancelSB(protyle, topParentElement, range);
                transaction(protyle, deletes.concat(sbData.doOperations), sbData.undoOperations.concat(inserts.reverse()));
            } else {
                // 超级块仍保留多个子块时同步 resize 手柄和剩余块宽度。
                if (topParentElement && topParentElement.getAttribute("data-type") === "NodeSuperBlock") {
                    appendSuperBlockWidthOperations(topParentElement, deletes, inserts);
                }
                transaction(protyle, deletes, inserts.reverse());
            }
        }

        hideElements(["util"], protyle);
        if (!isMobile() && !sideElement) {
            const backlinkElement = hasClosestByClassName(protyle.element, "sy__backlink", true);
            if (backlinkElement) {
                removeProtyleBacklinkEditor(protyle, backlinkElement);
            }
        }
        // https://github.com/siyuan-note/siyuan/issues/16767
        setTimeout(() => {
            if (!document.contains(protyle.element)) {
                return;
            }
            if (protyle.wysiwyg.element.lastElementChild.getAttribute("data-eof") !== "2" &&
                !protyle.scroll.element.classList.contains("fn__none") &&
                protyle.contentElement.scrollHeight - protyle.contentElement.scrollTop < protyle.contentElement.clientHeight * 2
            ) {
                const getDocParam = withEncryptedNotebook(protyle.notebookId, {
                    id: protyle.wysiwyg.element.lastElementChild.getAttribute("data-node-id"),
                    mode: 2,
                    size: window.siyuan.config.editor.dynamicLoadBlocks,
                });
                fetchPost("/api/filetree/getDoc", getDocParam, getResponse => {
                    onGet({
                        data: getResponse,
                        protyle,
                        action: [Constants.CB_GET_APPEND, Constants.CB_GET_UNCHANGEID],
                    });
                });
            }
        }, Constants.TIMEOUT_COUNT);// 需等待滚动阻塞、后台处理完成。否则会加载已删除的内容
        return;
    }
    const embedBlockElement = isInEmbedBlock(blockElement);
    const embedContext = getEmbedChildOperationContext(blockElement);
    if (embedBlockElement && (!embedContext || embedContext.targetElement === blockElement)) {
        return;
    }
    const blockType = blockElement.getAttribute("data-type");
    // 空代码块直接删除
    if (blockType === "NodeCodeBlock" && getContenteditableElement(blockElement)?.textContent.trim() === "") {
        blockElement.classList.add("protyle-wysiwyg--select");
        removeBlock(protyle, blockElement, range, type);
        return;
    }

    let isCallout = blockElement.parentElement.classList.contains("callout-content");
    if (type === "Delete") {
        const bqCaElement = hasClosestByClassName(blockElement, "bq") || hasClosestByClassName(blockElement, "callout");
        if (bqCaElement && getContenteditableElement(bqCaElement) === getContenteditableElement(blockElement)) {
            isCallout = bqCaElement.classList.contains("callout");
            blockElement = isCallout ? bqCaElement.querySelector(".callout-content").firstElementChild : bqCaElement.firstElementChild;
        }
    }
    const blockParentElement = isCallout ? blockElement.parentElement.parentElement : blockElement.parentElement;
    if (!blockElement.previousElementSibling && (blockElement.parentElement.getAttribute("data-type") === "NodeBlockquote" || isCallout) && (
        (type !== "Delete" && blockType !== "NodeHeading") ||
        (type === "Delete" && (
            blockParentElement.parentElement.classList.contains("protyle-wysiwyg") ||
            blockParentElement.parentElement.classList.contains("li") ||
            blockParentElement.parentElement.classList.contains("callout-content") ||
            blockParentElement.parentElement.classList.contains("sb")
        ))
    )) {
        if (embedContext && !embedContext.boundaryElement.contains(blockParentElement.parentElement)) {
            return;
        }
        if (type !== "Delete") {
            range.insertNode(document.createElement("wbr"));
        }
        blockParentElement.insertAdjacentElement("beforebegin", blockElement);
        // 跳过 sb__resize 手柄取前一个块，避免超级块内引述块首删除时 previousID 为手柄导致位置错
        const previousID = getPreviousBlockSibling(blockElement)?.getAttribute("data-node-id");
        if (isCallout ? blockParentElement.querySelector(".callout-content").childElementCount === 0 :
            blockParentElement.childElementCount === 1) {
            transaction(protyle, [{
                action: "move",
                id: blockElement.getAttribute("data-node-id"),
                previousID,
                parentID: getOperationParentID(blockParentElement, protyle.block.parentID)
            }, {
                action: "delete",
                id: blockParentElement.getAttribute("data-node-id")
            }], [{
                action: "insert",
                id: blockParentElement.getAttribute("data-node-id"),
                data: blockParentElement.outerHTML,
                previousID,
                parentID: getOperationParentID(blockElement, protyle.block.parentID)
            }, {
                action: "move",
                id: blockElement.getAttribute("data-node-id"),
                parentID: blockParentElement.getAttribute("data-node-id")
            }]);
            blockParentElement.remove();
        } else {
            transaction(protyle, [{
                action: "move",
                id: blockElement.getAttribute("data-node-id"),
                previousID,
                parentID: getOperationParentID(blockParentElement, protyle.block.parentID)
            }], [{
                action: "move",
                id: blockElement.getAttribute("data-node-id"),
                parentID: blockParentElement.getAttribute("data-node-id")
            }]);
        }
        // 引述块移出/删除后，若所在容器是超级块则刷新拖拽手柄（清残留）
        const sbAncestor = getParentBlock(blockElement);
        if (sbAncestor?.classList.contains("sb")) {
            refreshSbResize(sbAncestor);
        }
        if (type === "Delete") {
            moveToPrevious(blockElement, range, true);
        } else {
            focusByWbr(blockElement, range);
        }
        return;
    }

    if (blockElement.parentElement.classList.contains("li") && blockType !== "NodeHeading" &&
        blockElement.previousElementSibling.classList.contains("protyle-action")) {
        if (embedContext && !canRemoveLiInEmbed(blockElement, embedContext)) {
            return;
        }
        await removeLi(protyle, blockElement, range, type === "Delete");
        return;
    }
    if (type === "Delete") {
        const liElement = hasClosestByClassName(blockElement, "li");
        if (liElement && getContenteditableElement(liElement) === getContenteditableElement(blockElement)) {
            if (embedContext && !canRemoveLiInEmbed(liElement.firstElementChild.nextElementSibling, embedContext)) {
                return;
            }
            await removeLi(protyle, liElement.firstElementChild.nextElementSibling, range, true);
            return;
        }
    }
    const previousElement = getPreviousBlock(blockElement) as HTMLElement;
    if (embedContext && (!previousElement || !embedContext.boundaryElement.contains(previousElement))) {
        return;
    }
    // 设置 bq 和代码块光标
    // 需放在列表处理后 https://github.com/siyuan-note/siyuan/issues/11606
    if (["NodeCodeBlock", "NodeTable", "NodeAttributeView"].includes(blockType)) {
        if (previousElement) {
            if (previousElement.classList.contains("p") && getContenteditableElement(previousElement).textContent === "") {
                // 空块向后删除时移除改块 https://github.com/siyuan-note/siyuan/issues/11732
                const ppElement = getPreviousBlock(previousElement);
                transaction(protyle, [{
                    action: "delete",
                    id: previousElement.getAttribute("data-node-id"),
                }], [{
                    action: "insert",
                    data: previousElement.outerHTML,
                    id: previousElement.getAttribute("data-node-id"),
                    parentID: getOperationParentID(previousElement, protyle.block.parentID),
                    previousID: (ppElement && (!previousElement.previousElementSibling || !previousElement.previousElementSibling.classList.contains("protyle-action"))) ? ppElement.getAttribute("data-node-id") : undefined
                }]);
                previousElement.remove();
            } else {
                focusBlock(previousElement, undefined, false);
            }
        }
        return;
    }
    if (blockType === "NodeHeading") {
        const previousBlockElement = getPreviousBlockSibling(blockElement);
        if (previousBlockElement?.getAttribute("data-type") === "NodeHeading" &&
            previousBlockElement.getAttribute("fold") === "1") {
            setFold(protyle, previousBlockElement, true, false, false);
        }
        if (blockType === "NodeHeading" &&
            blockElement.getAttribute("fold") === "1") {
            setFold(protyle, blockElement, true, false, false);
        }
        turnsIntoTransaction({
            protyle: protyle,
            selectsElement: [blockElement],
            type: "Blocks2Ps",
            range: moveToPrevious(blockElement, range, type === "Delete")
        });
        return;
    }
    if (blockElement.previousElementSibling && blockElement.previousElementSibling.classList.contains("protyle-breadcrumb__bar")) {
        return;
    }

    if (!previousElement) {
        if (protyle.wysiwyg.element.childElementCount > 1 && getContenteditableElement(blockElement).textContent === "") {
            focusBlock(protyle.wysiwyg.element.firstElementChild.nextElementSibling);
            // 列表项中包含超级块时需要到顶层
            const topElement = getTopAloneElement(blockElement);
            transaction(protyle, [{
                action: "delete",
                id: topElement.getAttribute("data-node-id"),
            }], [{
                action: "insert",
                data: topElement.outerHTML,
                id: topElement.getAttribute("data-node-id"),
                parentID: protyle.block.parentID
            }]);
            topElement.remove();
        }
        return;
    }

    const parentElement = hasClosestBlock(getParentBlock(blockElement));
    const editableElement = getContenteditableElement(blockElement);
    let previousLastElement = getLastBlock(previousElement) as HTMLElement;
    if (range.toString() === "" && isMobile() && previousLastElement && previousLastElement.classList.contains("hr") && getSelectionOffset(editableElement).start === 0) {
        transaction(protyle, [{
            action: "delete",
            id: previousLastElement.getAttribute("data-node-id"),
        }], [{
            action: "insert",
            data: previousLastElement.outerHTML,
            id: previousLastElement.getAttribute("data-node-id"),
            previousID: getPreviousBlockSibling(previousLastElement)?.getAttribute("data-node-id"),
            parentID: getOperationParentID(previousLastElement, protyle.block.parentID)
        }]);
        previousLastElement.remove();
        return;
    }
    const isSelectNode = previousLastElement && (
        previousLastElement.classList.contains("table") ||
        previousLastElement.classList.contains("render-node") ||
        previousLastElement.classList.contains("iframe") ||
        previousLastElement.classList.contains("hr") ||
        previousLastElement.classList.contains("av") ||
        previousLastElement.classList.contains("code-block"));
    const previousId = previousLastElement.getAttribute("data-node-id");
    if (isSelectNode) {
        if (previousLastElement.classList.contains("code-block")) {
            if (editableElement.textContent.trim() === "") {
                const id = blockElement.getAttribute("data-node-id");
                const doOperations: IOperation[] = [{
                    action: "delete",
                    id,
                }];
                const undoOperations: IOperation[] = [{
                    action: "insert",
                    data: blockElement.outerHTML,
                    id: id,
                    previousID: getPreviousBlockSibling(blockElement)?.getAttribute("data-node-id"),
                    parentID: getOperationParentID(blockElement, protyle.block.parentID)
                }];
                blockElement.remove();
                // 取消超级块
                if (parentElement && parentElement.getAttribute("data-type") === "NodeSuperBlock" && getSbChildBlockCount(parentElement) === 1) {
                    const sbData = await cancelSB(protyle, parentElement);
                    transaction(protyle, doOperations.concat(sbData.doOperations), sbData.undoOperations.concat(undoOperations));
                } else {
                    transaction(protyle, doOperations, undoOperations);
                }
                focusBlock(protyle.wysiwyg.element.querySelector(`[data-node-id="${previousId}"]`), undefined, false);
            } else {
                focusBlock(previousLastElement, undefined, false);
            }
            return;
        }
        if (editableElement.textContent !== "" ||
            // https://github.com/siyuan-note/siyuan/issues/10207
            blockElement.classList.contains("av")) {
            focusBlock(previousLastElement, undefined, false);
            return;
        }
    }

    const removeElement = getTopEmptyElement(blockElement, embedContext?.boundaryElement);
    if (embedContext && (embedContext.targetElement === removeElement ||
        (parentElement === embedContext.targetElement && parentElement.getAttribute("data-type") === "NodeSuperBlock" &&
            getSbChildBlockCount(parentElement) <= 2))) {
        return;
    }
    const removeId = removeElement.getAttribute("data-node-id");
    range.insertNode(document.createElement("wbr"));
    const undoOperations: IOperation[] = [{
        action: "update",
        data: previousLastElement.outerHTML,
        id: previousId,
    }, {
        action: "insert",
        data: removeElement.outerHTML,
        id: removeId,
        // 不能使用 previousLastElement，否则在超级块下的元素前删除撤销错误
        previousID: getPreviousBlockSibling(blockElement)?.getAttribute("data-node-id"),
        parentID: getOperationParentID(removeElement, protyle.block.parentID)
    }];
    const doOperations: IOperation[] = [{
        action: "delete",
        id: removeId,
    }];

    if (isSelectNode) {
        // 需先移除 removeElement，否则 side 会选中 removeElement
        removeElement.remove();
        focusBlock(previousLastElement, undefined, false);
        // https://github.com/siyuan-note/siyuan/issues/13254
        undoOperations.splice(0, 1);
    } else {
        const previousLastEditElement = getContenteditableElement(previousLastElement);
        if (editableElement && (editableElement.textContent !== "" || editableElement.querySelector(".emoji"))) {
            // 非空块
            range.setEndAfter(editableElement.lastChild);
            // 数学公式回车后再删除 https://github.com/siyuan-note/siyuan/issues/3850
            if ((previousLastEditElement?.lastElementChild?.getAttribute("data-type") || "").indexOf("inline-math") > -1) {
                const lastSibling = hasNextSibling(previousLastEditElement?.lastElementChild);
                if (lastSibling && lastSibling.textContent === "\n") {
                    lastSibling.remove();
                }
            }
        }

        // https://github.com/siyuan-note/siyuan/issues/14807
        if (previousLastEditElement) {
            let previousLastChild = previousLastEditElement.lastChild;
            if (previousLastChild && previousLastChild.nodeType === 3) {
                if (!previousLastChild.textContent) {
                    previousLastChild = hasPreviousSibling(previousLastChild) as ChildNode;
                }
                if (previousLastChild && previousLastChild.nodeType === 3 && previousLastChild.textContent.endsWith("\n")) {
                    previousLastChild.textContent = previousLastChild.textContent.slice(0, -1);
                }
            }
        }

        const scroll = protyle.contentElement.scrollTop;
        const leftNodes = range.extractContents();
        range.selectNodeContents(previousLastEditElement);
        range.collapse(false);
        range.insertNode(leftNodes);
        const previousHTML = previousLastEditElement.innerHTML.trimStart();
        const previousText = previousLastEditElement.textContent.trimStart();
        // https://github.com/siyuan-note/siyuan/issues/15554
        if (previousHTML.startsWith("```") || previousHTML.startsWith("···") || previousHTML.startsWith("~~~") ||
            (previousHTML.indexOf("\n```") > -1 && previousText.indexOf("\n```") > -1) ||
            (previousHTML.indexOf("\n~~~") > -1 && previousText.indexOf("\n~~~") > -1) ||
            (previousHTML.indexOf("\n···") > -1 && previousText.indexOf("\n···") > -1)) {
            if (previousHTML.indexOf("\n") === -1 && previousHTML.replace(/·|~/g, "`").replace(/^`{3,}/g, "").indexOf("`") > -1) {
                // ```test` 不处理，正常渲染为段落块
            } else {
                let replaceNewHTML = previousLastEditElement.innerHTML.replace(/\n(~|·|`){3,}/g, "\n```").trim().replace(/^(~|·|`){3,}/g, "```");
                if (!replaceNewHTML.endsWith("\n```")) {
                    replaceNewHTML += "\n```";
                }
                previousLastEditElement.innerHTML = replaceNewHTML;
            }
        }
        // 图片前删除到上一个文字块时，图片前有 zwsp
        previousLastElement.insertAdjacentHTML("afterend",  protyle.lute.SpinBlockDOM(previousLastElement.outerHTML));
        previousLastElement = previousLastElement.nextElementSibling as HTMLElement;
        previousLastElement.previousElementSibling.remove();
        mathRender(getPreviousBlock(removeElement) as HTMLElement);
        const removeParentElement = removeElement.parentElement;
        // https://github.com/siyuan-note/siyuan/issues/12327
        if (removeParentElement.classList.contains("li") && removeParentElement.childElementCount === 4 &&
            removeParentElement.getAttribute("fold") === "1") {
            const foldOperations = setFold(protyle, removeParentElement, true, false, false, true);
            doOperations.push(...foldOperations.doOperations);
            undoOperations.splice(0, 0, ...foldOperations.undoOperations);
        }
        removeElement.remove();
        // extractContents 内容过多时需要进行滚动条重置，否则位置会错位
        protyle.contentElement.scrollTop = scroll;
        protyle.scroll.lastScrollTop = scroll - 1;
        previousLastElement.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
        doOperations.push({
            action: "update",
            data: previousLastElement.outerHTML,
            id: previousId,
        });
    }
    if (parentElement && parentElement.getAttribute("data-type") === "NodeSuperBlock" && getSbChildBlockCount(parentElement) === 1) {
        const sbData = await cancelSB(protyle, parentElement);
        transaction(protyle, doOperations.concat(sbData.doOperations), sbData.undoOperations.concat(undoOperations));
    } else {
        // 超级块仍保留多个子块时同步 resize 手柄和剩余块宽度。
        if (parentElement && parentElement.getAttribute("data-type") === "NodeSuperBlock") {
            appendSuperBlockWidthOperations(parentElement, doOperations, undoOperations);
        }
        transaction(protyle, doOperations, undoOperations);
    }
    focusByWbr(protyle.wysiwyg.element, range);
};

const canDeleteEmbedElement = (element: Element, type: "Delete" | "Backspace" | "remove",
                               embedContext: IEmbedChildOperationContext) => {
    if (embedContext.targetElement === element || !embedContext.boundaryElement.contains(element)) {
        return false;
    }

    const parentElement = getParentBlock(element);
    if (parentElement === embedContext.targetElement && parentElement.getAttribute("data-type") === "NodeSuperBlock" &&
        getSbChildBlockCount(parentElement) <= 2) {
        return false;
    }

    let sideElement: Element | false;
    if (type === "Backspace") {
        sideElement = getPreviousBlock(element) || getNextBlock(element);
    } else {
        sideElement = getNextBlock(element) || getPreviousBlock(element);
    }
    return !!sideElement && embedContext.boundaryElement.contains(sideElement);
};

export const getOperationParentID = (element: Element, fallbackID: string) => {
    return getEmbedChildOperationParentID(element) || getParentBlock(element)?.getAttribute("data-node-id") || fallbackID;
};

const canRemoveLiInEmbed = (blockElement: Element, embedContext: IEmbedChildOperationContext) => {
    const listItemElement = blockElement.parentElement;
    const listElement = listItemElement.parentElement;
    const previousListItemElement = listItemElement.previousElementSibling;
    if (previousListItemElement?.getAttribute("data-node-id")) {
        return embedContext.boundaryElement.contains(previousListItemElement);
    }
    if (listElement.parentElement === embedContext.resultElement) {
        return false;
    }
    return embedContext.boundaryElement.contains(listElement.parentElement);
};

export const moveToPrevious = (blockElement: Element, range: Range, isDelete: boolean) => {
    if (isDelete) {
        const previousBlockElement = getPreviousBlock(blockElement);
        if (previousBlockElement) {
            if (previousBlockElement.querySelector("wbr")) {
                return focusByWbr(previousBlockElement, range);
            } else {
                const previousEditElement = getContenteditableElement(getLastBlock(previousBlockElement));
                if (previousEditElement) {
                    return setLastNodeRange(previousEditElement, range, false);
                }
            }
        }
    }
};

// https://github.com/siyuan-note/siyuan/issues/10393
export const removeImage = (imgSelectElement: Element, nodeElement: HTMLElement, range: Range, protyle: IProtyle) => {
    const oldHTML = nodeElement.outerHTML;
    const imgPreviousSibling = hasPreviousSibling(imgSelectElement);
    if (imgPreviousSibling && imgPreviousSibling.textContent.endsWith(Constants.ZWSP)) {
        imgPreviousSibling.textContent = imgPreviousSibling.textContent.substring(0, imgPreviousSibling.textContent.length - 1);
    }
    const imgNextSibling = hasNextSibling(imgSelectElement);
    if (imgNextSibling && imgNextSibling.textContent.startsWith(Constants.ZWSP)) {
        imgNextSibling.textContent = imgNextSibling.textContent.replace(Constants.ZWSP, "");
    }
    imgSelectElement.insertAdjacentHTML("afterend", "<wbr>");
    imgSelectElement.remove();
    updateTransaction(protyle, nodeElement, oldHTML);
    focusByWbr(nodeElement, range);
    // 不太清楚为什么删除图片后无法上下键定位，但重绘后就好了 https://ld246.com/article/1714314625702
    const editElement = getContenteditableElement(nodeElement);
    if (editElement.innerHTML.trim() === "") {
        editElement.innerHTML = "";
    }
};
