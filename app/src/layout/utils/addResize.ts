import {focusByRange} from "./imports";
import { getSiyuanLayout } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { hideElements } from "../../protyle/ui/hideElements";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { isWindow } from "../../util/platform/functions";
import { getAllModels } from "../getAll";
import { resizeTabs, setTabPosition } from "../tabUtil";
import { adjustLayout } from "../util";
import { acquireIframeInteractionLock, releaseIframeInteractionLock } from "./iframeInteractionLock";
import type {LayoutDomain, LayoutWindow} from "../layout.types";


/**
 * 作用：判断给定的元素是否属于需要较大最小宽度的面板（如反链、图谱、全局图谱、用于收件箱）。
 * 意图：在调整大小时，为特定类型的面板设置不同的最小尺寸限制。
 * 调用时机：在 `getMinSize` 中被调用，用于确定当前调整的元素是否适用大面板的最小宽度（320px vs 232px）。
 * 问题/改进：如果有新的大面板类型，需要手动在此添加。
 */
const isLargePanel = (item: Element) => {
    return (item.classList.contains("sy__backlink") || item.classList.contains("sy__graph")
        || item.classList.contains("sy__globalGraph") || item.classList.contains("sy__inbox")) &&
        !item.classList.contains("fn__none") && !hasClosestByClassName(item, "fn__none");
};

/**
 * 作用：获取元素的最小调整尺寸。
 * 意图：区分普通面板和大面板（如图谱），防止面板被缩得太小无法使用。
 * 调用时机：拖拽调整大小时 (`handleResizeMouseMove`)。
 */
const getMinSize = (element: HTMLElement) => {
    const found = Array.from(element.querySelectorAll(".file-tree")).find(isLargePanel);
    return found ? 320 : 232;
};

/**
 * 作用：将元素的 flex 宽度/高度转换为固定的像素值。
 * 意图：在调整大小开始前，锁定当前尺寸，以便基于此进行计算，并移除 `fn__flex-1` 类以允许手动调整。
 * 调用时机：`onResizeMouseDown` 调整开始时。
 */
const setSize = (item: HTMLElement, direction: string) => {
    if (!item.classList.contains("fn__flex-1")) {
        return;
    }
    if (direction === "lr") {
        item.style.width = item.clientWidth + "px";
        item.classList.remove("fn__flex-1");
        return;
    }
    item.style.height = item.clientHeight + "px";
    item.classList.remove("fn__flex-1");

};

/**
 * 作用：处理拖拽开始事件，主要是恢复文件树项的透明度。
 * 意图：修复文件树拖拽可能导致的视觉残留或透明度异常问题。
 * 调用时机：`onResizeMouseDown` 中绑定到 document 的 `ondragstart`。
 */
const handleDragStart = () => {
    // 文件树拖拽会产生透明效果
    const files = document.querySelectorAll(".sy__file .b3-list-item");
    for (let i = 0; i < files.length; i++) {
        const item = files[i];
        if (item instanceof HTMLElement && item.style.opacity === "0.38") {
            item.style.opacity = "";
        }
    }
    return false;
};

/**
 * 作用：处理鼠标移动事件，实时计算并应用新的尺寸。
 * 意图：实现拖拽调整布局大小的核心逻辑，包含最小尺寸限制和边缘情况处理。
 * 调用时机：`onResizeMouseDown` 中绑定到 document 的 `onmousemove`。
 */
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
    const clientPos = direction === "lr" ? moveEvent.clientX : moveEvent.clientY;
    const previousNowSize = (previousSize + (clientPos - x));
    const nextNowSize = (nextSize - (clientPos - x));
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
    if (nextElement.classList.contains("layout__center") && nextNowSize <= 148) {
        return;
    }
    if (!previousElement.classList.contains("fn__flex-1")) {
        previousElement.style.setProperty(direction === "lr" ? "width" : "height", previousNowSize + "px");
    }
    if (!nextElement.classList.contains("fn__flex-1")) {
        nextElement.style.setProperty(direction === "lr" ? "width" : "height", nextNowSize + "px");
    }
};

/**
 * 作用：处理鼠标释放事件，结束调整操作。
 * 意图：清理事件监听，保存布局状态 (`adjustLayout`, `resizeTabs`)，并恢复样式。
 * 调用时机：`onResizeMouseDown` 中绑定到 document 的 `onmouseup`。
 */
