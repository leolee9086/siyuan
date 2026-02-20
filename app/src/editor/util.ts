import { Tab } from "../layout/Tab";
import { Editor } from "./index";
import { Wnd } from "../layout/Wnd";
import { getInstanceById, getWndByLayout, pdfIsLoading } from "../layout/util";
import { getAllModels } from "../layout/getAll";
import { Constants } from "../constants";
import { isElectron } from "../platform";
import { ipcInvoke } from "../platform/electron/ipcRenderer";
import { Layout } from "../layout";
import { getUnInitTab } from "./util.getUnInitTab";
import { switchEditor } from "./util.switchEditor";
import { newTab } from "../layout/utils/newTab";
import { getSafeSiyuanConfig, getSafeSiyuanLayout } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { findAndOpenAsset, findAndOpenCustom, findAndOpenEditor, findAndOpenSearch } from "./util.find";

/**  设置 keep-cursor 属性 */
const setKeepCursorAttr = (element: HTMLElement, id?: string) => {
    if (id) {
        element.setAttribute("keep-cursor", id);
    }
};

/**  准备 UI 环境 */
const prepareUI = (options: IOpenFileOptions) => {
    if (typeof options.removeCurrentTab === "undefined") {
        options.removeCurrentTab = true;
    }
    // https://github.com/siyuan-note/siyuan/issues/10168
    const avPanelsAndMasks = document.querySelectorAll(".av__panel, .av__mask");
    for (const item of avPanelsAndMasks) {
        item.remove();
    }
    // 打开 PDF 时移除文档光标
    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }
};


/**  在 Electron 中打开 */
const openInElectron = async (options: IOpenFileOptions) => {
    if (!isElectron) {
        return false;
    }
    // https://github.com/siyuan-note/siyuan/issues/7491
    if (options.position && !(options.position === "right" && options.assetPath)) {
        return false;
    }
    const optionsClone: IObject = {};
    for (const [key, value] of Object.entries(options)) {
        // 排除不可序列化的 app 实例和函数类型值
        if (key !== "app" && value && typeof value !== "function") {
            optionsClone[key] = JSON.parse(JSON.stringify(value));
        }
    }
    const hasMatch = await ipcInvoke(Constants.SIYUAN_GET, {
        cmd: Constants.SIYUAN_OPEN_FILE,
        options: JSON.stringify(optionsClone),
    });
    if (hasMatch) {
        options.afterOpen?.();
        return true;
    }
    return false;
};

/**  获取目标窗口 */
const getTargetWnd = (options: IOpenFileOptions, wnd: Wnd) => {
    const direction = options.position === "right" ? "lr" : "tb";
    let targetWnd: Wnd | undefined = undefined;
    if (!(wnd.parent instanceof Layout && wnd.parent.children && wnd.parent.children.length > 1 && wnd.parent.direction === direction)) {
        return targetWnd;
    }
    const children = wnd.parent.children;
    for (let index = 0; index < children.length; index++) {
        const item = children[index];
        if (!item || item.id !== wnd.id) {
            continue;
        }
        let nextWnd = children[index + 1];
        if (!nextWnd) {
            // wnd 为右侧时，应设置其为目标
            nextWnd = wnd;
        }
        while (nextWnd instanceof Layout) {
            nextWnd = nextWnd.children?.[0];
        }
        targetWnd = nextWnd;
        break;
    }
    return targetWnd;
};

/**  打开分屏页签 */
const openSplitTab = (options: IOpenFileOptions, wnd: Wnd, allModels: ReturnType<typeof getAllModels>) => {
    const direction = options.position === "right" ? "lr" : "tb";
    const targetWnd = getTargetWnd(options, wnd);
    if (!targetWnd) {
        const createdTab = newTab(options);
        wnd.split(direction).addTab(createdTab);
        wnd.showHeading();
        options.afterOpen?.(createdTab ? createdTab.model : undefined);
        return createdTab;
    }

    if (pdfIsLoading(targetWnd.element)) {
        options.afterOpen?.();
        return;
    }
    // 在右侧/下侧打开已有页签将进行页签切换 https://github.com/siyuan-note/siyuan/issues/5366
    let createdTab: Tab | undefined;
    const children = targetWnd.children || [];
    for (const item of children) {
        if (!item.model || !(item.model instanceof Editor) || item.model.editor.protyle.block.rootID !== options.rootID) {
            continue;
        }
        switchEditor(item.model, options, allModels);
        createdTab = item;
        break;
    }

    if (!createdTab) {
        createdTab = getUnInitTab(options) || undefined;
    }

    if (!createdTab) {
        createdTab = newTab(options);
        targetWnd.addTab(createdTab);
    }
    wnd.showHeading();
    options.afterOpen?.(createdTab ? createdTab.model : undefined);
    return createdTab;
};

