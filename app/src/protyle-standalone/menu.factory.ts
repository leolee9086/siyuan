/** 用途：约束独立入口只实现 Protyle 所需菜单能力；使用范围：独立 DOM 菜单；解耦评估：这是宿主能力接口，具体实现可替换。 */
import type {IProtyleMenuPort} from "../protyle/runtime/menu.types";
import {isHiddenProtyleMenuElement} from "../protyle/runtime/menu.visibility";

/** 创建外部页面缺省的菜单 DOM 骨架。 */
const createMenuElement = () => {
    const element = document.createElement("div");
    element.id = "commonMenu";
    element.className = "b3-menu fn__none";
    element.innerHTML = '<div class="b3-menu__title fn__none"><span class="b3-menu__label"></span></div><div class="b3-menu__items"></div>';
    document.body.append(element);
    return element;
};

/** 返回菜单项容器，并在模板异常时给出明确错误。 */
const getItemsElement = (menuElement: HTMLElement) => {
    const element = menuElement.querySelector(".b3-menu__items");
    if (!(element instanceof HTMLElement)) {
        throw new Error("Missing .b3-menu__items in Protyle menu host");
    }
    return element;
};

/** 将菜单项按调用顺序或指定分隔符位置插入。 */
const appendMenuItem = (element: HTMLElement, menuItem?: HTMLElement, index?: number) => {
    if (!menuItem || isHiddenProtyleMenuElement(menuItem)) {
        return;
    }
    const container = getItemsElement(element);
    // 未提供分隔符索引时按调用顺序追加，这是绝大多数 Protyle 菜单的构建方式。
    if (typeof index !== "number") {
        container.append(menuItem);
        return;
    }
    const separators = container.querySelectorAll(":scope > .b3-menu__separator");
    const separator = separators[index];
    if (!separator) {
        container.append(menuItem);
        return;
    }
    separator.before(menuItem);
};

/** 清理菜单会话和内容，并恢复隐藏状态。 */
const removeMenu = (menu: IProtyleMenuPort) => {
    const removeCB = menu.removeCB;
    menu.removeCB = undefined;
    removeCB?.();
    menu.data = undefined;
    getItemsElement(menu.element).innerHTML = "";
    menu.element.classList.add("fn__none");
    menu.element.classList.remove("b3-menu--fullscreen");
    menu.element.removeAttribute("style");
};

/** 在指定视口坐标显示菜单，并将结果限制在可见区域内。 */
const popupMenu = (element: HTMLElement, position: IPosition) => {
    if (!getItemsElement(element).firstElementChild) {
        return;
    }
    element.classList.remove("fn__none");
    element.style.position = "fixed";
    element.style.zIndex = (++window.siyuan.zIndex).toString();
    element.style.left = `${position.x}px`;
    element.style.top = `${position.y}px`;
    const rect = element.getBoundingClientRect();
    element.style.left = `${Math.max(0, Math.min(position.x, window.innerWidth - rect.width))}px`;
    element.style.top = `${Math.max(0, Math.min(position.y, window.innerHeight - rect.height))}px`;
};

/** 使用全屏菜单布局，供窄屏交互路径调用。 */
const fullscreenMenu = (element: HTMLElement) => {
    element.classList.remove("fn__none");
    element.classList.add("b3-menu--fullscreen");
    element.style.zIndex = (++window.siyuan.zIndex).toString();
};

/** 将子菜单定位到父菜单项右侧，并确保其可见。 */
const positionSubMenu = (subMenuElement: HTMLElement) => {
    const parent = subMenuElement.parentElement;
    if (!parent) {
        return;
    }
    const parentRect = parent.getBoundingClientRect();
    subMenuElement.classList.add("b3-menu__submenu--open");
    subMenuElement.style.position = "fixed";
    subMenuElement.style.left = `${Math.min(parentRect.right, window.innerWidth - subMenuElement.offsetWidth)}px`;
    subMenuElement.style.top = `${Math.min(parentRect.top, window.innerHeight - subMenuElement.offsetHeight)}px`;
};

/** 创建不依赖思源主应用 Menu 类的 DOM 菜单能力对象。 */
/** @同步豁免: UI构建 */
// Protyle 构造器要求菜单容器在同步绑定交互事件前已经存在。
export const createStandaloneProtyleMenu = () => {
    const existing = document.getElementById("commonMenu");
    const element = existing || createMenuElement();
    const menu: IProtyleMenuPort = {
        element,
        /** 将既有 Protyle 菜单项插入菜单内容区。 */
        append(menuItem?: HTMLElement, index?: number) {
            appendMenuItem(element, menuItem, index);
        },
        /** 清理菜单会话和内容，并恢复隐藏状态。 */
        remove() {
            removeMenu(menu);
        },
        /** 在指定视口坐标显示菜单，并将结果限制在可见区域内。 */
        popup(position: IPosition) {
            popupMenu(element, position);
        },
        /** 使用全屏菜单布局，供窄屏交互路径调用。 */
        fullscreen() {
            fullscreenMenu(element);
        },
        /** 将子菜单定位到父菜单项右侧，并确保其可见。 */
        showSubMenu(subMenuElement: HTMLElement) {
            positionSubMenu(subMenuElement);
        },
    };
    return menu;
};
