import {Constants} from "../../../constants";
import {getColIconByType} from "./col/col.typeUtils";
import {addDragFill, cellScrollIntoView, renderCell} from "./cell";
import {unicode2Emoji} from "../../../emoji";
import {focusBlock} from "../../util/selection";
import {hasClosestBlock, hasClosestByAttribute, hasClosestByClassName} from "../../util/hasClosest";
import {stickyRow, updateHeader} from "./row";
import {getCalcValue} from "./calc";
import {electronUndo} from "../../undo";
import {isInMobileApp} from "../../util/compatibility";
import {activeBlur} from "../../../mobile/util/keyboardToolbar";
import {addClearButton} from "../../../util/DOM/addClearButton";
import {escapeAttr, escapeHtml} from "../../../util/DOM/escape";
import {genTabHeaderHTML} from "./render";
import {updateSearch} from "./render";
import {isMobile} from "../../../platform";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import {initVirtualScroll} from "./virtualScroll";

export interface ITableOptions {
    protyle: IProtyle,
    blockElement: HTMLElement,
    cb: (data: IAV) => void,
    data: IAV,
    renderAll: boolean,
    resetData: {
        left: number,
        alignSelf: string,
        headerTransform: { groupId: string, transform: string },
        footerTransform: { groupId: string, transform: string },
        isSearching: boolean,
        selectCellId: IIds,
        selectRowIds: IIds[],
        dragFillId: IIds,
        activeIds: IIds[],
        query: string,
        pageSizes: { [key: string]: string },
        virtualData: { [key: string]: IAVVirtualData },
    }
}

interface IIds {
    groupId: string,
    rowId: string,
    colId?: string
}

