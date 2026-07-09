/**
 * dock.tab.ts - Dock Tab 增删操作逻辑
 * 从 index.ts 提取的 add / remove / 排序索引计算等函数
 */

import type { Dock } from "./index";
import { Custom } from "./Custom";
import { getDockByType } from "./imports";
import { saveLayout } from "./imports";
import { Constants } from "./imports";
import { adjustDockPadding } from "./util";
import { resetFloatDockSize } from "./util";
import { isTDock } from "./dock.guard";
import { removeSourceTab } from "./dock.init";
import { setWindowTimeout } from "./dock.environment";

const HORIZONTAL_POSITIONS: Record<string, TPluginDockPosition> = {
    LeftTop: "LeftTop",
    LeftBottom: "LeftBottom",
    RightTop: "RightTop",
    RightBottom: "RightBottom"
};

/**
 * 计算源元素在同级中的排序索引
 *
 * 作用：统计 sourceElement 之前的兄弟元素数量
 * 意图：得到插件 Dock 的排序位置
 * 调用时机：跨 Dock 拖拽落位后
 */
export function getSortIndex(sourceElement: Element): number {
    let sortIndex = 0;
    let previousElement = sourceElement;
    while (previousElement.previousElementSibling) {
        sortIndex++;
        previousElement = previousElement.previousElementSibling;
    }
    return sortIndex;
}

/**
 * 根据源元素所在 Dock 推断插件 Dock 位置标识
 *
 * 作用：将 DOM 位置映射为 TPluginDockPosition
 * 意图：保存插件 Dock 的位置信息
 * 调用时机：跨 Dock 拖拽落位后
 */
export function getPluginPosition(sourceElement: Element, index: number): TPluginDockPosition | undefined {
    const leftDockElement = document.getElementById("dockLeft");
    const rightDockElement = document.getElementById("dockRight");
    const inLeft = !!leftDockElement && leftDockElement.contains(sourceElement);
    const leftLast = leftDockElement?.lastElementChild;
    const inLeftBottom = inLeft && !!leftLast && leftLast.contains(sourceElement);
    if (inLeftBottom) {
        return "BottomLeft";
    }
    if (inLeft) {
        return HORIZONTAL_POSITIONS["Left" + (index === 0 ? "Top" : "Bottom")];
    }
    const inRight = !!rightDockElement && rightDockElement.contains(sourceElement);
    const rightLast = rightDockElement?.lastElementChild;
    const inRightBottom = inRight && !!rightLast && rightLast.contains(sourceElement);
    if (inRightBottom) {
        return "BottomRight";
    }
    if (inRight) {
        return HORIZONTAL_POSITIONS["Right" + (index === 0 ? "Top" : "Bottom")];
    }
    return undefined;
}

/**
 * 调整 Dock 分隔条显隐
 *
 * 作用：当上下两组按钮均存在时显示分隔条，否则隐藏
 * 意图：避免无意义的空白分隔条
 * 调用时机：Dock 内容变化后
 */
export function adjustDockSplit(dock: Dock): void {
    if (dock.position === "Bottom") {
        return;
    }
    const top = dock.elements[0];
    if (!top) {
        return;
    }
    const splitter = top.nextElementSibling;
    if (!splitter) {
        return;
    }
    const bottom = dock.elements[1];
    const bothFilled = !!bottom && !!top.innerHTML && !!bottom.innerHTML;
    splitter.classList.toggle("fn__none", !bothFilled);
}

/**
 * 计算跨轴移动时需要清除的尺寸字段
 *
 * 作用：仅在左右轴与下轴之间跨轴移动时清除对应维度尺寸
 * 意图：左右侧之间或下侧内部移动时保留原有有效尺寸
 * 调用时机：跨 Dock 拖拽落位后
 */
function buildCrossAxisSize(
    sourceDock: Dock,
    dock: Dock,
    sourceElement: Element
): Partial<Config.IUILayoutDockPanelSize> {
    const size: Partial<Config.IUILayoutDockPanelSize> = {};
    const sourceIsHorizontal = sourceDock.position === "Left" || sourceDock.position === "Right";
    if (sourceIsHorizontal && dock.position === "Bottom") {
        sourceElement.setAttribute("data-width", "");
        size.width = null;
    }
    if (sourceDock.position === "Bottom" && (dock.position === "Left" || dock.position === "Right")) {
        sourceElement.setAttribute("data-height", "");
        size.height = null;
    }
    return size;
}

/**
 * 将源元素插入到目标 Dock 的指定位置
 *
 * 作用：按 previousType 定位插入点，否则插入到容器起始
 * 意图：支持拖拽时精确控制落位顺序
 * 调用时机：跨 Dock 拖拽落位后
 */
function insertSourceToTarget(
    dock: Dock,
    sourceElement: Element,
    index: number,
    previousType?: string
): void {
    sourceElement.setAttribute("data-index", index.toString());
    const targetContainer = dock.elements[index];
    if (!targetContainer) {
        return;
    }
    const targetParent = targetContainer.parentElement;
    const prev = previousType && targetParent
        ? targetParent.querySelector(`[data-type="${previousType}"]`)
        : null;
    if (prev) {
        prev.after(sourceElement);
        return;
    }
    targetContainer.insertAdjacentElement("afterbegin", sourceElement);
}

