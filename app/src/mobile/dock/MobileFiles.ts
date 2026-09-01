import {hasClosestByTag, hasTopClosestByTag} from "../../protyle/util/hasClosest";
import {Model} from "../../layout/Model";
import {Constants} from "../../constants";
import {pathPosix, setNoteBook} from "../../util/file/pathName";
import {isMoveTargetAllowed} from "../../util/file/moveTarget";
import {fetchPost, fetchSyncPost} from "../../util/network/fetch";
import {genUUID} from "../../util/platform/genID";
import {newFileInTree} from "../../util/file/newFile";
import type { AppFacade } from "../../app/AppFacade.types";
import {setStorageVal} from "../../protyle/util/compatibility";
import {dragOverScroll, stopScrollAnimation} from "../../boot/globalEvent/dragover";
import {showMessage} from "../../dialog/message";
import {unicode2Emoji} from "../../emoji/emoji.render";
import {updateNotebookRootForBoxDoc} from "../../util/notebookRoot";
import {normalizeFileTreeMoves, restoreMovedExpandedDocItems, getFileTreeChildList, updateMovedSubtree} from "../../util/fileTreeMove";
import {isCustomFileTreeList} from "../../util/fileTreeSort";
import {
    genNotebook,
    updateItemArrow,
    updateSubFileCount,
    updateDocActionElement,
    onMove,
    onRemove,
    onRename,
    onRenameNotebook,
    onMount,
    onReloadDocInfo
} from "./MobileFiles.ws";
import {bindClickEvent} from "./MobileFiles.event";
import {onLsHTML, onLsSelect} from "./MobileFiles.render";
import {
    getPublishAccessLevel,
    getPublishAccessOptionByLevel
} from "../../protyle/util/publishAccess";
import {cancelFileTreeCollapse} from "../../layout/dock/fileTreeAnimation";
import {bindMousePointerTouchBridge, isMousePointerTouchEvent} from "../util/mousePointerTouchBridge";
import {mobileFilesModelBrand} from "./files/mobileFiles.types";

export class MobileFiles extends Model<AppFacade> {
    public get [mobileFilesModelBrand]() {
        return "MobileFiles" as const;
    }
    public element: HTMLElement;
    public actionsElement: HTMLElement;
    public closeElement: HTMLElement;
    private reloadNotebookInfoTimeout: number | undefined;
    private movedExpandedDocIDs = new Set<string>();
    private touchDragState: {
        selectedElement: HTMLElement;
        startX: number;
        startY: number;
        isDragging: boolean;
        ghostElement: HTMLElement | null;
        startTime: number;
    } | null = null;

    constructor(app: AppFacade, dockElement?: HTMLElement) {
        super({app});
        this.connect({
            id: genUUID(),
            type: "filetree",
            msgCallback: this.handleMsgCallback.bind(this),
        });
        // 兼容两种调用约定：上游传入停靠栏元素，本地未传入时按侧边栏选择器自行查询
        const filesElement = dockElement ?? (document.querySelector('#sidebar [data-type="sidebar-file"]') as HTMLElement);
        filesElement.innerHTML = `<div class="toolbar toolbar--border toolbar--dark">
    <div class="fn__space"></div>
    <div class="toolbar__text">${window.siyuan.languages.fileTree}</div>
    <div class="fn__space"></div>
    <svg data-type="newNotebook" class="toolbar__icon"><use xlink:href="#iconNewNoteBook"></use></svg>
    <svg data-type="refresh" class="toolbar__icon"><use xlink:href="#iconRefresh"></use></svg>
    <svg data-type="focus" class="toolbar__icon"><use xlink:href="#iconFocus"></use></svg>
    <svg data-type="collapse" class="toolbar__icon"><use xlink:href="#iconContract"></use></svg>
    <svg data-type="publish-access" class="toolbar__icon${window.siyuan.config.readonly || !window.siyuan.config.publish.enable ? " fn__none" : ""}"><use xlink:href="#iconEye"></use></svg>
    <svg data-type="sort" class="toolbar__icon${window.siyuan.config.readonly ? " fn__none" : ""}"><use xlink:href="#iconSort"></use></svg>
</div>
<div class="fn__flex-1"></div>
<ul class="b3-list b3-list--background fn__flex-column" style="min-height: auto;height:42px;transition: height .2s cubic-bezier(0, 0, .2, 1) 0ms">
    <li class="b3-list-item" data-type="toggle">
        <span class="b3-list-item__toggle">
            <svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
        </span>
        <span class="b3-list-item__text">${window.siyuan.languages.closeNotebook}</span>
        <span class="counter" style="cursor: auto"></span>
    </li>
    <ul class="fn__none fn__flex-1"></ul>
</ul>`;
        this.actionsElement = filesElement.firstElementChild as HTMLElement;
        this.element = this.actionsElement.nextElementSibling as HTMLElement;
        this.closeElement = this.element.nextElementSibling as HTMLElement;
        bindClickEvent(this, app, filesElement, this.actionsElement);
        this.bindTouchDrag(filesElement);
        bindMousePointerTouchBridge(filesElement);
    }

