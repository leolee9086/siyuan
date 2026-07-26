/** 用途：页签类型。使用范围：打开页签操作。解耦评估：通过 ./imports 转发。 */
import type {LayoutTab} from "./imports";
/** 用途：Editor 完整领域守卫。使用范围：复用分屏页签时不加载具体 class。 */
import {isEditorDomain} from "./model/editorDomain.types";
/** 用途：布局窗口完整领域根。使用范围：获取目标窗口。解耦评估：不加载具体 Wnd class。 */
import type {LayoutWindow} from "./imports";
/** 用途：布局容器与窗口守卫。使用范围：遍历布局树并收窄实例查询结果。解耦评估：只依赖完整领域根。 */
import {isLayoutDomain, isLayoutWindow} from "./imports";
/** 用途：获取窗口实例。使用范围：editor 页签切换操作。解耦评估：通过 ./imports 转发。 */
import { getInstanceById } from "./imports";
/** 用途：通过布局获取窗口实例。使用范围：获取中心布局对应窗口。解耦评估：通过 ./imports 转发。 */
import { getWndByLayout } from "./imports";
/** 用途：检查 PDF 是否加载中。使用范围：切换页签前等待。解耦评估：通过 ./imports 转发。 */
import { pdfIsLoading } from "./imports";
/** 用途：获取所有模型。使用范围：遍历查找匹配页签。解耦评估：通过 ./imports 转发。 */
import { getAllModels } from "./imports";
/** 用途：系统常量。使用范围：Electron IPC 命令。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
/** 用途：判断 Electron 环境。使用范围：仅在桌面端执行 IPC。解耦评估：通过 ./imports 转发。 */
import { isElectron } from "./imports";
/** 用途：Electron IPC 调用。使用范围：向主进程发送打开文件请求。解耦评估：通过 ./imports 转发。 */
import { ipcInvoke } from "./imports";
/** 用途：获取未初始化的页签。使用范围：页签未初始化时触发生成。解耦评估：同目录模块直接导入。 */
import { getUnInitTab } from "./util.getUnInitTab";
/** 用途：切换到指定编辑器。使用范围：查找到编辑器后切换焦点。解耦评估：同目录模块直接导入。 */
import { switchEditor } from "./util.switchEditor";
/** 用途：创建新页签。使用范围：打开文件时创建新页签。解耦评估：通过 ./imports 转发。 */
import { newTab } from "./imports";
/** 用途：安全获取配置（不抛异常）。使用范围：读取文件树配置和布局。解耦评估：通过 ./imports 转发。 */
import { getSafeSiyuanConfig } from "./imports";
/** 用途：安全获取布局配置。使用范围：获取中心布局。解耦评估：通过 ./imports 转发。 */
import { getSafeSiyuanLayout } from "./imports";
/** 用途：查找并打开资源文件。使用范围：遍历模型查找匹配项。解耦评估：同目录模块直接导入。 */
import { findAndOpenAsset } from "./util.find";
/** 用途：查找并打开自定义页签。使用范围：遍历自定义模型查找匹配项。解耦评估：同目录模块直接导入。 */
import { findAndOpenCustom } from "./util.find";
/** 用途：查找并打开编辑器。使用范围：遍历编辑器模型查找匹配项。解耦评估：同目录模块直接导入。 */
import { findAndOpenEditor } from "./util.find";
/** 用途：查找并打开搜索页签。使用范围：遍历搜索模型查找匹配项。解耦评估：同目录模块直接导入。 */
import { findAndOpenSearch } from "./util.find";

/** 设置 keep-cursor 属性 */
const setKeepCursorAttr = (element: HTMLElement, id?: string) => {
    if (id) {
        element.setAttribute("keep-cursor", id);
    }
};

/** 准备 UI 环境 */
const prepareUI = (options: IOpenFileOptions) => {
    // 未指定时沿用历史行为：新页签创建后替换当前可复用页签。
    if (typeof options.removeCurrentTab === "undefined") {
        options.removeCurrentTab = true;
    }
    // https://github.com/siyuan-note/siyuan/issues/10168
    const avPanelsAndMasks = document.querySelectorAll(".av__panel, .av__mask");
    for (const item of avPanelsAndMasks) {
        item.remove();
    }
    // 打开 PDF 时移除文档光标。
    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }
};

/** 在 Electron 中打开 */
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
        // IPC 只传递可序列化的打开参数，不复制应用实例与回调。
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

