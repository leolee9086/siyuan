import {transaction} from "../../../wysiwyg/transaction";
import {hasClosestByClassName} from "../../../util/hasClosest";
import {focusBlock} from "../../../util/selection";
import {renderCell, renderCellAttr} from "./render";
import {genCellValueByElement} from "../cell.value";
// S-forge: 本地改进 - 使用统一的国际化环境获取方式
import {isMobile} from "../../../../platform";

export const cellScrollIntoView = (blockElement: HTMLElement, cellElement: Element, onlyHeight = true) => {
    const cellRect = cellElement.getBoundingClientRect();
    if (!onlyHeight) {
        const avScrollElement = blockElement.querySelector(".av__scroll");
        const rowElement = hasClosestByClassName(cellElement, "av__row");
        if (avScrollElement && rowElement) {
            const stickyElement = rowElement.querySelector(".av__colsticky");
            if (!stickyElement.contains(cellElement)) { // https://github.com/siyuan-note/siyuan/issues/12162
                const stickyRight = stickyElement.getBoundingClientRect().right;
                const avScrollRect = avScrollElement.getBoundingClientRect();
                if (stickyRight > cellRect.left || avScrollRect.right < cellRect.left) {
                    avScrollElement.scrollLeft = avScrollElement.scrollLeft + cellRect.left - stickyRight;
                } else if (stickyRight < cellRect.left && avScrollRect.right < cellRect.right) {
                    if (cellRect.width + stickyRight > avScrollRect.right) {
                        avScrollElement.scrollLeft = avScrollElement.scrollLeft + cellRect.left - stickyRight;
                    } else {
                        avScrollElement.scrollLeft = avScrollElement.scrollLeft + cellRect.right - avScrollRect.right;
                    }
                }
            }
        }
    }
    if (isMobile) {
        const contentElement = hasClosestByClassName(blockElement, "protyle-content", true);
        if (contentElement && cellElement.getAttribute("data-dtype") !== "checkbox") {
            let keyboardToolbarTop = window.innerHeight / 2 - 48;
            if (window.siyuan.mobile.size.isLandscape) {
                if (window.siyuan.mobile.size.landscape.height1 !== window.siyuan.mobile.size.landscape.height2) {
                    keyboardToolbarTop = window.siyuan.mobile.size.landscape.height2 - 48;
                }
            } else {
                if (window.siyuan.mobile.size.portrait.height1 !== window.siyuan.mobile.size.portrait.height2) {
                    keyboardToolbarTop = window.siyuan.mobile.size.portrait.height2 - 48;
                }
            }
            if (cellRect.bottom > keyboardToolbarTop) {
                contentElement.scrollTop = contentElement.scrollTop + (cellRect.bottom - keyboardToolbarTop);
            } else if (cellRect.top < 110) {
                contentElement.scrollTop -= 110 - cellRect.top;
            }
        }
    }
    if (!isMobile) {
        if (!blockElement.querySelector(".av__header")) {
            // 属性面板
            return;
        }
        const bodyElement = hasClosestByClassName(cellElement, "av__body");
        if (!bodyElement) {
            return;
        }
        const avHeaderRect = bodyElement.querySelector(".av__row--header").getBoundingClientRect();
        if (avHeaderRect.bottom > cellRect.top) {
            const contentElement = hasClosestByClassName(blockElement, "protyle-content", true);
            if (contentElement) {
                contentElement.scrollTop = contentElement.scrollTop + cellRect.top - avHeaderRect.bottom;
            }
        } else {
            const footerElement = bodyElement.querySelector(".av__row--footer");
            if (footerElement?.querySelector(".av__calc--ashow")) {
                const avFooterRect = footerElement.getBoundingClientRect();
                if (avFooterRect.top < cellRect.bottom) {
                    const contentElement = hasClosestByClassName(blockElement, "protyle-content", true);
                    if (contentElement) {
                        contentElement.scrollTop = contentElement.scrollTop + cellRect.bottom - avFooterRect.top;
                    }
                }
            } else {
                const contentElement = hasClosestByClassName(blockElement, "protyle-content", true);
                if (contentElement) {
                    const contentRect = contentElement.getBoundingClientRect();
                    if (cellRect.bottom > contentRect.bottom) {
                        contentElement.scrollTop = contentElement.scrollTop + (cellRect.bottom - contentRect.bottom);
                    }
                }
            }
        }
    }
};
export const getTypeByCellElement = (cellElement: Element) => {
    if (cellElement.parentElement.classList.contains("av__gallery-field")) {
        return cellElement.getAttribute("data-dtype") as TAVCol;
    }
    const scrollElement = hasClosestByClassName(cellElement, "av__scroll");
    if (!scrollElement) {
        return;
    }
    return scrollElement.querySelector(".av__row--header").querySelector(`[data-col-id="${cellElement.getAttribute("data-col-id")}"]`).getAttribute("data-dtype") as TAVCol;
};

