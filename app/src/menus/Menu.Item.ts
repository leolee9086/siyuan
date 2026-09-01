import { generateMenuItemHTML } from "./Menu.uills";
import {
    createHiddenProtyleMenuElement,
    filterProtyleMenuItems,
    isHiddenProtyleMenuElement,
    isProtyleMenuItemVisible,
} from "../protyle/runtime/menu.visibility";
import { isMobile } from "../util/platform/functions";
import { getActionMenu } from "./Menu.getActionMenu";
import { getSiyuanGlobalMenusMenu } from "../util/siyuanEnvironments/getMenu.environment";

export const CUSTOM_EVENT_LOAD_SUBMENU = "load-submenu";

/** 更新子菜单内分组样式（复用 Menu.ts 逻辑的最小实现，避免循环依赖） */
const updateSubmenuGroupClasses = (itemsElement: Element) => {
    const itemElements = Array.from(itemsElement.children).filter((el) =>
        el.classList.contains("b3-menu__item"));
    itemElements.forEach((el) => el.classList.remove("b3-menu__item--group-first", "b3-menu__item--group-last"));
    if (itemElements.length === 0) {
        itemsElement.classList.remove("b3-menu__items--menu");
        return;
    }
    itemsElement.classList.add("b3-menu__items--menu");
    const group: Element[] = [];
    const flush = () => {
        if (group.length === 0) return;
        const first = group[0];
        const last = group[group.length - 1];
        if (first instanceof HTMLElement) first.classList.add("b3-menu__item--group-first");
        if (last instanceof HTMLElement) last.classList.add("b3-menu__item--group-last");
        group.length = 0;
    };
    Array.from(itemsElement.children).forEach((el) => {
        if (el.classList.contains("fn__none")) return;
        if (el.classList.contains("b3-menu__separator")) flush();
        else if (el.classList.contains("b3-menu__item")) group.push(el);
    });
    flush();
};

/** 创建递归子菜单；过滤与顶层菜单项使用相同的可见性规则。 */
const createSubmenuElement = (submenuItems: IMenu[]) => {
    const submenuElement = document.createElement("div");
    submenuElement.classList.add("b3-menu__submenu");
    submenuElement.innerHTML = '<div class="b3-menu__items"></div>';
    const container = submenuElement.firstElementChild;
    if (!container) return submenuElement;
    for (const item of filterProtyleMenuItems(submenuItems)) {
        const element = new MenuItem(item).element;
        if (!isHiddenProtyleMenuElement(element)) {
            container.append(element);
        }
    }
    return submenuElement;
};

const createLoadingPlaceholder = (): IMenu => {
    const placeholder: IMenu = {
        type: "readonly",
        label: window.siyuan.languages.loading,
    };
    return placeholder;
};

const createEmptyPlaceholder = (): IMenu => {
    const placeholder: IMenu = {
        type: "readonly",
        label: window.siyuan.languages.emptyContent,
    };
    return placeholder;
};

const renderSubmenuItems = (container: Element, items: IMenu[]) => {
    container.innerHTML = "";
    const toRender = items.length === 0 ? [createEmptyPlaceholder()] : items;
    for (const item of filterProtyleMenuItems(toRender)) {
        const element = new MenuItem(item).element;
        if (!isHiddenProtyleMenuElement(element)) {
            container.append(element);
        }
    }
    updateSubmenuGroupClasses(container);
};

const focusFirstSubmenuItem = (container: Element) => {
    const firstChild = container.firstElementChild;
    if (!firstChild) return;
    const actionMenuElement = getActionMenu(firstChild, true);
    if (!actionMenuElement) return;
    const menuElement = getSiyuanGlobalMenusMenu().element;
    menuElement.querySelectorAll(".b3-menu__item--current").forEach((el) => el.classList.remove("b3-menu__item--current"));
    actionMenuElement.classList.add("b3-menu__item--current");
};

