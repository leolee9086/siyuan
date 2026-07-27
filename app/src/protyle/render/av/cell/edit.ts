import {submitAVColumnEditTransaction} from "../../../wysiwyg/transaction/prepared/av/avColumnEdit";
import {hasClosestBlock, hasClosestByClassName} from "../../../util/hasClosest";
import {openMenuPanel} from "../openMenuPanel";
import {isNotCtrl} from "../../../util/compatibility";
import {isDynamicRef} from "../../../../util/platform/functions";
import {fetchPost} from "../../../../util/network/fetch";
import {focusBlock, focusByRange} from "../../../util/selection";
import {getColId} from "../col/identity/resolve";
import {Constants} from "../../../../constants";
import {hintRef} from "../../../hint/extend.hintRef";
import {electronUndo} from "../../../undo/keyboard/electronUndo";
import {getFieldIdByCellElement} from "../row";
import {getFieldsByData} from "../view/metadata";
import {callMobileAppShowKeyboard} from "../../../../mobile/keyboard/mobileAppUtil";
import {cellScrollIntoView, getTypeByCellElement} from "./position";
import {addDragFill} from "./decoration";
import {updateCellsValue} from "../cell.update";

export const popTextCell = (protyle: IProtyle, cellElements: HTMLElement[], type?: TAVCol, options?: {
    scrollIntoView?: boolean;
}) => {
    if (cellElements.length === 0 || (cellElements.length === 1 && !cellElements[0])) {
        return;
    }
    if (!type) {
        type = getTypeByCellElement(cellElements[0]);
    }
    if (type === "updated" || type === "created" || document.querySelector(".av__mask")) {
        return;
    }
    const blockElement = hasClosestBlock(cellElements[0]);
    if (!blockElement) {
        return;
    }
    const viewType = blockElement.getAttribute("data-av-type") as TAVView;
    let cellRect = cellElements[0].getBoundingClientRect();
    const contentElement = hasClosestByClassName(blockElement, "protyle-content", true);
    if (viewType === "table" && options?.scrollIntoView !== false) {
        cellScrollIntoView(blockElement, cellElements[0], false);
    }
    cellRect = cellElements[0].getBoundingClientRect();
    let html = "";
    let height = cellRect.height;
    const cssStyle = getComputedStyle(cellElements[0]);
    let style = `font-family:${cssStyle.fontFamily};font-size:${cssStyle.fontSize};line-height:${cssStyle.lineHeight};padding:${cssStyle.padding};position:absolute;top: ${cellRect.top}px;`;
    if (contentElement) {
        const contentRect = contentElement.getBoundingClientRect();
        if (cellRect.bottom > contentRect.bottom) {
            height = contentRect.bottom - cellRect.top;
        }
        const width = Math.min(Math.max(cellRect.width, 25), contentRect.width);
        style = `style='height: ${height}px;width:${width}px;left: ${(cellRect.left < contentRect.left || cellRect.left + width > contentRect.right) ? contentRect.left : cellRect.left}px;${style}'`;
    } else {
        style = `style='height: ${height}px;width:${Math.max(cellRect.width, 25)}px;left: ${cellRect.left}px;${style}'`;
    }

    if (["text", "email", "phone", "block", "template"].includes(type)) {
        html = `<textarea ${style} spellcheck="false" class="b3-text-field"></textarea>`;
    } else if (type === "url") {
        html = `<textarea ${style} spellcheck="false" class="b3-text-field">${cellElements[0].firstElementChild.getAttribute("data-href")}</textarea>`;
    } else if (type === "number") {
        html = `<input type="number" spellcheck="false" value="${cellElements[0].firstElementChild.getAttribute("data-content")}" ${style} class="b3-text-field">`;
    } else {
        if (["select", "mSelect"].includes(type)) {
            if (blockElement.getAttribute("data-rendering") === "true") {
                return;
            }
            openMenuPanel({protyle, blockElement, type: "select", cellElements});
        } else if (type === "mAsset") {
            openMenuPanel({protyle, blockElement, type: "asset", cellElements});
            focusBlock(blockElement);
        } else if (type === "date") {
            openMenuPanel({protyle, blockElement, type: "date", cellElements});
        } else if (type === "checkbox") {
            updateCellValueByInput(protyle, type, blockElement, cellElements);
        } else if (type === "relation") {
            openMenuPanel({protyle, blockElement, type: "relation", cellElements});
        } else if (type === "rollup") {
            openMenuPanel({
                protyle,
                blockElement,
                type: "rollup",
                cellElements,
                colId: getColId(cellElements[0], viewType)
            });
        }
        if (viewType === "table" && !hasClosestByClassName(cellElements[0], "custom-attr")) {
            cellElements[0].classList.add("av__cell--select");
            addDragFill(cellElements[0]);
        }
        return;
    }
    window.siyuan.menus.menu.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="av__mask" style="z-index: ${++window.siyuan.zIndex}">
    ${html}
</div>`);
    const avMaskElement = document.querySelector(".av__mask");
    const inputElement = avMaskElement.querySelector(".b3-text-field") as HTMLInputElement;
    if (inputElement) {
        if (["text", "email", "phone", "block", "template"].includes(type)) {
            inputElement.value = cellElements[0].querySelector(".av__celltext")?.textContent || "";
        }
        inputElement.select();
        inputElement.focus();
        callMobileAppShowKeyboard();
        if (type === "template") {
            fetchPost("/api/av/renderAttributeView", {
                id: blockElement.dataset.avId,
                viewID: blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW)
            }, (response) => {
                getFieldsByData(response.data).find((item: IAVColumn) => {
                    if (item.id === getColId(cellElements[0], viewType)) {
                        inputElement.value = item.template;
                        inputElement.dataset.template = item.template;
                        return true;
                    }
                });
            });
        }
        if (type === "block") {
            inputElement.addEventListener("input", (event: InputEvent) => {
                if (Constants.BLOCK_HINT_KEYS.includes(inputElement.value.substring(0, 2))) {
                    protyle.toolbar.range = document.createRange();
                    if (cellElements[0] && !blockElement.contains(cellElements[0])) {
                        const rowID = getFieldIdByCellElement(cellElements[0], viewType);
                        if (viewType === "table") {
                            cellElements[0] = (blockElement.querySelector(`.av__row[data-id="${rowID}"] .av__cell[data-col-id="${cellElements[0].dataset.colId}"]`)) as HTMLElement;
                        } else {
                            cellElements[0] = (blockElement.querySelector(`.av__gallery-item[data-id="${rowID}"] .av__cell[data-field-id="${cellElements[0].dataset.fieldId}"]`)) as HTMLElement;
                        }
                    }
                    protyle.toolbar.range.selectNodeContents(cellElements[0].lastChild);
                    focusByRange(protyle.toolbar.range);
                    if (viewType === "table") {
                        cellElements[0].classList.add("av__cell--select");
                        addDragFill(cellElements[0]);
                    }
                    let textPlain = inputElement.value;
                    if (isDynamicRef(textPlain)) {
                        textPlain = textPlain.substring(2, 22 + 2);
                    } else {
                        textPlain = textPlain.substring(2);
                    }
                    hintRef(textPlain, protyle, "av");
                    avMaskElement?.remove();
                    event.preventDefault();
                    event.stopPropagation();
                }
            });
        }
        inputElement.addEventListener("keydown", (event) => {
            if (event.isComposing) {
                return;
            }
            if (electronUndo(event)) {
                return;
            }
            if (event.key === "Escape" || event.key === "Tab" ||
                (event.key === "Enter" && !event.shiftKey && isNotCtrl(event))) {
                updateCellValueByInput(protyle, type, blockElement, cellElements);
                if (event.key === "Tab") {
                    protyle.wysiwyg.element.dispatchEvent(new KeyboardEvent("keydown", {
                        shiftKey: event.shiftKey,
                        ctrlKey: event.ctrlKey,
                        altKey: event.altKey,
                        metaKey: event.metaKey,
                        key: "Tab",
                        keyCode: 9
                    }));
                }
                event.preventDefault();
                event.stopPropagation();
            }
        });
    }

    const removeAvMask = (event: Event) => {
        if ((event.target as HTMLElement).classList.contains("av__mask")
            && document.activeElement.tagName !== "TEXTAREA" && document.activeElement.tagName !== "INPUT") {
            updateCellValueByInput(protyle, type, blockElement, cellElements);
            avMaskElement?.remove();
        }
    };
    avMaskElement.addEventListener("click", (event) => {
        removeAvMask(event);
    });
    avMaskElement.addEventListener("contextmenu", (event) => {
        removeAvMask(event);
    });
    avMaskElement.addEventListener("mousedown", (event: MouseEvent & { target: HTMLElement }) => {
        if (event.button === 1) {
            if (event.target.classList.contains("av__mask") && document.activeElement && document.activeElement.nodeType === 1) {
                (document.activeElement as HTMLElement).blur();
            }
            removeAvMask(event);
        }
    });
};

const updateCellValueByInput = (protyle: IProtyle, type: TAVCol, blockElement: HTMLElement, cellElements: HTMLElement[]) => {
    const viewType = blockElement.getAttribute("data-av-type") as TAVView;
    if (viewType === "table") {
        const rowElement = hasClosestByClassName(cellElements[0], "av__row");
        if (!rowElement) {
            return;
        }
        if (cellElements.length === 1 && cellElements[0].dataset.detached === "true" && !rowElement.dataset.id) {
            return;
        }
    }
    const avMaskElement = document.querySelector(".av__mask");
    const avID = blockElement.getAttribute("data-av-id");
    if (type === "template") {
        const colId = getColId(cellElements[0], viewType);
        const textElement = avMaskElement.querySelector(".b3-text-field") as HTMLInputElement;
        if (textElement.value !== textElement.dataset.template && !blockElement.getAttribute("data-loading")) {
            submitAVColumnEditTransaction(protyle, [{
                action: "updateAttrViewColTemplate",
                id: colId,
                avID,
                data: textElement.value,
                type: "template",
            }], [{
                action: "updateAttrViewColTemplate",
                id: colId,
                avID,
                data: textElement.dataset.template,
                type: "template",
            }]);
            blockElement.setAttribute("data-loading", "true");
        }
    } else {
        updateCellsValue(protyle, blockElement, type === "checkbox" ? {
            checked: cellElements[0].querySelector("use").getAttribute("xlink:href") === "#iconUncheck"
        } : (avMaskElement.querySelector(".b3-text-field") as HTMLInputElement).value, cellElements);
    }
    if (viewType === "table" &&
        // 兼容新增行后台隐藏
        cellElements[0] &&
        !hasClosestByClassName(cellElements[0], "custom-attr")) {
        cellElements[0].classList.add("av__cell--select");
        addDragFill(cellElements[0]);
    }
    //  单元格编辑中 ctrl+p 光标定位
    if (!document.querySelector(".b3-dialog")) {
        focusBlock(blockElement);
    }
    document.querySelectorAll(".av__mask").forEach((item) => {
        item.remove();
    });
};
