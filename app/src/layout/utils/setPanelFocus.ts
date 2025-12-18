import { setTitle } from "../../dialog/processSystem";
import { saveLayout, removeAllClass } from "../util";




const setWndActive = (element: Element, isSaveLayout: boolean) => {
    element.classList.add("layout__wnd--active");
    const focusItem = element.querySelector(".layout-tab-bar .item--focus");
    focusItem?.setAttribute("data-activetime", (new Date()).getTime().toString());
    if (isSaveLayout) {
        saveLayout();
    }
};

export const setPanelFocus = (element: Element, isSaveLayout = true) => {
    if (element.getAttribute("data-type") === "wnd") {
        setTitle(element.querySelector('.layout-tab-bar .item--focus[data-type="tab-header"] .item__text')?.textContent || window.siyuan.languages.siyuanNote);
    }
    if (element.classList.contains("layout__tab--active") || element.classList.contains("layout__wnd--active")) {
        return;
    }
    removeAllClass("layout__tab--active");
    removeAllClass("dock__item--activefocus");
    removeAllClass("layout__wnd--active");
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
