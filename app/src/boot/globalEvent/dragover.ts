import { Constants } from "../../constants";

const stopDrag = (ghostElement: HTMLElement) => {
    ghostElement.remove();
    document.onmousemove = null;
    stopScrollAnimation();
};

const handleDockDrag = (parentElement: HTMLElement | null) => {
    const dockMoveItem = document.querySelector("#dockMoveItem");
    if (dockMoveItem) {
        dockMoveItem.remove();
    }

    if (!parentElement) {
        return;
    }
    const elements = parentElement.querySelectorAll(".dock__item");
    for (const item of elements) {
        if (item instanceof HTMLElement) {
            item.style.opacity = "";
        }
    }
};

const handleGeneralDrag = (ghostElement: HTMLElement, parentElement: HTMLElement | null) => {
    if (!parentElement) {
        return;
    }
    const nodeId = ghostElement.getAttribute("data-node-id");
    const startElement = parentElement.querySelector(`[data-node-id="${nodeId}"]`);
    if (startElement instanceof HTMLElement) {
        startElement.style.opacity = "";
    }
    const items = parentElement.querySelectorAll(".dragover__top, .dragover__bottom, .dragover, .dragover__current");
    for (const item of items) {
        if (item instanceof HTMLElement) {
            item.classList.remove("dragover__top", "dragover__bottom", "dragover", "dragover__current");
            item.style.opacity = "";
        }
    }
};

export const cancelDrag = () => {
    const ghostElement = document.getElementById("dragGhost");
    if (!ghostElement) {
        return;
    }
    const parentElement = ghostElement.parentElement;
    if (ghostElement.dataset.ghostType === "dock") {
        handleDockDrag(parentElement);
        stopDrag(ghostElement);
        return;
    }

    handleGeneralDrag(ghostElement, parentElement);
    stopDrag(ghostElement);
};

const dragoverScroll: {
    animationId?: number,
    element?: Element,
    space?: number // -1 向上；1 向下
    lastTime?: number
} = {};

export const stopScrollAnimation = () => {
    if (dragoverScroll.animationId) {
        cancelAnimationFrame(dragoverScroll.animationId);
        dragoverScroll.animationId = null;
        dragoverScroll.element = null;
        dragoverScroll.space = null;
        dragoverScroll.lastTime = null;
    }
};

const scrollAnimation = (timestamp: number) => {
    if (!dragoverScroll.lastTime) {
        dragoverScroll.lastTime = timestamp - 8;
    }
    dragoverScroll.element.scroll({
        top: dragoverScroll.element.scrollTop + (timestamp - dragoverScroll.lastTime) * dragoverScroll.space / 64
    });
    // 使用 requestAnimationFrame 继续动画
    dragoverScroll.animationId = requestAnimationFrame(scrollAnimation);
    dragoverScroll.lastTime = timestamp;
};

export const dragOverScroll = (moveEvent: MouseEvent, contentRect: DOMRect, element: Element) => {
    const dragToUp = moveEvent.clientY < contentRect.top + Constants.SIZE_SCROLL_TB;
    const dragToDown = moveEvent.clientY > contentRect.bottom - Constants.SIZE_SCROLL_TB;

    if (!dragToUp && !dragToDown) {
        // 离开滚动区域时停止滚动
        stopScrollAnimation();
        return;
    }

    dragoverScroll.space = dragToUp ? moveEvent.clientY - contentRect.top - Constants.SIZE_SCROLL_TB :
        moveEvent.clientY - contentRect.bottom + Constants.SIZE_SCROLL_TB;

    if (!dragoverScroll.animationId) {
        dragoverScroll.element = element;
        dragoverScroll.animationId = requestAnimationFrame(scrollAnimation);
    }
};
