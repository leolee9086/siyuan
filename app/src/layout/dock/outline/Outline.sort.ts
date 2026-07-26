/**
 * Outline 拖拽排序功能
 * 从 Outline.ts 拆分出来以保持单文件行数限制
 */
import { hasClosestByClassName } from "../../../protyle/util/hasClosest";
import { getAllModels } from "../../getAll";
import { isMobile } from "../../../platform";
import {transaction} from "../../../protyle/wysiwyg/transaction/submit";
import { dragOverScroll, stopScrollAnimation } from "../../../boot/globalEvent/dragover";
import type {OutlineDomain} from "./types";
import type { DragState } from "./types";
import {
    initGhostElement,
    updateGhostPosition,
    clearDragStyles,
    updateDragStyle,
    hasDragStyle,
    moveItemInDOM,
    getUndoInfo
} from "./Outline.sort.util";

/**
 * 作用：绑定拖拽排序事件。
 * 意图：为大纲元素添加 mousedown 事件监听，启动拖拽排序流程。
 * 调用时机：Outline 实例初始化时。
 * @同步豁免: UI构建
 * @param outline Outline 实例
 */
export function bindSort(outline: OutlineDomain) {
    outline.element.addEventListener("mousedown", (event: MouseEvent) => {
        handleMouseDown(outline, event);
    });
}

/**
 * 作用：处理鼠标按下事件。
 * 意图：检查点击目标是否为列表项，若是则初始化拖拽状态并绑定后续事件。
 * 调用时机：大纲元素上的 mousedown 事件触发时。
 * @param outline Outline 实例
 * @param event 鼠标事件对象
 */
function handleMouseDown(outline: OutlineDomain, event: MouseEvent) {
    /**
     * 作用：事件目标校验。
     * 意图：仅处理 HTML 元素的事件。
     */
    if (!(event.target instanceof HTMLElement)) {
        return;
    }
    const target = event.target;
    // hasClosestByClassName 返回 HTMLElement | false
    const item = hasClosestByClassName(target, "b3-list-item");
    /**
     * 作用：校验拖拽目标有效性。
     * 意图：确保拖拽的是列表项且非加载状态。
     * 生效场景：点击非 LI 元素或正在加载时。
     */
    if (!item || item.tagName !== "LI" || outline.element.getAttribute("data-loading") === "true") {
        return;
    }

    document.ondragstart = () => false;

    const state: DragState = {
        item,
        outline,
        contentRect: outline.element.getBoundingClientRect(),
        startX: event.clientX,
        startY: event.clientY,
    };

    /**
     * 作用：查找对应的编辑器。
     * 意图：确保找到的编辑器的 rootID 与大纲的 blockId 匹配。
     * 生效场景：非移动端时遍历所有编辑器模型。
     */
    const targetModel = !isMobile ? getAllModels().editor.find(editItem => editItem.editor.protyle.block.rootID === outline.blockId) : undefined;
    if (targetModel) {
        state.editor = targetModel.editor.protyle;
    }

    document.onmousemove = (moveEvent: MouseEvent) => {
        handleMouseMove(moveEvent, state);
    };

    document.onmouseup = () => {
        // 解绑事件
        document.onmousemove = null;
        document.onmouseup = null;
        document.ondragstart = null;
        document.onselectstart = null;
        document.onselect = null;
        handleMouseUp(state);
    };
}

/**
 * 作用：处理鼠标移动事件。
 * 意图：更新拖拽幽灵元素位置，计算悬停状态，处理自动滚动。
 * 调用时机：document 上的 mousemove 事件触发时（在拖拽过程中）。
 * @param moveEvent 鼠标移动事件
 * @param state 拖拽状态对象
 */
