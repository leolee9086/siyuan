import type {FilesDomain} from "./eventHandlers.types";
import { Constants } from "../../../constants";
import { hasTopClosestByTag } from "../../../protyle/util/hasClosest";
import { hideDragTip } from "../../../protyle/util/dragTip";
import { fetchPost, fetchSyncPost } from "../../../util/network/fetch";
import { getSiyuanConfig, getSiyuanDragElement, setSiyuanDragElement } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { pathPosix } from "../../../util/file/pathName";
import {isMoveTargetAllowed} from "../../../util/file/moveTarget";
import {insertDocumentsSortPaths} from "../../../util/fileTreeMove";
import {isCustomFileTreeList} from "../../../util/fileTreeSort";
import { showMessage } from "../../../dialog/message";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { onLsHTMLHandler } from "./onLsHTML";
import {getFileTreeChildList, updateMovedSubtree} from "../../../util/fileTreeMove";

export const onDrop = async (files: FilesDomain, event: DragEvent) => {
    hideDragTip();
    window.siyuan.dragTitle = "";
    const newElement = files.element.querySelector(".dragover, .dragover__bottom, .dragover__top");
    if (!newElement) {
        return;
    }
    const newUlElement = hasTopClosestByTag(newElement, "UL");
    if (!newUlElement) {
        return;
    }
    const toURL = newUlElement.getAttribute("data-url");
    const toPath = newElement.getAttribute("data-path");
    if (!toURL || !toPath) {
        return;
    }
    const params = {
        oldScrollTop: files.element.scrollTop,
        toURL,
        toPath,
    };
    let gutterType = "";
    if (!event.dataTransfer) {
        return;
    }
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
    const sourceElement = getSiyuanDragElement();
    const sourceNotebookId = sourceElement?.getAttribute("data-notebook-id") ||
        sourceElement?.closest("ul[data-url]")?.getAttribute("data-url") || "";
    if (!isMoveTargetAllowed([sourceNotebookId], params.toURL)) {
        showMessage(window.siyuan.languages._kernel[313]);
        newElement.classList.remove("dragover", "dragover__bottom", "dragover__top");
        setSiyuanDragElement(undefined);
        return;
    }
    const gutterTypes = gutterType.replace(Constants.SIYUAN_DROP_GUTTER, "").split(Constants.ZWSP);
    const type = gutterTypes[0];
    if (type && ["nodelistitem", "nodeheading"].includes(type)) {
        handleGutterDropNode(newElement, gutterTypes, params);
    }
    newElement.classList.remove("dragover", "dragover__bottom", "dragover__top");
    setSiyuanDragElement(undefined);
};

const handleGutterDropNode = (newElement: Element, gutterTypes: string[], params: { toURL: string, toPath: string }) => {
    const toDocOptions: {
        targetNoteBook: string;
        pushMode: number;
        srcHeadingID?: string;
        srcListItemID?: string;
        targetPath?: string;
        previousPath?: string;
        toTop?: boolean;
    } = {
        targetNoteBook: params.toURL,
        pushMode: 0,
    };
    if (newElement.classList.contains("dragover")) {
        toDocOptions.targetPath = params.toPath;
    }
    if (newElement.classList.contains("dragover__bottom")) {
        toDocOptions.previousPath = params.toPath;
    }

    const isTop = newElement.classList.contains("dragover__top");
    const topPreviousPath = (isTop && newElement.previousElementSibling) ? newElement.previousElementSibling.getAttribute("data-path") : null;
    if (topPreviousPath) {
        toDocOptions.previousPath = topPreviousPath;
    }

    const topTargetPath = (isTop && !newElement.previousElementSibling && newElement.parentElement && newElement.parentElement.previousElementSibling) ? newElement.parentElement.previousElementSibling.getAttribute("data-path") : null;
    if (topTargetPath) {
        toDocOptions.targetPath = topTargetPath;
        toDocOptions.toTop = true;
    }

    const gutterType2 = gutterTypes[2];
    const sourceID = gutterType2 ? gutterType2.split(",")[0] : "";

    if (sourceID && gutterTypes[0] === "nodeheading") {
        toDocOptions.srcHeadingID = sourceID;
    }
    if (sourceID && gutterTypes[0] !== "nodeheading") {
        toDocOptions.srcListItemID = sourceID;
    }

    if (gutterTypes[0] === "nodeheading") {
        fetchPost("/api/filetree/heading2Doc", toDocOptions);
        return;
    }
    fetchPost("/api/filetree/li2Doc", toDocOptions);
};

