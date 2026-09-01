/** 用途：键码常量映射。使用范围：菜单键盘导航识别方向键/回车。解耦评估：常量稳定，经本地 imports 转发。 */
import { Constants } from "./imports";
/** 用途：全局菜单实例。使用范围：展开子菜单与关闭菜单。解耦评估：环境能力经 imports 转发。 */
import { getSiyuanGlobalMenusMenu } from "./imports";
/** 用途：HTMLInputElement 类型守卫。使用范围：识别菜单内输入框与开关。解耦评估：DOM 守卫经 imports 转发。 */
import { isHTMLInputElement } from "./imports";
/** 用途：获取兼容的点击事件名。使用范围：回车激活菜单项时派发点击。解耦评估：兼容层经 imports 转发。 */
import { getEventName } from "./imports";
/** 用途：Electron 输入框撤销/重做。使用范围：带 data-menu-keymap 的输入控件。解耦评估：平台能力经 imports 转发。 */
import { electronUndo } from "./imports";
/** 用途：按 class 向上查找祖先。使用范围：左键返回父级菜单项。解耦评估：DOM 查找经 imports 转发。 */
import { hasClosestByClassName } from "./imports";
/** 用途：跳过分隔符/只读/零高度项查找可操作菜单项。使用范围：上下键与子菜单首项选中。解耦评估：同目录工具函数，无需解耦。 */
import { getActionMenu } from "./Menu.getActionMenu";
/** 用途：获取菜单根 DOM。使用范围：键盘导航读取菜单容器。解耦评估：同目录工具，无需解耦。 */
import { getMenuElement } from "./Menu.uills";
/** 用途：判断菜单是否隐藏。使用范围：键盘导航入口守卫。解耦评估：同目录工具，无需解耦。 */
import { isMenuElementHidden } from "./Menu.uills";
/** 用途：判断目标是否在菜单内。使用范围：输入控件按键放行。解耦评估：同目录工具，无需解耦。 */
import { isTargetInMenu } from "./Menu.uills";
/** 用途：判断是否可输入菜单项。使用范围：输入控件按键放行。解耦评估：同目录工具，无需解耦。 */
import { isInputAbleMenuItemElement } from "./Menu.uills";
/** 用途：判断是否上下方向键。使用范围：方向键分支分发。解耦评估：同目录工具，无需解耦。 */
import { isEventUpDown } from "./Menu.uills";
/** 用途：移除当前选中样式。使用范围：焦点切换时取消旧项。解耦评估：同目录工具，无需解耦。 */
import { setNotCurrent } from "./Menu.uills";
/** 用途：移除显示样式。使用范围：上下键离开展开项时。解耦评估：同目录工具，无需解耦。 */
import { setNotShow } from "./Menu.uills";
/** 用途：获取当前选中菜单项。使用范围：方向键/回车导航。解耦评估：同目录工具，无需解耦。 */
import { getCurrentMenuItem } from "./Menu.uills";
/** 用途：设置当前选中样式。使用范围：焦点落到新菜单项时。解耦评估：同目录工具，无需解耦。 */
import { setCurrent } from "./Menu.uills";
/** 用途：获取子菜单当前选中项。使用范围：左键返回父级。解耦评估：同目录工具，无需解耦。 */
import { getCurrentSubMenuItem } from "./Menu.uills";
/*
 * 用途：触发懒加载子菜单的自定义事件名
 * 使用范围：键盘导航进入含 loadSubmenu 的菜单项时触发异步加载，与 Menu.Item 中 mouseenter/click 的懒加载保持一致
 * 解耦评估：常量通过同模块 Menu.Item 转发，避免硬编码字符串扩散；可通过事件名注入解耦，但当前为菜单内部契约，直接引用更清晰
 */
import { CUSTOM_EVENT_LOAD_SUBMENU } from "./Menu.Item";

/**
 * 在起点存在时查找可操作菜单项，否则返回 null
 * 意图：避免将 null 直接传入 getActionMenu 触发类型错误
 * 调用时机：上下键导航需要从相邻节点开始查找时
 * @param {Element | null} element - 查找起点
 * @param {boolean} next - 是否向后查找
 * @returns {Element | null} 可操作菜单项
 */
const getActionMenuSafe = (element: Element | null, next: boolean) => {
    if (!element) {
        return null;
    }
    return getActionMenu(element, next);
};

