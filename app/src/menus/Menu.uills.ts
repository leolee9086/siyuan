import { Constants } from "../constants";
import { getTopBarHeight } from "../layout/getTopBarHeight";
import { updateHotkeyTip } from "../protyle/util/compatibility";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { isMobile } from "../util/platform/functions";

/**
 * 获取全局菜单的 DOM 元素
 * @returns {HTMLElement} 菜单的 DOM 元素
 */
export const getMenuElement = () => {
    return window.siyuan.menus.menu.element;
};

/**
 * 检查菜单元素是否处于隐藏状态
 * @returns {boolean} 如果菜单被隐藏返回 true，否则返回 false
 */
export const isMenuElementHidden = () => {
    return getMenuElement().classList.contains("fn__none");
};

/**
 * 检查目标元素是否在菜单内部
 * @param {Element} target - 要检查的目标元素
 * @returns {boolean} 如果目标元素在菜单内部返回 true，否则返回 false
 */
export const isTargetInMenu = (target: Element): boolean => {
    return getMenuElement().contains(target);
};

/**
 * 检查元素是否是可输入的菜单项元素（输入框或文本区域）
 * @param {Element} element - 要检查的元素
 * @returns {boolean} 如果元素是可输入的菜单项返回 true，否则返回 false
 */
export const isInputAbleMenuItemElement = (element: Element): boolean => {
    return ["INPUT", "TEXTAREA"].includes(element.tagName);
};

/**
 * 检查键盘事件是否是上下箭头键
 * @param {KeyboardEvent} event - 键盘事件
 * @returns {boolean} 如果是上下箭头键返回 true，否则返回 false
 */
export const isEventUpDown = (event: KeyboardEvent): boolean => {
    const eventCode = Constants.KEYCODELIST[event.keyCode];
    return eventCode === "↓" || eventCode === "↑";
};

/**
 * 移除元素的当前选中状态
 * @param {Element} element - 要移除当前选中状态的元素
 */
export const setNotCurrent = (element: Element): void => {
    element.classList.remove("b3-menu__item--current");
};

/**
 * 移除元素的显示状态
 * @param {Element} element - 要移除显示状态的元素
 */
export const setNotShow = (element: Element): void => {
    element.classList.remove("b3-menu__item--show");
};

/**
 * 获取当前选中的菜单项元素
 * @returns {Element|null} 当前选中的菜单项元素，如果没有则返回 null
 */
export const getCurrentMenuItem = (): Element | null => {
    return getMenuElement().querySelector(".b3-menu__item--current");
};

/**
 * 设置元素的当前选中状态
 * @param {Element} element - 要设置为当前选中状态的元素
 */
export const setCurrent = (element: Element): void => {
    element.classList.add("b3-menu__item--current");
};

/**
 * 获取子菜单中的当前选中元素
 * @returns {Element|null} 子菜单中的当前选中元素，如果没有则返回 null
 */
export const getCurrentSubMenuItem = (): Element | null => {
    return getMenuElement().querySelector(".b3-menu__submenu .b3-menu__item--current");
};

/**
 * Reset menu element state, clear all styles and attributes
 * @param {HTMLElement} menuElement - Menu element to reset
 */
export const resetMenuState = (menuElement: HTMLElement): void => {
    menuElement.firstElementChild?.classList.add("fn__none");
    if (menuElement.lastElementChild) {
        menuElement.lastElementChild.innerHTML = "";
        menuElement.lastElementChild.removeAttribute("style");  // Remove style for input box focus boxShadow display issue
    }
    menuElement.classList.add("fn__none");
    menuElement.classList.remove("b3-menu--list", "b3-menu--fullscreen");
    menuElement.removeAttribute("style");  // zIndex
    menuElement.removeAttribute("data-name");    // Flag for not disappearing on click again
    menuElement.removeAttribute("data-from");    // Flag for whether opened in floating window
};

