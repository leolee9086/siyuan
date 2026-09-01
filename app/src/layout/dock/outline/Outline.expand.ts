/**
 * Outline 层级展开/折叠功能
 */
import { MenuItem } from "../../../menus/Menu.Item";
import { Constants } from "../../../constants";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanGlobalMenusMenu } from "../../../util/siyuanEnvironments/getMenu.environment";
import { isHTMLElement } from "../../../util/DOM/element.guard";
import { setStorageVal } from "../../../protyle/util/compatibility";
/** 用途：Outline 树交互领域根；使用范围：展开、折叠和持久化；解耦评估：替代具体 Outline class。 */
import type {OutlineDomain} from "./types";

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
export function expandToLevel(outline: OutlineDomain, targetLevel: number) {
    /**
     * 作用：处理“全部展开”的情况。
     * 意图：当目标级别 >= 6 时，视为展开全部节点。
     */
    if (targetLevel >= 6) {
        // 全部展开
        outline.tree.expandAll();
        outline.saveExpendIds();
        window.siyuan.storage[Constants.LOCAL_OUTLINE].expandLevel = targetLevel;
        setStorageVal(Constants.LOCAL_OUTLINE, window.siyuan.storage[Constants.LOCAL_OUTLINE]);
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

        // 当前标题级别大于目标级别，展开
        if (headingLevel > 0 && headingLevel < targetLevel) {
            arrowElement.classList.add("b3-list-item__arrow--open");
            item.nextElementSibling.classList.remove("fn__none");
        }

        // 当前标题级别小于等于目标级别，折叠
        if (headingLevel >= targetLevel) {
            arrowElement.classList.remove("b3-list-item__arrow--open");
            item.nextElementSibling.classList.add("fn__none");
        }
    }
    outline.saveExpendIds();
    window.siyuan.storage[Constants.LOCAL_OUTLINE].expandLevel = targetLevel;
    setStorageVal(Constants.LOCAL_OUTLINE, window.siyuan.storage[Constants.LOCAL_OUTLINE]);
}

/**
 * 显示展开层级菜单
 * @同步豁免: UI构建
 */
export function showExpandLevelMenu(outline: OutlineDomain, target: HTMLElement) {
    const menu = getSiyuanGlobalMenusMenu();
    menu.remove();
    menu.element.setAttribute("data-name", Constants.MENU_OUTLINE_EXPAND_LEVEL);
    for (let i = 1; i <= 6; i++) {
        menu.append(new MenuItem({
            id: `heading${i}`,
            icon: `iconH${i}`,
            label: HEADING_LABELS[i - 1] || "",
            current: window.siyuan.storage[Constants.LOCAL_OUTLINE].expandLevel === i,
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
export function collapseSameLevel(outline: OutlineDomain, element: HTMLElement, expand?: boolean) {
    // 获取所有相同标题级别的元素
    let isExpand = expand;
    if (typeof isExpand === "undefined") {
        const currentArrow = element.querySelector(".b3-list-item__arrow");
        isExpand = currentArrow ? !currentArrow.classList.contains("b3-list-item__arrow--open") : true;
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
            const arrow = prevSibling.querySelector(".b3-list-item__arrow");
            arrow?.classList.add("b3-list-item__arrow--open");
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
export function collapseChildren(outline: OutlineDomain, element: HTMLElement, expand?: boolean) {
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
                const arrow = prevSibling.querySelector(".b3-list-item__arrow");
                arrow?.classList.add("b3-list-item__arrow--open");
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
