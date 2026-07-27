/** 用途：提交已完成当前菜单状态决策的 View Layout 事务；使用范围：本文件严格命令；解耦评估：经 View Prepared 网关直达提交内核。 */
import {submitPreparedTransaction} from "./imports";

/** 判断 action 是否属于 View Layout toggle 的完整封闭集合。 */
const isAVLayoutSettingAction = (action: IOperation["action"]) =>
    action === "hideAttrViewName" ||
    action === "setAttrViewShowIcon" ||
    action === "setAttrViewWrapField" ||
    action === "setAttrViewFitImage" ||
    action === "setAttrViewDisplayFieldName" ||
    action === "setAttrViewFillColBackgroundColor";

/** 校验 View Layout 命令没有混入其它领域 action。 */
const assertAVLayoutSettingOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find(operation => !isAVLayoutSettingAction(operation.action));
    if (invalidOperation) {
        throw new Error(`AV layout setting transaction does not accept action ${invalidOperation.action}`);
    }
};

/**
 * 提交 Layout 菜单已完成当前视图对象更新的 toggle 事务。
 * @同步豁免: 生命周期
 */
export const submitAVLayoutSettingTransaction = (
    protyle: IProtyle,
    doOperations: IOperation[],
    undoOperations: IOperation[],
) => {
    assertAVLayoutSettingOperations(doOperations);
    assertAVLayoutSettingOperations(undoOperations);
    submitPreparedTransaction({protyle, doOperations, undoOperations});
};
