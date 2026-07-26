/** 用途：提交完成 Cell Update 本地呈现决策的事务；使用范围：本文件严格命令；解耦评估：同域直达 Prepared Transaction 内核。 */
import {submitPreparedTransaction} from "./submit";

/** 判断 action 是否属于 AV 单元格值与选择项配置更新的完整封闭集合。 */
const isAVCellUpdateAction = (action: IOperation["action"]) =>
    action === "updateAttrViewCell" ||
    action === "updateAttrViewColOptions" ||
    action === "removeAttrViewColOption" ||
    action === "doUpdateUpdated";

/** 校验 Cell Update 命令不会提交其值变换和本地呈现未覆盖的 action。 */
const assertAVCellUpdateOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find(operation => !isAVCellUpdateAction(operation.action));
    if (invalidOperation) {
        throw new Error(`AV cell update transaction does not accept action ${invalidOperation.action}`);
    }
};

/** 提交已由 Cell Update 同步应用到 DOM 和列配置的值事务。 @同步豁免: 生命周期 - action 校验、undo 登记和排队必须属于同一交互栈。 */
export const submitAVCellUpdateTransaction = (protyle: IProtyle, doOperations: IOperation[], undoOperations: IOperation[]) => {
    assertAVCellUpdateOperations(doOperations);
    assertAVCellUpdateOperations(undoOperations);
    submitPreparedTransaction({protyle, doOperations, undoOperations});
};
