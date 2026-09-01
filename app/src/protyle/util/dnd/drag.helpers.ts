/** 用途：刷新超级块宽度并持久化。使用范围：拖拽后超级块宽度刷新。解耦评估：通过 block/util 直接导入。 */
import {refreshSbAndPersistWidth} from "./imports";
/** 用途：聚焦块。使用范围：拖拽完成后聚焦源块或目标块。解耦评估：通过 selection 直接导入。 */
import { focusBlock } from "../selection";
/** 用途：折叠/展开块并获取操作记录。使用范围：拖拽涉及折叠标题时调用。解耦评估：通过 blockFold 直接导入。 */
import { setFold } from "../../util/blockFold";
/** 用途：提交事务与合并超级块事务。使用范围：拖拽事务提交及超级块合并。解耦评估：通过 transaction 直接导入。 */
import {transaction} from "../../wysiwyg/transaction/submit";
import {turnsIntoOneTransaction} from "../../wysiwyg/transaction/turns/container";
/** 用途：获取父块与前继块。使用范围：构建移动操作时定位锚点。解耦评估：通过 getBlock 直接导入。 */
import { getNextBlockSibling, getParentBlock, getPreviousBlockSibling } from "../../wysiwyg/getBlock";
/** 用途：重排有序列表序号。使用范围：有序列表拖拽后重排序号。解耦评估：通过 list.updateOrder 直接导入。 */
import { updateListOrder } from "../../wysiwyg/list.updateOrder";
/** 用途：拖拽相关类型定义。使用范围：drag.helpers/drag.ts 类型标注。解耦评估：同目录类型文件直接导入。 */
import type { FoldResult } from "./drag.types";

/**
 * 作用：收集源块所属的超级块
 * 意图：拖拽后需刷新这些超级块的宽度
 * 调用时机：dragSb/dragSame 进入主流程时调用
 */
export function collectOriginSbSet(sourceElements: Element[], targetElement?: Element) {
    const originSbSet = new Set<Element>();
    const targetSb = targetElement?.closest("[data-type=\"NodeSuperBlock\"]");
    for (const element of sourceElements) {
        const sbElement = element.closest("[data-type=\"NodeSuperBlock\"]");
        // 仅收集不属于目标超级块的祖先超级块，避免重复刷新目标所在超级块
        if (sbElement && sbElement !== targetSb) {
            originSbSet.add(sbElement);
        }
    }
    return originSbSet;
}

/**
 * 作用：判断列表块中唯一列表项拖到列表块左侧是否应中止
 * 意图：避免对该边界场景做无意义的移动
 * 调用时机：dragSb 主流程前置判定
 * 参考：https://github.com/siyuan-note/siyuan/issues/16315
 */
export function shouldAbortUniqueLiDrag(sourceElements: Element[], targetElement: Element, isSameDoc: boolean) {
    const firstSource = sourceElements[0];
    // 非同文档、非列表项或目标非其父列表时不存在该边界场景
    if (!isSameDoc || !firstSource || !firstSource.classList.contains("li") ||
        targetElement !== firstSource.parentElement ||
        targetElement.childElementCount !== sourceElements.length + 1) {
        return false;
    }
    return !sourceElements.find((element) => !targetElement.contains(element));
}

/**
 * 作用：构建目标块移动的撤销记录
 * 意图：撤销拖拽时将目标块还原到原位置
 * 调用时机：dragSb 创建超级块前调用
 */
export function buildTargetMoveUndo(targetElement: Element, protyle: IProtyle) {
    const targetMoveUndo: IOperation = {
        action: "move",
        context: {
            removeFold: "true"
        },
        id: targetElement.getAttribute("data-node-id") || "",
        previousID: getPreviousBlockSibling(targetElement)?.getAttribute("data-node-id") ?? undefined,
        parentID: getParentBlock(targetElement)?.getAttribute("data-node-id") || protyle.block.parentID || protyle.block.rootID
    };
    return targetMoveUndo;
}

/**
 * 作用：构建超级块插入操作
 * 意图：记录新建超级块在 DOM 中的插入位置与锚点
 * 调用时机：dragSb 用超级块替换目标块后调用
 * 问题/改进：nextID 仅在存在后继块时写入以符合 exactOptionalPropertyTypes
 */
export function buildSbInsertOperation(sbElement: Element, protyle: IProtyle) {
    const operation: IOperation = {
        action: "insert",
        data: sbElement.outerHTML,
        id: sbElement.getAttribute("data-node-id") || "",
        previousID: getPreviousBlockSibling(sbElement)?.getAttribute("data-node-id") ?? undefined,
        parentID: getParentBlock(sbElement)?.getAttribute("data-node-id") || protyle.block.parentID || protyle.block.rootID
    };
    const nextID = getNextBlockSibling(sbElement)?.getAttribute("data-node-id");
    // 存在后继块时才写入 nextID，避免向可选 string 字段写入 undefined
    if (nextID) {
        operation.nextID = nextID;
    }
    return operation;
}