/**
 * 优先从起点查找可操作菜单项，找不到时回退到备用起点
 * 意图：实现菜单项环形导航（到顶/底后从另一端继续）
 * 调用时机：当前菜单项存在时的上下键导航
 * @param {Element | null} startElement - 首选起点（相邻兄弟）
 * @param {Element | null} fallbackElement - 回退起点（父级首/末子节点）
 * @param {boolean} next - 是否向后查找
 * @returns {Element | null} 可操作菜单项
 */
const getActionMenuWithFallback = (
    startElement: Element | null,
    fallbackElement: Element | null,
    next: boolean
) => {
    const fromStart = getActionMenuSafe(startElement, next);
    if (fromStart) {
        return fromStart;
    }
    return getActionMenuSafe(fallbackElement, next);
};

/**
 * 处理已有当前元素时的上下箭头键导航
 * 意图：取消当前高亮后，按方向寻找下一个可操作菜单项，支持环形切换
 * 调用时机：菜单中已有 b3-menu__item--current 且按下上下键
 * @param {Element} currentElement - 当前选中的菜单项元素
 * @param {string} eventCode - 事件代码（"↑" 或 "↓"）
 * @returns {Element | null} 下一个要选中的菜单项元素
 */
const handleUpDownNavigationWithCurrent = (currentElement: Element, eventCode: string) => {
    setNotCurrent(currentElement);
    setNotShow(currentElement);
    const parentElement = currentElement.parentElement;
    if (!parentElement) {
        return null;
    }
    // 向上：从上一兄弟开始，找不到则从父级最后一个子节点回绕
    if (eventCode === "↑") {
        return getActionMenuWithFallback(
            currentElement.previousElementSibling,
            parentElement.lastElementChild,
            false
        );
    }
    return getActionMenuWithFallback(
        currentElement.nextElementSibling,
        parentElement.firstElementChild,
        true
    );
};

/**
 * 无当前选中项时，按上下键确定初始可操作菜单项
 * 意图：首次用键盘进入菜单时聚焦首/末可用项
 * 调用时机：上下键导航且当前无 b3-menu__item--current
 * @param {HTMLElement} menuElement - 菜单根元素
 * @param {string} eventCode - 事件代码（"↑" 或 "↓"）
 * @returns {Element | null} 初始应选中的菜单项
 */
const resolveInitialUpDownMenuItem = (menuElement: HTMLElement, eventCode: string) => {
    const itemsContainer = menuElement.lastElementChild;
    if (!itemsContainer) {
        return null;
    }
    // 向上键从列表末尾开始查找
    if (eventCode === "↑") {
        return getActionMenuSafe(itemsContainer.lastElementChild, false);
    }
    return getActionMenuSafe(itemsContainer.firstElementChild, true);
};

/**
 * 解析上下键应对应选中的菜单项
 * 意图：统一有/无当前项两种导航入口
 * 调用时机：处理上下方向键时
 * @param {HTMLElement} menuElement - 菜单根元素
 * @param {Element | null} currentElement - 当前选中项
 * @param {string} eventCode - 事件代码
 * @returns {Element | null} 目标菜单项
 */
const resolveUpDownActionMenu = (
    menuElement: HTMLElement,
    currentElement: Element | null,
    eventCode: string
) => {
    if (currentElement) {
        return handleUpDownNavigationWithCurrent(currentElement, eventCode);
    }
    return resolveInitialUpDownMenuItem(menuElement, eventCode);
};

/**
 * 处理菜单项的选中状态和滚动
 * 意图：设置当前项高亮、聚焦内部输入框，并在不可见时滚入视口
 * 调用时机：上下键导航成功找到目标项后
 * @param {Element} actionMenuElement - 要选中的菜单项元素
 */
const handleMenuItemSelection = (actionMenuElement: Element) => {
    const keymapInputCandidate = actionMenuElement.querySelector(`[${Constants.ATTRIBUTE_MENU_KEYMAP}]`);
    // 独立输入行没有标准菜单项 class，也需要把所在行标记为当前项。
    if (actionMenuElement.classList.contains("b3-menu__item") || isHTMLInputElement(keymapInputCandidate)) {
        setCurrent(actionMenuElement);
    }
    const inputCandidate = actionMenuElement.querySelector(":scope > .b3-text-field") || keymapInputCandidate;
    // 菜单项内含直接子级输入框时聚焦，便于键盘继续输入
    if (isHTMLInputElement(inputCandidate)) {
        inputCandidate.focus();
    }
    actionMenuElement.classList.remove("b3-menu__item--show");
    const parentElement = actionMenuElement.parentElement;
    if (!parentElement) {
        return;
    }
    const parentRect = parentElement.getBoundingClientRect();
    const actionMenuRect = actionMenuElement.getBoundingClientRect();
    // 目标项超出父容器可视范围时滚入视口
    if (parentRect.top > actionMenuRect.top || parentRect.bottom < actionMenuRect.bottom) {
        actionMenuElement.scrollIntoView(parentRect.top > actionMenuRect.top);
    }
};

