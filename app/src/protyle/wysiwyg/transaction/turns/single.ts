/** 用途：请求块引用文本。使用范围：单块转换后恢复空引用显示。解耦评估：经同域 imports 网关读取网络协议。 */
import {fetchPost} from "./imports";
/** 用途：请求块相关身份。使用范围：首块取消容器转换。解耦评估：经同域 imports 网关读取网络协议。 */
import {fetchSyncPost} from "./imports";
/** 用途：通过 WBR 恢复光标。使用范围：单块转换提交后。解耦评估：经同域 imports 网关读取选择能力。 */
import {focusByWbr} from "./imports";
/** 用途：定位块可编辑节点。使用范围：转换前插入 WBR。解耦评估：经同域 imports 网关读取块查询。 */
import {getContenteditableElement} from "./imports";
/** 用途：读取编辑器范围。使用范围：转换后恢复焦点。解耦评估：经同域 imports 网关读取选择能力。 */
import {getEditorRange} from "./imports";
/** 用途：定位嵌入块操作父级。使用范围：取消容器插入操作。解耦评估：经同域 imports 网关读取块查询。 */
import {getEmbedChildOperationParentID} from "./imports";
/** 用途：定位父块。使用范围：取消容器插入操作。解耦评估：经同域 imports 网关读取块查询。 */
import {getParentBlock} from "./imports";
/** 用途：定位前置块。使用范围：取消容器插入顺序。解耦评估：经同域 imports 网关读取块查询。 */
import {getPreviousBlockSibling} from "./imports";
/** 用途：读取转换视觉端口。使用范围：单块转换完成后的精确渲染。解耦评估：低层 owner 不直接导入高层渲染。 */
import {getTransactionTransformVisualEffects} from "./imports";
/** 用途：收窄已替换节点。使用范围：Lute 输出 DOM 校验。解耦评估：经同域 imports 网关读取类型守卫。 */
import {isHTMLElement} from "./imports";
/** 用途：提交正反向操作。使用范围：取消容器转换。解耦评估：经同域 imports 网关读取提交协议。 */
import {transaction} from "./imports";
/** 用途：展开容器内折叠标题。使用范围：取消列表、引述和标注。解耦评估：经同域 imports 网关读取折叠 owner。 */
import {unfoldListHeadings} from "./imports";
/** 用途：提交原地更新。使用范围：非取消型单块转换。解耦评估：经同域 imports 网关读取更新 owner。 */
import {updateTransaction} from "./imports";
/** 用途：描述操作缓冲。使用范围：取消容器操作构造。解耦评估：纯类型不加载实现。 */
import type {TTurnOperationBuffers} from "./types";
/** 用途：描述取消容器请求。使用范围：单块取消操作构造。解耦评估：纯类型不加载实现。 */
import type {TTurnsOneCancellationRequest} from "./types";
/** 用途：描述单块转换参数。使用范围：single owner 公开入口。解耦评估：纯类型不加载实现。 */
import type {TTurnsOneIntoOptions} from "./types";

/** 作用：确保转换前的节点包含 WBR。意图：DOM 替换后可恢复用户原有光标。调用时机：单块转换启动时。 */
const ensureCaretMarker = (nodeElement: Element) => {
    if (nodeElement.querySelector("wbr")) {
        return;
    }
    getContenteditableElement(nodeElement)?.insertAdjacentHTML("afterbegin", "<wbr>");
};

/** 作用：确定本次转换是否会取消一个结构容器。意图：取消容器需要删除加多次插入，而非原地更新。调用时机：单块转换启动时。 */
const cancelsContainer = (type: string) => ["CancelBlockquote", "CancelList", "CancelCallout"].includes(type);

/** 作用：重建撤销时的旧 HTML。意图：嵌套目标块已有独立撤销 HTML 时，将其合入原容器快照。调用时机：转换参数带 undoElement 时。 */
const getUndoHTML = (options: TTurnsOneIntoOptions) => {
    if (!options.undoElement) {
        return options.nodeElement.outerHTML;
    }
    const clonedNode = options.nodeElement.cloneNode(true);
    if (!(clonedNode instanceof Element)) {
        return options.nodeElement.outerHTML;
    }
    const undoElement = clonedNode.querySelector(`[data-node-id="${options.undoElement.id}"]`);
    if (!undoElement) {
        return options.nodeElement.outerHTML;
    }
    undoElement.outerHTML = options.undoElement.html;
    return clonedNode.outerHTML;
};

/** 作用：读取取消转换的前置块身份。意图：懒加载文档首块时也能保持内核插入顺序。调用时机：取消容器转换前。 */
const getPreviousID = async (options: TTurnsOneIntoOptions) => {
    const previousBlockElement = getPreviousBlockSibling(options.nodeElement);
    let previousID = previousBlockElement?.getAttribute("data-node-id") || undefined;
    const needsKernelPreviousID = !previousBlockElement && options.protyle.block.showAll;
    // 文档首个已加载块没有 DOM 前置块时，向内核查询真实前置身份。
    if (needsKernelPreviousID) {
        const response = await fetchSyncPost("/api/block/getBlockRelevantIDs", {
            id: options.id,
            notebook: options.protyle.notebookId,
        });
        previousID = response.data.previousID || undefined;
    }
    return previousID;
};

