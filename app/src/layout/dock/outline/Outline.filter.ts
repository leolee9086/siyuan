/**
 * Outline 筛选和层级展开/折叠功能
 * 从 Outline.ts 拆分出来以保持单文件行数限制
 */
import { MenuItem } from "../../../menus/Menu.Item";
import { Constants } from "../../../constants";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanGlobalMenusMenu } from "../../../util/siyuanEnvironments/getMenu.environment";
import { isHTMLElement, isHTMLInputElement } from "../../../util/DOM/element.guard";
import type { Outline } from "./Outline";

const HEADING_LABELS = [
    siyuanI18n.heading1,
    siyuanI18n.heading2,
    siyuanI18n.heading3,
    siyuanI18n.heading4,
    siyuanI18n.heading5,
    siyuanI18n.heading6,
];



/**
 * 展开到指定标题级别
 * @param targetLevel 目标标题级别，1-6级（H1-H6），6级表示全部展开
 * @同步豁免: DOM访问
 */
export function expandToLevel(outline: Outline, targetLevel: number) {
    if (targetLevel >= 6) {
        // 全部展开
        outline.tree.expandAll();
        outline.saveExpendIds();
        return;
    }

    // 展开到指定标题级别
    const items = outline.element.querySelectorAll("li.b3-list-item");
    for (const item of items) {
        if (!isHTMLElement(item)) {
            continue;
        }
        const headingLevel = parseInt(item.getAttribute("data-subtype")?.replace("h", "") || "0", 10);
        const arrowElement = item.querySelector(".b3-list-item__arrow");

        if (!item.nextElementSibling || item.nextElementSibling.tagName !== "UL" || !arrowElement) {
            continue;
        }

        if (headingLevel > 0 && headingLevel < targetLevel) {
            // 当前标题级别大于目标级别，展开
            arrowElement.classList.add("b3-list-item__arrow--open");
            item.nextElementSibling.classList.remove("fn__none");
        }

        if (headingLevel >= targetLevel) {
            // 当前标题级别小于等于目标级别，折叠
            arrowElement.classList.remove("b3-list-item__arrow--open");
            item.nextElementSibling.classList.add("fn__none");
        }
    }
    outline.saveExpendIds();
}

/**
 * 显示展开层级菜单
 * @同步豁免: UI构建
 */
export function showExpandLevelMenu(outline: Outline, target: HTMLElement) {
    const menu = getSiyuanGlobalMenusMenu();
    menu.remove();
    menu.element.setAttribute("data-name", Constants.MENU_OUTLINE_EXPAND_LEVEL);
    for (let i = 1; i <= 6; i++) {
        menu.append(new MenuItem({
            id: `heading${i}`,
            icon: `iconH${i}`,
            label: HEADING_LABELS[i - 1] || "",
            /**
             * 作用：响应菜单项点击，展开到对应的标题层级。
             * 意图：通过菜单操作快速调整大纲的展开深度。
             * 调用时机：用户点击“展开到...”菜单下的具体标题级别时。
             */
            click: () => expandToLevel(outline, i)
        }).element);
    }
    const rect = target.getBoundingClientRect();
    menu.popup({
        x: rect.left,
        y: rect.bottom,
        h: rect.height
    });
}

/**
 * 切换同层级的所有标题的展开/折叠状态（基于标题级别而不是DOM层级）
 * @同步豁免: DOM访问
 */
export function collapseSameLevel(outline: Outline, element: HTMLElement, expand?: boolean) {
    // 获取所有相同标题级别的元素
    let isExpand = expand;
    if (typeof isExpand === "undefined") {
        isExpand = true;
        const currentArrow = element.querySelector(".b3-list-item__arrow");
        if (currentArrow) {
            isExpand = !currentArrow.classList.contains("b3-list-item__arrow--open");
        }
    }

    const items = outline.element.querySelectorAll(`li.b3-list-item[data-subtype="${element.getAttribute("data-subtype")}"]`);
    for (const item of items) {
        if (!isHTMLElement(item)) {
            continue;
        }
        const arrowElement = item.querySelector(".b3-list-item__arrow");
        if (!arrowElement) {
            continue;
        }

        if (isExpand) {
            handleExpandItem(item, arrowElement);
            continue;
        }
        handleCollapseItem(item, arrowElement);
    }
    outline.saveExpendIds();
}

