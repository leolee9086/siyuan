import {getColIconByType} from "./col/col.typeUtils";
import {unicode2Emoji} from "../../../emoji";
import * as dayjs from "dayjs";
import {getFieldsByData} from "./view/metadata";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";

export const getFiltersHTML = (data: IAV) => {
    let html = "";
    const fields = getFieldsByData(data);
    const genFilterItem = (filter: IAVFilter) => {
        let filterHTML = "";
        fields.find((item) => {
            if (item.id === filter.column && item.type === filter.value.type) {
                let filterText = "";
                if (["rollup", "mAsset"].includes(item.type)) {
                    if (filter.quantifier === "" || filter.quantifier === "Any") {
                        filterText = siyuanI18n.filterQuantifierAny + " ";
                    } else if (filter.quantifier === "All") {
                        filterText = siyuanI18n.filterQuantifierAll + " ";
                    } else if (filter.quantifier === "None") {
                        filterText = siyuanI18n.filterQuantifierNone + " ";
                    }
                }
                const filterValue = item.type === "rollup" ? (filter.value.rollup?.contents?.length > 0 ? filter.value.rollup.contents[0] : {type: "rollup"} as IAVCellValue) : filter.value;
                if (filter.operator === "Is empty") {
                    filterText = ": " + filterText + siyuanI18n.filterOperatorIsEmpty;
                } else if (filter.operator === "Is not empty") {
                    filterText = ": " + filterText + siyuanI18n.filterOperatorIsNotEmpty;
                } else if (filter.operator === "Is false") {
                    if (filterValue.type !== "checkbox" || typeof filterValue.checkbox.checked === "boolean") {
                        filterText = ": " + filterText + siyuanI18n.unchecked;
                    }
                } else if (filter.operator === "Is true") {
                    if (filterValue.type !== "checkbox" || typeof filterValue.checkbox.checked === "boolean") {
                        filterText = ": " + filterText + siyuanI18n.checked;
                    }
                } else if (["created", "updated", "date"].includes(filterValue.type)) {
                    let dateValue = "";
                    let dateValue2 = "";
                    if (filter.relativeDate) {
                        dateValue = `${siyuanI18n[["pastDate", "current", "nextDate"][filter.relativeDate.direction + 1]]}
 ${filter.relativeDate.direction ? filter.relativeDate.count : ""}
 ${siyuanI18n[["day", "week", "month", "year"][filter.relativeDate.unit]]}`;
                        if (filter.relativeDate2) {
                            dateValue2 = `${siyuanI18n[["pastDate", "current", "nextDate"][filter.relativeDate2.direction + 1]]}
 ${filter.relativeDate2.direction ? filter.relativeDate2.count : ""}
 ${siyuanI18n[["day", "week", "month", "year"][filter.relativeDate2.unit]]}`;
                        }
                    } else if (filterValue) {
                        if (filterValue[filterValue.type as "date"]?.content) {
                            dateValue = dayjs(filterValue[filterValue.type as "date"].content).format("YYYY-MM-DD");
                        }
                        if (filterValue && filterValue[filterValue.type as "date"]?.content2) {
                            dateValue2 = dayjs(filterValue[filterValue.type as "date"].content2).format("YYYY-MM-DD");
                        }
                    }
                    if (dateValue) {
                        if (filter.operator === "Is between" && dateValue2) {
                            filterText = ` ${filterText}${siyuanI18n.filterOperatorIsBetween} ${dateValue} ${dateValue2}`;
                        } else if ("=" === filter.operator) {
                            filterText = `: ${filterText}${dateValue}`;
                        } else if ([">", "<"].includes(filter.operator)) {
                            filterText = ` ${filterText}${filter.operator} ${dateValue}`;
                        } else if (">=" === filter.operator) {
                            filterText = ` ${filterText}≥ ${dateValue}`;
                        } else if ("<=" === filter.operator) {
                            filterText = ` ${filterText}≤ ${dateValue}`;
                        }
                    }
                } else if (["mSelect", "select"].includes(filterValue.type)) {
                    let selectContent = "";
                    if (filterValue.mSelect?.length > 0) {
                        filterValue.mSelect.forEach((item, index) => {
                            selectContent += item.content;
                            if (index !== filterValue.mSelect.length - 1) {
                                selectContent += ", ";
                            }
                        });
                        if (selectContent) {
                            if ("Contains" === filter.operator) {
                                filterText = `: ${filterText}${selectContent}`;
                            } else if (filter.operator === "Does not contains") {
                                filterText = ` ${filterText}${siyuanI18n.filterOperatorDoesNotContain} ${selectContent}`;
                            } else if (filter.operator === "=") {
                                filterText = `: ${filterText}${selectContent}`;
                            } else if (filter.operator === "!=") {
                                filterText = ` ${filterText}${siyuanI18n.filterOperatorIsNot} ${selectContent}`;
                            }
                        }
                    }
                    if (!selectContent && ["rollup", "mAsset"].includes(item.type) && !["Is empty", "Is not empty"].includes(filter.operator)) {
                        filterText = "";
                    }
                } else if (filterValue.type === "number" && filterValue.number && filterValue.number.isNotEmpty) {
                    if (["=", "!=", ">", "<"].includes(filter.operator)) {
                        filterText = ` ${filterText}${filter.operator} ${filterValue.number.content}`;
                    } else if (">=" === filter.operator) {
                        filterText = ` ${filterText}≥ ${filterValue.number.content}`;
                    } else if ("<=" === filter.operator) {
                        filterText = ` ${filterText}≤ ${filterValue.number.content}`;
                    }
                } else if (["text", "block", "url", "mAsset", "phone", "email", "relation", "template"].includes(filterValue.type)) {
                    let content: string;
                    if (filterValue[filterValue.type as "text"]) {
                        if (filterValue.type === "relation") {
                            content = filterValue.relation.blockIDs[0] || "";
                        } else if (filterValue.type === "mAsset") {
                            content = filterValue.mAsset[0]?.content || "";
                        } else {
                            content = filterValue[filterValue.type as "text"].content || "";
                        }
                        if (content) {
                            if (["=", "Contains"].includes(filter.operator)) {
                                filterText = `: ${filterText}${content}`;
                            } else if (filter.operator === "Does not contains") {
                                filterText = ` ${filterText}${siyuanI18n.filterOperatorDoesNotContain} ${content}`;
                            } else if (filter.operator === "!=") {
                                filterText = ` ${filterText}${siyuanI18n.filterOperatorIsNot} ${content}`;
                            } else if ("Starts with" === filter.operator) {
                                filterText = ` ${filterText}${siyuanI18n.filterOperatorStartsWith} ${content}`;
                            } else if ("Ends with" === filter.operator) {
                                filterText = ` ${filterText}${siyuanI18n.filterOperatorEndsWith} ${content}`;
                            } else if ([">", "<"].includes(filter.operator)) {
                                filterText = ` ${filterText}${filter.operator} ${content}`;
                            } else if (">=" === filter.operator) {
                                filterText = ` ${filterText}≥ ${content}`;
                            } else if ("<=" === filter.operator) {
                                filterText = ` ${filterText}≤ ${content}`;
                            }
                        }
                    }
                    if (!content && ["rollup", "mAsset"].includes(item.type) && !["Is empty", "Is not empty"].includes(filter.operator)) {
                        filterText = "";
                    }
                }
                filterHTML += `<span data-type="setFilter" class="b3-chip${filterText ? " b3-chip--primary" : ""}">
    ${item.icon ? unicode2Emoji(item.icon, "icon", true) : `<svg class="icon"><use xlink:href="#${getColIconByType(item.type)}"></use></svg>`}
    <span class="fn__ellipsis">${item.name}${filterText}</span>
</span>`;
                return true;
            }
        });
        return filterHTML;
    };
    data.view.filters.forEach((item: IAVFilter) => {
        const filterHTML = genFilterItem(item);
        if (filterHTML) {
            html += `<button class="b3-menu__item" draggable="true" data-id="${item.column}" data-filter-type="${item.value.type}">
    <svg class="b3-menu__icon fn__grab"><use xlink:href="#iconDrag"></use></svg>
    <div class="fn__flex-1">${filterHTML}</div>
    <svg class="b3-menu__action" data-type="removeFilter"><use xlink:href="#iconTrashcan"></use></svg>
</button>`;
        }
    });
    return `<div class="b3-menu__items">
<button class="b3-menu__item" data-type="nobg">
    <span class="block__icon" style="padding: 8px;margin-left: -4px;" data-type="go-config">
        <svg><use xlink:href="#iconLeft"></use></svg>
    </span>
    <span class="b3-menu__label ft__center">${siyuanI18n.filter}</span>
</button>
<button class="b3-menu__separator"></button>
${html}
<button class="b3-menu__item${data.view.filters.length === fields.length ? " fn__none" : ""}" data-type="addFilter">
    <svg class="b3-menu__icon"><use xlink:href="#iconAdd"></use></svg>
    <span class="b3-menu__label">${siyuanI18n.addFilter}</span>
</button>
<button class="b3-menu__item b3-menu__item--warning${html ? "" : " fn__none"}" data-type="removeFilters">
    <svg class="b3-menu__icon"><use xlink:href="#iconTrashcan"></use></svg>
    <span class="b3-menu__label">${siyuanI18n.removeFilters}</span>
</button>
</div>`;
};
