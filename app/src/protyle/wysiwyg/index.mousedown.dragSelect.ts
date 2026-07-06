import {
    hasClosestBlock,
    hasClosestByClassName,
    hasClosestByTag,
    isInEmbedBlock,
} from "../util/hasClosest";
import {
    focusBlock,
    setFirstNodeRange,
    setLastNodeRange,
} from "../util/selection";
import {getContenteditableElement} from "./getBlock";
import {Constants} from "../../constants";
import {hideElements} from "../ui/hideElements";
import {countBlockWord} from "../../layout/status";
import {buildTableCellMenu} from "./index.mousedown.tableMenu";

export interface DragSelectContext {
    protyle: IProtyle;
    event: MouseEvent;
    target: HTMLElement;
    nodeElement: HTMLElement | false;
    tableBlockElement: HTMLElement | false;
    documentSelf: Document;
    clentX: number;
    mostTop: number;
    mostRight: number;
    mostLeft: number;
    mostBottom: number;
    y: number;
    contentRect: DOMRect;
    wysiwygElement: HTMLElement;
}

/**
 * 设置多节点框选的 onmousemove 和 onmouseup 处理器。
 * 包含表格单元格拖选和多块节点框选两种模式。
 */
export function setupDragSelect(ctx: DragSelectContext): void {
    const {
        protyle, event, target, tableBlockElement, documentSelf,
        clentX, mostTop, mostRight, mostLeft, mostBottom, y,
        contentRect, wysiwygElement,
    } = ctx;

    let mouseElement: Element;
    let moveCellElement: HTMLElement;
    let startFirstElement: Element;
    let endLastElement: Element;
    wysiwygElement.querySelectorAll("iframe").forEach(item => {
        item.style.pointerEvents = "none";
    });
    const needScroll = ["IMG", "VIDEO", "AUDIO"].includes(target.tagName) || target.classList.contains("img");

    documentSelf.onmousemove = (moveEvent: MouseEvent) => {
        const moveResult = handleDragMoveTableCell(moveEvent, target, tableBlockElement, moveCellElement, protyle);
        if (moveResult.handled) {
            moveCellElement = moveResult.moveCellElement;
            return moveResult.returnValue;
        }
        moveCellElement = moveResult.moveCellElement;

        handleDragMoveScroll(moveEvent, needScroll, contentRect, protyle);

        const selectResult = handleDragMoveBlockSelect(
            moveEvent, protyle, clentX, y, mostLeft, mostRight, mostTop, mostBottom,
            mouseElement, startFirstElement, endLastElement,
        );
        mouseElement = selectResult.mouseElement;
        startFirstElement = selectResult.startFirstElement;
        endLastElement = selectResult.endLastElement;
    };

    documentSelf.onmouseup = (mouseUpEvent) => {
        documentSelf.onmousemove = null;
        documentSelf.onmouseup = null;
        documentSelf.ondragstart = null;
        documentSelf.onselectstart = null;
        documentSelf.onselect = null;
        startFirstElement = undefined;
        endLastElement = undefined;
        // 多选表格单元格后，选择菜单中的居左，然后 shift+左 选中的文字无法显示选中背景，因此需移除
        // 多选块后 shift+左 选中的文字无法显示选中背景，因此需移除
        protyle.wysiwyg.element.classList.remove("protyle-wysiwyg--hiderange");
        wysiwygElement.querySelectorAll("iframe").forEach(item => {
            item.style.pointerEvents = "";
        });
        protyle.selectElement.classList.add("fn__none");
        protyle.selectElement.removeAttribute("style");

        handleMouseUpTableMenu(protyle, tableBlockElement, mouseUpEvent);
        handleMouseUpBlockCount(protyle);
        handleMouseUpRangeCleanup(protyle, event, mouseUpEvent);
    };
}

interface TableCellMoveResult {
    handled: boolean;
    returnValue?: false | void;
    moveCellElement: HTMLElement;
}