/**
 * 构建插件 Dock 持久化选项
 *
 * 作用：组装 saveLocalPlugin 所需的 index / size / position 字段
 * 意图：兼容 exactOptionalPropertyTypes，仅在 position 存在时写入
 * 调用时机：跨 Dock 拖拽落位后
 */
function buildPluginOptions(
    sourceElement: Element,
    index: number,
    size: Partial<Config.IUILayoutDockPanelSize>
): {
    position?: TPluginDockPosition,
    size?: Partial<Config.IUILayoutDockPanelSize>,
    index?: number,
    show?: boolean
} {
    const options: {
        position?: TPluginDockPosition,
        size?: Partial<Config.IUILayoutDockPanelSize>,
        index?: number,
        show?: boolean
    } = { index: getSortIndex(sourceElement), size };
    const position = getPluginPosition(sourceElement, index);
    if (position) {
        options.position = position;
    }
    return options;
}

/**
 * 完成源 Dock 侧的清理与目标 Dock 侧的激活收尾
 *
 * 作用：从源 Dock 移除数据、在目标 Dock 激活并持久化布局
 * 意图：将拖拽后的状态变更与副作用集中收尾
 * 调用时机：跨 Dock 拖拽落位后
 */
function finalizeDockAdd(
    dock: Dock,
    sourceDock: Dock,
    sourceElement: Element,
    typeAttr: TDock,
    index: number,
    size: Partial<Config.IUILayoutDockPanelSize>,
    hasActive: boolean
): void {
    delete sourceDock.data[typeAttr];
    insertSourceToTarget(dock, sourceElement, index);
    const first = dock.elements[0];
    const dockParent = first?.parentElement;
    if (dockParent) {
        dockParent.classList.remove("fn__none");
    }
    resetFloatDockSize();
    dock.data[typeAttr] = true;
    if (hasActive) {
        dock.toggleModel(typeAttr, true, false, false, false);
    }
    setWindowTimeout(() => saveLayout(), Constants.TIMEOUT_TRANSITION);
    dock.saveLocalPlugin(typeAttr, buildPluginOptions(sourceElement, index, size));
    adjustDockPadding();
    adjustDockSplit(dock);
    adjustDockSplit(sourceDock);
}

/**
 * 添加 Dock Item
 *
 * 作用：将其他位置拖拽来的 Tab 添加到当前 Dock
 * 意图：支持 Dock 间的拖拽重组
 * 调用时机：拖拽 Tab 到 Dock 区域释放时
 */
export function addDockTab(
    dock: Dock,
    index: number,
    sourceElement: Element,
    previousType?: string
): void {
    const typeAttr = sourceElement.getAttribute("data-type");
    if (!isTDock(typeAttr)) {
        return;
    }
    const sourceDock = getDockByType(typeAttr);
    if (!sourceDock) {
        return;
    }
    const size = buildCrossAxisSize(sourceDock, dock, sourceElement);
    const sourceFirst = sourceDock.elements[0];
    const sourceParent = sourceFirst?.parentElement;
    const sourceItems = sourceParent ? sourceParent.querySelectorAll(".dock__item") : null;
    if (sourceItems && sourceItems.length === 1 && sourceParent) {
        sourceParent.classList.add("fn__none");
    }
    const sourceIndex = parseInt(sourceElement.getAttribute("data-index") || "0", 10);
    removeSourceTab(sourceDock, sourceIndex, sourceElement);
    const hasActive = sourceElement.classList.contains("dock__item--active");
    if (hasActive) {
        sourceDock.toggleModel(typeAttr, false, false, false, false);
    }
    if (previousType) {
        insertSourceToTarget(dock, sourceElement, index, previousType);
    }
    finalizeDockAdd(dock, sourceDock, sourceElement, typeAttr, index, size, hasActive);
}

/**
 * 移除 Dock Item
 *
 * 作用：从当前 Dock 移除指定的 Item
 * 意图：清理不再需要的或被拖走到其他位置的 Item
 * 调用时机：Item 被关闭或拖出时
 */
export function removeDockItem(dock: Dock, key: TDock | string): void {
    if (isTDock(key)) {
        dock.toggleModel(key, false, true, true);
    }
    const first = dock.elements[0];
    const parent = first?.parentElement;
    const item = parent?.querySelector(`[data-type="${key}"]`);
    if (item) {
        item.remove();
    }
    const custom = dock.data[key];
    if (custom instanceof Custom && custom.parent && custom.parent.parent) {
        custom.parent.parent.removeTab(custom.parent.id);
    }
    const remainItems = parent ? parent.querySelectorAll(".dock__item") : null;
    if (remainItems && remainItems.length === 1 && parent) {
        parent.classList.add("fn__none");
        adjustDockPadding();
    }
    delete dock.data[key];
    adjustDockSplit(dock);
}
