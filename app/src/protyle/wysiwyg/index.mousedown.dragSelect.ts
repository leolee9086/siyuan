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
import { getContenteditableElement } from "./getBlock";
import { Constants } from "../../constants";
import { hideElements } from "../ui/hideElements";
import { countBlockWord } from "../runtime/status.port";
import { buildTableCellMenu } from "./index.mousedown.tableMenu";
import { computeTableSelectRect } from "./computeTableSelectRect";
import {dragOverScroll, stopScrollAnimation} from "../../boot/globalEvent/dragover";

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
    protyleRect: DOMRect;
    startsFromPadding: boolean;
    wysiwygRect: DOMRect;
    wysiwygElement: HTMLElement;
}

/**
 * 设置多节点框选的 onmousemove 和 onmouseup 处理器。
 * 包含表格单元格拖选和多块节点框选两种模式。
 */
export function setupDragSelect(ctx: DragSelectContext) {
    const {
        protyle, event, target, tableBlockElement, documentSelf,
        clentX, mostTop, mostRight, mostLeft, mostBottom, y,
        contentRect, protyleRect, startsFromPadding, wysiwygElement, wysiwygRect,
    } = ctx;

    let moveCellElement: HTMLElement;
    wysiwygElement.querySelectorAll("iframe").forEach(item => {
        item.style.pointerEvents = "none";
    });
    const selectStartScrollTop = protyle.contentElement.scrollTop;
    let lastMoveEvent: MouseEvent;
    const selectScrollEvent = () => {
        if (lastMoveEvent) {
            documentSelf.onmousemove?.(lastMoveEvent);
        }
    };
    if (startsFromPadding) {
        protyle.contentElement.addEventListener("scroll", selectScrollEvent);
    }

    documentSelf.onmousemove = (moveEvent: MouseEvent) => {
        lastMoveEvent = moveEvent;
        const moveResult = handleDragMoveTableCell(moveEvent, target, tableBlockElement, moveCellElement, protyle);
        if (moveResult.handled) {
            moveCellElement = moveResult.moveCellElement;
            return moveResult.returnValue;
        }
        moveCellElement = moveResult.moveCellElement;

        handleDragMoveScroll(moveEvent, startsFromPadding, contentRect, protyle);

        handleDragMoveBlockSelect(
            moveEvent, protyle, clentX, y, mostLeft, mostRight, mostTop, mostBottom,
            selectStartScrollTop, protyleRect, wysiwygRect,
        );
    };

    documentSelf.onmouseup = (mouseUpEvent) => {
        documentSelf.onmousemove = null;
        documentSelf.onmouseup = null;
        documentSelf.ondragstart = null;
        documentSelf.onselectstart = null;
        documentSelf.onselect = null;
        protyle.contentElement.removeEventListener("scroll", selectScrollEvent);
        if (startsFromPadding) {
            stopScrollAnimation();
        }
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
        if (startsFromPadding) {
            getSelection().removeAllRanges();
        }
    };
}


function handleDragMoveTableCell(
    moveEvent: MouseEvent,
    target: HTMLElement,
    tableBlockElement: HTMLElement | false,
    moveCellElement: HTMLElement,
    protyle: IProtyle,
) {
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
                return { handled: true, returnValue: false, moveCellElement: moveTarget };
            }
            if (moveTarget && (moveTarget.tagName === "TH" || moveTarget.tagName === "TD") &&
                (!moveCellElement || moveCellElement !== moveTarget)) {
                computeTableSelectRect({ target, moveTarget, tableBlockElement, protyle });
                return { handled: true, moveCellElement: moveTarget };
            }
            return { handled: true, moveCellElement };
        } else {
            tableBlockElement.querySelector(".table__select").removeAttribute("style");
            return { handled: false, moveCellElement: undefined };
        }
    }
    return { handled: false, moveCellElement };
}

