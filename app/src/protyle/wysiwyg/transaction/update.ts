/** 用途：访问编辑中属性协议。使用范围：单块与批量更新快照。解耦评估：经事务网关直达常量所有者。 */
import {Constants} from "./imports";
/** 用途：收窄批量更新元素。使用范围：调用 HTMLElement 回调前。解耦评估：经事务网关复用共享守卫。 */
import {isHTMLElement} from "./imports";
/** 用途：验证更新操作身份。使用范围：单块与批量快照。解耦评估：复用事务子域唯一验证规则。 */
import {requireTransactionIdentity} from "./identity";
/** 用途：提交生成的更新操作。使用范围：单块与批量更新收尾。解耦评估：直达事务提交唯一实现。 */
import {transaction} from "./submit";

/**
 * 比较元素快照并提交单块更新事务，供编辑器即时编辑流程调用。
 * @同步豁免: 遗留代码 - 必须在当前编辑事件中设置 editing 标记并登记 undo
 * @参数豁免: 遗留代码 - 保持现有公开事务 API 与全部调用点兼容
 */
export const updateTransaction =
    /** @参数豁免: 遗留代码 - 保持现有公开事务 API 与全部调用点兼容 */
    (protyle: IProtyle, element: Element, oldHTML: string,
     undoContext?: Record<string, string>) => {
        const id = requireTransactionIdentity(element.getAttribute("data-node-id"), "updated element ID");
        const newHTML = element.outerHTML;
        if (newHTML === oldHTML.replace("<wbr>", "")) {
            return;
        }
        element.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
        const undoOperation: IOperation = {
            id,
            data: oldHTML,
            action: "update",
        };
        if (undoContext) {
            undoOperation.context = undoContext;
        }
        transaction(protyle, [{
            id,
            data: newHTML,
            action: "update"
        }], [undoOperation]);
    };

/**
 * 对一组 HTML 元素应用同一变换并提交成对更新操作，供格式和外观菜单调用。
 * @同步豁免: 需要绝对同步的DOM访问 - 旧快照、变换和新快照必须在当前操作中连续采集
 */
export const updateBatchTransaction = (nodeElements: Element[], protyle: IProtyle, cb: (e: HTMLElement) => void) => {
    const operations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    for (const element of nodeElements) {
        const id = requireTransactionIdentity(element.getAttribute("data-node-id"), "batch element ID");
        element.classList.remove("protyle-wysiwyg--select");
        element.removeAttribute("select-start");
        element.removeAttribute("select-end");
        undoOperations.push({
            action: "update",
            id,
            data: element.outerHTML
        });
        // 回调协议仅接受 HTML 元素，遇到其它 Element 时明确阻止不受支持的批量事务。
        if (!isHTMLElement(element)) {
            throw new Error("Batch transaction requires HTMLElement nodes");
        }
        cb(element);
        element.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
        operations.push({
            action: "update",
            id,
            data: element.outerHTML
        });
    }
    transaction(protyle, operations, undoOperations);
};