/**
 * 作用：处理列表项的展开逻辑。
 * 意图：展开当前项并向上展开所有父级列表，确保路径可见。
 * 调用时机：`collapseSameLevel` 中需要展开时调用。
 */
function handleExpandItem(item: HTMLElement, arrowElement: Element) {
    const nextSibling = item.nextElementSibling;
    /**
     * 作用：确保下一个兄弟元素是 UL 列表。
     * 意图：仅当存在子列表时才进行展开操作，移除隐藏类并更新箭头状态。
     */
    if (isHTMLElement(nextSibling) && nextSibling.tagName === "UL") {
        nextSibling.classList.remove("fn__none");
        arrowElement.classList.add("b3-list-item__arrow--open");
    }
    let ulElement = item.parentElement;
    while (ulElement && !ulElement.classList.contains("b3-list") && ulElement.tagName === "UL") {
        ulElement.classList.remove("fn__none");
        const prevSibling = ulElement.previousElementSibling;
        if (prevSibling) {
            prevSibling.querySelector(".b3-list-item__arrow")?.classList.add("b3-list-item__arrow--open");
        }
        ulElement = ulElement.parentElement;
    }
}

/**
 * 作用：处理列表项的折叠逻辑。
 * 意图：仅折叠当前项。
 * 调用时机：`collapseSameLevel` 中需要折叠时调用。
 */
function handleCollapseItem(item: HTMLElement, arrowElement: Element) {
    const nextSibling = item.nextElementSibling;
    /**
     * 作用：确保下一个兄弟元素是 UL 列表。
     * 意图：仅当存在子列表时才进行折叠操作，添加隐藏类并更新箭头状态。
     */
    if (isHTMLElement(nextSibling) && nextSibling.tagName === "UL") {
        nextSibling.classList.add("fn__none");
        arrowElement.classList.remove("b3-list-item__arrow--open");
    }
}

/**
 * 展开/折叠子项
 * @同步豁免: DOM访问
 */
export function collapseChildren(outline: Outline, element: HTMLElement, expand?: boolean) {
    const nextElement = element.nextElementSibling;
    if (!nextElement || nextElement.tagName !== "UL") {
        return;
    }
    const arrowElement = element.querySelector(".b3-list-item__arrow");
    if (!arrowElement) {
        return;
    }
    let isExpand = expand;
    if (typeof isExpand === "undefined") {
        isExpand = !arrowElement.classList.contains("b3-list-item__arrow--open");
    }
    if (isExpand) {
        arrowElement.classList.add("b3-list-item__arrow--open");
        nextElement.classList.remove("fn__none");
        const inputItems = nextElement.querySelectorAll("ul");
        for (const item of inputItems) {
            if (!isHTMLElement(item)) {
                continue;
            }
            const prevSibling = item.previousElementSibling;
            if (prevSibling) {
                prevSibling.querySelector(".b3-list-item__arrow")?.classList.add("b3-list-item__arrow--open");
            }
            item.classList.remove("fn__none");
        }
        outline.saveExpendIds();
        return;
    }
    arrowElement.classList.remove("b3-list-item__arrow--open");
    nextElement.classList.add("fn__none");
    outline.saveExpendIds();
}

/**
 * 应用大纲筛选
 * @同步豁免: DOM访问
 */
