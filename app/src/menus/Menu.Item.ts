import { generateMenuItemHTML } from "./Menu.uills";
import {
    createHiddenProtyleMenuElement,
    filterProtyleMenuItems,
    isHiddenProtyleMenuElement,
    isProtyleMenuItemVisible,
} from "../protyle/runtime/menu.visibility";

/** 创建递归子菜单；过滤与顶层菜单项使用相同的可见性规则。 */
const createSubmenuElement = (submenuItems: IMenu[]) => {
    const submenuElement = document.createElement("div");
    submenuElement.classList.add("b3-menu__submenu");
    submenuElement.innerHTML = '<div class="b3-menu__items"></div>';
    for (const item of filterProtyleMenuItems(submenuItems)) {
        const element = new MenuItem(item).element;
        if (!isHiddenProtyleMenuElement(element)) {
            submenuElement.firstElementChild.append(element);
        }
    }
    return submenuElement;
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
        //先去除,因为这个地方应该调用方处理是否ignore
        //if (options.ignore) {e
        //  return ;
        //}
        if (options.type === "empty") {
            this.element = document.createElement("div");
            this.element.innerHTML = options.label || "";
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
                //不能假定options不会被修改
                let keepOpen = options.click && options.click(this.element, event);
                if (keepOpen instanceof Promise) {
                    keepOpen = false;
                }
                event.preventDefault();
                event.stopImmediatePropagation();
                event.stopPropagation();
                if (this.element.parentElement && !keepOpen) {
                    this.element.closest<HTMLElement>(".b3-menu")?.dispatchEvent(new CustomEvent("protyle-menu-request-remove"));
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
            const submenuElement = createSubmenuElement(options.submenu);
            this.element.insertAdjacentHTML("beforeend", '<svg class="b3-menu__icon b3-menu__icon--small"><use xlink:href="#iconRight"></use></svg>');
            this.element.append(submenuElement);
        }

    }
}