    private handleMsgCallback(data: IWebSocketData) {
        if (!data) {
            return;
        }
        switch (data.cmd) {
            case "moveDoc":
            case "moveDocs":
                onMove(this, normalizeFileTreeMoves(data.data), data.callback);
                break;
            case "reloadFiletree":
                setNoteBook(() => {
                    this.init(false);
                });
                break;
            case "boxDocFeatureChanged":
                // 盒子文档能力开关变化：重建笔记本根节点的可交互状态
                setNoteBook(() => {
                    this.updateBoxDocFeature();
                });
                break;
            case "notebookIconChanged":
                this.updateNotebookIcon(data.data);
                break;
            case "reloadNotebookInfo":
                window.clearTimeout(this.reloadNotebookInfoTimeout);
                this.reloadNotebookInfoTimeout = window.setTimeout(() => {
                    setNoteBook((notebooks) => {
                        notebooks.forEach((notebook) => {
                            const liElement = this.element.querySelector<HTMLElement>(
                                `ul[data-url="${notebook.id}"] > li[data-type="navigation-root"]`
                            );
                            if (liElement) {
                                updateSubFileCount(liElement, notebook.subFileCount);
                            }
                        });
                    });
                }, 128);
                break;
            case "mount":
                onMount(this, data);
                break;
            case "createnotebook":
                setNoteBook((notebooks) => {
                    let previousId: string;
                    notebooks.find(item => {
                        if (!item.closed) {
                            if (item.id === data.data.box.id) {
                                if (previousId) {
                                    this.element.querySelector(`.b3-list[data-url="${previousId}"]`).insertAdjacentHTML("afterend", genNotebook(data.data.box));
                                } else {
                                    this.element.insertAdjacentHTML("afterbegin", genNotebook(data.data.box));
                                }
                                return true;
                            }
                            previousId = item.id;
                        }
                    });
                });
                break;
            case "closeBox":
            case "removeBox":
            case "removeDoc":
                onRemove(this, data);
                break;
            case "create":
                if (data.data.listDocTree) {
                    this.selectItem(data.data.box.id, data.data.path);
                } else {
                    updateItemArrow(this, data.data.box.id, data.data.path);
                }
                break;
            case "createdailynote":
            case "heading2doc":
            case "li2doc":
                this.selectItem(data.data.box.id, data.data.path);
                break;
            case "reloadDocInfo":
                onReloadDocInfo(this, data);
                break;
            case "renamenotebook":
                onRenameNotebook(this, data.data);
                break;
            case "rename":
                onRename(this, data.data);
                break;
        }
    }

    // 笔记本图标变更推送：同步文件树中的图标显示；加密且关闭的笔记本保持锁定提示不被覆盖
    private updateNotebookIcon(data: { boxID: string, icon: string }) {
        if (!data || typeof data.boxID !== "string" || typeof data.icon !== "string") {
            return;
        }
        const notebook = window.siyuan.notebooks.find((item) => item.id === data.boxID);
        if (!notebook) {
            return;
        }
        notebook.icon = data.icon;
        if (notebook.encrypted && notebook.closed) {
            return;
        }
        const liElement = notebook.closed ?
            this.closeElement.querySelector<HTMLElement>(`li[data-url="${data.boxID}"]`) :
            this.element.querySelector<HTMLElement>(
                `ul[data-url="${data.boxID}"] > li[data-type="navigation-root"]`
            );
        const iconElement = liElement?.querySelector<HTMLElement>(".b3-list-item__icon");
        if (iconElement) {
            const iconHTML = unicode2Emoji(data.icon || window.siyuan.storage[Constants.LOCAL_IMAGES].note);
            if (iconElement.innerHTML !== iconHTML) {
                iconElement.innerHTML = iconHTML;
            }
        }
    }

