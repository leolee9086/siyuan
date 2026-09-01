/** 用途：聚焦普通块转换结果。使用范围：事务提交后。解耦评估：经同域 imports 网关读取选择能力。 */
import {focusBlock} from "./imports";
/** 用途：通过 WBR 恢复光标。使用范围：快捷键转换提交后。解耦评估：经同域 imports 网关读取选择能力。 */
import {focusByWbr} from "./imports";
/** 用途：定位嵌入块操作父级。使用范围：插入操作构造。解耦评估：经同域 imports 网关读取块查询。 */
import {getEmbedChildOperationParentID} from "./imports";
/** 用途：判断选区连续性。使用范围：快捷键转换预处理。解耦评估：经同域 imports 网关读取块查询。 */
import {getNextBlockSibling} from "./imports";
/** 用途：定位普通块父级。使用范围：插入操作构造。解耦评估：经同域 imports 网关读取块查询。 */
import {getParentBlock} from "./imports";
/** 用途：定位前置块。使用范围：插入和撤销排序。解耦评估：经同域 imports 网关读取块查询。 */
import {getPreviousBlockSibling} from "./imports";
/** 用途：读取转换视觉端口。使用范围：事务提交后的精确渲染。解耦评估：低层 owner 不直接导入高层渲染。 */
import {getTransactionTransformVisualEffects} from "./imports";
/** 用途：关闭块标工具。使用范围：普通块转换收尾。解耦评估：经同域 imports 网关读取 UI 命令。 */
import {hideElements} from "./imports";
/** 用途：更新标题折叠状态。使用范围：标题层级变化。解耦评估：经同域 imports 网关读取折叠 owner。 */
import {setFold} from "./imports";
/** 用途：提交正反向操作。使用范围：普通块转换。解耦评估：经同域 imports 网关读取提交协议。 */
import {transaction} from "./imports";
/** 用途：描述预处理选区。使用范围：转换焦点恢复。解耦评估：纯类型不加载实现。 */
import type {TPreparedTurnsIntoSelection} from "./types";
/** 用途：描述操作缓冲。使用范围：普通块操作构造。解耦评估：纯类型不加载实现。 */
import type {TTurnOperationBuffers} from "./types";
/** 用途：描述连续转换请求。使用范围：连续选区合并。解耦评估：纯类型不加载实现。 */
import type {TTurnsIntoContinuousRequest} from "./types";
/** 用途：描述逐块转换请求。使用范围：不连续选区转换。解耦评估：纯类型不加载实现。 */
import type {TTurnsIntoIndividualRequest} from "./types";
/** 用途：描述模板插入请求。使用范围：Lute 多块转换。解耦评估：纯类型不加载实现。 */
import type {TTurnsIntoTemplateInsertRequest} from "./types";
/** 用途：描述普通块转换参数。使用范围：multiple owner 公开入口。解耦评估：纯类型不加载实现。 */
import type {TTurnsIntoTransactionOptions} from "./types";

/** 作用：清除转换命令消费的多选标记。意图：避免替换 DOM 后残留失效的选择范围。调用时机：每个普通块操作构造前。 */
const clearElementSelection = (item: Element) => {
    item.classList.remove("protyle-wysiwyg--select");
    item.removeAttribute("select-start");
    item.removeAttribute("select-end");
};

/** 作用：调用 Lute 的普通块转换器。意图：集中保留现有动态 Lute 转换协议。调用时机：逐块或连续块 HTML 准备时。 */
const convertTurnedHTML = (options: TTurnsIntoTransactionOptions, html: string) => {
    // Lute 的转换方法由受限字符串联合选择，现有运行时接口未公开索引签名。
    // @ts-ignore
    return options.protyle.lute[options.type](html, options.level);
};

/** 作用：将转换 HTML 装入模板。意图：统一读取 Lute 生成的顶层块和节点身份。调用时机：每次构造插入或更新操作前。 */
const createConversionTemplate = (html: string) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    return template;
};