/**
 * 作用：定位超级块取消操作的插入位置，并修正被删除的目标块引用
 * 意图：处理横向超级块内元素拖出后目标块被删除的引用修正
 * 调用时机：dragSb 执行 moveTo 之后调用
 */
export function locateSbRemoveIndex(options: {
    doOperations: IOperation[];
    targetMoveUndoParentID: string | undefined;
    targetElement: Element;
    sbElement: Element;
}) {
    const {doOperations, targetMoveUndoParentID, sbElement} = options;
    let targetElement = options.targetElement;
    let removeIndex = doOperations.length;
    // @内联回调: 回调需捕获并更新 removeIndex 与 targetElement 两个可变状态，提取为命名函数需传递可变引用
    doOperations.find((item, index) => {
        /*
         * 横向超级块A内两个元素拖拽成纵向超级块B，取消超级块A会导致
         * targetElement 被删除，需先移动再删除
         * 参考：https://github.com/siyuan-note/siyuan/issues/16292
         */
        if (item.action === "delete" && item.id === targetMoveUndoParentID) {
            removeIndex = index;
        }
        const prev = doOperations[index - 1];
        /*
         * 超级块内有两个块，拖拽其中一个到超级块外
         * 参考：https://github.com/siyuan-note/siyuan/issues/16292#issuecomment-3523600155
         */
        if (item.action === "delete" && item.id === targetElement.getAttribute("data-node-id") && prev) {
            targetElement = sbElement.querySelector(`[data-node-id="${prev.id}"]`) || targetElement;
        }
    });
    return {removeIndex, targetElement};
}

/**
 * 作用：根据拖拽位置将目标块移入超级块并补全撤销记录
 * 意图：完成目标块在超级块内的最终定位并记录撤销所需的删除操作
 * 调用时机：dragSb 定位插入位置后调用
 */
export function applySbMoveAndUndo(options: {
    sbElement: Element;
    targetElement: Element;
    isBottom: boolean;
    removeIndex: number;
    newSourceParentElement: Element[];
    doOperations: IOperation[];
    undoOperations: IOperation[];
    targetMoveUndo: IOperation;
}) {
    const {sbElement, targetElement, isBottom, removeIndex, newSourceParentElement,
        doOperations, undoOperations, targetMoveUndo} = options;
    // 非底部时将目标块插入到超级块末尾子块之前
    if (!isBottom) {
        sbElement.lastElementChild?.insertAdjacentElement("beforebegin", targetElement);
        const firstNewParent = newSourceParentElement[0];
        doOperations.splice(removeIndex, 0, {
            action: "move",
            id: targetElement.getAttribute("data-node-id") || "",
            previousID: firstNewParent?.getAttribute("data-node-id") ?? undefined,
        });
        undoOperations.push(targetMoveUndo);
        undoOperations.push({
            action: "delete",
            id: sbElement.getAttribute("data-node-id") || "",
        });
        return;
    }
    // 拖拽到超级块 col 下方，其他块右侧
    sbElement.insertAdjacentElement("afterbegin", targetElement);
    doOperations.splice(removeIndex, 0, {
        action: "move",
        id: targetElement.getAttribute("data-node-id") || "",
        parentID: sbElement.getAttribute("data-node-id") ?? undefined
    });
    undoOperations.push(targetMoveUndo);
    undoOperations.push({
        action: "delete",
        id: sbElement.getAttribute("data-node-id") || "",
    });
}

/**
 * 作用：判断折叠标题后继是否为非同级或更高级标题
 * 意图：确定拖拽后哪些折叠标题需要重新折叠
 * 调用时机：收集折叠标题与重折叠判定时调用
 */
export function headingNeedsRefold(item: Element) {
    // 非折叠标题无需重折叠
    if (item.getAttribute("data-type") !== "NodeHeading" || item.getAttribute("fold") !== "1") {
        return false;
    }
    const nextSibling = getNextBlockSibling(item);
    return !!nextSibling && (
        nextSibling.getAttribute("data-type") !== "NodeHeading" ||
        (nextSibling.getAttribute("data-subtype") || "") > (item.getAttribute("data-subtype") || "")
    );
}

/**
 * 作用：合并多个源块为纵向超级块并将操作追加进事务
 * 意图：复用 turnsIntoOneTransaction 的 getOperations 模式并统一处理 undefined 边界
 * 调用时机：dragSb/dragSame 需要合并超级块时调用
 */
