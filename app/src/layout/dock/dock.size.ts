/**
 * dock.size.ts - Dock 尺寸相关逻辑
 * 从 index.ts 提取的尺寸计算函数
 */

import type { Dock } from "./index";
import { isTDock } from "./dock.guard";
import { isLayoutModel } from "./dock.guard";

const GRAPH_TYPES = ["graph", "globalGraph", "backlink"];

/**
 * 设置单个项目的尺寸
 */
export function setSizeForItem(dock: Dock, item: Element, totalActive: number): void {
    const index = item.getAttribute("data-index");
    const type = item.getAttribute("data-type");
    if (!isTDock(type)) {
        return;
    }

    const isHorizontal = dock.position === "Left" || dock.position === "Right";
    if (isHorizontal) {
        setHorizontalSize(dock, item, index, type, totalActive);
        return;
    }
    setVerticalSize(dock, item, index, type, totalActive);
}

/**
 * 设置水平方向尺寸
 */
function setHorizontalSize(
    dock: Dock,
    item: Element,
    index: string | null,
    type: TDock,
    totalActive: number
): void {
    const shouldSetHeight = index === "1" && totalActive > 1;
    const model = dock.data[type];
    // 只有已挂载的布局模型才能沿 parent 链读取所属 Dock 的实际高度。
    if (shouldSetHeight && isLayoutModel(model) && model.parent?.parent) {
        const dockElement = model.parent.parent.element;
        const height = dockElement.style.height ? dockElement.clientHeight.toString() : "";
        item.setAttribute("data-height", height);
    }
    item.setAttribute("data-width", dock.layout.element.clientWidth.toString());
}

/**
 * 设置垂直方向尺寸
 */
function setVerticalSize(
    dock: Dock,
    item: Element,
    index: string | null,
    type: TDock,
    totalActive: number
): void {
    const shouldSetWidth = index === "1" && totalActive > 1;
    const model = dock.data[type];
    // 只有已挂载的布局模型才能沿 parent 链读取所属 Dock 的实际宽度。
    if (shouldSetWidth && isLayoutModel(model) && model.parent?.parent) {
        const dockElement = model.parent.parent.element;
        const width = dockElement.style.width ? dockElement.clientWidth.toString() : "";
        item.setAttribute("data-width", width);
    }
    item.setAttribute("data-height", dock.layout.element.clientHeight.toString());
}

/**
 * 获取单个项目的尺寸
 */
export function getSizeForItem(dock: Dock, item: Element): number {
    const isHorizontal = dock.position === "Left" || dock.position === "Right";
    const sizeAttr = isHorizontal ? "data-width" : "data-height";
    const attrVal = item.getAttribute(sizeAttr);
    const parsed = parseInt(attrVal || "0", 10);
    if (parsed > 0) {
        return parsed;
    }

    const type = item.getAttribute("data-type");
    if (isHorizontal && type && GRAPH_TYPES.includes(type)) {
        return 320;
    }
    return 232;
}

/**
 * 获取最大尺寸
 */
export function getMaxSize(dock: Dock): number {
    let max = 0;
    const activeItems = [...dock.elements[0].querySelectorAll(".dock__item--active"),
        ...dock.elements[1].querySelectorAll(".dock__item--active")];
    for (const item of Array.from(activeItems)) {
        const size = getSizeForItem(dock, item);
        if (size > max) {
            max = size;
        }
    }
    return max;
}
