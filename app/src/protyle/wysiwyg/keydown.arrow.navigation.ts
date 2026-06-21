import { hasClosestByAttribute, hasClosestByTag } from "../util/hasClosest";
import { getContenteditableElement, getFirstBlock, getLastBlock, getNextBlock, getPreviousBlock } from "./getBlock";
import { focusBlock, focusByRange, getSelectionOffset, getSelectionPosition, setLastNodeRange } from "../util/selection";
import { insertEmptyBlock } from "../../block/util";
import { isNotCtrl } from "../util/compatibility";
import { scrollCenter } from "../../util/DOM/highlightById";

export const arrowNavigationMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
): Promise<void> => {
    // 上下左右光标移动
    if (!event.altKey && !event.shiftKey && isNotCtrl(event) && !event.isComposing && (event.key.indexOf("Arrow") > -1)) {
        // 需使用 editabled，否则代码块会把语言字数算入
        const tdElement = hasClosestByTag(range.startContainer, "TD") || hasClosestByTag(range.startContainer, "TH");
        const nodeEditableElement = (tdElement || getContenteditableElement(nodeElement) || nodeElement) as HTMLElement;
        const wysiwygElement = protyle.wysiwyg?.element;
        const position = getSelectionOffset(nodeEditableElement, wysiwygElement, range);
        if (nodeElement.classList.contains("code-block") && position.end === nodeEditableElement.innerText.length) {
            // 代码块换最后一个 /n 肉眼是无法区分是否在其后的，因此统一在之前
            position.end -= 1;
        }

        const selectText = range.toString();

        // 需使用 innerText 否则表格内 br 无法转换为 /n
        if (event.key === "ArrowDown" && nodeEditableElement?.innerText.trimRight().substr(position.start).indexOf("\n") === -1 && (
            (tdElement && tdElement.parentElement && !tdElement.parentElement.nextElementSibling && nodeElement.getAttribute("data-type") === "NodeTable" && !getNextBlock(nodeElement)) ||
            (nodeElement.getAttribute("data-type") === "NodeCodeBlock" && !getNextBlock(nodeElement)) ||
            (nodeElement.parentElement && nodeElement.parentElement.getAttribute("data-type") === "NodeBlockquote" && nodeElement.nextElementSibling && nodeElement.nextElementSibling.classList.contains("protyle-attr") && !getNextBlock(nodeElement.parentElement)) ||
            (nodeElement.parentElement && nodeElement.parentElement.classList.contains("callout-content") && !nodeElement.nextElementSibling && nodeElement.parentElement.parentElement && !getNextBlock(nodeElement.parentElement.parentElement))
        )) {
            // 跳出代码块和bq
            if (nodeElement.parentElement && nodeElement.parentElement.getAttribute("data-type") === "NodeBlockquote") {
                const parentId = nodeElement.parentElement.getAttribute("data-node-id");
                if (parentId) {
                    insertEmptyBlock(protyle, "afterend", parentId);
                }
            } else if (nodeElement.parentElement && nodeElement.parentElement.classList.contains("callout-content") && nodeElement.parentElement.parentElement) {
                // 跳出 callout 块
                const calloutId = nodeElement.parentElement.parentElement.getAttribute("data-node-id");
                if (calloutId) {
                    insertEmptyBlock(protyle, "afterend", calloutId);
                }
            } else {
                const nodeId = nodeElement.getAttribute("data-node-id");
                if (nodeId) {
                    insertEmptyBlock(protyle, "afterend", nodeId);
                }
            }
        } else if (event.key === "ArrowUp") {
            const firstChild = wysiwygElement?.firstElementChild;
            const firstEditElement = firstChild ? getContenteditableElement(firstChild) : null;

            if (
                (!getPreviousBlock(nodeElement) &&  // 列表第一个块为嵌入块，第二个块为段落块，上键应选中第一个块 https://ld246.com/article/1652667912155
                    firstEditElement && nodeElement.contains(firstEditElement))
                ||
                (!firstEditElement && nodeElement === firstChild)
            ) {
                // 不能用\n判断，否则文字过长折行将错误 https://github.com/siyuan-note/siyuan/issues/6156
                const diff = getSelectionPosition(nodeEditableElement, range).top - nodeEditableElement.getBoundingClientRect().top;
                if ((diff < 20 && diff !== 0) || nodeElement.classList.contains("av")) {
                    if (protyle.title && protyle.title.editElement &&
                        (firstChild?.getAttribute("data-eof") === "1" ||
                            protyle.contentElement?.scrollTop === 0)) {
                        const titleRange = setLastNodeRange(protyle.title.editElement, range, false);
                        titleRange.collapse(false);
                        focusByRange(titleRange);
                        event.stopPropagation();
                        event.preventDefault();
                    } else if (protyle.contentElement) {
                        protyle.contentElement.scrollTop = 0;
                        if (protyle.scroll) {
                            protyle.scroll.lastScrollTop = 8;
                        }
                    }
                }
            } else {
                if (((nodeEditableElement?.innerText.substr(0, position.end).indexOf("\n") === -1 || position.start === 0) &&
                    getSelectionPosition(nodeEditableElement, range).top - nodeEditableElement.getBoundingClientRect().top < 20)) {
                    let previousElement: HTMLElement = getPreviousBlock(nodeElement) as HTMLElement;
                    if (previousElement) {
                        previousElement = getLastBlock(previousElement) as HTMLElement;
                        if (previousElement) {
                            const foldElement = hasClosestByAttribute(previousElement, "fold", "1") as HTMLElement;
                            // 代码块或以软换行结尾的块移动光标 ↑ 会跳过 https://github.com/siyuan-note/siyuan/issues/5498
                            // 代码块全选后 ↑ 光标不会上移 https://github.com/siyuan-note/siyuan/issues/11581
                            // 段落块不能设置，否则 ↑ 后光标位置不能保持 https://github.com/siyuan-note/siyuan/issues/12710
                            if (!foldElement && previousElement.classList.contains("code-block")) {
                                focusBlock(previousElement, undefined, false);
                                scrollCenter(protyle, previousElement);
                                event.stopPropagation();
                                event.preventDefault();
                            } else if (foldElement) {
                                // 遇到折叠块
                                foldElement.scrollTop = 0;
                                focusBlock(foldElement, undefined, true);
                                scrollCenter(protyle, foldElement);
                                event.stopPropagation();
                                event.preventDefault();
                            } else {
                                // 修正光标上移至 \n 结尾的块时落点错误 https://github.com/siyuan-note/siyuan/issues/14443
                                const prevEditableElement = getContenteditableElement(previousElement) as HTMLElement;
                                if (prevEditableElement && prevEditableElement.lastChild?.nodeType === 3 &&
                                    prevEditableElement.lastChild?.textContent && prevEditableElement.lastChild.textContent.endsWith("\n")) {
                                    //  不能移除 /n, 否则两个 /n 导致界面异常
                                    focusBlock(previousElement, undefined, false);
                                    event.preventDefault();
                                    event.stopPropagation();
                                    controller.abort("上箭头导航：处理以换行结尾的块");
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        } else if (selectText === "" && (event.key === "ArrowDown" || event.key === "ArrowRight")) {
            const lastChild = wysiwygElement?.lastElementChild;
            const lastBlock = lastChild ? getLastBlock(lastChild) : null;

            if (lastBlock && nodeElement === lastBlock &&
                // 表格无法右移动 https://ld246.com/article/1631434502215
                !hasClosestByTag(range.startContainer, "TD") && !hasClosestByTag(range.startContainer, "TH")) {
                // 页面按向下/右箭头丢失焦点 https://ld246.com/article/1629954026096
                const lastEditElement = getContenteditableElement(nodeElement);
                // 代码块需替换最后一个 /n  https://github.com/siyuan-note/siyuan/issues/3221
                if (lastEditElement && !nodeElement.classList.contains("table") &&
                    !lastEditElement.querySelector(".emoji") && lastEditElement.textContent && lastEditElement.textContent.replace(/\n$/, "").length <= getSelectionOffset(lastEditElement, undefined, range).end) {
                    event.stopPropagation();
                    event.preventDefault();
                    focusByRange(range);
                }
            }
        } else if (selectText === "" && event.key === "ArrowLeft") {
            const firstChild = wysiwygElement?.firstElementChild;
            const firstBlock = firstChild ? getFirstBlock(firstChild) : null;

            if (firstBlock && nodeElement === firstBlock) {
                // 页面向左箭头丢失焦点 https://github.com/siyuan-note/siyuan/issues/2768
                const firstEditElement = getContenteditableElement(nodeElement);
                if (firstEditElement && !nodeElement.classList.contains("table") &&
                    range.startOffset === 0 && range.collapsed &&
                    getSelectionOffset(firstEditElement, undefined, range).start === 0) {
                    event.stopPropagation();
                    event.preventDefault();
                    focusByRange(range);
                }
            }
        }

        if (event.key === "ArrowDown") {
            if (nodeEditableElement?.innerText.trimRight().substr(position.start).indexOf("\n") === -1 &&
                nodeElement === (wysiwygElement?.lastElementChild ? getLastBlock(wysiwygElement.lastElementChild) : null)) {
                const editableElement = getContenteditableElement(nodeEditableElement);
                if (editableElement) {
                    setLastNodeRange(editableElement, range, false);
                    range.collapse(false);
                    event.stopPropagation();
                    event.preventDefault();
                    controller.abort("方向键导航：设置光标在最后一块末尾");
                    return;
                }
            }
            const foldElement = hasClosestByAttribute(range.startContainer, "fold", "1");
            if (foldElement) {
                // 本身为折叠块
                let nextElement = getNextBlock(foldElement) as HTMLElement;
                if (nextElement) {
                    if (nextElement.getAttribute("fold") === "1"
                        && (nextElement.classList.contains("sb") || nextElement.classList.contains("bq"))) {
                        // https://github.com/siyuan-note/siyuan/issues/3913
                    } else {
                        nextElement = getFirstBlock(nextElement) as HTMLElement;
                    }
                    focusBlock(nextElement);
                    scrollCenter(protyle, nextElement);
                }
                event.stopPropagation();
                event.preventDefault();
            } else if (nodeEditableElement?.innerText.substr(position.end).indexOf("\n") === -1 || position.end >= nodeEditableElement.innerText.trimEnd().length) {
                // 需使用 innerText，否则 td 中的 br 无法转换为 \n; position.end 不能加1，否则倒数第二行行末无法下移
                range.collapse(false);
                const nextElement = getNextBlock(nodeElement) as HTMLElement;
                if (nextElement &&
                    (nextElement.getAttribute("fold") === "1" || nextElement.classList.contains("code-block")) &&
                    nodeEditableElement.getBoundingClientRect().bottom - getSelectionPosition(nodeElement, range).top < 40) {
                    focusBlock(nextElement);
                    scrollCenter(protyle, nextElement);
                    event.stopPropagation();
                    event.preventDefault();
                }
            }
        }
        controller.abort("方向键导航：移动到下一个块");
        return;
    }
};
