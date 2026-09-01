/**
 * 拖拽路由辅助模块
 *
 * 作用：处理 gutter 拖拽和 AV ViewTab 排序的路由分发
 * 意图：从 onDrop 主文件中提取路由逻辑，保持主文件在 300 行以内
 * 调用时机：onDrop 主函数根据 dataTransfer 类型分发到此模块
 */
import { Constants } from "../../../constants";
import { hasClosestBlock, hasClosestByClassName } from "../hasClosest";
import {transaction} from "../../wysiwyg/transaction/submit";
import { hideElements } from "../../ui/hideElements";
import { getDragElement } from "./onDrop.environment";
import { cleanupKanbanGroupDragover } from "./onDragOver";
import {
    handleAvCellDrop,
    resolveAvItemPreviousId,
    buildAvRowSortOps,
    executeAvInsert,
} from "./onDrop.helper.avDrop";
import {
    focusAtDropPoint,
    insertAsRef,
    insertAsEmbed,
    collectSourceElements,
    prepareSourceData,
    handleBlockDrag,
} from "./onDrop.helper.gutter";
import { IDndState } from "./onDrop.types";

/**
 * 处理 AV ViewTab 排序拖拽
 *
 * 作用：当用户拖拽 AV 视图标签到新位置时，执行视图排序事务
 * 意图：ViewTab 排序是独立的拖拽场景，不涉及块移动
 * 调用时机：gutterType 以 NodeAttributeView+ViewTab 前缀开头时
 *
 * @param protyle 编辑器实例
 * @param gutterType 完整的 gutter 类型字符串
 */
export const handleAvViewTabSort = async (
    protyle: IProtyle,
    gutterType: string,
): Promise<void> => {
    const dragEl = getDragElement();
    // dragElement 不存在时无法获取 AV 信息
    if (!dragEl) {
        return;
    }
    const blockElement = hasClosestBlock(dragEl);
    // 块元素不存在时无法执行排序
    if (!blockElement) {
        return;
    }
    const avID = blockElement.getAttribute("data-av-id") ?? "";
    const blockID = blockElement.getAttribute("data-node-id") ?? "";
    const id = dragEl.getAttribute("data-id") ?? "";
    const prevId = dragEl.previousElementSibling?.getAttribute("data-id") ?? undefined;
    const undoPrevId = gutterType.split(Constants.ZWSP).pop();
    transaction(protyle, [{
        action: "sortAttrViewView",
        avID, blockID, id,
        previousID: prevId,
        data: "unRefresh",
    }], [{
        action: "sortAttrViewView",
        avID, blockID, id,
        previousID: undoPrevId,
    }]);
};

/**
 * 处理 gutter 拖拽到 AV 行或画廊项的排序/插入
 *
 * 作用：根据拖拽源类型决定是行内排序还是外部插入
 * 意图：AV 行和画廊项的排序/插入逻辑高度相似，统一处理减少重复
 * 调用时机：gutter 拖拽目标为 av__row / av__gallery-item / av__gallery-add 时
 *
 * @param protyle 编辑器实例
 * @param targetElement 拖拽目标元素
 * @param targetClass 目标元素的 CSS 类名列表
 * @param gutterTypes 解析后的 gutter 类型数组
 * @param selectedIds 被拖拽的块 ID 列表
 * @param sourceIds 源元素的 node-id 列表
 * @param srcs 源元素的操作数据
 * @param type 目标类型：'row' 或 'gallery'
 */
const handleGutterAvItemDrop = async (
    protyle: IProtyle,
    targetElement: Element,
    targetClass: string[],
    gutterTypes: string[],
    selectedIds: string[],
    sourceIds: string[],
    srcs: IOperationSrcs[],
    type: "row" | "gallery",
): Promise<void> => {
    const blockElement = hasClosestBlock(targetElement);
    // 块元素不存在时无法操作 AV
    if (!blockElement) {
        return;
    }
    const previousID = resolveAvItemPreviousId(targetElement, targetClass);
    const avID = blockElement.getAttribute("data-av-id") ?? "";
    // 判断是否为行内排序拖拽
    const isRowSort = type === "row" && gutterTypes[0] === "nodeattributeviewrowmenu";
    const isGallerySort = type === "gallery"
        && (gutterTypes[1] ?? "") === "galleryitem"
        && gutterTypes[0] === "nodeattributeview";

    // 行内排序：构建排序操作并执行事务
    if (isRowSort || isGallerySort) {
        const targetGroupID = type === "row"
            ? targetElement.parentElement?.getAttribute("data-group-id") ?? ""
            : targetElement.parentElement?.parentElement?.getAttribute("data-group-id") ?? "";
        const selector = type === "row"
            ? ".av__body{groupAttr} .av__row[data-id=\"{id}\"]"
            : ".av__body[data-group-id=\"{groupID}\"] .av__gallery-item[data-id=\"{id}\"]";
        const { doOperations, undoOperations } = buildAvRowSortOps(
            blockElement, avID, previousID, selectedIds, targetGroupID, selector,
        );
        transaction(protyle, doOperations, undoOperations);
        return;
    }
    // 外部插入：委托 executeAvInsert 处理动画和事务
    await executeAvInsert(
        protyle, blockElement, targetElement, previousID,
        sourceIds, srcs, type,
    );
};

