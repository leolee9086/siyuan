/**
 * 用途：表示调用域已完成本地呈现决策、可以进入撤销登记与内核提交的完整事务。
 * 使用场景：严格 AV 命令校验自身 action 后交给 Prepared Transaction 内核。
 * 关联类型：包含标准 `IProtyle`、do/undo `IOperation`，不暴露本地 DOM 分派能力。
 * 问题/改进：新增调用域必须先建立封闭 action 命令，业务模块不得直接构造此提交对象。
 */
export interface PreparedTransactionCommit {
    protyle: IProtyle;
    doOperations: IOperation[];
    undoOperations: IOperation[];
}
