import {setPosition} from "../util/setPosition";
import {isMobile} from "../util/functions";
import {
    resetMenuState, 
    positionSubMenu, 
    handleMenuEvent, 
    preventMenuDefault
} from "./Menu.uills";
import { MenuItem } from "./Menu.Item";

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
            handleMenuEvent(this.element, event, () => this.remove());
        });
    }

    public showSubMenu(subMenuElement: HTMLElement) {
        positionSubMenu(subMenuElement);
    }

    private preventDefault(event: KeyboardEvent) {
        preventMenuDefault(event);
    }

    public addItem(option: IMenu) {
        const menuItem = new MenuItem(option);
        if (menuItem) {
            this.append(menuItem.element, option.index);
            return menuItem.element;
        }
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


