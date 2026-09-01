/** 用途：读取编辑属性常量。使用范围：更新事务构造。解耦评估：通过本域 imports 网关集中基础协议。 */
import {Constants} from "./imports";
/** 用途：清理标题编号展示标记。使用范围：单块和批量更新。解耦评估：通过本域 imports 网关使用编号规则。 */
import {cleanHeadingNumberHTML} from "./imports";
/** 用途：收窄可写 HTML 元素。使用范围：执行批量更新回调前。解耦评估：通过本域 imports 网关使用类型守卫。 */
import {isHTMLElement} from "./imports";
/** 用途：同步超级块布局。使用范围：更新超级块前。解耦评估：通过本域 imports 网关使用刷新 owner。 */
import {refreshSbs} from "./imports";
/** 用途：验证事务操作 ID。使用范围：构造更新操作前。解耦评估：通过本域 imports 网关使用标识 owner。 */
import {requireTransactionIdentity} from "./imports";
/** 用途：提交可撤销更新操作。使用范围：单块和批量更新完成后。解耦评估：通过本域 imports 网关使用提交 owner。 */
import {transaction} from "./imports";

/**
 * 作用：提交单个块的更新及附加操作。
 * 意图：让输入和结构转换共享原子撤销记录。
 * 调用时机：编辑器 DOM 发生可持久化变更后。
 * @参数豁免: 遗留代码 - 保持现有公开 updateTransaction 调用协议。
 * @同步豁免: 需要绝对同步的DOM访问 - 输入事件需立即登记更新和编辑中状态。
 */
const updateTransaction = (
    protyle: IProtyle,
    element: Element,
    oldHTML: string,
    undoContext?: Record<string, string>,
    additionalOperations?: {
        doOperations: IOperation[],
        undoOperations: IOperation[],
        context?: Record<string, string>,
    },
) => {
    // 超级块的尺寸由子块布局决定，提交前同步其拖拽边界。
    if (element.getAttribute("data-type") === "NodeSuperBlock") {
        refreshSbs(element);
    }
    const id = requireTransactionIdentity(element.getAttribute("data-node-id"), "updated element ID");
    const newHTML = cleanHeadingNumberHTML(element.outerHTML);
    const cleanOldHTML = cleanHeadingNumberHTML(oldHTML);
    if (newHTML === cleanOldHTML.replace("<wbr>", "") && !additionalOperations) {
        return;
    }
    element.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
    const updateOperation: IOperation = {
        id,
        data: newHTML,
        action: "update",
    };
    // 附加操作可携带独立焦点恢复上下文，需绑定到本次正向更新。
    if (additionalOperations?.context) {
        updateOperation.context = additionalOperations.context;
    }
    const undoOperation: IOperation = {
        id,
        data: cleanOldHTML,
        action: "update",
    };
    if (undoContext) {
        undoOperation.context = undoContext;
    }
    const doOperations = additionalOperations ? [...additionalOperations.doOperations, updateOperation] : [updateOperation];
    const undoOperations = additionalOperations ? [undoOperation, ...additionalOperations.undoOperations] : [undoOperation];
    transaction(protyle, doOperations, undoOperations);
};

/**
 * 作用：批量提交多个块的原地更新。
 * 意图：把多选编辑压缩为一个可撤销事务。
 * 调用时机：批量格式命令完成 DOM 修改后。
 * @参数豁免: 遗留代码 - 保持调用方传入回调和焦点上下文的既有 API。
 * @同步豁免: 需要绝对同步的DOM访问 - 回调直接修改当前选区的 DOM，不能延迟到异步任务。
 */
const updateBatchTransaction = (
    nodeElements: Element[],
    protyle: IProtyle,
    cb: (element: HTMLElement) => void,
    focusContext?: Record<string, string>,
) => {
    const operations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    for (let index = 0; index < nodeElements.length; index++) {
        const element = nodeElements[index];
        const id = requireTransactionIdentity(element.getAttribute("data-node-id"), "batch element ID");
        element.classList.remove("protyle-wysiwyg--select");
        element.removeAttribute("select-start");
        element.removeAttribute("select-end");
        const undoOperation: IOperation = {
            action: "update",
            id,
            data: cleanHeadingNumberHTML(element.outerHTML),
        };
        // 仅第一个反向操作恢复选择范围，避免批量撤销重复抢占焦点。
        if (index === 0 && focusContext) {
            undoOperation.context = focusContext;
        }
        undoOperations.push(undoOperation);
        // 回调会修改样式和属性，必须先收窄为可写 HTMLElement。
        if (!isHTMLElement(element)) {
            throw new Error("Batch transaction requires HTMLElement nodes");
        }
        cb(element);
        element.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
        const operation: IOperation = {
            action: "update",
            id,
            data: cleanHeadingNumberHTML(element.outerHTML),
        };
        // 正向操作沿用同一焦点上下文，确保撤销与重做定位一致。
        if (index === 0 && focusContext) {
            operation.context = focusContext;
        }
        operations.push(operation);
    }
    transaction(protyle, operations, undoOperations);
};

/** 公开单块与批量更新的稳定事务 API。 */
export {updateBatchTransaction, updateTransaction};
