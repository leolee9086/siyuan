/** 用途：聚焦转换后的目标块。使用范围：引述输入转换。解耦评估：通过同域 imports 网关使用选择能力。 */
import {focusBlock} from "./imports";
/** 用途：按 WBR 恢复光标。使用范围：引述输入转换。解耦评估：通过同域 imports 网关使用选择能力。 */
import {focusByWbr} from "./imports";
/** 用途：读取编辑范围。使用范围：引述输入转换。解耦评估：通过同域 imports 网关使用选择能力。 */
import {getEditorRange} from "./imports";
/** 用途：生成撤销焦点上下文。使用范围：引述输入转换。解耦评估：通过同域 imports 网关使用选择能力。 */
import {getUndoFocusContext} from "./imports";
/** 用途：处理相邻折叠标题。使用范围：插入空引述前。解耦评估：通过同域 imports 网关使用折叠能力。 */
import {setFold} from "./imports";
/** 用途：关闭转换后的块标工具。使用范围：引述输入转换。解耦评估：通过同域 imports 网关使用 UI 命令。 */
import {hideElements} from "./imports";
/** 用途：创建单容器转换操作。使用范围：把段落包入引述。解耦评估：通过同域 imports 网关使用稳定事务命令。 */
import {turnsIntoOneTransaction} from "./imports";
/** 用途：提交可撤销操作。使用范围：引述输入转换。解耦评估：通过同域 imports 网关使用提交协议。 */
import {transaction} from "./imports";
/** 用途：描述附加事务的正反向操作。使用范围：引述输入转换。解耦评估：纯类型不加载提交实现。 */
import type {TAdditionalTransactionOperations} from "../types";
/** 用途：描述引述输入更新选项。使用范围：引述输入转换。解耦评估：纯类型不加载输入实现。 */
import type {TBlockquoteUpdateOptions} from "../types";

/** 作用：读取事务目标 ID。意图：避免向内核提交无效操作。调用时机：组装引述插入或更新操作时。 */
const getRequiredNodeID = (element: Element) => {
    const id = element.getAttribute("data-node-id");
    if (!id) {
        throw new Error("Blockquote transaction target is missing data-node-id");
    }
    return id;
};

/** 作用：把已修改的输入块加入事务。意图：将标记删除和容器变换保持为一个撤销单元。调用时机：引述转换附带输入更新时。 */
const appendUpdateOperations = (operations: TAdditionalTransactionOperations, update: {
    element: HTMLElement,
    oldHTML: string,
    undoContext?: Record<string, string>,
}) => {
    const id = getRequiredNodeID(update.element);
    operations.doOperations.unshift({action: "update", id, data: update.element.outerHTML});
    const undoOperation: IOperation = {action: "update", id, data: update.oldHTML};
    if (update.undoContext) {
        undoOperation.context = update.undoContext;
    }
    operations.undoOperations.push(undoOperation);
};

/** 作用：合并调用方提供的附加事务。意图：保留输入转换与外部命令的原子撤销。调用时机：引述转换提交前。 */
const appendAdditionalOperations = (operations: TAdditionalTransactionOperations,
                                    additionalOperations?: TAdditionalTransactionOperations) => {
    if (!additionalOperations) {
        return;
    }
    operations.doOperations.unshift(...additionalOperations.doOperations);
    operations.undoOperations.push(...additionalOperations.undoOperations);
};

/**
 * 作用：在指定块后插入空引述。
 * 意图：保留输入位置、折叠状态和撤销上下文。
 * 调用时机：输入处理创建相邻引述时。
 * @同步豁免: 需要绝对同步的DOM访问 - 当前输入事件必须连续插入 DOM、登记事务和恢复光标。
 */
export const insertEmptyBlockquote = (protyle: IProtyle, previousElement: HTMLElement, options?: {
    updateElement: HTMLElement,
} & TBlockquoteUpdateOptions) => {
    const range = getEditorRange(protyle.wysiwyg.element);
    const template = document.createElement("template");
    template.innerHTML = protyle.lute.SpinBlockDOM(">" + Lute.Caret);
    const firstElement = template.content.firstElementChild;
    if (!(firstElement instanceof HTMLElement) || firstElement.getAttribute("data-type") !== "NodeBlockquote") {
        return;
    }
    const foldData = previousElement.getAttribute("data-type") === "NodeHeading" &&
        previousElement.getAttribute("fold") === "1" ? setFold(protyle, previousElement, true, false, false, true) : undefined;
    const id = getRequiredNodeID(firstElement);
    const operations: TAdditionalTransactionOperations = {
        doOperations: [{
            action: "insert", id, data: firstElement.outerHTML,
            previousID: previousElement.getAttribute("data-node-id"),
            parentID: previousElement.parentElement?.getAttribute("data-node-id") || protyle.block.parentID,
        }],
        undoOperations: [{action: "delete", id}],
    };
    const undoContext = options?.undoContext || getUndoFocusContext(protyle.wysiwyg.element, range, true);
    const insertUndoOperation = operations.undoOperations[0];
    // 仅当撤销焦点和删除操作都存在时才写入上下文，避免访问空操作列表。
    if (undoContext && insertUndoOperation) {
        insertUndoOperation.context = undoContext;
    }
    if (options) {
        appendUpdateOperations(operations, {
            element: options.updateElement,
            oldHTML: options.oldHTML,
            undoContext: options.undoContext,
        });
        appendAdditionalOperations(operations, options.additionalOperations);
    }
    operations.doOperations.push(...(foldData?.doOperations || []));
    operations.undoOperations.push(...(foldData?.undoOperations || []));
    previousElement.insertAdjacentElement("afterend", firstElement);
    transaction(protyle, operations.doOperations, operations.undoOperations);
    focusByWbr(firstElement, range);
    hideElements(["gutter"], protyle);
};

/** 作用：把单个块包裹进引述容器。意图：复用多块转换的事务语义并保留光标。调用时机：段落输入 `>` 标记后。 */
export const wrapBlockInBlockquote = async (protyle: IProtyle, blockElement: HTMLElement,
                                             options?: TBlockquoteUpdateOptions) => {
    const range = getEditorRange(protyle.wysiwyg.element);
    const blockID = getRequiredNodeID(blockElement);
    const operations = await turnsIntoOneTransaction({
        protyle,
        selectsElement: [blockElement],
        type: "Blocks2Blockquote",
        getOperations: true,
    });
    if (!operations) {
        return;
    }
    const undoContext = options?.undoContext || getUndoFocusContext(protyle.wysiwyg.element, range, true);
    const lastUndoOperation = operations.undoOperations.at(-1);
    // 容器转换生成的最后一个反向操作负责恢复输入前的选择范围。
    if (lastUndoOperation && undoContext) {
        lastUndoOperation.context = undoContext;
    }
    if (options) {
        appendUpdateOperations(operations, {
            element: blockElement,
            oldHTML: options.oldHTML,
            undoContext: options.undoContext,
        });
        appendAdditionalOperations(operations, options.additionalOperations);
    }
    transaction(protyle, operations.doOperations, operations.undoOperations);
    const currentBlockElement = protyle.wysiwyg.element.querySelector(`[data-node-id="${blockID}"]`);
    if (!currentBlockElement) {
        hideElements(["gutter"], protyle);
        return;
    }
    // 引擎保留 WBR 时优先恢复字符级光标，否则退化为块级焦点。
    if (currentBlockElement.querySelector("wbr")) {
        focusByWbr(currentBlockElement, range);
        hideElements(["gutter"], protyle);
        return;
    }
    focusBlock(currentBlockElement);
    hideElements(["gutter"], protyle);
};
