/** 用途：约束独立入口只实现 Protyle 所需菜单能力；使用范围：独立 DOM 菜单；解耦评估：这是宿主能力接口，具体实现可替换。 */
import type {IProtyleMenuPort} from "../protyle/runtime/menu.types";

/** 识别菜单过滤阶段生成的隐藏占位节点，避免将其挂载到宿主菜单。 */
const isHiddenProtyleMenuElement = (element?: Element) =>
    element?.getAttribute("data-protyle-menu-hidden") === "true";

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

/** 判断独立菜单是否处于移动端宿主，决定采用点击还是悬停交互。 */
const isMobileMenu = () => {
    const sidebar = document.getElementById("sidebar");
    return Boolean(sidebar);
};

/** 从事件目标解析菜单项，避免宿主依赖调用者提供具体节点引用。 */
const getClosestMenuItem = (target: EventTarget | null) => {
    return target instanceof Element ? target.closest<HTMLElement>(".b3-menu__item") : null;
};

/** 只接受真正的元素事件目标，供菜单事件处理使用。 */
const getEventElement = (event: Event) => event.target instanceof Element ? event.target : null;

/** 读取移动端返回手势使用的自定义事件详情。 */
const getEventDetail = (event: Event) => "detail" in event ? event.detail : undefined;

/** 根据父项和视口空间计算子菜单的水平位置。 */
const getStandaloneSubMenuLeft = (options: { parentRect: DOMRect, subMenuWidth: number, viewportWidth: number, opensLeft: boolean }) => {
    const {parentRect, subMenuWidth, viewportWidth, opensLeft} = options;
    const spaceRight = viewportWidth - parentRect.right - 8;
    const spaceLeft = parentRect.left - 8;
    if (opensLeft && spaceLeft >= subMenuWidth) {
        return parentRect.left - 8 - subMenuWidth;
    }
    if (spaceRight >= subMenuWidth) {
        return parentRect.right + 8;
    }
    if (spaceLeft >= subMenuWidth) {
        return parentRect.left - 8 - subMenuWidth;
    }
    return Math.max(0, viewportWidth - subMenuWidth);
};

/** 将子菜单限制在当前视口内，并在右侧空间不足时切换到父项左侧。 */
const positionStandaloneSubMenu = (subMenuElement: HTMLElement) => {
    const parent = subMenuElement.parentElement;
    if (!parent) {
        return;
    }
    parent.classList.add("b3-menu__item--show");
    const itemsElement = subMenuElement.lastElementChild;
    // 子菜单内容容器存在时清除旧的高度限制，保证重新定位基于最新内容尺寸。
    if (itemsElement instanceof HTMLElement) {
        itemsElement.style.maxHeight = "";
    }
    const parentRect = parent.getBoundingClientRect();
    const subMenuRect = subMenuElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const top = Math.max(0, Math.min(parentRect.top - 9, viewportHeight - subMenuRect.height - 1));

    const parentSubMenu = parent.parentElement?.parentElement?.closest<HTMLElement>(".b3-menu__item");
    const opensLeft = Boolean(parentSubMenu && parentRect.left < parentSubMenu.getBoundingClientRect().left);
    const left = getStandaloneSubMenuLeft({parentRect, subMenuWidth: subMenuRect.width, viewportWidth, opensLeft});

    subMenuElement.style.position = "fixed";
    subMenuElement.style.left = `${Math.max(0, left)}px`;
    subMenuElement.style.top = `${top}px`;

    // 定位完成后按剩余视口高度限制滚动区域，避免子菜单溢出窗口。
    if (itemsElement instanceof HTMLElement) {
        const menuRect = subMenuElement.getBoundingClientRect();
        const availableHeight = viewportHeight - menuRect.top - (menuRect.height - itemsElement.getBoundingClientRect().height) + 1;
        itemsElement.style.maxHeight = `${Math.max(availableHeight, 0)}px`;
    }
};

