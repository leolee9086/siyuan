import { setFold } from "../util/blockFold";
import { focusByRange } from "../util/selection.focus";
import { focusByWbr, setLastNodeRange } from "../util/selection.range";
import { getParentBlock, getContenteditableElement } from "./getBlock";
import { listOutdent } from "./list";
import { updateListOrder } from "./list.updateOrder";
import { moveToPrevious } from "./remove";
import { transaction, updateTransaction } from "./transaction";
import { turnsIntoOneTransaction } from "./transaction.turns";
import { Constants } from "../../constants";

/**
 * 作用：处理首个子列表合并
 * 意图：子列表提升并与前置内容合并
 * 调用时机：首个子列表节点删除时调用
 * 问题/改进：无
 */
const mergeFirstChildList = (protyle: IProtyle, blockEl: Element, range: Range, listEl: Element) => {
    range.insertNode(document.createElement("wbr"));
    const htmlOld = listEl.outerHTML;
    const prevSib = listEl.previousElementSibling;
    // 判断前节点存在
    if (!prevSib) {
        return;
    }
    const prevLastEl = prevSib.lastElementChild;
    // 判断前节点最后子元素存在
    if (!prevLastEl?.parentElement) {
        return;
    }
    const prevHTML = prevLastEl.parentElement.outerHTML;

    // 清理首元素
    if (blockEl.parentElement?.firstElementChild) {
        blockEl.parentElement.firstElementChild.remove();
    }
    // 清理尾元素
    if (blockEl.parentElement?.lastElementChild) {
        blockEl.parentElement.lastElementChild.remove();
    }
    prevLastEl.insertAdjacentHTML("beforebegin", blockEl.parentElement?.innerHTML || "");
    // 清理父元素
    if (blockEl.parentElement) {
        blockEl.parentElement.remove();
    }

    // 有序列表需更新标号
    if (listEl.getAttribute("data-subtype") === "o") {
        updateListOrder(listEl);
    }
    listEl.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
    prevLastEl.parentElement.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
    const idList = listEl.getAttribute("data-node-id") || "";
    const idPrev = prevLastEl.parentElement.getAttribute("data-node-id") || "";
    transaction(protyle,
        [{ action: "update", id: idList, data: listEl.outerHTML }, { action: "update", data: prevLastEl.parentElement.outerHTML, id: idPrev }],
        [{ action: "update", data: prevHTML, id: idPrev }, { action: "update", data: htmlOld, id: idList }]
    );
    focusByWbr(prevLastEl.parentElement, range);
};

/**
 * 作用：合并超级块操作
 * 意图：列表结构变化需重组同一行超级块内容
 * 调用时机：列表转普通块后合并
 * 问题/改进：无
 */
const mergeSuperBlock = (protyle: IProtyle, listEl: Element, undoFirstId: string) => {
    const pEl = listEl.parentElement;
    // 判断超级块列布局
    if (pEl?.classList.contains("sb") && pEl.getAttribute("data-sb-layout") === "col") {
        const selectsHtml: Element[] = [];
        let prevEl: Element | null = listEl;
        // 遍历前面的元素以便进行超级块合并
        while (prevEl) {
            selectsHtml.push(prevEl);
            // 找到事务源停止
            if (undoFirstId === prevEl.getAttribute("data-node-id")) {
                break;
            }
            prevEl = prevEl.previousElementSibling;
        }
        turnsIntoOneTransaction({ protyle, selectsElement: selectsHtml.reverse(), type: "BlocksMergeSuperBlock", level: "row", unfocus: true });
    }
};

/**
 * 作用：首行删除跳出顶级列表
 * 意图：回车或删除变为普通块
 * 调用时机：在 removeLi 中
 * 问题/改进：无
 */
