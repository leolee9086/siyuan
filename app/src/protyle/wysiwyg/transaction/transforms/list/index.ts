/** 用途：读取列表转换的应用常量。使用范围：事务请求和编辑标记。解耦评估：通过同域 imports 网关访问基础协议。 */
import {Constants} from "./imports";
/** 用途：补充空块引用文字。使用范围：递归列表转换结束。解耦评估：通过同域 imports 网关访问网络协议。 */
import {fetchPost} from "./imports";
/** 用途：读取相关块和提交折叠事务。使用范围：递归列表转换。解耦评估：通过同域 imports 网关访问网络协议。 */
import {fetchSyncPost} from "./imports";
/** 用途：清理标题编号展示标记。使用范围：递归列表产生的 HTML。解耦评估：通过同域 imports 网关访问编号规则。 */
import {cleanHeadingNumberHTML} from "./imports";
/** 用途：区分持久化和视图折叠。使用范围：递归列表转换提交。解耦评估：通过同域 imports 网关访问状态协议。 */
import {hasViewFoldContext} from "./imports";
/** 用途：定位列表可编辑节点。使用范围：插入 WBR 保留光标。解耦评估：通过同域 imports 网关访问块查询。 */
import {getContenteditableElement} from "./imports";
/** 用途：计算嵌入块父级。使用范围：递归列表拆分插入。解耦评估：通过同域 imports 网关访问块查询。 */
import {getEmbedChildOperationParentID} from "./imports";
/** 用途：计算列表父块。使用范围：递归列表拆分插入。解耦评估：通过同域 imports 网关访问块查询。 */
import {getParentBlock} from "./imports";
/** 用途：读取列表前置块。使用范围：递归列表插入顺序。解耦评估：通过同域 imports 网关访问块查询。 */
import {getPreviousBlockSibling} from "./imports";
/** 用途：恢复转换后的编辑光标。使用范围：递归列表转换完成。解耦评估：通过同域 imports 网关访问选择协议。 */
import {focusByWbr} from "./imports";
/** 用途：读取当前编辑范围。使用范围：递归列表转换完成。解耦评估：通过同域 imports 网关访问选择协议。 */
import {getEditorRange} from "./imports";
/** 用途：展开内部折叠标题。使用范围：递归列表转换前。解耦评估：通过同域 imports 网关访问折叠命令。 */
import {unfoldListHeadings} from "./imports";
/** 用途：提交可撤销转换。使用范围：递归列表转换。解耦评估：通过同域 imports 网关访问提交协议。 */
import {transaction} from "./imports";
/** 用途：回放折叠并刷新转换视觉。使用范围：递归列表转换结束。解耦评估：通过同域 imports 网关读取低层端口。 */
import {getTransactionTransformVisualEffects} from "./imports";
/** 用途：限定递归列表转换模式。使用范围：分派取消递归或类型更新。解耦评估：纯类型不加载命令实现。 */
import type {TRecursiveListConversion} from "../types";
/** 用途：描述根列表定位信息。使用范围：构造列表事务操作。解耦评估：纯类型不加载 DOM 实现。 */
import type {TListContext} from "./types";
/** 用途：承载列表正反向操作。使用范围：列表和折叠事务收集。解耦评估：纯类型不加载提交实现。 */
import type {TListOperationBuffers} from "./types";
/** 用途：描述单个根列表处理请求。使用范围：列表操作构造。解耦评估：纯类型不加载转换实现。 */
import type {TListOperationRequest} from "./types";

/** 作用：读取列表块 ID。意图：避免生成无法提交的插入或删除操作。调用时机：收集递归列表上下文时。 */
const getRequiredListNodeID = (nodeElement: Element) => {
    const id = nodeElement.getAttribute("data-node-id");
    if (!id) {
        throw new Error("Recursive list target is missing data-node-id");
    }
    return id;
};

/** 作用：筛选选区中的根列表。意图：嵌套列表包含在根列表转换内，不能重复处理。调用时机：递归列表命令启动时。 */
const getRootListElements = (nodeElements: Element[]) => {
    const rootListElements: Element[] = [];
    for (let index = 0; index < nodeElements.length; index++) {
        const nodeElement = nodeElements[index];
        if (nodeElement.getAttribute("data-type") !== "NodeList") {
            continue;
        }
        let hasSelectedListParent = false;
        for (let parentIndex = 0; parentIndex < nodeElements.length; parentIndex++) {
            const parentElement = nodeElements[parentIndex];
            const isNestedSelectedList = parentIndex !== index &&
                parentElement.getAttribute("data-type") === "NodeList" && parentElement.contains(nodeElement);
            if (isNestedSelectedList) {
                hasSelectedListParent = true;
                break;
            }
        }
        if (!hasSelectedListParent) {
            rootListElements.push(nodeElement);
        }
    }
    return rootListElements;
};