/** 作用：计算插入操作所属的父块。意图：嵌入块转换不能穿透其事务边界。调用时机：Lute 转换生成替换块时。 */
const getOperationParentID = (options: TTurnsIntoTransactionOptions, item: Element) => {
    return getEmbedChildOperationParentID(item) || getParentBlock(item)?.getAttribute("data-node-id") ||
        options.protyle.block.parentID || options.protyle.block.rootID;
};

/** 作用：把模板顶层块追加为插入和反向删除操作。意图：保留 Lute 可能生成多个顶层块的完整结果。调用时机：原块身份未保留或连续选区合并时。 */
const appendTemplateInsertOperations = (request: TTurnsIntoTemplateInsertRequest) => {
    for (const templateItem of Array.from(request.template.content.children)) {
        const id = templateItem.getAttribute("data-node-id");
        if (!id) {
            continue;
        }
        request.operations.doOperations.push({
            action: "insert",
            id,
            previousID: templateItem.previousElementSibling?.getAttribute("data-node-id") ||
                getPreviousBlockSibling(request.item)?.getAttribute("data-node-id"),
            data: templateItem.outerHTML,
            parentID: getOperationParentID(request.options, request.item),
        });
        request.operations.undoOperations.splice(0, 0, {action: "delete", id});
    }
};

/** 作用：追加身份未保留时的替换操作。意图：先恢复原块，再插入所有 Lute 生成块并删除旧身份。调用时机：逐块转换改变顶层节点身份时。 */
const appendIdentityReplacementOperations = (request: TTurnsIntoIndividualRequest, template: HTMLTemplateElement) => {
    const id = request.item.getAttribute("data-node-id");
    if (!id) {
        return false;
    }
    request.operations.undoOperations.push({
        action: "insert",
        id,
        previousID: request.previousID || getPreviousBlockSibling(request.item)?.getAttribute("data-node-id"),
        data: request.item.outerHTML,
        parentID: getOperationParentID(request.options, request.item),
    });
    appendTemplateInsertOperations({...request, template});
    request.operations.doOperations.push({action: "delete", id});
    return true;
};

/** 作用：追加身份保留时的更新和标题折叠操作。意图：避免不必要的删除插入并维护标题折叠状态。调用时机：Lute 输出仍包含原块 ID 时。 */
const appendIdentityPreservingOperations = (request: TTurnsIntoIndividualRequest, template: HTMLTemplateElement,
                                            newHTML: string) => {
    const id = request.item.getAttribute("data-node-id");
    if (!id) {
        return;
    }
    let foldedOperations: {doOperations?: IOperation[], undoOperations?: IOperation[]} | undefined;
    const firstTemplateElement = template.content.firstElementChild;
    const changesFoldedHeadingLevel = request.item.getAttribute("data-type") === "NodeHeading" &&
        request.item.getAttribute("fold") === "1" &&
        firstTemplateElement?.getAttribute("data-subtype") !== request.item.dataset.subtype;
    // 已折叠标题变更层级前必须先同步折叠状态，防止旧子树在新层级下残留。
    if (changesFoldedHeadingLevel) {
        foldedOperations = setFold(request.options.protyle, request.item, undefined, undefined, false, true);
        newHTML = newHTML.replace(' fold="1"', "");
    }
    // 正向折叠操作必须排在 HTML 更新前，先展开后再替换标题节点。
    if (foldedOperations?.doOperations?.length) {
        request.operations.doOperations.push(...foldedOperations.doOperations);
    }
    request.operations.undoOperations.push({action: "update", id, data: request.item.outerHTML});
    request.operations.doOperations.push({action: "update", id, data: newHTML});
    // 撤销时在恢复原 HTML 后重新附加折叠操作，保持反向时序。
    if (foldedOperations?.undoOperations?.length) {
        request.operations.undoOperations.push(...foldedOperations.undoOperations);
    }
    request.item.outerHTML = newHTML;
};