function handleDragMoveTableCell(
    moveEvent: MouseEvent,
    target: HTMLElement,
    tableBlockElement: HTMLElement | false,
    moveCellElement: HTMLElement,
    protyle: IProtyle,
): TableCellMoveResult {
    let moveTarget: boolean | HTMLElement = moveEvent.target as HTMLElement;
    // table cell select
    if (tableBlockElement &&
        !hasClosestByClassName(tableBlockElement, "protyle-wysiwyg__embed")) {
        if (tableBlockElement.contains(moveTarget)) {
            if (moveTarget.classList.contains("table__select")) {
                moveTarget.classList.add("fn__none");
                const pointElement = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
                moveTarget.classList.remove("fn__none");
                moveTarget = hasClosestByTag(pointElement, "TH") || hasClosestByTag(pointElement, "TD");
            }
            if (moveTarget && moveTarget === target) {
                tableBlockElement.querySelector(".table__select").removeAttribute("style");
                protyle.wysiwyg.element.classList.remove("protyle-wysiwyg--hiderange");
                return {handled: true, returnValue: false, moveCellElement: moveTarget};
            }
            if (moveTarget && (moveTarget.tagName === "TH" || moveTarget.tagName === "TD") &&
                (!moveCellElement || moveCellElement !== moveTarget)) {
                computeTableSelectRect(target, moveTarget, tableBlockElement, protyle);
                return {handled: true, moveCellElement: moveTarget};
            }
            return {handled: true, moveCellElement};
        } else {
            tableBlockElement.querySelector(".table__select").removeAttribute("style");
            return {handled: false, moveCellElement: undefined};
        }
    }
    return {handled: false, moveCellElement};
}

function computeTableSelectRect(
    target: HTMLElement,
    moveTarget: HTMLElement | boolean,
    tableBlockElement: HTMLElement,
    protyle: IProtyle,
) {
    if (typeof moveTarget === "boolean") {
return;
}
    tableBlockElement.firstElementChild.style.webkitUserModify = "read-only";
    let width = target.offsetLeft + target.clientWidth - moveTarget.offsetLeft;
    let left = moveTarget.offsetLeft;
    if (target.offsetLeft === moveTarget.offsetLeft) {
        width = Math.max(target.clientWidth, moveTarget.clientWidth);
    } else if (target.offsetLeft < moveTarget.offsetLeft) {
        width = moveTarget.offsetLeft + moveTarget.clientWidth - target.offsetLeft;
        left = target.offsetLeft;
    }
    let height = target.offsetTop + target.clientHeight - moveTarget.offsetTop;
    let top = moveTarget.offsetTop;
    if (target.offsetTop === moveTarget.offsetTop) {
        height = Math.max(target.clientHeight, moveTarget.clientHeight);
    } else if (target.offsetTop < moveTarget.offsetTop) {
        height = moveTarget.offsetTop + moveTarget.clientHeight - target.offsetTop;
        top = target.offsetTop;
    }
    // https://github.com/siyuan-note/insider/issues/1015
    Array.from(tableBlockElement.querySelectorAll("th, td")).find((item: HTMLElement) => {
        const updateWidth = item.offsetLeft < left + width && item.offsetLeft + item.clientWidth > left + width;
        const updateWidth2 = item.offsetLeft < left && item.offsetLeft + item.clientWidth > left;
        if (item.offsetTop < top && item.offsetTop + item.clientHeight > top) {
            if ((item.offsetLeft + 6 > left && item.offsetLeft + item.clientWidth - 6 < left + width) || updateWidth || updateWidth2) {
                height = top + height - item.offsetTop;
                top = item.offsetTop;
            }
            if (updateWidth) {
                width = item.offsetLeft + item.clientWidth - left;
            }
            if (updateWidth2) {
                width = left + width - item.offsetLeft;
                left = item.offsetLeft;
            }
        } else if (item.offsetTop < top + height && item.offsetTop + item.clientHeight > top + height) {
            if ((item.offsetLeft + 6 > left && item.offsetLeft + item.clientWidth - 6 < left + width) || updateWidth || updateWidth2) {
                height = item.clientHeight + item.offsetTop - top;
            }
            if (updateWidth) {
                width = item.offsetLeft + item.clientWidth - left;
            }
            if (updateWidth2) {
                width = left + width - item.offsetLeft;
                left = item.offsetLeft;
            }
        } else if (updateWidth2 && item.offsetTop + 6 > top && item.offsetTop + item.clientHeight - 6 < top + height) {
            width = left + width - item.offsetLeft;
            left = item.offsetLeft;
        } else if (updateWidth && item.offsetTop + 6 > top && item.offsetTop + item.clientHeight - 6 < top + height) {
            width = item.offsetLeft + item.clientWidth - left;
        }
    });
    protyle.wysiwyg.element.classList.add("protyle-wysiwyg--hiderange");
    tableBlockElement.querySelector(".table__select").setAttribute("style", `left:${left - tableBlockElement.firstElementChild.scrollLeft}px;top:${top - tableBlockElement.querySelector("table").scrollTop}px;height:${height}px;width:${width + 1}px;`);
}