export function setFilter(outline: Outline) {
    // 还原 display
    const hiddenItems = outline.element.querySelectorAll('li.b3-list-item[style$="display: none;"]');
    for (const item of hiddenItems) {
        /**
         * 作用：确保 item 是 HTMLElement。
         * 意图：item 来自 querySelectorAll，可能是 Element，需要确认为 HTMLElement 才能访问 style 属性。
         */
        if (isHTMLElement(item)) {
            item.style.display = "";
        }
    }
    const hiddenUls = outline.element.querySelectorAll("ul.fn__none");
    for (const item of hiddenUls) {
        if (!isHTMLElement(item)) {
            continue;
        }
        const toggle = item.previousElementSibling?.querySelector(".b3-list-item__toggle");
        if (toggle) {
            toggle.classList.remove("fn__hidden");
        }
    }
    const searchInput = outline.headerElement.querySelector("input.b3-text-field.search__label");
    if (!isHTMLInputElement(searchInput)) {
        return;
    }
    const keyword = searchInput.value.toLowerCase();

    if (!keyword) {
        // 恢复折叠状态
        if (outline.preFilterExpandIds) {
            outline.tree.setExpandIds(outline.preFilterExpandIds);
        }
        outline.preFilterExpandIds = null;
        return;
    }

    // 首次筛选时记录折叠状态
    if (!outline.preFilterExpandIds) {
        outline.preFilterExpandIds = outline.tree.getExpandIds();
    }

    filterListItems(outline.element.firstElementChild, keyword);
}

/**
 * 递归筛选列表项
 */
function filterListItems(ul: Element | null, keyword: string): { hasMatch: boolean, hasChildMatch: boolean } {
    if (!ul) {
        return { hasMatch: false, hasChildMatch: false };
    }

    let hasMatch = false;
    let hasChildMatch = false;
    const children = ul.querySelectorAll(":scope > li.b3-list-item");

    for (const liItem of children) {
        if (!isHTMLElement(liItem)) {
            continue;
        }
        const result = checkListItem(liItem, keyword);
        if (result.isMatch) {
            hasMatch = true;
        }
        if (result.hasChildMatch) {
            hasChildMatch = true;
        }
    }
    return { hasMatch, hasChildMatch };
}

/**
 * 检查单个列表项是否匹配
 */
function checkListItem(liItem: HTMLElement, keyword: string): { isMatch: boolean, hasChildMatch: boolean } {
    const nextSibling = liItem.nextElementSibling;
    const nextUlElement = (isHTMLElement(nextSibling) && nextSibling.tagName === "UL") ? nextSibling : undefined;

    let childResult = { hasMatch: false, hasChildMatch: false };
    if (nextUlElement) {
        childResult = filterListItems(nextUlElement, keyword);
    }

    const arrowElement = liItem.querySelector(".b3-list-item__arrow");
    const textContent = (liItem.querySelector(".b3-list-item__text")?.textContent || "").trim().toLowerCase();

    if (textContent.includes(keyword)) {
        // 当前标题命中
        liItem.style.display = "";
        if (nextUlElement) {
            handleNextUlElementOnMatch(nextUlElement, arrowElement, childResult);
        }
        return { isMatch: true, hasChildMatch: false };
    }

    if (childResult.hasMatch || childResult.hasChildMatch) {
        // 当前标题未命中，但子级有命中
        liItem.style.display = "";

        if (nextUlElement) {
            nextUlElement.classList.remove("fn__none");
            arrowElement?.classList.add("b3-list-item__arrow--open");
        }
        return { isMatch: false, hasChildMatch: true };
    }

    // 当前标题和子级都未命中，隐藏
    liItem.style.display = "none";
    if (nextUlElement) {
        nextUlElement.classList.add("fn__none");
    }
    return { isMatch: false, hasChildMatch: false };
}

/**
 * 作用：处理搜索命中时的子列表显示逻辑。
 * 意图：当当前项命中搜索关键字时，根据子项是否有命中来决定是否展开子列表。
 * 调用时机：`checkListItem` 中当前项命中且存在子列表时调用。
 * @param nextUlElement 子列表 UL 元素
 * @param arrowElement 箭头图标元素
 * @param childResult 子项的筛选结果
 */
function handleNextUlElementOnMatch(nextUlElement: Element, arrowElement: Element | null, childResult: { hasMatch: boolean, hasChildMatch: boolean }) {
    nextUlElement.classList.remove("fn__none");

    if (childResult.hasMatch || childResult.hasChildMatch) {
        // 子项也有命中
        arrowElement?.classList.add("b3-list-item__arrow--open");
        nextUlElement.classList.remove("fn__none");
        return;
    }

    // 子项无命中，折叠所有子项
    arrowElement?.classList.remove("b3-list-item__arrow--open");
    arrowElement?.parentElement?.classList.add("fn__hidden");
    nextUlElement.classList.add("fn__none");
}