export const getTableHTMLs = async (data: IAVTable, e: HTMLElement, virtualData?: IAVVirtualData) => {
    let calcHTML = "";
    let contentHTML = '<div class="av__row av__row--header"><div class="av__colsticky"><div class="av__firstcol"><svg><use xlink:href="#iconUncheck"></use></svg></div></div>';
    let pinIndex = -1;
    let pinMaxIndex = -1;
    let indexWidth = 0;
    const eWidth = e.clientWidth;
    data.columns.forEach((item, index) => {
        if (!item.hidden) {
            if (item.pin) {
                pinIndex = index;
            }
            if (indexWidth < eWidth - 200) {
                indexWidth += parseInt(item.width) || 200;
                pinMaxIndex = index;
            }
        }
    });
    if (eWidth === 0) {
        pinMaxIndex = pinIndex;
    }
    pinIndex = Math.min(pinIndex, pinMaxIndex);
    if (pinIndex > -1) {
        contentHTML = '<div class="av__row av__row--header"><div class="av__colsticky"><div class="av__firstcol"><svg><use xlink:href="#iconUncheck"></use></svg></div>';
        calcHTML = '<div class="av__colsticky">';
    }
    let hasCalc = false;
    data.columns.forEach((column: IAVColumn, index: number) => {
        if (column.hidden) {
            return;
        }
        contentHTML += `<div class="av__cell av__cell--header" data-col-id="${column.id}"  draggable="true" 
data-icon="${column.icon}" data-dtype="${column.type}" data-wrap="${column.wrap}" data-pin="${column.pin}" 
data-desc="${escapeAttr(column.desc)}" data-position="north" 
style="width: ${column.width || "200px"};">
    ${column.icon ? unicode2Emoji(column.icon, "av__cellheadericon", true) : `<svg class="av__cellheadericon"><use xlink:href="#${getColIconByType(column.type)}"></use></svg>`}
    <span class="av__celltext fn__flex-1">${escapeHtml(column.name)}</span>
    ${column.pin ? '<svg class="av__cellheadericon av__cellheadericon--pin"><use xlink:href="#iconPin"></use></svg>' : ""}
    <div class="av__widthdrag"></div>
</div>`;
        if (pinIndex === index) {
            contentHTML += "</div>";
        }
        if (column.type === "lineNumber") {
            // lineNumber type 不参与计算操作
            calcHTML += `<div data-col-id="${column.id}" data-dtype="${column.type}" class="av__calc" style="width: ${column.width || "200px"}">&nbsp;</div>`;
        } else {
            calcHTML += `<div class="av__calc${column.calc && column.calc.operator !== "" ? " av__calc--ashow" : ""}" data-col-id="${column.id}" data-dtype="${column.type}" data-operator="${column.calc?.operator || ""}" 
style="width: ${column.width || "200px"}">${getCalcValue(column) || `<svg><use xlink:href="#iconDown"></use></svg><small>${siyuanI18n.calc}</small>`}</div>`;
        }
        if (column.calc && column.calc.operator !== "") {
            hasCalc = true;
        }

        if (pinIndex === index) {
            calcHTML += "</div>";
        }
    });
    contentHTML += `<div class="block__icons" style="min-height: auto" data-pinindex="${pinIndex}">
    <div class="block__icon block__icon--show" data-type="av-header-more"><svg><use xlink:href="#iconMore"></use></svg></div>
    <div class="fn__space"></div>
    <div class="block__icon block__icon--show ariaLabel" aria-label="${siyuanI18n.newCol}" data-type="av-header-add" data-position="4south"><svg><use xlink:href="#iconAdd"></use></svg></div>
</div>
</div>`;
    if (virtualData?.topSpacerHeight) {
        contentHTML += `<div class="av__spacer" style="height: ${virtualData.topSpacerHeight}px;"></div>`;
    }
    // body
    for (const [rowIndex, row] of data.rows.entries()) {
        if (virtualData && typeof virtualData.renderedEnd === "number") {
            if (rowIndex === 0) {
                e.setAttribute(Constants.ATTRIBUTE_V_SCROLL, "true");
            }
            if (rowIndex > virtualData.renderedEnd || rowIndex < virtualData.renderedStart) {
                continue;
            }
        } else if (data.pageSize > 100 && rowIndex > 99) {
            e.setAttribute(Constants.ATTRIBUTE_V_SCROLL, "true");
            break;
        }
        contentHTML += `<div class="av__row" data-id="${row.id}" data-index="${rowIndex}">`;
        if (pinIndex > -1) {
            contentHTML += '<div class="av__colsticky"><div class="av__firstcol"><svg><use xlink:href="#iconUncheck"></use></svg></div>';
        } else {
            contentHTML += '<div class="av__colsticky"><div class="av__firstcol"><svg><use xlink:href="#iconUncheck"></use></svg></div></div>';
        }

        for (const [index, cell] of row.cells.entries()) {
            if (data.columns[index].hidden) {
                continue;
            }
            // https://github.com/siyuan-note/siyuan/issues/10262
            let checkClass = "";
            if (cell.valueType === "checkbox") {
                checkClass = cell.value?.checkbox?.checked ? " av__cell-check" : " av__cell-uncheck";
            }
            const rendered = await renderCell(cell.value, rowIndex, data.showIcon);
            contentHTML += `<div class="av__cell${checkClass}" data-id="${cell.id}" data-col-id="${data.columns[index].id}" 
data-wrap="${data.columns[index].wrap}" 
data-dtype="${data.columns[index].type}" 
${cell.value?.isDetached ? ' data-detached="true"' : ""} 
style="width: ${data.columns[index].width || "200px"};
${cell.valueType === "number" ? "text-align: right;" : ""}
${cell.bgColor ? `background-color:${cell.bgColor};` : ""}
${cell.color ? `color:${cell.color};` : ""}">${rendered}</div>`;

            if (pinIndex === index) {
                contentHTML += "</div>";
            }
        }
        contentHTML += "<div></div></div>";
    }
    return `${contentHTML}<div class="av__row--util${data.rowCount > data.rows.length ? " av__readonly--show" : ""}">
    <div class="av__colsticky">
        <button class="b3-button av__button" data-type="av-add-bottom">
            <svg><use xlink:href="#iconAdd"></use></svg>
            <span>${siyuanI18n.newRow}</span>
        </button>
        <span class="fn__space"></span>
        <button class="b3-button av__button${data.rowCount > data.rows.length ? "" : " fn__none"}" data-type="av-load-more">
            <svg><use xlink:href="#iconArrowDown"></use></svg>
            <span>${siyuanI18n.loadMore}</span>
            <svg data-type="set-page-size" data-size="${data.pageSize}"><use xlink:href="#iconMore"></use></svg>
        </button>
    </div>
</div>
<div class="av__row--footer${hasCalc ? " av__readonly--show" : ""}">${calcHTML}</div>`;
};

