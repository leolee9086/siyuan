/** 已应用 AV 视图事务进入串行内核提交阶段的完整数据。 */
export interface AppliedAVViewCommit {
    protyle: IProtyle;
    doOperations: IOperation[];
    undoOperations: IOperation[];
}