function handleMouseMove(moveEvent: MouseEvent, state: DragState) {
    const { editor, startX, startY } = state;
    /**
     * 作用：校验拖拽起始条件。
     * 意图：排除无效编辑器、禁用状态或微小抖动误触。
     * 生效场景：拖拽开始前的移动检测。
     */
    if (!editor || editor.disabled || Math.abs(moveEvent.clientY - startY) < 3 &&
        Math.abs(moveEvent.clientX - startX) < 3) {
        return;
    }
    moveEvent.preventDefault();
    moveEvent.stopPropagation();

    handleDragGhost(moveEvent, state);
    handleDragInteraction(moveEvent, state);
}

/**
 * 作用：处理鼠标松开事件。
 * 意图：清理事件监听，执行排序操作。
 * 调用时机：document 上的 mouseup 事件。
 * @param state 拖拽状态
 */
function handleMouseUp(state: DragState) {
    // 已经在调用处解绑，这里处理剩余逻辑
    state.ghostElement?.remove();
    state.item.style.opacity = "";
    stopScrollAnimation();

    if (!state.selectItem) {
        // 尝试从 DOM 中获取当前的拖拽目标
        updateSelectItemFromDragOver(state);
    }

    /**
     * 作用：确认执行排序。
     * 意图：如果存在有效的目标项、编辑器实例且有样式指示，则执行排序。
     * 生效场景：mouseup 时一切就绪。
     */
    if (state.selectItem && state.editor && hasDragStyle(state.selectItem)) {
        performSort(state);
    }

    clearDragStyles(state.outline.element);
}

/**
 * 作用：执行排序逻辑。
 * 意图：计算移动参数，DOM 移动，并提交 transaction。
 * 调用时机：handleMouseUp 确认需要排序时。
 * @param state 拖拽状态
 */
function performSort(state: DragState) {
    const { item, selectItem, editor } = state;
    /**
     * 作用：校验排序必要条件。
     * 意图：确保有目标项和编辑器实例。
     * 生效场景：执行排序前。
     */
    if (!selectItem || !editor) {
        return;
    }

    const undoInfo = getUndoInfo(item);
    const moveResult = moveItemInDOM(state);

    /**
     * 作用：提交变更。
     * 意图：仅在位置实际发生改变时执行事务。
     */
    if (moveResult.hasChange) {
        executeSortTransaction(state, moveResult, undoInfo);
    }
}

/**
 * 作用：执行排序的 Transaction。
 * 意图：将排序操作提交到编辑器核心，保持数据同步，并禁用编辑。
 * 调用时机：moveItemInDOM 返回 hasChange 为 true 时。
 * @param state 拖拽状态
 * @param moveResult 移动结果
 * @param undoInfo 撤销信息
 */
function executeSortTransaction(
    state: DragState,
    moveResult: { previousID: string | undefined, parentID: string | undefined },
    undoInfo: { undoPreviousID: string | null | undefined, undoParentID: string | null | undefined }
) {
    const { item, editor, outline } = state;
    /**
     * 作用：校验事务提交条件。
     * 意图：确保编辑器和节点 ID 存在。
     * 生效场景：提交排序事务前。
     */
    if (!editor || !item.dataset.nodeId) {
        return;
    }

    outline.element.setAttribute("data-loading", "true");

    transaction(editor, [{
        action: "moveOutlineHeading",
        id: item.dataset.nodeId,
        previousID: moveResult.previousID,
        parentID: moveResult.parentID,
    }], [{
        action: "moveOutlineHeading",
        id: item.dataset.nodeId,
        previousID: undoInfo.undoPreviousID || undefined,
        parentID: undoInfo.undoParentID || undefined,
    }]);

    // https://github.com/siyuan-note/siyuan/issues/10828#issuecomment-2044099675
    const wysiwygElement = editor.wysiwyg?.element;
    /**
     * 作用：检查所见即所得元素。
     * 意图：如果存在，禁用相关元素的编辑能力以防止冲突。
     * 生效场景：排序后处理 DOM。
     */
    if (wysiwygElement) {
        const editableElements = wysiwygElement.querySelectorAll('[data-type="NodeHeading"] [contenteditable="true"][spellcheck]');
        for (const editable of editableElements) {
            editable.setAttribute("contenteditable", "false");
        }
    }
}

