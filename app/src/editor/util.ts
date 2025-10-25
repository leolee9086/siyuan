import {Tab} from "../layout/Tab";
import {Editor} from "./index";
import {Wnd} from "../layout/Wnd";
import {getInstanceById, getWndByLayout, pdfIsLoading} from "../layout/util";
import {getAllModels} from "../layout/getAll";
import {Constants} from "../constants";
import {fetchSyncPost} from "../util/fetch";
/// #if !BROWSER
import {ipcRenderer} from "electron";
/// #endif
import {Layout} from "../layout";
import {
    hasClosestByClassName,
} from "../protyle/util/hasClosest";
import {showMessage} from "../dialog/message";
import {objEquals} from "../util/functions";
import {App} from "../index";
import {clearOBG} from "../layout/dock/util";
import {Model} from "../layout/Model";
import { getUnInitTab } from "./util.getUnInitTab";
import { switchEditor } from "./util.switchEditor";
import { newTab } from "./util.newTab";

export const openFileById = async (options: {
    app: App,
    id: string,
    position?: string,
    mode?: TEditorMode,
    action?: TProtyleAction[]
    keepCursor?: boolean
    zoomIn?: boolean
    removeCurrentTab?: boolean
    openNewTab?: boolean
    afterOpen?: (model: Model) => void
}) => {
    const response = await fetchSyncPost("/api/block/getBlockInfo", {id: options.id});
    if (response.code === -1) {
        return;
    }
    if (response.code === 3) {
        showMessage(response.msg);
        return;
    }

    return openFile({
        app: options.app,
        fileName: response.data.rootTitle,
        rootIcon: response.data.rootIcon,
        rootID: response.data.rootID,
        id: options.id,
        position: options.position,
        mode: options.mode,
        action: options.action,
        zoomIn: options.zoomIn,
        keepCursor: options.keepCursor,
        removeCurrentTab: options.removeCurrentTab,
        afterOpen: options.afterOpen,
        openNewTab: options.openNewTab
    });
};