    // 盒子文档能力开关变化：刷新各打开笔记本根节点的文档计数、图标提示与排列位置
    private updateBoxDocFeature() {
        const enabled = window.siyuan.config.fileTree.boxDocEnabled;
        window.siyuan.notebooks.forEach((notebook) => {
            if (notebook.closed) {
                return;
            }
            const notebookElement = this.element.querySelector<HTMLElement>(`:scope > ul[data-url="${notebook.id}"]`);
            const rootElement = notebookElement?.querySelector<HTMLElement>(":scope > li[data-type=\"navigation-root\"]");
            if (!notebookElement || !rootElement) {
                return;
            }

            const subFileCount = updateNotebookRootForBoxDoc(rootElement, notebook, enabled);
            rootElement.querySelector<HTMLElement>(".b3-list-item__icon")?.setAttribute("aria-label", enabled ?
                (subFileCount > 0 ? window.siyuan.languages.docIconClickExpand : window.siyuan.languages.openDocument) :
                window.siyuan.languages.changeIcon);
            this.element.append(notebookElement);
        });
    }

    public init(init = true) {
        let html = "";
        let closeHtml = "";
        let closeCounter = 0;
        window.siyuan.notebooks.forEach((item) => {
            if (item.closed) {
                closeCounter++;
                closeHtml += genNotebook(item);
            } else {
                html += genNotebook(item);
            }
        });
        this.element.innerHTML = html;
        const closeListElement = this.closeElement.lastElementChild as HTMLElement | null;
        if (closeListElement) {
            closeListElement.innerHTML = closeHtml;
        }
        const counterElement = this.closeElement.querySelector(".counter") as HTMLElement | null;
        if (counterElement) {
            counterElement.textContent = closeCounter.toString();
        }
        if (closeCounter) {
            this.closeElement.classList.remove("fn__none");
        } else {
            this.closeElement.classList.add("fn__none");
        }
        window.siyuan?.storage?.[Constants.LOCAL_FILESPATHS]?.forEach((item: IFilesPath) => {
            item.openPaths.forEach((openPath) => {
                void this.selectItem(item.notebookId, openPath, undefined, false, false);
            });
        });
        this.refreshPublishAccessSwitch();
        if (!init) {
            return;
        }
        const svgElement = this.closeElement.querySelector("svg") as Element | null;
        if (!svgElement) {
            return;
        }
        if (html !== "") {
            this.closeElement.style.height = "42px";
            svgElement.classList.remove("b3-list-item__arrow--open");
            closeListElement?.classList.add("fn__none");
        } else {
            this.closeElement.style.height = "40%";
            svgElement.classList.add("b3-list-item__arrow--open");
            closeListElement?.classList.remove("fn__none");
        }
    }

    public setCurrent(target: HTMLElement, isScroll = true) {
        if (!target) {
            return;
        }
        this.element.querySelectorAll("li.b3-list-item--focus").forEach((liItem) => {
            liItem.classList.remove("b3-list-item--focus");
        });
        target.classList.add("b3-list-item--focus");

        if (isScroll) {
            const elementRect = this.element.getBoundingClientRect();
            this.element.scrollTop = this.element.scrollTop + (target.getBoundingClientRect().top - (elementRect.top + elementRect.height / 2));
        }
    }

    public recordMovedExpandedDocIDs(ids: Iterable<string>) {
        for (const id of ids) {
            this.movedExpandedDocIDs.add(id);
        }
    }

    public restoreMovedExpandedItems(listElement: Element, notebookId: string) {
        restoreMovedExpandedDocItems(listElement, this.movedExpandedDocIDs, (item) => {
            this.getLeaf(item, notebookId, true);
        });
    }

    public updateDocActionElement(liElement: HTMLElement) {
        updateDocActionElement(liElement);
    }

