import { Constants } from "../constants";
import { getEventName } from "../protyle/util/compatibility";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { getActionMenu } from "./Menu";
import { isMenuElementHidden, isTargetInMenu, isInputAbleMenuItemElement, isEventUpDown, setNotCurrent, setNotShow } from "./Menu.uills";


/**
 * 处理已有当前元素时的上下箭头键导航
 * @param {Element} currentElement - 当前选中的菜单项元素
 * @param {string} eventCode - 事件代码（"↑" 或 "↓"）
 * @returns {Element|null} 下一个要选中的菜单项元素
 */
const 处理已有当前元素的上下导航 = (currentElement: Element, eventCode: string): Element | null => {
    setNotCurrent(currentElement);
    setNotShow(currentElement)
    let actionMenuElement;
    if (eventCode === "↑") {
        actionMenuElement = getActionMenu(currentElement.previousElementSibling, false);
        if (!actionMenuElement) {
            actionMenuElement = getActionMenu(currentElement.parentElement.lastElementChild, false);
        }
    } else {
        actionMenuElement = getActionMenu(currentElement.nextElementSibling, true);
        if (!actionMenuElement) {
            actionMenuElement = getActionMenu(currentElement.parentElement.firstElementChild, true);
        }
    }
    return actionMenuElement;
};

/**
 * 处理菜单项的选中状态和滚动
 * @param {Element} actionMenuElement - 要选中的菜单项元素
 */
const 处理菜单项选中状态 = (actionMenuElement: Element): void => {
    if (actionMenuElement.classList.contains("b3-menu__item")) {
        actionMenuElement.classList.add("b3-menu__item--current");
    }
    const inputElement = actionMenuElement.querySelector(":scope > .b3-text-field") as HTMLInputElement;
    if (inputElement) {
        inputElement.focus();
    }
    actionMenuElement.classList.remove("b3-menu__item--show");
    const parentRect = actionMenuElement.parentElement.getBoundingClientRect();
    const actionMenuRect = actionMenuElement.getBoundingClientRect();
    if (parentRect.top > actionMenuRect.top || parentRect.bottom < actionMenuRect.bottom) {
        actionMenuElement.scrollIntoView(parentRect.top > actionMenuRect.top);
    }
};

export const bindMenuKeydown = (event: KeyboardEvent) => {
    if (isMenuElementHidden()
        || event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) {
        return false;
    }
    const target = event.target;
    if(!(target instanceof HTMLElement)){
        return false
    }
    if (isTargetInMenu(target) && isInputAbleMenuItemElement(target)) {
        return false;
    }
    const eventCode = Constants.KEYCODELIST[event.keyCode];

    if (isEventUpDown(event)) {
        const currentElement = window.siyuan.menus.menu.element.querySelector(".b3-menu__item--current");
        let actionMenuElement;
        if (!currentElement) {
            if (eventCode === "↑") {
                actionMenuElement = getActionMenu(window.siyuan.menus.menu.element.lastElementChild.lastElementChild, false);
            } else {
                actionMenuElement = getActionMenu(window.siyuan.menus.menu.element.lastElementChild.firstElementChild, true);
            }
        } else {
            actionMenuElement = 处理已有当前元素的上下导航(currentElement, eventCode);
        }
        if (actionMenuElement) {
            处理菜单项选中状态(actionMenuElement);
        }
        return true;
    } else if (eventCode === "→") {
        const currentElement = window.siyuan.menus.menu.element.querySelector(".b3-menu__item--current");
        if (!currentElement) {
            return true;
        }
        const subMenuElement = currentElement.querySelector(".b3-menu__submenu") as HTMLElement;
        if (!subMenuElement) {
            return true;
        }
        currentElement.classList.remove("b3-menu__item--current");
        currentElement.classList.add("b3-menu__item--show");

        const actionMenuElement = getActionMenu(subMenuElement.firstElementChild.firstElementChild, true);
        if (actionMenuElement) {
            actionMenuElement.classList.add("b3-menu__item--current");
        }
        window.siyuan.menus.menu.showSubMenu(subMenuElement);
        return true;
    } else if (eventCode === "←") {
        const currentElement = window.siyuan.menus.menu.element.querySelector(".b3-menu__submenu .b3-menu__item--current");
        if (!currentElement) {
            return true;
        }
        const parentItemElement = hasClosestByClassName(currentElement, "b3-menu__item--show");
        if (parentItemElement) {
            parentItemElement.classList.remove("b3-menu__item--show");
            parentItemElement.classList.add("b3-menu__item--current");
            currentElement.classList.remove("b3-menu__item--current");
        }
        return true;
    } else if (eventCode === "↩") {
        const currentElement = window.siyuan.menus.menu.element.querySelector(".b3-menu__item--current");
        if (!currentElement) {
            return false;
        } else {
            const subMenuElement = currentElement.querySelector(".b3-menu__submenu") as HTMLElement;
            if (subMenuElement) {
                currentElement.classList.remove("b3-menu__item--current");
                currentElement.classList.add("b3-menu__item--show");
                const actionMenuElement = getActionMenu(subMenuElement.firstElementChild.firstElementChild, true);
                if (actionMenuElement) {
                    actionMenuElement.classList.add("b3-menu__item--current");
                }
                window.siyuan.menus.menu.showSubMenu(subMenuElement);
                return true;
            }
            const textElement = currentElement.querySelector(".b3-text-field") as HTMLInputElement;
            const checkElement = currentElement.querySelector(".b3-switch") as HTMLInputElement;
            if (textElement) {
                textElement.focus();
                return true;
            } else if (checkElement) {
                checkElement.click();
            } else {
                currentElement.dispatchEvent(new CustomEvent(getEventName()));
            }
            if (window.siyuan.menus.menu.element.contains(currentElement)) {
                // 块标上 AI 会使用新的 menu，不能移除
                window.siyuan.menus.menu.remove();
            }
        }
        return true;
    }
};
