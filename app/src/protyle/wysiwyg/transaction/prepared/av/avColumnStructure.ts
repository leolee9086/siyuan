/** 用途：提交已完成列添加本地呈现的事务；使用范围：本文件严格命令；解耦评估：同域直达 Prepared Transaction 内核。 */
import {submitPreparedTransaction} from "./imports";

/** 判断 action 是否属于列结构变更、排序及更新时间的完整封闭集合。 */
const isAVColumnStructureAction = (action: IOperation["action"]) =>
    action === "addAttrViewCol" ||
    action === "removeAttrViewCol" ||
    action === "duplicateAttrViewKey" ||
    action === "sortAttrViewCol" ||
    action === "doUpdateUpdated";

/** 校验列结构命令不会提交其同步 DOM 呈现未覆盖的 action。 */
const assertAVColumnStructureOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find(operation => !isAVColumnStructureAction(operation.action));
    if (invalidOperation) {
        throw new Error(`AV column structure transaction does not accept action ${invalidOperation.action}`);
    }
};

/** 提交已由列添加、复制、删除或排序流程同步应用到 DOM/Panel 的事务。 @同步豁免: 生命周期 - action 校验、undo 登记和排队必须属于同一交互栈。 */
export const submitAVColumnStructureTransaction = (protyle: IProtyle, doOperations: IOperation[], undoOperations: IOperation[]) => {
    assertAVColumnStructureOperations(doOperations);
    assertAVColumnStructureOperations(undoOperations);
    submitPreparedTransaction({protyle, doOperations, undoOperations});
};
