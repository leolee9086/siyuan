import { setPosition } from "../util/DOM/positioning/setPosition";
import { isMobile } from "../util/platform/functions";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { Constants } from "../constants";
import { applyMenuEntryVisibility } from "../config/entryVisibility/runtime";
import {
    resetMenuState,
    positionSubMenu,
    preventMenuDefault,
    updateMaxHeight
} from "./Menu.uills";
import { MenuItem } from "./Menu.Item";
import { setMenuInputCurrent } from "./menuKeyboard";
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
    const siyuan = window.siyuan;
    if (siyuan && typeof siyuan.zIndex === "number") {
        siyuan.zIndex += 1;
        return siyuan.zIndex;
    }
    fallbackZIndex += 1;
    return fallbackZIndex;
};

const getDefaultBackLabel = () => {
    const siyuan = window.siyuan;
    const languages = siyuan?.languages;
    return typeof languages?.back === "string" ? languages.back : "back";
};

let fullscreenCloseTimeout: number;
let fullscreenScrimHideTimeout: number;

const updateMenuItemGroupClasses = (itemsElement: Element) => {
    const itemElements = Array.from(itemsElement.children).filter((element) =>
        element.classList.contains("b3-menu__item")) as HTMLElement[];
    itemElements.forEach((element) => {
        element.classList.remove("b3-menu__item--group-first", "b3-menu__item--group-last");
    });
    if (itemElements.length === 0) {
        itemsElement.classList.remove("b3-menu__items--menu");
        return;
    }
    itemsElement.classList.add("b3-menu__items--menu");
    let groupElements: HTMLElement[] = [];
    const updateGroup = () => {
        if (groupElements.length === 0) {
            return;
        }
        groupElements[0].classList.add("b3-menu__item--group-first");
        groupElements[groupElements.length - 1].classList.add("b3-menu__item--group-last");
        groupElements = [];
    };
    Array.from(itemsElement.children).forEach((element: HTMLElement) => {
        if (element.classList.contains("fn__none")) {
            return;
        }
        if (element.classList.contains("b3-menu__separator")) {
            updateGroup();
        } else if (element.classList.contains("b3-menu__item")) {
            groupElements.push(element);
        }
    });
    updateGroup();
};