export async function mergeAndApplySuperBlock(options: {
    protyle: IProtyle;
    selectsElement: Element[];
    doOperations: IOperation[];
    undoOperations: IOperation[];
}) {
    const {protyle, selectsElement, doOperations, undoOperations} = options;
    const mergeOperations = await turnsIntoOneTransaction({
        protyle,
        selectsElement,
        type: "BlocksMergeSuperBlock",
        level: "row",
        unfocus: true,
        getOperations: true
    });
    // 无合并操作时跳过
    if (!mergeOperations) {
        return;
    }
    doOperations.push(...mergeOperations.doOperations);
    undoOperations.splice(0, 0, ...mergeOperations.undoOperations);
}

/**
 * 作用：多源块或含折叠标题落入横向超级块时合并为纵向超级块，并补折叠操作
 * 意图：保持超级块布局正确并对受影响折叠标题补全操作
 * 调用时机：dragSb 收集折叠标题后调用
 */
export async function mergeAndFoldSb(options: {
    protyle: IProtyle;
    newSourceParentElement: Element[];
    foldElements: Element[];
    direct: "col" | "row";
    doOperations: IOperation[];
    undoOperations: IOperation[];
}) {
    const {protyle, newSourceParentElement, foldElements, direct, doOperations, undoOperations} = options;
    // 多块或含折叠标题且横向布局时合并为纵向超级块
    if ((newSourceParentElement.length > 1 || foldElements.length > 0) && direct === "col") {
        await mergeAndApplySuperBlock({protyle, selectsElement: newSourceParentElement.reverse(), doOperations, undoOperations});
    }
    for (const item of foldElements) {
        const foldOperations = setFold(protyle, item, true, false, false, true);
        // 存在折叠正向操作时追加
        if (foldOperations.doOperations) {
            doOperations.push(...foldOperations.doOperations);
        }
        // 存在折叠逆向操作时追加
        if (foldOperations.undoOperations) {
            undoOperations.splice(0, 0, ...foldOperations.undoOperations);
        }
    }
}

/**
 * 作用：提交拖拽事务并聚焦源块或目标块
 * 意图：统一收尾事务提交与焦点恢复
 * 调用时机：dragSb/dragSame 末尾调用
 */
export function finishDrag(options: {
    protyle: IProtyle;
    doOperations: IOperation[];
    undoOperations: IOperation[];
    firstSource: Element;
    targetElement: Element;
}) {
    const {protyle, doOperations, undoOperations, firstSource, targetElement} = options;
    // 跨文档移动为可逆条目：全局撤销栈按 rootID 分栈联动，撤销时经 mutatedRootIDs 判定弹确认
    transaction(protyle, doOperations, undoOperations);
    // 源块仍在文档中时聚焦源块，否则聚焦目标块
    if (document.contains(firstSource)) {
        focusBlock(firstSource);
        return;
    }
    focusBlock(targetElement);
}

/**
 * 作用：拖拽到折叠标题下方/上方时展开目标标题
 * 意图：先展开折叠标题以正确计算移动位置
 * 调用时机：dragSame 执行 moveTo 前后调用
 */
export function unfoldTargetHeading(protyle: IProtyle, targetElement: Element, isBottom: boolean) {
    // 底部且目标为折叠标题时展开目标
    if (isBottom &&
        targetElement.getAttribute("data-type") === "NodeHeading" &&
        targetElement.getAttribute("fold") === "1") {
        return setFold(protyle, targetElement, true, false, false, true);
    }
    const previousSibling = getPreviousBlockSibling(targetElement);
    // 顶部且前继为折叠标题时展开前继
    if (!isBottom && previousSibling &&
        previousSibling.getAttribute("data-type") === "NodeHeading" &&
        previousSibling.getAttribute("fold") === "1") {
        return setFold(protyle, previousSibling, true, false, false, true);
    }
    return undefined;
}

/**
 * 作用：将展开标题产生的操作合并进事务，并记录聚焦块 ID
 * 意图：保证展开标题的操作可撤销并保留焦点
 * 调用时机：dragSame 获取 foldData 后调用
 */
export function applyFoldData(options: {
    foldData: FoldResult;
    firstSource: Element;
    doOperations: IOperation[];
    undoOperations: IOperation[];
}) {
    const {foldData, firstSource, doOperations, undoOperations} = options;
    const foldDoOperations = foldData.doOperations;
    // 无正向操作或首操作缺失时跳过
    if (!foldDoOperations || !foldDoOperations[0]) {
        return;
    }
    const firstOperation = foldDoOperations[0];
    firstOperation.context = {
        focusId: firstSource.getAttribute("data-node-id") || "",
    };
    doOperations.push(...foldDoOperations);
    // 存在逆向操作时追加
    if (foldData.undoOperations) {
        undoOperations.push(...foldData.undoOperations);
    }
}

