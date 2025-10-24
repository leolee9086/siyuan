import {updateHotkeyTip} from "../protyle/util/compatibility";
import {setPosition} from "../util/setPosition";
import {hasClosestByClassName} from "../protyle/util/hasClosest";
import {isMobile} from "../util/functions";
import {Constants} from "../constants";
import {resetMenuState, positionSubMenu, generateMenuItemHTML} from "./Menu.uills";

export class Menu {
    public element: HTMLElement;
    public data: any;   // 用于记录当前菜单的数据
    public removeCB: () => void;
    private wheelEvent: string;

    constructor() {
        this.wheelEvent = "onwheel" in document.createElement("div") ? "wheel" : "mousewheel";

        this.element = document.getElementById("commonMenu");
        this.element.querySelector(".b3-menu__title .b3-menu__label").innerHTML = window.siyuan.languages.back;
        this.element.addEventListener(isMobile() ? "click" : "mouseover", (event) => {
            const target = event.target as Element;
            if (isMobile()) {
                const titleElement = hasClosestByClassName(target, "b3-menu__title");
                if (titleElement || (typeof event.detail === "string" && event.detail === "back")) {
                    const lastShowElements = this.element.querySelectorAll(".b3-menu__item--show");
                    if (lastShowElements.length > 0) {
                        lastShowElements[lastShowElements.length - 1].classList.remove("b3-menu__item--show");
                    } else {
                        this.element.style.transform = "";
                        setTimeout(() => {
                            this.remove();
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
            const subMenuElement = itemElement.querySelector(".b3-menu__submenu") as HTMLElement;
            this.element.querySelectorAll(".b3-menu__item--show").forEach((item) => {
                if (!item.contains(itemElement) && item !== itemElement && !itemElement.contains(item)) {
                    item.classList.remove("b3-menu__item--show");
                }
            });
            this.element.querySelectorAll(".b3-menu__item--current").forEach((item) => {
                item.classList.remove("b3-menu__item--current");
            });
            itemElement.classList.add("b3-menu__item--current");
            if (!subMenuElement) {
                return;
            }
            itemElement.classList.add("b3-menu__item--show");
            if (!this.element.classList.contains("b3-menu--fullscreen")) {
                this.showSubMenu(subMenuElement);
            }
        });
    }

    public showSubMenu(subMenuElement: HTMLElement) {
        positionSubMenu(subMenuElement);
    }

    private preventDefault(event: KeyboardEvent) {
        if (!hasClosestByClassName(event.target as Element, "b3-menu") &&
            // 移动端底部键盘菜单
            !hasClosestByClassName(event.target as Element, "keyboard__bar")) {
            event.preventDefault();
        }
    }

    public addItem(option: IMenu) {
        const menuItem = new MenuItem(option);
        this.append(menuItem.element, option.index);
        return menuItem.element;
    }

    public removeScrollEvent() {
        window.removeEventListener(isMobile() ? "touchmove" : this.wheelEvent, this.preventDefault, false);
    }

    public remove(isKeyEvent = false) {
        if (isKeyEvent) {
            const subElements = window.siyuan.menus.menu.element.querySelectorAll(".b3-menu__item--show");
            if (subElements.length > 0) {
                const subElement = subElements[subElements.length - 1];
                subElement.classList.remove("b3-menu__item--show");
                subElement.classList.add("b3-menu__item--current");
                subElement.querySelector(".b3-menu__item--current")?.classList.remove("b3-menu__item--current");
                return;
            }
        }
        if (window.siyuan.menus.menu.removeCB) {
            window.siyuan.menus.menu.removeCB();
            window.siyuan.menus.menu.removeCB = undefined;
        }
        this.removeScrollEvent();
        resetMenuState(this.element);
        this.data = undefined;    // 移除数据
    }

    public append(element?: HTMLElement, index?: number) {
        if (!element) {
            return;
        }
        if (typeof index === "number") {
            const insertElement = this.element.querySelectorAll(".b3-menu__items > .b3-menu__separator")[index];
            if (insertElement) {
                insertElement.before(element);
                return;
            }
        }
        this.element.lastElementChild.append(element);
    }

    public popup(options: IPosition) {
        if (this.element.lastElementChild.innerHTML === "") {
            return;
        }
        window.addEventListener(isMobile() ? "touchmove" : this.wheelEvent, this.preventDefault, {passive: false});
        this.element.style.zIndex = (++window.siyuan.zIndex).toString();
        this.element.classList.remove("fn__none");
        setPosition(this.element, options.x - (options.isLeft ? this.element.clientWidth : 0), options.y, options.h, options.w);
    }

    public fullscreen(position: "bottom" | "all" = "all") {
        if (this.element.lastElementChild.innerHTML === "") {
            return;
        }
        this.element.classList.add("b3-menu--fullscreen");
        this.element.style.zIndex = (++window.siyuan.zIndex).toString();
        this.element.firstElementChild.classList.remove("fn__none");
        this.element.classList.remove("fn__none");
        window.addEventListener("touchmove", this.preventDefault, {passive: false});

        setTimeout(() => {
            if (position === "bottom") {
                this.element.style.transform = "translateY(-50vh)";
                this.element.style.height = "50vh";
            } else {
                this.element.style.transform = "translateY(-100%)";
            }
        });
        this.element.lastElementChild.scrollTop = 0;
    }
}

export class MenuItem {
    public element: HTMLElement;

    constructor(options: IMenu) {
        if (options.ignore) {
            return;
        }
        if (options.type === "empty") {
            this.element = document.createElement("div");
            this.element.innerHTML = options.label;
            if (options.bind) {
                options.bind(this.element);
            }
            return;
        }

        this.element = document.createElement("button");
        if (options.disabled) {
            this.element.setAttribute("disabled", "disabled");
        }
        if (options.id) {
            this.element.setAttribute("data-id", options.id);
        }
        if (options.type === "separator") {
            this.element.classList.add("b3-menu__separator");
            return;
        }
        this.element.classList.add("b3-menu__item");
        if (options.current) {
            this.element.classList.add("b3-menu__item--selected");
        }
        if (options.click) {
            // 需使用 click，否则移动端无法滚动
            this.element.addEventListener("click", (event) => {
                if (this.element.getAttribute("disabled")) {
                    return;
                }
                let keepOpen = options.click(this.element, event);
                if (keepOpen instanceof Promise) {
                    keepOpen = false;
                }
                event.preventDefault();
                event.stopImmediatePropagation();
                event.stopPropagation();
                if (this.element.parentElement && !keepOpen) {
                    window.siyuan.menus.menu.remove();
                }
            });
        }
        if (options.type === "readonly") {
            this.element.classList.add("b3-menu__item--readonly");
        }
        if (options.icon === "iconTrashcan" || options.warning) {
            this.element.classList.add("b3-menu__item--warning");
        }

        if (options.element) {
            this.element.append(options.element);
        } else {
            this.element.innerHTML = generateMenuItemHTML(options);
        }

        if (options.bind) {
            // 主题 rem craft 需要使用 b3-menu__item--custom 来区分自定义菜单 by 281261361
            this.element.classList.add("b3-menu__item--custom");
            options.bind(this.element);
        }

        if (options.submenu) {
            const submenuElement = document.createElement("div");
            submenuElement.classList.add("b3-menu__submenu");
            submenuElement.innerHTML = '<div class="b3-menu__items"></div>';
            options.submenu.forEach((item) => {
                submenuElement.firstElementChild.append(new MenuItem(item).element);
            });
            this.element.insertAdjacentHTML("beforeend", '<svg class="b3-menu__icon b3-menu__icon--small"><use xlink:href="#iconRight"></use></svg>');
            this.element.append(submenuElement);
        }
    }
}

export class subMenu {
    public menus: IMenu[];

    constructor() {
        this.menus = [];
    }

    addSeparator(index?: number, id?: string) {
        if (typeof index === "number") {
            this.menus.splice(index, 0, {type: "separator", id});
        } else {
            this.menus.push({type: "separator", id});
        }
    }

    addItem(menu: IMenu) {
        if (typeof menu.index === "number") {
            this.menus.splice(menu.index, 0, menu);
        } else {
            this.menus.push(menu);
        }
    }
}