    public getLeaf(liElement: Element, notebookId: string, focusUpdate = false) {
        const toggleElement = liElement.querySelector(".b3-list-item__arrow") as Element | null;
        if (!toggleElement) {
            return;
        }
        if (cancelFileTreeCollapse(liElement)) {
            this.persistOpenPaths();
            if (!focusUpdate) {
                return;
            }
        }
        const leafElement = liElement.nextElementSibling as HTMLElement | null;
        if (toggleElement.classList.contains("b3-list-item__arrow--open") && !focusUpdate) {
            toggleElement.classList.remove("b3-list-item__arrow--open");
            leafElement?.remove();
            this.persistOpenPaths();
            return;
        }
        fetchPost("/api/filetree/listDocsByPath", {
            notebook: notebookId,
            path: liElement.getAttribute("data-path"),
            app: Constants.SIYUAN_APPID,
        }, response => {
            if (response.data.path === "/" && response.data.files.length === 0) {
                newFileInTree(this.app, notebookId, "/");
                return;
            }
            onLsHTML(this, response.data);
            this.persistOpenPaths();
        });
    }

    public async selectItem(notebookId: string, filePath: string, data?: {
        files: IFile[],
        box: string,
        path: string
    }, setStorage = true, isSetCurrent = true) {
        const treeElement = this.element.querySelector(`[data-url="${notebookId}"]`);
        if (!treeElement) {
            // 有文件树和编辑器的布局初始化时，文件树还未挂载
            return;
        }
        const boxDocID = window.siyuan.config.fileTree.boxDocEnabled ? notebookId : "";
        if (boxDocID && filePath === `/${boxDocID}.sy`) {
            const boxDocElement = treeElement.querySelector<HTMLElement>('[data-type="navigation-root"]');
            if (isSetCurrent) {
                this.setCurrent(boxDocElement);
            }
            return boxDocElement;
        }
        let currentPath = filePath;
        let liElement: HTMLElement | null = null;
        const visitedPaths = new Set<string>();
        while (!liElement) {
            if (visitedPaths.has(currentPath)) {
                break;
            }
            visitedPaths.add(currentPath);
            liElement = treeElement.querySelector(`[data-path="${currentPath}"]`) as HTMLElement | null;
            if (!liElement) {
                const dirname = pathPosix().dirname(currentPath);
                if (dirname === "/") {
                    // 已到根且根不存在则停止，避免对 "/" 的无限查询
                    const rootElement = treeElement.querySelector(`[data-path="/"]`) as HTMLElement | null;
                    if (rootElement) {
                        liElement = rootElement;
                        currentPath = "/";
                    }
                    break;
                } else {
                    currentPath = dirname + ".sy";
                }
            }
        }
        if (!liElement) {
            return;
        }

        if (liElement.getAttribute("data-path") === filePath) {
            if (setStorage) {
                this.persistOpenPaths();
            }
            if (isSetCurrent) {
                this.setCurrent(liElement);
            }
            return liElement;
        }

        let nextLiElement: HTMLElement | null | undefined;
        if (data && data.path === currentPath) {
            nextLiElement = await onLsSelect(this, data, filePath, setStorage, isSetCurrent);
        } else {
            const response = await fetchSyncPost("/api/filetree/listDocsByPath", {
                notebook: notebookId,
                path: currentPath,
                app: Constants.SIYUAN_APPID,
            });
            nextLiElement = await onLsSelect(this, response.data, filePath, setStorage, isSetCurrent);
        }
        if (nextLiElement) {
            liElement = nextLiElement;
        }
        return liElement;
    }

