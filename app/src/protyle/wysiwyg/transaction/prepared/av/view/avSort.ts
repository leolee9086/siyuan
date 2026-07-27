/** 用途：提交完成 Sort 本地状态决策的事务；使用范围：本文件严格命令；解耦评估：经视图条件网关复用唯一 Prepared 内核。 */
import {submitPreparedTransaction} from "./imports";

/** 校验 Sort 命令只提交完整排序列表更新。 */
const assertAVSortOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find(operation => operation.action !== "setAttrViewSorts");
    if (invalidOperation) {
        throw new Error(`AV sort transaction does not accept action ${invalidOperation.action}`);
    }
};

/** 提交已由 Sort 调用域决定并呈现的排序列表事务。 @同步豁免: 生命周期 - action 校验、undo 登记和排队必须属于同一交互栈。 */
export const submitAVSortTransaction = (protyle: IProtyle, doOperations: IOperation[], undoOperations: IOperation[]) => {
    assertAVSortOperations(doOperations);
    assertAVSortOperations(undoOperations);
    submitPreparedTransaction({protyle, doOperations, undoOperations});
};
