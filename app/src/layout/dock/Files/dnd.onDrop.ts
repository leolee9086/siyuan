import { Files } from "../Files";
import { Constants } from "../../../constants";
import { hasTopClosestByTag } from "../../../protyle/util/hasClosest";
import { fetchPost, fetchSyncPost } from "../../../util/fetch";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { pathPosix } from "../../../util/pathName";
import { showMessage } from "../../../dialog/message";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";

export const onDrop = async (files: Files, event: DragEvent & { target: HTMLElement }) => {
    const newElement = files.element.querySelector(".dragover, .dragover__bottom, .dragover__top");
    if (!newElement) {
        return;
    }
    const newUlElement = hasTopClosestByTag(newElement, "UL");
    if (!newUlElement) {
        return;
    }
    const params = {
        oldScrollTop: files.element.scrollTop,
        toURL: newUlElement.getAttribute("data-url"),
        toPath: newElement.getAttribute("data-path"),
    };
    let gutterType = "";
    for (const item of event.dataTransfer.items) {
        if (item.type.startsWith(Constants.SIYUAN_DROP_GUTTER)) {
            gutterType = item.type;
        }
    }
    if (gutterType) {
        handleGutterDrop(newElement, gutterType, params);
        return;
    }
    await handleFileDrop(files, event, newElement, newUlElement, params);
};

const handleGutterDrop = (newElement: Element, gutterType: string, params: { toURL: string, toPath: string }) => {
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
            targetNoteBook: params.toURL,
            pushMode: 0,
        };
        if (newElement.classList.contains("dragover")) {
            toDocOptions.targetPath = params.toPath;
        } else if (newElement.classList.contains("dragover__bottom")) {
            toDocOptions.previousPath = params.toPath;
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
};

const handleFileDrop = async (files: Files, event: DragEvent, newElement: Element, newUlElement: Element, params: { toURL: string, toPath: string, oldScrollTop: number }) => {
    window.siyuan.dragElement = undefined;
    if (!event.dataTransfer.getData(Constants.SIYUAN_DROP_FILE)) {
        newElement.classList.remove("dragover", "dragover__bottom", "dragover__top");
        return;
    }
    const { selectRootElements, selectFileElements, fromPaths } = getSelectedFiles(files, newElement);
    if (fromPaths.length === 0 && selectRootElements.length === 0) {
        // Only return if nothing selected, but we might check loop inside getSelectedFiles?
        // Logic in original code checks if prevented loop.
        // If nothing gathered, and not handled, we probably shouldn't do anything.
        // But let's proceed to allow checks below.
    }

    if (newElement.classList.contains("dragover")) {
        if (fromPaths.length > 0) {
            fetchPost("/api/filetree/moveDocs", {
                toNotebook: params.toURL,
                fromPaths,
                toPath: params.toPath,
            });
        }
        newElement.classList.remove("dragover", "dragover__bottom", "dragover__top");
        return;
    }
    if (newElement.classList.contains("dragover__bottom") || newElement.classList.contains("dragover__top")) {
        await handleSort(files, newElement, newUlElement, selectRootElements, selectFileElements, fromPaths, params);
    }
    newElement.classList.remove("dragover", "dragover__bottom", "dragover__top");
};

const getSelectedFiles = (files: Files, newElement: Element) => {
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
                // 禁止父节点移动到子节点
                if (newElement.getAttribute("data-path").startsWith(item.dataset.path.replace(".sy", ""))) {
                    return;
                }
                selectFileElements.push(item);
                fromPaths.push(dataPath);
            }
        }
    });
    return { selectRootElements, selectFileElements, fromPaths };
};

const handleSort = async (files: Files, newElement: Element, newUlElement: Element, selectRootElements: HTMLElement[], selectFileElements: HTMLElement[], fromPaths: string[], params: { toURL: string, toPath: string, oldScrollTop: number }) => {
    const ulSort = newUlElement.getAttribute("data-sortmode");
    if (getSiyuanConfig().fileTree.sort === 6 && selectRootElements.length > 0 &&
        newElement.getAttribute("data-path") === "/") {
        handleRootSort(files, newElement, selectRootElements);
    } else if ((ulSort === "6" || (getSiyuanConfig().fileTree.sort === 6 && ulSort === "15")) && selectFileElements.length > 0) {
        await handleFileSort(files, newElement, selectFileElements, fromPaths, params);
    }
};

const handleRootSort = (files: Files, newElement: Element, selectRootElements: HTMLElement[]) => {
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
};

const handleFileSort = async (files: Files, newElement: Element, selectFileElements: HTMLElement[], fromPaths: string[], params: { toURL: string, toPath: string, oldScrollTop: number }) => {
    let hasMove = false;
    const toDir = pathPosix().dirname(params.toPath);
    if (fromPaths.length > 0) {
        await fetchSyncPost("/api/filetree/moveDocs", {
            toNotebook: params.toURL,
            fromPaths,
            toPath: toDir === "/" ? "/" : toDir + ".sy",
            callback: Constants.CB_MOVE_NOLIST,
        });
        for (const item of selectFileElements) {
            item.setAttribute("data-path", pathPosix().join(toDir, item.getAttribute("data-node-id") + ".sy"));
        }
        hasMove = true;
    }
    updateDOMPosition(newElement, selectFileElements);

    finalizeSort(files, newElement, params, toDir, hasMove);
};

const updateDOMPosition = (newElement: Element, selectFileElements: HTMLElement[]) => {
    if (newElement.classList.contains("dragover__top")) {
        for (const item of selectFileElements) {
            let nextULElement;
            if (item.nextElementSibling && item.nextElementSibling.tagName === "UL") {
                nextULElement = item.nextElementSibling;
            }
            newElement.before(item);
            if (nextULElement) {
                item.after(nextULElement);
            }
        }
        return;
    }

    if (newElement.classList.contains("dragover__bottom")) {
        for (const item of selectFileElements.reverse()) {
            let nextULElement;
            if (item.nextElementSibling && item.nextElementSibling.tagName === "UL") {
                nextULElement = item.nextElementSibling;
            }

            let targetElement = newElement;
            if (newElement.nextElementSibling && newElement.nextElementSibling.tagName === "UL") {
                targetElement = newElement.nextElementSibling;
            }
            targetElement.after(item);

            if (nextULElement) {
                item.after(nextULElement);
            }
        }
    }
};

const finalizeSort = (files: Files, newElement: Element, params: { toURL: string, oldScrollTop: number }, toDir: string, hasMove: boolean) => {
    const paths: string[] = [];
    for (const item of Array.from(newElement.parentElement.children)) {
        if (item.tagName === "LI") {
            paths.push(item.getAttribute("data-path"));
        }
    }
    fetchPost("/api/filetree/changeSort", {
        paths,
        notebook: params.toURL
    }, () => onSortChanged(files, params, toDir, hasMove));
};

const onSortChanged = (files: Files, params: { toURL: string, oldScrollTop: number }, toDir: string, hasMove: boolean) => {
    if (hasMove) {
        fetchPost("/api/filetree/listDocsByPath", {
            notebook: params.toURL,
            path: toDir === "/" ? "/" : toDir + ".sy",
            app: Constants.SIYUAN_APPID,
        }, response => onListDocs(files, params.oldScrollTop, response));
    }
};

const onListDocs = (files: Files, oldScrollTop: number, response: IWebSocketData) => {
    if (response.data.path === "/" && response.data.files.length === 0) {
        showMessage(siyuanI18n.emptyContent);
        return;
    }
    files.onLsHTML(response.data, oldScrollTop);
};
