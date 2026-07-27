import { Tab } from "./Tab";
import {getInstanceById, newModelByInitData} from "./util";
import { getAllModels, getAllTabs, getAllWnds } from "./getAll";
import type { AppFacade } from "../app/AppFacade.types";
import { Model } from "./Model";
import { Editor } from "../editor";
import {createEditor} from "../editor/factory/createEditor.factory";
import { Asset } from "../asset";
import { Graph } from "./dock/Graph";
import { Files } from "./dock/Files";
import { Outline } from "./dock/outline/Outline";
import { Backlink } from "./dock/Backlink";
import { Bookmark } from "./dock/Bookmark";
import { Tag } from "./dock/Tag";
import { Search } from "../search";
import {Custom} from "./dock/custom/Custom";
import { updateHotkeyTip } from "../protyle/util/compatibility";
import { openSearch } from "../search/spread";
import { openRecentDocs } from "../business/openRecentDocs";
import { openHistory } from "../history/history";
import {mountHelp} from "../util/file/mount";
import {newNotebook} from "../util/file/notebookCreation/newNotebook/newNotebook.factory";
import { Constants } from "../constants";
import { fetchPost } from "../util/network/fetch";
/** 用途：按模型类型查询 Dock。使用范围：页签快捷切换及兼容导出；解耦评估：唯一实现位于无状态 Layout 查询子域。 */
import {getDockByType} from "./query/dockByType";
/** 用途：读取当前活动页签；使用范围：tabUtil 内部回退查询与历史出口；解耦评估：查询实现不加载本模块的具体模型构造器。 */
import {getActiveTab} from "./query/activeTab";

export {getAllTabs, getAllWnds, getInstanceById};
/** 保持历史活动页签查询入口，实际实现位于无状态 Layout 查询子域。 */
export {getActiveTab};
/** 保持历史公共入口，调用方迁移期间仍指向查询子域的唯一实现。 */
export {getDockByType};

export const switchTabByIndex = (index: number) => {
    const activeDockIcoElement = document.querySelector(".dock .dock__item--activefocus");
    if (activeDockIcoElement) {
        let indexElement = activeDockIcoElement.parentElement.children[index];
        if (index === -1) {
            // 最后一个
            indexElement = activeDockIcoElement.parentElement.lastElementChild;
            if (!indexElement.getAttribute("data-type")) {
                indexElement = indexElement.previousElementSibling;
            }
        } else if (index === -2) {
            // 上一个
            indexElement = activeDockIcoElement.previousElementSibling;
            if (!indexElement) {
                indexElement = activeDockIcoElement.parentElement.lastElementChild;
            }
        } else if (index === -3) {
            // 下一个
            indexElement = activeDockIcoElement.nextElementSibling;
            if (!indexElement) {
                indexElement = activeDockIcoElement.parentElement.firstElementChild;
            }
        }
        const type = indexElement?.getAttribute("data-type") as TDock;
        if (type) {
            getDockByType(type)?.toggleModel(type, true, false);
        }
        return;
    }
    const tab = getActiveTab(false);
    if (tab) {
        let indexElement = tab.parent.headersElement.children[index];
        if (index === -1) {
            // 最后一个
            indexElement = tab.parent.headersElement.lastElementChild;
        } else if (index === -2) {
            // 上一个
            indexElement = tab.headElement.previousElementSibling;
            if (!indexElement) {
                indexElement = tab.headElement.parentElement.lastElementChild;
            }
        } else if (index === -3) {
            // 下一个
            indexElement = tab.headElement.nextElementSibling;
            if (!indexElement) {
                indexElement = tab.headElement.parentElement.firstElementChild;
            }
        }
        if (indexElement) {
            tab.parent.switchTab(indexElement as HTMLElement, true);
            tab.parent.showHeading();
        }
    }
};

