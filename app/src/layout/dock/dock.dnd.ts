import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { isStylableElement } from "../../util/DOM/element.guard";
import {Constants} from "../../constants";
import type {DockDomain} from "./dock.types";

function setDockSplitVisibility(visible: boolean) {
    document.querySelectorAll(".dock__split").forEach((splitItem) => {
        if (!(splitItem instanceof HTMLElement)) {
            return;
        }
        if (visible) {
            splitItem.style.setProperty("display", "block", "important");
            return;
        }
        splitItem.style.removeProperty("display");
    });
}

function createMoveItem() {
    const moveItem = document.createElement("span");
    moveItem.classList.add("dock__item", "fn__none");
    moveItem.style.background = "var(--b3-theme-primary-light)";
    moveItem.innerHTML = "<svg></svg>";
    moveItem.id = "dockMoveItem";
    return moveItem;
}

function createGhost(dock: DockDomain, item: HTMLElement, event: MouseEvent) {
    setDockSplitVisibility(true);
    item.style.opacity = "0.38";
    const ghostElement = item.cloneNode(true) as HTMLElement;
    ghostElement.setAttribute("data-ghost-type", "dock");
    dock.elements[0].parentElement.append(ghostElement);
    ghostElement.id = "dragGhost";
    ghostElement.setAttribute("style", `pointer-events: none;background-color:var(--b3-theme-background-light);position: fixed; top: ${event.clientY}px; left: ${event.clientX}px; z-index:999997;`);
    return ghostElement;
}

function placeBelowSplit(item: HTMLElement, moveItem: HTMLElement, target: HTMLElement) {
    const next = target.nextElementSibling;
    if (next && item === next.firstElementChild) {
        moveItem.classList.add("fn__none");
        return;
    }
    next?.insertAdjacentElement("afterbegin", moveItem);
    moveItem.classList.remove("fn__none");
}

function placeAboveSplit(item: HTMLElement, moveItem: HTMLElement, target: HTMLElement) {
    const previous = target.previousElementSibling;
    if (previous && item === previous.lastElementChild) {
        moveItem.classList.add("fn__none");
        return;
    }
    previous?.insertAdjacentElement("beforeend", moveItem);
    moveItem.classList.remove("fn__none");
}

function placeAroundSplit(item: HTMLElement, moveItem: HTMLElement, target: HTMLElement, event: MouseEvent) {
    const targetRect = target.getBoundingClientRect();
    if (event.clientY > targetRect.top + targetRect.height / 2) {
        placeBelowSplit(item, moveItem, target);
        return;
    }
    placeAboveSplit(item, moveItem, target);
}

function placeAroundItem(item: HTMLElement, moveItem: HTMLElement, target: HTMLElement, event: MouseEvent) {
    const targetRect = target.getBoundingClientRect();
    const insertBefore = targetRect.top + targetRect.height / 2 > event.clientY;
    const isAdjacent = insertBefore ? item.nextElementSibling === target : item.previousElementSibling === target;
    moveItem.classList.toggle("fn__none", isAdjacent);
    if (isAdjacent) {
        return;
    }
    if (insertBefore) {
        target.before(moveItem);
        return;
    }
    target.after(moveItem);
}

function placeMoveItem(item: HTMLElement, moveItem: HTMLElement, target: HTMLElement, event: MouseEvent) {
    if (target.classList.contains("dock__item--space") || target.classList.contains("dock__split")) {
        placeAroundSplit(item, moveItem, target, event);
        return;
    }
    if (target.classList.contains("dock__item")) {
        placeAroundItem(item, moveItem, target, event);
    }
}

function findTargetDock(moveItem: HTMLElement): DockDomain | undefined {
    const docks = [window.siyuan.layout.leftDock, window.siyuan.layout.rightDock, window.siyuan.layout.bottomDock];
    return docks.find((dock) => dock && dock.elements.some((element) => element.contains(moveItem)));
}

function finishDrag(item: HTMLElement, moveItem: HTMLElement, ghostElement?: HTMLElement) {
    ghostElement?.remove();
    setDockSplitVisibility(false);
    if (item.style.opacity !== "0.38") {
        moveItem.remove();
        return;
    }
    item.style.opacity = "";
    if (!moveItem.classList.contains("fn__none")) {
        const targetDock = findTargetDock(moveItem);
        targetDock?.add(targetDock.elements[0].contains(moveItem) ? 0 : 1,
            item, moveItem.previousElementSibling?.getAttribute("data-type"));
    }
    moveItem.remove();
}

function bindDockItemDrag(dock: DockDomain, item: HTMLElement, startEvent: MouseEvent) {
    const documentSelf = document;
    const moveItem = createMoveItem();
    let ghostElement: HTMLElement | undefined;
    let selectedItem: HTMLElement | undefined;
    documentSelf.ondragstart = () => false;
    documentSelf.onmousemove = (event) => {
        if (window.siyuan.config.readonly ||
            Math.abs(event.clientY - startEvent.clientY) < Constants.SIZE_DRAG_THRESHOLD &&
            Math.abs(event.clientX - startEvent.clientX) < Constants.SIZE_DRAG_THRESHOLD) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        ghostElement ||= createGhost(dock, item, startEvent);
        ghostElement.style.top = `${event.clientY - 21}px`;
        ghostElement.style.left = `${event.clientX - 21}px`;
        const target = hasClosestByClassName(event.target as HTMLElement, "dock__item") ||
            hasClosestByClassName(event.target as HTMLElement, "dock__split") as HTMLElement ||
            hasClosestByClassName(event.target as HTMLElement, "dock__item--space") as HTMLElement;
        if (target && selectedItem === target) {
            placeMoveItem(item, moveItem, target, event);
            return;
        }
        if (!target || target.style.position === "fixed" || target === item || target.id === "dockMoveItem") {
            moveItem.classList.toggle("fn__none", target === item);
            return;
        }
        selectedItem = target;
    };
    documentSelf.onmouseup = () => {
        documentSelf.onmousemove = null;
        documentSelf.onmouseup = null;
        documentSelf.ondragstart = null;
        documentSelf.onselectstart = null;
        documentSelf.onselect = null;
        finishDrag(item, moveItem, ghostElement);
    };
}

export function initDockDnD(dock: DockDomain) {
    if (dock.position === "Bottom") {
        return;
    }
    dock.elements[0].parentElement.addEventListener("mousedown", (event) => {
        if (!isStylableElement(event.target)) {
            return;
        }
        const item = hasClosestByClassName(event.target, "dock__item");
        if (item?.getAttribute("data-type")) {
            bindDockItemDrag(dock, item, event);
        }
    });
}
