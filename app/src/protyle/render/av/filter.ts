import {Menu} from "../../../plugin/Menu";
import {transaction} from "../../wysiwyg/transaction";
import {hasClosestByClassName} from "../../util/hasClosest";
import {getColIconByType} from "./col";
import {setPosition} from "../../../util/setPosition";
import {objEquals} from "../../../util/functions";
import {genCellValue} from "./cell";
import {unicode2Emoji} from "../../../emoji";
import {openMenuPanel} from "./openMenuPanel";
import {showMessage} from "../../../dialog/message";
import {getFieldsByData} from "./view";
import {Constants} from "../../../constants";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import {getOperatorSelectHTML, getCheckboxSelectHTML, resolveRollupFilterValue} from "./filter.operator";
import {buildFilterMenuItems, bindFilterMenuEvents} from "./filter.menu";
import {getFiltersHTML} from "./filter.render";
export {getFiltersHTML} from "./filter.render";

export const getDefaultOperatorByType = (type: TAVCol) => {
    if (["select", "number", "date", "created", "updated"].includes(type)) {
        return "=";
    }
    if (["checkbox"].includes(type)) {
        return "Is false";
    }
    if (["rollup", "relation", "mAsset", "text", "mSelect", "url", "block", "email", "phone", "template"].includes(type)) {
        return "Contains";
    }
};

