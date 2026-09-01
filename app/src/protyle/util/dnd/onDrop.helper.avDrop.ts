/**
 * 属性视图（AV）拖拽操作辅助模块
 *
 * 作用：处理拖拽到属性视图（表格行、画廊项、单元格列）的所有操作
 * 意图：从 onDrop 主函数中提取 AV 相关的拖拽逻辑，降低主函数复杂度
 * 调用时机：当用户将 gutter 块或文件树节点拖拽到属性视图区域时调用
 */
import { hasClosestBlock, hasClosestByClassName } from "../hasClosest";
import {submitAVColumnStructureTransaction} from "../../wysiwyg/transaction/prepared/av/avColumnStructure";
import { insertAttrViewBlockAnimation } from "../../render/av/row";
import { insertGalleryItemAnimation } from "../../render/av/gallery/item";
import { getAVFilteredTipContext, getAVViewID } from "../../render/av/filteredTip";
import * as dayjs from "dayjs";
import { Constants } from "../../../constants";

/**
 * 从带有 colsticky 容器的兄弟元素中解析列 ID
 *
 * 作用：获取目标元素的 data-col-id，处理 colsticky 容器嵌套情况
 * 意图：colsticky 容器内的最后一个子元素才是真正的列，需要特殊处理
 * 调用时机：AV 列排序拖拽时，确定 previousID
 *
 * @param sibling 兄弟元素，可能是普通列或 colsticky 容器
 * @returns 列 ID 字符串，如果无兄弟则返回空字符串
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 拖拽事件处理中同步读取 DOM 属性 */
export const resolveColId = (sibling: Element | null): string => {
    if (!sibling) {
        return "";
    }
    // colsticky 容器包裹了多个固定列，取最后一个子元素的 col-id
    if (sibling.classList.contains("av__colsticky")) {
        return sibling.lastElementChild?.getAttribute("data-col-id") ?? "";
    }
    return sibling.getAttribute("data-col-id") ?? "";
};

/**
 * 处理 AV 单元格列排序拖拽
 *
 * 作用：当用户拖拽 AV 列头到另一个位置时，执行列排序事务
 * 意图：将列排序逻辑从主函数中提取，使 AV 列拖拽操作独立可测试
 * 调用时机：gutter 拖拽目标为 av__cell 元素时
 *
 * @param protyle 编辑器实例
 * @param targetElement 拖拽目标单元格元素
 * @param targetClass 目标元素的 CSS 类名列表
 * @param dragColId 被拖拽的列 ID（gutterTypes[2]）
 */
export const handleAvCellDrop = async (
    protyle: IProtyle,
    targetElement: Element,
    targetClass: string[],
    dragColId: string,
): Promise<void> => {
    const blockElement = hasClosestBlock(targetElement);
    if (!blockElement) {
        return;
    }
    const avID = blockElement.getAttribute("data-av-id") ?? "";
    // 向左拖拽时取前一个兄弟的列 ID，否则取自身列 ID
    const previousID = targetClass.includes("dragover__left")
        ? resolveColId(targetElement.previousElementSibling)
        : (targetElement.getAttribute("data-col-id") ?? "");

    let oldPreviousID = "";
    const rowElement = hasClosestByClassName(targetElement, "av__row");
    if (rowElement) {
        const colSelector = `[data-col-id="${dragColId}"]`;
        const currentCol = rowElement.querySelector(colSelector);
        oldPreviousID = resolveColId(currentCol?.previousElementSibling ?? null);
    }
    // 位置未变化或拖拽到自身位置时跳过
    if (previousID === oldPreviousID || previousID === dragColId) {
        return;
    }
    const blockID = blockElement.dataset.nodeId ?? "";
    submitAVColumnStructureTransaction(protyle, [{
        action: "sortAttrViewCol",
        avID,
        previousID,
        id: dragColId,
        blockID,
    }], [{
        action: "sortAttrViewCol",
        avID,
        previousID: oldPreviousID,
        id: dragColId,
        blockID,
    }]);
};

/**
 * 根据拖拽方向计算 AV 行/画廊项的 previousID
 *
 * 作用：统一处理 bottom/right（取自身 data-id）和 top/left（取前一个兄弟 data-id）
 * 意图：消除 row 和 gallery 场景中重复的 previousID 计算
 * 调用时机：AV 行排序或画廊项排序时
 *
 * @param targetElement 拖拽目标元素
 * @param targetClass CSS 类名列表
 * @returns previousID 字符串
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 拖拽事件处理中同步读取 DOM 属性 */
export const resolveAvItemPreviousId = (targetElement: Element, targetClass: string[]): string => {
    // 拖拽到元素下方/右侧时，previousID 为目标自身
    if (targetClass.includes("dragover__bottom") || targetClass.includes("dragover__right")) {
        return targetElement.getAttribute("data-id") ?? "";
    }
    // 拖拽到元素上方/左侧时，previousID 为目标的前一个兄弟
    if (targetClass.includes("dragover__top") || targetClass.includes("dragover__left")) {
        return targetElement.previousElementSibling?.getAttribute("data-id") ?? "";
    }
    return "";
};

