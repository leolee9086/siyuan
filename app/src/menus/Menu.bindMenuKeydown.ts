import { Constants } from "../constants";
import { getEventName } from "../protyle/util/compatibility";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { getActionMenu } from "./Menu.getActionMenu";
import {
    getMenuElement,
    isMenuElementHidden,
    isTargetInMenu,
    isInputAbleMenuItemElement,
    isEventUpDown,
    setNotCurrent,
    setNotShow,
    getCurrentMenuItem,
    setCurrent,
    getCurrentSubMenuItem
} from "./Menu.uills";


/**
 * 处理已有当前元素时的上下箭头键导航
 * @param {Element} currentElement - 当前选中的菜单项元素
 * @param {string} eventCode - 事件代码（"↑" 或 "↓"）
 * @returns {Element|null} 下一个要选中的菜单项元素
 */
const handleUpDownNavigationWithCurrent = (currentElement: Element, eventCode: string): Element | null => {
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
const handleMenuItemSelection = (actionMenuElement: Element): void => {
    if (actionMenuElement.classList.contains("b3-menu__item")) {
        setCurrent(actionMenuElement);
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

/**
 * 处理右箭头键导航
 * @param {Element} currentElement - 当前选中的菜单项元素
 * @returns {boolean} 是否成功处理了右箭头键导航
 */
const handleRightArrowNavigation = (currentElement: Element): boolean => {
    if (!currentElement) {
        return true;
    }
    const subMenuElement = currentElement.querySelector(".b3-menu__submenu") as HTMLElement;
    if (!subMenuElement) {
        return true;
    }
    setNotCurrent(currentElement);
    currentElement.classList.add("b3-menu__item--show");

    const actionMenuElement = getActionMenu(subMenuElement.firstElementChild.firstElementChild, true);
    if (actionMenuElement) {
        setCurrent(actionMenuElement);
    }
    window.siyuan.menus.menu.showSubMenu(subMenuElement);
    return true;
};

/**
 * 处理左箭头键导航
 * @param {Element} currentElement - 当前选中的子菜单项元素
 * @returns {boolean} 是否成功处理了左箭头键导航
 */
const handleLeftArrowNavigation = (currentElement: Element): boolean => {
    if (!currentElement) {
        return true;
    }
    const parentItemElement = hasClosestByClassName(currentElement, "b3-menu__item--show");
    if (parentItemElement) {
        parentItemElement.classList.remove("b3-menu__item--show");
        setCurrent(parentItemElement);
        setNotCurrent(currentElement);
    }
    return true;
};

/**
 * 处理回车键导航
 * @param {Element} currentElement - 当前选中的菜单项元素
 * @returns {boolean} 是否成功处理了回车键导航
 */
const handleEnterKeyNavigation = (currentElement: Element): boolean => {
    if (!currentElement) {
        return false;
    }
    
    const subMenuElement = currentElement.querySelector(".b3-menu__submenu") ;
    if (subMenuElement instanceof HTMLElement) {
        setNotCurrent(currentElement);
        currentElement.classList.add("b3-menu__item--show");
        const actionMenuElement = getActionMenu(subMenuElement.firstElementChild.firstElementChild, true);
        if (actionMenuElement) {
            setCurrent(actionMenuElement);
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
    
    if (getMenuElement().contains(currentElement)) {
        // 块标上 AI 会使用新的 menu，不能移除
        window.siyuan.menus.menu.remove();
    }
    
    return true;
};

export const bindMenuKeydown = (event: KeyboardEvent) => {
    if (isMenuElementHidden()
        || event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) {
        return false;
    }
    const target = event.target;
    /**
     * eventTarget是Element类型,因为还有可能是svg之类
     */
    if(!(target instanceof Element)){
        return false
    }
    if (isTargetInMenu(target) && isInputAbleMenuItemElement(target)) {
        return false;
    }
    const eventCode = Constants.KEYCODELIST[event.keyCode];
    if (isEventUpDown(event)) {
        const menuElement = getMenuElement();
        const currentElement = getCurrentMenuItem();
        let actionMenuElement;
        if (!currentElement) {
            if (eventCode === "↑") {
                actionMenuElement = getActionMenu(menuElement.lastElementChild.lastElementChild, false);
            } else {
                actionMenuElement = getActionMenu(menuElement.lastElementChild.firstElementChild, true);
            }
        } else {
            actionMenuElement = handleUpDownNavigationWithCurrent(currentElement, eventCode);
        }
        if (actionMenuElement) {
            handleMenuItemSelection(actionMenuElement);
        }
        return true;
    } else if (eventCode === "→") {
        const currentElement = getCurrentMenuItem();
        return handleRightArrowNavigation(currentElement);
    } else if (eventCode === "←") {
        const currentElement = getCurrentSubMenuItem();
        return handleLeftArrowNavigation(currentElement);
    } else if (eventCode === "↩") {
        const currentElement = getCurrentMenuItem();
        return handleEnterKeyNavigation(currentElement);
    }
};