function handleDragMoveScroll(
    moveEvent: MouseEvent,
    needScroll: boolean,
    contentRect: DOMRect,
    protyle: IProtyle,
) {
    // 在包含 img， video， audio 的元素上划选后无法上下滚动 https://ld246.com/article/1681778773806
    // 在包含 img， video， audio 的元素上拖拽无法划选 https://github.com/siyuan-note/siyuan/issues/11763
    if (needScroll) {
        if (moveEvent.clientY < contentRect.top + Constants.SIZE_SCROLL_TB || moveEvent.clientY > contentRect.bottom - Constants.SIZE_SCROLL_TB) {
            protyle.contentElement.scroll({
                top: protyle.contentElement.scrollTop + (moveEvent.clientY < contentRect.top + Constants.SIZE_SCROLL_TB ? -Constants.SIZE_SCROLL_STEP : Constants.SIZE_SCROLL_STEP),
                behavior: "smooth"
            });
        }
    }
}

interface BlockSelectResult {
    mouseElement: Element;
    startFirstElement: Element;
    endLastElement: Element;
}

function handleDragMoveBlockSelect(
    moveEvent: MouseEvent,
    protyle: IProtyle,
    clentX: number,
    y: number,
    mostLeft: number,
    mostRight: number,
    mostTop: number,
    mostBottom: number,
    mouseElement: Element,
    startFirstElement: Element,
    endLastElement: Element,
): BlockSelectResult {
    protyle.selectElement.classList.remove("fn__none");
    // 向左选择，遇到 gutter 就不会弹出 toolbar
    hideElements(["gutter"], protyle);
    const rect = computeSelectRect(moveEvent, clentX, y, mostLeft, mostRight, mostTop, mostBottom);
    if (rect.newHeight < 4) {
        return {mouseElement, startFirstElement, endLastElement};
    }
    protyle.selectElement.setAttribute("style", `top:${rect.newTop}px;height:${rect.newHeight}px;left:${rect.newLeft + 2}px;width:${rect.newWidth - 2}px;`);
    const newMouseElement = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
    if (mouseElement && mouseElement === newMouseElement && !mouseElement.classList.contains("protyle-wysiwyg") &&
        !mouseElement.classList.contains("list") && !mouseElement.classList.contains("bq") &&
        !mouseElement.classList.contains("sb") && !mouseElement.classList.contains("callout")) {
        // 性能优化，同一个p元素不进行选中计算
        return {mouseElement, startFirstElement, endLastElement};
    }
    mouseElement = newMouseElement;

    hideElements(["select"], protyle);
    const blockResult = collectSelectedBlocks(moveEvent, protyle, rect, y, startFirstElement, endLastElement, mostLeft, mostRight);
    startFirstElement = blockResult.startFirstElement;
    endLastElement = blockResult.endLastElement;

    if (blockResult.selectElements.length === 1 && !blockResult.selectElements[0].classList.contains("list") &&
        !blockResult.selectElements[0].classList.contains("bq") && !blockResult.selectElements[0].classList.contains("callout") &&
        !blockResult.selectElements[0].classList.contains("sb")) {
        // 只有一个 p 时不选中，用 data 属性标记未选中状态（矩形视觉保持可见）
        protyle.selectElement.setAttribute("data-empty", "true");
        protyle.wysiwyg.element.classList.remove("protyle-wysiwyg--hiderange");
    } else {
        protyle.wysiwyg.element.classList.add("protyle-wysiwyg--hiderange");
        blockResult.selectElements.forEach(item => {
            if (!hasClosestByClassName(item, "protyle-wysiwyg__embed")) {
                item.classList.add("protyle-wysiwyg--select");
            }
        });
        protyle.selectElement.removeAttribute("data-empty");
    }
    return {mouseElement, startFirstElement, endLastElement};
}

