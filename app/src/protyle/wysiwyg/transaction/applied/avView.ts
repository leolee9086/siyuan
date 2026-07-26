/** 用途：提交已完成本地呈现决策的事务；使用范围：严格 AV View 命令；解耦评估：经本域网关直达 Prepared Transaction 唯一实现。 */
import {submitPreparedTransaction} from "./imports";

/** 校验此入口只处理 Presentation 已同步应用到 DOM 的 AV 视图事务。 */
const assertAppliedAVViewOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find((operation) => operation.action !== "setAttrViewBlockView");
    if (invalidOperation) {
        throw new Error(`Applied AV view transaction does not accept action ${invalidOperation.action}`);
    }
};

/** 提交已由调用方同步应用到 DOM 的 AV 视图切换事务。 @同步豁免: 生命周期 - undo 登记与排队必须在当前交互栈内完成。 */
export const submitAppliedAVViewTransaction = (protyle: IProtyle, doOperations: IOperation[], undoOperations: IOperation[]) => {
    assertAppliedAVViewOperations(doOperations);
    assertAppliedAVViewOperations(undoOperations);
    submitPreparedTransaction({protyle, doOperations, undoOperations});
};
