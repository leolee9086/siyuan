/** 用途：提交完成 AV 标题本地呈现决策的事务；使用范围：本文件严格命令；解耦评估：同域直达 Prepared Transaction 内核。 */
import {submitPreparedTransaction} from "./imports";

/** 判断 action 是否属于 AV 标题和所属块更新时间的完整封闭集合。 */
const isAVNameAction = (action: IOperation["action"]) =>
    action === "setAttrViewName" || action === "doUpdateUpdated";

/** 校验标题同步不会提交其本地 DOM 呈现未覆盖的 action。 */
const assertAVNameOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find(operation => !isAVNameAction(operation.action));
    if (invalidOperation) {
        throw new Error(`AV name transaction does not accept action ${invalidOperation.action}`);
    }
};

/** 提交已由标题同步流程应用到当前页 DOM 的名称事务。 @同步豁免: 生命周期 - action 校验、undo 登记和排队必须属于同一输入事件栈。 */
export const submitAVNameTransaction = (options: {
    protyle: IProtyle;
    doOperations: IOperation[];
    undoOperations: IOperation[];
    callback?: () => void;
}) => {
    assertAVNameOperations(options.doOperations);
    assertAVNameOperations(options.undoOperations);
    submitPreparedTransaction(options);
};