function computeSelectRect(
    moveEvent: MouseEvent,
    clentX: number,
    y: number,
    mostLeft: number,
    mostRight: number,
    mostTop: number,
    mostBottom: number,
) {
    let newTop = 0;
    let newLeft = 0;
    let newWidth = 0;
    let newHeight = 0;
    if (moveEvent.clientX < clentX) {
        if (moveEvent.clientX < mostLeft) {
            newLeft = mostLeft;
        } else {
            newLeft = moveEvent.clientX;
        }
        newWidth = clentX - newLeft;
    } else {
        if (moveEvent.clientX > mostRight) {
            newLeft = clentX;
            newWidth = mostRight - newLeft;
        } else {
            newLeft = clentX;
            newWidth = moveEvent.clientX - clentX;
        }
    }
    if (moveEvent.clientY > y) {
        if (moveEvent.clientY > mostBottom) {
            newTop = y;
            newHeight = mostBottom - y;
        } else {
            newTop = y;
            newHeight = moveEvent.clientY - y;
        }
    } else {
        if (moveEvent.clientY < mostTop) {
            newTop = mostTop;
        } else {
            newTop = moveEvent.clientY;
        }
        newHeight = y - newTop;
    }
    return {newTop, newLeft, newWidth, newHeight};
}

/**
 * 容器类元素判断（划选时 elementFromPoint 命中它们的边缘/空白需继续探测子块）
 */
function isContainerElement(el: Element) {
    return el.classList.contains("protyle-wysiwyg") || el.classList.contains("list") ||
        el.classList.contains("li") || el.classList.contains("sb") ||
        el.classList.contains("callout") || el.classList.contains("bq");
}