const handleFileDrop = async (files: FilesDomain, event: DragEvent, newElement: Element, newUlElement: Element, params: { toURL: string, toPath: string, oldScrollTop: number }) => {
    setSiyuanDragElement(undefined);
    if (!event.dataTransfer?.getData(Constants.SIYUAN_DROP_FILE)) {
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
        handleMoveDrop(newElement, params, fromPaths, selectFileElements);
        return;
    }
    if (newElement.classList.contains("dragover__bottom") || newElement.classList.contains("dragover__top")) {
        await handleSort(files, newElement, newUlElement, selectRootElements, selectFileElements, fromPaths, params);
    }
    newElement.classList.remove("dragover", "dragover__bottom", "dragover__top");
};

const handleMoveDrop = (
    newElement: Element,
    params: { toURL: string, toPath: string },
    fromPaths: string[],
    sourceElements: HTMLElement[],
) => {
    const sourceNotebookIds = sourceElements.map((item) => item.getAttribute("data-notebook-id") ||
        item.closest("ul[data-url]")?.getAttribute("data-url") || "");
    if (fromPaths.length > 0 && !isMoveTargetAllowed(sourceNotebookIds, params.toURL)) {
        showMessage(window.siyuan.languages._kernel[313]);
        newElement.classList.remove("dragover", "dragover__bottom", "dragover__top");
        return;
    }
    if (fromPaths.length > 0) {
        fetchPost("/api/filetree/moveDocs", {
            toNotebook: params.toURL,
            fromPaths,
            toPath: params.toPath,
        });
    }
    newElement.classList.remove("dragover", "dragover__bottom", "dragover__top");
};

const getSelectedFiles = (files: FilesDomain, newElement: Element) => {
    const selectRootElements: HTMLElement[] = [];
    const selectFileElements: HTMLElement[] = [];
    const fromPaths: string[] = [];
    const newElementPath = newElement.getAttribute("data-path");
    if (!newElementPath) {
        return { selectRootElements, selectFileElements, fromPaths };
    }
    for (const item of files.element.querySelectorAll<HTMLElement>(".b3-list-item--focus")) {
        if (item.getAttribute("data-type") === "navigation-root") {
            selectRootElements.push(item);
            continue;
        }
        const dataPath = item.getAttribute("data-path");
        if (!dataPath) {
            continue;
        }
        const isChild = fromPaths.find(itemPath => dataPath.startsWith(itemPath.replace(".sy", "")));
        if (isChild) {
            continue;
        }
        // 禁止父节点移动到子节点
        if (newElementPath.startsWith(dataPath.replace(".sy", ""))) {
            continue;
        }
        selectFileElements.push(item);
        fromPaths.push(dataPath);
    }
    return { selectRootElements, selectFileElements, fromPaths };
};

const handleSort = async (files: FilesDomain, newElement: Element, newUlElement: Element, selectRootElements: HTMLElement[], selectFileElements: HTMLElement[], fromPaths: string[], params: { toURL: string, toPath: string, oldScrollTop: number }) => {
    if (getSiyuanConfig().fileTree.sort === 6 && selectRootElements.length > 0 &&
        newElement.getAttribute("data-path") === "/") {
        handleRootSort(files, newElement, selectRootElements);
        return;
    }

    if (isCustomFileTreeList(newUlElement) && selectFileElements.length > 0) {
        await handleFileSort(files, newElement, selectFileElements, fromPaths, params);
    }
};

const handleRootSort = (files: FilesDomain, newElement: Element, selectRootElements: HTMLElement[]) => {
    if (!newElement.parentElement) {
        return;
    }
    const isTop = newElement.classList.contains("dragover__top");
    if (isTop) {
        for (const item of selectRootElements) {
            if (item.parentElement) {
                newElement.parentElement.before(item.parentElement);
            }
        }
    }

    if (!isTop) {
        for (const item of selectRootElements.reverse()) {
            if (item.parentElement) {
                newElement.parentElement.after(item.parentElement);
            }
        }
    }

    const notebooks = Array.from(files.element.children).map(item => item.getAttribute("data-url"));
    fetchPost("/api/notebook/changeSortNotebook", {
        notebooks,
    });
};