/**
 * 作用：有序列表拖拽后重排序号，并记录更新前后的 HTML
 * 意图：保持有序列表序号连续且可撤销
 * 调用时机：dragSame 目标为有序列表项时调用
 * 参考：https://github.com/siyuan-note/insider/issues/536
 */
export function updateOrderedListAfterDrag(targetElement: Element,
                                     doOperations: IOperation[], undoOperations: IOperation[]) {
    const parentElement = targetElement.parentElement;
    // 无父元素时跳过
    if (!parentElement) {
        return;
    }
    for (const item of Array.from(parentElement.children)) {
        // 跳过属性装饰元素
        if (item.classList.contains("protyle-attr")) {
            continue;
        }
        undoOperations.splice(0, 0, {
            action: "update",
            id: item.getAttribute("data-node-id") || "",
            data: item.outerHTML
        });
    }
    updateListOrder(parentElement, 1);
    for (const item of Array.from(parentElement.children)) {
        // 跳过属性装饰元素
        if (item.classList.contains("protyle-attr")) {
            continue;
        }
        doOperations.push({
            action: "update",
            id: item.getAttribute("data-node-id") || "",
            data: item.outerHTML
        });
    }
}

/**
 * 作用：拖拽后对源块中折叠标题按需重新折叠
 * 意图：恢复拖拽破坏的折叠状态
 * 调用时机：dragSame 完成 moveTo 后调用
 */
export function refoldHeadingsAfterDrag(protyle: IProtyle, newSourceParentElement: Element[],
                                  doOperations: IOperation[]) {
    let hasFoldHeading = false;
    for (const item of newSourceParentElement) {
        // 非折叠标题跳过
        if (item.getAttribute("data-type") !== "NodeHeading" || item.getAttribute("fold") !== "1") {
            continue;
        }
        hasFoldHeading = true;
        // 无需重折叠时跳过
        if (!headingNeedsRefold(item)) {
            continue;
        }
        const foldOperations = setFold(protyle, item, true, false, false, true);
        // 存在正向操作时追加，不追加逆向以避免破坏撤销链
        if (foldOperations.doOperations) {
            doOperations.push(...foldOperations.doOperations);
        }
    }
    return hasFoldHeading;
}

/**
 * 作用：刷新源块与目标块涉及的超级块宽度并持久化
 * 意图：拖拽改变超级块结构后保持宽度正确
 * 调用时机：dragSame 折叠处理完成后调用
 */
export function refreshDragSbSet(options: {
    originSbSet: Set<Element>;
    newSourceParentElement: Element[];
    targetElement: Element;
    doOperations: IOperation[];
    undoOperations: IOperation[];
}) {
    const {originSbSet, newSourceParentElement, targetElement, doOperations, undoOperations} = options;
    const dragSbSet = new Set<Element>(originSbSet);
    const firstNewSource = newSourceParentElement[0];
    for (const element of [firstNewSource, targetElement]) {
        const sbElement = element?.closest("[data-type=\"NodeSuperBlock\"]");
        // 存在超级块祖先时加入刷新集合
        if (sbElement) {
            dragSbSet.add(sbElement);
        }
    }
    for (const sbElement of dragSbSet) {
        refreshSbAndPersistWidth(sbElement, doOperations, undoOperations);
    }
}

/**
 * 作用：多个源块或含折叠标题落入横向超级块时合并为纵向超级块
 * 意图：避免横向超级块内出现应纵向排列的多个块
 * 调用时机：dragSame 刷新超级块后调用
 */
export async function mergeIntoColSuperBlockIfNeeded(options: {
    protyle: IProtyle;
    newSourceParentElement: Element[];
    hasFoldHeading: boolean;
    doOperations: IOperation[];
    undoOperations: IOperation[];
}) {
    const {protyle, newSourceParentElement, hasFoldHeading, doOperations, undoOperations} = options;
    const firstNewSource = newSourceParentElement[0];
    const parentElement = firstNewSource?.parentElement;
    // 多块或含折叠标题且父级为横向超级块时合并为纵向超级块
    if ((newSourceParentElement.length > 1 || hasFoldHeading) &&
        parentElement && parentElement.classList.contains("sb") &&
        parentElement.getAttribute("data-sb-layout") === "col") {
        await mergeAndApplySuperBlock({protyle, selectsElement: newSourceParentElement.reverse(), doOperations, undoOperations});
    }
}
