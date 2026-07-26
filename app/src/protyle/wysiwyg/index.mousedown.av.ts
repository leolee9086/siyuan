import {hasClosestByClassName} from "../util/hasClosest";
import {Constants} from "../../constants";
import {transaction} from "./transaction";
import {stickyRow, selectRow} from "../render/av/row";
import {genCellValueByElement} from "../render/av/cell.value";
import {addDragFill} from "../render/av/cell/decoration";
import {dragFillCellsValue} from "../render/av/cell/dragFill";
import {getPositionByCellElement} from "../render/av/cell/position";
import {getTypeByCellElement} from "../render/av/cell/position";
import {focusBlock} from "../util/selection";
import {isInEmbedBlock} from "../util/hasClosest";

/**
 * 处理 AV 列宽拖拽调整。
 * @returns true 表示已处理（调用方应 return）
 */
export function handleAvColResize(
    protyle: IProtyle,
    event: MouseEvent,
    target: HTMLElement,
    nodeElement: HTMLElement,
    contentRect: DOMRect,
    documentSelf: Document,
    setPreventClick: () => void,
): boolean {
    if (protyle.disabled || !target.classList.contains("av__widthdrag")) {
        return false;
    }
    if (!nodeElement) {
        return true;
    }
    const avId = nodeElement.getAttribute("data-av-id");
    const blockID = nodeElement.dataset.nodeId;
    const dragElement = target.parentElement;
    const oldWidth = dragElement.clientWidth;
    const dragColId = dragElement.getAttribute("data-col-id");
    let newWidth: number;
    const scrollElement = nodeElement.querySelector(".av__scroll");
    documentSelf.onmousemove = (moveEvent: MouseEvent) => {
        newWidth = Math.max(oldWidth + (moveEvent.clientX - event.clientX), 25);
        scrollElement.querySelectorAll(".av__row, .av__row--footer").forEach(item => {
            (item.querySelector(`[data-col-id="${dragColId}"]`) as HTMLElement).style.width = newWidth + "px";
        });
        stickyRow(nodeElement, contentRect, "bottom");
    };

    documentSelf.onmouseup = () => {
        documentSelf.onmousemove = null;
        documentSelf.onmouseup = null;
        documentSelf.ondragstart = null;
        documentSelf.onselectstart = null;
        documentSelf.onselect = null;
        if (!newWidth || newWidth === oldWidth) {
            return;
        }
        const viewID = nodeElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW);
        transaction(protyle, [{
            action: "setAttrViewColWidth",
            id: dragColId,
            avID: avId,
            data: newWidth + "px",
            blockID,
            viewID // https://github.com/siyuan-note/siyuan/issues/11019
        }], [{
            action: "setAttrViewColWidth",
            id: dragColId,
            avID: avId,
            data: oldWidth + "px",
            blockID,
            viewID
        }]);
    };
    setPreventClick();
    event.preventDefault();
    return true;
}

/**
 * 处理 AV 拖拽填充。
 * @returns true 表示已处理（调用方应 return false），false 表示未处理
 */
export function handleAvDragFill(
    protyle: IProtyle,
    event: MouseEvent,
    avDragFillElement: HTMLElement | false,
    nodeElement: HTMLElement,
    documentSelf: Document,
    setPreventClick: () => void,
): boolean {
    if (protyle.disabled || !avDragFillElement) {
        return false;
    }
    if (!nodeElement) {
        return true;
    }
    const bodyElement = hasClosestByClassName(avDragFillElement, "av__body") as HTMLElement;
    if (!bodyElement) {
        return true;
    }
    const originData: { [key: string]: IAVCellValue[] } = {};
    let lastOriginCellElement: HTMLElement;
    const originCellIds: string[] = [];
    bodyElement.querySelectorAll(".av__cell--active").forEach((item: HTMLElement) => {
        const rowElement = hasClosestByClassName(item, "av__row");
        if (rowElement) {
            if (!originData[rowElement.dataset.id]) {
                originData[rowElement.dataset.id] = [];
            }
            originData[rowElement.dataset.id].push(genCellValueByElement(getTypeByCellElement(item), item));
            lastOriginCellElement = item;
            originCellIds.push(item.dataset.id);
        }
    });
    const dragFillCellIndex = getPositionByCellElement(lastOriginCellElement);
    const firstCellIndex = getPositionByCellElement(bodyElement.querySelector(".av__cell--active"));
    let moveAVCellElement: HTMLElement;
    let lastCellElement: HTMLElement;
    documentSelf.onmousemove = (moveEvent: MouseEvent) => {
        const tempCellElement = hasClosestByClassName(moveEvent.target as HTMLElement, "av__cell") as HTMLElement;
        if (moveAVCellElement && tempCellElement && (tempCellElement === moveAVCellElement)) {
            return;
        }
        moveAVCellElement = tempCellElement;
        if (moveAVCellElement && moveAVCellElement.dataset.id) {
            const newIndex = getPositionByCellElement(moveAVCellElement);
            bodyElement.querySelectorAll(".av__cell--active").forEach((item: HTMLElement) => {
                if (!originCellIds.includes(item.dataset.id)) {
                    item.classList.remove("av__cell--active");
                }
            });
            if (newIndex.celIndex !== dragFillCellIndex.celIndex) {
                lastCellElement = undefined;
                return;
            }
            bodyElement.querySelectorAll(".av__row").forEach((rowElement: HTMLElement, index: number) => {
                if ((newIndex.rowIndex < firstCellIndex.rowIndex && index >= newIndex.rowIndex && index < firstCellIndex.rowIndex) ||
                    (newIndex.rowIndex > dragFillCellIndex.rowIndex && index <= newIndex.rowIndex && index > dragFillCellIndex.rowIndex)) {
                    rowElement.querySelectorAll(".av__cell").forEach((cellElement: HTMLElement, cellIndex: number) => {
                        if (cellIndex >= firstCellIndex.celIndex && cellIndex <= newIndex.celIndex) {
                            cellElement.classList.add("av__cell--active");
                            lastCellElement = cellElement;
                        }
                    });
                }
            });
        }
    };

    documentSelf.onmouseup = () => {
        documentSelf.onmousemove = null;
        documentSelf.onmouseup = null;
        documentSelf.ondragstart = null;
        documentSelf.onselectstart = null;
        documentSelf.onselect = null;
        if (lastCellElement) {
            dragFillCellsValue({protyle, nodeElement, originData, originCellIds, activeElement: lastOriginCellElement});
            const allActiveCellsElement = bodyElement.querySelectorAll(".av__cell--active");
            addDragFill(allActiveCellsElement[allActiveCellsElement.length - 1]);
        }
        return false;
    };
    setPreventClick();
    return true;
}