/** 处理移动端菜单标题返回和关闭手势，并报告事件是否已消费。 */
const handleStandaloneMobileMenuEvent = (menuElement: HTMLElement, event: Event, remove: () => void) => {
    const target = getEventElement(event);
    const title = target?.closest(".b3-menu__title");
    const detail = getEventDetail(event);
    if (!title && !(detail === "back")) {
        return false;
    }
    const shown = menuElement.querySelectorAll<HTMLElement>(".b3-menu__item--show");
    // 有展开的子菜单时先返回上一级，只有根菜单才真正关闭。
    if (shown.length > 0) {
        const lastShown = shown[shown.length - 1];
        lastShown.classList.remove("b3-menu__item--show");
        return true;
    }
    menuElement.style.transform = "";
    // 使用微任务在当前点击事件结束后关闭，避免在事件冒泡中修改菜单树。
    queueMicrotask(remove);
    return true;
};

/** 处理独立菜单的悬停/点击事件，并通过端口生命周期关闭菜单。 */
const handleStandaloneMenuEvent = (menuElement: HTMLElement, event: Event, remove: () => void) => {
    if (isMobileMenu() && handleStandaloneMobileMenuEvent(menuElement, event, remove)) {
        return;
    }
    const target = getEventElement(event);
    const item = getClosestMenuItem(target);
    if (!item || item.classList.contains("b3-menu__item--readonly")) {
        return;
    }
    const subMenu = item.querySelector<HTMLElement>(":scope > .b3-menu__submenu");
    // 移入新的根菜单项时关闭不相关的旧子菜单，保留当前菜单分支。
    for (const shown of menuElement.querySelectorAll<HTMLElement>(".b3-menu__item--show")) {
        // 保留当前菜单项及其祖先/后代分支，避免悬停多级菜单时闪退。
        if (shown !== item && !shown.contains(item) && !item.contains(shown)) {
            shown.classList.remove("b3-menu__item--show");
        }
    }
    for (const current of menuElement.querySelectorAll(".b3-menu__item--current")) {
        current.classList.remove("b3-menu__item--current");
    }
    item.classList.add("b3-menu__item--current");
    if (!subMenu) {
        return;
    }
    item.classList.add("b3-menu__item--show");
    // 全屏菜单由 CSS 负责横向切换，桌面浮动菜单才需要设置视口坐标。
    if (!menuElement.classList.contains("b3-menu--fullscreen")) {
        positionStandaloneSubMenu(subMenu);
    }
};

/** 复用完整菜单的事件协议，使桌面悬停、移动端点击和多级菜单行为一致。 */
const bindMenuEvents = (element: HTMLElement, remove: () => void) => {
    if (element.dataset.protyleMenuEventsBound === "true") {
        return;
    }
    element.dataset.protyleMenuEventsBound = "true";
    element.addEventListener(isMobileMenu() ? "click" : "mouseover", event => {
        handleStandaloneMenuEvent(element, event, remove);
    });
    /** 处理独立菜单外部点击，保持与完整 App 的全局菜单关闭语义一致。 */
    // @柯里化 处理器必须捕获当前菜单元素和关闭能力，供文档级事件回调使用。
    const handleOutsideClick = (event: MouseEvent) => {
        // 隐藏状态下不触发宿主清理，避免无关页面点击重复重置菜单会话。
        if (element.classList.contains("fn__none")) {
            return;
        }
        const target = event.target;
        // 仅点击菜单外部时关闭，菜单内部交互和宿主声明的菜单触发器保持不变。
        if (target instanceof Element && !element.contains(target) && !target.closest('[data-menu="true"]')) {
            remove();
        }
    };
    document.addEventListener("click", handleOutsideClick);
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
            positionStandaloneSubMenu(subMenuElement);
        },
    };
    bindMenuEvents(element, () => menu.remove());
    return menu;
};
