import type { DragState } from "./types";

/**
 * 作用：初始化幽灵元素。
 * 意图：克隆被拖拽项作为视觉反馈。
 * 调用时机：拖拽阈值触发后首次调用。
 * @param event 鼠标事件
 * @param state 拖拽状态
 */
export function initGhostElement(event: MouseEvent, state: DragState) {
    state.item.style.opacity = "0.38";
    state.ghostElement = state.item.cloneNode(true) as HTMLElement;
    state.outline.element.append(state.ghostElement);
    state.ghostElement.setAttribute("id", "dragGhost");
    /**
     * 作用：调整子元素的样式。
     * 意图：如果有子元素，添加 padding 以保持视觉一致性。
     * 生效场景：ghostElement 存在子元素。
     */
    if (state.ghostElement.firstElementChild) {
        state.ghostElement.firstElementChild.setAttribute("style", "padding-left:4px");
    }
    state.ghostElement.setAttribute("style", `border-radius: var(--b3-border-radius);background-color: var(--b3-list-hover);position: fixed; top: ${event.clientY}px; left: ${event.clientX}px; z-index:999997;`);
}

/**
 * 作用：更新幽灵元素位置。
 * 意图：跟随鼠标移动。
 * 调用时机：mousemove。
 * @param event 鼠标事件
 * @param state 拖拽状态
 */
export function updateGhostPosition(event: MouseEvent, state: DragState) {
    if (state.ghostElement) {
        state.ghostElement.style.top = event.clientY + "px";
        state.ghostElement.style.left = event.clientX + "px";
    }
}

/**
 * 作用：清除所有拖拽相关的样式。
 * 意图：重置状态，移除高亮与指示线。
 * 调用时机：鼠标移出、拖拽结束或目标变更时。
 * @param element 容器元素
 */
export function clearDragStyles(element: HTMLElement) {
    const items = element.querySelectorAll(".dragover__top, .dragover__bottom, .dragover, .dragover__current");
    for (const item of items) {
        item.classList.remove("dragover__top", "dragover__bottom", "dragover", "dragover__current");
    }
}

/**
 * 作用：更新目标元素的拖拽样式。
 * 意图：根据鼠标在目标元素上的位置（上、中、下）添加对应的 class，指示放下位置。
 * 调用时机：mousemove 且 hover 在有效目标上时。
 * @param event 鼠标事件
 * @param selectItem 目标元素
 */
export function updateDragStyle(event: MouseEvent, selectItem: HTMLElement) {
    const selectRect = selectItem.getBoundingClientRect();
    const dragHeight = selectRect.height * .2;
    /**
     * 作用：判断插入位置。
     * 意图：底部插入、顶部插入或成为子节点。
     * 生效场景：根据 clientY 与 element rect 的比较。
     */
    if (event.clientY > selectRect.bottom - dragHeight) {
        selectItem.classList.add("dragover__bottom");
    } else if (event.clientY < selectRect.top + dragHeight) {
        selectItem.classList.add("dragover__top");
    } else {
        selectItem.classList.add("dragover");
    }
}

/**
 * 作用：检查元素是否有拖拽样式。
 * 意图：判断该元素是否是有效的放置目标。
 * 调用时机：handleMouseUp。
 * @param item 检查的元素
 * @returns 是否包含相关 class
 */
export function hasDragStyle(item: HTMLElement): boolean {
    return item.classList.contains("dragover__top") || item.classList.contains("dragover__bottom") || item.classList.contains("dragover");
}

/**
 * 作用：获取撤销所需的 ID 信息。
 * 意图：记录移动前的状态，用于 transaction 的 undo 操作。
 * 调用时机：performSort 开始时。
 * @param item 被移动的项
 * @returns undoPreviousID 和 undoParentID
 */
export function getUndoInfo(item: HTMLElement) {
    const undoPreviousID = (item.previousElementSibling && item.previousElementSibling.tagName === "UL")
        ? item.previousElementSibling.previousElementSibling?.getAttribute("data-node-id")
        : item.previousElementSibling?.getAttribute("data-node-id");

    const undoParentID = item.parentElement?.previousElementSibling?.getAttribute("data-node-id");
    return { undoPreviousID, undoParentID };
}

/**
 * 作用：在 DOM 中移动元素并计算移动后的 ID。
 * 意图：根据 selectItem 的状态（top/bottom/inside）移动 item，并返回新的 parentID 和 previousID。
 * 调用时机：performSort 中。
 * @param state 拖拽状态
 * @returns 移动结果，包括是否有变更及新 ID
 */
export function moveItemInDOM(state: DragState): { hasChange: boolean, previousID: string | undefined, parentID: string | undefined } {
    const { item, selectItem } = state;
    if (!selectItem) {
        return { hasChange: false, previousID: undefined, parentID: undefined };
    }

    let previousID: string | undefined;
    let parentID: string | undefined;
    let hasChange = true;

    if (selectItem.classList.contains("dragover")) {
        parentID = selectItem.getAttribute("data-node-id") || undefined;
        if (selectItem.nextElementSibling && selectItem.nextElementSibling.tagName === "UL") {
            selectItem.nextElementSibling.insertAdjacentElement("afterbegin", item);
        } else {
            selectItem.insertAdjacentHTML("afterend", `<ul>${item.outerHTML}</ul>`);
            item.remove();
        }
    } else if (selectItem.classList.contains("dragover__top")) {
        parentID = selectItem.parentElement?.previousElementSibling?.getAttribute("data-node-id") || undefined;
        if (selectItem.previousElementSibling && selectItem.previousElementSibling.tagName === "UL") {
            previousID = selectItem.previousElementSibling.previousElementSibling?.getAttribute("data-node-id") || undefined;
        } else {
            previousID = selectItem.previousElementSibling?.getAttribute("data-node-id") || undefined;
        }

        if (previousID === item.dataset.nodeId || parentID === item.dataset.nodeId) {
            hasChange = false;
        } else {
            selectItem.before(item);
        }
    } else if (selectItem.classList.contains("dragover__bottom")) {
        previousID = selectItem.getAttribute("data-node-id") || undefined;
        if (previousID === item.previousElementSibling?.getAttribute("data-node-id")) {
            hasChange = false;
        } else {
            selectItem.after(item);
        }
    }
    return { hasChange, previousID, parentID };
}