/**
 * 处理 gutter 普通拖拽（非 alt/shift 修饰键）
 *
 * 作用：收集源元素，根据目标类型路由到 AV 列排序、AV 行排序、AV 插入或普通块拖拽
 * 意图：普通拖拽涉及多种目标类型，需要先收集源数据再分发
 * 调用时机：handleGutterDrop 中非 alt/shift 且目标有 dragover 标记时
 *
 * @param protyle 编辑器实例
 * @param editorElement 编辑器容器元素
 * @param event 拖拽事件
 * @param targetElement 拖拽目标元素
 * @param gutterType 完整的 gutter 类型字符串
 * @param gutterTypes 解析后的 gutter 类型数组
 * @param selectedIds 被拖拽的块 ID 列表
 * @param state 拖拽状态
 */
export const handleGutterNormalDrop = async (
    protyle: IProtyle,
    editorElement: HTMLElement,
    event: DragEvent & { target: HTMLElement },
    targetElement: Element,
    gutterType: string,
    gutterTypes: string[],
    selectedIds: string[],
    state: IDndState,
    isCopy: boolean,
): Promise<void> => {
    const sourceElements = await collectSourceElements(
        selectedIds, gutterType, gutterTypes, event,
    );
    const { sourceIds, srcs } = await prepareSourceData(sourceElements);
    hideElements(["gutter"], protyle);
    const targetClass = targetElement.className.split(" ");
    targetElement.classList.remove(
        "dragover__bottom",
        "dragover__top",
        "dragover__left",
        "dragover__right",
        "dragover__bottom--sibling",
        "dragover__top--sibling",
        "dragover__bottom--child",
        "dragover__top--child"
    );
    (targetElement as HTMLElement).style.removeProperty("--drag-indent");
    (targetElement as HTMLElement).style.removeProperty("--drag-guides");
    (targetElement as HTMLElement).style.removeProperty("--drag-line-left");
    (targetElement as HTMLElement).style.removeProperty("--drag-base-bg");
    (targetElement as HTMLElement).style.removeProperty("--drag-line-bg");

    // AV 单元格列排序
    if (targetElement.classList.contains("av__cell")) {
        await handleAvCellDrop(protyle, targetElement, targetClass, gutterTypes[2] ?? "");
        state.dragoverElement = undefined;
        return;
    }
    // AV 表格行拖拽
    if (targetElement.classList.contains("av__row")) {
        await handleGutterAvItemDrop(
            protyle, targetElement, targetClass, gutterTypes,
            selectedIds, sourceIds, srcs, "row",
        );
        state.dragoverElement = undefined;
        return;
    }
    // AV 画廊项拖拽
    if (targetElement.classList.contains("av__gallery-item")
        || targetElement.classList.contains("av__gallery-add")) {
        await handleGutterAvItemDrop(
            protyle, targetElement, targetClass, gutterTypes,
            selectedIds, sourceIds, srcs, "gallery",
        );
        state.dragoverElement = undefined;
        return;
    }
    // 普通块拖拽
    if (sourceElements.length > 0) {
        await handleBlockDrag(
            protyle, sourceElements, targetElement,
            targetClass, isCopy, editorElement, gutterTypes,
        );
    }
    state.dragoverElement = undefined;
};

/**
 * 处理 gutter 拖拽的完整流程
 *
 * 作用：解析 gutter 类型，根据修饰键和目标元素路由到对应处理函数
 * 意图：将 gutter 拖拽的分支逻辑集中管理，各分支委托给辅助函数
 * 调用时机：dataTransfer 包含 SIYUAN_DROP_GUTTER 类型时
 *
 * @param protyle 编辑器实例
 * @param editorElement 编辑器容器元素
 * @param event 拖拽事件
 * @param gutterType 完整的 gutter 类型字符串
 * @param targetElement 拖拽目标元素（可能为 null）
 * @param state 拖拽状态
 */
const KANBAN_GROUP_DRAG_TYPE_LOWER = `${Constants.SIYUAN_DROP_GUTTER}NodeAttributeView${Constants.ZWSP}Group${Constants.ZWSP}`.toLowerCase();

