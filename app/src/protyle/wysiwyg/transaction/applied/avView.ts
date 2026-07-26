/** 用途：事务协议常量；使用范围：内核请求；解耦评估：经本域网关直达常量所有者。 */
import {Constants} from "./imports";
/** 用途：提交事务请求；使用范围：内核写入；解耦评估：经本域网关直达网络唯一实现。 */
import {fetchPost} from "./imports";
/** 用途：刷新文档字数；使用范围：事务响应；解耦评估：经本域网关直达状态端口。 */
import {countBlockWord} from "./imports";
/** 用途：串行事务队列；使用范围：内核提交；解耦评估：经本域网关直达队列唯一实现。 */
import {queueTransaction} from "./imports";
/** 用途：登记撤销状态；使用范围：提交前；解耦评估：经本域网关直达 undo 唯一实现。 */
import {registerTransactionUndo} from "./imports";
/** 用途：已应用 AV 视图提交完整数据；使用范围：串行请求生命周期；解耦评估：同域纯类型声明。 */
import type {AppliedAVViewCommit} from "./applied.types";

/** 收集当前编辑器选择块 ID，保持事务响应后的字数刷新语义。 */
const collectSelectedBlockIDs = (protyle: IProtyle) => {
    const ids: string[] = [];
    for (const item of protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select")) {
        const id = item.getAttribute("data-node-id");
        if (id) {
            ids.push(id);
        }
    }
    return ids;
};

/** 校验此入口只处理 Presentation 已同步应用到 DOM 的 AV 视图事务。 */
const assertAppliedAVViewOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find((operation) => operation.action !== "setAttrViewBlockView");
    if (invalidOperation) {
        throw new Error(`Applied AV view transaction does not accept action ${invalidOperation.action}`);
    }
};

/** 内核确认事务后刷新当前编辑器的选择块字数。 */
const completeAppliedAVViewCommit = (commit: AppliedAVViewCommit) => {
    const selectedBlockIDs = collectSelectedBlockIDs(commit.protyle);
    countBlockWord(selectedBlockIDs, commit.protyle.block.rootID, true);
};

/** 向内核发送一个已同步应用的 AV 视图事务。 */
const postAppliedAVViewCommit = (commit: AppliedAVViewCommit) => {
    const payload = {
        session: commit.protyle.id,
        app: Constants.SIYUAN_APPID,
        transactions: [{doOperations: commit.doOperations, undoOperations: commit.undoOperations}],
    };
    return fetchPost("/api/transactions", payload, completeAppliedAVViewCommit.bind(undefined, commit));
};

/** 提交已由调用方同步应用到 DOM 的 AV 视图切换事务。 @同步豁免: 生命周期 - undo 登记与排队必须在当前交互栈内完成。 */
export const submitAppliedAVViewTransaction = (protyle: IProtyle, doOperations: IOperation[], undoOperations: IOperation[]) => {
    assertAppliedAVViewOperations(doOperations);
    assertAppliedAVViewOperations(undoOperations);
    if (doOperations.length === 0) {
        return;
    }
    registerTransactionUndo(protyle, doOperations, undoOperations);
    if (protyle.lite) {
        return;
    }
    const commit: AppliedAVViewCommit = {protyle, doOperations, undoOperations};
    queueTransaction(protyle, postAppliedAVViewCommit.bind(undefined, commit));
};