export const setFilter = async (options: {
    filter: IAVFilter,
    protyle: IProtyle,
    data: IAV,
    target: HTMLElement,
    blockElement: Element,
    empty: boolean
}) => {
    let rectTarget = options.target.getBoundingClientRect();
    if (rectTarget.height === 0) {
        rectTarget = options.protyle.wysiwyg.element.querySelector(`[data-col-id="${options.target.dataset.colId}"]`).getBoundingClientRect();
    }
    const blockID = options.blockElement.getAttribute("data-node-id");
    let operationElement: HTMLSelectElement = undefined;
    const menu = new Menu("set-filter-" + options.filter.column, () => {
        const oldFilters = JSON.parse(JSON.stringify(options.data.view.filters));
        if (!operationElement || !operationElement.value) {
            return;
        }
        const newFilter: IAVFilter = {
            column: options.filter.column,
            value: {
                type: options.filter.value.type
            },
            operator: operationElement.value as TAVFilterOperator
        };
        let hasMatch = false;
        let newValue;
        if (filterValue.type === "select" || filterValue.type === "mSelect") {
            const mSelect: {
                color: string,
                content: string
            }[] = [];
            window.siyuan.menus.menu.element.querySelectorAll("svg").forEach(item => {
                if (item.firstElementChild.getAttribute("xlink:href") === "#iconCheck") {
                    const chipElement = item.nextElementSibling.firstElementChild as HTMLElement;
                    mSelect.push({
                        color: chipElement.dataset.color,
                        content: chipElement.dataset.name
                    });
                }
            });
            newValue = genCellValue(filterValue.type, mSelect);
        } else if (["date", "updated", "created"].includes(filterValue.type)) {
            const typeElement = menu.element.querySelector('.b3-select[data-type="dateType"]') as HTMLSelectElement;
            const directElements = menu.element.querySelectorAll('.b3-select[data-type="dataDirection"]') as NodeListOf<HTMLSelectElement>;
            if (typeElement.value === "custom") {
                newFilter.relativeDate = {
                    count: parseInt((directElements[0].parentElement.querySelector(".b3-text-field") as HTMLInputElement).value || "1"),
                    unit: parseInt((directElements[0].parentElement.lastElementChild as HTMLSelectElement).value),
                    direction: parseInt(directElements[0].value)
                };
                newFilter.relativeDate2 = {
                    count: parseInt((directElements[1].parentElement.querySelector(".b3-text-field") as HTMLInputElement).value || "1"),
                    unit: parseInt((directElements[1].parentElement.lastElementChild as HTMLSelectElement).value),
                    direction: parseInt(directElements[1].value)
                };
                newValue = {type: filterValue.type};
            } else {
                newValue = genCellValue(filterValue.type, {
                    isNotEmpty2: textElements[2].value !== "",
                    isNotEmpty: textElements[0].value !== "",
                    content: textElements[0].value ? new Date(textElements[0].value + " 00:00").getTime() : 0,
                    content2: textElements[2].value ? new Date(textElements[2].value + " 00:00").getTime() : 0,
                    hasEndDate: newFilter.operator === "Is between",
                    isNotTime: true,
                });
                newFilter.relativeDate = null;
                newFilter.relativeDate2 = null;
            }
        } else if (["text", "mAsset", "url", "block", "email", "phone", "template", "relation", "number"].includes(filterValue.type)) {
            newValue = genCellValue(filterValue.type, textElements[0].value);
        } else if (filterValue.type === "checkbox") {
            newValue = genCellValue(filterValue.type, {
                checked: newFilter.operator === "Is true"
            });
        } else {
            newValue = genCellValue(filterValue.type, undefined);
        }
        if (options.filter.value.type === "rollup") {
            newFilter.value = {
                rollup: {
                    contents: [newValue],
                },
                type: "rollup"
            };
        } else {
            newFilter.value = newValue;
        }
        if (["rollup", "mAsset"].includes(options.filter.value.type)) {
            newFilter.quantifier = (menu.element.querySelector('.b3-select[data-type="quantifier"]') as HTMLSelectElement).value;
        }
        let isSame = false;
        options.data.view.filters.find((filter, index) => {
            if (filter.column === options.filter.column && filter.value.type === options.filter.value.type) {
                if (filter.value.type === "checkbox") {
                    hasMatch = true;
                    options.data.view.filters[index] = newFilter;
                    return true;
                }
                if (objEquals(filter, newFilter)) {
                    isSame = true;
                    return true;
                }
                options.data.view.filters[index] = newFilter;
                hasMatch = true;
                return true;
            }
        });
        if (!options.empty && (isSame || !hasMatch)) {
            return;
        }
        transaction(options.protyle, [{
            action: "setAttrViewFilters",
            avID: options.data.id,
            data: options.data.view.filters,
            blockID
        }], [{
            action: "setAttrViewFilters",
            avID: options.data.id,
            data: oldFilters,
            blockID
        }]);
        const menuElement = hasClosestByClassName(options.target, "b3-menu");
        if (menuElement) {
            menuElement.innerHTML = getFiltersHTML(options.data);
        }
    });
    if (menu.isOpen) {
        return;
    }
    let colData: IAVColumn;
    const fields = getFieldsByData(options.data);
    fields.find((column) => {
        if (column.id === options.filter.column) {
            colData = column;
            return true;
        }
    });
    let filterValue: IAVCellValue = JSON.parse(JSON.stringify(options.filter.value));
    if (colData.type === "rollup") {
        const resolved = await resolveRollupFilterValue(colData, fields, filterValue, options.data.view.filters);
        if (!resolved) {
            showMessage(siyuanI18n.plsChoose);
            document.querySelector(".av__panel")?.remove();
            openMenuPanel({
                protyle: options.protyle,
                blockElement: options.blockElement,
                type: "edit",
                colId: colData.id
            });
            return;
        }
        filterValue = resolved;
    }
    let checkboxInit = false;
    if (filterValue.type === "checkbox") {
        checkboxInit = typeof filterValue.checkbox === "undefined" || typeof filterValue.checkbox.checked === "undefined";
    }
    let selectHTML = "";
    if (filterValue.type === "checkbox") {
        selectHTML = getCheckboxSelectHTML(options.filter.operator, checkboxInit);
    } else {
        selectHTML = getOperatorSelectHTML(filterValue.type, options.filter.operator);
    }
    if (["rollup", "mAsset"].includes(options.filter.value.type)) {
        menu.addItem({
            iconHTML: "",
            type: "readonly",
            label: ` <select style="margin: 4px 0" class="b3-select fn__size200" data-type="quantifier">
    <option ${(options.filter.quantifier === "" || options.filter.quantifier === "Any") ? "selected" : ""} value="Any">${siyuanI18n.filterQuantifierAny}</option>
    <option ${"All" === options.filter.quantifier ? "selected" : ""} value="All">${siyuanI18n.filterQuantifierAll}</option>
    <option ${"None" === options.filter.quantifier ? "selected" : ""} value="None">${siyuanI18n.filterQuantifierNone}</option>
</select>`
        });
    }
    menu.addItem({
        iconHTML: "",
        type: "readonly",
        label: `<select style="margin: 4px 0" class="b3-select fn__size200" data-type="operation">${selectHTML}</select>`
    });
    buildFilterMenuItems(menu, filterValue, colData, options.filter);
    menu.addItem({
        icon: "iconTrashcan",
        label: siyuanI18n.removeFilters,
        click() {
            const oldFilters = Object.assign([], options.data.view.filters);
            options.data.view.filters.find((item: IAVFilter, index: number) => {
                if (item.column === options.filter.column && options.filter.value.type === item.value.type) {
                    options.data.view.filters.splice(index, 1);
                    return true;
                }
            });
            transaction(options.protyle, [{
                action: "setAttrViewFilters",
                avID: options.data.id,
                data: options.data.view.filters,
                blockID
            }], [{
                action: "setAttrViewFilters",
                avID: options.data.id,
                data: oldFilters,
                blockID
            }]);
            const menuElement = hasClosestByClassName(options.target, "b3-menu");
            if (menuElement) {
                menuElement.innerHTML = getFiltersHTML(options.data);
            }
        }
    });
    operationElement = (menu.element.querySelector('.b3-select[data-type="operation"]') as HTMLSelectElement);
    const textElements = bindFilterMenuEvents(menu, operationElement, filterValue);
    menu.open({x: rectTarget.left, y: rectTarget.bottom});
    if (textElements.length > 0) {
        textElements[0].select();
    }
};

