import { Layout } from "..";
import { focusByRange } from "../../ai/imports";
import { getSiyuanLayout } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { hideElements } from "../../protyle/ui/hideElements";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { isWindow } from "../../util/functions";
import { getAllModels } from "../getAll";
import { resizeTabs } from "../tabUtil";
import { adjustLayout } from "../util";
import { Wnd } from "../Wnd";


const isLargePanel = (item: Element) => {
    return (item.classList.contains("sy__backlink") || item.classList.contains("sy__graph")
        || item.classList.contains("sy__globalGraph") || item.classList.contains("sy__inbox")) &&
        !item.classList.contains("fn__none") && !hasClosestByClassName(item, "fn__none");
};

const getMinSize = (element: HTMLElement) => {
    const found = Array.from(element.querySelectorAll(".file-tree")).find(isLargePanel);
    return found ? 320 : 232;
};

const setSize = (item: HTMLElement, direction: string) => {
    if (!item.classList.contains("fn__flex-1")) {
        return;
    }
    if (direction === "lr") {
        item.style.width = item.clientWidth + "px";
        return;
    }
    item.style.height = item.clientHeight + "px";

    item.classList.remove("fn__flex-1");

};

const handleDragStart = () => {
    // 文件树拖拽会产生透明效果
    const files = document.querySelectorAll(".sy__file .b3-list-item");
    for (let i = 0; i < files.length; i++) {
        const item = files[i] as HTMLElement;
        if (item.style.opacity === "0.38") {
            item.style.opacity = "";
        }
    }
    return false;
};

const handleResizeMouseMove = (
    moveEvent: MouseEvent,
    direction: string,
    x: number,
    previousSize: number,
    nextSize: number,
    previousElement: HTMLElement,
    nextElement: HTMLElement
) => {
    moveEvent.preventDefault();
    moveEvent.stopPropagation();
    const previousNowSize = (previousSize + (moveEvent[direction === "lr" ? "clientX" : "clientY"] - x));
    const nextNowSize = (nextSize - (moveEvent[direction === "lr" ? "clientX" : "clientY"] - x));
    if (previousNowSize < 8 || nextNowSize < 8) {
        return;
    }
    const layout = getSiyuanLayout();
    if (layout.leftDock && layout.leftDock.layout.element === previousElement &&
        previousNowSize < getMinSize(previousElement) &&
        // https://github.com/siyuan-note/siyuan/issues/10506
        previousNowSize < previousSize) {
        return;
    }
    if (layout.rightDock && layout.rightDock.layout.element === nextElement &&
        nextNowSize < getMinSize(nextElement) && nextNowSize < nextSize) {
        return;
    }
    if (layout.bottomDock && layout.bottomDock.layout.element === nextElement &&
        nextNowSize < 64 && nextNowSize < nextSize) {
        return;
    }
    if (!previousElement.classList.contains("fn__flex-1")) {
        previousElement.style[direction === "lr" ? "width" : "height"] = previousNowSize + "px";
    }
    if (!nextElement.classList.contains("fn__flex-1")) {
        nextElement.style[direction === "lr" ? "width" : "height"] = nextNowSize + "px";
    }
};

const handleResizeMouseUp = (
    documentSelf: Document,
    range: Range | undefined,
    previousElement: HTMLElement,
    nextElement: HTMLElement
) => {
    documentSelf.onmousemove = null;
    documentSelf.onmouseup = null;
    documentSelf.ondragstart = null;
    documentSelf.onselectstart = null;
    documentSelf.onselect = null;
    const layout = getSiyuanLayout();
    adjustLayout(isWindow() ? layout.centerLayout : undefined);
    resizeTabs();
    if (!isWindow()) {
        layout.leftDock?.setSize();
        layout.bottomDock?.setSize();
        layout.rightDock?.setSize();
    }
    if (range) {
        focusByRange(range);
    }
    nextElement.style.overflow = "";
    previousElement.style.overflow = "";
    nextElement.style.transition = "";
    previousElement.style.transition = "";
};

