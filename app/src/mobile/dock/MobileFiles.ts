import {hasClosestByTag} from "../../protyle/util/hasClosest";
import {Model} from "../../layout/Model";
import {Constants} from "../../constants";
import {pathPosix, setNoteBook} from "../../util/file/pathName";
import {fetchPost, fetchSyncPost} from "../../util/network/fetch";
import {genUUID} from "../../util/platform/genID";
import {newFile} from "../../util/file/newFile";
import {App} from "../../index";
import {setStorageVal} from "../../protyle/util/compatibility";
import {genNotebook, updateItemArrow, onMove, onRemove, onRename, onMount} from "./MobileFiles.ws";
import {bindClickEvent} from "./MobileFiles.event";
import {onLsHTML, onLsSelect} from "./MobileFiles.render";
import {
    getPublishAccessLevel,
    getPublishAccessOptionByLevel
} from "../../protyle/util/publishAccess";

export class MobileFiles extends Model {
    public element: HTMLElement;
    private actionsElement: HTMLElement;
    private closeElement: HTMLElement;
    private touchDragState: {
        selectedElement: HTMLElement;
        startX: number;
        startY: number;
        isDragging: boolean;
        ghostElement: HTMLElement;
        startTime: number;
    };

    constructor(app: App) {
        super({app});
        this.connect({
            id: genUUID(),
            type: "filetree",
            msgCallback: this.handleMsgCallback.bind(this),
        });
        const filesElement = document.querySelector('#sidebar [data-type="sidebar-file"]');
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
    }

    private handleMsgCallback(data: IWebSocketData) {
        if (!data) {
            return;
        }
        switch (data.cmd) {
            case "moveDoc":
                onMove(this, data.data);
                break;
            case "reloadFiletree":
                setNoteBook(() => {
                    this.init(false);
                });
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
            case "renamenotebook":
                this.element.querySelector(`[data-url="${data.data.box}"] .b3-list-item__text`).innerHTML = data.data.name;
                break;
            case "rename":
                onRename(this, data.data);
                break;
        }
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
        this.closeElement.lastElementChild.innerHTML = closeHtml;
        const counterElement = this.closeElement.querySelector(".counter");
        counterElement.textContent = closeCounter.toString();
        if (closeCounter) {
            this.closeElement.classList.remove("fn__none");
        } else {
            this.closeElement.classList.add("fn__none");
        }
        window.siyuan.storage[Constants.LOCAL_FILESPATHS].forEach((item: IFilesPath) => {
            item.openPaths.forEach((openPath) => {
                this.selectItem(item.notebookId, openPath, undefined, false, false);
            });
        });
        this.refreshPublishAccessSwitch();
        if (!init) {
            return;
        }
        const svgElement = this.closeElement.querySelector("svg");
        if (html !== "") {
            this.closeElement.style.height = "42px";
            svgElement.classList.remove("b3-list-item__arrow--open");
            this.closeElement.lastElementChild.classList.add("fn__none");
        } else {
            this.closeElement.style.height = "40%";
            svgElement.classList.add("b3-list-item__arrow--open");
            this.closeElement.lastElementChild.classList.remove("fn__none");
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

    public getLeaf(liElement: Element, notebookId: string, focusUpdate = false) {
        const toggleElement = liElement.querySelector(".b3-list-item__arrow");
        if (toggleElement.classList.contains("b3-list-item__arrow--open") && !focusUpdate) {
            toggleElement.classList.remove("b3-list-item__arrow--open");
            liElement.nextElementSibling?.remove();
            this.getOpenPaths();
            return;
        }
        fetchPost("/api/filetree/listDocsByPath", {
            notebook: notebookId,
            path: liElement.getAttribute("data-path"),
            app: Constants.SIYUAN_APPID,
        }, response => {
            if (response.data.path === "/" && response.data.files.length === 0) {
                newFile({
                    app: this.app,
                    notebookId,
                    currentPath: "/",
                    useSavePath: false,
                    listDocTree: true,
                });
                return;
            }
            onLsHTML(this, response.data);
            this.getOpenPaths();
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
        let currentPath = filePath;
        let liElement: HTMLElement;
        while (!liElement) {
            liElement = treeElement.querySelector(`[data-path="${currentPath}"]`);
            if (!liElement) {
                const dirname = pathPosix().dirname(currentPath);
                if (dirname === "/") {
                    currentPath = dirname;
                } else {
                    currentPath = dirname + ".sy";
                }
            }
        }

        if (liElement.getAttribute("data-path") === filePath) {
            if (setStorage) {
                this.getOpenPaths();
            }
            if (isSetCurrent) {
                this.setCurrent(liElement);
            }
            return liElement;
        }

        if (data && data.path === currentPath) {
            liElement = await onLsSelect(this, data, filePath, setStorage, isSetCurrent);
        } else {
            const response = await fetchSyncPost("/api/filetree/listDocsByPath", {
                notebook: notebookId,
                path: currentPath,
                app: Constants.SIYUAN_APPID,
            });
            liElement = await onLsSelect(this, response.data, filePath, setStorage, isSetCurrent);
        }
        return liElement;
    }

    private getOpenPaths() {
        const filesPaths: IFilesPath[] = [];
        this.element.querySelectorAll(".b3-list[data-url]").forEach((item: HTMLElement) => {
            const notebookPaths: IFilesPath = {
                notebookId: item.getAttribute("data-url"),
                openPaths: []
            };
            item.querySelectorAll(".b3-list-item__arrow--open").forEach((openItem) => {
                const liElement = hasClosestByTag(openItem, "LI");
                if (liElement) {
                    notebookPaths.openPaths.push(liElement.getAttribute("data-path"));
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
        this.element.querySelectorAll("[data-node-id]").forEach((element: HTMLElement) => ids.push(element.getAttribute("data-node-id")));
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

}