export const addFilter = (options: {
    data: IAV,
    rect: DOMRect,
    menuElement: HTMLElement,
    tabRect: DOMRect,
    avId: string,
    protyle: IProtyle
    blockElement: Element
}) => {
    const menu = new Menu(Constants.MENU_AV_ADD_FILTER);
    getFieldsByData(options.data).forEach((column) => {
        let filter: IAVFilter;
        options.data.view.filters.find((item) => {
            if (item.column === column.id && item.value.type === column.type) {
                filter = item;
                return true;
            }
        });
        // 该列是行号类型列，则不允许添加到过滤器
        if (!filter && column.type !== "lineNumber") {
            menu.addItem({
                label: column.name,
                iconHTML: column.icon ? unicode2Emoji(column.icon, "b3-menu__icon", true) : `<svg class="b3-menu__icon"><use xlink:href="#${getColIconByType(column.type)}"></use></svg>`,
                click: () => {
                    const cellValue = genCellValue(column.type, column.type === "checkbox" ? {checked: undefined} : "");
                    filter = {
                        column: column.id,
                        operator: getDefaultOperatorByType(column.type),
                        value: cellValue,
                    };
                    options.data.view.filters.push(filter);
                    options.menuElement.innerHTML = getFiltersHTML(options.data);
                    setPosition(options.menuElement, options.tabRect.right - options.menuElement.clientWidth, options.tabRect.bottom, options.tabRect.height);
                    const filterElement = options.menuElement.querySelector(`[data-id="${column.id}"] .b3-chip`) as HTMLElement;
                    setFilter({
                        empty: true,
                        filter,
                        protyle: options.protyle,
                        data: options.data,
                        target: filterElement,
                        blockElement: options.blockElement
                    });
                }
            });
        }
    });
    menu.open({
        x: options.rect.left,
        y: options.rect.bottom,
        h: options.rect.height,
    });
};
