import type {LayoutTab} from "./Files/eventHandlers.types";
import { Model } from "../Model";
import { Constants } from "../../constants";
import { pathPosix, setNoteBook } from "../../util/file/pathName";
import { fetchPost, fetchSyncPost } from "../../util/network/fetch";
import {
    getFileTreeSortRefreshTargets,
    reorderFileTreeNotebooks,
    updateFileTreeSortMode,
    type IDocSortModeChanged
} from "../../util/fileTreeSort";
import { updateHotkeyAfterTip } from "../../protyle/util/compatibility";
import type {AppFacade} from "../../app/AppFacade.types";
import { initFilesDrag } from "./Files/dnd";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { setCurrentItem, saveOpenPaths } from "./Files/treeOperations";
import { initAllEventHandlers } from "./Files/eventHandlers";
import { onLsSelect } from "./Files/treeNavigation";
import { assertHTMLElement } from "./Files/treeOperations.guard";
import { onLsHTMLHandler } from "./Files/onLsHTML";
import { handleMsgCallback } from "./Files/msgCallbackHandler";
import { onRenameHandler } from "./Files/wsHandlers.rename";
import { getPublishAccessLevel, getPublishAccessOptionByLevel } from "../../protyle/util/publishAccess";
import {
    generateNotebooksHtml,
    updateCloseAreaContent,
    updateCloseAreaVisibility,
    restoreOpenPaths,
    adjustCloseAreaHeight,
    initPanel
} from "./Files/init";
import {cancelFileTreeCollapse} from "./fileTreeAnimation";
import {updateAllDocActions, updateDocActionElement, updateSubFileCount} from "./Files/docActions";
import {refreshChangedFiletreeSort} from "./Files/sortRefresh";
import {filesModelBrand} from "./Files/eventHandlers.types";
/** 用途：恢复移动文档的展开状态；使用范围：文件树列表刷新；解耦评估：纯 DOM 移动辅助。 */
import {restoreMovedExpandedDocItems} from "../../util/fileTreeMove";
export class Files extends Model<AppFacade, LayoutTab> {
    public override parent: LayoutTab;

    public get [filesModelBrand]() {
        return "Files" as const;
    }

    public element: HTMLElement;
    public closeElement: HTMLElement;
    public lastSelectedElement: Element | null = null;
    public actionsElement: HTMLElement;
    private reloadNotebookInfoTimeout: number | undefined;
    private docSortModeRefreshTimeout: number | undefined;
    private docSortModeChanges = new Map<string, IDocSortModeChanged>();
    private movedExpandedDocIDs = new Set<string>();

    constructor(options: { tab: LayoutTab; app: AppFacade }) {
        super({app: options.app});
        this.parent = options.tab;
        this.connect({
            type: "filetree",
            id: options.tab.id,
            msgCallback: (data: IWebSocketData) => {
                handleMsgCallback(data, options.app, {
                    element: this.element,
                    closeElement: this.closeElement,
                    init: this.init.bind(this),
                    selectItem: this.selectItem.bind(this),
                    getLeaf: this.getLeaf.bind(this),
                    onRename: (renameData) => onRenameHandler(this.element, renameData),
                    reloadNotebookInfo: this.reloadNotebookInfo.bind(this),
                    recordMovedExpandedDocIDs: this.recordMovedExpandedDocIDs.bind(this),
                    restoreMovedExpandedItems: this.restoreMovedExpandedItems.bind(this),
                    updateDocActionElement: (liElement) => updateDocActionElement(this.element, liElement),
                    persistOpenPaths: saveOpenPaths.bind(null, this.element),
                });
            },
        });
        const panelRefs = initPanel(
            options.tab.panelElement,
            {
                fileTree: siyuanI18n.fileTree,
                selectOpen1: siyuanI18n.selectOpen1,
                collapse: siyuanI18n.collapse,
                more: siyuanI18n.more,
                min: siyuanI18n.min,
                closeNotebook: siyuanI18n.closeNotebook
            },
            getSiyuanConfig(),
            updateHotkeyAfterTip,
            assertHTMLElement
        );
        this.actionsElement = panelRefs.actionsElement;
        this.element = panelRefs.element;
        this.closeElement = panelRefs.closeElement;
        initAllEventHandlers({files: this, app: options.app});
        initFilesDrag(this);
        this.init();
    }

