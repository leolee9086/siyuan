import { setTitle } from "../../util/processTitle";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import {saveLayout} from "../persistence/saveLayout";
import { removeAllClass } from "../../util/DOM/helpers/removeAllClass";
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

/**
 * 更新窗口标题
 *
 * 作用：根据当前窗口中激活的标签页内容，更新浏览器/应用窗口的标题
 *
 * 意图：当用户切换窗口或标签页时，需要同步更新窗口标题以反映当前内容，
 *       这样用户可以在任务栏或标签页中快速识别当前打开的内容。
 *       如果没有找到激活的标签页或标签页文本为空，则使用默认的思源笔记标题。
 *
 * 调用时机：在 setPanelFocus 函数中被调用，每次设置面板焦点时都会尝试更新窗口标题
 *
 * @param element - 需要更新标题的窗口 DOM 元素
 *
 * 问题/改进：当前实现仅处理 "wnd" 类型的元素，如果传入其他类型会直接返回。
 *           可以考虑添加类型检查或断言来提高代码健壮性。
 *           另外，如果频繁调用可能导致不必要的 DOM 查询，可以考虑缓存结果。
 */
const updateWndTitle = (element: Element) => {
    if (element.getAttribute("data-type") !== "wnd") {
        return;
    }
    // S-forge: 上游改进 - 支持设置空文档标题 (#17110)
    const title = element.querySelector('.layout-tab-bar .item--focus[data-type="tab-header"] .item__text')?.textContent || "";
    setTitle(title, title ? false : true);
};

/**
 * 设置面板焦点
 *
 * 作用：将指定的面板元素设置为当前激活状态，并更新相关的 UI 状态
 *
 * 意图：这是思源笔记布局系统的核心函数，用于管理用户界面的焦点状态。
 *       当用户点击或切换到某个面板时，需要：
 *       1. 更新窗口标题以反映当前内容
 *       2. 清除所有其他面板的激活状态
 *       3. 根据面板类型（窗口或标签页）设置相应的激活状态
 *       4. 对于标签页，还需要同步更新 dock 栏的激活状态
 *       5. 可选地保存布局状态以便恢复
 *
 * 调用时机：在用户点击面板、切换标签页、或通过 API 触发面板切换时调用
 *
 * @param element - 需要设置焦点的面板 DOM 元素
 * @param isSaveLayout - 是否保存布局状态，默认为 true
 *
 * 问题/改进：当前实现每次都会清除所有面板的激活状态，这在频繁切换时可能影响性能。
 *           可以考虑优化为只清除当前激活的面板状态。
 *           另外，Array.from(element.classList).find() 的实现可以优化为更高效的方式。
 */
export const setPanelFocus = (element: Element, isSaveLayout = true) => {
    updateWndTitle(element);
    if (element.classList.contains("layout__tab--active") || element.classList.contains("layout__wnd--active")) {
        return;
    }
    removeAllClass("layout__tab--active", document);
    removeAllClass("dock__item--activefocus", document);
    removeAllClass("layout__wnd--active", document);
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
