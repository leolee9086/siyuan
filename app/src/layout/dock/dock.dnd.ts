import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { isStylableElement } from "../../util/DOM/element.guard";
import type { Dock } from "./index";
import {Constants} from "../../constants";

export const initDockDnD = (dock: Dock) => {
    if (dock.position === "Bottom") {
        return;
    }
    dock.elements[0].parentElement.addEventListener("mousedown", (event: MouseEvent) => {
        if (!isStylableElement(event.target)) {
            return;
        }
        const item = hasClosestByClassName(event.target, "dock__item");
        if (!item || !item.getAttribute("data-type")) {
            return;
        }
        const documentSelf = document;
        documentSelf.ondragstart = () => false;
        let ghostElement: HTMLElement;
        let selectItem: HTMLElement;
        const moveItem = document.createElement("span");
        moveItem.classList.add("dock__item", "fn__none");
        moveItem.style.background = "var(--b3-theme-primary-light)";
        moveItem.innerHTML = "<svg></svg>";
        moveItem.id = "dockMoveItem";
        documentSelf.onmousemove = (moveEvent: MouseEvent) => {
            if (window.siyuan.config.readonly ||
                Math.abs(moveEvent.clientY - event.clientY) < Constants.SIZE_DRAG_THRESHOLD &&
                Math.abs(moveEvent.clientX - event.clientX) < Constants.SIZE_DRAG_THRESHOLD) {
                return;
            }
            moveEvent.preventDefault();
            moveEvent.stopPropagation();
            if (!ghostElement) {
                document.querySelectorAll(".dock__split").forEach((splitItem: HTMLElement) => {
                    splitItem.style.setProperty("display", "block", "important");
                });
                item.style.opacity = "0.38";
                ghostElement = item.cloneNode(true) as HTMLElement;
                ghostElement.setAttribute("data-ghost-type", "dock");
                dock.elements[0].parentElement.append(ghostElement);
                ghostElement.setAttribute("id", "dragGhost");
                ghostElement.setAttribute("style", `pointer-events: none;background-color:var(--b3-theme-background-light);position: fixed; top: ${event.clientY}px; left: ${event.clientX}px; z-index:999997;`);
            }

            ghostElement.style.top = (moveEvent.clientY - 21) + "px";
            ghostElement.style.left = (moveEvent.clientX - 21) + "px";

            const targetItem = hasClosestByClassName(moveEvent.target as HTMLElement, "dock__item") ||
                hasClosestByClassName(moveEvent.target as HTMLElement, "dock__split") as HTMLElement ||
                hasClosestByClassName(moveEvent.target as HTMLElement, "dock__item--space") as HTMLElement;
            if (targetItem && selectItem && targetItem === selectItem) {
                if (selectItem.classList.contains("dock__item--space") ||
                    selectItem.classList.contains("dock__split")) {
                    const selectRect = selectItem.getBoundingClientRect();
                    if (moveEvent.clientY > selectRect.top + selectRect.height / 2) {
                        if (selectItem.nextElementSibling && item === selectItem.nextElementSibling.firstElementChild) {
                            moveItem.classList.add("fn__none");
                        } else {
                            selectItem.nextElementSibling.insertAdjacentElement("afterbegin", moveItem);
                            moveItem.classList.remove("fn__none");
                        }
                    } else {
                        if (selectItem.nextElementSibling && item === selectItem.previousElementSibling.lastElementChild) {
                            moveItem.classList.add("fn__none");
                        } else {
                            selectItem.previousElementSibling.insertAdjacentElement("beforeend", moveItem);
                            moveItem.classList.remove("fn__none");
                        }
                    }
                } else if (selectItem.classList.contains("dock__item")) {
                    const selectRect = selectItem.getBoundingClientRect();
                    if (selectRect.top + selectRect.height / 2 > moveEvent.clientY) {
                        if (item.nextElementSibling && item.nextElementSibling === selectItem) {
                            moveItem.classList.add("fn__none");
                        } else {
                            moveItem.classList.remove("fn__none");
                            selectItem.before(moveItem);
                        }
                    } else {
                        if (item.previousElementSibling && item.previousElementSibling === selectItem) {
                            moveItem.classList.add("fn__none");
                        } else {
                            moveItem.classList.remove("fn__none");
                            selectItem.after(moveItem);
                        }
                    }
                }
                return;
            }
            if (!targetItem || targetItem.style.position === "fixed" || (targetItem === item) || targetItem.id === "dockMoveItem") {
                if (targetItem && targetItem === item) {
                    moveItem.classList.add("fn__none");
                }
                return;
            }
            selectItem = targetItem;
        };

        documentSelf.onmouseup = () => {
            documentSelf.onmousemove = null;
            documentSelf.onmouseup = null;
            documentSelf.ondragstart = null;
            documentSelf.onselectstart = null;
            documentSelf.onselect = null;
            ghostElement?.remove();
            document.querySelectorAll(".dock__split").forEach((splitItem: HTMLElement) => {
                splitItem.style.removeProperty("display");
            });
            if (item.style.opacity !== "0.38") {
                return;
            }
            item.style.opacity = "";
            if (!moveItem.classList.contains("fn__none")) {
                let targetDock;
                if (window.siyuan.layout.leftDock && window.siyuan.layout.leftDock.elements[0].contains(moveItem) ||
                    window.siyuan.layout.leftDock && window.siyuan.layout.leftDock.elements[1].contains(moveItem)) {
                    targetDock = window.siyuan.layout.leftDock;
                } else if (window.siyuan.layout.rightDock && window.siyuan.layout.rightDock.elements[0].contains(moveItem) ||
                    window.siyuan.layout.rightDock && window.siyuan.layout.rightDock.elements[1].contains(moveItem)) {
                    targetDock = window.siyuan.layout.rightDock;
                } else if (window.siyuan.layout.bottomDock && window.siyuan.layout.bottomDock.elements[0].contains(moveItem) ||
                    window.siyuan.layout.bottomDock && window.siyuan.layout.bottomDock.elements[1].contains(moveItem)) {
                    targetDock = window.siyuan.layout.bottomDock;
                }
                if (targetDock) {
                    targetDock.add(targetDock.elements[0].contains(moveItem) ? 0 : 1,
                        item, moveItem.previousElementSibling?.getAttribute("data-type"));
                }
            }
            moveItem.remove();
        };
    });
};