    public init(isInitialCall = true) {
        const {openHtml, closeHtml, closeCounter} = generateNotebooksHtml();
        this.element.innerHTML = openHtml;
        updateCloseAreaContent(this.closeElement, closeHtml, closeCounter);
        updateCloseAreaVisibility(this.closeElement, closeCounter);
        restoreOpenPaths(this.selectItem.bind(this));
        if (!isInitialCall) {
            return;
        }
        adjustCloseAreaHeight(this.closeElement, openHtml !== "");
    }

    public setCurrent(target: HTMLElement, isScroll = true) {
        setCurrentItem(this.element, target, isScroll);
    }

    public getLeaf(liElement: Element, notebookId: string, focusUpdate = false) {
        const toggleElement = liElement.querySelector(".b3-list-item__arrow");
        if (!toggleElement) {
            return;
        }
        if (cancelFileTreeCollapse(liElement)) {
            saveOpenPaths(this.element);
            if (!focusUpdate) {
                return;
            }
        }
        const leafElement = liElement.nextElementSibling as HTMLElement | null;
        if (toggleElement.classList.contains("b3-list-item__arrow--open") && !focusUpdate) {
            toggleElement.classList.remove("b3-list-item__arrow--open");
            if (leafElement?.tagName === "UL") {
                leafElement.remove();
            }
            saveOpenPaths(this.element);
            return;
        }
        fetchPost("/api/filetree/listDocsByPath", {
            notebook: notebookId,
            path: liElement.getAttribute("data-path"),
            app: Constants.SIYUAN_APPID,
        }, response => {
            if (response.data.path === "/" && response.data.files.length === 0) {
                void this.app.createDocumentInTree(notebookId, "/");
                return;
            }
            onLsHTMLHandler(this.element, response.data, undefined, (listElement) => {
                this.restoreMovedExpandedItems(listElement, response.data.box);
                this.refreshPublishAccessSwitch();
            });
            saveOpenPaths(this.element);
        });
    }

    public async selectItem(notebookId: string, filePath: string, data?: {
        files: IFile[],
        box: string,
        path: string
    }, setStorage = true, isSetCurrent = true): Promise<HTMLElement | null | undefined> {
        filePath = filePath.replace(/\/\/+/g, "/");
        const treeElement = this.element.querySelector(`[data-url="${notebookId}"]`);
        if (!treeElement) {
            return;
        }
        const boxDocId = window.siyuan.config.fileTree.boxDocEnabled ? notebookId : "";
        if (boxDocId && filePath === `/${boxDocId}.sy`) {
            const boxDocElement = treeElement.querySelector<HTMLElement>('[data-type="navigation-root"]');
            if (isSetCurrent && boxDocElement) {
                this.setCurrent(boxDocElement);
            }
            return boxDocElement;
        }
        let currentPath = filePath;
        let liElement: HTMLElement | null = null;
        const visitedPaths = new Set<string>();
        while (!liElement) {
            if (visitedPaths.has(currentPath)) {
                return;
            }
            visitedPaths.add(currentPath);
            liElement = treeElement.querySelector<HTMLElement>(`[data-path="${currentPath}"]`);
            if (!liElement) {
                const dirname = pathPosix().dirname(currentPath);
                currentPath = dirname === "/" ? dirname : `${dirname}.sy`;
            }
        }
        if (liElement.dataset.path === filePath) {
            if (setStorage) {
                saveOpenPaths(this.element);
            }
            if (isSetCurrent) {
                this.setCurrent(liElement);
            }
            return liElement;
        }
        const listData = data?.path === currentPath ? data : (await fetchSyncPost("/api/filetree/listDocsByPath", {
            notebook: notebookId,
            path: currentPath,
            app: Constants.SIYUAN_APPID,
        })).data;
        const selected = await onLsSelect(
            this.element,
            listData,
            filePath,
            setStorage,
            isSetCurrent,
            this.selectItem.bind(this),
            this.setCurrent.bind(this)
        );
        this.refreshPublishAccessSwitch();
        return selected;
    }

    /** 记录在移动过程中暂时未能展开的文档节点。 */
    public recordMovedExpandedDocIDs(ids: Iterable<string>) {
        for (const id of ids) {
            this.movedExpandedDocIDs.add(id);
        }
    }

    /** 在文件列表刷新后逐层恢复移动前的展开状态。 */
    public restoreMovedExpandedItems(listElement: Element, notebookId: string) {
        restoreMovedExpandedDocItems(listElement, this.movedExpandedDocIDs, (item) => {
            this.getLeaf(item, notebookId, true);
        });
    }