/** 在窗口中打开页签 */
const openTabInWindow = (options: IOpenFileOptions, wnd: Wnd) => {
    let createdTab: Tab;
    if (pdfIsLoading(wnd.element)) {
        options.afterOpen?.();
        return;
    }
    const firstChild = wnd.children[0];
    if (options.keepCursor && firstChild && firstChild.headElement) {
        createdTab = newTab(options);
        setKeepCursorAttr(createdTab.headElement, options.id);
        wnd.addTab(createdTab, options.keepCursor);
        wnd.showHeading();
        options.afterOpen?.(createdTab.model);
        return createdTab;
    }

    if (!getSafeSiyuanConfig()?.fileTree?.openFilesUseCurrentTab) {
        createdTab = newTab(options);
        wnd.addTab(createdTab);
        wnd.showHeading();
        options.afterOpen?.(createdTab.model);
        return createdTab;
    }

    let unUpdateTab: Tab | undefined;
    // 不能 reverse, 找到也不能提前退出循环，否则 https://github.com/siyuan-note/siyuan/issues/3271
    // 解释: 这里原文并没有使用 find 的返回值，而是遍历所有，但 `find` 只要返回 true 就会停止。
    // 根据注释意思 "找到也不能提前退出循环"，原来的 `find` 其实有 bug（如果找到了就退出了，除非没有 return true）。
    // 实际上原来的代码： `if (...) { unUpdateTab = item; if(...) return true; }`
    // 也就是如果 unupdate 且 focus，就停止。否则继续找。
    // 这里改写为 for 循环。
    for (const item of wnd.children) {
        const isTarget = item.headElement && item.headElement.classList.contains("item--unupdate") && !item.headElement.classList.contains("item--pin");
        if (isTarget) {
            unUpdateTab = item;
        }
        if (isTarget && item.headElement && item.headElement.classList.contains("item--focus")) {
            break;
        }
    }
    createdTab = newTab(options);
    wnd.addTab(createdTab);
    if (unUpdateTab && options.removeCurrentTab) {
        wnd.removeTab(unUpdateTab.id, false, false);
    }
    wnd.showHeading();
    options.afterOpen?.(createdTab.model);
    return createdTab;
};

/** 获取用于打开新页签的目标窗口 */
const getActiveOrCenterWnd = () => {
    let wnd: Wnd | undefined;
    // 获取光标所在 tab
    const activeWndElement = document.querySelector(".layout__wnd--active");
    if (activeWndElement) {
        const instance = getInstanceById(activeWndElement.getAttribute("data-id") || "");
        wnd = (instance instanceof Wnd) ? instance : undefined;
    }

    // 中心 tab
    const centerLayout = !wnd ? getSafeSiyuanLayout()?.centerLayout : undefined;
    if (centerLayout) {
        wnd = getWndByLayout(centerLayout);
    }
    return wnd;
};

/** 打开文件（编辑器、资源、自定义页签等） */
export const openFile = async (options: IOpenFileOptions) => {
    prepareUI(options);
    const allModels = getAllModels();
    let tab = findAndOpenAsset(options, allModels);
    if (tab) {
        return tab;
    }
    tab = findAndOpenCustom(options, allModels);
    if (tab) {
        return tab;
    }
    tab = findAndOpenSearch(options, allModels);
    if (tab) {
        return tab;
    }
    tab = findAndOpenEditor(options, allModels);
    if (tab) {
        return tab;
    }

    if (await openInElectron(options)) {
        return;
    }

    const wnd = getActiveOrCenterWnd();
    if (!wnd) {
        return;
    }

    const firstChild = wnd.children[0];
    if ((options.position === "right" || options.position === "bottom") && firstChild && firstChild.headElement) {
        return openSplitTab(options, wnd, allModels);
    }
    return openTabInWindow(options, wnd);
};