const handleFileSort = async (
    files: FilesDomain,
    newElement: Element,
    selectFileElements: HTMLElement[],
    fromPaths: string[],
    params: { toURL: string, toPath: string, oldScrollTop: number },
) => {
    const sourceNotebookIds = selectFileElements.map((item) => item.getAttribute("data-notebook-id") ||
        item.closest("ul[data-url]")?.getAttribute("data-url") || "");
    if (!isMoveTargetAllowed(sourceNotebookIds, params.toURL)) {
        showMessage(window.siyuan.languages._kernel[313]);
        return;
    }
    const toDir = pathPosix().dirname(params.toPath);
    const newPaths = selectFileElements.map((item) =>
        pathPosix().join(toDir, `${item.getAttribute("data-node-id") || ""}.sy`)
    );
    const siblingPaths = Array.from(newElement.parentElement?.children || []).reduce<string[]>((paths, item) => {
        const itemPath = item.getAttribute("data-path");
        if (item.tagName === "LI" && itemPath) {
            paths.push(itemPath);
        }
        return paths;
    }, []);
    const newElementClassList = newElement.getAttribute("class") || "";
    const sortedPaths = insertDocumentsSortPaths(
        siblingPaths,
        newPaths,
        params.toPath,
        newElementClassList.includes("dragover__bottom"),
    );
    if (!sortedPaths || (sortedPaths.length === siblingPaths.length &&
        sortedPaths.every((itemPath, index) => itemPath === siblingPaths[index]))) {
        return;
    }

    let hasMove = false;
    if (fromPaths.length > 0) {
        const moveResponse = await fetchSyncPost("/api/filetree/moveDocs", {
            toNotebook: params.toURL,
            fromPaths,
            toPath: toDir === "/" ? "/" : toDir + ".sy",
            callback: Constants.CB_MOVE_NOLIST,
        });
        if (moveResponse.code !== 0) {
            return;
        }
        selectFileElements.forEach((item, index) => {
            const fromPath = item.getAttribute("data-path");
            if (!fromPath || !newPaths[index]) {
                return;
            }
            updateMovedSubtree(item, getFileTreeChildList(item), fromPath, newPaths[index]);
        });
        hasMove = true;
    }
    updateDOMPosition(newElement, selectFileElements, newElementClassList);
    finalizeSort(files, newElement, params, toDir, hasMove, sortedPaths);
};

const updateDOMPosition = (newElement: Element, selectFileElements: HTMLElement[], newElementClassList: string) => {
    if (newElementClassList.includes("dragover__top")) {
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

    if (newElementClassList.includes("dragover__bottom")) {
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

const finalizeSort = (
    files: FilesDomain,
    newElement: Element,
    params: { toURL: string, oldScrollTop: number },
    toDir: string,
    hasMove: boolean,
    sortedPaths: string[],
) => {
    if (!newElement.parentElement) {
        return;
    }
    fetchPost("/api/filetree/changeSort", {
        paths: sortedPaths,
        notebook: params.toURL,
    }, () => onSortChanged(files, params, toDir, hasMove));
};

const onSortChanged = (files: FilesDomain, params: { toURL: string, oldScrollTop: number }, toDir: string, hasMove: boolean) => {
    if (hasMove) {
        fetchPost("/api/filetree/listDocsByPath", {
            notebook: params.toURL,
            path: toDir === "/" ? "/" : toDir + ".sy",
            app: Constants.SIYUAN_APPID,
        }, response => onListDocs(files, params.oldScrollTop, response));
    }
};

const onListDocs = (files: FilesDomain, oldScrollTop: number, response: IWebSocketData) => {
    // 根目录且无文件时显示空内容提示
    if (response.data.path === "/" && response.data.files.length === 0) {
        showMessage(siyuanI18n.emptyContent);
        return;
    }
    onLsHTMLHandler(files.element, response.data, oldScrollTop, (listElement) => {
        files.restoreMovedExpandedItems(listElement, response.data.box);
        files.refreshPublishAccessSwitch();
    });
};