    public refreshPublishAccessSwitch() {
        if (window.siyuan.config.readonly || window.siyuan.isPublish ||
            !this.element.classList.contains("file-tree__publish-access--active")) {
            return;
        }
        const ids: string[] = [];
        this.element.querySelectorAll("[data-url]").forEach((element: HTMLElement) => ids.push(element.dataset.url ?? ""));
        this.element.querySelectorAll('[data-type="navigation-file"][data-node-id]')
            .forEach((element: HTMLElement) => ids.push(element.dataset.nodeId ?? ""));
        fetchPost("/api/filetree/getPublishAccess", {ids: ids.filter(Boolean)}, response => {
            response.data.publishAccess.forEach((item: IPublishAccessItem) => {
                const element = this.element.querySelector(`[data-url="${item.id}"] .b3-list-item__switch`) ||
                    this.element.querySelector(`[data-node-id="${item.id}"] .b3-list-item__switch`);
                if (element) {
                    element.innerHTML = getPublishAccessOptionByLevel(
                        getPublishAccessLevel(item.visible, item.password, item.disable)
                    ).iconHTML;
                }
            });
        });
    }

    public updateDocActions() {
        updateAllDocActions(this.element);
    }

    public onFiletreeSortChanged(data: {notebook: string; parentPath: string}) {
        refreshChangedFiletreeSort(this.element, data, listData => {
            onLsHTMLHandler(this.element, listData, undefined, (listElement) => {
                this.restoreMovedExpandedItems(listElement, listData.box);
                this.refreshPublishAccessSwitch();
            });
        });
    }

    // 上游 v3.8.0：单文档/笔记本/全局排序模式变更，先同步属性再增量刷新受影响目录
    public onDocSortModeChanged(data: IDocSortModeChanged) {
        updateFileTreeSortMode(data, this.element);
        this.docSortModeChanges.set(`${data.scope}:${data.box}:${data.id}:${data.path}`, data);
        window.clearTimeout(this.docSortModeRefreshTimeout);
        this.docSortModeRefreshTimeout = window.setTimeout(() => {
            const changes = Array.from(this.docSortModeChanges.values());
            this.docSortModeChanges.clear();
            const refreshLists = () => {
                getFileTreeSortRefreshTargets(this.element, changes).forEach((target) => {
                    const notebookElement = Array.from(this.element.children).find((item) =>
                        item.getAttribute("data-url") === target.notebookId
                    );
                    const liElement = Array.from(notebookElement?.querySelectorAll("li[data-path]") || []).find((item) =>
                        item.getAttribute("data-path") === target.path
                    );
                    if (liElement) {
                        this.getLeaf(liElement, target.notebookId, true);
                    }
                });
            };
            if (changes.some((item) => item.scope === "global")) {
                setNoteBook((notebooks) => {
                    const closedListElement = this.closeElement.lastElementChild;
                    if (closedListElement) {
                        reorderFileTreeNotebooks(this.element, closedListElement, notebooks);
                    }
                    this.element.querySelectorAll<HTMLElement>(
                        ":scope > ul[data-url] > li[data-type=\"navigation-root\"]"
                    ).forEach((item) => {
                        if (window.siyuan.config.fileTree.sort === 6) {
                            item.setAttribute("draggable", "true");
                        } else {
                            item.removeAttribute("draggable");
                        }
                    });
                    refreshLists();
                });
            } else {
                refreshLists();
            }
        }, 100);
    }

    // 上游 v3.8.0：全局手工排序时按配置顺序原位重排笔记本，避免整树重建丢失展开状态
    public onNotebookSortChanged() {
        if (window.siyuan.config.fileTree.sort !== 6) {
            return;
        }
        setNoteBook((notebooks) => {
            const closedListElement = this.closeElement.lastElementChild;
            if (closedListElement) {
                reorderFileTreeNotebooks(this.element, closedListElement, notebooks);
            }
        });
    }

    private reloadNotebookInfo() {
        window.clearTimeout(this.reloadNotebookInfoTimeout);
        this.reloadNotebookInfoTimeout = window.setTimeout(() => {
            setNoteBook(notebooks => {
                for (const notebook of notebooks) {
                    const liElement = this.element.querySelector<HTMLElement>(
                        `ul[data-url="${notebook.id}"] > li[data-type="navigation-root"]`
                    );
                    if (liElement) {
                        updateSubFileCount(this.element, liElement, notebook.subFileCount);
                    }
                }
            });
        }, 128);
    }
}
