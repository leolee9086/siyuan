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


export const isCurrentEditor = (blockId: string) => {
    const activeElement = document.querySelector(".layout__wnd--active > .fn__flex > .layout-tab-bar > .item--focus");
    if (activeElement) {
        const tab = getInstanceById(activeElement.getAttribute("data-id"));
        if (tab instanceof Tab && tab.model instanceof Editor) {
            if (tab.model.editor.protyle.block.rootID === blockId ||
                tab.model.editor.protyle.block.parentID === blockId ||  // updateBacklinkGraph 时会传入 parentID
                tab.model.editor.protyle.block.id === blockId) {
                return true;
            }
        }
    }
    return false;
};

export const updateOutline = (models: IModels, protyle: IProtyle, reload = false) => {
    models.outline.find(item => {
        if (reload ||
            (item.type === "pin" &&
                (!protyle || item.blockId !== protyle.block?.rootID ||
                    item.isPreview === protyle.preview.element.classList.contains("fn__none"))
            )
        ) {
            let blockId = "";
            if (protyle && protyle.block) {
                blockId = protyle.block.rootID;
            }
            if (blockId === item.blockId && !reload && item.isPreview !== protyle.preview.element.classList.contains("fn__none")) {
                return;
            }

            fetchPost("/api/outline/getDocOutline", {
                id: blockId,
                preview: !protyle.preview.element.classList.contains("fn__none")
            }, response => {
                if (!reload && (!isCurrentEditor(blockId) || item.blockId === blockId) &&
                    item.isPreview !== protyle.preview.element.classList.contains("fn__none")) {
                    return;
                }
                item.isPreview = !protyle.preview.element.classList.contains("fn__none");
                item.update(response, blockId);
                if (protyle) {
                    item.updateDocTitle(protyle.background.ial);
                    if (getSelection().rangeCount > 0) {
                        const startContainer = getSelection().getRangeAt(0).startContainer;
                        if (protyle.wysiwyg.element.contains(startContainer)) {
                            const currentElement = hasClosestByAttribute(startContainer, "data-node-id", null);
                            if (currentElement) {
                                item.setCurrent(currentElement);
                            }
                        }
                    }
                } else {
                    item.updateDocTitle();
                }
            });
        }
    });
};

export const updateBacklinkGraph = (models: IModels, protyle: IProtyle) => {
    // https://ld246.com/article/1637636106054/comment/1641485541929#comments
    if (protyle && protyle.element.classList.contains("fn__none") ||
        (protyle && !hasClosestByClassName(protyle.element, "layout__wnd--active") &&
            document.querySelector(".layout__wnd--active")  // https://github.com/siyuan-note/siyuan/issues/4414
        )
    ) {
        return;
    }
    models.graph.forEach(item => {
        if (item.type !== "global" && (!protyle || item.blockId !== protyle.block?.id)) {
            if (item.type === "local" && item.rootId !== protyle?.block?.rootID) {
                return;
            }
            let blockId = "";
            if (protyle && protyle.block) {
                blockId = protyle.block.showAll ? protyle.block.id : protyle.block.parentID;
            }
            if (blockId === item.blockId) {
                return;
            }
            item.searchGraph(true, blockId);
        }
    });
    models.backlink.forEach(item => {
        if (item.type === "local" && item.rootId !== protyle?.block?.rootID) {
            return;
        }
        let blockId = "";
        if (protyle && protyle.block) {
            blockId = protyle.block.showAll ? protyle.block.id : protyle.block.parentID;
        }
        if (blockId === item.blockId) {
            return;
        }
        item.element.querySelector('.block__icon[data-type="refresh"] svg').classList.add("fn__rotate");
        fetchPost("/api/ref/getBacklink2", {
            sort: item.status[blockId] ? item.status[blockId].sort.toString() : window.siyuan.config.editor.backlinkSort.toString(),
            mSort: item.status[blockId] ? item.status[blockId].mSort.toString() : window.siyuan.config.editor.backmentionSort.toString(),
            id: blockId || "",
            k: item.inputsElement[0].value,
            mk: item.inputsElement[1].value,
        }, response => {
            if (!isCurrentEditor(blockId) || item.blockId === blockId) {
                item.element.querySelector('.block__icon[data-type="refresh"] svg').classList.remove("fn__rotate");
                return;
            }
            item.saveStatus();
            item.blockId = blockId;
            item.render(response.data);
        });
    });
};

export const openBy = (url: string, type: "folder" | "app") => {
    /// #if !BROWSER
    if (url.startsWith("assets/")) {
        fetchPost("/api/asset/resolveAssetPath", {path: url.replace(/\.pdf\?page=\d{1,}$/, ".pdf")}, (response) => {
            if (type === "app") {
                useShell("openPath", response.data);
            } else if (type === "folder") {
                useShell("showItemInFolder", response.data);
            }
        });
        return;
    }
    let address = "";
    if ("windows" === window.siyuan.config.system.os) {
        // `file://` 协议兼容 Window 平台使用 `/` 作为目录分割线 https://github.com/siyuan-note/siyuan/issues/5681
        address = url.replace("file:///", "").replace("file://\\", "").replace("file://", "").replace(/\//g, "\\");
    } else {
        address = url.replace("file://", "");
    }

    // 拖入文件名包含 `)` 、`(` 的文件以 `file://` 插入后链接解析错误 https://github.com/siyuan-note/siyuan/issues/5786
    address = address.replace(/\\\)/g, ")").replace(/\\\(/g, "(");
    if (type === "app") {
        useShell("openPath", address);
    } else if (type === "folder") {
        if ("windows" === window.siyuan.config.system.os) {
            if (!address.startsWith("\\\\")) { // \\ 开头的路径是 Windows 网络共享路径 https://github.com/siyuan-note/siyuan/issues/5980
                // Windows 端打开本地文件所在位置失效 https://github.com/siyuan-note/siyuan/issues/5808
                address = address.replace(/\\\\/g, "\\");
            }
        }
        useShell("showItemInFolder", address);
    }
    /// #endif
};
