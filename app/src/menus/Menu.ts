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
import { isHiddenProtyleMenuElement } from "../protyle/runtime/menu.visibility";

/** 菜单宿主可替换的最小运行时；未传入时保持思源主应用的现有行为。 */
export interface IMenuHostOptions {
    element?: HTMLElement;
    document?: Document;
    isMobile?: () => boolean;
    backLabel?: string;
    nextZIndex?: () => number;
    closeOnOutsideClick?: boolean;
}

let fallbackZIndex = 10;

const getDefaultZIndex = () => {
    const siyuan = Reflect.get(globalThis, "siyuan");
    if (siyuan && typeof siyuan.zIndex === "number") {
        siyuan.zIndex += 1;
        return siyuan.zIndex;
    }
    fallbackZIndex += 1;
    return fallbackZIndex;
};

const getDefaultBackLabel = () => {
    const languages = Reflect.get(Reflect.get(globalThis, "siyuan"), "languages");
    return typeof languages?.back === "string" ? languages.back : "back";
};

export class Menu {
    public element: HTMLElement;
    public data: any;   // 用于记录当前菜单的数据
    public removeCB: undefined | (() => void);
    private wheelEvent: string;
    private position?: IPosition;
    private readonly document: Document;
    private readonly isMobileHost: () => boolean;
    private readonly nextZIndex: () => number;

    constructor(idOrHost?: string | IMenuHostOptions, closeCB?: () => void, hostOptions?: IMenuHostOptions) {
        const id = typeof idOrHost === "string" ? idOrHost : undefined;
        const host = typeof idOrHost === "object" ? idOrHost : hostOptions;
        this.document = host?.document || document;
        this.isMobileHost = host?.isMobile || isMobile;
        this.nextZIndex = host?.nextZIndex || getDefaultZIndex;
        this.removeCB = undefined;
        this.wheelEvent = "onwheel" in this.document.createElement("div") ? "wheel" : "mousewheel";
        this.element = this.getContainer(host?.element);
        const label = this.element.querySelector(".b3-menu__title .b3-menu__label");
        if (label) {
            label.textContent = host?.backLabel || getDefaultBackLabel();
        }
        this.element.addEventListener(this.isMobileHost() ? "click" : "mouseover", (event) => {
            handleMenuEvent(this.element, event, () => this.remove(), this.isMobileHost);
        });
        this.element.addEventListener("protyle-menu-request-remove", () => this.remove());
        if (host?.closeOnOutsideClick) {
            this.document.addEventListener("click", event => {
                if (this.element.classList.contains("fn__none")) {
                    return;
                }
                const target = event.target;
                if (target instanceof Element && !this.element.contains(target) && !target.closest('[data-menu="true"]')) {
                    this.remove();
                }
            });
        }
        if (id && this.element.getAttribute("data-name") !== id) {
            this.remove();
            this.element.setAttribute("data-name", id);
        }
        this.removeCB = closeCB;
    }
    private getContainer(hostElement?: HTMLElement) {
        const existing = hostElement || this.document.getElementById("commonMenu");
        if (existing) {
            return existing;
        }
        const result = this.document.createElement("div");
        result.id = "commonMenu";
        result.className = "b3-menu fn__none";
        result.innerHTML = '<div class="b3-menu__title fn__none"><span class="b3-menu__label"></span></div><div class="b3-menu__items"></div>';
        if (this.document.body) {
            this.document.body.append(result);
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
        window.removeEventListener(this.isMobileHost() ? "touchmove" : this.wheelEvent, this.preventDefault, false);
    }

    public remove(isKeyEvent = false) {
        if (isKeyEvent) {
            const subElements = this.element.querySelectorAll(".b3-menu__item--show");
            if (subElements.length > 0) {
                const subElement = subElements[subElements.length - 1];
                subElement.classList.remove("b3-menu__item--show");
                subElement.classList.add("b3-menu__item--current");
                subElement.querySelector(".b3-menu__item--current")?.classList.remove("b3-menu__item--current");
                return;
            }
        }
        const removeCB = this.removeCB;
        if (removeCB && typeof removeCB === "function") {
            removeCB();
            this.removeCB = undefined;
        }
        this.removeScrollEvent();
        resetMenuState(this.element);
        this.data = undefined;    // 移除数据
    }

    public append(element?: HTMLElement, index?: number) {
        if (!element || isHiddenProtyleMenuElement(element)) {
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
        window.addEventListener(this.isMobileHost() ? "touchmove" : this.wheelEvent, this.preventDefault, { passive: false });
        this.element.style.zIndex = this.nextZIndex().toString();
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
        this.element.style.zIndex = this.nextZIndex().toString();
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

/** 创建可作为 Protyle 菜单宿主的统一菜单实现；独立入口和完整 App 共用此实现。 */
export const createProtyleMenu = (options?: IMenuHostOptions) => new Menu(undefined, undefined, options);