/** 作用：清除列表命令消费的选择标记。意图：避免替换 DOM 后残留选区状态。调用时机：确定根列表后。 */
const clearListSelection = (nodeElements: Element[]) => {
    for (const nodeElement of nodeElements) {
        nodeElement.classList.remove("protyle-wysiwyg--select");
        nodeElement.removeAttribute("select-start");
        nodeElement.removeAttribute("select-end");
    }
};

/** 作用：计算列表操作的父块 ID。意图：确保取消递归后的插入操作保留在原文档或嵌入边界内。调用时机：收集根列表上下文时。 */
const getRequiredListParentID = (protyle: IProtyle, nodeElement: Element) => {
    const parentID = getEmbedChildOperationParentID(nodeElement) || getParentBlock(nodeElement)?.getAttribute("data-node-id") ||
        protyle.block.parentID || protyle.block.rootID;
    if (!parentID) {
        throw new Error("Recursive list target is missing parent ID");
    }
    return parentID;
};

/** 作用：收集一个列表的定位信息。意图：让随后 DOM 修改与内核事务的插入顺序一致。调用时机：根列表转换前。 */
const collectListContext = async (protyle: IProtyle, nodeElement: Element, type: TRecursiveListConversion["type"]) => {
    const previousBlockElement = getPreviousBlockSibling(nodeElement);
    let previousID = previousBlockElement?.getAttribute("data-node-id") || undefined;
    const needsKernelPreviousID = !previousBlockElement && type === "CancelListRecursively" && protyle.block.showAll;
    // 文档在懒加载边界开头时，DOM 中没有前置块，需要从内核补齐定位 ID。
    if (needsKernelPreviousID) {
        const response = await fetchSyncPost("/api/block/getBlockRelevantIDs", {
            id: getRequiredListNodeID(nodeElement),
            notebook: protyle.notebookId,
        });
        previousID = response.data.previousID || undefined;
    }
    return {
        id: getRequiredListNodeID(nodeElement),
        nodeElement,
        parentID: getRequiredListParentID(protyle, nodeElement),
        previousID,
    };
};

/** 作用：收集所有根列表的定位信息。意图：在修改 DOM 前冻结每个根列表的相对位置。调用时机：根列表筛选后。 */
const collectListContexts = async (protyle: IProtyle, listElements: Element[], type: TRecursiveListConversion["type"]) => {
    const contexts: TListContext[] = [];
    for (const listElement of listElements) {
        contexts.push(await collectListContext(protyle, listElement, type));
    }
    return contexts;
};

/** 作用：把取消递归列表的 HTML 拆为删除和插入操作。意图：维持每个顶层块的真实顺序和可撤销性。调用时机：取消递归列表时。 */
const appendCancelledListOperations = (request: TListOperationRequest) => {
    const {context, newHTML, oldHTML, operations} = request;
    operations.doOperations.push({action: "delete", id: context.id});
    const template = document.createElement("template");
    template.innerHTML = newHTML;
    let previousID = getPreviousBlockSibling(context.nodeElement)?.getAttribute("data-node-id") || context.previousID;
    for (const item of Array.from(template.content.children)) {
        const id = getRequiredListNodeID(item);
        operations.doOperations.push({action: "insert", data: item.outerHTML, id, previousID, parentID: context.parentID});
        operations.undoOperations.push({action: "delete", id});
        previousID = id;
    }
    operations.undoOperations.push({
        action: "insert", data: oldHTML, id: context.id, previousID: context.previousID, parentID: context.parentID,
    });
    context.nodeElement.insertAdjacentHTML("afterend", newHTML);
    context.nodeElement.remove();
};

/** 作用：为变更列表子类型建立更新操作。意图：保留原列表 ID 并缩小 DOM 替换范围。调用时机：变更无序、有序或任务列表时。 */
const appendConvertedListOperation = (request: TListOperationRequest) => {
    const {context, newHTML, oldHTML, operations} = request;
    if (newHTML === oldHTML) {
        return;
    }
    operations.doOperations.push({action: "update", id: context.id, data: newHTML});
    operations.undoOperations.push({action: "update", id: context.id, data: oldHTML});
    context.nodeElement.insertAdjacentHTML("afterend", newHTML);
    const replacement = context.nodeElement.nextElementSibling;
    context.nodeElement.remove();
    replacement?.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
};

