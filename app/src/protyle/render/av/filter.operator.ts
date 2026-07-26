import {hasClosestByClassName} from "../../util/hasClosest";
import {fetchSyncPost} from "../../../util/network/fetch";
import {genCellValue} from "./cell.value";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";

export const toggleEmpty = (element: HTMLElement, operator: string, type: TAVCol) => {
    const menuElement = hasClosestByClassName(element, "b3-menu");
    if (menuElement) {
        if (["date", "updated", "created"].includes(type)) {
            const filterElement = menuElement.querySelector('.b3-menu__item div[data-type="filter1"]');
            const filter2Element = filterElement.nextElementSibling;
            if (operator === "Is between") {
                filter2Element.classList.remove("fn__none");
                filterElement.classList.remove("fn__none");
            } else if (operator === "Is empty" || operator === "Is not empty") {
                filter2Element.classList.add("fn__none");
                filterElement.classList.add("fn__none");
            } else {
                filterElement.classList.remove("fn__none");
                filter2Element.classList.add("fn__none");
            }
            return;
        }
        menuElement.querySelectorAll("input, .b3-chip").forEach((inputElement) => {
            const menuItemElement = hasClosestByClassName(inputElement, "b3-menu__item");
            if (menuItemElement) {
                if (operator !== "Is empty" && operator !== "Is not empty") {
                    menuItemElement.classList.remove("fn__none");
                } else {
                    menuItemElement.classList.add("fn__none");
                }
            }
        });
    }
};

export const filterSelect = (key: string) => {
    window.siyuan.menus.menu.element.querySelectorAll(".b3-menu__item").forEach((item) => {
        const nameElement = item.querySelector(".b3-chip.b3-chip--middle") as HTMLElement;
        if (nameElement) {
            const itemName = nameElement.dataset.name.toLowerCase();
            if (!key || (key.indexOf(itemName) > -1 || itemName.indexOf(key) > -1)) {
                item.classList.remove("fn__none");
            } else {
                item.classList.add("fn__none");
            }
        }
    });
};

export const getOperatorSelectHTML = (type: TAVCol, operator: TAVFilterOperator): string => {
    switch (type) {
        case "checkbox":
            return "";
        case "block":
        case "mAsset":
        case "text":
        case "url":
        case "phone":
        case "email":
            return `<option ${"=" === operator ? "selected" : ""} value="=">${siyuanI18n.filterOperatorIs}</option>
<option ${"!=" === operator ? "selected" : ""} value="!=">${siyuanI18n.filterOperatorIsNot}</option>
<option ${"Contains" === operator ? "selected" : ""} value="Contains">${siyuanI18n.filterOperatorContains}</option>
<option ${"Does not contains" === operator ? "selected" : ""} value="Does not contains">${siyuanI18n.filterOperatorDoesNotContain}</option>
<option ${"Starts with" === operator ? "selected" : ""} value="Starts with">${siyuanI18n.filterOperatorStartsWith}</option>
<option ${"Ends with" === operator ? "selected" : ""} value="Ends with">${siyuanI18n.filterOperatorEndsWith}</option>
<option ${"Is empty" === operator ? "selected" : ""} value="Is empty">${siyuanI18n.filterOperatorIsEmpty}</option>
<option ${"Is not empty" === operator ? "selected" : ""} value="Is not empty">${siyuanI18n.filterOperatorIsNotEmpty}</option>`;
        case "template":
            return `<option ${"=" === operator ? "selected" : ""} value="=">${siyuanI18n.filterOperatorIs}</option>
<option ${"!=" === operator ? "selected" : ""} value="!=">${siyuanI18n.filterOperatorIsNot}</option>
<option ${"Contains" === operator ? "selected" : ""} value="Contains">${siyuanI18n.filterOperatorContains}</option>
<option ${"Does not contains" === operator ? "selected" : ""} value="Does not contains">${siyuanI18n.filterOperatorDoesNotContain}</option>
<option ${"Starts with" === operator ? "selected" : ""} value="Starts with">${siyuanI18n.filterOperatorStartsWith}</option>
<option ${"Ends with" === operator ? "selected" : ""} value="Ends with">${siyuanI18n.filterOperatorEndsWith}</option>
<option ${"Is empty" === operator ? "selected" : ""} value="Is empty">${siyuanI18n.filterOperatorIsEmpty}</option>
<option ${"Is not empty" === operator ? "selected" : ""} value="Is not empty">${siyuanI18n.filterOperatorIsNotEmpty}</option>
<option ${">" === operator ? "selected" : ""} value=">">&gt;</option>
<option ${"<" === operator ? "selected" : ""} value="<">&lt;</option>
<option ${">=" === operator ? "selected" : ""} value=">=">&GreaterEqual;</option>
<option ${"<=" === operator ? "selected" : ""} value="<=">&le;</option>`;
        case "date":
        case "created":
        case "updated":
            return `<option ${"=" === operator ? "selected" : ""} value="=">${siyuanI18n.filterOperatorIs}</option>
<option ${">" === operator ? "selected" : ""} value=">">${siyuanI18n.filterOperatorIsAfter}</option>
<option ${"<" === operator ? "selected" : ""} value="<">${siyuanI18n.filterOperatorIsBefore}</option>
<option ${">=" === operator ? "selected" : ""} value=">=">${siyuanI18n.filterOperatorIsOnOrAfter}</option>
<option ${"<=" === operator ? "selected" : ""} value="<=">${siyuanI18n.filterOperatorIsOnOrBefore}</option>
<option ${"Is between" === operator ? "selected" : ""} value="Is between">${siyuanI18n.filterOperatorIsBetween}</option>
<option ${"Is empty" === operator ? "selected" : ""} value="Is empty">${siyuanI18n.filterOperatorIsEmpty}</option>
<option ${"Is not empty" === operator ? "selected" : ""} value="Is not empty">${siyuanI18n.filterOperatorIsNotEmpty}</option>`;
        case "number":
            return `<option ${"=" === operator ? "selected" : ""} value="=">=</option>
<option ${"!=" === operator ? "selected" : ""} value="!=">!=</option>
<option ${">" === operator ? "selected" : ""} value=">">&gt;</option>
<option ${"<" === operator ? "selected" : ""} value="<">&lt;</option>
<option ${">=" === operator ? "selected" : ""} value=">=">&GreaterEqual;</option>
<option ${"<=" === operator ? "selected" : ""} value="<=">&le;</option>
<option ${"Is empty" === operator ? "selected" : ""} value="Is empty">${siyuanI18n.filterOperatorIsEmpty}</option>
<option ${"Is not empty" === operator ? "selected" : ""} value="Is not empty">${siyuanI18n.filterOperatorIsNotEmpty}</option>`;
        case "mSelect":
        case "relation":
            return `<option ${"Contains" === operator ? "selected" : ""} value="Contains">${siyuanI18n.filterOperatorContains}</option>
<option ${"Does not contains" === operator ? "selected" : ""} value="Does not contains">${siyuanI18n.filterOperatorDoesNotContain}</option>
<option ${"Is empty" === operator ? "selected" : ""} value="Is empty">${siyuanI18n.filterOperatorIsEmpty}</option>
<option ${"Is not empty" === operator ? "selected" : ""} value="Is not empty">${siyuanI18n.filterOperatorIsNotEmpty}</option>`;
        case "select":
            return `<option ${"=" === operator ? "selected" : ""} value="=">${siyuanI18n.filterOperatorIs}</option>
<option ${"!=" === operator ? "selected" : ""} value="!=">${siyuanI18n.filterOperatorIsNot}</option>
<option ${"Is empty" === operator ? "selected" : ""} value="Is empty">${siyuanI18n.filterOperatorIsEmpty}</option>
<option ${"Is not empty" === operator ? "selected" : ""} value="Is not empty">${siyuanI18n.filterOperatorIsNotEmpty}</option>`;
        default:
            return "";
    }
};

