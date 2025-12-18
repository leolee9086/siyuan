
import { Files } from "../Files";
import { Constants } from "../../../constants";
import { showTooltip } from "../../../dialog/tooltip";
import {
    hasClosestByAttribute,
    hasClosestByClassName,
    hasClosestByTag,
    hasTopClosestByTag
} from "../../../protyle/util/hasClosest";
/// #if !BROWSER
import { ipcRenderer } from "electron";
/// #endif
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { fetchPost, fetchSyncPost } from "../../../util/fetch";
import { pathPosix } from "../../../util/pathName";
import { showMessage } from "../../../dialog/message";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { onDragStart } from "./dnd.onDragStart";

export const initFilesDrag = (files: Files) => {
    files.element.addEventListener("dragstart", (event: DragEvent & { target: HTMLElement }) => {
        onDragStart(files, event);
    });
    files.element.addEventListener("dragend", (event) => {
        files.parent.panelElement.classList.remove("sy__file--disablehover");
        files.element.querySelectorAll('.b3-list-item[style*="opacity: 0.38;"]').forEach((item: HTMLElement, index) => {
            item.style.opacity = "";
            // https://github.com/siyuan-note/siyuan/issues/11587
            if (index === 0 && hasClosestByClassName(document.elementFromPoint(event.clientX, event.clientY), "sy__file")) {
                const ariaLabelElement = item.querySelector(".ariaLabel");
                if (ariaLabelElement) {
                    showTooltip(ariaLabelElement.getAttribute("aria-label"), ariaLabelElement);
                }
            }
        });
        window.siyuan.dragElement = undefined;
        /// #if !BROWSER
        ipcRenderer.send(Constants.SIYUAN_SEND_WINDOWS, { cmd: "resetTabsStyle", data: "rmDragStyle" });
        /// #else
        document.querySelectorAll(".layout-tab-bars--drag").forEach(item => {
            item.classList.remove("layout-tab-bars--drag");
        });
        /// #endif
    });
    files.element.addEventListener("dragover", (event: DragEvent & { target: HTMLElement }) => {
        if (getSiyuanConfig().readonly || event.dataTransfer.types.includes(Constants.SIYUAN_DROP_TAB)) {
            return;
        }
        let liElement = hasClosestByTag(event.target, "LI");
        if (!liElement) {
            liElement = hasClosestByTag(document.elementFromPoint(event.clientX, event.clientY - 1), "LI");
        }
        if (!liElement || !window.siyuan.dragElement) {
            event.preventDefault();
            return;
        }
        files.element.querySelectorAll(".dragover, .dragover__bottom, .dragover__top").forEach((item: HTMLElement) => {
            item.classList.remove("dragover", "dragover__bottom", "dragover__top");
        });
        let gutterType = "";
        for (const item of event.dataTransfer.items) {
            if (item.type.startsWith(Constants.SIYUAN_DROP_GUTTER)) {
                gutterType = item.type;
            }
        }
        if (gutterType) {
            // 块标拖拽
            const gutterTypes = gutterType.replace(Constants.SIYUAN_DROP_GUTTER, "").split(Constants.ZWSP);
            if (!["nodelistitem", "nodeheading"].includes(gutterTypes[0])) {
                event.preventDefault();
                return;
            }
        } else if (liElement.classList.contains("b3-list-item--focus")) {
            // 选中的文档不能拖拽到自己上，但允许标题拖拽到文档树的选中文档上 https://github.com/siyuan-note/siyuan/issues/6552
            return;
        }
        let sourceOnlyRoot = gutterType ? false : true;
        Array.from(files.element.querySelectorAll(".b3-list-item--focus")).find((item: HTMLElement) => {
            if (item.getAttribute("data-type") === "navigation-file") {
                sourceOnlyRoot = false;
                return true;
            }
        });
        const targetType = liElement.getAttribute("data-type");
        if (sourceOnlyRoot && targetType !== "navigation-root") {
            event.preventDefault();
            return;
        }
        const notebookElement = hasClosestByAttribute(liElement, "data-sortmode", null);
        if (!notebookElement) {
            return;
        }
        const notebookSort = notebookElement.getAttribute("data-sortmode");
        if ((sourceOnlyRoot && targetType === "navigation-root" && getSiyuanConfig().fileTree.sort === 6) ||
            (!sourceOnlyRoot && targetType !== "navigation-root" &&
                (notebookSort === "6" || (getSiyuanConfig().fileTree.sort === 6 && notebookSort === "15")))
        ) {
            const nodeRect = liElement.getBoundingClientRect();
            const dragHeight = nodeRect.height * .2;
            if (targetType === "navigation-root" && sourceOnlyRoot) {
                if (event.clientY > nodeRect.top + nodeRect.height / 2) {
                    (liElement as HTMLElement).classList.add("dragover__bottom");
                } else {
                    (liElement as HTMLElement).classList.add("dragover__top");
                }
            } else if (event.clientY > nodeRect.bottom - dragHeight) {
                (liElement as HTMLElement).classList.add("dragover__bottom");
            } else if (event.clientY < nodeRect.top + dragHeight) {
                (liElement as HTMLElement).classList.add("dragover__top");
            }
            event.preventDefault();
        }
        if (liElement.classList.contains("dragover__top") || liElement.classList.contains("dragover__bottom") ||
            (targetType === "navigation-root" && sourceOnlyRoot)) {
            event.preventDefault();
            return;
        }
        liElement.classList.add("dragover");
        event.preventDefault();
    });
    let counter = 0;
    files.element.addEventListener("dragleave", () => {
        counter--;
        if (counter === 0) {
            files.element.querySelectorAll(".dragover, .dragover__bottom, .dragover__top").forEach((item: HTMLElement) => {
                item.classList.remove("dragover", "dragover__bottom", "dragover__top");
            });
        }
    });
    files.element.addEventListener("dragenter", (event) => {
        event.preventDefault();
        counter++;
    });
    files.element.addEventListener("drop", async (event: DragEvent & { target: HTMLElement }) => {
        counter = 0;
        const newElement = files.element.querySelector(".dragover, .dragover__bottom, .dragover__top");
        if (!newElement) {
            return;
        }
        const newUlElement = hasTopClosestByTag(newElement, "UL");
        if (!newUlElement) {
            return;
        }
        const oldScrollTop = files.element.scrollTop;
        const toURL = newUlElement.getAttribute("data-url");
        const toPath = newElement.getAttribute("data-path");
        let gutterType = "";
        for (const item of event.dataTransfer.items) {
            if (item.type.startsWith(Constants.SIYUAN_DROP_GUTTER)) {
                gutterType = item.type;
            }
        }
        // 块标拖拽
        if (gutterType) {
            const gutterTypes = gutterType.replace(Constants.SIYUAN_DROP_GUTTER, "").split(Constants.ZWSP);
            if (["nodelistitem", "nodeheading"].includes(gutterTypes[0])) {
                const toDocOptions: {
                    targetNoteBook: string;
                    pushMode: number;
                    srcHeadingID?: string;
                    srcListItemID?: string;
                    targetPath?: string;
                    previousPath?: string;
                } = {
                    targetNoteBook: toURL,
                    pushMode: 0,
                };
                if (newElement.classList.contains("dragover")) {
                    toDocOptions.targetPath = toPath;
                } else if (newElement.classList.contains("dragover__bottom")) {
                    toDocOptions.previousPath = toPath;
                } else if (newElement.classList.contains("dragover__top")) {
                    if (newElement.previousElementSibling) {
                        toDocOptions.previousPath = newElement.previousElementSibling.getAttribute("data-path");
                    } else {
                        toDocOptions.targetPath = newElement.parentElement.previousElementSibling.getAttribute("data-path");
                    }
                }
                if (gutterTypes[0] === "nodeheading") {
                    toDocOptions.srcHeadingID = gutterTypes[2].split(",")[0];
                    fetchPost("/api/filetree/heading2Doc", toDocOptions);
                } else {
                    toDocOptions.srcListItemID = gutterTypes[2].split(",")[0];
                    fetchPost("/api/filetree/li2Doc", toDocOptions);
                }
            }
            newElement.classList.remove("dragover", "dragover__bottom", "dragover__top");
            window.siyuan.dragElement = undefined;
            return;
        }
        window.siyuan.dragElement = undefined;
        if (!event.dataTransfer.getData(Constants.SIYUAN_DROP_FILE)) {
            newElement.classList.remove("dragover", "dragover__bottom", "dragover__top");
            return;
        }
        const selectRootElements: HTMLElement[] = [];
        const selectFileElements: HTMLElement[] = [];
        const fromPaths: string[] = [];
        files.element.querySelectorAll(".b3-list-item--focus").forEach((item: HTMLElement) => {
            if (item.getAttribute("data-type") === "navigation-root") {
                selectRootElements.push(item);
            } else {
                const dataPath = item.getAttribute("data-path");
                const isChild = fromPaths.find(itemPath => {
                    if (dataPath.startsWith(itemPath.replace(".sy", ""))) {
                        return true;
                    }
                });
                if (!isChild) {
                    // 禁止父节点移动到子节点 https://github.com/siyuan-note/siyuan/issues/12539
                    if (newElement.getAttribute("data-path").startsWith(item.dataset.path.replace(".sy", ""))) {
                        return;
                    }
                    selectFileElements.push(item);
                    fromPaths.push(dataPath);
                }
            }
        });
        if (newElement.classList.contains("dragover")) {
            fetchPost("/api/filetree/moveDocs", {
                toNotebook: toURL,
                fromPaths,
                toPath,
            });
            newElement.classList.remove("dragover", "dragover__bottom", "dragover__top");
            return;
        }
        if (newElement.classList.contains("dragover__bottom") || newElement.classList.contains("dragover__top")) {
            const ulSort = newUlElement.getAttribute("data-sortmode");
            if (getSiyuanConfig().fileTree.sort === 6 && selectRootElements.length > 0 &&
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
                Array.from(files.element.children).forEach(item => {
                    notebooks.push(item.getAttribute("data-url"));
                });
                fetchPost("/api/notebook/changeSortNotebook", {
                    notebooks,
                });
            } else if ((ulSort === "6" || (getSiyuanConfig().fileTree.sort === 6 && ulSort === "15")) && selectFileElements.length > 0) {
                let hasMove = false;
                const toDir = pathPosix().dirname(toPath);
                if (fromPaths.length > 0) {
                    await fetchSyncPost("/api/filetree/moveDocs", {
                        toNotebook: toURL,
                        fromPaths,
                        toPath: toDir === "/" ? "/" : toDir + ".sy",
                        callback: Constants.CB_MOVE_NOLIST,
                    });
                    selectFileElements.forEach(item => {
                        item.setAttribute("data-path", pathPosix().join(toDir, item.getAttribute("data-node-id") + ".sy"));
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
                                showMessage(siyuanI18n.emptyContent);
                                return;
                            }
                            files.onLsHTML(response.data, oldScrollTop);
                        });
                    }
                });
            }
        }
        newElement.classList.remove("dragover", "dragover__bottom", "dragover__top");
    });
};
