import { Files } from "../Files";
import { Constants } from "../../../constants";
import {
    hasClosestByAttribute,
    hasClosestByTag,
} from "../../../protyle/util/hasClosest";
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

const checkSourceOnlyRoot = (files: Files, gutterType: string) => {
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

export const onDragOver = (files: Files, event: DragEvent) => {
    if (getSiyuanConfig().readonly || event.dataTransfer?.types.includes(Constants.SIYUAN_DROP_TAB)) {
return;
}
    if (!(event.target instanceof HTMLElement)) {
return;
}

    const liElement = getLiElement(event.target, event.clientX, event.clientY);
    if (!liElement || !getSiyuanDragElement()) {
        event.preventDefault();
        return;
    }
    const dragoverItems = files.element.querySelectorAll(".dragover, .dragover__bottom, .dragover__top");
    for (const item of dragoverItems) {
        item.classList.remove("dragover", "dragover__bottom", "dragover__top");
    }

    const gutterType = getGutterType(event);
    if (checkInvalidGutterType(gutterType)) {
        event.preventDefault();
        return;
    }

    if (!gutterType && liElement.classList.contains("b3-list-item--focus")) {
        return;
    }

    const sourceOnlyRoot = checkSourceOnlyRoot(files, gutterType);
    const targetType = liElement.getAttribute("data-type");
    if (sourceOnlyRoot && targetType !== "navigation-root") {
        event.preventDefault();
        return;
    }

    const notebookElement = hasClosestByAttribute(liElement, "data-sortmode", null);
    if (!notebookElement) {
return;
}

    handleDragSort(liElement, event, sourceOnlyRoot, targetType, notebookElement.getAttribute("data-sortmode"));

    if (liElement.classList.contains("dragover__top") || liElement.classList.contains("dragover__bottom") ||
        (targetType === "navigation-root" && sourceOnlyRoot)) {
        event.preventDefault();
        return;
    }
    liElement.classList.add("dragover");
    event.preventDefault();
};