const handleResizeMouseUp = (
    documentSelf: Document,
    range: Range | undefined,
    previousElement: HTMLElement,
    nextElement: HTMLElement
) => {
    releaseIframeInteractionLock();
    documentSelf.onmousemove = null;
    documentSelf.onmouseup = null;
    documentSelf.ondragstart = null;
    documentSelf.onselectstart = null;
    documentSelf.onselect = null;
    const layout = getSiyuanLayout();
    adjustLayout(isWindow() ? layout.centerLayout : undefined);
    setTabPosition(true);
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

/**
 * 作用：初始化调整大小操作。
 * 意图：绑定事件，计算初始状态，准备进行 resize。
 * 调用时机：当用户在 resize 句柄上按下鼠标时触发。
 */
const onResizeMouseDown = (event: MouseEvent, resizeElement: HTMLElement, direction: string) => {
    event.preventDefault();
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
    const nextElement = resizeElement.nextElementSibling;
    const previousElement = resizeElement.previousElementSibling;
    if (!nextElement || !previousElement || !(nextElement instanceof HTMLElement) || !(previousElement instanceof HTMLElement)) {
        return;
    }
    acquireIframeInteractionLock();
    nextElement.style.overflow = "auto"; // 拖动时 layout__resize 会出现 https://github.com/siyuan-note/siyuan/issues/6221
    previousElement.style.overflow = "auto";
    nextElement.style.transition = "none";
    previousElement.style.transition = "none";
    const resizeNext = !nextElement.nextElementSibling || nextElement.nextElementSibling.classList.contains("layout__dockresize");
    setSize(resizeNext ? nextElement : previousElement, direction);
    const x = direction === "lr" ? event.clientX : event.clientY;
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

/**
 * 作用：计算侧边栏 Dock 的展开宽度。
 * 意图：当双击 Dock 边界自动展开时，根据 Dock 内激活的内容（如图谱）决定展开宽度。
 * 调用时机：双击 resize 句柄时 (`handleHorizontalResizeDblClick`)。
 */
const calculateDockSize = (selector: string) => {
    const dockItems = document.querySelectorAll(`${selector} .dock__item--active`);
    const bigType = ["graph", "inbox", "globalGraph", "backlink"];
    for (let i = 0; i < dockItems.length; i++) {
        const item = dockItems[i];
        if (!item) {
            continue;
        }
        const type = item.getAttribute("data-type");
        if (type && bigType.includes(type)) {
            return 320;
        }
    }
    return 232;
};

/**
 * 作用：处理水平方向的双击自动调整。
 * 意图：快速展开/收起侧边栏，或重置左右分屏的比例（均分）。
 * 调用时机：`onResizeDblClick` 中，当方向为 `lr` 时。
 */
const handleHorizontalResizeDblClick = (layout: ReturnType<typeof getSiyuanLayout>, previousElement: HTMLElement, nextElement: HTMLElement, resizeElement: HTMLElement) => {
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

/**
 * 作用：处理垂直方向的双击自动调整。
 * 意图：快速展开/收起底部栏，或重置上下分屏的比例。
 * 调用时机：`onResizeDblClick` 中，当方向不为 `lr` 时。
 */
const handleVerticalResizeDblClick = (layout: ReturnType<typeof getSiyuanLayout>, previousElement: HTMLElement, nextElement: HTMLElement, resizeElement: HTMLElement) => {
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

/**
 * 作用：resize 句柄的双击入口函数。
 * 意图：分发双击事件到水平或垂直处理函数。
 * 调用时机：用户双击 resize 句柄时。
 */
const onResizeDblClick = (resizeElement: HTMLElement) => {
    const previousElement = resizeElement.previousElementSibling;
    const nextElement = resizeElement.nextElementSibling;
    if (!previousElement || !nextElement || !(previousElement instanceof HTMLElement) || !(nextElement instanceof HTMLElement)) {
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

/**
 * 作用：为布局对象（Layout 或 Wnd）添加 resize 句柄。
 * 意图：在 DOM 中插入 resize 分割线，并绑定交互事件，使界面可调整大小。
 * 调用时机：布局初始化或创建新窗口/分割时。
 */
export const addResize = (obj: LayoutDomain | LayoutWindow, after = true) => {
    const resize = obj.resize;
    if (!resize) {
        return;
    }

    const resizeElement = document.createElement("div");
    if (resize === "lr") {
        resizeElement.classList.add("layout__resize--lr");
    }
    resizeElement.classList.add("layout__resize");
    let insertPosition: InsertPosition = "afterend";
    // 新节点位于现有内容之后时，若前方尚无 resize 句柄，则把句柄插入节点之前以保持原布局顺序。
    if (after && obj.element.previousElementSibling && !obj.element.previousElementSibling.classList.contains("layout__resize")) {
        insertPosition = "beforebegin";
    }
    obj.element.insertAdjacentElement(insertPosition, resizeElement);

    resizeElement.addEventListener("mousedown", (event: MouseEvent) => {
        onResizeMouseDown(event, resizeElement, resize);
    });

    resizeElement.addEventListener("dblclick", () => {
        onResizeDblClick(resizeElement);
    });
};