const positionActionAnchoredSubMenu = (subMenuElement: HTMLElement, subMenuRect: DOMRect): boolean => {
    const menuElement = subMenuElement.closest(".b3-menu");
    if (subMenuElement.dataset.anchor !== "action" || menuElement?.classList.contains("b3-menu--fullscreen")) {
        return false;
    }
    const actionElement = subMenuElement.parentElement.querySelector(":scope > .b3-menu__action");
    if (!(actionElement instanceof HTMLElement)) {
        return false;
    }
    const actionRect = actionElement.getBoundingClientRect();
    if (actionRect.right + subMenuRect.width <= window.innerWidth) {
        subMenuElement.style.left = `${actionRect.right}px`;
        subMenuElement.style.top = `${Math.max(getTopBarHeight(), Math.min(actionRect.top - 9, window.innerHeight - subMenuRect.height - 1))}px`;
        return true;
    }
    subMenuElement.style.left = `${Math.max(0, Math.min(actionRect.right - subMenuRect.width, window.innerWidth - subMenuRect.width))}px`;
    const below = actionRect.bottom;
    subMenuElement.style.top = `${below + subMenuRect.height <= window.innerHeight ? below : Math.max(getTopBarHeight(), actionRect.top - subMenuRect.height)}px`;
    return true;
};

/**
 * Position submenu to ensure it's visible within viewport
 * @param {HTMLElement} subMenuElement - Submenu element to position
 */
export const positionSubMenu = (subMenuElement: HTMLElement | null): void => {
    if (!subMenuElement) {
        return;
    }
    const itemsMenuElement = subMenuElement.lastElementChild as HTMLElement;
    if (itemsMenuElement) {
        itemsMenuElement.style.maxHeight = "";
    }
    const itemRect = subMenuElement.parentElement.getBoundingClientRect();
    const subMenuRect = subMenuElement.getBoundingClientRect();

    if (positionActionAnchoredSubMenu(subMenuElement, subMenuRect)) {
        return;
    }

    // 垂直方向位置调整
    // 减 9px 是为了尽量对齐菜单选项（b3-menu__submenu 的默认 padding-top 加上子菜单首个 b3-menu__item 的默认 margin-top）
    // 减 1px 是为了避免在特定情况下渲染出不应存在的滚动条而做的兼容处理
    const top = Math.min(itemRect.top - 9, window.innerHeight - subMenuRect.height - 1);
    subMenuElement.style.top = Math.max(getTopBarHeight(), top) + "px";

    // 水平方向位置调整
    // 多级菜单继承上一级子菜单的方向
    let isParentDirectionLeft = false;
    const parentSubMenuElement = hasClosestByClassName(subMenuElement.parentElement.parentElement, "b3-menu__item") as HTMLElement;
    if (parentSubMenuElement && itemRect.left < parentSubMenuElement.getBoundingClientRect().left) {
        isParentDirectionLeft = true;
    }

    // 8px 是 b3-menu__items 的默认 padding-right
    const spaceRight = window.innerWidth - itemRect.right - 8;
    const spaceLeft = itemRect.left - 8;
    if (isParentDirectionLeft) {
        if (spaceLeft >= subMenuRect.width) {
            subMenuElement.style.left = (itemRect.left - 8 - subMenuRect.width) + "px";
        } else if (spaceRight >= subMenuRect.width) {
            subMenuElement.style.left = (itemRect.right + 8) + "px";
        } else {
            subMenuElement.style.left = Math.max(0, window.innerWidth - subMenuRect.width) + "px";
        }
    } else if (spaceRight >= subMenuRect.width) {
        subMenuElement.style.left = (itemRect.right + 8) + "px";
    } else if (spaceLeft >= subMenuRect.width) {
        subMenuElement.style.left = (itemRect.left - 8 - subMenuRect.width) + "px";
    } else {
        subMenuElement.style.left = Math.max(0, window.innerWidth - subMenuRect.width) + "px";
    }

    updateMaxHeight(subMenuElement, itemsMenuElement);
};

/**
 * Update max height of menu items to prevent overflow
 * @param {HTMLElement} menuElement - Menu element
 * @param {HTMLElement} itemsMenuElement - Items container element
 */
export const updateMaxHeight = (menuElement: HTMLElement, itemsMenuElement: HTMLElement): void => {
    if (!menuElement || !itemsMenuElement) {
        return;
    }
    const menuRect = menuElement.getBoundingClientRect();
    const itemsMenuRect = itemsMenuElement.getBoundingClientRect();
    // 加 1px 是为了避免在特定情况下渲染出不应存在的滚动条而做的兼容处理
    const availableHeight = (window.innerHeight - menuRect.top) - (menuRect.height - itemsMenuRect.height) + 1;
    itemsMenuElement.style.maxHeight = Math.max(availableHeight, 0) + "px";
};

