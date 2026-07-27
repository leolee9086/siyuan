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
/** 用途：显示移动端待同步状态；使用范围：事务排队前；解耦评估：经本域网关直达生命周期唯一实现。 */
import {markTransactionSyncPending} from "./imports";
/** 用途：Prepared Transaction 完整数据；使用范围：串行请求生命周期；解耦评估：同域纯类型声明。 */
import type {PreparedTransactionCommit} from "./prepared.types";

/** 收集当前编辑器选择块 ID，保持事务响应后的字数刷新语义。 */
const collectSelectedBlockIDs = (protyle: IProtyle) => {
    if (!protyle.wysiwyg) {
        throw new Error("Prepared transaction requires an initialized wysiwyg editor");
    }
    const ids: string[] = [];
    for (const item of protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select")) {
        const id = item.getAttribute("data-node-id");
        if (id) {
            ids.push(id);
        }
    }
    return ids;
};

/** 内核确认事务后刷新当前编辑器的选择块字数。 */
const completePreparedTransaction = (commit: PreparedTransactionCommit) => {
    const selectedBlockIDs = collectSelectedBlockIDs(commit.protyle);
    const rootID = commit.protyle.block.rootID;
    countBlockWord(selectedBlockIDs, rootID, true);
    commit.callback?.();
};

/** 向内核发送一个已完成调用域本地呈现决策的事务。 */
const postPreparedTransaction = (commit: PreparedTransactionCommit) => {
    const payload = {
        session: commit.protyle.id,
        app: Constants.SIYUAN_APPID,
        transactions: [{doOperations: commit.doOperations, undoOperations: commit.undoOperations}],
    };
    const complete = completePreparedTransaction.bind(undefined, commit);
    return fetchPost("/api/transactions", payload, complete);
};

/**
 * 登记并提交已由封闭领域命令完成 action 校验的事务。
 * @同步豁免: 生命周期
 * undo、移动端同步状态与排队必须在当前交互栈内依次完成。
 */
export const submitPreparedTransaction = (commit: PreparedTransactionCommit) => {
    if (commit.doOperations.length === 0) {
        return;
    }
    registerTransactionUndo(commit.protyle, commit.doOperations, commit.undoOperations);
    if (commit.protyle.lite) {
        return;
    }
    markTransactionSyncPending();
    queueTransaction(commit.protyle, postPreparedTransaction.bind(undefined, commit));
};