/**
 * 构建 AV 行/画廊项排序的 do/undo 操作列表
 *
 * 作用：为 AV table 行内拖拽或 gallery 项内部拖拽生成 sortAttrViewRow 事务操作
 * 意图：table 行排序和 gallery 项排序共享相同的操作结构，仅查询选择器不同
 * 调用时机：gutter 拖拽到 AV 行或画廊项时，且源类型为行内排序
 *
 * @param blockElement AV 所在的块元素
 * @param avID 属性视图 ID
 * @param previousID 目标位置的前一个元素 ID
 * @param selectedIds 被拖拽的行 ID 列表（可能包含 @groupID 后缀）
 * @param targetGroupID 目标分组 ID
 * @param itemSelector 查找行元素的选择器模板，含 {groupID} 和 {id} 占位
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 拖拽事件处理中同步构建 DOM 查询操作 */
export const buildAvRowSortOps = (
    blockElement: HTMLElement,
    avID: string,
    previousID: string,
    selectedIds: string[],
    targetGroupID: string,
    itemSelector: string,
): { doOperations: IOperation[]; undoOperations: IOperation[] } => {
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    const blockID = blockElement.dataset.nodeId ?? "";

    for (const item of [...selectedIds].reverse()) {
        const parts = item.split("@");
        const id = parts[0] ?? "";
        const groupID = parts[1] ?? "";
        const groupAttr = groupID ? `[data-group-id="${groupID}"]` : "";
        const selector = itemSelector
            .replace("{groupAttr}", groupAttr)
            .replace("{groupID}", groupID)
            .replace("{id}", id);
        const rowEl = blockElement.querySelector(selector);
        const undoPreviousId = rowEl?.previousElementSibling?.getAttribute("data-id") ?? "";

        // 位置未变化且不是跨分组移动时跳过
        const posChanged = previousID !== id && undoPreviousId !== previousID;
        const crossGroup = undoPreviousId === "" && previousID === "" && targetGroupID !== groupID;
        if (!posChanged && !crossGroup) {
            continue;
        }
        doOperations.push({
            action: "sortAttrViewRow", avID, previousID, id, blockID,
            groupID, targetGroupID,
        });
        undoOperations.push({
            action: "sortAttrViewRow", avID, previousID: undoPreviousId, id, blockID,
            groupID: targetGroupID, targetGroupID: groupID,
        });
    }
    return { doOperations, undoOperations };
};

/**
 * 执行 AV 块插入事务并播放动画
 *
 * 作用：将外部块（gutter 或文件树来源）插入到 AV 中，并更新 updated 时间戳
 * 意图：row 和 gallery 的插入逻辑高度相似，提取为共享函数消除重复
 * 调用时机：gutter 拖拽或文件树拖拽到 AV 行/画廊时，且非内部排序场景
 *
 * @param protyle 编辑器实例
 * @param blockElement AV 所在的块元素
 * @param targetElement 拖拽目标元素
 * @param previousID 目标位置的前一个元素 ID
 * @param sourceIds 源块 ID 列表
 * @param srcs 源块操作信息列表
 * @param animationType 动画类型：'row' 使用表格行动画，'gallery' 使用画廊项动画
 */
export const executeAvInsert = async (
    protyle: IProtyle,
    blockElement: HTMLElement,
    targetElement: Element,
    previousID: string,
    sourceIds: string[],
    srcs: IOperationSrcs[],
    animationType: "row" | "gallery",
): Promise<void> => {
    const avID = blockElement.getAttribute("data-av-id") ?? "";
    const blockID = blockElement.dataset.nodeId ?? "";
    const newUpdated = dayjs().format("YYYYMMDDHHmmss");
    const bodyElement = hasClosestByClassName(targetElement, "av__body");
    const txGroupID = bodyElement ? (bodyElement.getAttribute("data-group-id") ?? "") : "";

    transaction(protyle, [{
        action: "insertAttrViewBlock",
        avID, previousID, srcs, blockID,
        viewID: blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW) || blockElement.querySelector(".layout-tab-bar .item--focus")?.getAttribute("data-id") || getAVViewID(blockElement),
        ...(txGroupID ? { groupID: txGroupID } : {}),
        context: getAVFilteredTipContext("target", protyle),
    }, {
        action: "doUpdateUpdated",
        id: blockID, data: newUpdated,
    }], [{
        action: "removeAttrViewBlock",
        srcIDs: sourceIds, avID,
    }, {
        action: "doUpdateUpdated",
        id: blockID, data: blockElement.getAttribute("updated"),
    }]);
    blockElement.setAttribute("updated", newUpdated);

    // row 动画使用 av__body 的 groupID，gallery 动画使用父元素的 groupID
    if (animationType === "row") {
        insertAttrViewBlockAnimation({
            protyle, blockElement, srcIDs: sourceIds,
            previousId: previousID,
            ...(txGroupID ? { groupID: txGroupID } : {}),
        });
        return;
    }
    const galleryGroupID = targetElement.parentElement?.getAttribute("data-group-id") ?? "";
    insertGalleryItemAnimation({
        protyle, blockElement, srcIDs: sourceIds,
        previousId: previousID,
        ...(galleryGroupID ? { groupID: galleryGroupID } : {}),
    });
};
