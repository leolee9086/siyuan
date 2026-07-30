import { hasClosestBlock, hasClosestByAttribute, hasClosestByTag } from "../util/hasClosest";
import { getContenteditableElement, getTopAloneElement, hasNextSibling, hasPreviousSibling } from "./getBlock";
import { isEndOfBlock } from "./getBlock";
import { getSelectionOffset } from "../util/selection";
import { matchHotKey } from "../util/hotKey";
import {
    getImageBlockRefCheckTargets,
    getRangeBlockRefCheckTargets,
    removeBlock,
    removeCrossBlockRange,
    removeImage,
} from "./remove";
import {updateTransaction} from "./transaction/update";
import { clearTableCell } from "../util/table/table";
import { getNextBlock } from "./getBlock";
import { focusBlock, focusByWbr, setFirstNodeRange } from "../util/selection";
import { Constants } from "../../constants";
import { isOnlyMeta } from "../util/compatibility";
import {confirmBlockRefForBlocks} from "../../util/checkBlockRef";

export const deleteKeyMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    // 删除，不可使用 isNotCtrl(event)，否则软删除回导致 https://github.com/siyuan-note/siyuan/issues/5607
    // 不可使用 !event.shiftKey，否则 https://ld246.com/article/1666434796806
    const selectText = range.toString();
    if (
        (!event.altKey && (event.key === "Backspace" || event.key === "Delete")) ||
        matchHotKey("⌃D", event)) {
        const endElement = hasClosestBlock(range.endContainer);
        const isCrossBlock = Boolean(endElement && nodeElement !== endElement);
        const rangeCheckTargets = !range.collapsed && endElement ?
            getRangeBlockRefCheckTargets(protyle.wysiwyg.element, range, nodeElement, endElement, true) :
            {elements: [], exactIDs: []};
        if (endElement && ((isCrossBlock && selectText !== "") || rangeCheckTargets.elements.length > 0)) {
            event.stopPropagation();
            event.preventDefault();
            controller.abort("删除跨块选区");
            await removeCrossBlockRange(protyle, range, nodeElement, endElement);
            return;
        }
        if (protyle.wysiwyg?.element.querySelector(".protyle-wysiwyg--select")) {
            removeBlock(protyle, nodeElement, range, event.key === "Backspace" ? "Backspace" : "Delete");
            event.stopPropagation();
            event.preventDefault();
            controller.abort("删除选中的块");
            return;
        }
        // https://github.com/siyuan-note/siyuan/issues/6796
        if (selectText === "" && event.key === "Backspace" &&
            range.startOffset === range.startContainer.textContent?.length &&
            range.startContainer.textContent.endsWith("\n" + Constants.ZWSP)) {
            range.setStart(range.startContainer, range.startOffset - 1);
            range.collapse(true);
            event.stopPropagation();
            event.preventDefault();
            controller.abort("删除行尾的换行符");
            return;
        }
        const previousSibling = hasPreviousSibling(range.startContainer);
        // https://github.com/siyuan-note/siyuan/issues/5547
        if (range.startOffset === 1 && range.startContainer.textContent === Constants.ZWSP &&
            previousSibling && previousSibling.nodeType !== 3 &&
            event.key === "Backspace" // https://github.com/siyuan-note/siyuan/issues/6786
        ) {
            if (!(previousSibling instanceof HTMLElement)) {
                console.error(previousSibling);
                throw new Error("DOM结构错误");
            }
            const nodeDataType = previousSibling.getAttribute("data-type");
            if (!nodeDataType) {
                console.error(previousSibling);
                throw new Error("DOM结构错误,缺少data-type");
            }
            if (previousSibling.classList.contains("img")) {
                previousSibling.classList.add("img--select");
            } else if (nodeDataType.indexOf("inline-math") > -1) {
                // 数学公式相邻中有 zwsp,无法删除
                previousSibling.after(document.createElement("wbr"));
                const oldHTML = nodeElement.outerHTML;
                range.startContainer.textContent = "";
                previousSibling.remove();
                updateTransaction(protyle, nodeElement, oldHTML);
                focusByWbr(nodeElement, range);
                event.stopPropagation();
                event.preventDefault();
                controller.abort("删除相邻的数学公式");
                return;
            }
        }
        const editElement = getContenteditableElement(nodeElement);
        if (!protyle.wysiwyg) {
            throw new Error("protyle结构错误");
        }
        const imgSelectElement = protyle.wysiwyg.element.querySelector(".img--select");
        if (imgSelectElement) {
            if (nodeElement.contains(imgSelectElement)) {
                const checkTargets = getImageBlockRefCheckTargets(nodeElement, imgSelectElement);
                const checkIDs = checkTargets.elements.flatMap(item => {
                    const id = item.getAttribute("data-node-id");
                    return id ? [id] : [];
                });
                if (checkIDs.length > 0) {
                    event.stopPropagation();
                    event.preventDefault();
                    controller.abort("检查图片删除引用");
                    if (!await confirmBlockRefForBlocks(protyle, checkIDs, checkTargets.exactIDs) ||
                        checkTargets.elements.some(item => !item.isConnected)) {
                        return;
                    }
                }
                imgSelectElement.classList.remove("img--select");
                removeImage(imgSelectElement, nodeElement, range, protyle);
                event.stopPropagation();
                event.preventDefault();
                controller.abort("删除选中的图片");
                return;
            }
            imgSelectElement.classList.remove("img--select");
        } else if (selectText === "") {

            if (nodeElement.classList.contains("table")) {
                const tableSelectElement = nodeElement.querySelector(".table__select");
                if (tableSelectElement && tableSelectElement.clientHeight > 0) {
                    clearTableCell(protyle, nodeElement);
                    event.stopPropagation();
                    event.preventDefault();
                    controller.abort("清除表格单元格内容");
                    return;
                }
            }
            if (!editElement) {
                nodeElement.classList.add("protyle-wysiwyg--select");
                removeBlock(protyle, nodeElement, range, event.key === "Backspace" ? "Backspace" : "Delete");
                event.stopPropagation();
                event.preventDefault();
                controller.abort("删除不可编辑的块");
                return;
            }
            const position = getSelectionOffset(editElement, protyle.wysiwyg.element, range);
            if (event.key === "Delete" || matchHotKey("⌃D", event)) {
                if (range.startOffset === 0 && range.startContainer.textContent.length === 1) {
                    // 图片后为空格，在空格后删除 https://github.com/siyuan-note/siyuan/issues/13949
                    const rangePreviousElement = hasPreviousSibling(range.startContainer) as HTMLElement;
                    const rangeNextElement = hasNextSibling(range.startContainer) as HTMLElement;
                    if (rangePreviousElement && rangePreviousElement.nodeType === 1 && rangePreviousElement.classList.contains("img") &&
                        rangeNextElement && rangeNextElement.nodeType === 1 && rangeNextElement.classList.contains("img")) {
                        const wbrElement = document.createElement("wbr");
                        range.insertNode(wbrElement);
                        const oldHTML = nodeElement.outerHTML;
                        wbrElement.nextSibling.textContent = Constants.ZWSP;
                        updateTransaction(protyle, nodeElement, oldHTML);
                        focusByWbr(nodeElement, range);
                        event.preventDefault();
                        controller.abort("删除图片后的空格");
                        return;
                    }
                    // 图片前有一个字符，在字符后删除 https://github.com/siyuan-note/siyuan/issues/15911
                    if (position.start === 0 &&
                        range.startContainer.textContent !== Constants.ZWSP &&  // 如果为 zwsp 需前移光标
                        !rangePreviousElement &&
                        rangeNextElement && rangeNextElement.nodeType === 1 && rangeNextElement.classList.contains("img")) {
                        const wbrElement = document.createElement("wbr");
                        range.insertNode(wbrElement);
                        const oldHTML = nodeElement.outerHTML;
                        wbrElement.nextSibling.textContent = Constants.ZWSP;
                        updateTransaction(protyle, nodeElement, oldHTML);
                        focusByWbr(nodeElement, range);
                        event.preventDefault();
                        controller.abort("删除图片前的字符");
                        return;
                    }
                }
                // 需使用 innerText，否则 br 无法传唤为 /n https://github.com/siyuan-note/siyuan/issues/12066
                // 段末反向删除 https://github.com/siyuan-note/insider/issues/274
                if (isEndOfBlock(range) || editElement.textContent.substring(position.start) === "\n") {
                    const cloneRange = range.cloneRange();
                    const nextElement = getNextBlock(getTopAloneElement(nodeElement));
                    if (nextElement) {
                        const nextRange = focusBlock(nextElement);
                        if (nextRange) {
                            const nextBlockElement = hasClosestBlock(nextRange.startContainer);
                            if (nextBlockElement &&
                                (!nextBlockElement.classList.contains("code-block") ||
                                    (nextBlockElement.classList.contains("code-block") &&
                                        (getContenteditableElement(nextBlockElement).textContent == "\n") || nextBlockElement.parentElement.classList.contains("li")))
                            ) {
                                // 反向删除合并为一个块时，光标应保持在尾部 https://github.com/siyuan-note/siyuan/issues/14290#issuecomment-2849810529
                                cloneRange.insertNode(document.createElement("wbr"));
                                removeBlock(protyle, nextBlockElement, nextRange, "Delete");
                            }
                        }
                        event.stopPropagation();
                        event.preventDefault();
                        controller.abort("删除并合并下一个块");
                        return;
                    }
                } else if (position.end === editElement.innerText.length - 1 && nodeElement.getAttribute("data-type") === "NodeCodeBlock") {
                    event.stopPropagation();
                    event.preventDefault();
                    controller.abort("代码块末尾删除操作");
                    return;
                } else {
                    // 图片前 Delete 无效 https://github.com/siyuan-note/siyuan/issues/11209
                    let nextSibling = hasNextSibling(range.startContainer) as Element;
                    if (nextSibling) {
                        if (nextSibling.nodeType === 3 && nextSibling.textContent === Constants.ZWSP) {
                            if (!nextSibling.nextSibling) {
                                // https://github.com/siyuan-note/siyuan/issues/13524
                                const nextBlockElement = getNextBlock(nodeElement);
                                if (nextBlockElement) {
                                    removeBlock(protyle, nextBlockElement, range, "remove");
                                }
                                event.stopPropagation();
                                event.preventDefault();
                                controller.abort("删除下一个块");
                                return;
                            }
                            nextSibling = nextSibling.nextSibling as Element;
                        }

                        if (nextSibling.nodeType === 1 && nextSibling.classList.contains("img")) {
                            // 光标需在图片前 https://github.com/siyuan-note/siyuan/issues/12452
                            const textPosition = getSelectionOffset(range.startContainer, protyle.wysiwyg.element, range);
                            if (textPosition.start === range.startContainer.textContent.length ||
                                (textPosition.start === 0 && range.startContainer.textContent === Constants.ZWSP)) {
                                removeImage(nextSibling as Element, nodeElement, range, protyle);
                                event.stopPropagation();
                                event.preventDefault();
                                controller.abort("删除光标后的图片");
                                return;
                            }
                        }
                    }
                }
            } else {
                const currentNode = range.startContainer.childNodes[range.startOffset - 1] as HTMLElement;
                if (position.start === 0 && (
                    range.startOffset === 0 ||
                    (currentNode && currentNode.nodeType === 3 && !hasPreviousSibling(currentNode) &&
                        // 需使用 textContent，文本元素没有 innerText
                        currentNode.textContent === "") // https://ld246.com/article/1649251218696
                )) {
                    if (!nodeElement.classList.contains("code-block") ||
                        (nodeElement.classList.contains("code-block") &&
                            (editElement.textContent == "\n" || nodeElement.parentElement.classList.contains("li")))
                    ) {
                        removeBlock(protyle, nodeElement, range, "Backspace");
                    }
                    event.stopPropagation();
                    event.preventDefault();
                    controller.abort("删除当前块");
                    return;
                }
                if (range.startContainer.nodeType !== 3 &&
                    nodeElement.getAttribute("data-type") === "NodeTable" &&
                    (range.startContainer as HTMLElement).children[range.startOffset - 1]?.tagName === "TABLE") {
                    nodeElement.classList.add("protyle-wysiwyg--select");
                    removeBlock(protyle, nodeElement, range, "Backspace");
                    event.stopPropagation();
                    event.preventDefault();
                    controller.abort("删除表格块");
                    return;
                }
                // 图片后为 br，在 br 后删除 https://github.com/siyuan-note/siyuan/issues/4963
                if (currentNode && currentNode.nodeType !== 3 && currentNode.classList.contains("img")) {
                    removeImage(currentNode, nodeElement, range, protyle);
                    event.stopPropagation();
                    event.preventDefault();
                    controller.abort("删除光标位置的图片");
                    return;
                }
                const rangeNextElement = hasNextSibling(range.startContainer) as HTMLElement;
                // \n1`2` 1后按 Backspace 光标错误 https://github.com/siyuan-note/siyuan/issues/15424
                if (rangeNextElement && rangeNextElement.nodeType === 1 &&
                    ["code", "tag", "kbd"].includes(rangeNextElement.dataset.type)) {
                    if (position.start === 1 || range.startContainer.textContent.slice(-2, -1) === "\n") {
                        range.insertNode(document.createTextNode(Constants.ZWSP));
                        range.collapse(true);
                    }
                }
                if (range.startOffset === 1 && range.startContainer.textContent.length === 1) {
                    // 图片后为空格，在空格后删除 https://github.com/siyuan-note/siyuan/issues/13949
                    const rangePreviousElement = hasPreviousSibling(range.startContainer) as HTMLElement;
                    if (rangePreviousElement && rangePreviousElement.nodeType === 1 && rangePreviousElement.classList.contains("img") &&
                        rangeNextElement && rangeNextElement.nodeType === 1 && rangeNextElement.classList.contains("img")) {
                        const wbrElement = document.createElement("wbr");
                        range.insertNode(wbrElement);
                        const oldHTML = nodeElement.outerHTML;
                        wbrElement.previousSibling.textContent = Constants.ZWSP;
                        updateTransaction(protyle, nodeElement, oldHTML);
                        focusByWbr(nodeElement, range);
                        event.preventDefault();
                        controller.abort("删除图片后的空格");
                        return;
                    }
                    // 图片前有一个字符，在字符后删除
                    if (position.start === 1 &&
                        range.startContainer.textContent !== Constants.ZWSP &&  // 如果为 zwsp 需前移光标
                        !rangePreviousElement &&
                        rangeNextElement && rangeNextElement.nodeType === 1 && rangeNextElement.classList.contains("img")) {
                        const wbrElement = document.createElement("wbr");
                        range.insertNode(wbrElement);
                        const oldHTML = nodeElement.outerHTML;
                        wbrElement.previousSibling.textContent = Constants.ZWSP;
                        updateTransaction(protyle, nodeElement, oldHTML);
                        focusByWbr(nodeElement, range);
                        event.preventDefault();
                        controller.abort("删除图片前的字符");
                        return;
                    }
                }
                // 代码块中空行 ⌘+Del 异常 https://ld246.com/article/1663166544901
                if (nodeElement.classList.contains("code-block") && isOnlyMeta(event) &&
                    range.startContainer.nodeType === 3 && range.startContainer.textContent.substring(range.startOffset - 1, range.startOffset) === "\n") {
                    event.stopPropagation();
                    event.preventDefault();
                    controller.abort("代码块中的换行删除");
                    return;
                }
                // https://github.com/siyuan-note/siyuan/issues/9690
                const inlineElement = hasClosestByTag(range.startContainer, "SPAN");
                if (position.start === 2 && inlineElement &&
                    getSelectionOffset(inlineElement, protyle.wysiwyg.element, range).start === 1 &&
                    inlineElement.innerText.startsWith(Constants.ZWSP) &&
                    // 7.1 ctrl+g 后删除 https://github.com/siyuan-note/siyuan/issues/14290#issuecomment-2867478746
                    inlineElement.innerText !== Constants.ZWSP &&
                    // 需排除行内代码前有一个字符的情况
                    editElement.innerText.startsWith(Constants.ZWSP)) {
                    focusBlock(nodeElement);
                    event.stopPropagation();
                    event.preventDefault();
                    controller.abort("处理行内元素前的零宽空格");
                    return;
                }
                if (position.start === 1 && !inlineElement && editElement.innerText.startsWith(Constants.ZWSP) &&
                    // https://github.com/siyuan-note/siyuan/issues/12149
                    editElement.innerText.length > 1) {
                    setFirstNodeRange(editElement, range);
                    removeBlock(protyle, nodeElement, range, "Backspace");
                    event.stopPropagation();
                    event.preventDefault();
                    controller.abort("删除仅包含零宽空格的块");
                    return;
                }
            }
        } else if (nodeElement.classList.contains("code-block") && editElement.textContent === "\n") {
            // 空代码块全选删除异常 https://github.com/siyuan-note/siyuan/issues/6706
            range.collapse(true);
            event.stopPropagation();
            event.preventDefault();
            controller.abort("空代码块删除操作");
            return;
        } else if (selectText !== "") {
            const position = getSelectionOffset(editElement, protyle.wysiwyg.element, range);
            if (range.startOffset === 0 && range.endContainer.textContent.length === range.endOffset) {
                // 图片后为空格，在空格后删除 https://github.com/siyuan-note/siyuan/issues/13949
                // 图片前有一个字符，在字符后删除 https://github.com/siyuan-note/siyuan/issues/15911
                const rangePreviousElement = hasPreviousSibling(range.startContainer) as HTMLElement;
                const rangeNextElement = hasNextSibling(range.endContainer) as HTMLElement;
                if ((rangePreviousElement && rangePreviousElement.nodeType === 1 && rangePreviousElement.classList.contains("img") &&
                    rangeNextElement && rangeNextElement.nodeType === 1 && rangeNextElement.classList.contains("img")) ||
                    (position.start === 0 &&
                        range.startContainer.textContent !== Constants.ZWSP &&  // 如果为 zwsp 需前移光标
                        !rangePreviousElement &&
                        rangeNextElement && rangeNextElement.nodeType === 1 && rangeNextElement.classList.contains("img"))) {
                    range.insertNode(document.createElement("wbr"));
                    const oldHTML = nodeElement.outerHTML;
                    range.deleteContents();
                    range.insertNode(document.createTextNode(Constants.ZWSP));
                    range.insertNode(document.createElement("wbr"));
                    updateTransaction(protyle, nodeElement, oldHTML);
                    focusByWbr(nodeElement, range);
                    event.preventDefault();
                    controller.abort("删除选中的文本内容");
                    return;
                }
            }
        }
    }
};
