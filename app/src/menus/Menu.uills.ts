import { Constants } from "../constants"

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