/** 作用：转换一个不连续选区块。意图：按 Lute 是否保留原身份选择更新或替换操作。调用时机：普通多选转换循环中。 */
const appendIndividualTurnOperations = (request: TTurnsIntoIndividualRequest) => {
    const newHTML = convertTurnedHTML(request.options, request.item.outerHTML);
    const template = createConversionTemplate(newHTML);
    const id = request.item.getAttribute("data-node-id");
    const keepsOriginalIdentity = Boolean(id && template.content.querySelector(`[data-node-id="${id}"]`));
    if (!keepsOriginalIdentity) {
        const replacedIdentity = appendIdentityReplacementOperations(request, template);
        request.item.outerHTML = newHTML;
        return replacedIdentity ? {replacedIdentity: true, id: id || undefined} : {replacedIdentity: false};
    }
    appendIdentityPreservingOperations(request, template, newHTML);
    return {replacedIdentity: false};
};

/** 作用：追加连续转换中一个原块的删除及撤销插入操作。意图：最终一次性由 Lute 对拼接 HTML 生成新的顶层块。调用时机：连续选区循环中。 */
const appendContinuousDeletion = (request: TTurnsIntoContinuousRequest) => {
    const id = request.item.getAttribute("data-node-id");
    if (!id) {
        return;
    }
    const lastOperation = request.operations.doOperations[request.operations.doOperations.length - 1];
    const previousID = lastOperation?.id || getPreviousBlockSibling(request.item)?.getAttribute("data-node-id");
    request.operations.undoOperations.push({
        action: "insert",
        id,
        previousID,
        data: request.item.outerHTML,
        parentID: getOperationParentID(request.options, request.item),
    });
    request.operations.doOperations.push({action: "delete", id});
};

/** 作用：在连续选区末项插入合并后的 Lute 结果。意图：保留旧实现的最后一项 DOM 替换和操作顺序。调用时机：连续选区的最后一个块处理时。 */
const appendContinuousResult = (request: TTurnsIntoContinuousRequest) => {
    const newHTML = convertTurnedHTML(request.options, request.html);
    const template = createConversionTemplate(newHTML);
    appendTemplateInsertOperations({...request, template});
    request.item.outerHTML = newHTML;
};

/** 作用：处理连续选区中的一个块。意图：前项移除，末项替换为整体转换结果。调用时机：连续块转换循环中。 */
const appendContinuousTurnOperations = (request: TTurnsIntoContinuousRequest) => {
    appendContinuousDeletion(request);
    const isFinalElement = request.index === request.selectsElement.length - 1;
    if (isFinalElement) {
        appendContinuousResult(request);
        return;
    }
    request.item.remove();
};

/** 作用：判断被替换块是否应成为下一次撤销插入的前置 ID。意图：不连续选区中维持多个替换块的相对顺序。调用时机：身份替换操作构造后。 */
const getNextPreviousID = (item: Element, id: string | undefined, nextElement: Element | undefined) => {
    const remainsImmediatelyBeforeNext = Boolean(nextElement && item === getPreviousBlockSibling(nextElement));
    return remainsImmediatelyBeforeNext ? id || undefined : undefined;
};

/** 作用：构造普通块转换的正反向操作并同步 DOM。意图：将逐块和连续块的差异限制在独立 helper。调用时机：快捷键或菜单转换准备完成后。 */
const buildTurnOperations = (options: TTurnsIntoTransactionOptions, selectsElement: Element[]) => {
    const operations: TTurnOperationBuffers = {doOperations: [], undoOperations: []};
    let html = "";
    let previousID: string | undefined;
    for (let index = 0; index < selectsElement.length; index++) {
        const item = selectsElement[index];
        // 选区查询可能包含非 HTMLElement 节点，只对可写块节点构造转换操作。
        if (!(item instanceof HTMLElement)) {
            continue;
        }
        clearElementSelection(item);
        html += item.outerHTML;
        const convertsIndividually = !options.isContinue || Boolean(options.level);
        if (convertsIndividually) {
            const result = appendIndividualTurnOperations({options, item, index, previousID, selectsElement, operations});
            previousID = result.replacedIdentity ? getNextPreviousID(item, result.id, selectsElement[index + 1]) : previousID;
            continue;
        }
        appendContinuousTurnOperations({options, item, index, html, selectsElement, operations});
        previousID = undefined;
    }
    return operations;
};

/** 作用：构造未通过快捷键触发的现有选区。意图：保留调用方提供的范围供提交后恢复焦点。调用时机：菜单或 API 转换入口。 */
const prepareExistingSelection = (options: TTurnsIntoTransactionOptions) => {
    const prepared = {selectsElement: options.selectsElement || [], shouldAbort: false};
    if (!options.range) {
        return prepared;
    }
    return {...prepared, range: options.range};
};

