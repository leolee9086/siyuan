import {Menu} from "../../../plugin/Menu";
import {hasClosestByClassName} from "../../util/hasClosest";
import {setPosition} from "../../../util/DOM/positioning/setPosition";
import {upDownHint} from "../../../util/DOM/upDownHint";
import {fetchPost} from "../../../util/network/fetch";
import * as dayjs from "dayjs";
import {filterSelect} from "./filter.operator";
import {siyuanI18n} from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 用途：转义用户控制的 HTML 属性；使用范围：筛选菜单中的 option 名称、颜色和输入值；解耦评估：统一复用 DOM 转义 owner。 */
import {escapeAttr} from "../../../util/DOM/escape";
/** 用途：转义用户控制的可见文本；使用范围：筛选菜单标签和关联候选项；解耦评估：统一复用 DOM 转义 owner。 */
import {escapeHtml} from "../../../util/DOM/escape";

export const buildFilterMenuItems = (
    menu: Menu,
    filterValue: IAVCellValue,
    colData: IAVColumn,
    filter: IAVFilter,
) => {
    if (filterValue.type === "select" || filterValue.type === "mSelect") {
        if (colData.options?.length > 0) {
            menu.addItem({
                iconHTML: "",
                type: "readonly",
                label: `<input class="b3-text-field fn__size200" style="margin: 4px 0" placeholder="${siyuanI18n.search}">`,
                bind(element) {
                    const selectSearchElement = element.querySelector("input");
                    selectSearchElement.addEventListener("keydown", (event: KeyboardEvent) => {
                        if (event.isComposing) {
                            return;
                        }
                        let currentElement = upDownHint(menu.element.querySelector(".b3-menu__items"), event, "b3-menu__item--current", element.nextElementSibling);
                        if (event.key === "Enter") {
                            if (!currentElement) {
                                currentElement = menu.element.querySelector(".b3-menu__item--current");
                            }
                            currentElement.dispatchEvent(new CustomEvent("click"));
                        }
                    });
                    selectSearchElement.addEventListener("input", (event: InputEvent) => {
                        if (event.isComposing) {
                            return;
                        }
                        filterSelect(selectSearchElement.value.toLowerCase());
                    });
                    selectSearchElement.addEventListener("compositionend", () => {
                        filterSelect(selectSearchElement.value.toLowerCase());
                    });
                }
            });
        }
        colData.options?.forEach((option) => {
            let icon = "iconUncheck";
            filterValue?.mSelect?.find((optionItem: IAVCellSelectValue) => {
                if (optionItem.content === option.name) {
                    icon = "iconCheck";
                }
            });
            menu.addItem({
                icon,
                label: `<span class="b3-chip b3-chip--middle" data-name="${escapeAttr(option.name)}" data-color="${escapeAttr(option.color)}" style="max-width: 178px;margin:3px 0;background-color:var(--b3-font-background${escapeAttr(option.color)});color:var(--b3-font-color${escapeAttr(option.color)})">
    <span class="fn__ellipsis">${escapeHtml(option.name)}</span>
</span>`,
                bind(element) {
                    element.addEventListener("click", () => {
                        const useElement = element.querySelector("use");
                        if (useElement.getAttribute("xlink:href") === "#iconUncheck") {
                            useElement.setAttribute("xlink:href", "#iconCheck");
                        } else {
                            useElement.setAttribute("xlink:href", "#iconUncheck");
                        }
                    });
                }
            });
        });
    } else if (["text", "url", "block", "mAsset", "email", "phone", "template"].includes(filterValue.type)) {
        let value = "";
        if (filterValue) {
            if (filterValue.type === "mAsset") {
                if (filterValue.mAsset) {
                    value = filterValue.mAsset[0]?.content || "";
                }
            } else {
                value = filterValue[filterValue.type as "text"].content || "";
            }
        }
        menu.addItem({
            iconHTML: "",
            type: "readonly",
            label: `<input style="margin: 4px 0" value="${escapeAttr(value)}" class="b3-text-field fn__size200">`
        });
    } else if (filterValue.type === "relation") {
        let value = "";
        if (filterValue) {
            value = filterValue.relation.blockIDs[0] || "";
        }
        menu.addItem({
            iconHTML: "",
            type: "readonly",
            label: `<input style="margin: 4px 0" value="${escapeAttr(value)}" class="b3-text-field fn__size200"><div style="position:fixed" class="protyle-hint b3-list b3-list--background fn__none"></div>`,
            bind(element) {
                const inputElement = element.querySelector("input");
                const listElement = inputElement.nextElementSibling as HTMLElement;
                const renderList = () => {
                    if (!colData.relation || !colData.relation.avID) {
                        return;
                    }
                    fetchPost("/api/av/getAttributeViewPrimaryKeyValues", {
                        id: colData.relation.avID,
                        keyword: inputElement.value,
                    }, response => {
                        let html = "";
                        (response.data.rows.values as IAVCellValue[] || []).forEach((item, index) => {
                            html += `<div class="b3-list-item${index === 0 ? " b3-list-item--focus" : ""}">${escapeHtml(item.block.content || siyuanI18n.untitled)}</div>`;
                        });
                        listElement.innerHTML = html;
                        if (html === "") {
                            listElement.classList.add("fn__none");
                        } else {
                            listElement.classList.remove("fn__none");
                        }
                        const inputRect = inputElement.getBoundingClientRect();
                        setPosition(listElement, inputRect.left, inputRect.bottom + 4, inputRect.height + 4);
                    });
                };
                inputElement.addEventListener("input", (event: KeyboardEvent) => {
                    if (event.isComposing) {
                        return;
                    }
                    renderList();
                });
                inputElement.addEventListener("compositionend", () => {
                    renderList();
                });
                inputElement.addEventListener("keydown", (event) => {
                    if (event.isComposing) {
                        return;
                    }
                    if (event.key !== "Enter" && listElement.innerHTML !== "") {
                        listElement.classList.remove("fn__none");
                    }
                    upDownHint(listElement, event);
                    if (event.key === "Enter") {
                        if (listElement.classList.contains("fn__none")) {
                            menu.close();
                        } else {
                            inputElement.value = listElement.querySelector(".b3-list-item--focus").textContent.replace(/\n/g, " ");
                            listElement.classList.add("fn__none");
                        }
                        event.preventDefault();
                        event.stopPropagation();
                    }
                });
                listElement.addEventListener("click", (event) => {
                    const itemElement = hasClosestByClassName(event.target as Element, "b3-list-item");
                    if (itemElement) {
                        inputElement.value = itemElement.textContent.replace(/\n/g, " ");
                        listElement.classList.add("fn__none");
                    }
                });
            }
        });
    } else if (filterValue.type === "number") {
        menu.addItem({
            iconHTML: "",
            type: "readonly",
            label: `<input style="margin: 4px 0" value="${filterValue?.number.isNotEmpty ? filterValue.number.content : ""}" class="b3-text-field fn__size200">`
        });
    } else if (["date", "updated", "created"].includes(filterValue.type)) {
        const dateValue = filterValue ? filterValue[filterValue.type as "date"] : null;
        const showToday = !filter.relativeDate?.direction;
        const showToday2 = !filter.relativeDate2?.direction;
        menu.addItem({
            iconHTML: "",
            type: "readonly",
            label: `<div data-type="filter1">
    <div class="fn__size200">
        <select class="b3-select fn__block" data-type="dateType">
            <option value="time"${!filter.relativeDate ? " selected" : ""}>${siyuanI18n.includeTime}</option>
            <option value="custom"${filter.relativeDate ? " selected" : ""}>${siyuanI18n.relativeToToday}</option>
        </select>
    </div>
    <div class="fn__hr"></div>
    <div class="fn__size200 ${filter.relativeDate ? "fn__none" : ""}">
        <input value="${(dateValue && (dateValue.isNotEmpty || filterValue.type !== "date")) ? dayjs(dateValue.content).format("YYYY-MM-DD") : ""}" type="date" max="9999-12-31" class="b3-text-field fn__block">
    </div>
    <div class="fn__flex fn__size200 ${filter.relativeDate ? "" : "fn__none"}">
        <select class="b3-select" data-type="dataDirection">
            <option value="-1"${filter.relativeDate?.direction === -1 ? " selected" : ""}>${siyuanI18n.pastDate}</option>
            <option value="1"${filter.relativeDate?.direction === 1 ? " selected" : ""}>${siyuanI18n.nextDate}</option>
            <option value="0"${showToday ? " selected" : ""}>${siyuanI18n.current}</option>
        </select>
        <span class="fn__space"></span>
        <input type="number" min="1" oninput="this.value = Math.max(this.value, 1)" step="1" value="${filter.relativeDate?.count || 1}" class="b3-text-field fn__flex-1${showToday ? " fn__none" : ""}"/>
        <span class="fn__space${showToday ? " fn__none" : ""}"></span>
        <select class="b3-select fn__flex-1">
            <option value="0"${filter.relativeDate?.unit === 0 ? " selected" : ""}>${siyuanI18n.day}</option>
            <option value="1"${(!filter.relativeDate || filter.relativeDate?.unit === 1) ? " selected" : ""}>${siyuanI18n.week}</option>
            <option value="2"${filter.relativeDate?.unit === 2 ? " selected" : ""}>${siyuanI18n.month}</option>
            <option value="3"${filter.relativeDate?.unit === 3 ? " selected" : ""}>${siyuanI18n.year}</option>
        </select>
    </div>
    <div class="fn__hr--small"></div>
</div>
<div data-type="filter2 fn__none">
    <div class="fn__hr--small"></div>
    <div class="fn__size200 ${filter.relativeDate2 ? "fn__none" : ""}">
        <input value="${(dateValue && dateValue.isNotEmpty2) ? dayjs(dateValue.content2).format("YYYY-MM-DD") : ""}" type="date" max="9999-12-31" class="b3-text-field fn__block">
    </div>
    <div class="fn__flex fn__size200 ${filter.relativeDate2 ? "" : "fn__none"}">
        <select class="b3-select" data-type="dataDirection">
            <option value="-1"${filter.relativeDate2?.direction === -1 ? " selected" : ""}>${siyuanI18n.pastDate}</option>
            <option value="1"${filter.relativeDate2?.direction === 1 ? " selected" : ""}>${siyuanI18n.nextDate}</option>
            <option value="0"${showToday2 ? " selected" : ""}>${siyuanI18n.current}</option>
        </select>
        <span class="fn__space"></span>
        <input type="number" min="1" step="1" oninput="this.value = Math.max(this.value, 1)" value="${filter.relativeDate2?.count || 1}" class="b3-text-field fn__flex-1${showToday2 ? " fn__none" : ""}"/>
        <span class="fn__space${showToday2 ? " fn__none" : ""}"></span>
        <select class="b3-select fn__flex-1">
            <option value="0"${filter.relativeDate2?.unit === 0 ? " selected" : ""}>${siyuanI18n.day}</option>
            <option value="1"${(!filter.relativeDate2 || filter.relativeDate2?.unit === 1) ? " selected" : ""}>${siyuanI18n.week}</option>
            <option value="2"${filter.relativeDate2?.unit === 2 ? " selected" : ""}>${siyuanI18n.month}</option>
            <option value="3"${filter.relativeDate2?.unit === 3 ? " selected" : ""}>${siyuanI18n.year}</option>
        </select>
    </div>
    <div class="fn__hr--small"></div>
</div>`
        });
    }
};

