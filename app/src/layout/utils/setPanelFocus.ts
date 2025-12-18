import { setTitle } from "../../dialog/processSystem";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { saveLayout } from "../util";
import { removeAllClass } from "../../util/DOM/removeAllClass";
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