/** 获取目标窗口 */
const getTargetWnd = (options: IOpenFileOptions, wnd: LayoutWindow) => {
    const direction = options.position === "right" ? "lr" : "tb";
    let targetWnd: LayoutWindow | undefined;
    if (!(isLayoutDomain(wnd.parent) && wnd.parent.children.length > 1 && wnd.parent.direction === direction)) {
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
            nextWnd = wnd;
        }
        while (isLayoutDomain(nextWnd)) {
            nextWnd = nextWnd.children?.[0];
        }
        targetWnd = isLayoutWindow(nextWnd) ? nextWnd : undefined;
        break;
    }
    return targetWnd;
};

/** 在目标分屏中查找可复用的编辑器或未初始化页签。 */
const findReusableSplitTab = (options: IOpenFileOptions, targetWnd: LayoutWindow, allModels: ReturnType<typeof getAllModels>) => {
    const children = targetWnd.children || [];
    for (const item of children) {
        if (!item.model || !isEditorDomain(item.model) || item.model.editor.protyle.block.rootID !== options.rootID) {
            continue;
        }
        void switchEditor(item.model, options, allModels);
        return item;
    }
    return getUnInitTab(options) || undefined;
};

/** 打开分屏页签 */
const openSplitTab = (options: IOpenFileOptions, wnd: LayoutWindow, allModels: ReturnType<typeof getAllModels>) => {
    const direction = options.position === "right" ? "lr" : "tb";
    const targetWnd = getTargetWnd(options, wnd);
    if (!targetWnd) {
        const createdTab = newTab(options);
        wnd.split(direction).addTab(createdTab);
        wnd.showHeading();
        options.afterOpen?.(createdTab ? createdTab.model : undefined);
        return createdTab;
    }

    // PDF 正在加载时保持目标窗口不变，避免切换破坏加载状态。
    if (pdfIsLoading(targetWnd.element)) {
        options.afterOpen?.();
        return;
    }
    let createdTab = options.openNewTab ? undefined : findReusableSplitTab(options, targetWnd, allModels);

    if (!createdTab) {
        createdTab = newTab(options);
        targetWnd.addTab(createdTab);
    }
    wnd.showHeading();
    options.afterOpen?.(createdTab ? createdTab.model : undefined);
    return createdTab;
};

/** 在窗口中打开页签 */
const openTabInWindow = (options: IOpenFileOptions, wnd: LayoutWindow) => {
    let createdTab: LayoutTab;
    // PDF 正在加载时保持当前窗口不变，避免切换破坏加载状态。
    if (pdfIsLoading(wnd.element)) {
        options.afterOpen?.();
        return;
    }
    const firstChild = wnd.children[0];
    // keepCursor 请求必须创建页签并记录恢复光标所需的块 ID。
    if (options.keepCursor && firstChild && firstChild.headElement) {
        createdTab = newTab(options);
        setKeepCursorAttr(createdTab.headElement, options.id);
        wnd.addTab(createdTab, options.keepCursor);
        wnd.showHeading();
        options.afterOpen?.(createdTab.model);
        return createdTab;
    }

    // 未启用当前页签复用时直接追加新页签。
    if (!getSafeSiyuanConfig()?.fileTree?.openFilesUseCurrentTab) {
        createdTab = newTab(options);
        wnd.addTab(createdTab);
        wnd.showHeading();
        options.afterOpen?.(createdTab.model);
        return createdTab;
    }

    let unUpdateTab: LayoutTab | undefined;
    for (const item of wnd.children) {
        const isTarget = item.headElement && item.headElement.classList.contains("item--unupdate") && !item.headElement.classList.contains("item--pin");
        if (isTarget) {
            unUpdateTab = item;
        }
        if (isTarget && item.headElement?.classList.contains("item--focus")) {
            break;
        }
    }
    createdTab = newTab(options);
    wnd.addTab(createdTab);
    // 仅在调用方允许时移除已被新页签替代的临时页签。
    if (unUpdateTab && options.removeCurrentTab) {
        wnd.removeTab(unUpdateTab.id, false, false);
    }
    wnd.showHeading();
    options.afterOpen?.(createdTab.model);
    return createdTab;
};

/** 获取用于打开新页签的目标窗口 */
const getActiveOrCenterWnd = () => {
    let wnd: LayoutWindow | undefined;
    const activeWndElement = document.querySelector(".layout__wnd--active");
    if (activeWndElement) {
        const instance = getInstanceById(activeWndElement.getAttribute("data-id") || "");
        wnd = isLayoutWindow(instance) ? instance : undefined;
    }

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
    if ((options.position === "right" || options.position === "bottom") && firstChild?.headElement) {
        return openSplitTab(options, wnd, allModels);
    }
    return openTabInWindow(options, wnd);
};