export const bindFilterMenuEvents = (
    menu: Menu,
    operationElement: HTMLSelectElement,
    filterValue: IAVCellValue,
) => {
    const toggleEmpty = (element: HTMLElement, operator: string, type: TAVCol) => {
        const menuEl = hasClosestByClassName(element, "b3-menu");
        if (menuEl) {
            if (["date", "updated", "created"].includes(type)) {
                const filterEl = menuEl.querySelector('.b3-menu__item div[data-type="filter1"]');
                const filter2El = filterEl.nextElementSibling;
                if (operator === "Is between") {
                    filter2El.classList.remove("fn__none");
                    filterEl.classList.remove("fn__none");
                } else if (operator === "Is empty" || operator === "Is not empty") {
                    filter2El.classList.add("fn__none");
                    filterEl.classList.add("fn__none");
                } else {
                    filterEl.classList.remove("fn__none");
                    filter2El.classList.add("fn__none");
                }
                return;
            }
            menuEl.querySelectorAll("input, .b3-chip").forEach((inputElement) => {
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

    operationElement?.addEventListener("change", () => {
        toggleEmpty(operationElement, operationElement.value, filterValue.type);
    });
    const dateTypeElement = menu.element.querySelector('.b3-select[data-type="dateType"]') as HTMLSelectElement;
    dateTypeElement?.addEventListener("change", () => {
        const directionElements = menu.element.querySelectorAll('[data-type="dataDirection"]');
        const customerElement = directionElements[0].parentElement;
        const customer2Element = directionElements[1].parentElement;
        const timeElement = customerElement.previousElementSibling;
        const time2Element = customer2Element.previousElementSibling;
        if (dateTypeElement.value === "custom") {
            customerElement.classList.remove("fn__none");
            customer2Element.classList.remove("fn__none");
            timeElement.classList.add("fn__none");
            time2Element.classList.add("fn__none");
        } else {
            customerElement.classList.add("fn__none");
            customer2Element.classList.add("fn__none");
            timeElement.classList.remove("fn__none");
            time2Element.classList.remove("fn__none");
        }
    });
    menu.element.querySelectorAll('.b3-select[data-type="dataDirection"]').forEach((item: HTMLSelectElement) => {
        item.addEventListener("change", () => {
            const countElement = item.nextElementSibling.nextElementSibling;
            if (item.value === "0") {
                countElement.classList.add("fn__none");
                countElement.nextElementSibling.classList.add("fn__none");
            } else {
                countElement.classList.remove("fn__none");
                countElement.nextElementSibling.classList.remove("fn__none");
            }
        });
    });

    const textElements: NodeListOf<HTMLInputElement> = menu.element.querySelectorAll(".b3-text-field");
    if (!["relation", "select", "mSelect"].includes(filterValue.type)) {
        textElements.forEach(item => {
            item.addEventListener("keydown", (event: KeyboardEvent) => {
                if (event.isComposing) {
                    event.preventDefault();
                    return;
                }
                if (event.key === "Enter") {
                    menu.close();
                    event.preventDefault();
                }
            });
        });
    }
    toggleEmpty(operationElement, operationElement.value, filterValue.type);
    return textElements;
};
