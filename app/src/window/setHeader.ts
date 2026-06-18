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

/** 处理单个窗口的标签页位置设置 */
const processWndForTabPosition = (item: Wnd, onlyPadding = false) => {
    const headerElement = item.headersElement.parentElement;
    if (!headerElement) {
        return;
    }
    const rect = headerElement.getBoundingClientRect();

    if (!onlyPadding) {
        const dragElement = headerElement.querySelector<HTMLElement>(".item--readonly .fn__flex-1");
        if (dragElement) {
            const dragStyle = dragElement.style;
            if (isElectronStyle(dragStyle)) {
                dragStyle.WebkitAppRegion = "";
            }
            if (rect.top <= 0 && isElectronStyle(dragStyle)) {
                dragElement.style.height = (dragElement.parentElement?.clientHeight ?? 0) + "px";
                dragStyle.WebkitAppRegion = "drag";
            }
        }
    }
    const headersLastElement = headerElement.lastElementChild;
    if (!isHTMLElement(headersLastElement)) {
        return;
    }
    const isDarwin = "darwin" === getSiyuanConfig().system.os;

    // darwin 系统专用：处理左侧 padding
    // 先设置默认值
    item.headersElement.style.paddingLeft = "";
    // 再根据条件覆盖
    // S-forge: 上游改进 (#16811) - 使用CSS类名判断全屏状态，替代异步IPC调用
    const isFullScreen = document.body.classList.contains("body--fullscreen");
    // macOS 非全屏模式下，窗口贴近左上角时需要为系统红绿灯按钮预留空间
    if (isDarwin && rect.top <= 0 && rect.left <= 0 && !isFullScreen) {
        // 用 paddingLeft 为左侧红绿灯按钮预留空间
        item.headersElement.style.paddingLeft = "var(--b3-toolbar-left-mac)";
    }

    // 所有系统：处理右侧 padding
    // 显示器缩放后像素存在小数点偏差 https://github.com/siyuan-note/siyuan/issues/7355
    // 先设置默认值
    headersLastElement.style.paddingRight = "";
    // 再根据条件覆盖
    const isWindowRightEdge = rect.top <= 0 && rect.right + 8 >= getWindowInnerWidth();
    const needsDarwinLeftPadding = isDarwin && rect.top <= 0 && rect.left <= 0 && !isFullScreen;
    // 窗口贴近右边缘时，为系统窗口控制按钮预留空间（macOS 1个按钮宽度，其他系统 4个按钮宽度）
    if (isWindowRightEdge) {
        headersLastElement.style.paddingRight = (42 * (isDarwin ? 1 : 4)) + "px";
    }
    // macOS 特殊情况：窗口贴近左上角但不贴近右边缘时，仍需为右侧预留少量空间保持视觉平衡
    if (!isWindowRightEdge && needsDarwinLeftPadding) {
        headersLastElement.style.paddingRight = "42px";
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
    if (!isWindow()) {
        return;
    }
    const layout = getSiyuanLayout().layout;
    if (!layout) {
        return;
    }
    const wndsTemp: Wnd[] = [];
    getAllWnds(layout, wndsTemp);

    for (const item of wndsTemp) {
        processWndForTabPosition(item, onlyPadding);
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
