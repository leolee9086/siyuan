/** 用途：提交完成 Calc 本地呈现决策的事务；使用范围：本文件严格命令；解耦评估：同域直达 Prepared Transaction 内核。 */
import {submitPreparedTransaction} from "./submit";

/** 判断 action 是否属于 Calc 元数据命令的完整封闭集合。 */
const isAVCalcAction = (action: IOperation["action"]) =>
    action === "setAttrViewColCalc" || action === "updateAttrViewColRollup";

/** 校验 Calc 命令只接受两种计算元数据 action。 */
const assertAVCalcOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find(operation => !isAVCalcAction(operation.action));
    if (invalidOperation) {
        throw new Error(`AV calc transaction does not accept action ${invalidOperation.action}`);
    }
};

/** 提交 AV Footer 或 Rollup 面板已经完成本地呈现决策的计算元数据事务。 @同步豁免: 生命周期 - 校验和提交必须属于同一交互栈。 */
export const submitAVCalcTransaction = (protyle: IProtyle, doOperations: IOperation[], undoOperations: IOperation[]) => {
    assertAVCalcOperations(doOperations);
    assertAVCalcOperations(undoOperations);
    submitPreparedTransaction({protyle, doOperations, undoOperations});
};
