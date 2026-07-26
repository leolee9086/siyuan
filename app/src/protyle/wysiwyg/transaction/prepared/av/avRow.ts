/** 用途：提交完成 Row 本地呈现决策的事务；使用范围：本文件严格命令；解耦评估：同域直达 Prepared Transaction 内核。 */
import {submitPreparedTransaction} from "./imports";

/** 判断 action 是否属于 Row 分页、插入、删除、复制和更新时间命令的完整封闭集合。 */
const isAVRowAction = (action: IOperation["action"]) =>
    action === "setAttrViewPageSize" ||
    action === "insertAttrViewBlock" ||
    action === "removeAttrViewBlock" ||
    action === "duplicateAttrViewRow" ||
    action === "doUpdateUpdated";

/** 校验 Row 命令不会提交其本地呈现策略未覆盖的 action。 */
const assertAVRowOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find(operation => !isAVRowAction(operation.action));
    if (invalidOperation) {
        throw new Error(`AV row transaction does not accept action ${invalidOperation.action}`);
    }
};

/** 提交 AV Row 已完成本地呈现或明确交给 AV 刷新的行事务。 @同步豁免: 生命周期 - action 校验和提交必须属于同一交互栈。 */
export const submitAVRowTransaction = (protyle: IProtyle, doOperations: IOperation[], undoOperations: IOperation[]) => {
    assertAVRowOperations(doOperations);
    assertAVRowOperations(undoOperations);
    submitPreparedTransaction({protyle, doOperations, undoOperations});
};
