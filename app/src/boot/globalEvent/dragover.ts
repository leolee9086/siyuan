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
    space?: number, // -1 向上或向左；1 向下或向右
    direction?: "x" | "y",
    lastTime?: number
} = {};

export const stopScrollAnimation = () => {
    if (dragoverScroll.animationId) {
        cancelAnimationFrame(dragoverScroll.animationId);
        dragoverScroll.animationId = undefined;
        dragoverScroll.element = undefined;
        dragoverScroll.space = undefined;
        dragoverScroll.direction = undefined;
        dragoverScroll.lastTime = undefined;
    }
};

const scrollAnimation = (timestamp: number) => {
    if (!dragoverScroll.element || dragoverScroll.space === undefined) {
        return;
    }
    if (!dragoverScroll.lastTime) {
        dragoverScroll.lastTime = timestamp - 8;
    }
    const distance = (timestamp - dragoverScroll.lastTime) * dragoverScroll.space / 64;
    const scrollOptions = dragoverScroll.direction === "x"
        ? {left: dragoverScroll.element.scrollLeft + distance}
        : {top: dragoverScroll.element.scrollTop + distance};
    dragoverScroll.element.scroll(scrollOptions);
    // 使用 requestAnimationFrame 继续动画
    dragoverScroll.animationId = requestAnimationFrame(scrollAnimation);
    dragoverScroll.lastTime = timestamp;
};

export const dragOverScroll = (moveEvent: MouseEvent, contentRect: DOMRect, element: Element, direction: "x" | "y" = "y") => {
    const clientPosition = direction === "x" ? moveEvent.clientX : moveEvent.clientY;
    const start = direction === "x" ? contentRect.left : contentRect.top;
    const end = direction === "x" ? contentRect.right : contentRect.bottom;
    const dragToStart = clientPosition < start + Constants.SIZE_SCROLL_TB;
    // 指针离开当前轴两端的滚动触发区时立即结束动画。
    if (!dragToStart && clientPosition <= end - Constants.SIZE_SCROLL_TB) {
        stopScrollAnimation();
        return;
    }
    // 目标元素或滚动轴改变时，旧动画必须先清理再以新上下文启动。
    if (dragoverScroll.animationId &&
        (dragoverScroll.element !== element || dragoverScroll.direction !== direction)) {
        stopScrollAnimation();
    }
    dragoverScroll.space = dragToStart ? clientPosition - start - Constants.SIZE_SCROLL_TB :
        clientPosition - end + Constants.SIZE_SCROLL_TB;
    // 同一目标和方向已有动画时只更新速度，不重复申请动画帧。
    if (!dragoverScroll.animationId) {
        dragoverScroll.element = element;
        dragoverScroll.direction = direction;
        dragoverScroll.animationId = requestAnimationFrame(scrollAnimation);
    }
};