export const getCheckboxSelectHTML = (operator: TAVFilterOperator, checkboxInit: boolean): string => {
    let selectHTML = `<option ${("Is true" === operator && !checkboxInit) ? "selected" : ""} value="Is true">${siyuanI18n.checked}</option>
<option ${("Is false" === operator && !checkboxInit) ? "selected" : ""} value="Is false">${siyuanI18n.unchecked}</option>`;
    if (checkboxInit) {
        selectHTML = `<option selected></option>${selectHTML}`;
    }
    return selectHTML;
};

export const resolveRollupFilterValue = async (
    colData: IAVColumn,
    fields: IAVColumn[],
    filterValue: IAVCellValue,
    viewFilters: IAVFilter[],
): Promise<IAVCellValue | null> => {
    if (colData.type !== "rollup") {
        return filterValue;
    }
    if (!colData.rollup || !colData.rollup.relationKeyID || !colData.rollup.keyID) {
        return null;
    }
    if (colData.rollup.calc?.operator && !["Range", "Unique values"].includes(colData.rollup.calc.operator)) {
        if (["Count all", "Count empty", "Count not empty", "Count values", "Count unique values", "Percent empty",
            "Percent not empty", "Percent unique values", "Percent checked", "Percent unchecked",
            "Sum", "Average", "Median", "Min", "Max"].includes(colData.rollup.calc.operator)) {
            filterValue.type = "number";
        } else if (["Checked", "Unchecked"].includes(colData.rollup.calc.operator)) {
            filterValue.type = "checkbox";
        } else if (["Earliest", "Latest"].includes(colData.rollup.calc.operator)) {
            filterValue.type = "date";
        }
    } else {
        let targetAVId = "";
        fields.find((column) => {
            if (column.id === colData.rollup.relationKeyID) {
                targetAVId = column.relation.avID;
                return true;
            }
        });
        const response = await fetchSyncPost("/api/av/getAttributeView", {id: targetAVId});
        response.data.av.keyValues.find((item: {
            key: {
                id: string,
                name: string,
                type: TAVCol,
                options: {
                    name: string,
                    color: string,
                }[]
            }
        }) => {
            if (item.key.id === colData.rollup.keyID) {
                filterValue.type = item.key.type;
                if (item.key.type === "select") {
                    colData.options = item.key.options;
                }
                return true;
            }
        });
    }

    viewFilters.find(item => {
        if (item.column === colData.id && item.value.type === "rollup") {
            if (!item.value.rollup || !item.value.rollup.contents || item.value.rollup.contents.length === 0) {
                const colType = filterValue.type === "select" ? "mSelect" : filterValue.type;
                filterValue = {
                    [colType]: genCellValue(filterValue.type, filterValue.type === "checkbox" ? {checked: undefined} : "")[colType as "text"],
                    type: filterValue.type
                };
            } else {
                filterValue = item.value.rollup.contents[0];
            }
            return true;
        }
    });
    return filterValue;
};
