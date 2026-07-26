/** 用途：提交完成 Asset 本地呈现决策的事务；使用范围：本文件严格命令；解耦评估：同域直达 Prepared Transaction 内核。 */
import {submitPreparedTransaction} from "./submit";

/** 判断 action 是否属于资源单元格值更新的完整封闭集合。 */
const isAVAssetAction = (action: IOperation["action"]) =>
    action === "updateAttrViewCell" || action === "doUpdateUpdated";

/** 校验 Asset 命令不会提交其本地呈现策略未覆盖的 action。 */
const assertAVAssetOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find(operation => !isAVAssetAction(operation.action));
    if (invalidOperation) {
        throw new Error(`AV asset transaction does not accept action ${invalidOperation.action}`);
    }
};

/** 提交已由 Asset 编辑器同步应用到 DOM 的值更新事务。 @同步豁免: 生命周期 - action 校验、undo 登记和排队必须属于同一交互栈。 */
export const submitAVAssetTransaction = (protyle: IProtyle, doOperations: IOperation[], undoOperations: IOperation[]) => {
    assertAVAssetOperations(doOperations);
    assertAVAssetOperations(undoOperations);
    submitPreparedTransaction({protyle, doOperations, undoOperations});
};
