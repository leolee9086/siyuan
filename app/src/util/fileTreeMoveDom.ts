import {Constants} from "../constants";
import {unicode2Emoji} from "../emoji";
import {pathPosix} from "./file/pathName";
import {getMovedFileTreeSortRefreshTargets} from "./fileTreeSort";
import {
    collectExpandedDocIDs,
    findMovedFileTreeItem,
    getFileTreeChildList,
    type IFileTreeMove,
    updateMovedSubtree,
} from "./fileTreeMove";

export interface IFileTreeMoveDomHost {
    element: HTMLElement;
    getLeaf: (liElement: Element, notebookId: string, focusUpdate?: boolean) => void;
    recordMovedExpandedDocIDs: (ids: Iterable<string>) => void;
    updateDocActionElement: (liElement: HTMLElement) => void;
    persistOpenPaths: () => void;
}

interface IRefreshTarget {
    element: HTMLElement;
    notebookId: string;
}

interface IDetachedSource {
    sourceElement: HTMLElement;
    childListElement: HTMLElement | undefined;
    sourceAtTarget: boolean;
}

const getParentPath = (path: string) => {
    const parentPath = pathPosix().dirname(path);
    return parentPath === "/" ? "/" : `${parentPath}.sy`;
};

const getLocalImage = (name: "file" | "folder") => {
    const localImages = window.siyuan.storage?.[Constants.LOCAL_IMAGES];
    return unicode2Emoji(localImages?.[name] ?? "");
};

const updateSourceParent = (host: IFileTreeMoveDomHost, parentElement: Element) => {
    const toggleElement = parentElement.querySelector(".b3-list-item__toggle");
    if ((parentElement.getAttribute("data-type") !== "navigation-root" || parentElement.getAttribute("data-node-id")) && toggleElement) {
        toggleElement.classList.add("fn__hidden");
    }
    parentElement.querySelector(".b3-list-item__arrow")?.classList.remove("b3-list-item__arrow--open");
    if (parentElement instanceof HTMLElement) {
        parentElement.dataset.count = "0";
        host.updateDocActionElement(parentElement);
    }
    const iconElement = parentElement.querySelector<HTMLElement>(".b3-list-item__icon");
    if (iconElement && iconElement.innerHTML === getLocalImage("folder")) {
        iconElement.innerHTML = getLocalImage("file");
    }
};

const detachSource = (host: IFileTreeMoveDomHost, sourceElement: HTMLElement): HTMLElement | undefined => {
    const childListElement = getFileTreeChildList(sourceElement);
    childListElement?.remove();
    const sourceListElement = sourceElement.parentElement;
    if (!sourceListElement) {
        sourceElement.remove();
        return childListElement;
    }
    if (sourceListElement.childElementCount !== 1) {
        sourceElement.remove();
        return childListElement;
    }
    const parentElement = sourceListElement.previousElementSibling;
    if (parentElement) {
        updateSourceParent(host, parentElement);
    }
    sourceListElement.remove();
    return childListElement;
};

const updateMissingSourceParent = (host: IFileTreeMoveDomHost, move: IFileTreeMove) => {
    const parentElement = host.element.querySelector<HTMLElement>(
        `ul[data-url="${move.fromNotebook}"] li[data-path="${getParentPath(move.fromPath)}"]`,
    );
    if (!parentElement || parentElement.getAttribute("data-count") !== "1") {
        return;
    }
    updateSourceParent(host, parentElement);
};

const updateTargetParent = (host: IFileTreeMoveDomHost, move: IFileTreeMove) => {
    const targetElement = host.element.querySelector<HTMLElement>(
        `ul[data-url="${move.toNotebook}"] li[data-path="${move.toPath}"]`,
    );
    if (!targetElement) {
        return;
    }
    targetElement.querySelector(".b3-list-item__toggle")?.classList.remove("fn__hidden");
    if (targetElement.getAttribute("data-type") === "navigation-root") {
        targetElement.dataset.count = Math.max(1, Number(targetElement.dataset.count)).toString();
        host.updateDocActionElement(targetElement);
    }
    const iconElement = targetElement.querySelector<HTMLElement>(".b3-list-item__icon");
    if (iconElement && iconElement.innerHTML === getLocalImage("file")) {
        iconElement.innerHTML = getLocalImage("folder");
    }
    return targetElement;
};

const collectSourceState = (sourceElement: HTMLElement | undefined, move: IFileTreeMove) => {
    const expandedDocIDs = new Set<string>();
    if (!sourceElement) {
        return {expandedDocIDs, childListElement: undefined};
    }
    const childListElement = getFileTreeChildList(sourceElement);
    collectExpandedDocIDs(sourceElement, childListElement, expandedDocIDs);
    updateMovedSubtree(sourceElement, childListElement, move.fromPath, move.newPath);
    return {expandedDocIDs, childListElement};
};

const applySingleMove = (
    host: IFileTreeMoveDomHost,
    move: IFileTreeMove,
    refreshTargets: Map<string, IRefreshTarget>,
) => {
    const movedItem = findMovedFileTreeItem(host.element, move);
    const sourceElement = movedItem?.element;
    const sourceAtTarget = movedItem?.isAtTarget === true;
    const sourceState = collectSourceState(sourceElement, move);
    let childListElement = sourceState.childListElement;

    if (sourceElement && !sourceAtTarget) {
        childListElement = detachSource(host, sourceElement);
    }
    if (!sourceElement || sourceAtTarget) {
        updateMissingSourceParent(host, move);
    }

    const targetElement = updateTargetParent(host, move);
    if (!targetElement) {
        host.recordMovedExpandedDocIDs(sourceState.expandedDocIDs);
        return;
    }

    const targetListElement = getFileTreeChildList(targetElement);
    const targetExpanded = Boolean(targetElement.querySelector(".b3-list-item__arrow--open"));
    if (sourceElement && targetListElement && !sourceAtTarget) {
        targetListElement.append(sourceElement);
        sourceElement.after(...(childListElement ? [childListElement] : []));
    }
    if (!targetExpanded || !sourceElement || (!sourceAtTarget && !targetListElement)) {
        host.recordMovedExpandedDocIDs(sourceState.expandedDocIDs);
    }
    if (targetExpanded) {
        refreshTargets.set(`${move.toNotebook}:${move.toPath}`, {
            element: targetElement,
            notebookId: move.toNotebook,
        });
    }
};

export const applyFileTreeMoves = (options: {
    host: IFileTreeMoveDomHost;
    moves: IFileTreeMove[];
    callback?: string;
}) => {
    const {host, moves, callback} = options;
    const refreshTargets = new Map<string, IRefreshTarget>();
    const hasParentChange = moves.some((move) =>
        move.fromNotebook !== move.toNotebook ||
        pathPosix().dirname(move.fromPath) !== pathPosix().dirname(move.newPath),
    );
    moves.forEach((move) => applySingleMove(host, move, refreshTargets));
    if (hasParentChange) {
        host.persistOpenPaths();
    }
    if (callback !== Constants.CB_MOVE_NOLIST) {
        refreshTargets.forEach((target) => host.getLeaf(target.element, target.notebookId, true));
    }
    for (const target of getMovedFileTreeSortRefreshTargets(host.element, moves)) {
        const notebookElement = host.element.querySelector(`ul[data-url="${target.notebookId}"]`);
        const listItem = Array.from(notebookElement?.querySelectorAll("li[data-path]") || []).find((item) =>
            item.getAttribute("data-path") === target.path
        );
        if (listItem) {
            host.getLeaf(listItem, target.notebookId, true);
        }
    }
};