    public persistOpenPaths() {
        const filesPaths: IFilesPath[] = [];
        this.element.querySelectorAll(".b3-list[data-url]").forEach((item: Element) => {
            const url = item.getAttribute("data-url");
            if (!url) {
                return;
            }
            const notebookPaths: IFilesPath = {
                notebookId: url,
                openPaths: []
            };
            item.querySelectorAll(".b3-list-item__arrow--open").forEach((openItem) => {
                const liElement = hasClosestByTag(openItem as HTMLElement, "LI");
                if (liElement) {
                    const dataPath = liElement.getAttribute("data-path");
                    if (dataPath) {
                        notebookPaths.openPaths.push(dataPath);
                    }
                }
            });
            if (notebookPaths.openPaths.length > 0) {
                for (let i = 0; i < notebookPaths.openPaths.length; i++) {
                    for (let j = i + 1; j < notebookPaths.openPaths.length; j++) {
                        if (notebookPaths.openPaths[j].startsWith(notebookPaths.openPaths[i].replace(".sy", ""))) {
                            notebookPaths.openPaths.splice(i, 1);
                            j--;
                        }
                    }
                }
                notebookPaths.openPaths.forEach((openPath, index) => {
                    const nextPath = this.element.querySelector(`[data-url="${notebookPaths.notebookId}"] li[data-path="${openPath}"]`)?.nextElementSibling?.firstElementChild?.getAttribute("data-path");
                    if (nextPath) {
                        notebookPaths.openPaths[index] = nextPath;
                    }
                });
                filesPaths.push(notebookPaths);
            }
        });
        window.siyuan.storage[Constants.LOCAL_FILESPATHS] = filesPaths;
        setStorageVal(Constants.LOCAL_FILESPATHS, filesPaths);
    }

    public refreshPublishAccessSwitch() {
        if (window.siyuan.config.readonly || window.siyuan.isPublish ||
            !this.actionsElement.querySelector('[data-type="publish-access"]')?.classList.contains("block__icon--active")) {
            return;
        }
        const ids: string[] = [];
        this.element.querySelectorAll("[data-url]").forEach((element: HTMLElement) => ids.push(element.getAttribute("data-url")));
        this.element.querySelectorAll('[data-type="navigation-file"][data-node-id]').forEach((element: HTMLElement) => ids.push(element.getAttribute("data-node-id")));
        fetchPost("/api/filetree/getPublishAccess", {
            ids
        }, response => {
            response.data.publishAccess.forEach((item: IPublishAccessItem) => {
                const element = this.element.querySelector(`[data-url="${item.id}"] .b3-list-item__switch`) || this.element.querySelector(`[data-node-id="${item.id}"] .b3-list-item__switch`);
                if (element) {
                    element.innerHTML = getPublishAccessOptionByLevel(getPublishAccessLevel(item.visible, item.password, item.disable)).iconHTML;
                }
            });
        });
    }

    public onFiletreeSortChanged(data: {notebook: string, parentPath: string}) {
        const notebookElement = this.element.querySelector(`ul[data-url="${data.notebook}"]`) as HTMLElement | null;
        if (!notebookElement) {
            return;
        }
        // 使用共享工具判断是否为自定义排序（处理继承的 15 情况），保证与桌面一致
        const listPath = data.parentPath === "/" ? "/" : `${data.parentPath}.sy`;
        const liElement = notebookElement.querySelector(`li[data-path="${listPath}"]`) as HTMLElement | null;
        const targetElement = liElement ?? notebookElement;
        if (!isCustomFileTreeList(targetElement)) {
            return;
        }
        if (!liElement?.nextElementSibling || liElement.nextElementSibling.tagName !== "UL") {
            return;
        }
        fetchPost("/api/filetree/listDocsByPath", {
            notebook: data.notebook,
            path: listPath,
            app: Constants.SIYUAN_APPID,
        }, (response) => onLsHTML(this, response.data));
    }

    public onNotebookSortChanged() {
        // 全局自定义排序变更时刷新所有已挂载的笔记本
        if (!isCustomFileTreeList(this.element)) {
            // 仅当全局为自定义排序或存在自定义排序的笔记本时才刷新
            const hasCustom = Array.from(this.element.querySelectorAll("ul[data-url]")).some((el) => isCustomFileTreeList(el as Element));
            if (!hasCustom && window.siyuan?.config?.fileTree?.sort !== 6) {
                return;
            }
        }
        setNoteBook(() => this.init(false));
    }

