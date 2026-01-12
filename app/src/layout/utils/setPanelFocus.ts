import { setTitle } from "../../dialog/processSystem";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { saveLayout } from "../util";
import { removeAllClass } from "../../util/DOM/removeAllClass";
/**
 * 设置窗口为激活状态
 *
 * 作用：将指定的窗口元素标记为激活状态，并更新其激活时间戳
 *
 * 意图：当用户切换到某个窗口时，需要将该窗口标记为激活状态，以便：
 *       1. 在 UI 上显示当前激活的窗口（通过 CSS 类名）
 *       2. 记录窗口的激活时间，用于后续的窗口管理逻辑（如最近使用窗口排序）
 *       3. 可选地保存布局状态，以便下次打开时恢复
 *
 * 调用时机：在 setPanelFocus 函数中，当检测到元素类型为 "wnd" 时调用
 *
 * @param element - 需要设置为激活状态的窗口 DOM 元素
 * @param isSaveLayout - 是否保存布局状态，默认为 true
 *
 * 问题/改进：当前实现直接操作 DOM，如果频繁调用可能影响性能。
 *           可以考虑使用防抖或节流来优化布局保存操作。
 */
const setWndActive = (element: Element, isSaveLayout: boolean) => {
    element.classList.add("layout__wnd--active");
    const focusItem = element.querySelector(".layout-tab-bar .item--focus");
    focusItem?.setAttribute("data-activetime", (new Date()).getTime().toString());
    if (isSaveLayout) {
        saveLayout();
    }
};

const updateWndTitle = (element: Element) => {
    if (element.getAttribute("data-type") !== "wnd") {
        return;
    }
    const focusedHeader = element.querySelector('.layout-tab-bar .item--focus[data-type="tab-header"] .item__text');
    if (focusedHeader) {
        setTitle(focusedHeader.textContent || siyuanI18n.siyuanNote);
    }
};

export const setPanelFocus = (element: Element, isSaveLayout = true) => {
    updateWndTitle(element);
    if (isTabElementActive(element) || isWndElementActive(element)) {
        return;
    }
    setAllTabElementDeactive();
    setAllDockElementDeactive();
    setAllWndElementDeactive();
    if (element.getAttribute("data-type") === "wnd") {
        setWndActive(element, isSaveLayout);
        return;
    }

    element.classList.add("layout__tab--active");
    const type = Array.from(element.classList).find(item => item.startsWith("sy__"));
    if (type) {
        const dockItem = document.querySelector(`.dock__item[data-type="${type.substring(4)}"]`);
        dockItem?.classList.add("dock__item--activefocus");
    }
};



/**
 * 检查是否是激活的tab元素
 */
const isTabElementActive = (element: Element) => {
    return element.classList.contains("layout__tab--active");
};

/**
 * 检查是否是激活的wnd元素
 */
const isWndElementActive = (element: Element) => {
    return element.classList.contains("layout__wnd--active");
};
/**
 * 设置所有 tab 为未激活状态
 */
const setAllTabElementDeactive = () => {
    removeAllClass("layout__tab--active", document);
};

/**
 * 设置所有dock 为未激活状态
 */
const setAllDockElementDeactive = () => {
    removeAllClass("dock__item--activefocus", document);
};

/**
 * 设置所有 wnd 为未激活状态
 */
const setAllWndElementDeactive = () => {
    removeAllClass("layout__wnd--active", document);
};