/**
 * 处理 AV 单元格框选。
 * @returns true 表示已处理（调用方应 return false），false 表示未处理
 */
export function handleAvCellSelect(
    protyle: IProtyle,
    event: MouseEvent,
    target: HTMLElement,
    nodeElement: HTMLElement,
    contentRect: DOMRect,
    documentSelf: Document,
    setPreventClick: () => void,
): boolean {
    const avCellElement = hasClosestByClassName(target, "av__cell");
    if (protyle.disabled || !avCellElement || !avCellElement.dataset.id || isInEmbedBlock(avCellElement)) {
        return false;
    }
    if (!nodeElement || nodeElement.dataset.avType !== "table") {
        return true;
    }
    nodeElement.querySelectorAll(".av__cell--select").forEach(item => {
        item.classList.remove("av__cell--select");
    });
    nodeElement.querySelectorAll(".av__drag-fill").forEach(item => {
        item.remove();
    });
    avCellElement.classList.add("av__cell--select");
    const originIndex = getPositionByCellElement(avCellElement);
    let moveSelectCellElement: HTMLElement;
    let lastCellElement: HTMLElement;
    const nodeRect = nodeElement.getBoundingClientRect();
    const scrollElement = nodeElement.querySelector(".av__scroll");
    const bodyElement = hasClosestByClassName(avCellElement, "av__body") as HTMLElement;
    documentSelf.onmousemove = (moveEvent: MouseEvent) => {
        const tempCellElement = hasClosestByClassName(moveEvent.target as HTMLElement, "av__cell") as HTMLElement;
        if (scrollElement.scrollWidth > scrollElement.clientWidth + 2) {
            if (moveEvent.clientX > nodeRect.right - 10) {
                scrollElement.scrollLeft += 10;
            } else if (moveEvent.clientX < nodeRect.left + 34) {
                scrollElement.scrollLeft -= 10;
            }
            if (moveEvent.clientY < contentRect.top + 48) {
                protyle.contentElement.scrollTop -= 5;
            } else if (moveEvent.clientY > contentRect.bottom - 48) {
                protyle.contentElement.scrollTop += 5;
            }
        }
        if (bodyElement !== hasClosestByClassName(tempCellElement, "av__body") ||
            (moveSelectCellElement && tempCellElement && tempCellElement === moveSelectCellElement)) {
            return;
        }
        if (tempCellElement && tempCellElement.dataset.id && (event.clientX !== moveEvent.clientX || event.clientY !== moveEvent.clientY)) {
            const newIndex = getPositionByCellElement(tempCellElement);
            nodeElement.querySelectorAll(".av__cell--active").forEach((item: HTMLElement) => {
                item.classList.remove("av__cell--active");
            });
            bodyElement.querySelectorAll(".av__row").forEach((rowElement: HTMLElement, index: number) => {
                if (index >= Math.min(originIndex.rowIndex, newIndex.rowIndex) && index <= Math.max(originIndex.rowIndex, newIndex.rowIndex)) {
                    rowElement.querySelectorAll(".av__cell").forEach((cellElement: HTMLElement, cellIndex: number) => {
                        if (cellIndex >= Math.min(originIndex.celIndex, newIndex.celIndex) && cellIndex <= Math.max(originIndex.celIndex, newIndex.celIndex)) {
                            cellElement.classList.add("av__cell--active");
                            lastCellElement = cellElement;
                        }
                    });
                }
            });
            moveSelectCellElement = tempCellElement;
        }
    };

    documentSelf.onmouseup = () => {
        documentSelf.onmousemove = null;
        documentSelf.onmouseup = null;
        documentSelf.ondragstart = null;
        documentSelf.onselectstart = null;
        documentSelf.onselect = null;
        if (lastCellElement) {
            selectRow(nodeElement.querySelector(".av__firstcol"), "unselectAll");
            focusBlock(nodeElement);
            addDragFill(lastCellElement);
            setPreventClick();
        }
        return false;
    };
    return true;
}