export const getGroupTitleHTML = (group: IAVView, counter: number) => {
    let nameHTML = "";
    if (["mSelect", "select"].includes(group.groupValue.type)) {
        group.groupValue.mSelect.forEach((item) => {
            nameHTML += `<span class="b3-chip" style="background-color:var(--b3-font-background${item.color});color:var(--b3-font-color${item.color})">${escapeHtml(item.content)}</span>`;
        });
    } else if (group.groupValue.type === "checkbox") {
        nameHTML = `<svg style="width:calc(1.625em - 12px);height:calc(1.625em - 12px)"><use xlink:href="#icon${group.groupValue.checkbox.checked ? "Check" : "Uncheck"}"></use></svg>`;
    } else {
        nameHTML = group.name;
    }
    // av__group-name 为第三方需求，本应用内没有使用，但不能移除 https://github.com/siyuan-note/siyuan/issues/15736
    return `<div class="av__group-title">
    <div class="av__group-icon" data-type="av-group-fold" data-id="${group.id}">
        <svg class="${group.groupFolded ? "" : "av__group-arrow--open"}"><use xlink:href="#iconRight"></use></svg>
    </div>
    <span class="fn__space"></span>
    <span class="av__group-name">${nameHTML}</span>
    ${(!counter || counter === 0) ? '<span class="fn__space"></span>' : `<span aria-label="${siyuanI18n.entryNum}" data-position="north" class="av__group-counter ariaLabel">${counter}</span>`}
    <span class="av__group-icon av__group-icon--hover ariaLabel" data-type="av-add-top" data-position="north" aria-label="${siyuanI18n.newRow}"><svg><use xlink:href="#iconAdd"></use></svg></span>
</div>`;
};

export const renderGroupTable = async (options: ITableOptions) => {
    const searchInputElement = options.blockElement.querySelector('[data-type="av-search"]');
    const isSearching = searchInputElement && document.activeElement === searchInputElement;
    const query = searchInputElement?.textContent || "";

    let avBodyHTML = "";
    for (const group of options.data.view.groups) {
        if (group.groupHidden === 0) {
            const tableHTMLs = await getTableHTMLs(group, options.blockElement, options.resetData.virtualData[group.id]);
            avBodyHTML += `${getGroupTitleHTML(group, group.rowCount)}
<div data-group-id="${group.id}" data-page-size="${group.pageSize}" data-dtype="${group.groupKey.type}" data-content="${Lute.EscapeHTMLStr(group.groupValue.text?.content || "")}" style="float: left" class="av__body${group.groupFolded ? " fn__none" : ""}">${tableHTMLs}</div>`;
        }
    }
    if (options.renderAll) {
        options.blockElement.firstElementChild.outerHTML = `<div class="av__container">
    ${genTabHeaderHTML(options.data, isSearching || !!query, !options.protyle.disabled && !hasClosestByAttribute(options.blockElement, "data-type", "NodeBlockQueryEmbed"))}
    <div class="av__scroll">
        ${avBodyHTML}
    </div>
    <div class="av__cursor" contenteditable="true">${Constants.ZWSP}</div>
</div>`;
    } else {
        options.blockElement.firstElementChild.querySelector(".av__scroll").innerHTML = avBodyHTML;
    }
    afterRenderTable(options);
};