/** 作用：确定取消转换的插入父块。意图：嵌入块子级不能被插入到文档根级。调用时机：取消容器转换前。 */
const getParentID = (options: TTurnsOneIntoOptions) => {
    return getEmbedChildOperationParentID(options.nodeElement) ||
        getParentBlock(options.nodeElement)?.getAttribute("data-node-id") || options.protyle.block.parentID;
};

/** 作用：调用 Lute 转换单个块并替换当前 DOM。意图：所有后续操作都使用同一份转换 HTML 和替换节点。调用时机：折叠处理完成后。 */
const convertSingleElement = (options: TTurnsOneIntoOptions) => {
    // Lute 的转换方法由运行时命令字符串选择，接口没有公开该字符串索引签名。
    // @ts-ignore
    const newHTML = options.protyle.lute[options.type](options.nodeElement.outerHTML, options.level);
    options.nodeElement.insertAdjacentHTML("afterend", newHTML);
    const convertedElement = options.nodeElement.nextElementSibling;
    if (!isHTMLElement(convertedElement)) {
        return;
    }
    options.nodeElement.remove();
    options.nodeElement = convertedElement;
    return {newHTML, convertedElement};
};

/** 作用：克隆折叠操作。意图：正反向事务不能共享会被提交器修改的操作对象。调用时机：取消容器转换构造时。 */
const cloneOperations = (operations: IOperation[]) => {
    const clonedOperations: IOperation[] = [];
    for (const operation of operations) {
        clonedOperations.push({...operation});
    }
    return clonedOperations;
};

/** 作用：构造取消容器的删除、插入和撤销操作。意图：将 Lute 拆出的多个顶层块按原有顺序写入内核。调用时机：取消列表、引述或标注时。 */
const buildCancellationOperations = (request: TTurnsOneCancellationRequest) => {
    const template = document.createElement("template");
    template.innerHTML = request.newHTML;
    const operations: TTurnOperationBuffers = {
        doOperations: [{action: "delete", id: request.options.id}],
        undoOperations: [],
    };
    let previousID = request.previousID;
    for (const item of Array.from(template.content.children)) {
        const id = item.getAttribute("data-node-id");
        if (!id) {
            continue;
        }
        operations.doOperations.push({action: "insert", data: item.outerHTML, id, previousID, parentID: request.parentID});
        operations.undoOperations.push({action: "delete", id});
        previousID = id;
    }
    operations.undoOperations.push({
        action: "insert",
        data: request.oldHTML,
        id: request.options.id,
        previousID: request.previousID,
        parentID: request.parentID,
    });
    // 调用方携带的操作需与容器取消合并为同一可撤销记录。
    if (request.options.additionalOperations) {
        operations.doOperations.unshift(...request.options.additionalOperations.doOperations);
        operations.undoOperations.push(...request.options.additionalOperations.undoOperations);
    }
    operations.doOperations.push(...cloneOperations(request.foldOperations));
    operations.undoOperations.push(...cloneOperations(request.foldOperations));
    return operations;
};

/** 作用：补齐转换后为空的块引用文本。意图：保持新插入引用与普通事务回放后的显示一致。调用时机：单块转换完成后。 */
const refreshEmptyBlockReferences = (protyle: IProtyle) => {
    for (const item of protyle.wysiwyg.element.querySelectorAll('[data-type~="block-ref"]')) {
        if (item.textContent !== "") {
            continue;
        }
        const id = (item.getAttribute("data-id") || "").split(/\s+/)[0];
        fetchPost("/api/block/getRefText", {id}, response => {
            item.innerHTML = response.data;
        });
    }
};

/** 作用：将一个块转换为目标结构。意图：在容器取消、普通更新、折叠和视觉刷新之间保持原有操作时序。调用时机：列表、引述和块标命令执行时。 */
export const turnsOneInto = async (options: TTurnsOneIntoOptions) => {
    ensureCaretMarker(options.nodeElement);
    const isCancellingContainer = cancelsContainer(options.type);
    const foldOperations = isCancellingContainer ? await unfoldListHeadings(options.protyle, [options.nodeElement]) : [];
    const oldHTML = getUndoHTML(options);
    const previousID = await getPreviousID(options);
    const parentID = getParentID(options);
    const conversion = convertSingleElement(options);
    if (!conversion) {
        return;
    }
    if (isCancellingContainer) {
        const operations = buildCancellationOperations({options, oldHTML, newHTML: conversion.newHTML, previousID,
            parentID, foldOperations});
        transaction(options.protyle, operations.doOperations, operations.undoOperations);
    }
    if (!isCancellingContainer) {
        updateTransaction(options.protyle, conversion.convertedElement, oldHTML);
    }
    focusByWbr(options.protyle.wysiwyg.element, getEditorRange(options.protyle.wysiwyg.element));
    refreshEmptyBlockReferences(options.protyle);
    getTransactionTransformVisualEffects().renderConvertedBlocks(options.protyle);
};
