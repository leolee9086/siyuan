/**
 * Wnd.tabAction.ts - Wnd 标签页生命周期操作
 * 从 Wnd.ts 提取的标签页移除/移动/销毁逻辑
 */
import type {LayoutTab, LayoutWindow} from "./layout.types";
import { removeOverCounter } from "./Wnd.tab";
import type {ILayoutModel} from "./lifecycle/model.types";
import { Editor } from "../editor";
import { Search } from "../search";
import { Asset } from "../asset";
import {Custom} from "./dock/custom/Custom";
import { Constants } from "../constants";
import { isElectron } from "../platform";
import { ipcSend } from "../platform/electron/ipcRenderer";
import { clearWebFrameCache } from "../platform/electron/webFrame";
import { hasClosestBlock } from "../protyle/util/hasClosest";
import { setPanelFocus } from "./utils/setPanelFocus";
import { updatePanelByEditor } from "../editor/util.updatePanelByEditor";
import { fetchPost } from "../util/network/fetch";
import {layoutToJSON} from "./persistence/layoutSerializer";
import {saveLayout} from "./persistence/saveLayout";
import {setTabPosition} from "../window/setHeader";
import {setModelsHash} from "../window/modelHash/setModelsHash";
import { getAllModels } from "./getAll";
import { clearCounter } from "../protyle/runtime/status.port";
import { saveScroll } from "../protyle/scroll/saveScroll";
import { hideAllElements } from "../protyle/ui/hideElements";
import { focusByOffset, getSelectionOffset } from "../protyle/util/selection";
import {resizeTabs} from "./resize/resizeTabs";
import {getDockByType} from "./query/dockByType";
import {clearObjectBlockGraphs} from "./dock/obg/clearObjectBlockGraphs";
import { recordBeforeResizeTop } from "../protyle/util/resize";
import { setStorageVal } from "../protyle/util/compatibility";
import { showMessage } from "../dialog/message";
import { disposeModelResources } from "./lifecycle/model";

/**
 * 销毁标签页关联的模型实例，释放资源
 * @同步豁免: 遗留代码
 */
export function destroyModel(model: ILayoutModel): void {
    if (!model) {
        return;
    }
    if (model instanceof Editor && model.editor) {
        window.siyuan.blockPanels.forEach((item) => {
            if (item.element && model.editor.protyle.wysiwyg.element.contains(item.element)) {
                item.destroy();
            }
        });
        // Editor owns the optional bottom backlink panel and its observers;
        // destroying only the nested Protyle leaves those resources attached.
        model.destroy();
        return;
    }
    if (model instanceof Search) {
        // Search.destroy 负责取消未完成的搜索请求并释放全部编辑器。
        model.destroy();
        return;
    }
    if (model instanceof Asset) {
        if (model.pdfObject && model.pdfObject.pdfLoadingTask) {
            model.pdfObject.pdfLoadingTask.destroy();
        }
    }
    disposeModelResources(model);
}

/**
 * 移除标签页的核心逻辑（处理关闭动画、切换焦点、清理资源等）
 * @同步豁免: 遗留代码
 */
export function removeTabAction(
    wnd: LayoutWindow,
    id: string,
    isBatchClose = false,
    animate = true,
    isSaveLayout = true,
): void {
    wnd.children.find((item, index) => {
        if (item.id === id) {
            if (item.model instanceof Editor) {
                clearCounter(item.model.editor.protyle.options.status);
            }
            if (window.siyuan.storage[Constants.LOCAL_CLOSED_TABS].length > Constants.SIZE_UNDO) {
                window.siyuan.storage[Constants.LOCAL_CLOSED_TABS].pop();
            }
            if (item.headElement) {
                const tabJSON = {};
                layoutToJSON(item, tabJSON);
                window.siyuan.storage[Constants.LOCAL_CLOSED_TABS].push(tabJSON);
                setStorageVal(Constants.LOCAL_CLOSED_TABS, window.siyuan.storage[Constants.LOCAL_CLOSED_TABS]);
            }
            if (item.model instanceof Custom && item.model.beforeDestroy) {
                item.model.beforeDestroy();
            }
            if (item.model instanceof Editor) {
                saveScroll(item.model.editor.protyle);
                // 更新文档关闭时间（批量关闭页签时由 closeTabByType 批量处理，这里不单独调用）
                if (!isBatchClose) {
                    fetchPost("/api/storage/updateRecentDocCloseTime", {rootID: item.model.editor.protyle.block.rootID});
                }
            }
            if (wnd.children.length === 1) {
                destroyModel(wnd.children[0].model);
                wnd.children = [];
                if (["bottom", "left", "right"].includes(wnd.parent.type)) {
                    item.panelElement.remove();
                } else {
                    recordBeforeResizeTop();
                    wnd.remove();
                }
                // 关闭分屏页签后光标消失
                const editors = getAllModels().editor;
                if (editors.length === 0) {
                    clearObjectBlockGraphs();
                } else {
                    editors.forEach(editorItem => {
                        if (!editorItem.element.classList.contains("fn__none")) {
                            setPanelFocus(editorItem.parent.parent.headersElement.parentElement.parentElement);
                            updatePanelByEditor({
                                protyle: editorItem.editor.protyle,
                                focus: true,
                                pushBackStack: true,
                                reload: false,
                                resize: true,
                            }, getDockByType("file"));
                            return;
                        }
                    });
                }
                return;
            }
            if (item.headElement) {
                if (item.headElement.classList.contains("item--focus")) {
                    let latestHeadElement: HTMLElement;
                    Array.from(item.headElement.parentElement.children).forEach((headItem: HTMLElement) => {
                        if (headItem !== item.headElement &&
                            headItem.style.maxWidth !== "0px"
                        ) {
                            if (!latestHeadElement) {
                                latestHeadElement = headItem;
                            } else if (headItem.getAttribute("data-activetime") > latestHeadElement.getAttribute("data-activetime")) {
                                latestHeadElement = headItem;
                            }
                        }
                    });
                    if (latestHeadElement && !isBatchClose) {
                        wnd.switchTab(latestHeadElement, true, true, false, false);
                        wnd.showHeading();
                    }
                }
                if (animate) {
                    item.headElement.setAttribute("style", "max-width: 0px;");
                    setTimeout(() => {
                        item.headElement.remove();
                    }, 200);
                } else {
                    item.headElement.remove();
                }
            }
            item.panelElement.remove();
            destroyModel(item.model);
            wnd.children.splice(index, 1);
            resizeTabs(false);
            return true;
        }
    });
    wnd.ensureCenterWindow();
    if (isSaveLayout) {
        setTabPosition();
        saveLayout();
    }
    if (isElectron) {
        clearWebFrameCache();
        ipcSend(Constants.SIYUAN_CMD, "clearCache");
        setModelsHash();
    }
}

