/** 用途：提交完成 Filter 本地树状态更新的事务；使用范围：本文件严格命令；解耦评估：经 AV Prepared 网关复用唯一提交内核。 */
import {submitPreparedTransaction} from "./imports";

/** 校验 Filter 命令只提交完整筛选树更新。 */
const assertAVFilterOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find(operation => operation.action !== "setAttrViewFilters");
    if (invalidOperation) {
        throw new Error(`AV filter transaction does not accept action ${invalidOperation.action}`);
    }
};

/** 提交已由 Filter 调用域同步应用到筛选树和面板 DOM 的事务。 @同步豁免: 生命周期 - action 校验、undo 登记和排队必须属于同一交互栈。 */
export const submitAVFilterTransaction = (protyle: IProtyle, doOperations: IOperation[], undoOperations: IOperation[]) => {
    assertAVFilterOperations(doOperations);
    assertAVFilterOperations(undoOperations);
    submitPreparedTransaction({protyle, doOperations, undoOperations});
};
