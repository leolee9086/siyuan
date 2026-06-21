import { setPosition } from "../util/DOM/setPosition";
import { isMobile } from "../util/platform/functions";
import {
    resetMenuState,
    positionSubMenu,
    handleMenuEvent,
    preventMenuDefault,
    updateMaxHeight
} from "./Menu.uills";
import { MenuItem } from "./Menu.Item";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanGlobalMenus } from "../util/siyuanEnvironments/getMenu.environment";

export class Menu {
    public element: HTMLElement;
    public data: any;   // 用于记录当前菜单的数据
    public removeCB: undefined | (() => void);
    private wheelEvent: string;
    private position?: IPosition;

    constructor() {
        //默认什么都不做
        this.removeCB = () => { };
        this.wheelEvent = "onwheel" in document.createElement("div") ? "wheel" : "mousewheel";
        this.element = this.getContainer();
        this.element.querySelector(".b3-menu__title .b3-menu__label").innerHTML = siyuanI18n.back;
        this.element.addEventListener(isMobile() ? "click" : "mouseover", (event) => {
            handleMenuEvent(this.element, event, () => this.remove());
        });
    }
    private getContainer() {
        const element = document.getElementById("commonMenu");
        let result: HTMLElement = document.createElement("div");
        //如果有元素直接使用
        if (element) {
            result = element;
        }
        //如果没有就创建
        if (!element) {
            result.setAttribute("id", "commonMenu");
        }
        return result;
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
            const subElements = getSiyuanGlobalMenus().menu.element.querySelectorAll(".b3-menu__item--show");
            if (subElements.length > 0) {
                const subElement = subElements[subElements.length - 1];
                subElement.classList.remove("b3-menu__item--show");
                subElement.classList.add("b3-menu__item--current");
                subElement.querySelector(".b3-menu__item--current")?.classList.remove("b3-menu__item--current");
                return;
            }
        }
        const removeCB = getSiyuanGlobalMenus().menu.removeCB;
        if (removeCB && typeof removeCB === "function") {
            removeCB();
            getSiyuanGlobalMenus().menu.removeCB = undefined;
        }
        this.removeScrollEvent();
        resetMenuState(this.element);
        this.data = undefined;    // 移除数据
    }

    public append(element?: HTMLElement, index?: number) {
        if (!element) {
            return;
        }
        if (!this.element.lastElementChild) {
            throw new Error("菜单容器被意外移除");
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
        if (!this.element.lastElementChild) {
            throw new Error("菜单容器被意外移除");
        }
        if (this.element.lastElementChild.innerHTML === "") {
            return;
        }
        window.addEventListener(isMobile() ? "touchmove" : this.wheelEvent, this.preventDefault, { passive: false });
        this.element.style.zIndex = (++window.siyuan.zIndex).toString();
        this.element.classList.remove("fn__none");
        setPosition(this.element, options.x - (options.isLeft ? this.element.clientWidth : 0), options.y, options.h, options.w);
        updateMaxHeight(this.element, this.element.lastElementChild as HTMLElement);
        this.position = options;
    }

    /**
     * 重新调整菜单位置以防止超出窗口边界
     *
     * 作用：在窗口尺寸变化后，重新计算并调整菜单位置，确保菜单完全显示在视口内
     * 意图：防止窗口 resize 后菜单超出边界导致部分内容不可见
     * 调用时机：窗口 resize 事件的防抖回调中（见 boot/onGetConfig.ts）
     */
    public resetPosition() {
        if (this.element.classList.contains("fn__none") || !this.position) {
            return;
        }
        setPosition(
            this.element,
            this.position.x - (this.position.isLeft ? this.element.clientWidth : 0),
            this.position.y,
            this.position.h,
            this.position.w
        );
        updateMaxHeight(this.element, this.element.lastElementChild as HTMLElement);
        this.element.querySelectorAll(".b3-menu__item--show .b3-menu__submenu").forEach((item: HTMLElement) => {
            this.showSubMenu(item);
        });
    }

    public fullscreen(position: "bottom" | "all" = "all") {
        if (this.element.lastElementChild.innerHTML === "") {
            return;
        }
        this.element.classList.add("b3-menu--fullscreen");
        this.element.style.zIndex = (++window.siyuan.zIndex).toString();
        this.element.firstElementChild.classList.remove("fn__none");
        this.element.classList.remove("fn__none");
        window.addEventListener("touchmove", this.preventDefault, { passive: false });

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
    public appendMenuItemLike(item: { element?: HTMLElement, index?: number }) {
        if (!item.element) {
            throw new Error("插入项目至少需要一个HTML元素");
        }
        this.append(
            item.element,
            item.index
        );
    }
}
export { MenuItem };