const onResizeMouseDown = (event: MouseEvent, resizeElement: HTMLElement, direction: string) => {
    const editors = getAllModels().editor;
    for (const item of editors) {
        if (item.editor && item.editor.protyle && item.element.parentElement) {
            hideElements(["gutter"], item.editor.protyle);
        }
    }

    let range: Range | undefined;
    const selection = getSelection();
    if (selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
    }
    const documentSelf = document;
    const nextElement = resizeElement.nextElementSibling as HTMLElement;
    const previousElement = resizeElement.previousElementSibling as HTMLElement;
    nextElement.style.overflow = "auto"; // 拖动时 layout__resize 会出现 https://github.com/siyuan-note/siyuan/issues/6221
    previousElement.style.overflow = "auto";
    nextElement.style.transition = "none";
    previousElement.style.transition = "none";
    const resizeNext = !nextElement.nextElementSibling || nextElement.nextElementSibling.classList.contains("layout__dockresize");
    setSize(resizeNext ? nextElement : previousElement, direction);
    const x = event[direction === "lr" ? "clientX" : "clientY"];
    const previousSize = direction === "lr" ? previousElement.clientWidth : previousElement.clientHeight;
    const nextSize = direction === "lr" ? nextElement.clientWidth : nextElement.clientHeight;

    documentSelf.ondragstart = handleDragStart;

    documentSelf.onmousemove = (moveEvent: MouseEvent) => {
        handleResizeMouseMove(moveEvent, direction, x, previousSize, nextSize, previousElement, nextElement);
    };

    documentSelf.onmouseup = () => {
        handleResizeMouseUp(documentSelf, range, previousElement, nextElement);
    };
};

const calculateDockSize = (selector: string) => {
    const dockItems = document.querySelectorAll(`${selector} .dock__item--active`);
    const bigType = ["graph", "inbox", "globalGraph", "backlink"];
    for (let i = 0; i < dockItems.length; i++) {
        const item = dockItems[i];
        if (!item) continue;
        const type = item.getAttribute("data-type");
        if (type && bigType.includes(type)) {
            return 320;
        }
    }
    return 232;
};

const handleHorizontalResizeDblClick = (layout: any, previousElement: HTMLElement, nextElement: HTMLElement, resizeElement: HTMLElement) => {
    if (previousElement.classList.contains("layout__dockl")) {
        previousElement.style.width = calculateDockSize("#dockLeft") + "px";
        layout.leftDock?.setSize();
        return;
    }
    if (nextElement.classList.contains("layout__dockr")) {
        nextElement.style.width = calculateDockSize("#dockRight") + "px";
        layout.rightDock?.setSize();
        return;
    }
    previousElement.style.width = "";
    nextElement.style.width = "";
    previousElement.classList.add("fn__flex-1");
    nextElement.classList.add("fn__flex-1");
    if (resizeElement.parentElement?.classList.contains("layout__dockb")) {
        layout.bottomDock?.setSize();
    }
};

const handleVerticalResizeDblClick = (layout: any, previousElement: HTMLElement, nextElement: HTMLElement, resizeElement: HTMLElement) => {
    if (nextElement.classList.contains("layout__dockb")) {
        nextElement.style.height = "232px";
        layout.bottomDock?.setSize();
        return;
    }
    previousElement.style.height = "";
    nextElement.style.height = "";
    previousElement.classList.add("fn__flex-1");
    nextElement.classList.add("fn__flex-1");
    if (resizeElement.parentElement?.classList.contains("layout__dockl")) {
        layout.leftDock?.setSize();
        return;
    }
    if (resizeElement.parentElement?.classList.contains("layout__dockr")) {
        layout.rightDock?.setSize();
    }
};

const onResizeDblClick = (resizeElement: HTMLElement) => {
    const previousElement = resizeElement.previousElementSibling as HTMLElement;
    const nextElement = resizeElement.nextElementSibling as HTMLElement;
    if (!previousElement || !nextElement) {
        return;
    }
    const layout = getSiyuanLayout();
    nextElement.style.transition = "none";
    previousElement.style.transition = "none";
    const handleResize = resizeElement.classList.contains("layout__resize--lr") ? handleHorizontalResizeDblClick : handleVerticalResizeDblClick;
    handleResize(layout, previousElement, nextElement, resizeElement);
    resizeTabs();
    nextElement.style.transition = "";
    previousElement.style.transition = "";
};

export const addResize = (obj: Layout | Wnd) => {
    const resize = obj.resize;
    if (!resize) {
        return;
    }

    const resizeElement = document.createElement("div");
    if (resize === "lr") {
        resizeElement.classList.add("layout__resize--lr");
    }
    resizeElement.classList.add("layout__resize");
    obj.element.insertAdjacentElement("beforebegin", resizeElement);

    resizeElement.addEventListener("mousedown", (event: MouseEvent) => {
        onResizeMouseDown(event, resizeElement, resize);
    });

    resizeElement.addEventListener("dblclick", () => {
        onResizeDblClick(resizeElement);
    });
};
