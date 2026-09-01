/** 用途：提交完成 Groups 本地数据与 DOM 呈现的事务；使用范围：本文件严格命令；解耦评估：同域直达 Prepared Transaction 内核。 */
import {submitPreparedTransaction} from "./imports";

/** 判断 action 是否属于 AV Groups 的完整封闭集合。 */
const isAVGroupAction = (action: IOperation["action"]) =>
    action === "setAttrViewGroup" ||
    action === "removeAttrViewGroup" ||
    action === "hideAttrViewGroup" ||
    action === "hideAttrViewAllGroups" ||
    action === "sortAttrViewGroup" ||
    action === "foldAttrViewGroup" ||
    action === "foldAttrViewGroups";

/** 校验 Groups 命令不会提交其调用域呈现未覆盖的 action。 */
const assertAVGroupOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find(operation => !isAVGroupAction(operation.action));
    if (invalidOperation) {
        throw new Error(`AV group transaction does not accept action ${invalidOperation.action}`);
    }
};

/** 提交已由 Groups Panel、拖拽或折叠流程同步应用到本地状态的事务。 @同步豁免: 生命周期 - action 校验、undo 登记和排队必须属于同一交互栈。 */
export const submitAVGroupTransaction = (protyle: IProtyle, doOperations: IOperation[], undoOperations: IOperation[]) => {
    assertAVGroupOperations(doOperations);
    assertAVGroupOperations(undoOperations);
    submitPreparedTransaction({protyle, doOperations, undoOperations});
};
