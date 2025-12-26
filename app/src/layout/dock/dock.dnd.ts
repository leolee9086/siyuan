import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { isHTMLOrSVGElement } from "./dock.guard";
import type { Dock } from "./index";

class DockDragHandler {
    private dock: Dock;
    private item: HTMLElement;
    private ghostElement: HTMLElement | undefined;
    private selectItem: HTMLElement | undefined;
    private moveItem: HTMLElement;
    private startEvent: MouseEvent;

    constructor(dock: Dock, item: HTMLElement, event: MouseEvent) {
        this.dock = dock;
        this.item = item;
        this.startEvent = event;
        this.moveItem = document.createElement("span");
        this.moveItem.classList.add("dock__item", "fn__none");
        this.moveItem.style.background = "var(--b3-theme-primary-light)";
        this.moveItem.innerHTML = "<svg></svg>";
        this.moveItem.id = "dockMoveItem";
    }

    public start() {
        document.ondragstart = () => false;
        document.onmousemove = this.onMouseMove;
        document.onmouseup = this.onMouseUp;
    }

    private onMouseMove = (moveEvent: MouseEvent) => {
        if (!window.siyuan?.config || window.siyuan.config.readonly ||
            Math.abs(moveEvent.clientY - this.startEvent.clientY) < 3 && Math.abs(moveEvent.clientX - this.startEvent.clientX) < 3) {
            return;
        }
        moveEvent.preventDefault();
        moveEvent.stopPropagation();

        if (!this.ghostElement) {
            this.createGhost();
        }

        this.updateGhostPosition(moveEvent);
        this.updateMoveItem(moveEvent);
    };

    private createGhost() {
        this.item.style.opacity = "0.38";
        const ghostElement = this.item.cloneNode(true);
        if (isHTMLOrSVGElement(ghostElement)) {
            this.ghostElement = ghostElement as HTMLElement;
            this.ghostElement.setAttribute("data-ghost-type", "dock");
            this.dock.element.append(this.ghostElement);
            this.ghostElement.setAttribute("data-original", JSON.stringify({
                position: this.dock.position,
                index: this.item.getAttribute("data-index"),
                previousType: this.item.previousElementSibling?.getAttribute("data-type"),
                type: this.item.getAttribute("data-type"),
            }));
            this.ghostElement.setAttribute("id", "dragGhost");
            this.ghostElement.setAttribute("style", `background-color:var(--b3-theme-background-light);position: fixed; top: ${this.startEvent.clientY}px; left: ${this.startEvent.clientX}px; z-index:999997;`);
        }
    }

    private updateGhostPosition(moveEvent: MouseEvent) {
        if (!this.ghostElement) {
            return;
        }
        if (this.dock.position === "Bottom") {
            this.ghostElement.style.top = (moveEvent.clientY - 40) + "px";
            this.ghostElement.style.left = (moveEvent.clientX - 20) + "px";
            return;
        }
        this.ghostElement.style.top = (moveEvent.clientY - 20) + "px";
        if (this.dock.position === "Left") {
            this.ghostElement.style.left = (moveEvent.clientX) + "px";
            return;
        }
        this.ghostElement.style.left = (moveEvent.clientX - 40) + "px";
    }

    private updateMoveItem(moveEvent: MouseEvent) {
        let targetItem: HTMLElement | false = false;
        if (moveEvent.target instanceof HTMLElement) {
            targetItem = hasClosestByClassName(moveEvent.target, "dock__item") ||
                hasClosestByClassName(moveEvent.target, "dock__items") ||
                hasClosestByClassName(moveEvent.target, "dock__item--space");
        }

        if (targetItem && this.selectItem && targetItem === this.selectItem) {
            this.handleTargetMatch(moveEvent);
            return;
        }

        if (!targetItem || targetItem.style.position === "fixed" || (targetItem === this.item) || targetItem.id === "dockMoveItem") {
            if (targetItem && targetItem === this.item) {
                this.moveItem.classList.add("fn__none");
            }
            return;
        }
        this.selectItem = targetItem;
    }