/**
 * 作用：获取当前的各种悬停样式的元素。
 * 意图：辅助 handleMouseUp 确定最终放置目标。
 * @param state 拖拽状态
 * @returns 找到的 HTMLElement 或 undefined
 */
function getDragOverElement(state: DragState): HTMLElement | undefined {
    const element = state.outline.element.querySelector(".dragover__top, .dragover__bottom, .dragover");
    /**
     * 作用：类型校验。
     * 意图：确保查询结果是 HTMLElement。
     */
    if (element instanceof HTMLElement) {
        return element;
    }
    return undefined;
}

/**
 * 作用：处理拖拽过程中的幽灵元素和滚动。
 * 意图：更新拖拽视觉反馈。
 * 调用时机：handleMouseMove 内部。
 * @param moveEvent 鼠标事件
 * @param state 拖拽状态
 */
function handleDragGhost(moveEvent: MouseEvent, state: DragState) {
    /**
     * 作用：初始化幽灵元素。
     * 意图：懒加载创建拖拽镜像。
     */
    if (!state.ghostElement) {
        initGhostElement(moveEvent, state);
    }
    updateGhostPosition(moveEvent, state);
    dragOverScroll(moveEvent, state.contentRect, state.outline.element);
}

/**
 * 作用：处理拖拽过程中的交互逻辑。
 * 意图：计算目标位置、样式更新等。
 * 调用时机：handleMouseMove 内部。
 * @param moveEvent 鼠标事件
 * @param state 拖拽状态
 */
function handleDragInteraction(moveEvent: MouseEvent, state: DragState) {
    /**
     * 作用：检查鼠标是否在大纲元素范围内。
     * 意图：如果移出范围，清除拖拽样式。
     * 生效场景：拖拽过程中鼠标移出大纲面板。
     */
    if (moveEvent.target instanceof Node && !state.outline.element.contains(moveEvent.target)) {
        clearDragStyles(state.outline.element);
        return;
    }

    /**
     * 作用：更新选中项。
     * 意图：当鼠标悬停在列表项上时，更新 state.selectItem。
     * 生效场景：拖拽过程中寻找目标位置。
     */
    updateSelectItemFromTarget(moveEvent, state);

    /**
     * 作用：校验目标项有效性。
     * 意图：排除非 LI 元素或 Fixed 定位元素。
     */
    if (!state.selectItem || state.selectItem.tagName !== "LI" || state.selectItem.style.position === "fixed") {
        return;
    }

    clearDragStyles(state.outline.element);

    /**
     * 作用：防止悬停在自身上。
     * 意图：如果是自身，只添加 distinct class，不进行位置计算。
     * 生效场景：拖拽目标悬停在自己身上。
     */
    if (state.selectItem === state.item) {
        state.selectItem.classList.add("dragover__current");
        return;
    }

    updateDragStyle(moveEvent, state.selectItem);
}

/**
 * 作用：从 DragOver 元素更新选中项。
 * 意图：辅助 handleMouseUp，扁平化逻辑。
 * @param state 拖拽状态
 */
function updateSelectItemFromDragOver(state: DragState) {
    const result = getDragOverElement(state);
    if (result) {
        state.selectItem = result;
        return;
    }
    delete state.selectItem;
}

/**
 * 作用：从事件目标更新选中项。
 * 意图：辅助 handleDragInteraction，扁平化逻辑。
 * @param moveEvent 鼠标事件
 * @param state 拖拽状态
 */
function updateSelectItemFromTarget(moveEvent: MouseEvent, state: DragState) {
    if (!(moveEvent.target instanceof HTMLElement)) {
        return;
    }
    const closestItem = hasClosestByClassName(moveEvent.target, "b3-list-item");
    if (closestItem) {
        state.selectItem = closestItem;
        return;
    }
    delete state.selectItem;
}