const attachLoadSubmenu = (
    itemElement: HTMLElement,
    submenuElement: HTMLElement,
    loadFn: () => Promise<IMenu[]>
) => {
    if (itemElement.getAttribute("data-load-submenu-attached") === "1") return;
    itemElement.setAttribute("data-load-submenu-attached", "1");
    const getLoading = () => itemElement.getAttribute("data-load-loading") === "1";
    const setLoading = (v: boolean) => v ? itemElement.setAttribute("data-load-loading", "1") : itemElement.removeAttribute("data-load-loading");
    const getLoaded = () => itemElement.getAttribute("data-load-loaded") === "1";
    const setLoaded = (v: boolean) => v ? itemElement.setAttribute("data-load-loaded", "1") : itemElement.removeAttribute("data-load-loaded");
    let focusAfterLoad = false;
    const container = submenuElement.firstElementChild;
    if (!container) return;
    const handleLoad = (event: Event) => {
        if (event instanceof CustomEvent && event.detail?.focus) focusAfterLoad = true;
        if (getLoading() || getLoaded()) return;
        setLoading(true);
        loadFn().then((items) => {
            if (!itemElement.isConnected) return;
            renderSubmenuItems(container, items);
            setLoaded(true);
            try { getSiyuanGlobalMenusMenu().showSubMenu(submenuElement); } catch {}
            if (focusAfterLoad && itemElement.classList.contains("b3-menu__item--show")) focusFirstSubmenuItem(container);
            focusAfterLoad = false;
        }).catch(() => {
            if (!itemElement.isConnected) return;
            renderSubmenuItems(container, []);
            focusAfterLoad = false;
        }).finally(() => setLoading(false));
    };
    const trigger = isMobile() ? "click" : "mouseenter";
    itemElement.addEventListener(trigger, handleLoad);
    itemElement.addEventListener(CUSTOM_EVENT_LOAD_SUBMENU, handleLoad);
};

const buildSubmenu = (itemElement: HTMLElement, options: IMenu) => {
    const hasLoad = Boolean(options.loadSubmenu);
    const hasStatic = Boolean(options.submenu);
    if (!hasLoad && !hasStatic) return;
    let submenuElement: HTMLElement;
    if (hasLoad && !hasStatic) {
        submenuElement = createSubmenuElement([createLoadingPlaceholder()]);
    } else if (options.submenu) {
        submenuElement = createSubmenuElement(options.submenu);
    } else {
        submenuElement = createSubmenuElement([createLoadingPlaceholder()]);
    }
    const container = submenuElement.firstElementChild;
    if (container) updateSubmenuGroupClasses(container);
    itemElement.insertAdjacentHTML("beforeend", '<svg class="b3-menu__icon b3-menu__icon--small"><use xlink:href="#iconRight"></use></svg>');
    itemElement.append(submenuElement);
    if (hasLoad && options.loadSubmenu) {
        attachLoadSubmenu(itemElement, submenuElement, options.loadSubmenu);
    }
};

const bindClick = (itemElement: HTMLElement, options: IMenu) => {
    if (!options.click) return;
    itemElement.addEventListener("click", (event) => {
        if (itemElement.getAttribute("disabled")) return;
        let keepOpen = options.click ? options.click(itemElement, event) : undefined;
        if (keepOpen instanceof Promise) keepOpen = false;
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
        if (itemElement.parentElement && !keepOpen) {
            const menu = itemElement.closest(".b3-menu");
            if (menu) menu.dispatchEvent(new CustomEvent("protyle-menu-request-remove"));
        }
    });
};

export class MenuItem {
    public element: HTMLElement;

    /** 在菜单领域所有者内部集中实例化菜单项，供受 factory 门禁的行为模块调用。 */
    public static create(options: IMenu) {
        return new MenuItem(options);
    }

    constructor(options: IMenu) {
        if (!isProtyleMenuItemVisible(options)) {
            this.element = createHiddenProtyleMenuElement();
            return;
        }
        if (options.type === "empty") {
            this.element = document.createElement("div");
            this.element.innerHTML = options.label || "";
            if (options.bind) options.bind(this.element);
            return;
        }
        this.element = document.createElement("button");
        if (options.disabled) this.element.setAttribute("disabled", "disabled");
        if (options.id) this.element.setAttribute("data-id", options.id);
        if (options.type === "separator") {
            this.element.classList.add("b3-menu__separator");
            return;
        }
        this.element.classList.add("b3-menu__item");
        if (options.current) this.element.classList.add("b3-menu__item--selected");
        bindClick(this.element, options);
        if (options.type === "readonly") this.element.classList.add("b3-menu__item--readonly");
        if (options.icon === "iconTrashcan" || options.warning) this.element.classList.add("b3-menu__item--warning");
        if (options.element) {
            this.element.append(options.element);
        } else {
            this.element.innerHTML = generateMenuItemHTML(options);
        }
        if (options.bind) {
            this.element.classList.add("b3-menu__item--custom");
            options.bind(this.element);
        }
        buildSubmenu(this.element, options);
    }
}
