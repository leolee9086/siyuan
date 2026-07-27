/** 用途：生成超级块元素、刷新超级块宽度与拖拽手柄。使用范围：dragSb 创建并维护超级块。解耦评估：通过 block/util 直接导入。 */
import {genSBElement, refreshSbAndPersistWidth, refreshSbResize} from "./imports";
/** 用途：移动块。使用范围：dragSb/dragSame 主流程。解耦评估：同目录模块直接导入。 */
import { moveTo } from "./moveTo";
/** 用途：拖拽各阶段辅助函数。使用范围：dragSb/dragSame 各阶段处理。解耦评估：同目录模块直接导入。 */
import {
    collectOriginSbSet, shouldAbortUniqueLiDrag, buildTargetMoveUndo, buildSbInsertOperation,
    locateSbRemoveIndex, applySbMoveAndUndo, headingNeedsRefold, mergeAndFoldSb, finishDrag,
    unfoldTargetHeading, applyFoldData, updateOrderedListAfterDrag, refoldHeadingsAfterDrag,
    refreshDragSbSet, mergeIntoColSuperBlockIfNeeded
} from "./drag.helpers";

/**
 * 作用：将源块拖拽为新的超级块
 * 意图：处理拖拽到超级块布局区域的场景
 * 调用时机：拖拽落点为超级块布局时由拖拽控制器调用
 * @参数豁免: 遗留代码 - 公共拖拽 API 签名沿用历史调用约定
 */
export async function dragSb(protyle: IProtyle, sourceElements: Element[], targetElement: Element,
                             isBottom: boolean, direct: "col" | "row", isCopy: boolean) {
    const firstSource = sourceElements[0];
    // 源块为空时中止
    if (!firstSource) {
        return;
    }
    const isSameDoc = protyle.element.contains(firstSource);
    // 列表唯一列表项拖到列表左侧的边界场景无需处理
    if (shouldAbortUniqueLiDrag(sourceElements, targetElement, isSameDoc)) {
        return;
    }
    const targetParent = targetElement.parentElement;
    // 目标无父元素时中止
    if (!targetParent) {
        return;
    }
    const originSbSet = collectOriginSbSet(sourceElements, targetElement);
    const targetMoveUndo = buildTargetMoveUndo(targetElement, protyle);
    const sbElement = genSBElement(direct);
    targetParent.replaceChild(sbElement, targetElement);
    const doOperations: IOperation[] = [buildSbInsertOperation(sbElement, protyle)];
    const sbLastChild = sbElement.lastElementChild;
    // 超级块末尾子块缺失时中止
    if (!sbLastChild) {
        return;
    }
    // 临时插入，防止后面计算错误，最终再移动矫正
    sbLastChild.before(targetElement);
    const moveToResult = await moveTo(protyle, sourceElements, sbElement, isSameDoc, "afterbegin", isCopy);
    doOperations.push(...moveToResult.doOperations);
    const undoOperations: IOperation[] = [...moveToResult.undoOperations];
    const newSourceParentElement = moveToResult.newSourceElements;
    const located = locateSbRemoveIndex({
        doOperations, targetMoveUndoParentID: targetMoveUndo.parentID, targetElement, sbElement
    });
    targetElement = located.targetElement;
    applySbMoveAndUndo({
        sbElement, targetElement, isBottom, removeIndex: located.removeIndex,
        newSourceParentElement, doOperations, undoOperations, targetMoveUndo
    });
    const foldElements = newSourceParentElement.filter(headingNeedsRefold);
    await mergeAndFoldSb({protyle, newSourceParentElement, foldElements, direct, doOperations, undoOperations});
    refreshSbResize(sbElement);
    for (const sbElementItem of originSbSet) {
        refreshSbAndPersistWidth(sbElementItem, doOperations, undoOperations);
    }
    finishDrag({protyle, doOperations, undoOperations, firstSource, targetElement});
}

/**
 * 作用：将源块拖拽到同文档目标位置
 * 意图：处理同文档内块拖拽移动
 * 调用时机：拖拽落点为普通块位置时由拖拽控制器调用
 * @参数豁免: 遗留代码 - 公共拖拽 API 签名沿用历史调用约定
 */
export async function dragSame(protyle: IProtyle, sourceElements: Element[], targetElement: Element,
                               isBottom: boolean, isCopy: boolean) {
    const firstSource = sourceElements[0];
    // 源块为空时中止
    if (!firstSource) {
        return;
    }
    const isSameDoc = protyle.element.contains(firstSource);
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    const originSbSet = collectOriginSbSet(sourceElements);
    const moveToResult = await moveTo(protyle, sourceElements, targetElement, isSameDoc,
        isBottom ? "afterend" : "beforebegin", isCopy);
    doOperations.push(...moveToResult.doOperations);
    undoOperations.push(...moveToResult.undoOperations);
    const newSourceParentElement = moveToResult.newSourceElements;
    const foldData = unfoldTargetHeading(protyle, targetElement, isBottom);
    // 存在折叠标题展开数据时合并进事务
    if (foldData) {
        applyFoldData({foldData, firstSource, doOperations, undoOperations});
    }
    // 目标为有序列表项时重排序号
    if (targetElement.getAttribute("data-type") === "NodeListItem" &&
        targetElement.getAttribute("data-subtype") === "o") {
        updateOrderedListAfterDrag(targetElement, doOperations, undoOperations);
    }
    const hasFoldHeading = refoldHeadingsAfterDrag(protyle, newSourceParentElement, doOperations);
    refreshDragSbSet({originSbSet, newSourceParentElement, targetElement, doOperations, undoOperations});
    await mergeIntoColSuperBlockIfNeeded({protyle, newSourceParentElement, hasFoldHeading, doOperations, undoOperations});
    finishDrag({protyle, doOperations, undoOperations, firstSource, targetElement});
}
