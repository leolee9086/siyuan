/** 用途：页签类型。使用范围：打开页签操作。解耦评估：通过 ./imports 转发。 */
import { Tab } from "./imports";
/** 用途：编辑器实例类型。使用范围：页签模型类型判断。解耦评估：同目录模块直接导入。 */
import { Editor } from "./index";
/** 用途：窗口类。使用范围：获取目标窗口。解耦评估：通过 ./imports 转发。 */
import { Wnd } from "./imports";
/** 用途：获取窗口实例、布局查询和 PDF 加载状态。使用范围：editor 页签切换操作。解耦评估：通过 ./imports 转发。 */
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
/** 用途：布局容器类。使用范围：判断窗口父级布局方向。解耦评估：通过 ./imports 转发。 */
import { Layout } from "./imports";
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

/**  设置 keep-cursor 属性 */
const setKeepCursorAttr = (element: HTMLElement, id?: string) => {
    if (id) {
        element.setAttribute("keep-cursor", id);
    }
};

/**  准备 UI 环境 */
const prepareUI = (options: IOpenFileOptions) => {
    // 默认移除当前页签
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

    // PDF 加载中时跳过页签切换
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
    // PDF 加载中时跳过页签操作
    if (pdfIsLoading(wnd.element)) {
        options.afterOpen?.();
        return;
    }
    const firstChild = wnd.children[0];
    // keepCursor 模式：保留光标位置打开新页签
    if (options.keepCursor && firstChild && firstChild.headElement) {
        createdTab = newTab(options);
        setKeepCursorAttr(createdTab.headElement, options.id);
        wnd.addTab(createdTab, options.keepCursor);
        wnd.showHeading();
        options.afterOpen?.(createdTab.model);
        return createdTab;
    }

    // 配置为不使用当前页签时，直接新建页签添加
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
    // 存在未更新的旧页签且配置为移除时，清理旧页签
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

