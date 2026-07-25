/**
 * Outline 筛选功能
 */
import { isHTMLElement, isHTMLInputElement } from "../../../util/DOM/element.guard";
/** 用途：Outline 树交互领域根；使用范围：筛选状态与树展开恢复；解耦评估：替代具体 Outline class。 */
import type {OutlineDomain} from "./types";

/**
 * 应用大纲筛选
 * @同步豁免: 需要绝对同步的DOM访问 - 输入事件必须同步更新当前树 DOM。
 */
export function setFilter(outline: OutlineDomain) {
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
        const prev = item.previousElementSibling;
        const toggle = prev?.querySelector(".b3-list-item__toggle");
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
        resetFilter(outline);
        return;
    }

    // 首次筛选时记录折叠状态
    if (!outline.preFilterExpandIds) {
        outline.preFilterExpandIds = outline.tree.getExpandIds();
    }

    filterListItems(outline.element.firstElementChild, keyword);
}

/**
 * 重置筛选状态，恢复之前的折叠情况
 */
function resetFilter(outline: OutlineDomain) {
    if (outline.preFilterExpandIds) {
        outline.tree.setExpandIds(outline.preFilterExpandIds);
    }
    outline.preFilterExpandIds = null;
}

/**
 * 递归筛选列表项
 * @显式返回类型原因: 递归调用需要固定匹配结果，避免自引用推导为隐式 any。
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
 * @显式返回类型原因: 与递归筛选共享稳定的匹配结果协议。
 */
function checkListItem(liItem: HTMLElement, keyword: string): { isMatch: boolean, hasChildMatch: boolean } {
    const nextSibling = liItem.nextElementSibling;
    const nextUlElement = (isHTMLElement(nextSibling) && nextSibling.tagName === "UL") ? nextSibling : undefined;

    let childResult = { hasMatch: false, hasChildMatch: false };
    if (nextUlElement) {
        childResult = filterListItems(nextUlElement, keyword);
    }

    const arrowElement = liItem.querySelector(".b3-list-item__arrow");
    const textElement = liItem.querySelector(".b3-list-item__text");
    const textContent = (textElement?.textContent || "").trim().toLowerCase();

    // 当前标题命中
    if (textContent.includes(keyword)) {
        return handleMatch(liItem, nextUlElement, arrowElement, childResult);
    }

    // 当前标题未命中，但子级有命中
    if (childResult.hasMatch || childResult.hasChildMatch) {
        return handleChildMatch(liItem, nextUlElement, arrowElement);
    }

    // 当前标题和子级都未命中，隐藏
    liItem.style.display = "none";
    if (nextUlElement) {
        nextUlElement.classList.add("fn__none");
    }
    return { isMatch: false, hasChildMatch: false };
}

/**
 * 作用：处理当前项命中搜索关键字的逻辑。
 * 意图：显示当前项，并根据子项情况处理子列表显示。
 * 调用时机：`checkListItem` 中检测到文本包含关键字时。
 */
function handleMatch(liItem: HTMLElement, nextUlElement: Element | undefined, arrowElement: Element | null, childResult: { hasMatch: boolean, hasChildMatch: boolean }) {
    liItem.style.display = "";
    if (nextUlElement) {
        handleNextUlElementOnMatch(nextUlElement, arrowElement, childResult);
    }
    return { isMatch: true, hasChildMatch: false };
}

/**
 * 作用：处理当前项未命中但子项命中的逻辑。
 * 意图：显示当前项，并展开子列表以显示命中的子项。
 * 调用时机：`checkListItem` 中检测到子项有命中结果时。
 */
function handleChildMatch(liItem: HTMLElement, nextUlElement: Element | undefined, arrowElement: Element | null) {
    liItem.style.display = "";
    if (nextUlElement) {
        nextUlElement.classList.remove("fn__none");
        arrowElement?.classList.add("b3-list-item__arrow--open");
    }
    return { isMatch: false, hasChildMatch: true };
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

    // 子项也有命中
    if (childResult.hasMatch || childResult.hasChildMatch) {
        arrowElement?.classList.add("b3-list-item__arrow--open");
        nextUlElement.classList.remove("fn__none");
        return;
    }

    // 子项无命中，折叠所有子项
    arrowElement?.classList.remove("b3-list-item__arrow--open");
    arrowElement?.parentElement?.classList.add("fn__hidden");
    nextUlElement.classList.add("fn__none");
}