/** 作用：读取快捷键触发的连续选区和 WBR。意图：转换前冻结焦点位置并拒绝列表项快捷键转换。调用时机：nodeElement 参数存在时。 */
const prepareShortcutSelection = (options: TTurnsIntoTransactionOptions) => {
    const range = getSelection().getRangeAt(0);
    range.insertNode(document.createElement("wbr"));
    const selectedElements = Array.from(options.protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
    const selectsElement = selectedElements.length > 0 ? selectedElements : options.nodeElement ? [options.nodeElement] : [];
    let isContinue = false;
    for (let index = 0; index < selectsElement.length; index++) {
        const item = selectsElement[index];
        if (item.classList.contains("li")) {
            return {selectsElement, shouldAbort: true, range};
        }
        const nextElement = selectsElement[index + 1];
        const continuesWithNext = Boolean(nextElement && getNextBlockSibling(item) === nextElement);
        if (continuesWithNext) {
            isContinue = true;
            continue;
        }
        // 选区中间出现断点时不能按连续块合并，保留逐块转换语义。
        if (index !== selectsElement.length - 1) {
            isContinue = false;
            break;
        }
    }
    const firstElement = selectsElement[0];
    const isSameHeadingLevel = selectsElement.length === 1 && options.type === "Blocks2Hs" &&
        firstElement?.getAttribute("data-type") === "NodeHeading" &&
        options.level === parseInt(firstElement.getAttribute("data-subtype")?.substring(1) || "", 10);
    // 快捷键将标题转换为相同层级时应退化为段落，保留既有取消标题行为。
    if (isSameHeadingLevel) {
        options.type = "Blocks2Ps";
    }
    options.isContinue = isContinue;
    return {selectsElement, shouldAbort: false, range};
};

/** 作用：准备普通块转换所需的选区。意图：将快捷键特殊逻辑与事务构造分离。调用时机：普通块转换开始时。 */
const prepareTurnsIntoSelection = (options: TTurnsIntoTransactionOptions) => {
    if (!options.nodeElement) {
        return prepareExistingSelection(options);
    }
    return prepareShortcutSelection(options);
};

/** 作用：恢复普通块转换后的焦点。意图：优先使用 WBR 保持快捷键输入位置，否则聚焦首个转换块。调用时机：普通块事务提交完成后。 */
const restoreTurnFocus = (options: TTurnsIntoTransactionOptions, prepared: TPreparedTurnsIntoSelection) => {
    if (options.unfocus) {
        return;
    }
    const range = prepared.range || options.range;
    if (range) {
        focusByWbr(options.protyle.wysiwyg.element, range);
        return;
    }
    const firstElement = prepared.selectsElement[0];
    focusBlock(options.protyle.wysiwyg.element.querySelector(`[data-node-id="${firstElement.getAttribute("data-node-id")}"]`));
};

/**
 * 作用：将多个普通块转换为段落或标题。
 * 意图：在一次撤销记录中保留 Lute 转换、折叠与焦点语义。
 * 调用时机：块标菜单、快捷键和 Protyle API 调用时。
 * @同步豁免: 需要绝对同步的DOM访问 - 键盘事件必须在当前选区、WBR 和 observer 生命周期内完成 DOM 替换与事务登记，异步化会使后续输入落到过期节点。
 */
export const turnsIntoTransaction = (options: TTurnsIntoTransactionOptions) => {
    // https://github.com/siyuan-note/siyuan/issues/14505
    options.protyle.observerLoad?.disconnect();
    const prepared = prepareTurnsIntoSelection(options);
    if (prepared.shouldAbort || prepared.selectsElement.length === 0) {
        return;
    }
    const operations = buildTurnOperations(options, prepared.selectsElement);
    transaction(options.protyle, operations.doOperations, operations.undoOperations);
    getTransactionTransformVisualEffects().renderConvertedBlocks(options.protyle);
    restoreTurnFocus(options, prepared);
    hideElements(["gutter"], options.protyle);
};
