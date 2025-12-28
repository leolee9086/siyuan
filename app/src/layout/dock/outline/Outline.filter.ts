/**
 * Outline 筛选和层级展开/折叠功能
 * 从 Outline.ts 拆分出来以保持单文件行数限制
 */
import { MenuItem } from "../../../menus/Menu.Item";
import { Constants } from "../../../constants";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import type { Outline } from "./Outline";

/**
 * 获取标题元素的实际标题级别（H1=1, H2=2, 等等）
 * @param element li元素
 * @returns 标题级别（1-6）
 */
export function getHeadingLevel(this: Outline, element: HTMLElement) {
    return parseInt(element.getAttribute("data-subtype")?.replace("h", "") || "0");
}

/**
 * 展开到指定标题级别
 * @param targetLevel 目标标题级别，1-6级（H1-H6），6级表示全部展开
 */
export function expandToLevel(this: Outline, targetLevel: number) {
    if (targetLevel >= 6) {
        // 全部展开
        this.tree.expandAll();
    } else {
        // 展开到指定标题级别
        this.element.querySelectorAll("li.b3-list-item").forEach(item => {
            const headingLevel = this.getHeadingLevel(item as HTMLElement);
            const arrowElement = item.querySelector(".b3-list-item__arrow");
            if (item.nextElementSibling && item.nextElementSibling.tagName === "UL" && arrowElement) {
                if (headingLevel > 0 && headingLevel < targetLevel) {
                    // 当前标题级别小于目标级别，展开
                    arrowElement.classList.add("b3-list-item__arrow--open");
                    item.nextElementSibling.classList.remove("fn__none");
                } else if (headingLevel >= targetLevel) {
                    // 当前标题级别大于等于目标级别，折叠
                    arrowElement.classList.remove("b3-list-item__arrow--open");
                    item.nextElementSibling.classList.add("fn__none");
                }
            }
        });
    }
    this.saveExpendIds();
}

/**
 * 显示展开层级菜单
 */
export function showExpandLevelMenu(this: Outline, target: HTMLElement) {
    window.siyuan.menus.menu.remove();
    window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_OUTLINE_EXPAND_LEVEL);
    for (let i = 1; i <= 6; i++) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: `heading${i}`,
            icon: `iconH${i}`,
            label: siyuanI18n[`heading${i}`],
            click: () => this.expandToLevel(i)
        }).element);
    }
    const rect = target.getBoundingClientRect();
    window.siyuan.menus.menu.popup({
        x: rect.left,
        y: rect.bottom,
        h: rect.height
    });
    return window.siyuan.menus.menu;
}

/**
 * 切换同层级的所有标题的展开/折叠状态（基于标题级别而不是DOM层级）
 */
export function collapseSameLevel(this: Outline, element: HTMLElement, expand?: boolean) {
    // 获取所有相同标题级别的元素
    this.element.querySelectorAll(`li.b3-list-item[data-subtype="${element.getAttribute("data-subtype")}"]`).forEach(item => {
        const arrowElement = item.querySelector(".b3-list-item__arrow");
        if (typeof expand === "undefined") {
            expand = !element.querySelector(".b3-list-item__arrow").classList.contains("b3-list-item__arrow--open");
        }
        if (expand) {
            if (item.nextElementSibling && item.nextElementSibling.tagName === "UL") {
                item.nextElementSibling.classList.remove("fn__none");
                arrowElement.classList.add("b3-list-item__arrow--open");
            }
            let ulElement = item.parentElement;
            while (ulElement && !ulElement.classList.contains("b3-list") && ulElement.tagName === "UL") {
                ulElement.classList.remove("fn__none");
                ulElement.previousElementSibling.querySelector(".b3-list-item__arrow").classList.add("b3-list-item__arrow--open");
                ulElement = ulElement.parentElement;
            }
        } else {
            if (item.nextElementSibling && item.nextElementSibling.tagName === "UL") {
                item.nextElementSibling.classList.add("fn__none");
                arrowElement.classList.remove("b3-list-item__arrow--open");
            }
        }
    });
    this.saveExpendIds();
}