function collectSelectedBlocks(
    moveEvent: MouseEvent,
    protyle: IProtyle,
    rect: {newTop: number; newLeft: number; newWidth: number; newHeight: number},
    y: number,
    startFirstElement: Element,
    endLastElement: Element,
    mostLeft?: number,
    mostRight?: number,
) {
    let firstElement;
    if (moveEvent.clientY > y) {
        firstElement = startFirstElement || document.elementFromPoint(rect.newLeft, rect.newTop);
        endLastElement = undefined;
    } else {
        // newLeft 落在 padding 内时 elementFromPoint 会命中 wysiwyg 容器，需钳制到内容区
        const detectX = mostLeft !== undefined ? Math.max(mostLeft, Math.min(rect.newLeft, mostRight)) : rect.newLeft;
        firstElement = document.elementFromPoint(detectX, rect.newTop);
        startFirstElement = undefined;
    }
    if (!firstElement) {
        return {selectElements: [] as Element[], startFirstElement, endLastElement};
    }
    // 向上划选且落点在 padding/缝隙时，elementFromPoint 易命中 wysiwyg 容器或容器类元素，
    // 需沿 y 轴循环向下探测以定位到实际块，避免回退到文档首块导致误选上部所有块
    if (moveEvent.clientY <= y && isContainerElement(firstElement)) {
        const selectBottomY = endLastElement ? endLastElement.getBoundingClientRect().bottom : (rect.newTop + rect.newHeight);
        let probeY = rect.newTop;
        const probeX = mostLeft !== undefined ? Math.max(mostLeft, Math.min(rect.newLeft, mostRight)) : rect.newLeft;
        while (probeY < selectBottomY) {
            probeY += 8;
            const probeElement = document.elementFromPoint(probeX, probeY);
            if (probeElement && !isContainerElement(probeElement)) {
                firstElement = probeElement;
                break;
            }
        }
    }
    if (!firstElement) {
        return {selectElements: [] as Element[], startFirstElement, endLastElement};
    }
    let firstBlockElement = hasClosestBlock(firstElement);
    if (!firstBlockElement && firstElement.classList.contains("protyle-breadcrumb__bar")) {
        firstBlockElement = firstElement.nextElementSibling as HTMLElement;
    }
    if (moveEvent.clientY > y) {
        if (!startFirstElement) {
            if (!firstBlockElement) {
                firstBlockElement = protyle.wysiwyg.element.firstElementChild as HTMLElement;
                if (firstBlockElement.classList.contains("protyle-breadcrumb__bar")) {
                    firstBlockElement = firstBlockElement.nextElementSibling as HTMLElement;
                }
            }
            startFirstElement = firstBlockElement;
        }
    } else if (!firstBlockElement &&
        moveEvent.clientY < protyle.wysiwyg.element.lastElementChild.getBoundingClientRect().bottom) {
        firstBlockElement = protyle.wysiwyg.element.firstElementChild as HTMLElement;
        if (firstBlockElement.classList.contains("protyle-breadcrumb__bar")) {
            firstBlockElement = firstBlockElement.nextElementSibling as HTMLElement;
        }
    }

    let selectElements: Element[] = [];
    let currentElement: Element | boolean = firstBlockElement;
    if (currentElement) {
        const embedElement = isInEmbedBlock(currentElement);
        if (embedElement) {
            currentElement = embedElement;
        }
    }

    let hasJump = false;
    // 块选择判定用的右边界需落在内容区，避免矩形右边缘在 padding 内时选不中块
    const selectRight = mostLeft !== undefined ? Math.max(rect.newLeft + rect.newWidth, mostLeft) : (rect.newLeft + rect.newWidth);
    const selectBottom = endLastElement ? endLastElement.getBoundingClientRect().bottom : (rect.newTop + rect.newHeight);
    while (currentElement) {
        if (currentElement && !currentElement.classList.contains("protyle-attr")) {
            const currentRect = currentElement.getBoundingClientRect();
            if (currentRect.height > 0 && currentRect.top < selectBottom && currentRect.left < selectRight) {
                if (hasJump) {
                    if (currentElement.nextElementSibling && !currentElement.nextElementSibling.classList.contains("protyle-attr")) {
                        const nextRect = currentElement.nextElementSibling.getBoundingClientRect();
                        if (nextRect.top < selectBottom && nextRect.left < selectRight) {
                            selectElements = [currentElement];
                            currentElement = currentElement.nextElementSibling;
                            hasJump = false;
                        } else if (currentElement.parentElement.classList.contains("sb")) {
                            currentElement = hasClosestBlock(currentElement.parentElement);
                            hasJump = true;
                        } else {
                            break;
                        }
                    } else {
                        currentElement = hasClosestBlock(currentElement.parentElement);
                        hasJump = true;
                    }
                } else {
                    if (!currentElement.classList.contains("protyle-breadcrumb__bar") &&
                        !currentElement.classList.contains("protyle-breadcrumb__item")) {
                        selectElements.push(currentElement);
                    }
                    if (!currentElement.nextElementSibling && currentElement.parentElement.classList.contains("callout-content")) {
                        currentElement = currentElement.parentElement.nextElementSibling;
                    } else {
                        currentElement = currentElement.nextElementSibling;
                    }
                }
            } else if (currentElement.parentElement.classList.contains("sb")) {
                currentElement = hasClosestBlock(currentElement.parentElement);
                hasJump = true;
            } else if (currentRect.height === 0 && currentRect.width === 0 && currentElement.parentElement.getAttribute("fold") === "1") {
                currentElement = currentElement.parentElement;
                selectElements = [];
            } else {
                break;
            }
        } else {
            currentElement = hasClosestBlock(currentElement.parentElement);
            hasJump = true;
        }
    }
    if (moveEvent.clientY <= y && !endLastElement) {
        endLastElement = selectElements[selectElements.length - 1];
    }
    return {selectElements, startFirstElement, endLastElement};
}

