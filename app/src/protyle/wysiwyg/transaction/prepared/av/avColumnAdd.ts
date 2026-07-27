/** 用途：提交已完成列添加本地呈现的事务；使用范围：本文件严格命令；解耦评估：同域直达 Prepared Transaction 内核。 */
import {submitPreparedTransaction} from "./imports";

/** 判断 action 是否属于添加列及更新时间的完整封闭集合。 */
const isAVColumnAddAction = (action: IOperation["action"]) =>
    action === "addAttrViewCol" ||
    action === "removeAttrViewCol" ||
    action === "doUpdateUpdated";

/** 校验添加列命令不会提交其同步 DOM 呈现未覆盖的 action。 */
const assertAVColumnAddOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find(operation => !isAVColumnAddAction(operation.action));
    if (invalidOperation) {
        throw new Error(`AV column add transaction does not accept action ${invalidOperation.action}`);
    }
};

/** 提交已由添加列流程同步应用到表格或自定义属性 DOM 的事务。 @同步豁免: 生命周期 - action 校验、undo 登记和排队必须属于同一交互栈。 */
export const submitAVColumnAddTransaction = (protyle: IProtyle, doOperations: IOperation[], undoOperations: IOperation[]) => {
    assertAVColumnAddOperations(doOperations);
    assertAVColumnAddOperations(undoOperations);
    submitPreparedTransaction({protyle, doOperations, undoOperations});
};
