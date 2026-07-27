/** 用途：提交等待内核广播投影的普通 View 事务；使用范围：本文件严格命令；解耦评估：经 View Prepared 网关直达提交内核。 */
import {submitPreparedTransaction} from "./imports";

/** 判断 action 是否属于普通 View 聚合的完整封闭集合。 */
const isAVViewAction = (action: IOperation["action"]) =>
    action === "addAttrViewView" ||
    action === "removeAttrViewView" ||
    action === "duplicateAttrViewView" ||
    action === "sortAttrViewView" ||
    action === "setAttrViewViewName" ||
    action === "setAttrViewViewDesc" ||
    action === "setAttrViewViewIcon" ||
    action === "setAttrViewBlockView";

/** 校验普通 View 命令没有混入其它领域 action。 */
const assertAVViewOperations = (operations: IOperation[]) => {
    const invalidOperation = operations.find(operation => !isAVViewAction(operation.action));
    if (invalidOperation) {
        throw new Error(`AV view transaction does not accept action ${invalidOperation.action}`);
    }
};

/**
 * 提交由内核广播触发 `refreshAV` 投影的普通 View 事务。
 * 已由调用域同步应用 DOM 的入口应继续使用 Applied View 命令。
 * @同步豁免: 生命周期
 */
export const submitAVViewTransaction = (
    protyle: IProtyle,
    doOperations: IOperation[],
    undoOperations: IOperation[],
) => {
    assertAVViewOperations(doOperations);
    assertAVViewOperations(undoOperations);
    submitPreparedTransaction({protyle, doOperations, undoOperations});
};