export const newCenterEmptyTab = (app: AppFacade) => {
    return new Tab({
        panel: `<div class="layout__empty">
        <div class="${!window.siyuan.config.readonly ? " fn__none" : ""}">
            <div class="config-about__logo">
                <img src="/stage/icon.png">
                ${window.siyuan.languages.siyuanNote}
            </div>
            <div class="b3-label__text">${window.siyuan.languages.slogan}</div>
        </div>
        <div class="fn__hr"></div>
    <div class="b3-list" style="margin: 0 auto">
        <div class="b3-list-item" id="editorEmptySearch">
            <svg class="b3-list-item__graphic"><use xlink:href="#iconSearch"></use></svg>
            <span>${window.siyuan.languages.search}</span>
            <span class="b3-list-item__meta">${updateHotkeyTip(window.siyuan.config.keymap.general.globalSearch.custom)}</span>
        </div>
        <div id="editorEmptyRecent" class="b3-list-item">
            <svg class="b3-list-item__graphic"><use xlink:href="#iconRecentDocs"></use></svg>
            <span>${window.siyuan.languages.recentDocs}</span>
            <span class="b3-list-item__meta">${updateHotkeyTip(window.siyuan.config.keymap.general.recentDocs.custom)}</span>
        </div>
        <div id="editorEmptyHistory" class="b3-list-item${window.siyuan.config.readonly ? " fn__none" : ""}">
            <svg class="b3-list-item__graphic"><use xlink:href="#iconHistory"></use></svg>
            <span>${window.siyuan.languages.dataHistory}</span>
            <span class="b3-list-item__meta">${updateHotkeyTip(window.siyuan.config.keymap.general.dataHistory.custom)}</span>
        </div>
        <div class="b3-list-item${window.siyuan.config.readonly ? " fn__none" : ""}" id="editorEmptyFile">
            <svg class="b3-list-item__graphic"><use xlink:href="#iconAddDoc"></use></svg>
            <span>${window.siyuan.languages.newFile}</span>
            <span class="b3-list-item__meta">${updateHotkeyTip(window.siyuan.config.keymap.general.newFile.custom)}</span>
        </div>
        <div class="b3-list-item${window.siyuan.config.readonly ? " fn__none" : ""}" id="editorEmptyNewNotebook">
            <svg class="b3-list-item__graphic"><use xlink:href="#iconNewNoteBook"></use></svg>
            <span>${window.siyuan.languages.newNotebook}</span>
        </div>
        <div class="b3-list-item${window.siyuan.config.readonly ? " fn__none" : ""}" id="editorEmptyHelp">
            <svg class="b3-list-item__graphic"><use xlink:href="#iconHelp"></use></svg>
            <span>${window.siyuan.languages.userGuide}</span>
        </div>
    </div>
</div>`,
        callback(tab: Tab) {
            tab.panelElement.addEventListener("click", (event) => {
                let target = event.target as HTMLElement;
                while (target && !target.isEqualNode(tab.panelElement)) {
                    if (target.id === "editorEmptySearch") {
                        openSearch({
                            app,
                            hotkey: Constants.DIALOG_GLOBALSEARCH,
                        });
                        event.stopPropagation();
                        event.preventDefault();
                        break;
                    } else if (target.id === "editorEmptyRecent") {
                        openRecentDocs();
                        event.stopPropagation();
                        event.preventDefault();
                        break;
                    } else if (target.id === "editorEmptyHistory") {
                        openHistory(app);
                        event.stopPropagation();
                        event.preventDefault();
                        break;
                    } else if (target.id === "editorEmptyFile") {
                        void app.createDocument();
                        event.stopPropagation();
                        event.preventDefault();
                        break;
                    } else if (target.id === "editorEmptyNewNotebook") {
                        newNotebook();
                        event.stopPropagation();
                        event.preventDefault();
                        break;
                    } else if (target.id === "editorEmptyHelp") {
                        mountHelp();
                        event.stopPropagation();
                        event.preventDefault();
                        break;
                    }
                    target = target.parentElement;
                }
            });
        }
    });
};