// 菜单条目可见性与分组样式仅作用于桌面端界面，移动端菜单不做处理。
const applyMenuConfig = (menuElement: HTMLElement) => {
    if (!isMobile()) {
        applyMenuEntryVisibility(menuElement);
        menuElement.querySelectorAll(".b3-menu__items").forEach(updateMenuItemGroupClasses);
    }
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
    private sheetTouchStartX: number | undefined;
    private sheetTouchStartY: number | undefined;
    private sheetTouchStartTime: number | undefined;
    private sheetCanDrag = false;
    private sheetDragging = false;
    private suppressSheetClick = false;
    private targetPositionFrame: number | undefined;

    private updateTargetPosition = () => {
        if (typeof this.targetPositionFrame === "number") {
            cancelAnimationFrame(this.targetPositionFrame);
        }
        this.targetPositionFrame = requestAnimationFrame(() => {
            this.targetPositionFrame = undefined;
            this.resetPosition();
        });
    };

    constructor(idOrHost?: string | IMenuHostOptions, closeCB?: () => void, hostOptions?: IMenuHostOptions) {
        const id = typeof idOrHost === "string" ? idOrHost : undefined;
        const host = typeof idOrHost === "object" ? idOrHost : hostOptions;
        this.document = host?.document || document;
        this.isMobileHost = host?.isMobile || isMobile;
        this.nextZIndex = host?.nextZIndex || getDefaultZIndex;
        this.removeCB = undefined;
        this.wheelEvent = "onwheel" in this.document.createElement("div") ? "wheel" : "mousewheel";
        // 绑定后的引用才能在添加与移除监听时保持同一实例
        this.preventDefault = this.preventDefault.bind(this);
        this.element = this.getContainer(host?.element);
        const label = this.element.querySelector(".b3-menu__title .b3-menu__label");
        if (label) {
            label.textContent = host?.backLabel || getDefaultBackLabel();
        }
        const activateKeymapInput = (event: Event) => {
            const target = event.target as HTMLElement;
            if (["INPUT", "TEXTAREA"].includes(target.tagName) &&
                target.hasAttribute(Constants.ATTRIBUTE_MENU_KEYMAP)) {
                setMenuInputCurrent(this.element, target);
            }
        };
        this.element.addEventListener("focusin", activateKeymapInput);
        this.element.addEventListener("pointerdown", activateKeymapInput);
        if (this.isMobileHost()) {
            this.element.addEventListener("touchstart", this.handleSheetTouchStart, {passive: true});
            this.element.addEventListener("touchmove", this.handleSheetTouchMove, {passive: false});
            this.element.addEventListener("touchend", this.handleSheetTouchEnd);
            this.element.addEventListener("touchcancel", this.handleSheetTouchCancel);
            if (this.element.id === "commonMenu") {
                this.document.getElementById("commonMenuScrim")?.addEventListener("click", (event) => {
                    event.stopPropagation();
                    this.closeSheet();
                });
            }
        }
        this.element.addEventListener(this.isMobileHost() ? "click" : "mouseover", (event) => {
            if (this.isMobileHost() && this.suppressSheetClick && typeof event.detail !== "string") {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            const target = event.target as Element;
            if (this.isMobileHost()) {
                const titleElement = hasClosestByClassName(target, "b3-menu__title");
                const isSystemBack = typeof event.detail === "string" && event.detail === "back";
                if ((titleElement && !titleElement.classList.contains("b3-menu__title--root")) || isSystemBack) {
                    const lastShowElements = this.element.querySelectorAll(".b3-menu__item--show");
                    if (lastShowElements.length > 0) {
                        lastShowElements[lastShowElements.length - 1].classList.remove("b3-menu__item--show");
                        if (this.element.classList.contains("b3-menu--sheet")) {
                            this.setSheetHeight();
                        }
                    } else {
                        this.closeSheet();
                    }
                    return;
                }
            }

            const itemElement = hasClosestByClassName(target, "b3-menu__item");
            if (!itemElement) {
                return;
            }
            if (itemElement.classList.contains("b3-menu__item--readonly") ||
                itemElement.getAttribute("data-type") === "nobg") {
                return;
            }
            const subMenuElement = itemElement.querySelector(":scope > .b3-menu__submenu") as HTMLElement;
            // 子菜单容器的 mouseover 会向上匹配到所属菜单项，无需重新定位已打开的子菜单
            if (subMenuElement?.contains(target)) {
                return;
            }
            const isSubMenuShown = itemElement.classList.contains("b3-menu__item--show");
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
            if (!isSubMenuShown) {
                if (this.element.classList.contains("b3-menu--sheet")) {
                    this.setSheetHeight();
                } else if (!this.element.classList.contains("b3-menu--fullscreen")) {
                    this.showSubMenu(subMenuElement);
                }
            }
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

    private getFullscreenScrim() {
        if (this.element.id !== "commonMenu") {
            return;
        }
        return this.document.getElementById("commonMenuScrim");
    }

    private showFullscreenScrim() {
        const scrimElement = this.getFullscreenScrim();
        if (!scrimElement) {
            return;
        }
        clearTimeout(fullscreenScrimHideTimeout);
        scrimElement.style.opacity = "";
        scrimElement.style.zIndex = this.nextZIndex().toString();
        scrimElement.classList.remove("fn__none");
        requestAnimationFrame(() => {
            if (this.element.classList.contains("b3-menu--sheet") &&
                !this.element.classList.contains("fn__none")) {
                scrimElement.classList.add("b3-menu__scrim--open");
            }
        });
    }

    private hideFullscreenScrim() {
        const scrimElement = this.getFullscreenScrim();
        if (!scrimElement) {
            return;
        }
        scrimElement.style.opacity = "";
        scrimElement.classList.remove("b3-menu__scrim--open");
        clearTimeout(fullscreenScrimHideTimeout);
        fullscreenScrimHideTimeout = window.setTimeout(() => {
            if (!scrimElement.classList.contains("b3-menu__scrim--open")) {
                scrimElement.classList.add("fn__none");
                scrimElement.style.zIndex = "";
            }
        }, Constants.TIMEOUT_DBLCLICK);
    }

    private canDragSheet(target: HTMLElement) {
        if (target.closest("input, textarea, select, [contenteditable=\"true\"]")) {
            return false;
        }
        if (target.closest(".b3-menu__title")) {
            return true;
        }
        if (!target.closest(".b3-menu__items")) {
            return false;
        }
        let element: HTMLElement = target;
        while (element && element !== this.element) {
            const style = getComputedStyle(element);
            if (element.scrollHeight > element.clientHeight + 1 &&
                ["auto", "scroll", "overlay"].includes(style.overflowY) && element.scrollTop > 0) {
                return false;
            }
            element = element.parentElement;
        }
        return true;
    }

    private handleSheetTouchStart = (event: TouchEvent) => {
        if (!this.element.classList.contains("b3-menu--sheet") || event.touches.length !== 1) {
            return;
        }
        const touch = event.touches[0];
        this.sheetTouchStartX = touch.clientX;
        this.sheetTouchStartY = touch.clientY;
        this.sheetTouchStartTime = performance.now();
        this.sheetCanDrag = this.canDragSheet(event.target as HTMLElement);
        this.sheetDragging = false;
    };

    private handleSheetTouchMove = (event: TouchEvent) => {
        if (!this.sheetCanDrag || typeof this.sheetTouchStartX !== "number" ||
            typeof this.sheetTouchStartY !== "number" || event.touches.length !== 1) {
            return;
        }
        const touch = event.touches[0];
        const xDiff = touch.clientX - this.sheetTouchStartX;
        const yDiff = touch.clientY - this.sheetTouchStartY;
        if (!this.sheetDragging && (yDiff <= 0 || Math.abs(xDiff) > Math.abs(yDiff))) {
            return;
        }
        const offset = Math.max(0, yDiff);
        this.sheetDragging = true;
        this.element.style.transition = "none";
        this.element.style.transform = `translateY(${offset}px)`;
        const scrimElement = this.getFullscreenScrim();
        if (scrimElement) {
            scrimElement.style.opacity = Math.max(0, .2 * (1 - offset / this.element.clientHeight)).toString();
        }
        if (event.cancelable) {
            event.preventDefault();
        }
    };

    private finishSheetTouch() {
        this.sheetTouchStartX = undefined;
        this.sheetTouchStartY = undefined;
        this.sheetTouchStartTime = undefined;
        this.sheetCanDrag = false;
        this.sheetDragging = false;
    }

    private handleSheetTouchEnd = (event: TouchEvent) => {
        if (!this.sheetDragging || typeof this.sheetTouchStartY !== "number" ||
            typeof this.sheetTouchStartTime !== "number") {
            this.finishSheetTouch();
            return;
        }
        const touch = event.changedTouches[0];
        const offset = Math.max(0, touch.clientY - this.sheetTouchStartY);
        const duration = Math.max(performance.now() - this.sheetTouchStartTime, 1);
        const velocity = offset / duration;
        const shouldClose = offset > Math.min(120, this.element.clientHeight * .25) ||
            (offset > 20 && velocity > .6);
        this.element.style.transition = "";
        void this.element.offsetHeight;
        if (shouldClose) {
            this.closeSheet();
        } else {
            this.element.style.transform = "translateY(0px)";
            const scrimElement = this.getFullscreenScrim();
            if (scrimElement) {
                scrimElement.style.opacity = "";
            }
        }
        this.suppressSheetClick = true;
        window.setTimeout(() => {
            this.suppressSheetClick = false;
        }, 300);
        this.finishSheetTouch();
    };

    private handleSheetTouchCancel = () => {
        if (this.sheetDragging) {
            this.element.style.transition = "";
            void this.element.offsetHeight;
            this.element.style.transform = "translateY(0px)";
            const scrimElement = this.getFullscreenScrim();
            if (scrimElement) {
                scrimElement.style.opacity = "";
            }
        }
        this.finishSheetTouch();
    };

    private closeSheet() {
        if (!this.element.classList.contains("b3-menu--sheet")) {
            this.element.style.transform = "";
            window.setTimeout(() => this.remove(), Constants.TIMEOUT_DBLCLICK);
            return;
        }
        clearTimeout(fullscreenCloseTimeout);
        this.element.style.transition = "";
        void this.element.offsetHeight;
        this.element.style.transform = "translateY(100%)";
        this.hideFullscreenScrim();
        fullscreenCloseTimeout = window.setTimeout(() => this.removeImmediately(), Constants.TIMEOUT_DBLCLICK);
    }

    private updateSheetTitle() {
        if (!this.element.classList.contains("b3-menu--sheet")) {
            return;
        }
        const titleElement = this.element.firstElementChild as HTMLElement;
        const labelElement = titleElement.querySelector(".b3-menu__label") as HTMLElement;
        const shownItems = this.element.querySelectorAll(".b3-menu__item--show");
        if (shownItems.length === 0) {
            titleElement.classList.add("b3-menu__title--root");
            labelElement.textContent = "";
            return;
        }
        titleElement.classList.remove("b3-menu__title--root");
        const parentLabelElement = shownItems[shownItems.length - 1]
            .querySelector(":scope > .b3-menu__label") as HTMLElement;
        labelElement.textContent = parentLabelElement?.textContent.trim() || getDefaultBackLabel();
    }

    private setSheetHeight() {
        this.updateSheetTitle();
        const mobileSize = window.siyuan.mobile.size;
        const orientationSize = mobileSize.isLandscape ? mobileSize.landscape : mobileSize.portrait;
        // 使用当前方向记录的完整视口高度，避免软键盘收起期间菜单高度被压缩
        this.element.style.height = Math.max(window.innerHeight, orientationSize?.height1 || 0) * .56 + "px";
    }

    public showSubMenu(subMenuElement: HTMLElement) {
        const itemsMenuElement = subMenuElement.lastElementChild as HTMLElement;
        if (!itemsMenuElement) {
            return;
        }
        itemsMenuElement.style.maxHeight = "";
        if (this.element.classList.contains("b3-menu--sheet")) {
            this.setSheetHeight();
            return;
        }
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
                if (this.element.classList.contains("b3-menu--sheet")) {
                    this.setSheetHeight();
                }
                return;
            }
        }
        this.removeImmediately();
    }

    private emitCommonMenu(type: TEventBus, detail: {
        name: string | null,
        from: string | null,
        mode?: "popup" | "fullscreen",
    }) {
        if (this.element.id !== "commonMenu") {
            return;
        }
        window.siyuan.ws?.app?.plugins?.forEach((plugin) => {
            plugin.eventBus.emit(type, {
                menu: this.element,
                ...detail,
            });
        });
    }

    private removeImmediately() {
        const menuName = this.element.getAttribute("data-name");
        const menuFrom = this.element.getAttribute("data-from");
        const wasOpen = !this.element.classList.contains("fn__none");
        clearTimeout(fullscreenCloseTimeout);
        this.hideFullscreenScrim();
        this.finishSheetTouch();
        this.stopTrackingTargetPosition();
        const removeCB = this.removeCB;
        if (removeCB && typeof removeCB === "function") {
            this.removeCB = undefined;
            removeCB();
        }
        this.removeScrollEvent();
        resetMenuState(this.element);
        this.element.classList.remove("b3-menu--sheet");
        const titleElement = this.element.firstElementChild as HTMLElement | null;
        titleElement?.classList.remove("b3-menu__title--root");
        const labelElement = titleElement?.querySelector(".b3-menu__label") as HTMLElement | null;
        if (labelElement) {
            labelElement.textContent = getDefaultBackLabel();
        }
        this.element.lastElementChild?.classList.remove("b3-menu__items--menu");
        this.data = undefined;    // 移除数据
        if (wasOpen) {
            this.emitCommonMenu("common-menu-closed", {name: menuName, from: menuFrom});
        }
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
                updateMenuItemGroupClasses(this.element.lastElementChild);
                return;
            }
        }

        this.element.lastElementChild.append(element);
        updateMenuItemGroupClasses(this.element.lastElementChild);
    }

    public popup(options: IPosition) {
        if (!this.element.lastElementChild) {
            throw new Error("菜单容器被意外移除");
        }
        applyMenuConfig(this.element);
        if (this.element.lastElementChild.innerHTML === "") {
            return;
        }
        this.emitCommonMenu("common-menu-open", {
            name: this.element.getAttribute("data-name"),
            from: this.element.getAttribute("data-from"),
            mode: "popup",
        });
        window.addEventListener(this.isMobileHost() ? "touchmove" : this.wheelEvent, this.preventDefault, { passive: false });
        this.element.style.zIndex = this.nextZIndex().toString();
        this.element.classList.remove("fn__none");
        this.position = options;
        setPosition(this.element, options.x - (options.isLeft ? this.element.clientWidth : 0), options.y, options.h, options.w);
        updateMaxHeight(this.element, this.element.lastElementChild as HTMLElement);
        this.startTrackingTargetPosition();
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
        if (this.position.target?.isConnected) {
            const rect = this.position.target.getBoundingClientRect();
            this.position.x = this.position.isLeft ? rect.right : rect.left;
            this.position.y = rect.bottom;
            this.position.h = rect.height;
            this.position.w = rect.width;
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
            // 可能有多层子菜单，都要重新定位
            this.showSubMenu(item);
        });
    }

    private startTrackingTargetPosition() {
        this.stopTrackingTargetPosition();
        if (!this.position || !this.position.target) {
            return;
        }
        window.addEventListener("resize", this.updateTargetPosition);
        window.visualViewport?.addEventListener("resize", this.updateTargetPosition);
        window.visualViewport?.addEventListener("scroll", this.updateTargetPosition);
    }

    private stopTrackingTargetPosition() {
        window.removeEventListener("resize", this.updateTargetPosition);
        window.visualViewport?.removeEventListener("resize", this.updateTargetPosition);
        window.visualViewport?.removeEventListener("scroll", this.updateTargetPosition);
        if (typeof this.targetPositionFrame === "number") {
            cancelAnimationFrame(this.targetPositionFrame);
            this.targetPositionFrame = undefined;
        }
    }

    public fullscreen(position: "bottom" | "all" = "all") {
        applyMenuConfig(this.element);
        if (!this.element.lastElementChild || this.element.lastElementChild.innerHTML === "") {
            return;
        }
        this.emitCommonMenu("common-menu-open", {
            name: this.element.getAttribute("data-name"),
            from: this.element.getAttribute("data-from"),
            mode: "fullscreen",
        });
        if (!this.isMobileHost()) {
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
            return;
        }
        clearTimeout(fullscreenCloseTimeout);
        this.element.querySelectorAll(":scope > .b3-menu__items, .b3-menu__submenu > .b3-menu__items")
            .forEach(updateMenuItemGroupClasses);
        this.element.classList.add("b3-menu--fullscreen", "b3-menu--sheet");
        this.element.style.transform = "translateY(100%)";
        this.showFullscreenScrim();
        this.element.style.zIndex = this.nextZIndex().toString();
        this.element.firstElementChild.classList.remove("fn__none");
        this.element.classList.remove("fn__none");
        window.addEventListener("touchmove", this.preventDefault, { passive: false });
        this.setSheetHeight();
        void this.element.offsetHeight;
        requestAnimationFrame(() => {
            if (this.element.classList.contains("b3-menu--sheet")) {
                this.element.style.transform = "translateY(0px)";
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
export { getActionMenu } from "./Menu.getActionMenu";
export { subMenu } from "./Menu.subMenu";

/** 创建可作为 Protyle 菜单宿主的统一菜单实现；独立入口和完整 App 共用此实现。 */
export const createProtyleMenu = (options?: IMenuHostOptions) => new Menu(undefined, undefined, options);