function handleDragMoveScroll(
    moveEvent: MouseEvent,
    startsFromPadding: boolean,
    contentRect: DOMRect,
    protyle: IProtyle,
) {
    // 在包含 img， video， audio 的元素上划选后无法上下滚动 https://ld246.com/article/1681778773806
    // 在包含 img， video， audio 的元素上拖拽无法划选 https://github.com/siyuan-note/siyuan/issues/11763
    if (startsFromPadding) {
        dragOverScroll(moveEvent, contentRect, protyle.contentElement);
        return;
    }
    const isMediaTarget = (moveEvent.target as HTMLElement).closest("img, video, audio, .img");
    if (isMediaTarget && (moveEvent.clientY < contentRect.top + Constants.SIZE_SCROLL_TB ||
        moveEvent.clientY > contentRect.bottom - Constants.SIZE_SCROLL_TB)) {
        protyle.contentElement.scroll({
            top: protyle.contentElement.scrollTop + (moveEvent.clientY < contentRect.top + Constants.SIZE_SCROLL_TB ? -Constants.SIZE_SCROLL_STEP : Constants.SIZE_SCROLL_STEP),
            behavior: "smooth"
        });
    }
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
    selectStartScrollTop: number,
    protyleRect: DOMRect,
    wysiwygRect: DOMRect,
) {
    // 向左选择，遇到 gutter 就不会弹出 toolbar
    hideElements(["gutter"], protyle);
    const scrollTop = protyle.contentElement.scrollTop;
    const startY = y + selectStartScrollTop;
    const moveY = Math.max(mostTop, Math.min(moveEvent.clientY, mostBottom)) + scrollTop;
    const selectLeft = Math.max(Math.min(clentX, moveEvent.clientX), mostLeft);
    const selectRight = Math.min(Math.max(clentX, moveEvent.clientX), mostRight);
    const selectTop = Math.min(startY, moveY) - scrollTop;
    const selectHeight = Math.abs(moveY - startY);
    if (selectHeight < 4) {
        hideElements(["select"], protyle);
        protyle.selectElement.classList.add("fn__none");
        protyle.selectElement.removeAttribute("style");
        return;
    }
    protyle.selectElement.classList.remove("fn__none");
    protyle.selectElement.setAttribute("style", `top:${selectTop - protyleRect.top}px;height:${selectHeight}px;left:${selectLeft - protyleRect.left}px;width:${selectRight - selectLeft}px;`);
    const selectRect = protyle.selectElement.getBoundingClientRect();
    hideElements(["select"], protyle);
    const selectElements = collectSelectedBlocks(protyle, selectRect, moveY > startY, mostLeft, mostRight, wysiwygRect);
    selectElements.forEach(item => {
        if (!hasClosestByClassName(item, "protyle-wysiwyg__embed")) {
            item.classList.add("protyle-wysiwyg--select");
        }
    });
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
    protyle: IProtyle,
    selectRect: DOMRect,
    isDown: boolean,
    mostLeft: number,
    mostRight: number,
    wysiwygRect: DOMRect,
) {
    const detectX = Math.max(mostLeft, Math.min(selectRect.left, mostRight));
    let firstElement = document.elementFromPoint(detectX, selectRect.top);
    if (!isDown && firstElement && isContainerElement(firstElement)) {
        let probeY = selectRect.top;
        while (probeY < selectRect.bottom) {
            probeY += 8;
            const probeElement = document.elementFromPoint(detectX, probeY);
            if (probeElement && (!isContainerElement(probeElement) || hasClosestBlock(probeElement))) {
                firstElement = probeElement;
                break;
            }
        }
    }
    if (!firstElement) {
        return [];
    }

    let firstBlockElement = hasClosestBlock(firstElement);
    if (!firstBlockElement && firstElement.classList.contains("protyle-breadcrumb__bar")) {
        firstBlockElement = firstElement.nextElementSibling as HTMLElement;
    }
    if (!firstBlockElement && (isDown || selectRect.top < wysiwygRect.bottom)) {
        firstBlockElement = protyle.wysiwyg.element.firstElementChild as HTMLElement;
        if (firstBlockElement.classList.contains("protyle-breadcrumb__bar")) {
            firstBlockElement = firstBlockElement.nextElementSibling as HTMLElement;
        }
    }

    const selectElements: Element[] = [];
    let currentElement: Element | false = firstBlockElement;
    if (currentElement) {
        const embedElement = isInEmbedBlock(currentElement);
        if (embedElement) {
            currentElement = embedElement;
        }
    }

    let hasJump = false;
    while (currentElement) {
        if (currentElement.classList.contains("protyle-attr")) {
            currentElement = hasClosestBlock(currentElement.parentElement);
            hasJump = true;
            continue;
        }
        const currentRect = currentElement.getBoundingClientRect();
        const currentInRange = currentRect.height > 0 && currentRect.top < selectRect.bottom &&
            currentRect.bottom > selectRect.top && currentRect.left < selectRect.right &&
            currentRect.right > selectRect.left;
        if (!currentInRange) {
            if (currentElement.parentElement.classList.contains("sb")) {
                currentElement = hasClosestBlock(currentElement.parentElement);
                hasJump = true;
                continue;
            }
            if (currentRect.height === 0 && currentRect.width === 0 &&
                currentElement.parentElement.getAttribute("fold") === "1") {
                currentElement = currentElement.parentElement;
                selectElements.length = 0;
                continue;
            }
            break;
        }

        if (hasJump) {
            const nextElement = currentElement.nextElementSibling;
            if (!nextElement || nextElement.classList.contains("protyle-attr")) {
                currentElement = hasClosestBlock(currentElement.parentElement);
                continue;
            }
            const nextRect = nextElement.getBoundingClientRect();
            const nextInRange = nextRect.top < selectRect.bottom && nextRect.bottom > selectRect.top &&
                nextRect.left < selectRect.right && nextRect.right > selectRect.left;
            if (nextInRange) {
                selectElements.length = 0;
                selectElements.push(currentElement);
                currentElement = nextElement;
                hasJump = false;
                continue;
            }
            if (currentElement.parentElement.classList.contains("sb")) {
                currentElement = hasClosestBlock(currentElement.parentElement);
                continue;
            }
            break;
        }

        if (!currentElement.classList.contains("protyle-breadcrumb__bar") &&
            !currentElement.classList.contains("protyle-breadcrumb__item") &&
            !currentElement.classList.contains("sb__resize")) {
            selectElements.push(currentElement);
        }
        if (!currentElement.nextElementSibling && currentElement.parentElement.classList.contains("callout-content")) {
            currentElement = currentElement.parentElement.nextElementSibling;
        } else {
            currentElement = currentElement.nextElementSibling;
        }
    }
    return selectElements;
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
    countBlockWord(ids, protyle.block.rootID, false, protyle.options.status);
}

function handleMouseUpRangeCleanup(
    protyle: IProtyle,
    event: MouseEvent,
    mouseUpEvent: MouseEvent,
) {
    // 修正三击及跨块选区落在块边界时的 range。
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
            }
        }
    }
}