/**
 * 移除标签页入口（检查上传状态后调用 removeTabAction）
 * @同步豁免: 遗留代码
 */
export function wndRemoveTab(
    wnd: LayoutWindow,
    id: string,
    isBatchClose = false,
    animate = true,
    isSaveLayout = true,
): void {
    for (let index = 0; index < wnd.children.length; index++) {
        const item = wnd.children[index];
        if (item.id === id) {
            if ((item.model instanceof Editor) && item.model.editor?.protyle) {
                if (item.model.editor.protyle.upload.isUploading) {
                    showMessage(window.siyuan.languages.uploading);
                    return;
                }
            }
            removeTabAction(wnd, id, isBatchClose, animate, isSaveLayout);
            return;
        }
    }
}

/**
 * 移动标签页到当前窗口（处理光标保持、子窗口清理等）
 * @同步豁免: 遗留代码
 */
export function wndMoveTab(wnd: LayoutWindow, tab: LayoutTab, nextId?: string): void {
    let rangeData: {
        id: string,
        start: number,
        end: number
    };
    if (tab.model instanceof Editor && tab.model.editor.protyle.toolbar.range) {
        const blockElement = hasClosestBlock(tab.model.editor.protyle.toolbar.range.startContainer);
        if (blockElement) {
            const startEnd = getSelectionOffset(blockElement, undefined, tab.model.editor.protyle.toolbar.range);
            rangeData = {
                id: blockElement.getAttribute("data-node-id"),
                start: startEnd.start,
                end: startEnd.end
            };
        }
    }
    wnd.element.querySelector(".layout-tab-container").append(tab.panelElement);
    if (rangeData && tab.model instanceof Editor) {
        // DOM 移动后 range 会变化
        const range = focusByOffset(tab.model.editor.protyle.wysiwyg.element.querySelector(`[data-node-id="${rangeData.id}"]`), rangeData.start, rangeData.end);
        if (range) {
            tab.model.editor.protyle.toolbar.range = range;
        }
    }
    if (nextId) {
        // 只能用 find https://github.com/siyuan-note/siyuan/issues/3455
        wnd.children.find((item, index) => {
            if (item.id === nextId) {
                wnd.children.splice(index, 0, tab);
                return true;
            }
        });
    } else {
        wnd.children.push(tab);
    }
    if (wnd.children.length > window.siyuan.config.fileTree.maxOpenTabCount) {
        removeOverCounter(wnd);
    }

    const oldWnd = tab.parent;
    if (oldWnd.children.length === 1) {
        oldWnd.children = [];
        oldWnd.remove();
    } else {
        oldWnd.children.find((item, index) => {
            if (item.id === tab.id) {
                oldWnd.children.splice(index, 1);
                resizeTabs();
                return true;
            }
        });
        if (!oldWnd.headersElement.querySelector(".item--focus")) {
            let latestHeadElement: HTMLElement;
            Array.from(oldWnd.headersElement.children).forEach((headItem: HTMLElement) => {
                if (!latestHeadElement) {
                    latestHeadElement = headItem;
                } else if (headItem.getAttribute("data-activetime") > latestHeadElement.getAttribute("data-activetime")) {
                    latestHeadElement = headItem;
                }
            });
            if (latestHeadElement) {
                oldWnd.switchTab(latestHeadElement, true);
            }
        }
    }

    // https://github.com/siyuan-note/siyuan/issues/13551
    wnd.switchTab(tab.headElement);

    tab.parent = wnd;
    hideAllElements(["toolbar"]);
    setTabPosition();
}