export const openFile = async (options: IOpenFileOptions) => {
    if (typeof options.removeCurrentTab === "undefined") {
        options.removeCurrentTab = true;
    }
    // https://github.com/siyuan-note/siyuan/issues/10168
    document.querySelectorAll(".av__panel, .av__mask").forEach(item => {
        item.remove();
    });
    // 打开 PDF 时移除文档光标
    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }
    const allModels = getAllModels();
    // 文档已打开
    if (options.assetPath) {
        clearOBG();
        const asset = allModels.asset.find((item) => {
            if (item.path == options.assetPath) {
                if (!pdfIsLoading(item.parent.parent.element)) {
                    item.parent.parent.switchTab(item.parent.headElement);
                    item.parent.parent.showHeading();
                    item.goToPage(options.page);
                }
                return true;
            }
        });
        if (asset) {
            if (options.afterOpen) {
                options.afterOpen(asset);
            }
            return asset.parent;
        }
    } else if (options.custom) {
        clearOBG();
        const custom = allModels.custom.find((item) => {
            if (objEquals(item.data, options.custom.data) && (!options.custom.id || options.custom.id === item.type)) {
                if (!pdfIsLoading(item.parent.parent.element)) {
                    item.parent.parent.switchTab(item.parent.headElement);
                    item.parent.parent.showHeading();
                }
                return true;
            }
        });
        if (custom) {
            if (options.afterOpen) {
                options.afterOpen(custom);
            }
            return custom.parent;
        }
        const hasModel = getUnInitTab(options);
        if (hasModel) {
            if (options.afterOpen) {
                options.afterOpen(hasModel.model);
            }
            return hasModel;
        }
    } else if (options.searchData) {
        clearOBG();
        const search = allModels.search.find((item) => {
            if (objEquals(item.config, options.searchData)) {
                if (!pdfIsLoading(item.parent.parent.element)) {
                    item.parent.parent.switchTab(item.parent.headElement);
                    item.parent.parent.showHeading();
                }
                return true;
            }
        });
        if (search) {
            return search.parent;
        }
    } else if (!options.position && !options.openNewTab) {
        let editor: Editor;
        let activeEditor: Editor;
        allModels.editor.find((item) => {
            if (item.editor.protyle.block.rootID === options.rootID) {
                if (hasClosestByClassName(item.element, "layout__wnd--active")) {
                    activeEditor = item;
                }
                if (!editor || item.headElement.getAttribute("data-activetime") > editor.headElement.getAttribute("data-activetime")) {
                    // https://github.com/siyuan-note/siyuan/issues/11981#issuecomment-2351939812
                    editor = item;
                }
            }
            if (activeEditor) {
                return true;
            }
        });
        if (activeEditor) {
            editor = activeEditor;
        }
        if (editor) {
            if (!pdfIsLoading(editor.parent.parent.element)) {
                switchEditor(editor, options, allModels);
            }
            if (options.afterOpen) {
                options.afterOpen(editor);
            }
            return editor.parent;
        }
        // 没有初始化的页签无法检测到
        const hasEditor = getUnInitTab(options);
        if (hasEditor) {
            if (options.afterOpen) {
                options.afterOpen(hasEditor.model);
            }
            return hasEditor;
        }
    }

    /// #if !BROWSER
    // https://github.com/siyuan-note/siyuan/issues/7491
    if (!options.position || (options.position === "right" && options.assetPath)) {
        let hasMatch = false;
        const optionsClone: IObject = {};
        Object.keys(options).forEach((key: keyof IOpenFileOptions) => {
            if (key !== "app" && options[key] && typeof options[key] !== "function") {
                optionsClone[key] = JSON.parse(JSON.stringify(options[key]));
            }
        });
        hasMatch = await ipcRenderer.invoke(Constants.SIYUAN_GET, {
            cmd: Constants.SIYUAN_OPEN_FILE,
            options: JSON.stringify(optionsClone),
        });
        if (hasMatch) {
            if (options.afterOpen) {
                options.afterOpen();
            }
            return;
        }
    }
    /// #endif

    let wnd: Wnd = undefined;
    // 获取光标所在 tab
    const element = document.querySelector(".layout__wnd--active");
    if (element) {
        wnd = getInstanceById(element.getAttribute("data-id")) as Wnd;
    }
    if (!wnd) {
        // 中心 tab
        wnd = getWndByLayout(window.siyuan.layout.centerLayout);
    }
    if (wnd) {
        let createdTab: Tab;
        if ((options.position === "right" || options.position === "bottom") && wnd.children[0].headElement) {
            const direction = options.position === "right" ? "lr" : "tb";
            let targetWnd: Wnd;
            if (wnd.parent.children.length > 1 && wnd.parent instanceof Layout && wnd.parent.direction === direction) {
                wnd.parent.children.find((item, index) => {
                    if (item.id === wnd.id) {
                        let nextWnd = wnd.parent.children[index + 1];
                        if (!nextWnd) {
                            // wnd 为右侧时，应设置其为目标
                            nextWnd = wnd;
                        }
                        while (nextWnd instanceof Layout) {
                            nextWnd = nextWnd.children[0];
                        }
                        targetWnd = nextWnd;
                        return true;
                    }
                });
            }
            if (targetWnd) {
                if (pdfIsLoading(targetWnd.element)) {
                    if (options.afterOpen) {
                        options.afterOpen();
                    }
                    return;
                }
                // 在右侧/下侧打开已有页签将进行页签切换 https://github.com/siyuan-note/siyuan/issues/5366
                let hasEditor = targetWnd.children.find(item => {
                    if (item.model && item.model instanceof Editor && item.model.editor.protyle.block.rootID === options.rootID) {
                        switchEditor(item.model, options, allModels);
                        return true;
                    }
                });
                if (!hasEditor) {
                    hasEditor = getUnInitTab(options);
                    createdTab = hasEditor;
                }
                if (!hasEditor) {
                    createdTab = newTab(options);
                    targetWnd.addTab(createdTab);
                }
            } else {
                createdTab = newTab(options);
                wnd.split(direction).addTab(createdTab);
            }
            wnd.showHeading();
            if (options.afterOpen) {
                options.afterOpen(createdTab ? createdTab.model : undefined);
            }
            return createdTab;
        }
        if (pdfIsLoading(wnd.element)) {
            if (options.afterOpen) {
                options.afterOpen();
            }
            return;
        }
        if (options.keepCursor && wnd.children[0].headElement) {
            createdTab = newTab(options);
            createdTab.headElement.setAttribute("keep-cursor", options.id);
            wnd.addTab(createdTab, options.keepCursor);
        } else if (window.siyuan.config.fileTree.openFilesUseCurrentTab) {
            let unUpdateTab: Tab;
            // 不能 reverse, 找到也不能提前退出循环，否则 https://github.com/siyuan-note/siyuan/issues/3271
            wnd.children.find((item) => {
                if (item.headElement && item.headElement.classList.contains("item--unupdate") && !item.headElement.classList.contains("item--pin")) {
                    unUpdateTab = item;
                    if (item.headElement.classList.contains("item--focus")) {
                        // https://ld246.com/article/1658979494658
                        return true;
                    }
                }
            });
            createdTab = newTab(options);
            wnd.addTab(createdTab);
            if (unUpdateTab && options.removeCurrentTab) {
                wnd.removeTab(unUpdateTab.id, false, false);
            }
        } else {
            createdTab = newTab(options);
            wnd.addTab(createdTab);
        }
        wnd.showHeading();
        if (options.afterOpen) {
            options.afterOpen(createdTab.model);
        }
        return createdTab;
    }
};