function handleMouseUpTableMenu(
    protyle: IProtyle,
    tableBlockElement: HTMLElement | false,
    mouseUpEvent: MouseEvent,
) {
    if (!tableBlockElement) {
return;
}
    tableBlockElement.firstElementChild.style.webkitUserModify = "";
    const tableSelectElement = tableBlockElement.querySelector(".table__select") as HTMLElement;
    if (tableSelectElement.getAttribute("style")) {
        if (getSelection().rangeCount > 0) {
            getSelection().getRangeAt(0).collapse(false);
        }
        window.siyuan.menus.menu.remove();
        buildTableCellMenu(protyle, tableBlockElement, tableSelectElement, mouseUpEvent);
    }
}

function handleMouseUpBlockCount(protyle: IProtyle) {
    const ids: string[] = [];
    const selectElement = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
    selectElement.forEach(item => {
        ids.push(item.getAttribute("data-node-id"));
    });
    countBlockWord(ids);
}

function handleMouseUpRangeCleanup(
    protyle: IProtyle,
    event: MouseEvent,
    mouseUpEvent: MouseEvent,
) {
    // 划选后不能存在跨块的 range https://github.com/siyuan-note/siyuan/issues/4473
    if (getSelection().rangeCount > 0) {
        const range = getSelection().getRangeAt(0);
        if (range.toString() === "" ||
            window.siyuan.shiftIsPressed  // https://ld246.com/article/1650096678723
        ) {
            if (event.detail > 2) {
                // table 前或最后一个 cell 三击状态不对
                let cursorElement = hasClosestBlock(range.startContainer) as Element;
                if (cursorElement) {
                    if (cursorElement.nextElementSibling?.classList.contains("table")) {
                        setLastNodeRange(getContenteditableElement(cursorElement), range, false);
                    } else if (cursorElement.classList.contains("table")) {
                        const cellElements = cursorElement.querySelectorAll("th, td");
                        cursorElement = cellElements[cellElements.length - 1];
                        if (cursorElement.contains(range.startContainer)) {
                            setLastNodeRange(cursorElement, range, false);
                        }
                    }
                }
                return;
            }
        }
        const selectElement = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
        if (selectElement.length > 0) {
            range.collapse(true);
            // 上游 #17092: 修复鼠标框选后焦点位置问题
            // 使用 hasClosestBlock 获取更准确的结束元素位置
            const endElement = hasClosestBlock(mouseUpEvent.target as HTMLElement);
            if (endElement && document.activeElement.classList.contains("protyle-wysiwyg")) {
                focusBlock(endElement);
            }
            return;
        }
        const startBlockElement = hasClosestBlock(range.startContainer);
        let endBlockElement: false | HTMLElement;
        if (mouseUpEvent.detail > 2 && range.endContainer.nodeType !== 3 && ["DIV", "TD", "TH"].includes((range.endContainer as HTMLElement).tagName) && range.endOffset === 0) {
            // 三击选中段落块时，rangeEnd 会在下一个块
            if ((range.endContainer as HTMLElement).classList.contains("protyle-attr") && startBlockElement) {
                setLastNodeRange(getContenteditableElement(startBlockElement), range, false);
            } else if (["TD", "TH"].includes((range.endContainer as HTMLElement).tagName)) {
                const cellElement = hasClosestByTag(range.startContainer, "TH") || hasClosestByTag(range.startContainer, "TD");
                if (cellElement) {
                    setLastNodeRange(cellElement, range, false);
                }
            }
        } else {
            endBlockElement = hasClosestBlock(range.endContainer);
        }
        if (startBlockElement && endBlockElement && endBlockElement !== startBlockElement) {
            if ((range.startContainer.nodeType === 1 && (range.startContainer as HTMLElement).tagName === "DIV" && (range.startContainer as HTMLElement).classList.contains("protyle-attr")) ||
                event.clientY > mouseUpEvent.clientY) {
                setFirstNodeRange(getContenteditableElement(endBlockElement), range);
            } else if (range.endOffset === 0 && range.endContainer.nodeType === 1 && (range.endContainer as HTMLElement).tagName === "DIV") {
                setLastNodeRange(getContenteditableElement(startBlockElement), range, false);
            } else {
                range.collapse(true);
            }
        }
    }
}
