/** 用途：提交完成 Column Edit 本地状态更新的事务；使用范围：本文件严格命令；解耦评估：同域直达 Prepared Transaction 内核。 */
import {submitPreparedTransaction} from "./imports";

/** 判断 action 是否属于列编辑面板的完整封闭集合。 */
const isAVColumnEditAction = (action: IOperation["action"]) =>
    action === "updateAttrViewCol" ||
    action === "setAttrViewColDesc" ||
    action === "updateAttrViewColTemplate" ||
    action === "setAttrViewUpdatedIncludeTime" ||
    action === "setAttrViewCreatedIncludeTime" ||
    action === "setAttrViewColWrap" ||
    action === "updateAttrViewColOptions" ||
    action === "removeAttrViewColOption" ||
    action === "setAttrViewColDateFillCreated" ||
    action === "setAttrViewColDateFillSpecificTime";

/** 校验 Column Edit 命令不会提交其本地状态策略未覆盖的 action。 */
const assertAVColumnEditOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find(operation => !isAVColumnEditAction(operation.action));
    if (invalidOperation) {
        throw new Error(`AV column edit transaction does not accept action ${invalidOperation.action}`);
    }
};

/** 提交已由 Column Edit 同步应用到输入控件、列数据和面板 DOM 的事务。 @同步豁免: 生命周期 - action 校验、undo 登记和排队必须属于同一交互栈。 */
export const submitAVColumnEditTransaction = (protyle: IProtyle, doOperations: IOperation[], undoOperations: IOperation[]) => {
    assertAVColumnEditOperations(doOperations);
    assertAVColumnEditOperations(undoOperations);
    submitPreparedTransaction({protyle, doOperations, undoOperations});
};