/**
 * 打开当前菜单项的子菜单并选中首个可操作项
 * 意图：右箭头/回车进入子菜单时复用同一套展开与选中逻辑
 * 调用时机：当前项存在子菜单且用户请求进入
 * @param {Element} currentElement - 当前菜单项
 * @param {HTMLElement} subMenuElement - 子菜单元素
 */
const openSubMenuFromItem = (currentElement: Element, subMenuElement: HTMLElement) => {
    // 触发懒加载（若该项为 loadSubmenu），键盘场景需带 focus 标记以便加载完成后聚焦首项
    currentElement.dispatchEvent(new CustomEvent(CUSTOM_EVENT_LOAD_SUBMENU, {detail: {focus: true}}));
    setNotCurrent(currentElement);
    currentElement.classList.add("b3-menu__item--show");
    const menu = getSiyuanGlobalMenusMenu();
    const firstItems = subMenuElement.firstElementChild;
    if (!firstItems) {
        menu.showSubMenu(subMenuElement);
        return;
    }
    const firstChild = firstItems.firstElementChild;
    if (!firstChild) {
        menu.showSubMenu(subMenuElement);
        return;
    }
    const actionMenuElement = getActionMenu(firstChild, true);
    if (actionMenuElement) {
        setCurrent(actionMenuElement);
    }
    menu.showSubMenu(subMenuElement);
};

/**
 * 处理右箭头键导航
 * 意图：进入当前项的子菜单并选中首个可操作项
 * 调用时机：按下右箭头键
 * @param {Element | null} currentElement - 当前选中的菜单项元素
 * @returns {boolean} 是否成功处理了右箭头键导航
 */
const handleRightArrowNavigation = (currentElement: Element | null) => {
    if (!currentElement) {
        return true;
    }
    const subMenuElement = currentElement.querySelector(".b3-menu__submenu");
    // 无子菜单时消费事件但不切换焦点
    if (!(subMenuElement instanceof HTMLElement)) {
        return true;
    }
    openSubMenuFromItem(currentElement, subMenuElement);
    return true;
};

/**
 * 处理左箭头键导航
 * 意图：从子菜单返回父级菜单项并恢复其选中态
 * 调用时机：按下左箭头键
 * @param {Element | null} currentElement - 当前选中的子菜单项元素
 * @returns {boolean} 是否成功处理了左箭头键导航
 */
const handleLeftArrowNavigation = (currentElement: Element | null) => {
    if (!currentElement) {
        return true;
    }
    const parentItemElement = hasClosestByClassName(currentElement, "b3-menu__item--show");
    if (!parentItemElement) {
        return true;
    }
    parentItemElement.classList.remove("b3-menu__item--show");
    setCurrent(parentItemElement);
    setNotCurrent(currentElement);
    return true;
};

/**
 * 处理回车键导航
 * 意图：有子菜单则展开；有输入框则聚焦；有开关则切换；否则触发点击并关闭菜单
 * 调用时机：按下回车键
 * @param {Element | null} currentElement - 当前选中的菜单项元素
 * @returns {boolean} 是否成功处理了回车键导航
 */