const topListFirstLineToBlock = (protyle: IProtyle, blockEl: Element, range: Range, isDel: boolean, listEl: Element) => {
    moveToPrevious(blockEl, range, isDel);
    range.insertNode(document.createElement("wbr"));
    const htmlOld = listEl.outerHTML;

    // 移除首
    if (blockEl.parentElement?.firstElementChild) {
        blockEl.parentElement.firstElementChild.remove();
    }
    // 移除尾
    if (blockEl.parentElement?.lastElementChild) {
        blockEl.parentElement.lastElementChild.remove();
    }

    const tempEl = document.createElement("div");
    tempEl.innerHTML = blockEl.parentElement?.innerHTML || "";
    const doOps: IOperation[] = [];
    const undoOps: IOperation[] = [];

    let index = 0;
    // 遍历项转为块
    for (const item of Array.from(tempEl.children)) {
        const id = item.getAttribute("data-node-id") || "";
        let pIdLocal: string | undefined = undefined;
        // 第一项的情况
        if (index === 0) {
            pIdLocal = listEl.previousElementSibling?.getAttribute("data-node-id") || undefined;
        }
        // 非第一项情况
        if (index !== 0) {
            const prevOp = doOps[index - 1];
            // 取前项事务
            if (prevOp) {
                pIdLocal = prevOp.id;
            }
        }
        const pId = getParentBlock(listEl)?.getAttribute("data-node-id") || protyle.block.parentID;
        doOps.push({ action: "insert", id, data: item.outerHTML, previousID: pIdLocal, parentID: pId });
        undoOps.push({ action: "delete", id });
        index++;
    }

    listEl.insertAdjacentHTML("beforebegin", blockEl.parentElement?.innerHTML || "");
    // 清除原块元素
    if (blockEl.parentElement) {
        blockEl.parentElement.remove();
    }

    // 处理有序列表标号
    if (listEl.getAttribute("data-subtype") === "o") {
        const firstMark = listEl.firstElementChild?.getAttribute("data-marker");
        // 更新下标
        if (firstMark) {
            updateListOrder(listEl, parseInt(firstMark) - 1);
        }
    }
    listEl.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
    const idLocal = listEl.getAttribute("data-node-id") || "";
    doOps.splice(0, 0, { action: "update", id: idLocal, data: listEl.outerHTML });
    undoOps.push({ action: "update", data: htmlOld, id: idLocal });
    transaction(protyle, doOps, undoOps);

    const firstUndo = undoOps[0];
    // 合并超级块
    if (firstUndo?.id) {
        mergeSuperBlock(protyle, listEl, firstUndo.id);
    }
    // 聚焦编辑器
    if (protyle.wysiwyg?.element) {
        focusByWbr(protyle.wysiwyg.element, range);
    }
};

/**
 * 作用：合并前置折叠判断
 * 意图：直接清理或聚焦
 * 调用时机：合并时
 * 问题/改进：无
 */
const handleFoldedListItemMerge = (blockEl: Element, itemEl: Element, range: Range, itemId: string, doOps: IOperation[], undoOps: IOperation[]) => {
    const editEl = getContenteditableElement(blockEl);
    const prevSib = itemEl.previousElementSibling;
    const nextSib = blockEl.nextElementSibling;
    // 空文本且属性块判断
    if (editEl?.textContent?.trim() === "" && nextSib?.classList.contains("protyle-attr")) {
        doOps.push({ action: "delete", id: itemId });
        const firstUndo = undoOps[0];
        // 保护事务写入
        if (firstUndo) {
            firstUndo.data = itemEl.outerHTML;
        }
        const prevEdit = prevSib ? getContenteditableElement(prevSib) : null;
        // 聚焦前面
        if (prevEdit) {
            setLastNodeRange(prevEdit, range);
        }
        range.collapse(true);
        itemEl.remove();
        return false;
    }
    const prevEdit = prevSib ? getContenteditableElement(prevSib) : null;
    // 回调前向节点聚焦
    if (prevEdit) {
        setLastNodeRange(prevEdit, range);
    }
    range.collapse(true);
    focusByRange(range);
    const wbrLocal = blockEl.querySelector("wbr");
    // 清除占位
    if (wbrLocal) {
        wbrLocal.remove();
    }
    return true;
};

/**
 * 作用：未折叠列表项合并
 * 意图：内容提入前置列表项后
 * 调用时机：未折叠被调用
 * 问题/改进：无
 */
const handleNormalListItemMerge = (blockEl: Element, itemEl: Element, itemId: string, previousLastEl: Element, doOps: IOperation[], undoOps: IOperation[]) => {
    let foldEl: Element | undefined = undefined;
    const prevEl = previousLastEl.previousElementSibling;
    // 提取为标题折叠
    if (prevEl && prevEl.getAttribute("fold") === "1" && prevEl.getAttribute("data-type") === "NodeHeading") {
        foldEl = prevEl;
    }
    let pIdLocal = prevEl?.getAttribute("data-node-id") || "";

    const parentElLocal = blockEl.parentElement;
    // 安全退出
    if (!parentElLocal) {
        return foldEl;
    }

    let indexLocal = 0;
    // 处理DOM重构
    for (const item of Array.from(parentElLocal.children)) {
        // 过虑属性和工具条
        if (item.classList.contains("protyle-action") || item.classList.contains("protyle-attr")) {
            indexLocal++;
            continue;
        }
        const tId = item.getAttribute("data-node-id") || "";
        doOps.push({ action: "move", id: tId, previousID: pIdLocal, context: { ignoreProcess: foldEl ? "true" : "false" } });
        undoOps.push({ action: "move", id: tId, previousID: indexLocal === 1 ? undefined : pIdLocal, parentID: itemId });
        pIdLocal = tId;
        // 折叠或直接前插
        if (foldEl) {
            item.remove();
        }
        // 前插未折叠项
        if (!foldEl) {
            previousLastEl.before(item);
        }
        indexLocal++;
    }
    doOps.push({ action: "delete", id: itemId });
    const firstUndo = undoOps[0];
    // 同步事务HTML
    if (firstUndo) {
        firstUndo.data = itemEl.outerHTML;
    }
    itemEl.remove();
    return foldEl;
};

/**
 * 作用：折叠后标号同步
 * 意图：由于标题合并需要展开序号调整
 * 调用时机：折叠后发生移动
 * 问题/改进：无
 */