export const afterRenderTable = (options: ITableOptions) => {
    if (options.blockElement.getAttribute("data-need-focus") === "true") {
        focusBlock(options.blockElement);
        options.blockElement.removeAttribute("data-need-focus");
    }
    options.blockElement.setAttribute("data-render", "true");
    options.blockElement.querySelector(".av__scroll").scrollLeft = options.resetData.left;
    options.blockElement.style.alignSelf = options.resetData.alignSelf;
    const editRect = options.protyle.contentElement.getBoundingClientRect();
    if (options.resetData.headerTransform) {
        const headerTransformElement = options.blockElement.querySelector(`.av__body[data-group-id="${options.resetData.headerTransform.groupId}"] .av__row--header`) as HTMLElement;
        if (headerTransformElement) {
            headerTransformElement.style.transform = options.resetData.headerTransform.transform;
        }
    } else if (editRect && !options.protyle.options.action.includes(Constants.CB_GET_HISTORY)) {
        // 需等待渲染完，否则 getBoundingClientRect 错误 https://github.com/siyuan-note/siyuan/issues/13787
        setTimeout(() => {
            stickyRow(options.blockElement, editRect, "top");
        }, Constants.TIMEOUT_LOAD);
    }
    if (options.resetData.footerTransform) {
        const footerTransformElement = options.blockElement.querySelector(`.av__body[data-group-id="${options.resetData.footerTransform.groupId}"] .av__row--footer`) as HTMLElement;
        if (footerTransformElement) {
            footerTransformElement.style.transform = options.resetData.footerTransform.transform;
        }
    } else if (editRect && !options.protyle.options.action.includes(Constants.CB_GET_HISTORY)) {
        // 需等待渲染完，否则 getBoundingClientRect 错误 https://github.com/siyuan-note/siyuan/issues/13787
        setTimeout(() => {
            stickyRow(options.blockElement, editRect, "bottom");
        }, Constants.TIMEOUT_LOAD);
    }
    if (options.resetData.selectCellId) {
        let newCellElement = options.blockElement.querySelector(`.av__body[data-group-id="${options.resetData.selectCellId.groupId}"] .av__row[data-id="${options.resetData.selectCellId.rowId}"] .av__cell[data-col-id="${options.resetData.selectCellId.colId}"]`);
        if (!newCellElement) {
            newCellElement = options.blockElement.querySelector(`.av__row[data-id="${options.resetData.selectCellId.rowId}"] .av__cell[data-col-id="${options.resetData.selectCellId.colId}"]`);
        }
        if (newCellElement) {
            newCellElement.classList.add("av__cell--select");
            cellScrollIntoView(options.blockElement, newCellElement);
        }
        const avMaskElement = document.querySelector(".av__mask");
        const avPanelElement = document.querySelector(".av__panel");
        if (avMaskElement) {
            (avMaskElement.querySelector("textarea, input") as HTMLTextAreaElement)?.focus();
        } else if (!avPanelElement && !options.resetData.isSearching && getSelection().rangeCount > 0) {
            const range = getSelection().getRangeAt(0);
            const blockElement = hasClosestBlock(range.startContainer);
            if (blockElement && options.blockElement === blockElement) {
                focusBlock(options.blockElement);
            }
        } else if (avPanelElement && !newCellElement) {
            avPanelElement.remove();
        }
    }
    options.resetData.selectRowIds.forEach((selectRowId, index) => {
        let rowElement = options.blockElement.querySelector(`.av__body[data-group-id="${selectRowId.groupId}"] .av__row[data-id="${selectRowId.rowId}"]`) as HTMLElement;
        if (!rowElement) {
            rowElement = options.blockElement.querySelector(`.av__row[data-id="${selectRowId.rowId}"]`) as HTMLElement;
        }
        if (rowElement) {
            rowElement.classList.add("av__row--select");
            rowElement.querySelector(".av__firstcol use").setAttribute("xlink:href", "#iconCheck");
        }
        if (index === options.resetData.selectRowIds.length - 1 && rowElement) {
            updateHeader(rowElement);
        }
    });
    Object.keys(options.resetData.pageSizes).forEach((groupId) => {
        const bodyElement = options.blockElement.querySelector(`.av__body[data-group-id="${groupId === "unGroup" ? "" : groupId}"]`) as HTMLElement;
        if (bodyElement) {
            bodyElement.dataset.pageSize = options.resetData.pageSizes[groupId];
        }
    });
    if (options.resetData.dragFillId) {
        let dragCellElement = options.blockElement.querySelector(`.av__body[data-group-id="${options.resetData.dragFillId.groupId}"] .av__row[data-id="${options.resetData.dragFillId.rowId}"] .av__cell[data-col-id="${options.resetData.dragFillId.colId}"]`);
        if (!dragCellElement) {
            dragCellElement = options.blockElement.querySelector(`.av__row[data-id="${options.resetData.dragFillId.rowId}"] .av__cell[data-col-id="${options.resetData.dragFillId.colId}"]`);
        }
        addDragFill(dragCellElement);
    }
    options.resetData.activeIds.forEach(activeId => {
        let activeCellElement = options.blockElement.querySelector(`.av__body[data-group-id="${activeId.groupId}"] .av__row[data-id="${activeId.rowId}"] .av__cell[data-col-id="${activeId.colId}"]`);
        if (!activeCellElement) {
            activeCellElement = options.blockElement.querySelector(`.av__row[data-id="${activeId.rowId}"] .av__cell[data-col-id="${activeId.colId}"]`);
        }
        activeCellElement?.classList.add("av__cell--active");
    });
    if (getSelection().rangeCount > 0) {
        // 修改表头后光标重新定位
        const range = getSelection().getRangeAt(0);
        if (!hasClosestByClassName(range.startContainer, "av__title")) {
            const blockElement = hasClosestBlock(range.startContainer);
            if (blockElement && options.blockElement === blockElement && !options.resetData.isSearching) {
                focusBlock(options.blockElement);
            }
        }
    }
    options.blockElement.querySelector(".layout-tab-bar").scrollLeft = (options.blockElement.querySelector(".layout-tab-bar .item--focus") as HTMLElement).offsetLeft - 30;
    if (options.cb) {
        options.cb(options.data);
    }
    if (!options.renderAll) {
        return;
    }
    const viewsElement = options.blockElement.querySelector(".av__views") as HTMLElement;
    const searchInputElement = options.blockElement.querySelector('[data-type="av-search"]') as HTMLElement;
    searchInputElement.textContent = options.resetData.query || "";
    if (options.resetData.isSearching) {
        searchInputElement.focus();
    }
    searchInputElement.addEventListener("compositionstart", (event: KeyboardEvent) => {
        event.stopPropagation();
    });
    searchInputElement.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.isComposing) {
            return;
        }
        electronUndo(event);
    });
    searchInputElement.addEventListener("input", (event: KeyboardEvent) => {
        event.stopPropagation();
        if (event.isComposing) {
            return;
        }
        if (searchInputElement.textContent || document.activeElement === searchInputElement) {
            viewsElement.classList.add("av__views--show");
        } else {
            viewsElement.classList.remove("av__views--show");
        }
        updateSearch(options.blockElement, options.protyle);
    });
    searchInputElement.addEventListener("compositionend", () => {
        updateSearch(options.blockElement, options.protyle);
    });
    searchInputElement.addEventListener("blur", (event: KeyboardEvent) => {
        if (event.isComposing) {
            return;
        }
        if (!searchInputElement.textContent) {
            viewsElement.classList.remove("av__views--show");
            searchInputElement.style.width = "0";
            searchInputElement.style.paddingLeft = "0";
            searchInputElement.style.paddingRight = "0";
        }
    });
    addClearButton({
        inputElement: searchInputElement,
        right: 0,
        width: "1em",
        height: searchInputElement.clientHeight,
        clearAriaLabel: siyuanI18n.clear,
        clearCB() {
            viewsElement.classList.remove("av__views--show");
            searchInputElement.style.width = "0";
            searchInputElement.style.paddingLeft = "0";
            searchInputElement.style.paddingRight = "0";
            focusBlock(options.blockElement);
            updateSearch(options.blockElement, options.protyle);
            if (isMobile) {
                activeBlur();
            }
        }
    });
    initVirtualScroll(options);
};