/**
 * Generate HTML for menu item based on options
 * @param {IMenu} options - Menu item options
 * @returns {string} Generated HTML string
 */
export const generateMenuItemHTML = (options: IMenu): string => {
    let html = `<span class="b3-menu__label">${options.label || "&nbsp;"}</span>`;
    if (typeof options.iconHTML === "string") {
        html = options.iconHTML + html;
    } else {
        html = `<svg class="b3-menu__icon ${options.iconClass || ""}" style="${options.icon === "iconClose" ? "height:10px;" : ""}"><use xlink:href="#${options.icon || ""}"></use></svg>${html}`;
    }
    if (options.accelerator) {
        html += `<span class="b3-menu__accelerator b3-menu__accelerator--hotkey">${updateHotkeyTip(options.accelerator)}</span>`;
    }
    if (options.action) {
        html += `<svg class="b3-menu__action${options.action === "iconCloseRound" ? " b3-menu__action--close" : ""}"><use xlink:href="#${options.action}"></use></svg>`;
    }
    if (options.checked) {
        html += '<svg class="b3-menu__checked"><use xlink:href="#iconSelect"></use></svg></span>';
    }
    return html;
};

/**
 * Handle menu event interactions
 * @param {HTMLElement} menuElement - Menu element
 * @param {PointerEvent|MouseEvent} event - Event object
 * @param {() => void} removeCallback - Callback to remove menu
 */
export const handleMenuEvent = (
    menuElement: HTMLElement,
    event: PointerEvent | MouseEvent,
    removeCallback: () => void,
    isMobileHost: () => boolean = isMobile,
): void => {
    const target = event.target as Element;
    if (isMobileHost()) {
        const titleElement = hasClosestByClassName(target, "b3-menu__title");
        if (titleElement || (typeof event.detail === "string" && event.detail === "back")) {
            const lastShowElements = menuElement.querySelectorAll(".b3-menu__item--show");
            if (lastShowElements.length > 0) {
                lastShowElements[lastShowElements.length - 1].classList.remove("b3-menu__item--show");
            } else {
                menuElement.style.transform = "";
                setTimeout(() => {
                    removeCallback();
                }, Constants.TIMEOUT_DBLCLICK);
            }
            return;
        }
    }

    const itemElement = hasClosestByClassName(target, "b3-menu__item");
    if (!itemElement) {
        return;
    }
    if (itemElement.classList.contains("b3-menu__item--readonly")) {
        return;
    }
    const subMenuElement = itemElement.querySelector(":scope > .b3-menu__submenu") as HTMLElement;
    if (subMenuElement?.contains(target)) {
        return;
    }
    const isSubMenuShown = itemElement.classList.contains("b3-menu__item--show");
    menuElement.querySelectorAll(".b3-menu__item--show").forEach((item) => {
        if (!item.contains(itemElement) && item !== itemElement && !itemElement.contains(item)) {
            item.classList.remove("b3-menu__item--show");
        }
    });
    menuElement.querySelectorAll(".b3-menu__item--current").forEach((item) => {
        item.classList.remove("b3-menu__item--current");
    });
    itemElement.classList.add("b3-menu__item--current");
    if (!subMenuElement) {
        return;
    }
    itemElement.classList.add("b3-menu__item--show");
    if (!isSubMenuShown && !menuElement.classList.contains("b3-menu--fullscreen")) {
        positionSubMenu(subMenuElement);
    }
};

/**
 * Prevent default behavior for keyboard events outside menu
 * @param {KeyboardEvent} event - Keyboard event
 */
export const preventMenuDefault = (event: KeyboardEvent): void => {
    if (!hasClosestByClassName(event.target as Element, "b3-menu") &&
        !hasClosestByClassName(event.target as Element, "tooltip") &&
        // 移动端底部键盘菜单
        !hasClosestByClassName(event.target as Element, "keyboard__bar")) {
        event.preventDefault();
    }
};