export const getPositionByCellElement = (cellElement: HTMLElement) => {
    const rowElement = hasClosestByClassName(cellElement, "av__row");
    if (!rowElement) {
        return;
    }
    // 直接取该行在 body 内 .av__row 列表中的序号，与划选/拖拽填充遍历 querySelectorAll(".av__row")
    // 时的 index 保持同一基准，避免固定表头占位、虚拟滚动 spacer 等结构导致 previousElementSibling 计数错位
    const bodyElement = hasClosestByClassName(rowElement, "av__body");
    let rowIndex = -1;
    if (bodyElement) {
        Array.from(bodyElement.querySelectorAll(".av__row")).find((item: HTMLElement, index: number) => {
            if (item === rowElement) {
                rowIndex = index;
                return true;
            }
        });
    }
    let celIndex = -2;
    let currentCellElement = cellElement;
    while (currentCellElement) {
        currentCellElement = currentCellElement.previousElementSibling as HTMLElement;
        if (currentCellElement && currentCellElement.classList.contains("av__colsticky")) {
            currentCellElement = currentCellElement.lastElementChild as HTMLElement;
        }
        celIndex++;
    }
    return {rowIndex, celIndex};
};

export const dragFillCellsValue = (protyle: IProtyle, nodeElement: HTMLElement, originData: {
    [key: string]: IAVCellValue[]
}, originCellIds: string[], activeElement: Element) => {
    nodeElement.querySelector(".av__drag-fill")?.remove();
    const newData: { [key: string]: Array<IAVCellValue & { colId?: string, element?: HTMLElement }> } = {};
    nodeElement.querySelectorAll(".av__cell--active").forEach((item: HTMLElement) => {
        if (originCellIds.includes(item.dataset.id)) {
            return;
        }
        const rowElement = hasClosestByClassName(item, "av__row");
        if (!rowElement) {
            return;
        }
        if (!newData[rowElement.dataset.id]) {
            newData[rowElement.dataset.id] = [];
        }
        const value: IAVCellValue & {
            colId?: string,
            element?: HTMLElement
        } = genCellValueByElement(getTypeByCellElement(item), item);
        value.colId = item.dataset.colId;
        value.element = item;
        newData[rowElement.dataset.id].push(value);
    });
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    const avID = nodeElement.dataset.avId;
    const originKeys = Object.keys(originData);
    const showIcon = activeElement.querySelector(".b3-menu__avemoji") ? true : false;
    Object.keys(newData).forEach((rowID, index) => {
        newData[rowID].forEach((item, cellIndex) => {
            if (["rollup", "template", "created", "updated"].includes(item.type) ||
                (item.type === "block" && item.element.getAttribute("data-detached") !== "true")) {
                return;
            }
            // https://ld246.com/article/1707975507571 数据库下拉填充数据后异常
            const data = JSON.parse(JSON.stringify(originData[originKeys[index % originKeys.length]][cellIndex]));
            data.id = item.id;
            const keyID = item.colId;
            if (data.type === "block") {
                data.isDetached = true;
                delete data.block.id;
            }
            doOperations.push({
                action: "updateAttrViewCell",
                id: item.id,
                avID,
                keyID,
                rowID,
                data
            });
            item.element.innerHTML = renderCell(data, 0, showIcon);
            renderCellAttr(item.element, data);
            delete item.colId;
            delete item.element;
            undoOperations.push({
                action: "updateAttrViewCell",
                id: item.id,
                avID,
                keyID,
                rowID,
                data: item
            });
        });
    });
    focusBlock(nodeElement);
    if (doOperations.length > 0) {
        transaction(protyle, doOperations, undoOperations);
    }
};
