import type {FilesDomain} from "./eventHandlers.types";
import { Constants } from "../../../constants";
import {
    hasClosestByAttribute,
    hasClosestByTag,
} from "../../../protyle/util/hasClosest";
import { hideDragTip, showDragTip } from "../../../protyle/util/dragTip";
import { getSiyuanConfig, getSiyuanDragElement } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";

const handleDragSort = (liElement: HTMLElement, event: DragEvent, sourceOnlyRoot: boolean, targetType: string | null, notebookSort: string | null) => {
    const isSort6 = getSiyuanConfig().fileTree.sort === 6;
    const condition1 = sourceOnlyRoot && targetType === "navigation-root" && isSort6;
    const condition2 = !sourceOnlyRoot && targetType !== "navigation-root" && (notebookSort === "6" || (isSort6 && notebookSort === "15"));

    if (!condition1 && !condition2) {
        return;
    }

    const nodeRect = liElement.getBoundingClientRect();
    if (targetType === "navigation-root" && sourceOnlyRoot) {
        liElement.classList.add(event.clientY > nodeRect.top + nodeRect.height / 2 ? "dragover__bottom" : "dragover__top");
        event.preventDefault();
        return;
    }

    if (event.clientY > nodeRect.bottom - nodeRect.height * .2) {
        liElement.classList.add("dragover__bottom");
        event.preventDefault();
        return;
    }

    if (event.clientY < nodeRect.top + nodeRect.height * .2) {
        liElement.classList.add("dragover__top");
    }
    event.preventDefault();
};

const getGutterType = (event: DragEvent) => {
    let gutterType = "";
    if (event.dataTransfer) {
        for (const item of event.dataTransfer.items) {
            if (item.type.startsWith(Constants.SIYUAN_DROP_GUTTER)) {
                gutterType = item.type;
                break;
            }
        }
    }
    return gutterType;
};

const checkInvalidGutterType = (gutterType: string) => {
    if (!gutterType) {
        return false;
    }
    const type = gutterType.replace(Constants.SIYUAN_DROP_GUTTER, "").split(Constants.ZWSP)[0];
    return !type || !["nodelistitem", "nodeheading"].includes(type);
};

const checkSourceOnlyRoot = (files: FilesDomain, gutterType: string) => {
    let sourceOnlyRoot = !gutterType;
    if (sourceOnlyRoot) {
        const selectedItems = Array.from(files.element.querySelectorAll(".b3-list-item--focus"));
        for (const item of selectedItems) {
            if (item.getAttribute("data-type") === "navigation-file") {
                sourceOnlyRoot = false;
                break;
            }
        }
    }
    return sourceOnlyRoot;
};

const getLiElement = (target: HTMLElement, x: number, y: number) => {
    const liElement = hasClosestByTag(target, "LI");
    if (liElement) {
        return liElement;
    }
    const pointElement = document.elementFromPoint(x, y - 1);
    if (pointElement) {
        return hasClosestByTag(pointElement, "LI");
    }
    return null;
};

const showFileDragTip = (liElement: HTMLElement, event: DragEvent, gutterType: string) => {
    const name = liElement.querySelector(".b3-list-item__text")?.textContent || "";
    const title = window.siyuan.dragTitle || "";
    if (!gutterType) {
        if (liElement.classList.contains("dragover__top")) {
            showDragTip(title, window.siyuan.languages.dragTipMoveBefore.replace("${x}", name), event.clientX, event.clientY);
            return;
        }
        if (liElement.classList.contains("dragover__bottom")) {
            showDragTip(title, window.siyuan.languages.dragTipMoveAfter.replace("${x}", name), event.clientX, event.clientY);
            return;
        }
        if (liElement.classList.contains("dragover")) {
            showDragTip(title, window.siyuan.languages.dragTipMoveChild.replace("${x}", name), event.clientX, event.clientY);
            return;
        }
        hideDragTip();
        return;
    }

    const type = gutterType.replace(Constants.SIYUAN_DROP_GUTTER, "").split(Constants.ZWSP)[0];
    if (!["nodelistitem", "nodeheading"].includes(type)) {
        hideDragTip();
        return;
    }
    let action = window.siyuan.languages.dragTip2DocChild.replace("${x}", name);
    if (liElement.classList.contains("dragover__top")) {
        action = window.siyuan.languages.dragTip2DocBefore.replace("${x}", name);
    } else if (liElement.classList.contains("dragover__bottom")) {
        action = window.siyuan.languages.dragTip2DocAfter.replace("${x}", name);
    }
    showDragTip(title, action, event.clientX, event.clientY);
};

export const onDragOver = (files: FilesDomain, event: DragEvent) => {
    if (getSiyuanConfig().readonly || event.dataTransfer?.types.includes(Constants.SIYUAN_DROP_TAB)) {
        hideDragTip();
        return;
    }
    if (!(event.target instanceof HTMLElement)) {
        hideDragTip();
        return;
    }

    const liElement = getLiElement(event.target, event.clientX, event.clientY);
    if (!liElement || !getSiyuanDragElement()) {
        hideDragTip();
        event.preventDefault();
        return;
    }
    const dragoverItems = files.element.querySelectorAll(".dragover, .dragover__bottom, .dragover__top");
    for (const item of dragoverItems) {
        item.classList.remove("dragover", "dragover__bottom", "dragover__top");
    }

    const gutterType = getGutterType(event);
    if (checkInvalidGutterType(gutterType)) {
        hideDragTip();
        event.preventDefault();
        return;
    }

    if (!gutterType && liElement.classList.contains("b3-list-item--focus")) {
        hideDragTip();
        event.preventDefault();
        return;
    }

    const sourceOnlyRoot = checkSourceOnlyRoot(files, gutterType);
    const targetType = liElement.getAttribute("data-type");
    if (sourceOnlyRoot && targetType !== "navigation-root") {
        hideDragTip();
        event.preventDefault();
        return;
    }

    const notebookElement = hasClosestByAttribute(liElement, "data-sortmode", null);
    if (!notebookElement) {
        hideDragTip();
        event.preventDefault();
        return;
    }

    handleDragSort(liElement, event, sourceOnlyRoot, targetType, notebookElement.getAttribute("data-sortmode"));

    if (liElement.classList.contains("dragover__top") || liElement.classList.contains("dragover__bottom") ||
        (targetType === "navigation-root" && sourceOnlyRoot)) {
        showFileDragTip(liElement, event, gutterType);
        event.preventDefault();
        return;
    }
    liElement.classList.add("dragover");
    showFileDragTip(liElement, event, gutterType);
    event.preventDefault();
};