    private handleTargetMatch(moveEvent: MouseEvent) {
        if (this.selectItem?.classList.contains("dock__item--space")) {
            this.handleSpaceMatch(moveEvent, this.selectItem);
            return;
        }
        if (this.selectItem?.classList.contains("dock__item--pin")) {
            if (this.item.nextElementSibling && this.item.nextElementSibling === this.selectItem) {
                this.moveItem.classList.add("fn__none");
                return;
            }
            this.moveItem.classList.remove("fn__none");
            this.selectItem.before(this.moveItem);
            return;
        }
        if (this.selectItem?.classList.contains("dock__item")) {
            this.handleItemMatch(moveEvent, this.selectItem);
            return;
        }
        if (this.selectItem?.childElementCount === 0) {
            this.moveItem.classList.remove("fn__none");
            this.selectItem.append(this.moveItem);
            return;
        }
        if (this.selectItem?.childElementCount === 1 && this.selectItem.firstElementChild?.id === "dockMoveItem") {
            this.moveItem.classList.remove("fn__none");
            return;
        }
        if (this.selectItem?.childElementCount === 1 && this.selectItem.firstElementChild?.classList.contains("dock__item--pin")) {
            this.moveItem.classList.remove("fn__none");
            this.selectItem.insertAdjacentElement("afterbegin", this.moveItem);
            return;
        }
        if (this.selectItem?.childElementCount === 2 &&
            this.selectItem.firstElementChild?.id === "dockMoveItem" && this.selectItem.lastElementChild?.classList.contains("dock__item--pin")) {
            this.moveItem.classList.remove("fn__none");
        }
    }

    private handleSpaceMatch(moveEvent: MouseEvent, selectItem: HTMLElement) {
        const selectRect = selectItem.getBoundingClientRect();
        if (selectItem.parentElement?.id === "dockBottom") {
            if (moveEvent.clientX < selectRect.right && moveEvent.clientX > selectRect.right - 40) {
                const lastFirstElement = selectItem.nextElementSibling?.firstElementChild;
                if (lastFirstElement && lastFirstElement === this.item) {
                    this.moveItem.classList.add("fn__none");
                    return;
                }
                if (lastFirstElement) {
                    this.moveItem.classList.remove("fn__none");
                    lastFirstElement.before(this.moveItem);
                }
            }
            return;
        }
        if (moveEvent.clientY < selectRect.bottom && moveEvent.clientY > selectRect.bottom - 40) {
            const lastFirstElement = selectItem.nextElementSibling?.firstElementChild;
            if (lastFirstElement && lastFirstElement === this.item) {
                this.moveItem.classList.add("fn__none");
                return;
            }
            if (lastFirstElement) {
                this.moveItem.classList.remove("fn__none");
                lastFirstElement.before(this.moveItem);
            }
        }
    }

    private handleItemMatch(moveEvent: MouseEvent, selectItem: HTMLElement) {
        const selectRect = selectItem.getBoundingClientRect();
        const isBottom = selectItem.parentElement?.parentElement?.id === "dockBottom";
        const isInsertBefore = isBottom ?
            (selectRect.left + selectRect.width / 2 > moveEvent.clientX) :
            (selectRect.top + selectRect.height / 2 > moveEvent.clientY);

        if (isInsertBefore) {
            if (this.item.nextElementSibling === selectItem) {
                this.moveItem.classList.add("fn__none");
                return;
            }
            this.moveItem.classList.remove("fn__none");
            selectItem.before(this.moveItem);
            return;
        }

        if (this.item.previousElementSibling === selectItem) {
            this.moveItem.classList.add("fn__none");
            return;
        }
        this.moveItem.classList.remove("fn__none");
        selectItem.after(this.moveItem);
    }

    private static getDockTarget(id: string | undefined): Dock | undefined {
        if (!id) {
            return;
        }
        if (id === "dockBottom") {
            return window.siyuan.layout?.bottomDock;
        }
        if (id === "dockLeft") {
            return window.siyuan.layout?.leftDock;
        }
        if (id === "dockRight") {
            return window.siyuan.layout?.rightDock;
        }
    }

    private onMouseUp = () => {
        document.onmousemove = null;
        document.onmouseup = null;
        document.ondragstart = null;
        document.onselectstart = null;
        document.onselect = null;
        this.ghostElement?.remove();
        if (this.item.style.opacity !== "0.38") {
            return;
        }
        this.item.style.opacity = "";
        const dockTarget = DockDragHandler.getDockTarget(this.moveItem.parentElement?.parentElement?.id);
        if (!this.moveItem.classList.contains("fn__none") && dockTarget && this.moveItem.parentElement) {
            dockTarget.add(this.moveItem.parentElement === dockTarget.element.firstElementChild ? 0 : 1, this.item, this.moveItem.previousElementSibling?.getAttribute("data-type") || undefined);
        }
        this.moveItem.remove();
    };
}

export const initDockDnD = (dock: Dock) => {
    // @内联回调
    dock.element.addEventListener("mousedown", (event: MouseEvent) => {
        if (!isHTMLOrSVGElement(event.target)) {
            return;
        }
        const item = hasClosestByClassName(event.target, "dock__item");
        if (!item || !item.getAttribute("data-type")) {
            return;
        }
        new DockDragHandler(dock, item, event).start();
    });
};
