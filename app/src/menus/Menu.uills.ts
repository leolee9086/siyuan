import { Constants } from "../constants"
import { updateHotkeyTip } from "../protyle/util/compatibility"

/**
 * 获取全局菜单的 DOM 元素
 * @returns {HTMLElement} 菜单的 DOM 元素
 */
export const getMenuElement = ()=>{
    return window.siyuan.menus.menu.element
}

/**
 * 检查菜单元素是否处于隐藏状态
 * @returns {boolean} 如果菜单被隐藏返回 true，否则返回 false
 */
export const isMenuElementHidden = ()=>{
    return getMenuElement().classList.contains("fn__none")
}

/**
 * 检查目标元素是否在菜单内部
 * @param {Element} target - 要检查的目标元素
 * @returns {boolean} 如果目标元素在菜单内部返回 true，否则返回 false
 */
export const isTargetInMenu = (target: Element): boolean => {
    return getMenuElement().contains(target)
}

/**
 * 检查元素是否是可输入的菜单项元素（输入框或文本区域）
 * @param {Element} element - 要检查的元素
 * @returns {boolean} 如果元素是可输入的菜单项返回 true，否则返回 false
 */
export const isInputAbleMenuItemElement = (element: Element): boolean => {
    return ["INPUT", "TEXTAREA"].includes(element.tagName)
}

/**
 * 检查键盘事件是否是上下箭头键
 * @param {KeyboardEvent} event - 键盘事件
 * @returns {boolean} 如果是上下箭头键返回 true，否则返回 false
 */
export const isEventUpDown = (event: KeyboardEvent): boolean => {
    const eventCode = Constants.KEYCODELIST[event.keyCode];
    return eventCode === "↓" || eventCode === "↑";
}

/**
 * 移除元素的当前选中状态
 * @param {Element} element - 要移除当前选中状态的元素
 */
export const setNotCurrent = (element: Element): void => {
    element.classList.remove("b3-menu__item--current");
}

/**
 * 移除元素的显示状态
 * @param {Element} element - 要移除显示状态的元素
 */
export const setNotShow = (element: Element): void => {
    element.classList.remove("b3-menu__item--show");
}

/**
 * 获取当前选中的菜单项元素
 * @returns {Element|null} 当前选中的菜单项元素，如果没有则返回 null
 */
export const getCurrentMenuItem = (): Element | null => {
    return getMenuElement().querySelector(".b3-menu__item--current");
}

/**
 * 设置元素的当前选中状态
 * @param {Element} element - 要设置为当前选中状态的元素
 */
export const setCurrent = (element: Element): void => {
    element.classList.add("b3-menu__item--current");
}

/**
 * 获取子菜单中的当前选中元素
 * @returns {Element|null} 子菜单中的当前选中元素，如果没有则返回 null
 */
export const getCurrentSubMenuItem = (): Element | null => {
    return getMenuElement().querySelector(".b3-menu__submenu .b3-menu__item--current");
}

/**
 * Reset menu element state, clear all styles and attributes
 * @param {HTMLElement} menuElement - Menu element to reset
 */
export const resetMenuState = (menuElement: HTMLElement): void => {
    menuElement.firstElementChild.classList.add("fn__none");
    menuElement.lastElementChild.innerHTML = "";
    menuElement.lastElementChild.removeAttribute("style");  // Remove style for input box focus boxShadow display issue
    menuElement.classList.add("fn__none");
    menuElement.classList.remove("b3-menu--list", "b3-menu--fullscreen");
    menuElement.removeAttribute("style");  // zIndex
    menuElement.removeAttribute("data-name");    // Flag for not disappearing on click again
    menuElement.removeAttribute("data-from");    // Flag for whether opened in floating window
}

/**
 * Position submenu to ensure it's visible within viewport
 * @param {HTMLElement} subMenuElement - Submenu element to position
 */
export const positionSubMenu = (subMenuElement: HTMLElement): void => {
    const itemRect = subMenuElement.parentElement.getBoundingClientRect();
    subMenuElement.style.top = (itemRect.top - 8) + "px";
    subMenuElement.style.left = (itemRect.right + 8) + "px";
    subMenuElement.style.bottom = "auto";
    const rect = subMenuElement.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        if (itemRect.left - 8 > rect.width) {
            subMenuElement.style.left = (itemRect.left - 8 - rect.width) + "px";
        } else {
            subMenuElement.style.left = (window.innerWidth - rect.width) + "px";
        }
    }
    if (rect.bottom > window.innerHeight) {
        subMenuElement.style.top = "auto";
        subMenuElement.style.bottom = "8px";
    }
}

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
}