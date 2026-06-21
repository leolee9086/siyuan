import { isWindow } from "../util/platform/functions";
import { Wnd } from "../layout/Wnd";
import { getAllTabs, getAllWnds } from "../layout/getAll";
import { Editor } from "../editor";
import { Asset } from "../asset";
import { Constants } from "../constants";
import { setLocationHash, getWindowInnerWidth } from "../util/siyuanEnvironments/windowLocation.environment";
import { getSiyuanLayout, getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { Tab } from "../layout/Tab";

/**
 * 用途：提供 Electron 样式类型守卫，用于判断 CSSStyleDeclaration 是否支持 WebkitAppRegion
 * 使用范围：setHeader 模块中需要设置窗口拖拽区域的逻辑
 * 解耦评估：依赖 Electron 平台特定类型，桌面端无法解耦
 */
import { isElectronStyle } from "./init.guard";

/**
 * 用途：提供 HTML 元素类型守卫，用于运行时判断元素类型
 * 使用范围：setHeader 模块中需要进行元素类型检查的逻辑
 * 解耦评估：依赖 DOM 工具函数，当前无法解耦
 */
import { isHTMLElement } from "./imports";

type THorizontalRect = Pick<DOMRect, "left" | "right">;

interface ITabPositionContext {
    centerRect?: DOMRect;
    isWindowMode: boolean;
    onlyPadding: boolean;
    toolbarDragElement: HTMLElement | null;
    toolbarDragRect: THorizontalRect;
}

/** 处理单个窗口的标签页位置设置 */
const processWndForTabPosition = (item: Wnd, context: ITabPositionContext) => {
    const { centerRect, isWindowMode, onlyPadding, toolbarDragElement, toolbarDragRect } = context;
    const headerElement = item.headersElement.parentElement;
    if (!headerElement) {
        return;
    }
    if (headerElement.classList.contains("fn__none")) {
        headerElement.classList.remove("fn__none");
    }
    const rect = headerElement.getBoundingClientRect();
    headerElement.style.paddingLeft = "";
    item.headersElement.style.paddingLeft = "";
    const headersLastElement = headerElement.lastElementChild;
    if (!isHTMLElement(headersLastElement)) {
        return;
    }
    headersLastElement.style.marginRight = "";
    headersLastElement.style.paddingRight = "";
    headerElement.style.visibility = "";
    const isDarwin = "darwin" === getSiyuanConfig().system.os;
    // S-forge: 上游改进 (#16811) - 使用CSS类名判断全屏状态，替代异步IPC调用
    const isFullScreen = document.body.classList.contains("body--fullscreen");

    if (rect.top <= 0) {
        if (isWindowMode) {
            if (isDarwin && rect.left <= 0 && !isFullScreen) {
                item.headersElement.style.paddingLeft = "var(--b3-toolbar-left-mac)";
            }
            const isWindowRightEdge = rect.right + 8 >= getWindowInnerWidth();
            if (isWindowRightEdge) {
                headersLastElement.style.paddingRight = (42 * (isDarwin ? 1 : 4)) + "px";
            } else if (isDarwin && rect.left <= 0 && !isFullScreen) {
                headersLastElement.style.paddingRight = "42px";
            }
        } else if (centerRect && toolbarDragElement) {
            if (rect.left > toolbarDragRect.left && rect.left === centerRect.left) {
                toolbarDragElement.style.setProperty("--b3-toolbar-drag-left", rect.left - toolbarDragRect.left + "px");
            } else if (rect.left < toolbarDragRect.left) {
                headerElement.style.paddingLeft = (toolbarDragRect.left - rect.left) + "px";
            }

            if (rect.right < toolbarDragRect.right && rect.right === centerRect.right) {
                toolbarDragElement.style.setProperty("--b3-toolbar-drag-right", toolbarDragRect.right - rect.right + "px");
            } else if (rect.right > toolbarDragRect.right) {
                if (rect.right - toolbarDragRect.right + 64 > rect.width) {
                    headerElement.style.visibility = "hidden";
                } else {
                    headersLastElement.style.marginRight = (rect.right - toolbarDragRect.right) + "px";
                }
            }
        }
    }

    if (onlyPadding) {
        return;
    }

    item.element.classList.remove("layout__wnd--right", "layout__wnd--left", "layout__wnd--center");
    const tabContainer = item.element.querySelector<HTMLElement>(".layout-tab-container");
    if (tabContainer) {
        tabContainer.style.backgroundColor = "";
    }
    const dragElement = headerElement.querySelector<HTMLElement>(".item--readonly .fn__flex-1");
    if (!dragElement) {
        return;
    }
    const readonlyBarElement = dragElement.parentElement?.parentElement;
    if (!isHTMLElement(readonlyBarElement)) {
        return;
    }
    const dragStyle = dragElement.style;
    if (rect.top <= 0) {
        item.element.classList.add("layout__wnd--center");
        if (!isWindowMode && centerRect) {
            if (rect.left - 1 <= centerRect.left) {
                item.element.classList.add("layout__wnd--left");
            }
            if (rect.right + 1 >= centerRect.right) {
                item.element.classList.add("layout__wnd--right");
            }
        }
        readonlyBarElement.style.minWidth = "56px";
        dragElement.style.height = (dragElement.parentElement?.clientHeight ?? 0) + "px";
        if (isElectronStyle(dragStyle)) {
            dragStyle.WebkitAppRegion = "drag";
        }
        return;
    }
    readonlyBarElement.style.minWidth = "";
    dragElement.style.height = "";
    if (isElectronStyle(dragStyle)) {
        dragStyle.WebkitAppRegion = "";
    }
};

/**
 * 设置独立窗口中标签页头部的位置和样式
 *
 * @description
 * 作用：根据窗口位置动态调整标签页头部的拖拽区域和内边距，
 *       确保不与系统窗口控制按钮（关闭/最小化/最大化）重叠
 *
 * 意图：Electron 独立窗口需要自定义标题栏，当标签页头部贴近窗口边缘时，
 *       需要为系统按钮预留空间，同时设置可拖拽区域以支持窗口拖动
 *
 * 调用时机：
 * - 窗口初始化时（onGetConfig）
 * - 布局变化时（layout/util.ts）
 * - 标签页切换/关闭/移动时（Wnd.ts）
 * - 窗口大小改变时
 *
 * @同步豁免: 遗留代码 - 此函数被多处同步调用，上游改进(#16811)将全屏状态判断
 *           从异步IPC调用改为同步CSS类名读取，无需异步
 */
export const setTabPosition = (onlyPadding = false) => {
    const isWindowMode = isWindow();
    if (!isWindowMode && !getSiyuanConfig().appearance.hideToolbar) {
        return;
    }
    const siyuanLayout = getSiyuanLayout();
    const layout = isWindowMode ? siyuanLayout.layout : siyuanLayout.centerLayout;
    if (!layout) {
        return;
    }
    const wndsTemp: Wnd[] = [];
    getAllWnds(layout, wndsTemp);
    if (wndsTemp.length === 0) {
        return;
    }
    const toolbarDragElement = document.getElementById("drag");
    const toolbarDragRect = toolbarDragElement?.getBoundingClientRect() || { left: 0, right: 0 };
    if (toolbarDragElement) {
        toolbarDragElement.style.removeProperty("--b3-toolbar-drag-left");
        toolbarDragElement.style.removeProperty("--b3-toolbar-drag-right");
    }
    const context: ITabPositionContext = {
        centerRect: layout.element?.getBoundingClientRect(),
        isWindowMode,
        onlyPadding,
        toolbarDragElement,
        toolbarDragRect,
    };

    for (const item of wndsTemp) {
        processWndForTabPosition(item, context);
    }
};


/** 从 tab 的 data-initdata 属性中提取 hash（如果是 Editor 类型） */
const getHashFromInitData = (headElement: HTMLElement) => {
    const initTab = headElement.getAttribute("data-initdata");
    if (!initTab) {
        return "";
    }
    const initTabData = JSON.parse(initTab);
    if (initTabData.instance !== "Editor") {
        return "";
    }
    return initTabData.rootId + Constants.ZWSP;
};

/** 处理单个 tab 并返回对应的 hash 值 */
const processTabForHash = (tab: Tab) => {
    // 卫语句：处理 tab.model 不存在的情况
    if (!tab.model) {
        return getHashFromInitData(tab.headElement);
    }
    // 卫语句：处理 Editor 类型
    if (tab.model instanceof Editor) {
        return tab.model.editor.protyle.block.rootID + Constants.ZWSP;
    }
    // 卫语句：处理 Asset 类型
    if (tab.model instanceof Asset) {
        return tab.model.path + Constants.ZWSP;
    }
    // 其他类型返回空字符串
    return "";
};

/**
 * 将当前所有标签页的模型信息同步到 URL hash
 *
 * @description
 * 作用：遍历所有标签页，收集 Editor 和 Asset 类型的标识信息，
 *       拼接成 hash 字符串并设置到 window.location.hash
 *
 * 意图：用于独立窗口状态持久化，使窗口刷新后能恢复之前打开的文档
 *
 * 调用时机：
 * - 标签页切换时（Wnd.ts showHeading）
 * - 标签页关闭时（Wnd.ts removeTab）
 * - 编辑器初始化完成时（editor/index.ts）
 *
 * @同步豁免: 遗留代码 - 此函数被多处同步调用，改为异步需要修改所有调用点，
 *           且函数内部仅进行 DOM 属性读取和 hash 设置，无异步操作需求
 */
export const setModelsHash = () => {
    if (!isWindow()) {
        return;
    }
    let hash = "";
    const tabs = getAllTabs();
    for (const tab of tabs) {
        hash += processTabForHash(tab);
    }
    setLocationHash(hash);
};