const handleEnterKeyNavigation = (currentElement: Element | null) => {
    if (!currentElement) {
        return false;
    }

    const subMenuElement = currentElement.querySelector(".b3-menu__submenu");
    // 当前项含子菜单时，回车等同于进入子菜单
    if (subMenuElement instanceof HTMLElement) {
        openSubMenuFromItem(currentElement, subMenuElement);
        return true;
    }

    const textCandidate = currentElement.querySelector(".b3-text-field");
    // 输入型菜单项：回车只聚焦输入框，不关闭菜单
    if (isHTMLInputElement(textCandidate)) {
        textCandidate.focus();
        return true;
    }

    const checkCandidate = currentElement.querySelector(".b3-switch");
    // 开关型菜单项：回车切换开关状态
    if (isHTMLInputElement(checkCandidate)) {
        checkCandidate.click();
    }
    // 非开关菜单项：派发点击事件以执行菜单动作
    if (!isHTMLInputElement(checkCandidate)) {
        currentElement.dispatchEvent(new CustomEvent(getEventName()));
    }

    // 块标上 AI 会使用新的 menu，不能移除
    if (getMenuElement().contains(currentElement)) {
        getSiyuanGlobalMenusMenu().remove();
    }

    return true;
};

/**
 * 处理上下方向键在菜单中的焦点移动
 * 意图：根据当前选中态解析目标项并完成高亮/滚动
 * 调用时机：确认事件为上下键后
 * @param {string} eventCode - 事件代码（"↑" 或 "↓"）
 * @returns {boolean} 始终返回 true 表示已消费该键盘事件
 */
const handleUpDownKey = (eventCode: string) => {
    const menuElement = getMenuElement();
    const currentElement = getCurrentMenuItem();
    const actionMenuElement = resolveUpDownActionMenu(menuElement, currentElement, eventCode);
    if (actionMenuElement) {
        handleMenuItemSelection(actionMenuElement);
    }
    return true;
};

/**
 * 处理带 data-menu-keymap 的菜单输入控件。
 * 意图：保留输入框撤销/重做，并让回车和方向键参与菜单导航。
 * 调用时机：可见菜单收到 keydown 且目标可能是输入控件时。
 */
const handleKeymapInputEvent = (
    event: KeyboardEvent,
    target: Element,
    eventCode: string | undefined,
) => {
    if (!isTargetInMenu(target) || !isInputAbleMenuItemElement(target)) {
        return undefined;
    }
    if (!target.getAttribute(Constants.ATTRIBUTE_MENU_KEYMAP)) {
        return false;
    }
    const currentElement = getCurrentMenuItem();
    const inputItemElement = Array.from(target.closest(".b3-menu__items")?.children || [])
        .find(item => item.contains(target));
    const inputItemIsCurrent = !currentElement || currentElement === inputItemElement;
    // 当前输入行回车表示完成编辑并关闭菜单。
    if (inputItemIsCurrent && eventCode === "↩") {
        getSiyuanGlobalMenusMenu().remove();
        return true;
    }
    if (inputItemIsCurrent && (eventCode === "→" || eventCode === "←")) {
        return false;
    }
    // 首次从输入框进入键盘导航时建立当前项，供后续方向键继续移动。
    if (!currentElement && inputItemElement) {
        setCurrent(inputItemElement);
    }
    electronUndo(event);
    return undefined;
};

/**
 * 绑定菜单键盘导航
 * 意图：在菜单可见且无修饰键时，将方向键/回车映射到菜单焦点与激活行为
 * 调用时机：全局或菜单相关的 keydown 处理链路中
 * @param {KeyboardEvent} event - 键盘事件
 * @returns {boolean | undefined} 已处理返回 true/false；未匹配快捷键时返回 undefined
 * @同步豁免: 需要绝对同步的DOM访问 keydown 同步路径完成焦点切换与事件消费判定，异步会错过 preventDefault 时机
 */
export const bindMenuKeydown = (event: KeyboardEvent) => {
    if (isMenuElementHidden() || event.isComposing) {
        return false;
    }
    const target = event.target;
    /**
     * eventTarget 是 Element 类型，因为还有可能是 svg 之类
     */
    if (!(target instanceof Element)) {
        return false;
    }
    const eventCode = Constants.KEYCODELIST[event.keyCode];
    const inputResult = handleKeymapInputEvent(event, target, eventCode);
    if (typeof inputResult === "boolean") {
        return inputResult;
    }
    if (event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) {
        return false;
    }
    // isEventUpDown 已保证方向为上下键，空值兜底仅满足类型收窄
    if (isEventUpDown(event)) {
        return handleUpDownKey(eventCode || "");
    }
    if (eventCode === "→") {
        return handleRightArrowNavigation(getCurrentMenuItem());
    }
    if (eventCode === "←") {
        return handleLeftArrowNavigation(getCurrentSubMenuItem());
    }
    if (eventCode === "↩") {
        return handleEnterKeyNavigation(getCurrentMenuItem());
    }
};