/** 作用：提交仅包含折叠状态的转换。意图：列表 HTML 未变时仍保留折叠状态。调用时机：转换操作为空时。 */
const submitFoldOperations = async (protyle: IProtyle, operations: TListOperationBuffers) => {
    if (operations.doOperations.length === 0) {
        return;
    }
    const usesViewFold = hasViewFoldContext(protyle);
    // 视图折叠必须经本地事务规范化，不能直接向内核发送视图状态。
    if (usesViewFold) {
        transaction(protyle, operations.doOperations, operations.undoOperations);
        return;
    }
    await fetchSyncPost("/api/transactions", {
        session: protyle.id,
        app: Constants.SIYUAN_APPID,
        transactions: [{doOperations: operations.doOperations}],
    });
};

/** 作用：补齐转换后为空的块引用文字。意图：保持新插入 DOM 与普通事务回放的引用渲染一致。调用时机：递归列表转换结束。 */
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

/** 作用：按递归命令选择更新或拆分操作。意图：将分派和 DOM/事务构造分离。调用时机：处理每个根列表时。 */
const appendListOperations = (type: TRecursiveListConversion["type"], request: TListOperationRequest) => {
    const cancelsListRecursively = type !== "ConvertListType";
    // 取消递归会产生多个插入块，类型转换只更新保留 ID 的列表容器。
    if (cancelsListRecursively) {
        appendCancelledListOperations(request);
        return;
    }
    appendConvertedListOperation(request);
};

/** 作用：克隆折叠操作数组。意图：正反向事务需要独立对象，避免后续清理互相修改。调用时机：列表本体操作收集完成后。 */
const cloneOperations = (operations: IOperation[]) => {
    const clonedOperations: IOperation[] = [];
    for (const operation of operations) {
        clonedOperations.push({...operation});
    }
    return clonedOperations;
};

/** 作用：提交列表本体和折叠操作。意图：无列表变化时仍保留折叠状态提交。调用时机：递归转换的操作收集完成后。 */
const submitListOperations = async (protyle: IProtyle, listOperations: TListOperationBuffers,
                                    foldOperations: TListOperationBuffers) => {
    const hasListOperations = listOperations.doOperations.length > 0;
    // 只有折叠状态变化时仍需发起对应的折叠提交流程。
    if (!hasListOperations) {
        await submitFoldOperations(protyle, foldOperations);
        return;
    }
    transaction(protyle, listOperations.doOperations.concat(foldOperations.doOperations),
        listOperations.undoOperations.concat(foldOperations.undoOperations));
};

/** 作用：递归取消列表或变更列表类型。意图：在完整 DOM、折叠状态和撤销数据间维持一致。调用时机：列表菜单执行转换时。 */
export const turnListsRecursively = async (options: {
    protyle: IProtyle,
    nodeElements: Element[],
} & TRecursiveListConversion) => {
    const listElements = getRootListElements(options.nodeElements);
    const firstListElement = listElements[0];
    if (!firstListElement) {
        return;
    }
    const hasCaret = Boolean(firstListElement.querySelector("wbr"));
    // 列表转换会替换原 DOM，先放置 WBR 以便稍后恢复编辑位置。
    if (!hasCaret) {
        getContenteditableElement(firstListElement)?.insertAdjacentHTML("afterbegin", "<wbr>");
    }
    clearListSelection(options.nodeElements);
    const contexts = await collectListContexts(options.protyle, listElements, options.type);
    const unfoldOperations = await unfoldListHeadings(options.protyle, listElements);
    const listOperations: TListOperationBuffers = {doOperations: [], undoOperations: []};
    for (const context of contexts) {
        const oldHTML = cleanHeadingNumberHTML(context.nodeElement.outerHTML);
        const newHTML = cleanHeadingNumberHTML(options.type === "ConvertListType" ?
            options.protyle.lute.ConvertListType(context.nodeElement.outerHTML, options.targetListType) :
            options.protyle.lute.CancelListRecursively(context.nodeElement.outerHTML));
        appendListOperations(options.type, {context, newHTML, oldHTML, operations: listOperations});
    }
    const foldOperations: TListOperationBuffers = {
        doOperations: cloneOperations(unfoldOperations),
        undoOperations: cloneOperations(unfoldOperations),
    };
    await submitListOperations(options.protyle, listOperations, foldOperations);
    const usesViewFold = hasViewFoldContext(options.protyle);
    const transformVisualEffects = getTransactionTransformVisualEffects();
    // 持久化折叠操作需立即回放到当前 DOM，视图折叠已在专用事务中处理。
    if (!usesViewFold) {
        transformVisualEffects.applyOperations(options.protyle, foldOperations.doOperations, false);
    }
    focusByWbr(options.protyle.wysiwyg.element, getEditorRange(options.protyle.wysiwyg.element));
    refreshEmptyBlockReferences(options.protyle);
    transformVisualEffects.rerender(options.protyle);
};