/**
 * 展开/折叠子项
 */
export function collapseChildren(this: Outline, element: HTMLElement, expand?: boolean) {
    const nextElement = element.nextElementSibling;
    if (!nextElement || nextElement.tagName !== "UL") {
        return;
    }
    const arrowElement = element.querySelector(".b3-list-item__arrow");
    if (typeof expand === "undefined") {
        expand = !arrowElement.classList.contains("b3-list-item__arrow--open");
    }
    if (expand) {
        arrowElement.classList.add("b3-list-item__arrow--open");
        nextElement.classList.remove("fn__none");
        nextElement.querySelectorAll("ul").forEach(item => {
            item.previousElementSibling.querySelector(".b3-list-item__arrow").classList.add("b3-list-item__arrow--open");
            item.classList.remove("fn__none");
        });
    } else {
        arrowElement.classList.remove("b3-list-item__arrow--open");
        nextElement.classList.add("fn__none");
    }
    this.saveExpendIds();
}

/**
 * 应用大纲筛选
 */
export function setFilter(this: Outline) {
    // 还原 display
    this.element.querySelectorAll('li.b3-list-item[style$="display: none;"]').forEach((item: HTMLElement) => {
        item.style.display = "";
    });
    this.element.querySelectorAll("ul.fn__none").forEach((item) => {
        item.previousElementSibling.querySelector(".b3-list-item__toggle").classList.remove("fn__hidden");
    });
    const keyword = (this.headerElement.querySelector("input.b3-text-field.search__label") as HTMLInputElement).value.toLowerCase();
    if (keyword) {
        // 首次筛选时记录折叠状态
        if (!this.preFilterExpandIds) {
            this.preFilterExpandIds = this.tree.getExpandIds();
        }
        const processUL = (ul: Element) => {
            let hasMatch = false;
            let hasChildMatch = false;
            const children = ul.querySelectorAll(":scope > li.b3-list-item");

            children.forEach((liItem: HTMLElement) => {
                const nextUlElement = (liItem.nextElementSibling && liItem.nextElementSibling.tagName === "UL") ? liItem.nextElementSibling as HTMLElement : undefined;

                let childResult = { hasMatch: false, hasChildMatch: false };
                if (nextUlElement) {
                    childResult = processUL(nextUlElement);
                }

                const arrowElement = liItem.querySelector(".b3-list-item__arrow");
                if ((liItem.querySelector(".b3-list-item__text")?.textContent || "").trim().toLowerCase().includes(keyword)) {
                    // 当前标题命中
                    liItem.style.display = "";
                    hasMatch = true;

                    if (nextUlElement) {
                        nextUlElement.classList.remove("fn__none");
                        if (childResult.hasMatch || childResult.hasChildMatch) {
                            // 子项也有命中
                            arrowElement.classList.add("b3-list-item__arrow--open");
                            nextUlElement.classList.remove("fn__none");
                        } else {
                            // 子项无命中，折叠所有子项
                            arrowElement.classList.remove("b3-list-item__arrow--open");
                            arrowElement.parentElement.classList.add("fn__hidden");
                            nextUlElement.classList.add("fn__none");
                        }
                    }
                } else if (childResult.hasMatch || childResult.hasChildMatch) {
                    // 当前标题未命中，但子级有命中
                    liItem.style.display = "";
                    hasChildMatch = true;

                    if (nextUlElement) {
                        nextUlElement.classList.remove("fn__none");
                        arrowElement.classList.add("b3-list-item__arrow--open");
                    }
                } else {
                    // 当前标题和子级都未命中，隐藏
                    liItem.style.display = "none";
                    if (nextUlElement) {
                        nextUlElement.classList.add("fn__none");
                    }
                }
            });
            return { hasMatch, hasChildMatch };
        };

        processUL(this.element.firstElementChild);
        return;
    }
    // 恢复折叠状态
    this.tree.setExpandIds(this.preFilterExpandIds);
    this.preFilterExpandIds = null;
}
