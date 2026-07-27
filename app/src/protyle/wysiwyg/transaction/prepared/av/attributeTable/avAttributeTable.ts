/** 用途：提交属性表完整事务；使用范围：本文件严格命令；解耦评估：同域直达 Prepared Transaction 内核。 */
import {submitPreparedTransaction} from "./imports";
/** 用途：Prepared Transaction 完整提交类型；使用范围：按存在性构造可选 undo/回调；解耦评估：同域纯类型。 */
import type {PreparedTransactionCommit} from "./imports";
/** 用途：属性表复合事务完整数据；使用范围：严格命令输入；解耦评估：同子域纯类型声明。 */
import type {AVAttributeTableCommit} from "./attributeTable.types";

/** 属性表字段排序与行删除/恢复事务所需的完整封闭 action 集合。 */
const isAVAttributeTableAction = (action: IOperation["action"]) =>
    action === "sortAttrViewKey" ||
    action === "removeAttrViewBlock" ||
    action === "insertAttrViewBlock" ||
    action === "updateAttrViewCell" ||
    action === "sortAttrViewRow";

/** 拒绝属性表交互没有规划本地呈现和 undo 的其它 action。 */
const assertAVAttributeTableOperations = (operations: IOperation[] | undefined) => {
    const invalidOperation = operations?.find(operation => !isAVAttributeTableAction(operation.action));
    if (invalidOperation) {
        throw new Error(`AV attribute table transaction does not accept action ${invalidOperation.action}`);
    }
};

/** 提交属性表字段排序或完整行删除/恢复事务。 @同步豁免: 生命周期 - 校验、undo 登记和成功回调必须属于同一交互栈。 */
export const submitAVAttributeTableTransaction = (
    request: AVAttributeTableCommit,
) => {
    assertAVAttributeTableOperations(request.doOperations);
    assertAVAttributeTableOperations(request.undoOperations);
    const commit: PreparedTransactionCommit = {
        protyle: request.protyle,
        doOperations: request.doOperations,
    };
    if (request.undoOperations) {
        commit.undoOperations = request.undoOperations;
    }
    if (request.callback) {
        commit.callback = request.callback;
    }
    submitPreparedTransaction(commit);
};