    private startTouchDrag(state: MobileFiles["touchDragState"], clientX: number, clientY: number, vibrate = false) {
        if (state.isDragging) {
            return;
        }
        state.isDragging = true;
        const ghostElement = document.createElement("ul");
        ghostElement.id = "dragGhost";
        ghostElement.append(state.selectedElement.cloneNode(true));
        ghostElement.setAttribute("style", `background-color: var(--b3-theme-surface);width: 100%;touch-action: none;margin-left: -50%;margin-top:20px;z-index:${window.siyuan.zIndex};position: fixed;top:${clientY}px;left:${clientX}px`);
        ghostElement.setAttribute("class", "b3-list b3-list--background");
        document.body.append(ghostElement);
        state.ghostElement = ghostElement;
        state.selectedElement.style.opacity = "0.38";
        if (vibrate) {
            if (window.webkit?.messageHandlers.vibrate) {
                window.webkit.messageHandlers.vibrate.postMessage("");
            } else if (navigator.vibrate) {
                navigator.vibrate(Constants.TIMEOUT_VIBRATION_DURATION);
            }
        }
    }

    private clearDragIndicators = () => {
        if (!this.touchDragState) return;
        this.element.querySelectorAll(".dragover__top, .dragover__bottom, .dragover").forEach(el => {
            el.classList.remove("dragover__top", "dragover__bottom", "dragover");
        });
    };