const handleKanbanGroupDrop = async (protyle: IProtyle, event: DragEvent, targetElement: Element | null): Promise<boolean> => {
    // 上游移植: 看板分组拖拽落点 (issue 16325, commits d46a46c87a, 69085878b1, f57ebba032)
    // gutterType 为 NodeAttributeView Group 前缀时触发，需配合 onDragOver 的 dragover__left/right 指示
    const sourceElement = window.siyuan.dragElement as HTMLElement;
    const sourceKanbanElement = sourceElement?.parentElement as HTMLElement;
    // 兼容两种落点来源: 1) onDragOver 存储的 kanbanGroupDragoverElement; 2) 清理前查询到的 targetElement
    const targetKanbanElement = targetElement as HTMLElement;
    const isValidTarget = targetKanbanElement?.classList.contains("av__kanban-group") && (targetKanbanElement.classList.contains("dragover__left") || targetKanbanElement.classList.contains("dragover__right"));
    const resolvedTarget = isValidTarget ? targetKanbanElement : document.querySelector(".av__kanban-group.dragover__left, .av__kanban-group.dragover__right") as HTMLElement;
    if (!sourceElement || !resolvedTarget || sourceElement === resolvedTarget || !sourceKanbanElement?.classList.contains("av__kanban") || sourceKanbanElement !== resolvedTarget.parentElement) {
        if (sourceElement) {
            sourceElement.style.opacity = "";
        }
        cleanupKanbanGroupDragover();
        // 未命中有效落点时由调用方决定是否继续其他分支；返回 true 表示已处理完 kanban 拖拽生命周期
        const isKanbanDrag = event.dataTransfer.types.some(t => t.toLowerCase().startsWith(KANBAN_GROUP_DRAG_TYPE_LOWER));
        if (isKanbanDrag) {
            window.siyuan.dragElement = undefined;
            return true;
        }
        return false;
    }
    const blockElement = hasClosestBlock(sourceElement) as HTMLElement;
    const sourceGroupID = sourceElement.dataset.groupId || "";
    const oldPreviousID = sourceElement.dataset.previousGroupId || "";
    let previousID = resolvedTarget.classList.contains("dragover__left") ? resolvedTarget.dataset.previousGroupId || "" : resolvedTarget.dataset.groupId || "";
    if (previousID === sourceGroupID) {
        previousID = oldPreviousID;
    }
    if (blockElement && sourceGroupID && previousID !== oldPreviousID) {
        let oldGroup: IAVGroup | undefined;
        try {
            oldGroup = JSON.parse(sourceElement.dataset.groupConfig || "null");
        } catch (e) {
            console.warn("parse attribute view group config failed", e);
        }
        const avID = blockElement.getAttribute("data-av-id") || "";
        const blockID = blockElement.getAttribute("data-node-id") || "";
        const undoOperations: IOperation[] = oldGroup && (oldGroup as unknown as { order?: number }).order !== 2 ? [{
            action: "setAttrViewGroup",
            avID,
            blockID,
            data: oldGroup,
        }] : [{
            action: "sortAttrViewGroup",
            avID,
            blockID,
            previousID: oldPreviousID,
            id: sourceGroupID,
        }];
        transaction(protyle, [{
            action: "sortAttrViewGroup",
            avID,
            blockID,
            previousID,
            id: sourceGroupID,
        }], undoOperations);
    }
    if (sourceElement) {
        sourceElement.style.opacity = "";
    }
    cleanupKanbanGroupDragover();
    window.siyuan.dragElement = undefined;
    return true;
};

export const handleGutterDrop = async (
    protyle: IProtyle,
    editorElement: HTMLElement,
    event: DragEvent & { target: HTMLElement },
    gutterType: string,
    targetElement: Element | null,
    state: IDndState,
): Promise<void> => {
    const gutterTypes = gutterType.replace(Constants.SIYUAN_DROP_GUTTER, "").split(Constants.ZWSP);
    const selectedIds = (gutterTypes[2] ?? "").split(",");
    // 优先处理 kanban 分组拖拽，避免落入通用块移动分支
    if (gutterType.toLowerCase().startsWith(KANBAN_GROUP_DRAG_TYPE_LOWER)) {
        event.preventDefault();
        event.stopPropagation();
        await handleKanbanGroupDrop(protyle, event, targetElement);
        return;
    }
    const insertReference = event.altKey || (event.shiftKey && protyle.lite);
    const insertEmbed = event.shiftKey && !protyle.lite;

    // alt/shift 键拖拽：先定位焦点，落点在嵌入块内则中止
    if ((insertReference || insertEmbed)
        && await focusAtDropPoint(protyle, event) === "embed") {
        return;
    }
    // Alt 为引用；lite 不支持后端查询嵌入块，因此 Shift 也使用引用语义。
    if (insertReference) {
        await insertAsRef(protyle, selectedIds);
        return;
    }
    // shift 键：插入为嵌入块
    if (insertEmbed) {
        await insertAsEmbed(protyle, selectedIds);
        return;
    }
    // 普通拖拽：需要目标元素且有 dragover 标记
    if (!targetElement || targetElement.className.indexOf("dragover__") === -1) {
        return;
    }
    await handleGutterNormalDrop(
        protyle, editorElement, event, targetElement,
        gutterType, gutterTypes, selectedIds, state, protyle.lite || event.ctrlKey,
    );
};