const moveFoldElAction = (protyle: IProtyle, foldEl: Element, doOps: IOperation[], undoOps: IOperation[]) => {
    const fOps = setFold(protyle, foldEl, true, false, false, true);
    doOps.push(...fOps.doOperations);
    undoOps.push(...fOps.undoOperations);
    const pEl2 = foldEl.parentElement;
    // 处理有序列表后续标号
    if (pEl2 && pEl2.getAttribute("data-subtype") === "o") {
        let nExt = pEl2.nextElementSibling;
        // 持续查询并更新列表标记
        while (nExt && !nExt.classList.contains("protyle-attr")) {
            const nextId = nExt.getAttribute("data-node-id") || "";
            undoOps.push({ action: "update", id: nextId, data: nExt.outerHTML });
            const cStr = nExt.getAttribute("data-marker");
            const countStr = (cStr ? parseInt(cStr) : 1) - 1 + ".";
            nExt.setAttribute("data-marker", countStr);
            const actOrder = nExt.querySelector(".protyle-action--order");
            // 写入文本
            if (actOrder) {
                actOrder.textContent = countStr;
            }
            doOps.push({ action: "update", id: nextId, data: nExt.outerHTML });
            nExt.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
            nExt = nExt.nextElementSibling;
        }
    }
    transaction(protyle, doOps, undoOps);
};

/**
 * 作用：向上合并项入口
 * 意图：主合并派遣
 * 调用时机：中尾列表移除
 * 问题/改进：无
 */
const mergeToPrev = (protyle: IProtyle, blockEl: Element, range: Range, isDel: boolean) => {
    const itemEl = blockEl.parentElement;
    const prevSib = itemEl?.previousElementSibling;
    // 拦截不符合的头部
    if (!itemEl || !prevSib || prevSib.classList.contains("protyle-breadcrumb__bar")) {
        return;
    }
    const itemId = itemEl.getAttribute("data-node-id") || "";
    const listEl = itemEl.parentElement;
    // 不包裹直接退
    if (!listEl) {
        return;
    }
    moveToPrevious(blockEl, range, isDel);
    range.insertNode(document.createElement("wbr"));
    const htmlOld = listEl.outerHTML;
    const doOps: IOperation[] = [];
    const undoOps: IOperation[] = [{ action: "insert", id: itemId, data: "", previousID: prevSib.getAttribute("data-node-id") || "" }];

    let foldEl: Element | undefined;
    const pLast = prevSib.lastElementChild;
    const isFold = prevSib.getAttribute("fold") === "1";
    // 代理折叠合并
    if (pLast && isFold) {
        const result = handleFoldedListItemMerge(blockEl, itemEl, range, itemId, doOps, undoOps);
        // 执行退回结果
        if (result !== undefined && !result) {
            return;
        }
    }
    // 代理常规合并
    if (pLast && !isFold) {
        foldEl = handleNormalListItemMerge(blockEl, itemEl, itemId, pLast, doOps, undoOps);
    }

    // 后置处理标号同步
    if (foldEl) {
        moveFoldElAction(protyle, foldEl, doOps, undoOps);
    }
    // 如果是编辑根
    if (!foldEl && listEl.classList.contains("protyle-wysiwyg")) {
        transaction(protyle, doOps, undoOps);
    }
    // 普通情况全量更新
    if (!foldEl && !listEl.classList.contains("protyle-wysiwyg")) {
        // 是有序更新数字
        if (listEl.getAttribute("data-subtype") === "o") {
            updateListOrder(listEl);
        }
        updateTransaction(protyle, listEl, htmlOld);
    }

    const fEl = pLast?.parentElement || protyle.wysiwyg?.element;
    // 最后光标跟随
    if (fEl) {
        focusByWbr(fEl, range);
    }
};

/**
 * @同步豁免: 遗留代码
 * 作用：删除入口
 * 意图：列表结构事件抛出
 * 调用时机：热键事件分发
 * 问题/改进：无
 */
export const removeLi = (protyle: IProtyle, blockEl: Element, range: Range, isDelete = false) => {
    const pEl = blockEl.parentElement;
    const prevSib = pEl?.previousElementSibling;
    const nextSib = pEl?.nextElementSibling;
    // 取消缩进抛出
    if (pEl && !prevSib && nextSib?.classList.contains("protyle-attr")) {
        listOutdent(protyle, [pEl], range, isDelete, blockEl);
        return;
    }
    const gpEl = pEl?.parentElement;
    // 合并子列表逻辑
    if (gpEl && !prevSib && gpEl.parentElement?.classList.contains("list")) {
        mergeFirstChildList(protyle, blockEl, range, gpEl);
        return;
    }
    // 顶级脱离逻辑
    if (gpEl && !prevSib) {
        // 跳过根
        if (gpEl.classList.contains("protyle-wysiwyg")) {
            return;
        }
        topListFirstLineToBlock(protyle, blockEl, range, isDelete, gpEl);
        return;
    }
    mergeToPrev(protyle, blockEl, range, isDelete);
};
