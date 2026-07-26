/** 用途：提交完成 Relation 本地呈现决策的事务；使用范围：本文件严格命令；解耦评估：同域直达 Prepared Transaction 内核。 */
import {submitPreparedTransaction} from "./imports";

/** 判断 action 是否属于关系字段与关系单元格更新的完整封闭集合。 */
const isAVRelationAction = (action: IOperation["action"]) =>
    action === "updateAttrViewColRelation" ||
    action === "insertAttrViewBlock" ||
    action === "updateAttrViewCell" ||
    action === "doUpdateUpdated";

/** 校验 Relation 命令不会提交其本地呈现策略未覆盖的 action。 */
const assertAVRelationOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find(operation => !isAVRelationAction(operation.action));
    if (invalidOperation) {
        throw new Error(`AV relation transaction does not accept action ${invalidOperation.action}`);
    }
};

/** 提交已由 Relation 同步应用到表头、单元格和菜单 DOM 的事务。 @同步豁免: 生命周期 - action 校验、undo 登记和排队必须属于同一交互栈。 */
export const submitAVRelationTransaction = (protyle: IProtyle, doOperations: IOperation[], undoOperations: IOperation[]) => {
    assertAVRelationOperations(doOperations);
    assertAVRelationOperations(undoOperations);
    submitPreparedTransaction({protyle, doOperations, undoOperations});
};