export const copyTab = (app: AppFacade, tab: Tab) => {
    return new Tab({
        icon: tab.icon,
        docIcon: tab.docIcon,
        title: tab.title,
        callback(newTab: Tab) {
            let model: Model;
            if (tab.model instanceof Editor) {
                const newAction: TProtyleAction[] = [];
                // https://github.com/siyuan-note/siyuan/issues/12132
                tab.model.editor.protyle.block.action.forEach(item => {
                    if (item !== Constants.CB_GET_APPEND && item !== Constants.CB_GET_BEFORE && item !== Constants.CB_GET_HTML) {
                        newAction.push(item);
                    }
                });
                model = createEditor({
                    app,
                    tab: newTab,
                    blockId: tab.model.editor.protyle.block.id,
                    rootId: tab.model.editor.protyle.block.rootID,
                    // https://github.com/siyuan-note/siyuan/issues/12150
                    action: newAction,
                    afterInitProtyle(editor) {
                        // https://github.com/siyuan-note/siyuan/issues/13851
                        if (tab.model instanceof Editor) {
                            const copyResizeTopElement = tab.model.editor.protyle.wysiwyg.element.querySelector("[data-resize-top]");
                            if (copyResizeTopElement) {
                                const newElement = editor.protyle.wysiwyg.element.querySelector(`[data-node-id="${copyResizeTopElement.getAttribute("data-node-id")}"]`);
                                if (newElement) {
                                    editor.protyle.observerLoad?.disconnect();
                                    newElement.scrollIntoView();
                                    editor.protyle.contentElement.scrollTop += parseInt(copyResizeTopElement.getAttribute("data-resize-top"));
                                }
                            }
                        }
                    }
                });
            } else if (tab.model instanceof Asset) {
                model = new Asset({
                    app,
                    tab: newTab,
                    path: tab.model.path
                });
            } else if (tab.model instanceof Graph) {
                model = new Graph({
                    app,
                    tab: newTab,
                    blockId: tab.model.blockId,
                    rootId: tab.model.rootId,
                    type: tab.model.type,
                });
            } else if (tab.model instanceof Files) {
                model = new Files({
                    app,
                    tab: newTab
                });
            } else if (tab.model instanceof Outline) {
                model = new Outline({
                    app,
                    tab: newTab,
                    blockId: tab.model.blockId,
                    type: tab.model.type,
                    isPreview: tab.model.isPreview
                });
            } else if (tab.model instanceof Backlink) {
                model = new Backlink({
                    app,
                    tab: newTab,
                    blockId: tab.model.blockId,
                    rootId: tab.model.rootId,
                    type: tab.model.type
                });
            } else if (tab.model instanceof Bookmark) {
                model = new Bookmark(app, newTab);
            } else if (tab.model instanceof Tag) {
                model = new Tag(app, newTab);
            } else if (tab.model instanceof Search) {
                model = new Search({
                    app,
                    tab: newTab,
                    config: tab.model.config
                });
            } else if (tab.model instanceof Custom) {
                const custom = tab.model as Custom;
                model = newModelByInitData(app, newTab, {
                    instance: "Custom",
                    customModelType: custom.type,
                    customModelData: custom.data,
                });
            } else if (!tab.model && tab.headElement) {
                const initData = JSON.parse(tab.headElement.getAttribute("data-initdata") || "{}");
                if (initData) {
                    model = newModelByInitData(app, newTab, initData);
                }
            }
            newTab.addModel(model);
        }
    });
};

const pushRootID = (rootIDs: string[], item: Tab) => {
    let id;
    if (item.model instanceof Editor) {
        id = item.model.editor.protyle.block.rootID;
    } else if (!item.model) {
        const initTab = item.headElement.getAttribute("data-initdata");
        if (initTab) {
            try {
                const initTabData = JSON.parse(initTab);
                if (initTabData && initTabData.instance === "Editor" && initTabData.rootId) {
                    id = initTabData.rootId;
                }
            } catch (e) {
                console.warn("Failed to parse tab init data:", e);
            }
        }
    }
    if (id) {
        rootIDs.push(id);
    }
};

export const closeTabByType = (tab: Tab, type: "closeOthers" | "closeAll" | "other", tabs?: Tab[]) => {
    const rootIDs: string[] = [];
    if (type === "closeOthers") {
        for (let index = 0; index < tab.parent.children.length; index++) {
            const item = tab.parent.children[index];
            if (item.id !== tab.id && !item.headElement.classList.contains("item--pin")) {
                pushRootID(rootIDs, item);
                item.parent.removeTab(item.id, true, false);
                index--;
            }
        }
    } else if (type === "closeAll") {
        for (let index = 0; index < tab.parent.children.length; index++) {
            const item = tab.parent.children[index];
            if (!item.headElement.classList.contains("item--pin")) {
                pushRootID(rootIDs, item);
                item.parent.removeTab(item.id, true);
                index--;
            }
        }
    } else if (tabs.length > 0) {
        for (let index = 0; index < tabs.length; index++) {
            if (!tabs[index].headElement.classList.contains("item--pin")) {
                tabs[index].parent.removeTab(tabs[index].id);
            }
        }
    }
    // 批量更新文档关闭时间
    if (rootIDs.length > 0) {
        fetchPost("/api/storage/batchUpdateRecentDocCloseTime", {rootIDs});
    }
    if (tab.headElement.parentElement && !tab.headElement.parentElement.querySelector(".item--focus")) {
        tab.parent.switchTab(tab.headElement, true);
    } else if (tab.parent.children.length > 0) {
        tab.parent.switchTab(tab.parent.children[tab.parent.children.length - 1].headElement, true);
    }
};
