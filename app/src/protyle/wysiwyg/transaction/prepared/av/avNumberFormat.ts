/** 用途：提交完成 Number Format 菜单交互的事务；使用范围：本文件严格命令；解耦评估：同域直达 Prepared Transaction 内核。 */
import {submitPreparedTransaction} from "./imports";

/** 校验 Number Format 命令只提交数值列格式更新。 */
const assertAVNumberFormatOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find(operation => operation.action !== "updateAttrViewColNumberFormat");
    if (invalidOperation) {
        throw new Error(`AV number format transaction does not accept action ${invalidOperation.action}`);
    }
};

/** 提交已由数值格式菜单完成交互呈现的事务。 @同步豁免: 生命周期 - action 校验、undo 登记和排队必须属于同一交互栈。 */
export const submitAVNumberFormatTransaction = (protyle: IProtyle, doOperations: IOperation[], undoOperations: IOperation[]) => {
    assertAVNumberFormatOperations(doOperations);
    assertAVNumberFormatOperations(undoOperations);
    submitPreparedTransaction({protyle, doOperations, undoOperations});
};