    private bindTouchDrag(filesElement: Element) {
        filesElement.addEventListener("touchstart", (event: TouchEvent) => {
            if (window.siyuan?.config?.readonly) return;
            if (event.touches.length !== 1) return;

            const touch = event.touches[0];
            if (!touch) return;
            const target = touch.target as HTMLElement | null;
            if (!target) return;
            const liElement = target.closest(".b3-list-item") as HTMLElement | null;
            if (!liElement) return;

            const dataType = liElement.getAttribute("data-type");
            if (dataType !== "navigation-file" && dataType !== "navigation-root") return;

            if (dataType === "navigation-root" && !isCustomFileTreeList(liElement)) {
                return;
            }
            this.touchDragState = {
                isDragging: false,
                selectedElement: liElement,
                startX: touch.clientX,
                startY: touch.clientY,
                ghostElement: null,
                startTime: Date.now() - (isMousePointerTouchEvent(event) ? Constants.TIMEOUT_LONGPRESS : 0),
            };
            if (!isMousePointerTouchEvent(event)) {
                const state = this.touchDragState;
                window.setTimeout(() => {
                    if (this.touchDragState !== state) {
                        return;
                    }
                    this.startTouchDrag(state, state.startX, state.startY, true);
                }, Constants.TIMEOUT_LONGPRESS);
            }
        }, {passive: false});
        this.element.addEventListener("scroll", () => {
            if (this.touchDragState && !this.touchDragState.isDragging) {
                this.touchDragState = null;
            }
        }, {passive: true});

        filesElement.addEventListener("touchmove", (event: TouchEvent) => {
            const state = this.touchDragState;
            if (!state) return;
            const touch = event.touches[0];
            if (!touch) return;
            if (!state.isDragging) {
                if (Date.now() - state.startTime < Constants.TIMEOUT_LONGPRESS &&
                    (Math.abs(touch.clientX - state.startX) > 5 || Math.abs(touch.clientY - state.startY) > 5)) {
                    this.touchDragState = null;
                    return;
                }
                if (Math.abs(touch.clientX - state.startX) < Constants.SIZE_DRAG_THRESHOLD &&
                    Math.abs(touch.clientY - state.startY) < Constants.SIZE_DRAG_THRESHOLD) return;
                this.startTouchDrag(state, touch.clientX, touch.clientY, !isMousePointerTouchEvent(event));
                event.preventDefault();
                event.stopPropagation();
            }

            if (state.isDragging) {
                event.preventDefault();
                event.stopPropagation();
                if (!state.ghostElement) return;
                state.ghostElement.style.left = `${touch.clientX}px`;
                state.ghostElement.style.top = `${touch.clientY}px`;

                // 手指接近列表上下边缘时自动滚动，避免拖拽时触不到屏外目标
                dragOverScroll({clientY: touch.clientY} as MouseEvent, this.element.getBoundingClientRect(), this.element);

                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                const liElement = target?.closest(".b3-list-item") as HTMLElement;
                if (!liElement) return;

                this.clearDragIndicators();
                const targetDataType = liElement.getAttribute("data-type");
                const selectedDataType = state.selectedElement.getAttribute("data-type");
                if (targetDataType === "navigation-file" && selectedDataType === "navigation-root") {
                    return;
                }
                if (selectedDataType === "navigation-file" && targetDataType === "navigation-root") {
                    liElement.classList.add("dragover");
                    return;
                }
                const liRect = liElement.getBoundingClientRect();
                if (selectedDataType === "navigation-root" && targetDataType === "navigation-root") {
                    if (touch.clientY > liRect.top + liRect.height / 2) {
                        liElement.classList.add("dragover__bottom");
                    } else {
                        liElement.classList.add("dragover__top");
                    }
                    return;
                }
                if (isCustomFileTreeList(liElement.parentElement as Element)) {
                    const dragHeight = liRect.height * .2;
                    if (touch.clientY > liRect.bottom - dragHeight) {
                        liElement.classList.add("dragover__bottom");
                    } else if (touch.clientY < liRect.top + dragHeight) {
                        liElement.classList.add("dragover__top");
                    }
                }

                if (!liElement.classList.contains("dragover__top") && !liElement.classList.contains("dragover__bottom") &&
                    !(selectedDataType === "navigation-root" && targetDataType === "navigation-root")) {
                    liElement.classList.add("dragover");
                }
            }
        }, {passive: false});

        filesElement.addEventListener("touchend", async () => {
            const state = this.touchDragState;
            if (!state) return;
            stopScrollAnimation();
            state.selectedElement.style.opacity = "";
            if (state.isDragging) {
                state.ghostElement?.remove();
                const newElement = this.element.querySelector(".dragover, .dragover__bottom, .dragover__top");
                if (!newElement) {
                    this.touchDragState = null;
                    return;
                }
                const newUlElement = hasTopClosestByTag(newElement, "UL");
                if (!newUlElement) {
                    this.clearDragIndicators();
                    this.touchDragState = null;
                    return;
                }
                const oldScrollTop = this.element.scrollTop;
                const toURL = newUlElement.getAttribute("data-url");
                const toPath = newElement.getAttribute("data-path");

                const selectRootElements: HTMLElement[] = [];
                const selectFileElements: HTMLElement[] = [];
                const fromPaths: string[] = [];
                if (state.selectedElement.getAttribute("data-type") === "navigation-root") {
                    selectRootElements.push(state.selectedElement);
                } else {
                    const dataPath = state.selectedElement.getAttribute("data-path");
                    // 禁止父节点移动到子节点 https://github.com/siyuan-note/siyuan/issues/12539
                    if (newElement.getAttribute("data-path").startsWith(dataPath.replace(".sy", ""))) {
                        this.clearDragIndicators();
                        this.touchDragState = null;
                        return;
                    }
                    fromPaths.push(dataPath);
                    selectFileElements.push(state.selectedElement);
                }

                if (newElement.classList.contains("dragover")) {
                    const sourceNotebookId = state.selectedElement.getAttribute("data-notebook-id") ||
                        state.selectedElement.closest("ul[data-url]")?.getAttribute("data-url") ||
                        state.selectedElement.getAttribute("data-url") || "";
                    // 校验移动目标合法性，例如禁止移入盒子文档笔记本
                    if (!isMoveTargetAllowed([sourceNotebookId], toURL)) {
                        showMessage(window.siyuan.languages._kernel[313]);
                        this.clearDragIndicators();
                        this.touchDragState = null;
                        return;
                    }
                    fetchPost("/api/filetree/moveDocs", {
                        toNotebook: toURL,
                        fromPaths,
                        toPath,
                    });
                    this.clearDragIndicators();
                    this.touchDragState = null;
                    return;
                }
                if (newElement.classList.contains("dragover__bottom") || newElement.classList.contains("dragover__top")) {
                    const ulSort = newUlElement.getAttribute("data-sortmode");
                    if (window.siyuan.config.fileTree.sort === 6 && selectRootElements.length > 0 &&
                        newElement.getAttribute("data-path") === "/") {
                        if (newElement.classList.contains("dragover__top")) {
                            selectRootElements.forEach(item => {
                                newElement.parentElement.before(item.parentElement);
                            });
                        } else {
                            selectRootElements.reverse().forEach(item => {
                                newElement.parentElement.after(item.parentElement);
                            });
                        }
                        const notebooks: string[] = [];
                        Array.from(this.element.children).forEach(item => {
                            notebooks.push(item.getAttribute("data-url"));
                        });
                        fetchPost("/api/notebook/changeSortNotebook", {
                            notebooks,
                        });
                    } else if ((ulSort === "6" || (window.siyuan.config.fileTree.sort === 6 && ulSort === "15")) && selectFileElements.length > 0) {
                        let hasMove = false;
                        const toDir = pathPosix().dirname(toPath);
                        if (fromPaths.length > 0) {
                            const sourceNotebookId = state.selectedElement.getAttribute("data-notebook-id") ||
                                state.selectedElement.closest("ul[data-url]")?.getAttribute("data-url") ||
                                state.selectedElement.getAttribute("data-url") || "";
                            if (!isMoveTargetAllowed([sourceNotebookId], toURL)) {
                                showMessage(window.siyuan.languages._kernel[313]);
                                this.clearDragIndicators();
                                this.touchDragState = null;
                                return;
                            }
                            await fetchSyncPost("/api/filetree/moveDocs", {
                                toNotebook: toURL,
                                fromPaths,
                                toPath: toDir === "/" ? "/" : toDir + ".sy",
                                callback: Constants.CB_MOVE_NOLIST,
                            });
                            selectFileElements.forEach(item => {
                                const fromPath = item.getAttribute("data-path");
                                const nodeId = item.getAttribute("data-node-id");
                                if (!fromPath || !nodeId) {
                                    return;
                                }
                                const newPath = pathPosix().join(toDir, `${nodeId}.sy`);
                                updateMovedSubtree(item, getFileTreeChildList(item), fromPath, newPath);
                            });
                            hasMove = true;
                        }
                        if (newElement.classList.contains("dragover__top")) {
                            selectFileElements.forEach(item => {
                                let nextULElement;
                                if (item.nextElementSibling && item.nextElementSibling.tagName === "UL") {
                                    nextULElement = item.nextElementSibling;
                                }
                                newElement.before(item);
                                if (nextULElement) {
                                    item.after(nextULElement);
                                }
                            });
                        } else if (newElement.classList.contains("dragover__bottom")) {
                            selectFileElements.reverse().forEach(item => {
                                let nextULElement;
                                if (item.nextElementSibling && item.nextElementSibling.tagName === "UL") {
                                    nextULElement = item.nextElementSibling;
                                }
                                if (newElement.nextElementSibling && newElement.nextElementSibling.tagName === "UL") {
                                    newElement.nextElementSibling.after(item);
                                } else {
                                    newElement.after(item);
                                }
                                if (nextULElement) {
                                    item.after(nextULElement);
                                }
                            });
                        }
                        const paths: string[] = [];
                        Array.from(newElement.parentElement.children).forEach(item => {
                            if (item.tagName === "LI") {
                                paths.push(item.getAttribute("data-path"));
                            }
                        });
                        fetchPost("/api/filetree/changeSort", {
                            paths,
                            notebook: toURL
                        }, () => {
                            if (hasMove) {
                                fetchPost("/api/filetree/listDocsByPath", {
                                    notebook: toURL,
                                    path: toDir === "/" ? "/" : toDir + ".sy",
                                    app: Constants.SIYUAN_APPID,
                                }, response => {
                                    if (response.data.path === "/" && response.data.files.length === 0) {
                                        showMessage(window.siyuan.languages.emptyContent);
                                        return;
                                    }
                                    onLsHTML(this, response.data, oldScrollTop);
                                });
                            }
                        });
                    }
                }
            }
            this.clearDragIndicators();
            this.touchDragState = null;
        });

        // 触摸取消、指针取消或窗口失焦时中止拖拽并清理拖拽现场
        const cancelTouchDrag = () => {
            stopScrollAnimation();
            this.touchDragState?.ghostElement?.remove();
            if (this.touchDragState?.selectedElement) {
                this.touchDragState.selectedElement.style.opacity = "";
            }
            this.clearDragIndicators();
            this.touchDragState = null;
        };
        filesElement.addEventListener("touchcancel", cancelTouchDrag);
        filesElement.addEventListener("pointercancel", cancelTouchDrag);
        window.addEventListener("blur", cancelTouchDrag);
    }

}
