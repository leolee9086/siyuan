import { Constants } from "../constants";
import { getEventName } from "../protyle/util/compatibility";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { getActionMenu } from "./Menu";


export const bindMenuKeydown = (event: KeyboardEvent) => {
    if (window.siyuan.menus.menu.element.classList.contains("fn__none")
        || event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) {
        return false;
    }
    const target = event.target as HTMLElement;
    if (window.siyuan.menus.menu.element.contains(target) && ["INPUT", "TEXTAREA"].includes(target.tagName)) {
        return false;
    }
    const eventCode = Constants.KEYCODELIST[event.keyCode];
    if (eventCode === "↓" || eventCode === "↑") {
        const currentElement = window.siyuan.menus.menu.element.querySelector(".b3-menu__item--current");
        let actionMenuElement;
        if (!currentElement) {
            if (eventCode === "↑") {
                actionMenuElement = getActionMenu(window.siyuan.menus.menu.element.lastElementChild.lastElementChild, false);
            } else {
                actionMenuElement = getActionMenu(window.siyuan.menus.menu.element.lastElementChild.firstElementChild, true);
            }
        } else {
            currentElement.classList.remove("b3-menu__item--current", "b3-menu__item--show");
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
        }
        if (actionMenuElement) {
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
