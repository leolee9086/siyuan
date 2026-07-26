/** 用途：访问事务应用常量。使用范围：无编辑器提交。解耦评估：经本子域网关直达常量所有者。 */
import {Constants} from "./imports";
/** 用途：提交事务网络请求。使用范围：无编辑器提交。解耦评估：经本子域网关直达网络实现。 */
import {fetchPost} from "./imports";
/** 用途：创建空块。使用范围：删除最后一个顶层块后的恢复。解耦评估：经本子域网关直达块工厂。 */
import {genEmptyElement} from "./imports";
/** 用途：定位顶层块。使用范围：跨文档移动清理。解耦评估：经本子域网关直达查询实现。 */
import {getTopAloneElement} from "./imports";
/** 用途：执行本地同步和内核提交。使用范围：事务命令主流程。解耦评估：复用现有唯一实现。 */
import {promiseTransaction} from "./imports";
/** 用途：验证块与操作身份。使用范围：空编辑器恢复和顶层删除。解耦评估：复用事务子域唯一验证规则。 */
import {requireTransactionIdentity} from "./identity";

/** 同步登记撤销数据并更新编辑状态。 */
const registerUndo = (protyle: IProtyle, doOperations: IOperation[], undoOperations?: IOperation[]) => {
    if (!undoOperations) {
        return;
    }
    const config = window.siyuan.config;
    if (!config) {
        throw new Error("Transaction undo registration requires initialized config");
    }
    const undo = protyle.undo;
    if (!undo) {
        throw new Error("Transaction undo registration requires undo manager");
    }
    // 当前标签复用模式下，首次本地更新后立即清除未更新标记。
    if (config.fileTree.openFilesUseCurrentTab && protyle.model) {
        protyle.model.headElement.classList.remove("item--unupdate");
    }
    protyle.updated = true;
    undo.add(doOperations, undoOperations, protyle);
};

/**
 * 提交一组可撤销操作。
 * @同步豁免: 遗留代码 - 调用方依赖当前事件内同步登记 undo、更新状态并启动提交
 * @参数豁免: 遗留代码 - 保持现有公开事务 API 与全部调用点兼容
 */
export const transaction =
    /** @参数豁免: 遗留代码 - 保持现有公开事务 API 与全部调用点兼容 */
    (protyle: IProtyle, doOperations: IOperation[], undoOperations?: IOperation[],
                            options?: {skipSync?: boolean; callback?: () => void}) => {
    if (doOperations.length === 0) {
        return;
    }
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
    registerUndo(protyle, doOperations, undoOperations);
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

    doOperations.find(item => {
        // 插入操作会改变观察区域，提交启动后立即断开旧加载观察器。
        if (item.action === "insert") {
            protyle.observerLoad?.disconnect();
            return true;
        }
    });
};

/** 删除后为空的编辑器同步恢复可编辑状态。 */
const restoreEmptyEditor = (protyle: IProtyle, doOperations: IOperation[]) => {
    const wysiwyg = protyle.wysiwyg;
    if (!wysiwyg) {
        throw new Error("Transaction empty-editor recovery requires wysiwyg runtime");
    }
    if (wysiwyg.element.childElementCount !== 0) {
        return;
    }
    const rootID = requireTransactionIdentity(protyle.block.rootID, "block root ID");
    const blockID = requireTransactionIdentity(protyle.block.id, "block ID");
    // 非根文档删除至空时回到根视图，由 zoomOut 负责恢复内容。
    if (rootID !== blockID) {
        protyle.getInstance().zoomOut({
            id: rootID,
            isPushBack: false,
            focusId: blockID,
        });
        return;
    }
    const newId = Lute.NewNodeID();
    const newElement = genEmptyElement(false, false, newId);
    doOperations.push({
        action: "insert",
        data: newElement.outerHTML,
        id: newId,
        parentID: protyle.block.parentID
    });
    wysiwyg.element.innerHTML = newElement.outerHTML;
};

/** 删除跨文档移动后的顶层元素并保持编辑器非空。 @同步豁免: 需要绝对同步的DOM访问 - 删除、空块恢复和后续事务必须在当前移动流程中连续完成 */
export const removeTopElement = (updateElement: Element, protyle: IProtyle) => {
    // 移动到其他文档中，该块需移除
    // TODO 文档没有打开时，需要通过后台获取 getTopAloneElement
    const topAloneElement = getTopAloneElement(updateElement);
    const doOperations: IOperation[] = [];
    // 删除目标位于容器内部时，额外记录被一并移除的顶层容器。
    if (topAloneElement !== updateElement) {
        updateElement.remove();
        doOperations.push({
            action: "delete",
            id: requireTransactionIdentity(topAloneElement.getAttribute("data-node-id"), "top element ID")
        });
    }
    topAloneElement.remove();
    restoreEmptyEditor(protyle, doOperations);
    // 只有实际生成删除或空块恢复操作时才提交事务。
    if (doOperations.length > 0) {
        transaction(protyle, doOperations, []);
    }
};
