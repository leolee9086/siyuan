/** 用途：访问事务应用常量。使用范围：无编辑器提交。解耦评估：经本子域网关直达常量所有者。 */
import {Constants} from "./imports";
/** 用途：提交事务网络请求。使用范围：无编辑器提交。解耦评估：经本子域网关直达网络实现。 */
import {fetchPost} from "./imports";
/** 用途：执行本地同步和内核提交。使用范围：事务命令主流程。解耦评估：复用现有唯一实现。 */
import {promiseTransaction} from "./imports";
/** 用途：在提交前按视图折叠上下文归一化事务。使用范围：所有编辑器事务。解耦评估：通过事务网关使用稳定视图状态协议。 */
import {prepareViewFoldTransaction} from "./imports";
/** 用途：清理标题编号展示标记。使用范围：事务落盘前。解耦评估：通过事务网关使用唯一编号规则。 */
import {cleanHeadingNumberOperations} from "./imports";
/** 用途：登记事务 undo；使用范围：提交前生命周期；解耦评估：同域直达唯一实现。 */
import {registerTransactionUndo} from "./undo";
/** 用途：断开插入后的旧观察器。使用范围：事务提交后置步骤。解耦评估：复用提交与嵌套同步共同的唯一生命周期实现。 */
import {disconnectInsertObserver} from "./insertObserver";
/** 用途：删除顶层元素并收集后续操作。使用范围：跨文档移动清理。解耦评估：DOM 清理与提交命令分离，双方保持静态单向依赖。 */
import {removeTopElementAndCollectOperations} from "./removeTopElement";

/**
 * 提交一组可撤销操作。
 * @同步豁免: 遗留代码 - 调用方依赖当前事件内同步登记 undo、更新状态并启动提交
 * @参数豁免: 遗留代码 - 保持现有公开事务 API 与全部调用点兼容
 */
export const transaction =
    /** @参数豁免: 遗留代码 - 保持现有公开事务 API 与全部调用点兼容 */
    (protyle: IProtyle, doOperations: IOperation[], undoOperations?: IOperation[],
                            options?: {skipSync?: boolean; callback?: () => void}) => {
    if (protyle) {
        const prepared = prepareViewFoldTransaction(protyle, doOperations, undoOperations);
        doOperations = prepared.doOperations;
        undoOperations = prepared.undoOperations;
    }
    // 视图折叠归一化可能消除所有操作，此时仅完成调用方回调，避免提交空事务。
    if (doOperations.length === 0) {
        options?.callback?.();
        return;
    }
    cleanHeadingNumberOperations(doOperations);
    cleanHeadingNumberOperations(undoOperations);
    if (!protyle) {
        fetchPost("/api/transactions", {
            session: Constants.SIYUAN_APPID,
            app: Constants.SIYUAN_APPID,
            transactions: [{
                doOperations
            }]
        }, options?.callback);
        return;
    }
    registerTransactionUndo(protyle, doOperations, undoOperations);
    if (protyle.lite) {
        return;
    }
    const executionRequest: Parameters<typeof promiseTransaction>[0] = {
        protyle,
        doOperations,
        skipSync: options?.skipSync ?? false,
    };
    if (undoOperations) {
        executionRequest.undoOperations = undoOperations;
    }
    // 仅在调用方提供完成回调时写入可选字段，满足精确可选属性协议。
    if (options?.callback) {
        executionRequest.callback = options.callback;
    }
    promiseTransaction(executionRequest);

    disconnectInsertObserver(protyle, doOperations);
};

/** 删除跨文档移动后的顶层元素并保持编辑器非空。 @同步豁免: 需要绝对同步的DOM访问 - 删除、空块恢复和后续事务必须在当前移动流程中连续完成 */
export const removeTopElement = (updateElement: Element, protyle: IProtyle) => {
    const doOperations = removeTopElementAndCollectOperations(updateElement, protyle);
    // 只有实际生成删除或空块恢复操作时才提交事务。
    if (doOperations.length > 0) {
        transaction(protyle, doOperations, []);
    }
};
